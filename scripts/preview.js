'use strict'

// node scripts/preview.js <React 18 UMD directory> <output.html>
// Query options: lang=en-US, view=day|details, portal=1, check=1, stress=1, long=1, hostinputs=1.
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..')
const runtime = path.resolve(process.argv[2] || '.')
const output = path.resolve(process.argv[3] || 'preview.html')
const names = ['time', 'ledger', 'backup', 'adapter', 'model', 'export', 'ranking', 'panel', 'details', 'preferences', 'i18n', 'layout', 'icon', 'styles']
let bundle = names.map(name => `modules['./${name}']=function(module,exports,require){\n${fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8')}\n};`).join('\n')
for (const language of ['en-US', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR']) bundle += `\nmodules['../i18n/${language}.json']=function(module){module.exports=${fs.readFileSync(path.join(root, 'i18n', language + '.json'), 'utf8')};};`
const react = fs.readFileSync(path.join(runtime, 'react.production.min.js'), 'utf8')
const dom = fs.readFileSync(path.join(runtime, 'react-dom.production.min.js'), 'utf8')
const hostStyle = 'html,body{margin:0;height:100%;overflow:hidden;background:#edf2f5;color:#233b47;font:13px sans-serif}#plugin-mountpoint{display:flex;flex-direction:column;height:100vh}.titlebar{flex:none;height:32px;display:flex;align-items:center;padding:0 12px;background:#e1e9ee}.poi-app-tabpane{flex:1;min-height:0;width:100%;overflow:hidden;display:flex;flex-direction:column}#app{height:100%;min-height:0;display:flex;flex-direction:column;background:#fff}@media(prefers-color-scheme:dark){html,body{background:#151c23;color:#d8e3e9}#app{background:#202b35}.titlebar{background:#151c23}}'
const hostHTML = '<style>' + hostStyle + '</style><div id="plugin-mountpoint"><header class="titlebar">Senka Ledger · Sample data</header><div class="poi-app-tabpane"><div id="app"></div></div></div>'
const script = `
const modules={},cache={};
const Buffer={byteLength:value=>new TextEncoder().encode(value).length};const setImmediate=fn=>setTimeout(fn,0);
${bundle}
function require(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;modules[id](m,m.exports,require);return m.exports;}
const params=new URLSearchParams(location.search);
const hostInputStyle=params.has('hostinputs')?'input{display:inline-block!important}':'';
const {createLedger,apply:applyLedger}=require('./ledger');const {translator,normalize}=require('./i18n');
const records=[];const apply=(state,input)=>{records.push(input);applyLedger(state,input)};
const state=createLedger();const at=s=>Date.parse(s+'+09:00');let total=10000000;
apply(state,{v:1,type:'experience',at:at('2026-10-30T20:00:00'),exp:total,gain:null,label:'母港'});
total+=1000;apply(state,{v:1,type:'experience',at:at('2026-10-31T22:20:00'),exp:total,gain:1000,label:'7-1 节点 4 · S 胜败'});
for(let d=1;d<=5;d++){
 for(let hour=7;hour<24;hour++)for(let i=0,n=(d*7+hour*3)%9;i<n;i++){
  const gain=900+((d+hour+i)%5)*120;total+=gain;
  apply(state,{v:1,type:'experience',at:at('2026-11-0'+d+'T'+String(hour).padStart(2,'0')+':'+String(i*7).padStart(2,'0')+':15'),exp:total,gain,label:'7-1 节点 4 · S 胜败'});
 }
 if(d===3){total+=14000;apply(state,{v:1,type:'experience',at:at('2026-11-04T06:30:00'),exp:total,gain:null,label:'母港'});}
}
apply(state,{v:1,type:'bonus',kind:'eo',at:at('2026-11-04T20:12:32'),amount:200,mapId:55,questId:null,key:'eo:2026-11:55',label:'5-5 · EO 奖励'});
apply(state,{v:1,type:'bonus',kind:'quest',at:at('2026-11-05T16:22:30'),amount:350,mapId:null,questId:854,key:'quest:2026:2:854',label:'Z作战前段 · 任务 854'});
apply(state,{v:1,type:'maps',at:at('2026-11-05T18:00:00'),cleared:[15,55]});
apply(state,{v:1,type:'ranking',at:at('2026-11-05T03:30:00'),period:at('2026-11-05T03:00:00'),entries:[[1,8800],[5,8300],[20,7000],[100,4500],[300,3000],[500,2700]].map(([rank,score])=>({rank,score,self:rank===300}))});
apply(state,{v:1,type:'ranking',at:at('2026-11-05T16:30:00'),period:at('2026-11-05T15:00:00'),entries:[[1,9000],[5,8500],[20,7200],[100,4800],[250,3200],[500,2800]].map(([rank,score])=>({rank,score,self:rank===250}))});
state.events.push({id:++state.sequence,source:'local',kind:'normal',at:at('2026-11-05T16:10:00'),amount:0.14,exp:200,activity:'practice',mapId:null,node:null,rank:'S',label:'演习 · S'});
state.events.push({id:++state.sequence,source:'local',kind:'normal',at:at('2026-11-05T16:59:59'),amount:0.035,exp:50,activity:'expedition',mapId:null,node:null,rank:null,label:'远征'});
if(params.has('long'))for(let i=0;i<1050;i++)state.events.push({id:++state.sequence,source:'local',kind:'normal',at:at('2026-11-05T16:00:00')+i*1000,amount:0.07,exp:100,mapId:71,node:4,rank:'S'});
if(params.has('unknownlong'))for(let i=0;i<8;i++)state.events.push({id:++state.sequence,source:'unknown',kind:'normal',at:at('2026-11-04T08:00:00')+i*60000,from:at('2026-11-04T07:00:00')+i*60000,to:at('2026-11-04T08:00:00')+i*60000,amount:0.035,label:'未定位'});
if(params.has('stress'))for(const e of state.events)if(e.source==='local'&&e.kind==='normal')e.amount*=100000;
let language=normalize(params.get('lang')||'zh-CN'),zone=localStorage.getItem('senka-preview-zone')||'Asia/Tokyo';const subscribers=new Set();
const states=new Map([['12345678',state]]),journals=new Map([['12345678',records]]);
const service={snapshot:()=>({account:'12345678',accounts:[...states.keys()],accountNames:{'12345678':'Sample Admiral'},zone,language}),subscribe:cb=>{subscribers.add(cb);cb(service.snapshot());return()=>subscribers.delete(cb)},entry:account=>({state:states.get(account)}),setZone(value){zone=value;localStorage.setItem('senka-preview-zone',value);for(const cb of subscribers)cb(service.snapshot())},export:(account,month,zone,type)=>{doc.body.dataset.exported=type;api.lastExport={account,month,zone,type}},async import(file){const {parseBackup,mergeRecords}=require('./backup');const backup=await parseBackup(await file.text());const merged=await mergeRecords(journals.get(backup.account)||[],backup.records);const next=createLedger();for(const input of merged.records)applyLedger(next,input);states.set(backup.account,next);journals.set(backup.account,merged.records);for(const cb of subscribers)cb(service.snapshot());return{account:backup.account,added:merged.added,skipped:merged.skipped,latestAt:merged.records[merged.records.length-1].at}}};
const Panel=require('./panel').createPanel(React,service);
let doc=document;let popup=null;
const reactRoot=ReactDOM.createRoot(document.getElementById('app'));
if(params.has('portal')){
 popup=open('about:blank','senka-ledger-portal','width=600,height=500');if(!popup)throw Error('Popup blocked');
 popup.document.open();popup.document.write(${JSON.stringify(hostHTML)});popup.document.close();popup.isWindowMode=true;doc=popup.document;
}
if(hostInputStyle){const sheet=doc.createElement('style');sheet.textContent=hostInputStyle;doc.head.appendChild(sheet)}
const renderPanel=()=>reactRoot.render(popup?ReactDOM.createPortal(React.createElement(Panel),doc.getElementById('app')):React.createElement(Panel));renderPanel();
const api={state,setLanguage(value){language=normalize(value);for(const cb of subscribers)cb(service.snapshot())},async remount(){reactRoot.render(null);await pause();renderPanel();await pause()}};
window.senkaPreview=api;doc.defaultView.senkaPreview=api;
const pause=()=>new Promise(resolve=>setTimeout(resolve,50));const assert=(ok,message)=>{if(!ok)throw Error(message)};
const select=async(key,value)=>{const el=doc.querySelector('[data-control="'+key+'"]');el.value=value;el.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));await pause()};
const text=()=>doc.querySelector('.sl').textContent;
const tileNumber=n=>n.toLocaleString(language,{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:2});
async function preview(){
 await pause();await select('month','2026-11');
 if(params.has('check')){
  const assertHiddenInput=()=>{const input=doc.querySelector('[data-control="import-file"]');assert(doc.defaultView.getComputedStyle(input).display==='none'&&input.getClientRects().length===0&&input.tabIndex===-1,'Native file input must remain hidden under host form styles')};
  assertHiddenInput();doc.querySelector('[data-action="data-menu"]').click();await pause();assertHiddenInput();
  assert(doc.querySelector('[data-action="import-json"]').textContent===translator(language)('importJSON'),'Import menu must use the plugin language');doc.querySelector('.data-menu').open=false;
  assert(doc.querySelector('.sl').dataset.view==='month'&&!doc.querySelector('.hours'),'Initial monthly view failed');
  assert(doc.querySelectorAll('[data-day]').length===30,'Monthly date count failed');
  const report=require('./model').summarize(state,'2026-11');
  for(const d of report.days)assert(doc.querySelector('[data-day="'+d.day+'"] .tile-value').textContent===tileNumber(d.normal),'Daily value mismatch');
  assert(!doc.querySelector('[data-table="unknown"]'),'Unknown list must not fill the main view');
  assert(doc.querySelector('[data-control="account"] option:checked').textContent.startsWith('Sample Admiral'),'Account must display the Admiral name');
  assert(doc.querySelector('[data-summary="unknownTotal"] .value').textContent===report.unknownTotal.toLocaleString(language,{minimumFractionDigits:2,maximumFractionDigits:2}),'Unrecorded total must be visible before opening details');
  doc.querySelector('[data-action="unknown"]').click();await pause();
  assert(doc.querySelector('dialog').open&&doc.querySelectorAll('[data-table="unknown"] tbody tr').length>=1,'Unknown dialog failed');
  if(!doc.querySelector('[data-action="next-page"]').disabled){
   const first=doc.querySelector('[data-table="unknown"] tbody tr').textContent;
   doc.querySelector('[data-action="next-page"]').click();await pause();
   assert(doc.querySelector('[data-table="unknown"] tbody tr').textContent!==first,'Unknown button paging failed');
   doc.querySelector('[data-action="previous-page"]').click();await pause();
   const body=doc.querySelector('.dialog-body');body.dispatchEvent(new doc.defaultView.WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));await pause();
   assert(doc.querySelector('[data-table="unknown"] tbody tr').textContent!==first,'Unknown wheel paging failed');
  }
  doc.querySelector('[data-action="close-details"]').click();await pause();
  assert(!doc.querySelector('dialog').open,'Unknown dialog did not close');
  assert(!doc.querySelector('.legend')&&!doc.querySelector('.swatch'),'Legend must be absent');
  assert(doc.querySelector('[data-table="ranking"]').textContent.includes('#250'),'Ranking score missing');
  assert(doc.querySelector('[data-ranking-change="self"]').textContent.includes('+200.00'),'Previous-refresh change missing');
  assert(doc.querySelector('[data-ranking-change="1"]').textContent==='+200.00','Anchor refresh change missing');
  assert(doc.querySelector('.activity-pane .ranking')&&!doc.querySelector('.summary-pane .ranking'),'Ranking must be above the activity tiles');
  assert(!doc.querySelector('[data-table="ranking"]').textContent.includes('#501'),'501 anchor must be removed');
  doc.querySelector('[data-day="2026-11-04"]').click();await pause();
  assert(doc.querySelectorAll('[data-hour]').length===24&&!doc.querySelector('.calendar'),'Secondary day view failed');
  for(let hour=0;hour<24;hour++)assert(doc.querySelector('[data-hour="'+hour+'"] .tile-value').textContent===tileNumber(report.days[3].slots[hour]),'Hour value mismatch');
  doc.querySelector('[data-hour="20"]').click();await pause();
  assert(doc.querySelector('dialog').open&&doc.querySelector('dialog').ownerDocument===doc,'Hour details must open in this window');
  assert(!doc.querySelector('[data-table="details"]').textContent.includes('EO'),'EO leaked into details');
  doc.querySelector('[data-action="close-details"]').click();await pause();
  doc.querySelector('[data-action="details"]').click();await pause();
  assert(doc.querySelector('dialog').open,'Day detail dialog failed');
  assert(doc.querySelectorAll('[data-table="details"] tbody tr').length<=10&&!doc.querySelector('[data-action="next-page"]').disabled,'Day details must be paginated to fit the window');
  const firstRow=doc.querySelector('[data-table="details"] tbody tr').textContent;
  doc.querySelector('.dialog-body').scrollTop=doc.querySelector('.dialog-body').scrollHeight;
  doc.querySelector('[data-action="next-page"]').click();await pause();
  assert(doc.querySelector('[data-table="details"] tbody tr').textContent!==firstRow,'Pagination did not advance');
  assert(doc.querySelector('.dialog-body').scrollTop===0,'New pages must start at the top');
  doc.querySelector('[data-action="previous-page"]').click();await pause();
  assert(doc.querySelector('[data-table="details"] tbody tr').textContent===firstRow,'Pagination did not return');
  const body=doc.querySelector('.dialog-body');
  assert(body.scrollHeight<=body.clientHeight+2,'Detail rows must fit without a long vertical scroll');
  body.dispatchEvent(new doc.defaultView.WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));await pause();
  assert(doc.querySelector('[data-table="details"] tbody tr').textContent!==firstRow,'Wheel did not advance a page');
  await new Promise(resolve=>setTimeout(resolve,320));body.dispatchEvent(new doc.defaultView.WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));await pause();
  assert(doc.querySelector('[data-table="details"] tbody tr').textContent===firstRow,'Wheel did not return to the preceding page');
  const dialogBox=doc.querySelector('dialog').getBoundingClientRect();
  assert(dialogBox.top>=0&&dialogBox.bottom<=doc.defaultView.innerHeight,'Dialog exceeds window bounds');
  doc.querySelector('[data-action="close-details"]').click();await pause();
  await select('zone','Asia/Shanghai');const shifted=require('./model').summarize(state,'2026-11','Asia/Shanghai');
  assert(doc.querySelector('[data-hour="19"] .tile-value').textContent===tileNumber(shifted.days[3].slots[19]),'Timezone failed');
  await api.remount();await select('month','2026-11');
  assert(doc.querySelector('[data-control="zone"]').value==='Asia/Shanghai','Time zone must survive reopening the panel');
  doc.querySelector('[data-day="2026-11-04"]').click();await pause();
  await select('zone','Asia/Tokyo');doc.querySelector('[data-action="back"]').click();await pause();
  await select('month','2026-10');doc.querySelector('[data-day="2026-10-31"]').click();await pause();
  assert(doc.querySelector('[data-hour="22"] .tile-value').textContent===tileNumber(params.has('stress')?70000:0.7),'Archive failed');
  await select('month','2026-11');
  doc.querySelector('[data-day="2026-11-05"]').click();await pause();
  doc.querySelector('[data-hour="16"]').click();await pause();
  const originalLanguage=language;
  for(const lang of ['en-US','zh-CN','zh-TW','ja-JP','ko-KR']){api.setLanguage(lang);await pause();assert(doc.querySelector('h2').textContent===translator(lang)('Senka Ledger'),'Language switch failed');assert(doc.querySelector('[data-table="details"]').textContent.includes(translator(lang)('expedition')),'Expedition details must be localized')}
  api.setLanguage(originalLanguage);await pause();
  doc.querySelector('[data-action="close-details"]').click();await pause();
  doc.querySelector('[data-action="back"]').click();await pause();
  doc.body.dataset.interactions='yes';
 }
 if(['day','details'].includes(params.get('view'))){doc.querySelector('[data-day="2026-11-05"]').click();await pause()}
 const shell=doc.querySelector('.sl-shell');shell.scrollTop=shell.scrollHeight;await pause();
 assert(shell.scrollHeight<=shell.clientHeight||shell.scrollTop>0,'Panel cannot scroll');
 const foot=doc.querySelector('.foot').getBoundingClientRect(),box=shell.getBoundingClientRect();
 assert(foot.bottom<=box.bottom+1&&foot.top>=box.top,'Panel bottom is unreachable');
 for(const el of doc.querySelectorAll('.tile-value,.tile-label'))assert(el.scrollWidth<=el.clientWidth+1,'Tile text overflow');
 assert(doc.documentElement.scrollWidth<=doc.defaultView.innerWidth,'Page horizontal overflow');
 const left=doc.querySelector('.activity-pane').getBoundingClientRect(),right=doc.querySelector('.summary-pane').getBoundingClientRect();
 assert(right.left>=left.right-1,'Small panels must also keep summaries on the right');
 const rankingBox=doc.querySelector('.ranking').getBoundingClientRect(),tiles=doc.querySelector('.calendar,.hours').getBoundingClientRect();
 assert(rankingBox.bottom<=tiles.top,'Ranking must be above the tiles');
 for(const el of doc.querySelectorAll('.tile-value'))assert(parseFloat(doc.defaultView.getComputedStyle(el).fontSize)<=12,'Senka values must use the smaller shared font size');
 for(const tile of doc.querySelectorAll('.tile'))assert(tile.getBoundingClientRect().height<=70,'Tiles should be compact');
 shell.scrollTop=0;
 if(params.get('view')==='details'){doc.querySelector('[data-action="details"]').click();await pause();assert(doc.querySelector('dialog').open,'Final detail dialog failed')}
 if(params.get('view')==='unknown'){doc.querySelector('[data-action="unknown"]').click();await pause();assert(doc.querySelector('dialog').open,'Final unknown dialog failed')}
 doc.body.dataset.ready='yes';
}
preview().catch(error=>{doc.body.dataset.testError=String(error)});
`
fs.writeFileSync(output, '<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Senka Ledger preview</title>' + hostHTML + '<script>' + react + '</script><script>' + dom + '</script><script>' + script.replaceAll('</script', '<\\/script') + '</script></html>')
console.log(output)
