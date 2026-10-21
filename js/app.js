"use strict";
/* views: pages, routing, modals, editors */
/* =================== router =================== */
const TITLES={records:"記錄",stats:"統計",accounts:"帳戶",projects:"專案",budgets:"預算",settings:"設定"};
function go(p){
  ui.page=p;
  document.querySelectorAll(".page").forEach(e=>e.classList.remove("active"));
  document.getElementById("page-"+p).classList.add("active");
  document.querySelectorAll(".nav button[data-p]").forEach(b=>b.classList.toggle("on",b.dataset.p===p));
  document.getElementById("gearBtn").style.color=(p==="settings")?"var(--accent)":"";
  document.getElementById("pageTitle").textContent=TITLES[p];
  document.getElementById("monthNav").style.visibility=(p==="stats"||p==="budgets")?"visible":"hidden";
  document.getElementById("navAddBtn").classList.toggle("on",p==="records");
  document.querySelector(".pages").scrollTop=0;
  render();
}
/* center + : jump to records when elsewhere, else open the add sheet */
function navAdd(){ if(ui.page!=="records") go("records"); else openAdd(); }
function shiftMonth(d){
  let[y,m]=ui.month.split("-").map(Number);m+=d;
  if(m<1){m=12;y--;}if(m>12){m=1;y++;}
  ui.month=y+"-"+String(m).padStart(2,"0");render();
}
function render(){
  document.getElementById("mlabel").textContent=monthLabel(ui.month);
  if(ui.page==="records")renderRecords();
  else if(ui.page==="stats")renderStats();
  else if(ui.page==="accounts")renderAccounts();
  else if(ui.page==="projects")renderProjects();
  else if(ui.page==="budgets")renderBudgets();
  else if(ui.page==="settings")renderSettings();
}

/* =================== records page (day view) =================== */
function dstr(dt){return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");}
function selectDay(ds){ui.selDate=ds;ui.month=ds.slice(0,7);render();}
function shiftWeek(dir){const[y,m,d]=ui.selDate.split("-").map(Number);selectDay(dstr(new Date(y,m-1,d+dir*7)));}
function weekStripHTML(sel){
  const[y,m,d]=sel.split("-").map(Number);const dt=new Date(y,m-1,d);
  const off=(dt.getDay()===0?6:dt.getDay()-1);
  const mon=new Date(y,m-1,d-off);const today=todayStr();const lab=["一","二","三","四","五","六","日"];
  let cells="";
  for(let i=0;i<7;i++){
    const cd=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+i);const ds=dstr(cd);
    cells+=`<div class="wk-day ${ds===sel?"sel":""} ${ds===today?"today":""}" onclick="selectDay('${ds}')">
      <div class="wk-dow">週${lab[i]}</div><div class="wk-num">${cd.getDate()}</div></div>`;
  }
  return `<div class="weeknav"><button onclick="shiftWeek(-1)">‹</button><div class="weekstrip" id="weekstrip">${cells}</div><button onclick="shiftWeek(1)">›</button></div>`;
}
function bindWeekSwipe(){
  const el=document.getElementById("weekstrip");if(!el)return;let x0=null;
  el.addEventListener("touchstart",e=>{x0=e.touches[0].clientX;},{passive:true});
  el.addEventListener("touchend",e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>40)shiftWeek(dx<0?1:-1);},{passive:true});
}
function renderRecords(){
  const sel=ui.selDate,mo=sel.slice(0,7);
  document.getElementById("pageTitle").textContent=sel.replace(/-/g,"/");
  // month summary
  let minc=0,mexp=0;recsInMonth(mo).forEach(r=>{if(r.type==="income")minc+=baseAmt(r);else if(r.type==="expense")mexp+=baseAmt(r);});
  let html=weekStripHTML(sel);
  html+=`<div class="card msum" onclick="go('stats')">
    <div class="ic" style="background:${hex2(DB.config.accent)};color:var(--accent)">${IC("chart-pie")}</div>
    <div class="mid"><div class="rtitle">每月統計</div><div class="rsub">${monthLabel(mo)}</div></div>
    <div class="msum-fig"><div><span class="val inc">${fmt(minc)}</span> <span style="color:var(--text3)">/</span> <span class="val exp">${fmt(mexp)}</span></div><div class="msum-net">結餘 ${fmt(minc-mexp)}</div></div></div>`;
  // selected day's records
  const day=DB.records.filter(r=>r.date===sel).sort((a,b)=>(b._t||0)-(a._t||0));
  let dinc=0,dexp=0;day.forEach(r=>{if(r.type==="income")dinc+=baseAmt(r);else if(r.type==="expense")dexp+=baseAmt(r);});
  const dsum=[dexp?`<span class="val exp">支 ${fmt(dexp)}</span>`:"",dinc?`<span class="val inc">收 ${fmt(dinc)}</span>`:""].filter(Boolean).join("　")||'<span style="color:var(--text3)">無記錄</span>';
  html+=`<div class="dayhead2"><span class="ddate">${fmtDay(sel)}</span><span>${dsum}</span></div>`;
  if(!day.length){
    html+=`<div class="empty"><div class="big">${IC("receipt-text")}</div>這天還沒有記錄<br>點下方 ＋ 新增一筆</div>`;
  }else{
    html+=`<div class="reclist">`+day.map(recRow).join("")+`</div>`;
  }
  document.getElementById("page-records").innerHTML=html;
  bindWeekSwipe();
}
function fmtDay(d){
  const[y,m,dd]=d.split("-").map(Number);const dt=new Date(y,m-1,dd);
  const wk=["日","一","二","三","四","五","六"][dt.getDay()];
  const t=todayStr();
  let pre=(d===t)?"今天 ":"";
  return pre+`${m}/${dd} 週${wk}`;
}
function recRow(r){
  const rc=r.cur||DB.config.baseCur,fgn=isForeign(rc);
  const proj=r.projectId?projOf(r.projectId):null;
  let icon,col,name,note,amt,amtcol,pills="";
  if(r.type==="transfer"){
    const fa=acc(r.accountId),ta=acc(r.toAccountId);
    col=DB.config.accent;icon="🔄";name="轉帳";note=r.note||"";amt=fmtCur(r.amount,rc);amtcol="var(--accent)";
    pills=`<span class="pill">${esc(fa?fa.name:"?")}</span><span class="pill">→ ${esc(ta?ta.name:"?")}</span>`;
  }else{
    const c=catOf(r.categoryId),a=acc(r.accountId);
    col=catColor(c);icon=IC(catIcon(c));
    name=c?(c.parent?(mainOf(c).name+"·"+c.name):c.name):"未分類";
    note=r.note||"";
    amt=(r.type==="income"?"+":"−")+fmtCur(r.amount,rc);
    amtcol=r.type==="income"?"var(--income)":"var(--expense)";
    if(proj)pills+=`<span class="pill proj" style="border-color:${hex2b(proj.color)};color:${proj.color}">${esc(proj.name)}</span>`;
    if(a)pills+=`<span class="pill">${esc(a.name)}</span>`;
  }
  if(fgn)note=(note?note+" · ":"")+"≈"+fmt(baseAmt(r));
  return `<div class="rec" onclick="openAdd('${r.id}')">
    <div class="ic" style="background:${hex2(col)};color:${col}">${icon}</div>
    <div class="mid"><div class="rname">${esc(name)}</div>${note?`<div class="rnote">${esc(note)}</div>`:""}</div>
    <div class="rright"><div class="ramt" style="color:${amtcol}">${amt}</div>${pills?`<div class="pills">${pills}</div>`:""}</div></div>`;
}
function hex2b(hex){ // slightly stronger translucent for pill borders
  hex=hex||"#888888";if(hex.length===4)hex="#"+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},.45)`;
}
function hex2(hex){ // translucent bg from hex
  hex=hex||"#888888";if(hex.length===4)hex="#"+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},.15)`;
}

