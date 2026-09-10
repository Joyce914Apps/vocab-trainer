#!/usr/bin/env python3
"""為單字、例句、文章產生 mp3（微軟 Edge 神經網路語音，免費）。

用法：
  pip3 install edge-tts            # 需要網路；ffmpeg 選用，有的話會壓小檔案
  python3 tools/gen_audio.py       # 產生缺少的檔案，已存在的略過
  python3 tools/gen_audio.py --accents en-US   # 只產美國
  python3 tools/gen_audio.py --kinds a         # 只產文章（w 單字、s 例句、a 文章）

輸出：
  audio/w/<slug>_<accent>.mp3          單字
  audio/s/<slug>_<accent>.mp3          例句
  audio/a/<artId>_<accent>.mp3         整篇文章（同時輸出 <artId>_<accent>.words.json：每個字的 [起秒, 迄秒, 文字]，供逐字反白）
  audio/a/<artId>_s<n>_<accent>.mp3    文章逐句（分句規則與 index.html 的 openArt 相同）

slug 規則與 index.html 的 audioSlug() 相同：小寫，非 a-z0-9 的字元換成 _。
"""
import asyncio, re, json, os, sys, argparse, subprocess, shutil, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'index.html')
OUT = os.path.join(ROOT, 'audio')
VOICES = {  # 多益英聽四國口音
    'en-US': 'en-US-JennyNeural',
    'en-GB': 'en-GB-SoniaNeural',
    'en-AU': 'en-AU-NatashaNeural',
    'en-CA': 'en-CA-ClaraNeural',
}
RATE = {'w': '+0%', 's': '-5%', 'a': '-5%', 'A': '-5%'}
BITRATE = {'w': '32k', 's': '32k', 'a': '48k', 'A': '48k'}

def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')

def load_items():
    html = open(HTML, encoding='utf-8').read()
    js = html[html.index('<script>') + 8:html.rindex('</script>')]
    # 單字與例句：所有 ["en","pos","zh","ex",...] 列
    rows = re.findall(r'\["([a-z][a-z\- ]*)","([^"]*)","([^"]*)","([^"]*)"', js)
    words, seen = [], set()
    for en, pos, zh, ex in rows:
        if en in seen: continue
        seen.add(en); words.append((en, ex))
    # 文章
    i = js.index('const ARTS='); j = js.index('];', i) + 1
    arts = json.loads(js[i + 11:j])
    return words, arts

def split_sentences(body):
    b = re.sub(r'\n+', ' \n ', body)
    return [x.strip() for x in re.split(r'(?<=[.!?])\s+', b) if x.strip()]

def jobs(words, arts, accents, kinds):
    for acc in accents:
        if 'w' in kinds:
            for en, ex in words:
                yield ('w', f'w/{slug(en)}_{acc}.mp3', en, acc)
        if 's' in kinds:
            for en, ex in words:
                if ex: yield ('s', f's/{slug(en)}_{acc}.mp3', ex, acc)
        if 'a' in kinds:
            for a in arts:
                yield ('A', f"a/{a['id']}_{acc}.mp3", a['body'], acc)   # A＝整篇，附逐字時間點
                for n, sen in enumerate(split_sentences(a['body'])):
                    yield ('a', f"a/{a['id']}_s{n}_{acc}.mp3", sen, acc)

async def synth(kind, rel, text, acc, sem, stats):
    import edge_tts
    path = os.path.join(OUT, rel)
    words_path = path[:-4] + '.words.json'
    if os.path.exists(path) and os.path.getsize(path) > 500 and (kind != 'A' or os.path.exists(words_path)):
        stats['skip'] += 1; return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.raw.mp3'
    async with sem:
        for attempt in range(5):
            try:
                if kind == 'A':
                    # 整篇：用串流拿逐字時間點（offset/duration 單位 100ns）。換行以停頓取代，句點不重複
                    spoken = re.sub(r'\n+', ' ', text)
                    comm = edge_tts.Communicate(spoken, VOICES[acc], rate=RATE[kind], boundary='WordBoundary')
                    buf, words = bytearray(), []
                    async for ch in comm.stream():
                        if ch['type'] == 'audio': buf += ch['data']
                        elif ch['type'] == 'WordBoundary':
                            s0 = ch['offset'] / 1e7; words.append([round(s0, 2), round(s0 + ch['duration'] / 1e7, 2), ch['text']])
                    open(tmp, 'wb').write(buf)
                    json.dump(words, open(words_path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
                else:
                    await edge_tts.Communicate(text, VOICES[acc], rate=RATE[kind]).save(tmp)
                break
            except Exception as e:
                await asyncio.sleep(2 + attempt * 3 + random.random())
        else:
            stats['fail'] += 1; print('FAIL', rel, file=sys.stderr); return
    if shutil.which('ffmpeg'):
        r = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', '24000',
                            '-b:a', BITRATE[kind], path])
        if r.returncode == 0: os.remove(tmp)
        else: os.replace(tmp, path)
    else:
        os.replace(tmp, path)
    stats['done'] += 1
    if stats['done'] % 100 == 0:
        print(f"進度 {stats['done']} 產生 / {stats['skip']} 略過 / {stats['fail']} 失敗", flush=True)

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--accents', default=','.join(VOICES))
    ap.add_argument('--kinds', default='a,w,s')
    ap.add_argument('--concurrency', type=int, default=5)
    args = ap.parse_args()
    accents = [a for a in args.accents.split(',') if a in VOICES]
    kinds = args.kinds.split(',')
    words, arts = load_items()
    js = list(jobs(words, arts, accents, kinds))
    print(f'{len(words)} 字、{len(arts)} 篇文章、{len(accents)} 種口音 → {len(js)} 個檔案', flush=True)
    sem = asyncio.Semaphore(args.concurrency)
    stats = {'done': 0, 'skip': 0, 'fail': 0}
    await asyncio.gather(*(synth(k, rel, t, acc, sem, stats) for k, rel, t, acc in js))
    print(f"完成：{stats['done']} 產生 / {stats['skip']} 略過 / {stats['fail']} 失敗", flush=True)

if __name__ == '__main__':
    asyncio.run(main())
