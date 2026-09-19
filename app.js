import {DEFAULTS,LIMITS,PRESETS,normalize,calculate,findThreshold} from './model.js';
const $=s=>document.querySelector(s);
const STORAGE='clinic-commons-v1', PIN='clinic-commons-pin-v1';
let state={...DEFAULTS}, pinned=null, storageAvailable=true;
try {state=normalize(JSON.parse(localStorage.getItem(STORAGE)||'null')||DEFAULTS);const data=JSON.parse(localStorage.getItem(PIN)||'null');if(data) pinned=normalize(data);} catch {storageAvailable=false;}
const controls=[
  ['procurement','集中採購程度','納入共購的耗材與採購支出','service-controls'],
  ['it','集中 IT 支援程度','共用維運、資安與系統支援','service-controls'],
  ['admin','共用行政比例','委由中心承接的行政工作範圍','service-controls'],
  ['standard','流程標準化程度','共同規則越多，整合越容易','process-controls'],
  ['diversity','診所流程差異程度','科別、HIS 與作業習慣的異質性','process-controls'],
  ['cash','行政節省實現比例','釋出工作中，確實減少支出的比例','process-controls']
];
for(const [id,label,hint,parent] of controls){
  const el=document.createElement('div');el.className='control';
  el.innerHTML=`<div class="control-label"><label for="${id}">${label}</label><output for="${id}" id="${id}-value"></output></div><input type="range" id="${id}" min="0" max="100" step="1"><p class="hint">${hint}</p>`;
  $('#'+parent).append(el);
}
const assumptionFields=[
  ['purchaseBase','每家採購支出','元／月','可納入共購的採購基準'],
  ['itBase','每家 IT 支出','元／月','既有系統、維護與支援'],
  ['adminBase','每家行政支出','元／月','行政人事與外包，不含醫護'],
  ['otherBase','每家其他診療成本','元／月','醫護、租金等，集中前後不變'],
  ['hoursBase','每家行政與 IT 工時','小時／月','不含臨床服務工時'],
  ['fixedBase','中心固定基礎成本','元／月','另加各服務固定配置成本'],
  ['setupBase','中心建置基礎費','元／次','另加各診所導入費'],
  ['months','建置攤提期間','個月','同時影響中心與診所月成本']
];
for(const [id,label,unit,hint] of assumptionFields){
  const [min,max,step]=LIMITS[id], el=document.createElement('div');el.className='assumption-field';
  el.innerHTML=`<label for="${id}">${label}</label><div><input type="number" id="${id}" min="${min}" max="${max}" step="${step}"><span>${unit}</span></div><small>${hint}</small>`;$('#assumption-inputs').append(el);
}
const nf=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:0});
const fmt=n=>nf.format(Math.round(n));
const wan=n=>(n/10000).toFixed(2);
const signed=n=>(n>=0?'+':'−')+fmt(Math.abs(n));
const percent=(a,b)=>b>0?(a/b*100).toFixed(1)+'%':'不適用';
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{storageAvailable=false;}}
function setInputs(){for(const key of Object.keys(LIMITS)){const el=$('#'+key);if(el)el.value=state[key];}$('#n-number').value=state.n;$('#exceptions').checked=state.exceptions;}
function presetStatus(){for(const el of document.querySelectorAll('[data-preset]')){const chosen=Object.keys(DEFAULTS).every(k=>state[k]===PRESETS[el.dataset.preset][k]);el.classList.toggle('selected',chosen);el.setAttribute('aria-pressed',String(chosen));}}
function render(){
  const m=calculate(state);const threshold=findThreshold(state);
  for(const [id] of controls){$('#'+id+'-value').textContent=state[id]+'%';}
  for(const el of document.querySelectorAll('input[type=range]')){const fill=(+el.value-+el.min)/(+el.max-+el.min)*100;el.style.setProperty('--fill',fill+'%');}
  presetStatus();
  $('#saving-label').textContent=m.netSaving>=0?'每家診所每月淨節省':'每家診所每月增加成本';
  $('#net-saving').innerHTML=`${fmt(Math.abs(m.netSaving))}<span class="unit">元</span>`;
  $('.metric-card.primary').classList.toggle('negative',m.netSaving<0);
  const baseSupport=state.purchaseBase+state.itBase+state.adminBase;
  $('#saving-percent').textContent=`總成本${m.netSaving>=0?'降低':'增加'} ${percent(Math.abs(m.netSaving),m.baseline)} · 支援成本${m.netSaving>=0?'降低':'增加'} ${percent(Math.abs(m.netSaving),baseSupport)}`;
  $('#required-fee').innerHTML=`${fmt(m.fee)}<span class="unit">元</span>`;
  $('#center-budget').innerHTML=`${wan(m.budget)}<span class="unit">萬元</span>`;
  $('#hours-saved').innerHTML=`${m.releasedHours.toFixed(1)}<span class="unit">小時</span>`;
  $('#budget-foot').textContent=`${state.n} 家共同分攤 · 含 ${state.months} 個月建置攤提`;
  const maxCost=Math.max(m.baseline,m.combined,1);
  function costBar(label,total,parts){return `<div class="bar-block"><div class="bar-label"><span>${label}</span><strong>${wan(total)} <small>萬元</small></strong></div><div class="stacked-bar" style="width:${total/maxCost*100}%">${parts.map(([num,color])=>`<span style="width:${total?num/total*100:0}%;background:${color}"></span>`).join('')}</div></div>`;}
  $('#cost-chart').innerHTML=costBar('單獨經營',m.baseline,[[state.otherBase,'#d5dcd7'],[baseSupport,'#a9c9b8']])+costBar('加入集中支援',m.combined,[[state.otherBase,'#d5dcd7'],[baseSupport-m.grossSaving,'#a9c9b8'],[m.fee,'#235f50']]);
  $('#cost-chart').setAttribute('aria-label',`每家每月成本：單獨經營 ${fmt(m.baseline)} 元，集中支援 ${fmt(m.combined)} 元，${m.netSaving>=0?'節省':'增加'} ${fmt(Math.abs(m.netSaving))} 元。`);
  $('#cost-insight').innerHTML=`診所端先省下 <strong>${fmt(m.grossSaving)} 元</strong>，再分攤中心費用 <strong>${fmt(m.fee)} 元</strong>。<br>全體每月${m.netSaving>=0?'淨省':'增加'} <strong>${wan(Math.abs(m.netSaving)*state.n)} 萬元</strong>，不重複加計中心成本。`;
  $('#budget-lines').innerHTML=[['固定配置',m.fixed],['變動服務',m.variable],['建置攤提',m.amortization],['每月總預算',m.budget]].map(([label,value],i)=>`<div class="${i===3?'budget-total':''}"><dt>${label}</dt><dd>${wan(value)} 萬</dd></div>`).join('');
  $('#budget-balance').classList.toggle('negative',m.balance<0);
  $('#budget-balance').innerHTML=`<span>中心每月${m.balance>=0?'結餘':'缺口'}<br><small>試算收入 ${wan(m.income)} 萬元</small></span><strong>${wan(Math.abs(m.balance))} 萬</strong>`;
  $('#threshold-label').textContent=threshold===null?'200 家內未轉正':`節省轉正 ≥ ${threshold} 家`;
  $('#current-scale').textContent=state.n+' 家';
  scaleChart(m,threshold);
  const operatingLine=m.netSaving>=0?`在這組假設下，${state.n} 家已能攤平中心成本。`:`在這組假設下，${state.n} 家的共用效益仍不足以抵銷中心成本。`;
  const tradeoff=state.standard>=70?`標準化偏高，請一起檢查診所流程選擇空間${state.exceptions?'與例外申請工作量':'；目前未保留例外申請'}。`:state.diversity>=70?'診所差異偏高，系統調整與協調投入會增加。':'可提高參與規模或調整服務組合，檢查效益是否足以支付中心費用。';
  $('#decision-insight').innerHTML=`<strong>${operatingLine}</strong> ${tradeoff}`;
  const releaseRate=state.hoursBase?m.releasedHours/state.hoursBase*100:0;
  $('#process-meters').innerHTML=meter('診所端行政／IT 工時釋出',releaseRate,`${releaseRate.toFixed(1)}%`,'','單獨經營：0% 釋出','越高，留在診所的負擔越少')+meter('在地流程彈性',m.flexibility,`${m.flexibility.toFixed(0)} / 100`,'purple','單獨經營：100','越高，診所可選擇的做法越多')+meter('跨診所協調投入',m.coordination,`${m.coordination.toFixed(0)} / 100`,'orange','單獨經營：0','越高，需要越多協調投入');
  $('#hours-summary').innerHTML=`<strong>工作轉移，也要計入中心的人力。</strong><br>診所端合計釋出 ${fmt(m.releasedHours*state.n)} 小時；中心需投入約 ${fmt(m.centerHours)} 小時。<br>全體支援工時由 ${fmt(m.networkHoursBefore)} → ${fmt(m.networkHoursAfter)} 小時／月，${m.networkHoursSaved>=0?'淨省':'淨增'} <strong>${fmt(Math.abs(m.networkHoursSaved))} 小時</strong>。`;
  renderComparison(m);persist();
}
function meter(label,value,formatted,kind,left,right){return `<div class="meter-row"><div class="meter-label"><span>${label}</span><span>${formatted}</span></div><div class="meter-track ${kind}" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value.toFixed(1)}"><span style="width:${value}%"></span></div><div class="meter-baseline"><span>${left}</span><span>${right}</span></div></div>`;}
function scaleChart(m,threshold){
  const W=Math.max(270,Math.min(740,$('#scale-chart').clientWidth||740)),H=196,L=49,R=23,T=28,B=34,plotW=W-L-R,plotH=H-T-B;
  const data=Array.from({length:200},(_,i)=>calculate({...state,n:i+1}).netSaving);
  const low=Math.min(-10000,Math.floor(Math.min(data[9],m.netSaving)/10000)*10000);
  const high=Math.max(10000,Math.ceil(Math.max(data[199],m.netSaving)/10000)*10000);
  const px=n=>L+(n-1)/199*plotW,py=v=>T+(high-Math.max(low,Math.min(high,v)))/(high-low)*plotH;
  const curve=data.map((v,i)=>`${i?'L':'M'}${px(i+1).toFixed(2)},${py(v).toFixed(2)}`).join(' ');
  const zero=py(0),currentX=px(state.n),currentY=py(m.netSaving);
  const ticks=[low,0,high];
  const grid=ticks.map(v=>`<line x1="${L}" y1="${py(v)}" x2="${W-R}" y2="${py(v)}" stroke="${v===0?'#c2cdb8':'#edf0e8'}" stroke-dasharray="${v===0?'4 3':'0'}"/><text x="${L-9}" y="${py(v)+4}" text-anchor="end" fill="#99a28c" font-size="10">${(v/10000).toFixed(v%10000===0?0:1)} 萬</text>`).join('');
  const xs=[1,50,100,150,200].map(n=>`<text x="${px(n)}" y="${H-14}" text-anchor="middle" font-size="10" fill="#99a28c">${n}${n===200?' 家':''}</text>`).join('');
  const labelX=Math.max(L+52,Math.min(W-R-64,currentX));
  const currentLabelY=Math.max(15,currentY-13);
  const thresholdSvg=threshold?`<line x1="${px(threshold)}" y1="${zero}" x2="${px(threshold)}" y2="${T+plotH}" stroke="#c6b492" stroke-dasharray="3 4"/><circle cx="${px(threshold)}" cy="${zero}" r="3" fill="#b79e74"/>`:'';
  const clipped=data.some(v=>v<low);
  $('#scale-chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="每家每月淨節省隨診所數變化。目前 ${state.n} 家，${m.netSaving>=0?'節省':'增加成本'} ${fmt(Math.abs(m.netSaving))} 元。${threshold?`節省轉正門檻 ${threshold} 家。`:'200 家內未轉正。'}${clipped?`低於 ${low} 元的曲線截於底部。`:''}"><defs><linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#dbead4" stop-opacity=".8"/><stop offset="1" stop-color="#f6f8ee" stop-opacity=".3"/></linearGradient></defs>${grid}<path d="${curve} L${W-R},${T+plotH} L${L},${T+plotH}Z" fill="url(#area-fill)"/><line x1="${L}" y1="${zero}" x2="${W-R}" y2="${zero}" stroke="#c2cdb8" stroke-dasharray="4 3"/>${thresholdSvg}<path d="${curve}" fill="none" stroke="#56836a" stroke-width="2.5" stroke-linejoin="round"/><line x1="${currentX}" y1="${currentY}" x2="${currentX}" y2="${T+plotH}" stroke="#729079" stroke-dasharray="3 4"/><circle cx="${currentX}" cy="${currentY}" r="5" fill="#15594c" stroke="white" stroke-width="2"/><text x="${labelX}" y="${currentLabelY}" text-anchor="middle" font-size="11" font-weight="600" fill="#456b50">目前 ${signed(m.netSaving)} 元</text>${xs}</svg>${clipped?`<p class="micro">低於 ${wan(low)} 萬元的曲線截於圖底；目前數值與門檻均依完整金額計算。</p>`:''}`;
}
function renderComparison(current){
  const panel=$('#scenario-comparison');panel.hidden=!pinned;
  if(!pinned)return;
  const previous=calculate(pinned);
  const assumptions=s=>`${s.n}家 / 採購${s.procurement}% / IT${s.it}% / 行政${s.admin}% / 標準${s.standard}% / 差異${s.diversity}% / 現金${s.cash}% / 例外${s.exceptions?'開':'關'}`;
  const rows=[['營運假設',assumptions(pinned),assumptions(state)],['每家淨節省',signed(previous.netSaving)+' 元',signed(current.netSaving)+' 元'],['所需月費',fmt(previous.fee)+' 元',fmt(current.fee)+' 元'],['中心月預算',wan(previous.budget)+' 萬元',wan(current.budget)+' 萬元'],['每家釋出工時',previous.releasedHours.toFixed(1)+' 小時',current.releasedHours.toFixed(1)+' 小時'],['全體支援淨省工時',signed(previous.networkHoursSaved)+' 小時',signed(current.networkHoursSaved)+' 小時'],['流程彈性',previous.flexibility.toFixed(0)+' / 100',current.flexibility.toFixed(0)+' / 100'],['協調投入',previous.coordination.toFixed(0)+' / 100',current.coordination.toFixed(0)+' / 100']];
  panel.innerHTML=`<div class="comparison-title"><strong>保留情境 vs. 目前設定</strong><button class="text-button" id="clear-pin" type="button">移除 ×</button></div><table class="comparison-table"><thead><tr><th>比較項目</th><th>保留情境</th><th>目前設定</th></tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('#clear-pin').onclick=()=>{pinned=null;try{localStorage.removeItem(PIN);}catch{}renderComparison(current);toast('已移除保留情境');};
}
for(const key of Object.keys(LIMITS)){
  const el=$('#'+key);if(!el)continue;
  if(el.type==='range')el.addEventListener('input',()=>{state=normalize({...state,[key]:+el.value});if(key==='n')$('#n-number').value=state.n;render();});
  else {
    el.addEventListener('input',()=>{if(el.value!==''&&el.validity.valid){state=normalize({...state,[key]:+el.value});render();}});
    el.addEventListener('change',()=>{const entered=el.value;const previous=state[key];state=normalize({...state,[key]:entered===''?previous:+entered});el.value=state[key];render();if(entered===''||Number(entered)!==state[key])toast('已將輸入調整至模型允許範圍');});
  }
}
$('#n-number').addEventListener('input',event=>{const el=event.target;if(el.value!==''&&el.validity.valid){state=normalize({...state,n:+el.value});$('#n').value=state.n;render();}});
$('#n-number').addEventListener('change',event=>{const entered=event.target.value;state=normalize({...state,n:entered===''?state.n:+entered});setInputs();render();if(entered===''||+entered!==state.n)toast('診所數量請設定為 1–200 家');});
$('#exceptions').addEventListener('change',()=>{state.exceptions=$('#exceptions').checked;render();});
$('#reset').onclick=()=>{state={...DEFAULTS};setInputs();render();toast('已重設為漸進共用；保留情境仍可比較');};
for(const el of document.querySelectorAll('[data-preset]'))el.onclick=()=>{state={...PRESETS[el.dataset.preset]};setInputs();render();toast(`已套用「${el.textContent}」示範情境與基礎假設`);};
$('#pin-scenario').onclick=()=>{pinned={...state};try{localStorage.setItem(PIN,JSON.stringify(pinned));}catch{storageAvailable=false;}renderComparison(calculate(state));toast(storageAvailable?'已保留此情境；調整參數即可比較':'已保留此情境於本頁；瀏覽器不支援持久保存');};
$('#export-csv').onclick=()=>{
  const rows=[['共好｜社區診所集中支援管理中心','示範模型 v1.0；非台灣實證資料'],['金額單位','新台幣元／月；建置費為一次性金額'],['計算基礎','同規模診所、等額分攤、同等診療量；含建置攤提；無補助及利潤'],['參數','目前設定','保留情境']];
  const labels={n:'診所數',procurement:'集中採購%',it:'集中IT%',admin:'共用行政%',standard:'流程標準化%',diversity:'流程差異%',exceptions:'保留例外申請',cash:'行政節省實現%',purchaseBase:'每家採購支出',itBase:'每家IT支出',adminBase:'每家行政支出',otherBase:'其他診療成本',hoursBase:'行政與IT工時（小時）',fixedBase:'中心固定基礎月成本',setupBase:'中心建置基礎費（一次性）',months:'建置攤提月數',targetFee:'試算每家月費'};
  for(const key of Object.keys(DEFAULTS))rows.push([labels[key],state[key],pinned?pinned[key]:'']);
  const m=calculate(state),p=pinned?calculate(pinned):null;
  const outputs={baseline:'單獨經營每家成本',purchaseSaving:'每家採購節省',itSaving:'每家IT節省',adminSaving:'每家行政現金節省',grossSaving:'每家診所端支出節省',fixed:'中心固定月成本',variable:'中心變動月成本',startup:'總建置導入費（一次性）',amortization:'中心建置月攤提',budget:'中心總月預算',fee:'每家所需月費',combined:'集中後每家總成本',netSaving:'每家月淨節省（負數為增加）',income:'試算中心月收入',balance:'中心月結餘（負數為缺口）',releasedHours:'每家釋出工時（小時）',centerHours:'中心投入工時（小時）',networkHoursSaved:'全體淨省支援工時（小時）',flexibility:'流程彈性示意指標',coordination:'協調投入示意指標'};
  rows.push([],['結果','目前設定','保留情境']);
  for(const [k,label] of Object.entries(outputs))rows.push([label,+m[k].toFixed(2),p?+p[k].toFixed(2):'']);
  rows.push(['節省轉正門檻（家）',findThreshold(state)??'200家內未轉正',pinned?(findThreshold(pinned)??'200家內未轉正'):''],[],['規模敏感度：其餘使用目前假設'],['診所數','每家月淨節省','每家所需月費','中心總月預算']);
  for(let n=1;n<=200;n++){const x=calculate({...state,n});rows.push([n,+x.netSaving.toFixed(2),+x.fee.toFixed(2),+x.budget.toFixed(2)]);}
  const csv='\uFEFF'+rows.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='clinic-commons-scenario.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('已匯出假設、比較結果與 1–200 家完整數值');
};
setInputs();render();
let resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>scaleChart(calculate(state),findThreshold(state)),120);});
