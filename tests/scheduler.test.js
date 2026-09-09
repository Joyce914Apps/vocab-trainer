/* 排程邏輯測試：從 index.html 抽出純函式段落（日期工具、讀書日、排程方案）直接執行，不需任何相依。
   執行：TZ=Asia/Taipei node tests/scheduler.test.js */
const fs=require('fs'),path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
const a=js.indexOf('/* 日期一律用本地年月日'),b=js.indexOf('let repeats={},again={};');
if(a<0||b<0){console.log('FAIL 找不到抽取標記');process.exit(1);}
const S={days:[2,3,4,5],plan:'mix'};
const EXPORTS=['isoLocal','today','plus','addDays','daysBetween','studyDays','isStudy','snap','nthStudyDay','studyDaysBetween','prevStudyDay',
  'PLANS','plan','ladder','GRADn','earlyLen','spanOf','bestPlan','levelOf','lvLabel','nextGap','applyRule','previewGap'];
Object.assign(globalThis,new Function('S',js.slice(a,b)+`\nreturn {${EXPORTS.join(',')}};`)(S));
const assert=(c,msg)=>{if(!c){console.log('FAIL',msg);process.exitCode=1;}else console.log('ok  ',msg);};
// 時區：本地日期
assert(today()===isoLocal(new Date()),'today 用本地日期');
// snap：2026-09-12 是週六（休息日）→ 應該到 09-15（週二），且不會提早一天
assert(snap('2026-09-12')==='2026-09-15','snap 週六→週二 = '+snap('2026-09-12'));
assert(snap('2026-09-10')==='2026-09-10','snap 讀書日不變 = '+snap('2026-09-10'));
assert(nthStudyDay(1,'2026-09-12')==='2026-09-15','nthStudyDay 從週六起第 1 個讀書日');
assert(nthStudyDay(5,'2026-09-08')==='2026-09-15','nthStudyDay 第 5 個 = '+nthStudyDay(5,'2026-09-08'));
assert(studyDaysBetween('2026-09-08','2026-09-14')===4,'一週 4 個讀書日');
assert(prevStudyDay('2026-09-15')==='2026-09-11','週二的上一個讀書日是週五 = '+prevStudyDay('2026-09-15'));
assert(daysBetween('2026-09-09','2027-01-22')===135,'到學測 135 天');
// 方案
assert(earlyLen()===4&&GRADn()===7,'mix 前段 4、畢業 box 7');
S.plan='ch16';assert(earlyLen()===5&&GRADn()===15&&spanOf('ch16')===70,'ch16 前段 5、16 遍、跨度 70');
assert(spanOf('ch10')===86&&spanOf('ch8')===78,'固定遍數法 10 遍 86 天、6-8 遍 78 天');
assert(bestPlan(135)==='mix','剩 135 天建議 mix = '+bestPlan(135));
assert(bestPlan(60)==='s8','剩 60 天建議 s8 = '+bestPlan(60));
assert(bestPlan(100)==='ch10','剩 100 天建議 ch10 = '+bestPlan(100));
assert(bestPlan(20)==='s4','剩 20 天建議 s4 = '+bestPlan(20));
// applyRule：自適應
S.plan='mix';let r={box:3,ease:2.5,reps:5,streak:2,lapses:0};
applyRule(r,'o',false);assert(r.box===4&&r.ease>2.5&&nextGap(r)===Math.round(7*r.ease/2.5),'mix ○ 升一階、gap 依 ease');
r={box:3,ease:2.5,reps:5};applyRule(r,'t',false);assert(r.box===1&&r.lapses===1,'mix △ 退兩階、退步+1');
r={box:3,ease:2.5,reps:5};applyRule(r,'x',false);assert(r.box===0,'mix × 歸零');
// applyRule：固定遍數法固定
S.plan='ch8';r={box:3,ease:2.5,reps:5};applyRule(r,'t',false);assert(r.box===3&&r.ease===2.5,'ch8 △ 同格、係數不動');
r={box:3,ease:2.5,reps:5};applyRule(r,'x',false);assert(r.box===2,'ch8 × 退一格');
r={box:0,ease:2.5,reps:1};applyRule(r,'x',true);assert((r.lapses||0)===0,'同場複看不算退步');
r={box:7,ease:2.9,reps:9};applyRule(r,'o',false);assert(r.box===7&&nextGap(r)===30,'ch8 畢業停在最後一格 30 天');
assert(previewGap({box:0,ease:2.5,reps:0},'o')===1,'新字答對預覽 1 天');
S.plan='mix';assert(previewGap({box:5,ease:2.5,reps:6},'o')===31,'box5 答對→box6 隔 30 天 = '+previewGap({box:5,ease:2.5,reps:6},'o'));