/* =================== stats page =================== */
function renderStats(){
  const recs=recsInMonth(ui.month);
  let inc=0,exp=0;recs.forEach(r=>{if(r.type==="income")inc+=baseAmt(r);else if(r.type==="expense")exp+=baseAmt(r);});
  let html=`<div class="sumstrip">
    <div class="cell"><div class="lbl">收入</div><div class="val inc">${fmt(inc)}</div></div>
    <div class="cell"><div class="lbl">支出</div><div class="val exp">${fmt(exp)}</div></div>
    <div class="cell"><div class="lbl">結餘</div><div class="val">${fmt(inc-exp)}</div></div>
  </div>`;
  html+=`<div class="seg">
    <button class="${ui.statType==="expense"?"on":""}" onclick="ui.statType='expense';ui.statMain=null;render()">支出分類</button>
    <button class="${ui.statType==="income"?"on":""}" onclick="ui.statType='income';ui.statMain=null;render()">收入分類</button>
  </div>`;
  // category breakdown (roll up to main, drill into subs)
  const recsT=recs.filter(r=>r.type===ui.statType);
  let items=[],tot=0,back="";
  if(ui.statMain){
    const m=catOf(ui.statMain);const bySub={};
    recsT.forEach(r=>{const c=catOf(r.categoryId),mm=mainOf(c);if(!mm||mm.id!==ui.statMain)return;const v=baseAmt(r);bySub[r.categoryId]=(bySub[r.categoryId]||0)+v;tot+=v;});
    items=Object.entries(bySub).map(([id,v],i)=>{const c=catOf(id);return {id,name:c?(c.id===ui.statMain?"（整體）":c.name):"未分類",icon:catIcon(c),v,color:COLORS[i%COLORS.length]};}).sort((a,b)=>b.v-a.v);
    back=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><button onclick="ui.statMain=null;render()" style="color:var(--accent);font-weight:600">‹ 返回</button><span style="font-weight:700;display:inline-flex;align-items:center;gap:6px">${m?IC(m.icon)+esc(m.name):""}</span></div>`;
  }else{
    const byMain={};
    recsT.forEach(r=>{const c=catOf(r.categoryId),m=mainOf(c);if(!m)return;const v=baseAmt(r);byMain[m.id]=(byMain[m.id]||0)+v;tot+=v;});
    items=Object.entries(byMain).map(([id,v])=>{const m=catOf(id);return {id,name:m?m.name:"未分類",icon:m?m.icon:"❓",v,color:m?m.color:"#999",drill:m?subCats(m.id).length>0:false};}).sort((a,b)=>b.v-a.v);
  }
  html+=`<div class="chartcard">${back}<div class="donut-wrap">`;
  if(tot<=0){html+=`<div class="empty" style="padding:30px 0">這個月沒有${ui.statType==="expense"?"支出":"收入"}資料</div>`;}
  else{
    html+=donutSVG(items.map(x=>({value:x.v,color:x.color})),tot);
    html+=`<div class="legend">`;
    items.forEach(x=>{const pct=x.v/tot*100;
      html+=`<div class="legrow" ${x.drill?`onclick="ui.statMain='${x.id}';render()"`:""}>
        <span class="dot" style="background:${x.color}"></span>
        <span class="lname">${IC(x.icon)} ${esc(x.name)}${x.drill?' <span style="color:var(--text3)">›</span>':""}</span>
        <span class="lpct">${pct.toFixed(1)}%</span>
        <span class="lamt">${fmt(x.v)}</span></div>`;
    });
    html+=`</div>`;
  }
  html+=`</div></div>`;
  // 6-month trend
  html+=`<div class="chartcard"><h3>近 6 個月${ui.statType==="expense"?"支出":"收入"}趨勢</h3>${trendChart(ui.statType)}</div>`;
  document.getElementById("page-stats").innerHTML=html;
}
function donutSVG(slices,total){
  const R=68,r=44,cx=90,cy=90;let a0=-Math.PI/2;
  let paths="";
  slices.forEach(s=>{
    const frac=s.value/total;let a1=a0+frac*Math.PI*2;
    if(frac>=0.9999){ // full circle
      paths+=`<circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="${s.color}" stroke-width="${R-r}"/>`;
    }else{
      paths+=arc(cx,cy,R,r,a0,a1,s.color);
    }
    a0=a1;
  });
  return `<svg width="180" height="180" viewBox="0 0 180 180">${paths}
    <text x="90" y="84" text-anchor="middle" font-size="11" fill="var(--text2)">共</text>
    <text x="90" y="104" text-anchor="middle" font-size="17" font-weight="700" fill="var(--text)">${fmt(total)}</text></svg>`;
}
function arc(cx,cy,R,r,a0,a1,color){
  const p=(rad,ang)=>[cx+rad*Math.cos(ang),cy+rad*Math.sin(ang)];
  const large=(a1-a0)>Math.PI?1:0;
  const[x1,y1]=p(R,a0),[x2,y2]=p(R,a1),[x3,y3]=p(r,a1),[x4,y4]=p(r,a0);
  return `<path d="M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${large} 0 ${x4} ${y4} Z" fill="${color}"/>`;
}
function trendChart(type){
  const months=[];let[y,m]=ui.month.split("-").map(Number);
  for(let i=5;i>=0;i--){let yy=y,mm=m-i;while(mm<1){mm+=12;yy--;}months.push(yy+"-"+String(mm).padStart(2,"0"));}
  const vals=months.map(mo=>{let s=0;DB.records.forEach(r=>{if(r.type===type&&inMonth(r.date,mo))s+=baseAmt(r);});return s;});
  const max=Math.max(1,...vals);
  let bars="";
  months.forEach((mo,i)=>{
    const h=vals[i]/max*100;const cur=(mo===ui.month);
    bars+=`<div class="bcol">
      <div class="bval">${vals[i]?kfmt(vals[i]):""}</div>
      <div class="bbar" style="height:${h}%;background:${cur?"var(--accent)":"color-mix(in srgb,var(--accent) 40%,transparent)"}"></div>
      <div class="blbl">${parseInt(mo.split("-")[1])}月</div></div>`;
  });
  return `<div class="barchart">${bars}</div>`;
}
function kfmt(n){if(n>=10000)return (n/10000).toFixed(n>=100000?0:1)+"萬";if(n>=1000)return (n/1000).toFixed(0)+"k";return Math.round(n);}

/* =================== accounts page =================== */
function renderAccounts(){
  const live=DB.accounts;
  let assets=0,debt=0;
  const bals=live.map(a=>{const b=accBalance(a.id);if(b>=0)assets+=b;else debt+=b;return b;});
  const net=assets+debt;
  let html=`<div class="networth"><div class="nwl">淨資產</div><div class="nwv">${fmt(net)}</div>
    <div class="nwsub"><span>資產<b>${fmt(assets)}</b></span><span>負債<b>${fmt(Math.abs(debt))}</b></span></div></div>`;
  html+=`<div class="card"><div class="card-h">帳戶 (${live.length})</div>`;
  if(!live.length)html+=`<div class="empty" style="padding:30px">尚無帳戶</div>`;
  live.forEach((a,i)=>{
    html+=`<div class="row" onclick="openAccount('${a.id}')">
      <div class="ic" style="background:${hex2(a.color)};color:${a.color}">${IC(a.icon)}</div>
      <div class="mid"><div class="rtitle">${esc(a.name)}</div><div class="rsub">${accTypeName(a.type)}</div></div>
      <div class="rval" style="color:${bals[i]<0?"var(--expense)":"var(--text)"}">${fmt(bals[i])}</div></div>`;
  });
  html+=`</div><button class="btn ghost" onclick="openAccount()">＋ 新增帳戶</button>`;
  document.getElementById("page-accounts").innerHTML=html;
}
function accTypeName(t){return {cash:"現金",bank:"銀行",credit:"信用卡",ewallet:"電子支付",invest:"投資"}[t]||"其他";}

/* =================== budgets page =================== */
function budSpent(catId,recs){
  const c=catOf(catId);if(!c)return 0;const isMain=!c.parent;let s=0;
  recs.forEach(r=>{const rc=catOf(r.categoryId);if(!rc)return;const match=isMain?((mainOf(rc)||{}).id===catId):(r.categoryId===catId);if(match)s+=baseAmt(r);});
  return s;
}
function renderBudgets(){
  const recs=recsInMonth(ui.month).filter(r=>r.type==="expense");
  let totalExp=0;recs.forEach(r=>{totalExp+=baseAmt(r);});
  const totalBud=DB.budgets.find(b=>b.categoryId==="total");
  let html="";
  if(totalBud){
    html+=`<div class="card"><div class="bud" onclick="openBudget('total')">
      ${budBar("本月總預算","target",DB.config.accent,totalExp,totalBud.amount)}</div></div>`;
  }else{
    html+=`<div class="card"><div class="row" onclick="openBudget('total')"><div class="ic" style="background:${hex2(DB.config.accent)};color:var(--accent)">${IC("target")}</div><div class="mid"><div class="rtitle">設定總預算</div><div class="rsub">設定每月總支出上限</div></div><div class="chev" style="color:var(--text3)">›</div></div></div>`;
  }
  const catBuds=DB.budgets.filter(b=>b.categoryId!=="total");
  html+=`<div class="card"><div class="card-h">分類預算</div>`;
  if(!catBuds.length)html+=`<div class="empty" style="padding:26px">尚未設定分類預算</div>`;
  catBuds.forEach(b=>{
    const c=catOf(b.categoryId);if(!c)return;
    const nm=c.parent?(mainOf(c).name+"·"+c.name):c.name;
    html+=`<div class="bud" onclick="openBudget('${b.categoryId}')">${budBar(nm,catIcon(c),catColor(c),budSpent(b.categoryId,recs),b.amount)}</div>`;
  });
  html+=`</div><button class="btn ghost" onclick="openBudget()">＋ 新增分類預算</button>`;
  document.getElementById("page-budgets").innerHTML=html;
}
function budBar(name,icon,color,spent,budget){
  const pct=budget>0?spent/budget*100:0;
  const over=pct>=100;
  const barcol=over?"var(--expense)":pct>=80?"#f59e0b":"var(--income)";
  const left=budget-spent;
  return `<div class="bhead"><div class="bname"><span class="ic" style="background:${hex2(color)};color:${color}">${IC(icon)}</span>${esc(name)}</div>
    <div class="bnum">${fmt(spent)} / ${fmt(budget)}</div></div>
    <div class="pbar"><i style="width:${Math.min(100,pct)}%;background:${barcol}"></i></div>
    <div class="bnum" style="margin-top:6px;text-align:right;color:${over?"var(--expense)":"var(--text2)"}">${over?"超支 "+fmt(-left):"剩餘 "+fmt(left)} · ${pct.toFixed(0)}%</div>`;
}

/* =================== projects page =================== */
function projStats(pid){
  let inc=0,exp=0,n=0,byCat={};
  DB.records.forEach(r=>{if(r.projectId!==pid)return;n++;const v=baseAmt(r);
    if(r.type==="income")inc+=v;else if(r.type==="expense"){exp+=v;const m=mainOf(catOf(r.categoryId));if(m)byCat[m.id]=(byCat[m.id]||0)+v;}});
  return {inc,exp,net:inc-exp,n,byCat};
}
function renderProjects(){
  let html="";
  if(!DB.projects.length){
    html=`<div class="empty"><div class="big">${IC("folder")}</div>還沒有專案<br>用專案把一趟旅遊、一個活動的收支<br>獨立歸在一起追蹤</div>`;
  }else{
    const sorted=DB.projects.map(p=>({p,s:projStats(p.id)})).sort((a,b)=>b.s.n-a.s.n);
    html+=`<div class="card"><div class="card-h">專案 (${DB.projects.length})</div>`;
    sorted.forEach(({p,s})=>{
      html+=`<div class="row" onclick="openProjectDetail('${p.id}')">
        <div class="ic" style="background:${hex2(p.color)};color:${p.color}">${IC(p.icon||"📁")}</div>
        <div class="mid"><div class="rtitle">${esc(p.name)}</div><div class="rsub">${s.n} 筆 · 支 ${fmt(s.exp)}${s.inc?" · 收 "+fmt(s.inc):""}</div></div>
        <div class="rval" style="color:${s.net<0?"var(--expense)":"var(--income)"}">${fmt(s.net,true)}</div></div>`;
    });
    html+=`</div>`;
  }
  html+=`<button class="btn ghost" onclick="openProjectEdit()">＋ 新增專案</button>`;
  document.getElementById("page-projects").innerHTML=html;
}
function openProjectDetail(pid){
  const p=projOf(pid);if(!p)return;
  const s=projStats(pid);
  const recs=DB.records.filter(r=>r.projectId===pid).sort((a,b)=>b.date<a.date?-1:b.date>a.date?1:(b._t||0)-(a._t||0));
  let body=`<div class="sumstrip" style="margin-top:0">
    <div class="cell"><div class="lbl">收入</div><div class="val inc">${fmt(s.inc)}</div></div>
    <div class="cell"><div class="lbl">支出</div><div class="val exp">${fmt(s.exp)}</div></div>
    <div class="cell"><div class="lbl">結餘</div><div class="val">${fmt(s.net)}</div></div></div>
    <button class="btn ghost sm" onclick="openProjectEdit('${pid}')">編輯專案</button>`;
  // category breakdown
  const arr=Object.entries(s.byCat).map(([id,v])=>({c:catOf(id),v})).filter(x=>x.c).sort((a,b)=>b.v-a.v);
  if(arr.length){
    body+=`<div class="card-h" style="padding:14px 2px 2px">支出分類</div><div class="card" style="padding:4px 14px">`;
    arr.forEach(x=>{const pct=s.exp>0?x.v/s.exp*100:0;const col=catColor(x.c);
      body+=`<div class="legrow"><span class="dot" style="background:${col}"></span><span class="lname">${IC(catIcon(x.c))} ${esc(x.c.name)}</span><span class="lpct">${pct.toFixed(0)}%</span><span class="lamt">${fmt(x.v)}</span></div>`;});
    body+=`</div>`;
  }
  // records
  body+=`<div class="card-h" style="padding:14px 2px 2px">明細 (${recs.length})</div>`;
  if(!recs.length){body+=`<div class="empty" style="padding:24px">此專案尚無記錄</div>`;}
  else{
    const groups={};recs.forEach(r=>{(groups[r.date]=groups[r.date]||[]).push(r);});
    Object.keys(groups).sort().reverse().forEach(d=>{
      body+=`<div class="daygroup"><div class="dayhead"><span class="ddate">${fmtDay(d)}</span></div><div class="reclist">`;
      groups[d].forEach(r=>body+=recRow(r));body+=`</div></div>`;
    });
  }
  openSheet(p.name,body,{del:"deleteProject('"+pid+"')"});
}
let projState=null;
function openProjectEdit(pid){
  let p=pid?projOf(pid):null;
  projState=p?Object.assign({},p):{id:null,name:"",icon:"📁",color:COLORS[DB.projects.length%COLORS.length]};
  const body=`
    <div class="field"><label>專案名稱</label><input id="pj_name" value="${esc(projState.name)}" placeholder="例如 2026 東京旅遊"></div>
    <div class="field"><label>圖示</label><div class="emoji-grid" id="pj_emoji">${["📁","✈️","🏖️","🗾","🏔️","🎡","🎒","🏠","💼","🎁","🎤","🚗","🍜","💰","📦","❤️"].map(e=>`<button data-e="${e}" class="${e===projState.icon?"on":""}">${e}</button>`).join("")}</div></div>
    <div class="field"><label>顏色</label><div class="color-grid" id="pj_color">${COLORS.map(c=>`<button data-c="${c}" style="background:${c}" class="${c===projState.color?"on":""}"></button>`).join("")}</div></div>
    <button class="btn" onclick="saveProject()">${p?"儲存":"新增專案"}</button>`;
  const el=openSheet(p?"編輯專案":"新增專案",body);
  const b=el.querySelector(".sheet-body");
  b.querySelector("#pj_name").oninput=e=>projState.name=e.target.value;
  b.querySelector("#pj_emoji").onclick=e=>{const t=e.target.closest("[data-e]");if(!t)return;projState.icon=t.dataset.e;b.querySelectorAll("#pj_emoji button").forEach(x=>x.classList.toggle("on",x.dataset.e===projState.icon));};
  b.querySelector("#pj_color").onclick=e=>{const t=e.target.closest("[data-c]");if(!t)return;projState.color=t.dataset.c;b.querySelectorAll("#pj_color button").forEach(x=>x.classList.toggle("on",x.dataset.c===projState.color));};
}
function saveProject(){
  if(!projState.name.trim()){toast("請輸入名稱");return;}
  const editing=!!projState.id;
  if(editing){Object.assign(projOf(projState.id),projState);}
  else{projState.id="p_"+uid();DB.projects.push(Object.assign({},projState));}
  save();closeTopSheet();
  if(editing&&sheetStack.length)closeTopSheet(); // close detail too, will reopen
  if(ui.page!=="projects")go("projects");else render();
  toast("已儲存");
}
function deleteProject(pid){
  const n=DB.records.filter(r=>r.projectId===pid).length;
  if(!confirm(n?`此專案有 ${n} 筆記錄，刪除專案後這些記錄會保留、只是取消歸屬。確定？`:"確定刪除此專案？"))return;
  DB.records.forEach(r=>{if(r.projectId===pid)delete r.projectId;});
  DB.projects=DB.projects.filter(p=>p.id!==pid);
  save();closeTopSheet();go("projects");toast("已刪除");
}

/* =================== settings page =================== */
function renderSettings(){
  const syn=syncOn();
  let html=`
  <div class="set-group">
    <div class="set-item" onclick="openManageCats()"><span class="si-ic">🏷️</span><span class="si-label">分類管理</span><span class="si-val">${DB.categories.length}</span><span class="chev">›</span></div>
    <div class="set-item" onclick="openManageTags()"><span class="si-ic">#️⃣</span><span class="si-label">標籤管理</span><span class="si-val">${DB.tags.length}</span><span class="chev">›</span></div>
  </div>
  <div class="set-group">
    <div class="set-item" onclick="openCurrency()"><span class="si-ic">💱</span><span class="si-label">幣別與匯率</span><span class="si-val">${DB.config.baseCur}・${DB.config.currencies.length} 種</span><span class="chev">›</span></div>
    <div class="set-item" onclick="openTheme()"><span class="si-ic">🎨</span><span class="si-label">外觀主題</span><span class="si-val">${({light:"淺色",dark:"深色",auto:"跟隨系統"})[DB.config.theme]}</span><span class="chev">›</span></div>
  </div>
  <div class="set-group">
    <div class="set-item" onclick="openSync()"><span class="si-ic">☁️</span><span class="si-label">雲端同步<span class="synbadge ${syn?"on":""}"></span></span><span class="si-val">${syn?"已啟用":"未設定"}</span><span class="chev">›</span></div>
    <div class="set-item" onclick="exportData()"><span class="si-ic">📤</span><span class="si-label">匯出備份</span><span class="chev">›</span></div>
    <div class="set-item" onclick="importData()"><span class="si-ic">📥</span><span class="si-label">匯入備份</span><span class="chev">›</span></div>
  </div>
  <div class="set-group">
    <div class="set-item" onclick="resetAll()"><span class="si-ic">🗑️</span><span class="si-label" style="color:var(--expense)">清除所有資料</span><span class="chev">›</span></div>
  </div>
  <div class="hint" style="text-align:center;margin-top:16px">Tally · 資料存在本機瀏覽器${syn?" + 雲端 Gist":""}<br>共 ${DB.records.length} 筆記錄 · 版本 ${APP_VERSION}</div>`;
  document.getElementById("page-settings").innerHTML=html;
}

/* =================== sheet infra =================== */
let sheetStack=[];
function openSheet(title,bodyHtml,opts){
  opts=opts||{};
  const el=document.createElement("div");el.className="sheet";
  el.innerHTML=`<div class="grab"></div><div class="sheet-h"><button class="x" onclick="closeTopSheet()">取消</button><span class="st">${esc(title)}</span>${opts.del?`<button class="del" onclick="${opts.del}">刪除</button>`:`<span style="width:44px"></span>`}</div><div class="sheet-body">${bodyHtml}</div>${opts.footer||""}`;
  document.body.appendChild(el);
  sheetStack.push(el);
  document.getElementById("mask").classList.add("show");
  requestAnimationFrame(()=>el.classList.add("show"));
  return el;
}
function closeTopSheet(){
  const el=sheetStack.pop();if(!el)return;
  el.classList.remove("show");
  if(!sheetStack.length)document.getElementById("mask").classList.remove("show");
  setTimeout(()=>el.remove(),300);
}
function closeAllSheets(){while(sheetStack.length)closeTopSheet();}

/* =================== add / edit record =================== */
let addState=null;
function openAdd(editId){
  let r=editId?DB.records.find(x=>x.id===editId):null;
  addState={
    id:r?r.id:null,
    type:r?r.type:"expense",
    expr:r?String(r.amount):"0",
    cur:r?(r.cur||DB.config.baseCur):DB.config.baseCur,
    rate:r?(r.rate!=null?r.rate:curInfo(r.cur||DB.config.baseCur).rate):1,
    categoryId:r?r.categoryId:null,
    accountId:r?r.accountId:(DB.accounts[0]&&DB.accounts[0].id),
    toAccountId:r?r.toAccountId:(DB.accounts[1]&&DB.accounts[1].id),
    date:r?r.date:todayStr(),
    note:r?r.note||"":"",
    tags:r?(r.tags||[]).slice():[],
    projectId:r?(r.projectId||""):"",
  };
  if(!addState.categoryId&&addState.type!=="transfer"){const m=mainCats(addState.type)[0];if(m){const s=subCats(m.id)[0];addState.categoryId=s?s.id:m.id;}}
  addState.catMain=(addState.categoryId?((mainOf(catOf(addState.categoryId))||{}).id):((mainCats(addState.type)[0]||{}).id))||null;
  const el=openSheet(r?"編輯記錄":"新增記錄","",{del:r?"deleteRecord()":null});
  el.querySelector(".sheet-body").innerHTML=addBody();
  // keypad outside scroll body
  const kp=document.createElement("div");kp.className="keypad";kp.innerHTML=keypadHtml();
  el.appendChild(kp);
  bindAdd(el);
  renderAddDynamic(el);
}
function addBody(){
  return `<div class="addtype" id="addtype">
    <button data-t="expense">支出</button>
    <button data-t="income">收入</button>
    <button data-t="transfer">轉帳</button></div>
  <div class="amtbox"><span class="cur" id="amtcur">${curInfo(addState.cur).symbol}</span><span class="num" id="amtnum">0</span></div>
  <div id="curarea"></div>
  <div id="catarea"></div>
  <div id="formarea"></div>`;
}
function keypadHtml(){
  return `<button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button data-k="back">⌫</button>
  <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="op" data-k="+">＋</button>
  <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="-">－</button>
  <button data-k=".">.</button><button data-k="0">0</button><button data-k="00">00</button><button class="done" data-k="done">完成</button>`;
}
function bindAdd(el){
  el.querySelector("#addtype").onclick=(e)=>{
    const b=e.target.closest("button[data-t]");if(!b)return;
    addState.type=b.dataset.t;
    if(addState.type!=="transfer"){
      const c=catOf(addState.categoryId);
      if(!c||c.type!==addState.type){const nc=DB.categories.find(x=>x.type===addState.type);addState.categoryId=nc?nc.id:null;}
    }
    renderAddDynamic(el);
  };
  el.querySelector(".keypad").onclick=(e)=>{
    const b=e.target.closest("button[data-k]");if(!b)return;
    const k=b.dataset.k;
    if(k==="done"){saveRecord();return;}
    keyPress(k);updateAmtDisplay(el);
  };
}
function renderCurArea(el){
  const curs=DB.config.currencies||[];
  const area=el.querySelector("#curarea");if(!area)return;
  if(curs.length<=1){area.innerHTML="";return;}
  let h=`<div class="chips" id="curchips" style="margin-bottom:10px">`+curs.map(c=>`<span class="chip ${c.code===addState.cur?"on":""}" data-cur="${c.code}">${c.code}</span>`).join("")+`</div>`;
  if(isForeign(addState.cur)){
    h+=`<div class="fieldrow" style="margin-bottom:8px">
      <div class="field" style="margin:0"><label>匯率 1 ${addState.cur} = ? ${baseSym()}</label><input id="f_rate" type="number" inputmode="decimal" value="${addState.rate}"></div>
      <div class="field" style="margin:0"><label>約合 ${baseSym()}</label><div style="padding:11px 2px;font-weight:700" id="basePrev">${fmt(evalExpr(addState.expr)*(addState.rate||0))}</div></div></div>`;
  }
  area.innerHTML=h;
  area.querySelector("#curchips").onclick=(e)=>{const c=e.target.closest("[data-cur]");if(!c)return;addState.cur=c.dataset.cur;addState.rate=curInfo(addState.cur).rate;renderCurArea(el);updateAmtDisplay(el);};
  const fr=area.querySelector("#f_rate");if(fr)fr.oninput=e=>{addState.rate=parseFloat(e.target.value)||0;const bp=area.querySelector("#basePrev");if(bp)bp.textContent=fmt(evalExpr(addState.expr)*(addState.rate||0));};
}
function updateAmtDisplay(el){
  el.querySelector("#amtnum").textContent=dispExpr();
  const ac=el.querySelector("#amtcur");if(ac)ac.textContent=curInfo(addState.cur).symbol;
  const bp=el.querySelector("#basePrev");if(bp)bp.textContent=fmt(evalExpr(addState.expr)*(addState.rate||0));
}
function renderCatPicker(el){
  const catarea=el.querySelector("#catarea");
  const mains=mainCats(addState.type);
  const main=catOf(addState.catMain);
  const subs=addState.catMain?subCats(addState.catMain):[];
  let h=`<div class="mainchips" id="mainchips">`+mains.map(m=>`<button class="mchip ${m.id===addState.catMain?"on":""}" data-main="${m.id}"><span class="mci" style="background:${hex2(m.color)};color:${m.color}">${IC(m.icon)}</span>${esc(m.name)}</button>`).join("")
    +`<button class="mchip addm" data-addmain="1"><span class="mci">＋</span>大類</button></div>`;
  h+=`<div class="catgrid" id="subgrid">`;
  if(main){
    h+=`<div class="cat ${addState.categoryId===main.id?"on":""}" data-cid="${main.id}"><div class="cic" style="background:${hex2(main.color)};color:${main.color}">${IC(main.icon)}</div><div class="cl">整體</div></div>`;
    subs.forEach(s=>{const col=catColor(s);h+=`<div class="cat ${s.id===addState.categoryId?"on":""}" data-cid="${s.id}"><div class="cic" style="background:${hex2(col)};color:${col}">${IC(catIcon(s))}</div><div class="cl">${esc(s.name)}</div></div>`;});
    h+=`<div class="cat addc" data-addsub="1"><div class="cic">＋</div><div class="cl">細項</div></div>`;
  }
  h+=`</div>`;
  catarea.innerHTML=h;
  catarea.querySelector("#mainchips").onclick=(e)=>{
    const am=e.target.closest("[data-addmain]");if(am){openEditCat(null,addState.type,()=>openAdd(addState.id),null);closeTopSheetSilent();return;}
    const mb=e.target.closest("[data-main]");if(!mb)return;
    addState.catMain=mb.dataset.main;addState.categoryId=mb.dataset.main;
    renderCatPicker(el);
  };
  catarea.querySelector("#subgrid").onclick=(e)=>{
    const as=e.target.closest("[data-addsub]");if(as){openEditCat(null,addState.type,()=>openAdd(addState.id),addState.catMain);closeTopSheetSilent();return;}
    const c=e.target.closest("[data-cid]");if(!c)return;
    addState.categoryId=c.dataset.cid;
    catarea.querySelectorAll("#subgrid .cat").forEach(x=>x.classList.toggle("on",x.dataset.cid===addState.categoryId));
  };
}
function renderAddDynamic(el){
  el.querySelectorAll("#addtype button").forEach(b=>{b.className="";if(b.dataset.t===addState.type)b.className="on-"+(addState.type==="expense"?"exp":addState.type==="income"?"inc":"xfer");});
  renderCurArea(el);
  updateAmtDisplay(el);
  const catarea=el.querySelector("#catarea"),formarea=el.querySelector("#formarea");
  if(addState.type==="transfer"){
    catarea.innerHTML="";
    formarea.innerHTML=`
      <div class="fieldrow">
        <div class="field"><label>從</label><div class="selwrap"><select id="f_from">${accOpts(addState.accountId)}</select></div></div>
        <div class="field"><label>到</label><div class="selwrap"><select id="f_to">${accOpts(addState.toAccountId)}</select></div></div>
      </div>
      <div class="field"><label>日期</label><input type="date" id="f_date" value="${addState.date}"></div>
      <div class="field"><label>備註</label><input id="f_note" placeholder="選填" value="${esc(addState.note)}"></div>
      ${projField()}`;
    formarea.querySelector("#f_from").onchange=e=>addState.accountId=e.target.value;
    formarea.querySelector("#f_to").onchange=e=>addState.toAccountId=e.target.value;
  }else{
    renderCatPicker(el);
    formarea.innerHTML=`
      <div class="fieldrow">
        <div class="field"><label>帳戶</label><div class="selwrap"><select id="f_acc">${accOpts(addState.accountId)}</select></div></div>
        <div class="field"><label>日期</label><input type="date" id="f_date" value="${addState.date}"></div>
      </div>
      <div class="field"><label>備註</label><input id="f_note" placeholder="選填" value="${esc(addState.note)}"></div>
      ${projField()}
      ${DB.tags.length?`<div class="field"><label>標籤</label><div class="chips" id="f_tags">${DB.tags.map(t=>`<span class="chip ${addState.tags.includes(t)?"on":""}" data-tag="${esc(t)}">${esc(t)}</span>`).join("")}</div></div>`:""}`;
    formarea.querySelector("#f_acc").onchange=e=>addState.accountId=e.target.value;
    const tg=formarea.querySelector("#f_tags");if(tg)tg.onclick=(e)=>{const c=e.target.closest("[data-tag]");if(!c)return;const t=c.dataset.tag;const i=addState.tags.indexOf(t);if(i<0)addState.tags.push(t);else addState.tags.splice(i,1);c.classList.toggle("on");};
  }
  const fd=formarea.querySelector("#f_date");if(fd)fd.onchange=e=>addState.date=e.target.value;
  const fn=formarea.querySelector("#f_note");if(fn)fn.oninput=e=>addState.note=e.target.value;
  const fp=formarea.querySelector("#f_proj");if(fp)fp.onchange=e=>addState.projectId=e.target.value;
}
function closeTopSheetSilent(){const el=sheetStack.pop();if(el)el.remove();if(!sheetStack.length)document.getElementById("mask").classList.remove("show");}
function accOpts(sel){return DB.accounts.map(a=>`<option value="${a.id}" ${a.id===sel?"selected":""}>${emojiOrBlank(a.icon)}${esc(a.name)}</option>`).join("");}
function projOpts(sel){return `<option value="">無</option>`+DB.projects.map(p=>`<option value="${p.id}" ${p.id===sel?"selected":""}>${emojiOrBlank(p.icon||"📁")}${esc(p.name)}</option>`).join("");}
function projField(){return DB.projects.length?`<div class="field"><label>專案</label><div class="selwrap"><select id="f_proj">${projOpts(addState.projectId)}</select></div></div>`:"";}

/* keypad expr */
function keyPress(k){
  let e=addState.expr;
  if(k==="back"){e=e.length>1?e.slice(0,-1):"0";if(/[+\-]$/.test(e)){}addState.expr=e;return;}
  if(k==="+"||k==="-"){if(/[+\-]$/.test(e))e=e.slice(0,-1)+k;else e=String(evalExpr(e))+k;addState.expr=e;return;}
  if(k==="."){const last=e.split(/[+\-]/).pop();if(last.includes("."))return;e+=".";addState.expr=e;return;}
  if(k==="00"){const last=e.split(/[+\-]/).pop();if(last==="0")return;e+="00";addState.expr=e;return;}
  // digit
  const last=e.split(/[+\-]/).pop();
  if(last==="0")e=e.slice(0,-1)+k;else e+=k;
  addState.expr=e;
}
function evalExpr(s){
  let m=s.match(/-?\d*\.?\d+|[+\-]/g);if(!m)return 0;
  let total=0,op="+",cur="";
  // simpler: tokenize
  let num="0",sum=0,sign=1,started=false;
  let res=0,curNum="",pend=1;
  let parts=s.replace(/([+\-])/g," $1 ").trim().split(/\s+/);
  let acc0=0,sgn=1;
  for(let i=0;i<parts.length;i++){
    let p=parts[i];
    if(p==="+"){sgn=1;}
    else if(p==="-"){sgn=-1;}
    else{acc0+=sgn*(parseFloat(p)||0);}
  }
  return acc0;
}
function dispExpr(){
  // show expr with current operators; evaluate trailing
  let e=addState.expr;
  return e.replace(/\+/g," + ").replace(/-/g," − ");
}
function saveRecord(){
  const amt=Math.round(evalExpr(addState.expr)*100)/100;
  if(!amt||amt<=0){toast("請輸入金額");return;}
  if(addState.type==="transfer"){
    if(addState.accountId===addState.toAccountId){toast("轉出與轉入帳戶需不同");return;}
  }else if(!addState.categoryId){toast("請選擇分類");return;}
  let r=addState.id?DB.records.find(x=>x.id===addState.id):null;
  if(!r){r={id:uid(),_t:Date.now()};DB.records.push(r);}
  r.type=addState.type;r.amount=amt;r.date=addState.date;r.note=addState.note.trim();
  r.cur=addState.cur;r.rate=(addState.cur===DB.config.baseCur)?1:(addState.rate||curInfo(addState.cur).rate||1);
  if(addState.projectId)r.projectId=addState.projectId;else delete r.projectId;
  if(addState.type==="transfer"){r.accountId=addState.accountId;r.toAccountId=addState.toAccountId;delete r.categoryId;delete r.tags;}
  else{r.accountId=addState.accountId;r.categoryId=addState.categoryId;r.tags=addState.tags.slice();delete r.toAccountId;}
  save();closeTopSheet();render();toast(addState.id?"已更新":"已記錄");
}
function deleteRecord(){
  if(!addState||!addState.id)return;
  DB.records=DB.records.filter(x=>x.id!==addState.id);
  save();closeTopSheet();render();toast("已刪除");
}

/* =================== account editor =================== */
let accState=null;
function openAccount(id){
  let a=id?acc(id):null;
  accState=a?Object.assign({},a):{id:null,name:"",type:"bank",init:0,icon:"🏦",color:"#5b6cff"};
  const body=`
    <div class="field"><label>名稱</label><input id="ac_name" value="${esc(accState.name)}" placeholder="例如 玉山銀行"></div>
    <div class="field"><label>類型</label><div class="selwrap"><select id="ac_type">
      ${["cash","bank","credit","ewallet","invest"].map(t=>`<option value="${t}" ${t===accState.type?"selected":""}>${accTypeName(t)}</option>`).join("")}
    </select></div></div>
    <div class="field"><label>初始餘額</label><input id="ac_init" type="number" inputmode="decimal" value="${accState.init||0}"></div>
    <div class="field"><label>圖示</label><div class="emoji-grid" id="ac_emoji">${EMOJIS.map(e=>`<button data-e="${e}" class="${e===accState.icon?"on":""}">${e}</button>`).join("")}</div></div>
    <div class="field"><label>顏色</label><div class="color-grid" id="ac_color">${COLORS.map(c=>`<button data-c="${c}" style="background:${c}" class="${c===accState.color?"on":""}"></button>`).join("")}</div></div>
    <button class="btn" onclick="saveAccount()">${a?"儲存":"新增帳戶"}</button>
    ${a?`<button class="btn danger sm" style="margin-top:10px" onclick="deleteAccount('${a.id}')">刪除帳戶</button>`:""}`;
  const el=openSheet(a?"編輯帳戶":"新增帳戶",body);
  const b=el.querySelector(".sheet-body");
  b.querySelector("#ac_name").oninput=e=>accState.name=e.target.value;
  b.querySelector("#ac_type").onchange=e=>accState.type=e.target.value;
  b.querySelector("#ac_init").oninput=e=>accState.init=parseFloat(e.target.value)||0;
  b.querySelector("#ac_emoji").onclick=e=>{const t=e.target.closest("[data-e]");if(!t)return;accState.icon=t.dataset.e;b.querySelectorAll("#ac_emoji button").forEach(x=>x.classList.toggle("on",x.dataset.e===accState.icon));};
  b.querySelector("#ac_color").onclick=e=>{const t=e.target.closest("[data-c]");if(!t)return;accState.color=t.dataset.c;b.querySelectorAll("#ac_color button").forEach(x=>x.classList.toggle("on",x.dataset.c===accState.color));};
}
function saveAccount(){
  if(!accState.name.trim()){toast("請輸入名稱");return;}
  if(accState.id){Object.assign(acc(accState.id),accState);}
  else{accState.id="a_"+uid();DB.accounts.push(Object.assign({},accState));}
  save();closeTopSheet();render();toast("已儲存");
}
function deleteAccount(id){
  const used=DB.records.some(r=>r.accountId===id||r.toAccountId===id);
  if(used){if(!confirm("此帳戶已有記錄，刪除後相關記錄的帳戶會變成未知。確定刪除？"))return;}
  DB.accounts=DB.accounts.filter(a=>a.id!==id);
  save();closeTopSheet();render();toast("已刪除");
}

/* =================== budget editor =================== */
let budState=null;
function openBudget(catId){
  // catId: 'total' | existing category id | undefined(new)
  let existing=catId?DB.budgets.find(b=>b.categoryId===catId):null;
  const isTotal=catId==="total";
  budState={categoryId:catId||null,amount:existing?existing.amount:""};
  let catPicker="";
  if(!isTotal){
    const used=new Set(DB.budgets.filter(b=>b.categoryId!=="total").map(b=>b.categoryId));
    const ordered=[];mainCats("expense").forEach(m=>{ordered.push(m);subCats(m.id).forEach(s=>ordered.push(s));});
    const opts=ordered.filter(c=>!used.has(c.id)||c.id===catId);
    catPicker=`<div class="field"><label>分類（大類＝含底下所有細項）</label><div class="selwrap"><select id="bg_cat" ${catId?"disabled":""}>
      ${opts.map(c=>`<option value="${c.id}" ${c.id===catId?"selected":""}>${c.parent?"　└ "+esc(c.name):emojiOrBlank(catIcon(c))+esc(c.name)}</option>`).join("")}
    </select></div></div>`;
    if(!catId&&opts.length)budState.categoryId=opts[0].id;
  }
  const body=`${catPicker}
    <div class="field"><label>每月預算金額</label><input id="bg_amt" type="number" inputmode="decimal" value="${budState.amount}" placeholder="0"></div>
    <button class="btn" onclick="saveBudget()">儲存</button>
    ${existing?`<button class="btn danger sm" style="margin-top:10px" onclick="deleteBudget('${catId}')">移除預算</button>`:""}`;
  const el=openSheet(isTotal?"總預算":"分類預算",body);
  const b=el.querySelector(".sheet-body");
  const sc=b.querySelector("#bg_cat");if(sc)sc.onchange=e=>budState.categoryId=e.target.value;
  b.querySelector("#bg_amt").oninput=e=>budState.amount=parseFloat(e.target.value)||0;
}
function saveBudget(){
  if(!budState.categoryId){toast("沒有可設定的分類");return;}
  if(!budState.amount||budState.amount<=0){toast("請輸入預算金額");return;}
  let ex=DB.budgets.find(b=>b.categoryId===budState.categoryId);
  if(ex)ex.amount=budState.amount;else DB.budgets.push({id:uid(),categoryId:budState.categoryId,amount:budState.amount});
  save();closeTopSheet();render();toast("已儲存");
}
function deleteBudget(catId){DB.budgets=DB.budgets.filter(b=>b.categoryId!==catId);save();closeTopSheet();render();toast("已移除");}

/* =================== category management (two-level) =================== */
function openManageCats(){
  window._mctType="expense";window._mctMain=null;
  openSheet("分類管理",`<div class="seg" style="margin-top:4px"><button class="on" id="mct_e" onclick="switchCatTab('expense')">支出</button><button id="mct_i" onclick="switchCatTab('income')">收入</button></div><div id="mct_body"></div>`);
  mctRender();
}
function switchCatTab(type){
  window._mctType=type;window._mctMain=null;
  const el=sheetStack[sheetStack.length-1];
  el.querySelector("#mct_e").classList.toggle("on",type==="expense");
  el.querySelector("#mct_i").classList.toggle("on",type==="income");
  mctRender();
}
function mctRender(){
  const el=sheetStack[sheetStack.length-1];if(!el)return;const box=el.querySelector("#mct_body");if(!box)return;
  const type=window._mctType||"expense";
  if(!window._mctMain){
    // main categories list
    const mains=mainCats(type);
    let h=mains.map(m=>{const n=subCats(m.id).length;return `<div class="mitem">
      <div class="ic" style="background:${hex2(m.color)};color:${m.color}">${IC(m.icon)}</div>
      <div class="mn" onclick="window._mctMain='${m.id}';mctRender()" style="cursor:pointer">${esc(m.name)}<div style="font-size:11px;color:var(--text2)">${n} 個細項 ›</div></div>
      <button class="medit" onclick="openEditCat('${m.id}')">編輯</button>
      <button class="mdel" onclick="deleteCat('${m.id}')">✕</button></div>`;}).join("")
      ||`<div class="empty" style="padding:24px">尚無大類</div>`;
    h+=`<button class="btn ghost" style="margin-top:14px" onclick="openEditCat(null,'${type}',null,null)">＋ 新增大類</button>`;
    box.innerHTML=h;
  }else{
    const m=catOf(window._mctMain);if(!m){window._mctMain=null;return mctRender();}
    const subs=subCats(m.id);
    let h=`<div class="mitem" style="border:none"><button class="medit" style="padding-left:0" onclick="window._mctMain=null;mctRender()">‹ 返回大類</button><div class="mn" style="text-align:center;font-weight:700;display:inline-flex;align-items:center;gap:6px;justify-content:center">${IC(m.icon)}${esc(m.name)}</div><span style="width:50px"></span></div>`;
    h+=subs.map(s=>{const col=catColor(s);return `<div class="mitem">
      <div class="ic" style="background:${hex2(col)};color:${col}">${IC(catIcon(s))}</div>
      <div class="mn">${esc(s.name)}</div>
      <button class="medit" onclick="openEditCat('${s.id}')">編輯</button>
      <button class="mdel" onclick="deleteCat('${s.id}')">✕</button></div>`;}).join("")
      ||`<div class="empty" style="padding:20px">此大類尚無細項</div>`;
    h+=`<button class="btn ghost" style="margin-top:14px" onclick="openEditCat(null,'${type}',null,'${m.id}')">＋ 新增細項到「${esc(m.name)}」</button>`;
    box.innerHTML=h;
  }
}
let catState=null,catCb=null;
function openEditCat(id,type,cb,parent){
  catCb=cb||null;
  let c=id?catOf(id):null;
  const par=c?(c.parent||null):(parent||null);
  const parCat=par?catOf(par):null;
  catState=c?Object.assign({},c):{id:null,name:"",type:(parCat?parCat.type:(type||"expense")),icon:(par?"":"📦"),color:parCat?parCat.color:"#78716c",parent:par};
  const isSub=!!par;
  const body=`
    ${isSub?`<div class="hint" style="margin:0 0 10px">${parCat?emojiOrBlank(parCat.icon)+esc(parCat.name):""} 的細項</div>`:""}
    <div class="field"><label>名稱</label><input id="ct_name" value="${esc(catState.name)}" placeholder="${isSub?"細項名稱":"大類名稱"}"></div>
    <div class="field"><label>圖示</label><div class="emoji-grid" id="ct_emoji">${EMOJIS.map(e=>`<button data-e="${e}" class="${e===catState.icon?"on":""}">${e}</button>`).join("")}</div></div>
    <div class="field"><label>顏色${isSub?"（細項預設沿用大類色）":""}</label><div class="color-grid" id="ct_color">${COLORS.map(x=>`<button data-c="${x}" style="background:${x}" class="${x===catState.color?"on":""}"></button>`).join("")}</div></div>
    <button class="btn" onclick="saveCat()">${c?"儲存":"新增"}</button>`;
  const el=openSheet(c?"編輯分類":(isSub?"新增細項":"新增"+(catState.type==="expense"?"支出":"收入")+"大類"),body);
  const b=el.querySelector(".sheet-body");
  b.querySelector("#ct_name").oninput=e=>catState.name=e.target.value;
  b.querySelector("#ct_emoji").onclick=e=>{const t=e.target.closest("[data-e]");if(!t)return;catState.icon=t.dataset.e;b.querySelectorAll("#ct_emoji button").forEach(x=>x.classList.toggle("on",x.dataset.e===catState.icon));};
  b.querySelector("#ct_color").onclick=e=>{const t=e.target.closest("[data-c]");if(!t)return;catState.color=t.dataset.c;b.querySelectorAll("#ct_color button").forEach(x=>x.classList.toggle("on",x.dataset.c===catState.color));};
}
function saveCat(){
  if(!catState.name.trim()){toast("請輸入名稱");return;}
  if(catState.id){Object.assign(catOf(catState.id),catState);}
  else{catState.id="c_"+uid();if(!catState.parent)delete catState.parent;DB.categories.push(Object.assign({},catState));}
  save();closeTopSheet();
  const cb=catCb;catCb=null;
  if(cb){cb();return;}
  if(sheetStack.length&&sheetStack[sheetStack.length-1].querySelector("#mct_body"))mctRender();
  render();toast("已儲存");
}
function deleteCat(id){
  const c=catOf(id);if(!c)return;
  const isMain=!c.parent;
  const subIds=isMain?subCats(id).map(s=>s.id):[];
  const ids=[id].concat(subIds);
  const usedN=DB.records.filter(r=>ids.includes(r.categoryId)).length;
  let msg=isMain
    ?(subIds.length?`「${c.name}」有 ${subIds.length} 個細項，將一併刪除。`:`確定刪除大類「${c.name}」？`)
    :`確定刪除細項「${c.name}」？`;
  if(usedN)msg+=`\n有 ${usedN} 筆記錄使用，刪除後會變成未分類。`;
  if(!confirm(msg))return;
  DB.records.forEach(r=>{if(ids.includes(r.categoryId))delete r.categoryId;});
  DB.categories=DB.categories.filter(x=>!ids.includes(x.id));
  DB.budgets=DB.budgets.filter(b=>!ids.includes(b.categoryId));
  if(isMain)window._mctMain=null;
  save();mctRender();render();toast("已刪除");
}

/* =================== tags management =================== */
function openManageTags(){
  const body=`<div id="tg_list">${tagList()}</div>
    <div class="field" style="margin-top:14px"><label>新增標籤</label><div class="fieldrow"><input id="tg_new" placeholder="標籤名稱"><button class="btn sm" style="flex:0 0 72px;margin-top:0" onclick="addTag()">新增</button></div></div>`;
  openSheet("標籤管理",body);
  const el=sheetStack[sheetStack.length-1];
  el.querySelector("#tg_new").onkeydown=e=>{if(e.key==="Enter")addTag();};
}
function tagList(){
  if(!DB.tags.length)return `<div class="empty" style="padding:20px">尚無標籤</div>`;
  return DB.tags.map(t=>`<div class="mitem"><div class="mn">#${esc(t)}</div><button class="mdel" onclick="delTag('${esc(t)}')">✕</button></div>`).join("");
}
function addTag(){
  const el=sheetStack[sheetStack.length-1];const inp=el.querySelector("#tg_new");
  const v=inp.value.trim();if(!v)return;if(DB.tags.includes(v)){toast("已存在");return;}
  DB.tags.push(v);save();inp.value="";el.querySelector("#tg_list").innerHTML=tagList();renderSettings();
}
function delTag(t){DB.tags=DB.tags.filter(x=>x!==t);DB.records.forEach(r=>{if(r.tags)r.tags=r.tags.filter(x=>x!==t);});save();const el=sheetStack[sheetStack.length-1];el.querySelector("#tg_list").innerHTML=tagList();renderSettings();}

/* =================== currency / theme =================== */
function openCurrency(){
  const body=`
    <div class="field"><label>主要幣別（所有統計與餘額以此計價）</label><div class="selwrap"><select id="cm_base">
      ${DB.config.currencies.map(c=>`<option value="${c.code}" ${c.code===DB.config.baseCur?"selected":""}>${c.code}（${esc(c.symbol)}）</option>`).join("")}
    </select></div></div>
    <div class="card-h" style="padding:8px 2px 4px">幣別與匯率</div>
    <div id="cm_list">${curManagerList()}</div>
    <div class="hint">匯率 = 1 單位外幣可換多少主要幣別（例如 1 HKD = 4.1 TWD 就填 4.1）。記帳時仍可調整單筆匯率。</div>
    <div class="field" style="margin-top:12px"><label>新增幣別</label>
      <div class="fieldrow"><input id="cm_code" placeholder="代碼 EUR" maxlength="5"><input id="cm_sym" placeholder="符號 €"><input id="cm_rate" type="number" inputmode="decimal" placeholder="匯率"></div>
      <button class="btn sm ghost" style="margin-top:8px" onclick="addCurrency()">＋ 新增幣別</button></div>`;
  openSheet("幣別與匯率",body);
  const el=sheetStack[sheetStack.length-1];
  el.querySelector("#cm_base").onchange=e=>{DB.config.baseCur=e.target.value;save();el.querySelector("#cm_list").innerHTML=curManagerList();renderSettings();};
}
function curManagerList(){
  return DB.config.currencies.map(c=>{
    const isBase=c.code===DB.config.baseCur;
    return `<div class="mitem">
      <div class="mn">${c.code} <span style="color:var(--text2)">${esc(c.symbol)}</span>${isBase?' <span style="color:var(--accent);font-size:12px">主要</span>':""}</div>
      ${isBase?'<span class="si-val" style="color:var(--text2)">匯率 1</span>':`<input style="width:86px;text-align:right" type="number" inputmode="decimal" value="${c.rate}" onchange="setRate('${c.code}',this.value)">`}
      ${isBase?'<span style="width:30px"></span>':`<button class="mdel" onclick="delCurrency('${c.code}')">✕</button>`}</div>`;
  }).join("");
}
function setRate(code,v){const c=curInfo(code);c.rate=parseFloat(v)||c.rate;save();}
function addCurrency(){
  const el=sheetStack[sheetStack.length-1];
  const code=(el.querySelector("#cm_code").value||"").trim().toUpperCase();
  const sym=(el.querySelector("#cm_sym").value||"").trim()||code;
  const rate=parseFloat(el.querySelector("#cm_rate").value)||0;
  if(!code){toast("請輸入代碼");return;}
  if(DB.config.currencies.some(x=>x.code===code)){toast("此幣別已存在");return;}
  if(rate<=0){toast("請輸入匯率");return;}
  DB.config.currencies.push({code,symbol:sym,rate});save();
  el.querySelector("#cm_list").innerHTML=curManagerList();
  el.querySelector("#cm_code").value="";el.querySelector("#cm_sym").value="";el.querySelector("#cm_rate").value="";
}
function delCurrency(code){
  if(DB.records.some(r=>(r.cur||DB.config.baseCur)===code)){toast("有記錄使用此幣別，無法刪除");return;}
  DB.config.currencies=DB.config.currencies.filter(x=>x.code!==code);save();
  const el=sheetStack[sheetStack.length-1];el.querySelector("#cm_list").innerHTML=curManagerList();
}
function openTheme(){
  const body=[["auto","跟隨系統"],["light","淺色"],["dark","深色"]].map(([k,n])=>`<div class="set-item" onclick="setTheme('${k}')"><span class="si-label">${n}</span>${DB.config.theme===k?'<span class="si-val">✓</span>':""}</div>`).join("");
  openSheet("外觀主題",`<div class="set-group" style="margin-top:6px">${body}</div>`);
}
function setTheme(t){DB.config.theme=t;save();applyTheme();closeTopSheet();render();}
function applyTheme(){
  const t=DB.config.theme;
  if(t==="auto")document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme",t);
  document.documentElement.style.setProperty("--accent",DB.config.accent||"#5b6cff");
}

/* =================== backup =================== */
function exportData(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download="記帳備份_"+todayStr()+".json";a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast("已匯出");
}
function importData(){
  const inp=document.createElement("input");inp.type="file";inp.accept=".json,application/json";
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;const rd=new FileReader();
    rd.onload=()=>{try{const obj=JSON.parse(rd.result);if(!obj.accounts||!obj.categories)throw 0;
      if(!confirm("匯入將覆蓋目前所有資料，確定？"))return;
      DB=obj;DB.config=Object.assign({currency:"$",theme:"auto",accent:"#5b6cff"},DB.config||{});
      save();applyTheme();render();toast("已匯入");
    }catch(e){toast("檔案格式錯誤");}};
    rd.readAsText(f);};
  inp.click();
}
function resetAll(){
  if(!confirm("這會清除所有帳戶、記錄、預算與設定，無法復原。確定？"))return;
  if(!confirm("再次確認：真的要清除全部資料嗎？"))return;
  localStorage.removeItem(STORE_KEY);DB=load();save(true);applyTheme();go("records");toast("已清除");
}
