'use strict'

// Usage: node scripts/preview.js <directory with React 18 UMD files> <output.html>
// This renders the real panel against synthetic data. It never opens a journal.
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..')
const runtime = path.resolve(process.argv[2] || '.')
const output = path.resolve(process.argv[3] || 'preview.html')
const names = ['time', 'ledger', 'adapter', 'model', 'export', 'panel']
const bundle = names.map(name => {
  const source = fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8')
  return `modules['./${name}']=function(module,exports,require){\n${source}\n};`
}).join('\n')
const react = fs.readFileSync(path.join(runtime, 'react.production.min.js'), 'utf8')
const dom = fs.readFileSync(path.join(runtime, 'react-dom.production.min.js'), 'utf8')
const script = `
const modules={},cache={};
${bundle}
function require(id){if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;modules[id](m,m.exports,require);return m.exports;}
const {createLedger,apply}=require('./ledger');
const state=createLedger();
const at=s=>Date.parse(s+'+09:00');
let total=10000000;
apply(state,{v:1,type:'experience',at:at('2026-10-30T20:00:00'),exp:total,gain:null,label:'母港'});
for(let d=31;d<=31;d++){total+=1000;apply(state,{v:1,type:'experience',at:at('2026-10-'+d+'T22:20:00'),exp:total,gain:1000,label:'7-1 节点 4 · S 胜败'});}
for(let d=1;d<=5;d++){
 for(let hour=7;hour<24;hour++){
  const n=(d*7+hour*3)%9;
  for(let i=0;i<n;i++){
   const gain=900+((d+hour+i)%5)*120;total+=gain;
   apply(state,{v:1,type:'experience',at:at('2026-11-0'+d+'T'+String(hour).padStart(2,'0')+':'+String(i*7).padStart(2,'0')+':15'),exp:total,gain,label:'7-1 节点 4 · S 胜败'});
  }
 }
 if(d===3){total+=14000;apply(state,{v:1,type:'experience',at:at('2026-11-04T06:30:00'),exp:total,gain:null,label:'母港'});}
}
apply(state,{v:1,type:'bonus',kind:'eo',at:at('2026-11-04T20:12:32'),amount:200,mapId:55,questId:null,key:'eo:2026-11:55',label:'5-5 · EO 奖励'});
apply(state,{v:1,type:'bonus',kind:'quest',at:at('2026-11-05T16:22:30'),amount:350,mapId:null,questId:854,key:'quest:2026:2:854',label:'Z作战前段 · 任务 854'});
apply(state,{v:1,type:'maps',at:at('2026-11-05T18:00:00'),cleared:[15,55]});
const service={snapshot:()=>({account:'12345678',accounts:['12345678'],directory:'模拟预览 · 数据不会写入真实账号'}),subscribe:cb=>{cb(service.snapshot());return()=>{}},entry:()=>({state}),export:()=>{document.body.dataset.exported='yes'}};
const Panel=require('./panel').createPanel(React,service);
ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(Panel));
const pause=()=>new Promise(resolve=>setTimeout(resolve,50));
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const selectValue=async(label,value)=>{const el=document.querySelector('select[aria-label="'+label+'"]');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));await pause()};
const text=()=>document.querySelector('.sl').textContent;
const normalNumber=n=>n.toLocaleString('zh-CN',{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:2});
const summary=label=>document.querySelector('[data-summary="'+label+'"] .value').textContent;
async function preview(){
 await pause();await selectValue('月份','2026-11');
 const params=new URLSearchParams(location.search);
 if(params.has('check')){
  assert(document.querySelector('.sl').dataset.view==='month','Initial view must be monthly');
  assert(document.querySelectorAll('[data-day]').length===30,'Monthly calendar needs 30 dates');
  assert(!document.querySelector('.hours'),'Hourly view must be hidden initially');
  assert(!document.querySelector('[aria-label="普通战果明细"]'),'Details must wait for date selection');
  const report=require('./model').summarize(state,'2026-11');
  for(const d of report.days)assert(document.querySelector('[data-day="'+d.day+'"] .tile-value').textContent===normalNumber(d.normal),'Daily numeric value mismatch');
  assert(document.querySelectorAll('[aria-label="未在本地记录的增量"] tbody tr').length===1,'Unknown EO leaked into table');
  assert(text().includes('9.80')&&!text().includes('完成时间未记录'),'Experience-only unknown records required');
  assert(!text().includes('热力图')&&!text().includes('说明')&&!document.querySelector('details'),'Removed wording still visible');
  document.body.dataset.monthChecked='yes';
  document.querySelector('[data-day="2026-11-04"]').click();await pause();
  assert(document.querySelector('.sl').dataset.view==='day','Date must open secondary view');
  assert(document.querySelectorAll('[data-hour]').length===24&&!document.querySelector('.calendar'),'Day view must replace calendar');
  for(let hour=0;hour<24;hour++)assert(document.querySelector('[data-hour="'+hour+'"] .tile-value').textContent===normalNumber(report.days[3].slots[hour]),'Hour numeric value mismatch');
  assert(summary('EO 战果')==='200.00','EO must remain in top summary');
  assert(!text().includes('5-5 · EO 奖励'),'EO reward leaked into detail');
  document.querySelector('[data-hour="20"]').click();await pause();
  assert(text().includes('20:00–21:00 · 明细'),'Hour selection failed');
  assert(!document.querySelector('[aria-label="普通战果明细"]').textContent.includes('EO'),'Bonus leaked into hourly details');
  document.body.dataset.dayChecked='yes';
  await selectValue('时区','Asia/Shanghai');
  const shifted=require('./model').summarize(state,'2026-11','Asia/Shanghai');
  assert(document.querySelector('[data-hour="19"] .tile-value').textContent===normalNumber(shifted.days[3].slots[19]),'Timezone regrouping failed');
  document.body.dataset.zoneChecked='yes';
  await selectValue('时区','Asia/Tokyo');
  document.querySelector('[aria-label="返回月览"]').click();await pause();
  assert(document.querySelector('.sl').dataset.view==='month'&&!document.querySelector('[data-hour]'),'Back navigation failed');
  await selectValue('月份','2026-10');
  assert(document.querySelectorAll('[data-day]').length===31,'Archive month failed');
  document.querySelector('[data-day="2026-10-31"]').click();await pause();
  assert(document.querySelector('[data-hour="22"] .tile-value').textContent==='0.70','Archive details failed');
  await selectValue('月份','2026-11');
  document.querySelector('[data-day="2026-11-05"]').click();await pause();
  assert(summary('任务战果')==='350.00'&&!text().includes('Z作战前段'),'Task should only appear in summary');
  document.querySelector('[data-hour="16"]').click();await pause();
  assert(document.querySelector('[aria-label="普通战果明细"] tbody').children.length===2,'Hourly detail should have only two experience records');
  document.body.dataset.archiveChecked='yes';
  document.querySelector('[aria-label="返回月览"]').click();await pause();
 }
 if(params.get('view')==='day'){document.querySelector('[data-day="2026-11-05"]').click();await pause();document.querySelector('[data-hour="16"]').click();await pause()}
 assert(document.documentElement.scrollWidth<=innerWidth,'Page overflows horizontally');
 for(const el of document.querySelectorAll('.tile-value'))assert(el.scrollWidth<=el.clientWidth+1,'Tile value overflows');
 document.body.dataset.ready='yes';
}
preview().catch(error=>{document.body.dataset.testError=String(error)});
`
fs.writeFileSync(output, '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>战果手账 · 模拟预览</title><style>body{margin:0;background:#edf2f5;color:#233b47}#app{max-width:1120px;margin:20px auto;background:#fff;border-radius:12px;box-shadow:0 6px 32px #1232}body:before{content:"模拟数据预览";display:block;text-align:center;padding-top:12px;color:#647b85;font:12px sans-serif}@media(prefers-color-scheme:dark){body{background:#151c23;color:#d8e3e9}#app{background:#202b35}}</style><div id="app"></div><script>' + react + '</script><script>' + dom + '</script><script>' + script.replaceAll('</script', '<\\/script') + '</script></html>')
console.log(output)
