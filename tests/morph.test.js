/* 拆字表測試：每筆都能解析、同字根群的中文一致、同字根查詢正確。
   執行：node tests/morph.test.js */
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
const a=js.indexOf('const MORPH='),b=js.indexOf("const KEY='vocab_ctx_v1'");
if(a<0||b<0){console.log('FAIL 找不到抽取標記');process.exit(1);}
const esc=s=>String(s||'');
const S={recs:{}};
const W=[...html.matchAll(/\["([a-z][a-z\- ]*)","([^"]*)","([^"]*)"/g)];
W.forEach(([,en,pos,zh],i)=>{if(!Object.values(S.recs).some(r=>r.en===en))S.recs['t'+i]={id:'t'+i,en,pos,zh,seen:false};});
Object.assign(globalThis,new Function('S','esc',js.slice(a,b)+'\nreturn {MORPH,morphOf,rootKeys,siblings,rootIndex,morphHTML,morphGroupsHTML};')(S,esc));
let fails=0;const ok=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);if(!c)fails++;};
const words=new Set(Object.values(S.recs).map(r=>r.en));
ok(Object.keys(MORPH).every(w=>words.has(w)),'拆字表的字都在字庫（'+Object.keys(MORPH).length+' 筆）');
ok(Object.keys(MORPH).every(w=>morphOf(w).every(p=>p.f&&p.z)),'每一段都有 form 與中文');
const zhByKey={};let incons=[];
Object.keys(MORPH).forEach(w=>morphOf(w).filter(p=>p.t==='root').forEach(p=>{
  if(zhByKey[p.k]&&zhByKey[p.k]!==p.z)incons.push(p.k+':'+zhByKey[p.k]+'/'+p.z);zhByKey[p.k]=zhByKey[p.k]||p.z;}));
ok(!incons.length,'同字根群的中文一致'+(incons.length?'：'+incons.slice(0,5).join('，'):''));
ok(JSON.stringify(rootKeys('predict'))==='["dict"]','predict 的字根是 dict');
ok(rootKeys('accept')[0]==='cap'&&rootKeys('receive')[0]==='cap'&&rootKeys('participate').includes('cap'),'cept／ceiv／cip 都歸 cap');
ok(JSON.stringify(rootKeys('cheerful'))==='["cheer"]'&&morphOf('cheerful').some(p=>p.t==='suf'&&p.f==='-ful'),'cheerful = cheer + -ful');
const rec=S.recs[Object.keys(S.recs).find(k=>S.recs[k].en==='receive')];
const h=morphHTML(rec);
ok(h.includes('拆字')&&h.includes('同字根')&&h.includes('<b>re-</b>')&&h.includes('concept'),'morphHTML 有拆字與同字根');
ok(morphHTML({en:'abandon'})==='','沒收錄的字 morphHTML 回空字串');
const g=morphGroupsHTML(Object.values(S.recs));
ok(g.includes('cap（抓）')&&g.includes('<b>字尾</b>')&&g.includes('<b>字首</b>')&&g.includes('re-（'),'字庫分組含字根、字首、字尾');
const sib=siblings(S.recs[Object.keys(S.recs).find(k=>S.recs[k].en==='receive')],20).map(r=>r.en);
ok(sib.includes('accept')&&sib.includes('concept')&&!sib.includes('receive'),'receive 的同字根含 accept、concept，不含自己');
const idx=rootIndex();const big=Object.entries(idx).filter(([k,v])=>v.length>=2).length;
ok(big>=80,'至少 80 個字根群有 2 字以上（實際 '+big+'）');
ok(morphOf('abandon')===null,'沒收錄的字回 null');
process.exitCode=fails?1:0;
