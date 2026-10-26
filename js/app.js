"use strict";
/* views: pages, routing, modals, editors */
/* =================== router =================== */
const TITLES={records:"記錄",stats:"統計",projects:"專案",budgets:"預算",settings:"設定"};
function go(p){
  ui.page=p;
  document.querySelectorAll(".page").forEach(e=>e.classList.remove("active"));
  document.getElementById("page-"+p).classList.add("active");
  document.querySelectorAll(".nav button[data-p]").forEach(b=>b.classList.toggle("on",b.dataset.p===p));
  document.documentElement.classList.toggle("fin-full",p==="records"||p==="stats"||p==="projects");
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
  else if(ui.page==="projects")renderProjects();
  else if(ui.page==="budgets")renderBudgets();
  else if(ui.page==="settings")renderSettings();
}

/* =================== records page (day view) =================== */
function dstr(dt){return dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");}
function selectDay(ds){ui.selDate=ds;ui.month=ds.slice(0,7);render();}
function shiftWeek(dir){const[y,m,d]=ui.selDate.split("-").map(Number);selectDay(dstr(new Date(y,m-1,d+dir*7)));}
function bindWeekSwipe(){
  const el=document.getElementById("weekstrip");if(!el)return;let x0=null;
  el.addEventListener("touchstart",e=>{x0=e.touches[0].clientX;},{passive:true});
  el.addEventListener("touchend",e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>40)shiftWeek(dx<0?1:-1);},{passive:true});
}
function greeting(){const h=new Date().getHours();return h<5?"夜深了":h<11?"早安":h<18?"午安":"晚安";}
function renderRecords(){
  document.documentElement.classList.add("fin-full");
  const sel=ui.selDate,mo=sel.slice(0,7);
  let mexp=0;recsInMonth(mo).forEach(r=>{if(r.type==="expense")mexp+=baseAmt(r);});
  const cmp=spentCompare(mo,parseInt(sel.slice(8,10),10));
  const day=DB.records.filter(r=>r.date===sel).sort((a,b)=>(b._t||0)-(a._t||0));
  let dexp=0,dinc=0;day.forEach(r=>{if(r.type==="income")dinc+=baseAmt(r);else if(r.type==="expense")dexp+=baseAmt(r);});
  const rows=day.length
    ?`<div class="hv-rows">${day.map(homeRow).join("")}</div>`
    :`<div class="hv-empty">No records yet<br>Tap ＋ to add one</div>`;
  const html=`<div class="homev2">
    <div class="hv-top">
      <div class="hv-head">
        <div class="hv-date">${sel.replace(/-/g,"/")}</div>
        <div class="hv-actions">
          <div class="hv-circ hv-cal" aria-label="跳到日期">${IC("calendar")}<input type="date" value="${sel}" onchange="selectDay(this.value)"></div>
          <button class="hv-circ" onclick="homeSearch()" aria-label="搜尋">${IC("search")}</button>
        </div>
      </div>
      ${homeStrip(sel)}
      <div class="hv-spent" onclick="go('stats')">
        <div class="hv-spent-l">Spent this month</div>
        <div class="hv-spent-amt">${fmt(mexp)}</div>
        ${cmp?`<div class="hv-spent-cmp ${cmp.cls}">${cmp.arrow} ${cmp.text}</div>`:``}
      </div>
    </div>
    <div class="hv-list">${rows}</div>
  </div>`;
  document.getElementById("page-records").innerHTML=html;
  bindWeekSwipe();
}
const STAT_TABS=[["overview","總覽"],["detail","明細"],["category","類別"],["rank","排行"],["project","專案"],["name","名稱"]];
const DONUT_PALETTE=["#faba00","#aec8e1","#a3b128","#47b58e","#ff2e01","#8b5cf6","#ec4899","#0ea5e9","#f97316","#14b8a6"];
function setStatTab(t){ui.statTab=t;render();}
function monthRange(m){const[y,mo]=m.split("-").map(Number);const last=new Date(y,mo,0).getDate();const p=n=>String(n).padStart(2,"0");return `${y}/${p(mo)}/01 – ${y}/${p(mo)}/${p(last)}`;}
function statCats(recs){
  const by={};
  recs.forEach(r=>{if(r.type!=="expense")return;const m=mainOf(catOf(r.categoryId));if(!m)return;const o=(by[m.id]=by[m.id]||{c:m,v:0,n:0});o.v+=baseAmt(r);o.n++;});
  return Object.values(by).sort((a,b)=>b.v-a.v);
}
function ringDonut(pct,color){
  const r=42.5,C=2*Math.PI*r,on=Math.max(0,Math.min(100,pct))/100*C;
  return `<svg class="sv-donut" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="#e8e8e8" stroke-width="15"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="15"
      stroke-dasharray="${on.toFixed(2)} ${(C-on).toFixed(2)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="800" fill="#182b25">${pct.toFixed(1)}%</text>
  </svg>`;
}
function homeStrip(sel){
  const[y,m,d]=sel.split("-").map(Number);const dt=new Date(y,m-1,d);
  const off=(dt.getDay()===0?6:dt.getDay()-1);
  const mon=new Date(y,m-1,d-off);const today=todayStr();
  const wl=["M","T","W","T","F","S","S"];
  let labels="",cells="";
  for(let i=0;i<7;i++){
    const cd=new Date(mon.getFullYear(),mon.getMonth(),mon.getDate()+i);const ds=dstr(cd);
    labels+=`<div class="hv-wl ${i===6?"sun":""}">${wl[i]}</div>`;
    cells+=`<div class="hv-day ${ds===sel?"sel":""} ${ds===today?"today":""}" onclick="selectDay('${ds}')"><span class="hv-n">${cd.getDate()}</span></div>`;
  }
  return `<div class="hv-wlabels">${labels}</div><div class="hv-strip" id="weekstrip">${cells}</div>`;
}
function homeRow(r){
  let name,icon,amt,amtcls="";
  if(r.type==="transfer"){
    name=r.note||"轉帳";icon=IC("arrow-left-right");amt="−"+fmt(baseAmt(r));
  }else{
    const c=catOf(r.categoryId);
    name=r.note||(c?c.name:"未分類");icon=IC(catIcon(c));
    amt=(r.type==="income"?"+":"−")+fmt(baseAmt(r));
    if(r.type==="income")amtcls="inc";
  }
  const proj=r.projectId?projOf(r.projectId):null;
  const tag=proj?`<span class="hv-ptag">${esc(proj.name)}</span>`:"";
  return `<div class="hv-row" onclick="openAdd('${r.id}')">
    <span class="hv-ic">${icon}</span>
    <span class="hv-name">${esc(name)}</span>
    ${tag}<span class="hv-amt ${amtcls}">${amt}</span></div>`;
}
function spentCompare(mo,dayCutoff){
  const[y,m]=mo.split("-").map(Number);
  const prev=(m===1)?((y-1)+"-12"):(y+"-"+String(m-1).padStart(2,"0"));
  const sum=(mm)=>{let s=0;DB.records.forEach(r=>{if(r.type!=="expense")return;if(r.date.slice(0,7)!==mm)return;if(parseInt(r.date.slice(8,10),10)>dayCutoff)return;s+=baseAmt(r);});return s;};
  const cur=sum(mo),pre=sum(prev);
  if(pre<=0)return null;
  const pct=Math.round((cur-pre)/pre*100);const pm=parseInt(prev.slice(5,7),10);
  const MN=["January","February","March","April","May","June","July","August","September","October","November","December"][pm-1];
  if(pct<0)return{cls:"down",arrow:"↘",text:`${Math.abs(pct)}% less than this time in ${MN}`};
  if(pct>0)return{cls:"up",arrow:"↗",text:`${pct}% more than this time in ${MN}`};
  return{cls:"flat",arrow:"→",text:`same as this time in ${MN}`};
}
function homeSearch(){toast("搜尋功能稍後加入");}
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
    const c=catOf(r.categoryId);
    col=catColor(c);icon=IC(catIcon(c));
    name=c?(c.parent?(mainOf(c).name+"·"+c.name):c.name):"未分類";
    note=r.note||"";
    amt=(r.type==="income"?"+":"−")+fmtCur(r.amount,rc);
    amtcol=r.type==="income"?"var(--income)":"var(--expense)";
    if(proj)pills+=`<span class="pill proj" style="border-color:${hex2b(proj.color)};color:${proj.color}">${esc(proj.name)}</span>`;
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
  document.documentElement.classList.add("fin-full");
  const tab=ui.statTab||"overview";
  const recs=recsInMonth(ui.month);
  const top=`<div class="sv-top">
      <div class="sv-title">Monthly Report</div>
      <div class="sv-icon">${IC("bars")}</div>
    </div>
    <div class="sv-month">
      <button onclick="shiftMonth(-1)" aria-label="上個月">${IC("arrow-left")}</button>
      <span>${monthRange(ui.month)}</span>
      <button onclick="shiftMonth(1)" aria-label="下個月">${IC("arrow-right")}</button>
    </div>
    <div class="sv-tabs">${STAT_TABS.map(([k,t])=>`<button class="${tab===k?"on":""}" onclick="setStatTab('${k}')">${t}</button>`).join("")}</div>`;
  let body;
  if(tab==="detail")body=statDetail(recs);
  else if(tab==="category")body=statCategory(recs);
  else if(tab==="rank")body=statRank(recs);
  else if(tab==="project")body=statProject(recs);
  else if(tab==="name")body=statName(recs);
  else body=statOverview(recs);
  document.getElementById("page-stats").innerHTML=`<div class="statv2">${top}<div class="sv-body">${body}</div></div>`;
}
function statOverview(recs){
  let exp=0,inc=0,expN=0,incN=0;
  recs.forEach(r=>{const v=baseAmt(r);if(r.type==="expense"){exp+=v;expN++;}else if(r.type==="income"){inc+=v;incN++;}});
  const total=inc-exp,maxv=Math.max(exp,inc,Math.abs(total),1);
  const bar=(label,cnt,val,frac,color,sign)=>`<div class="sv-sum">
      <span class="sv-slabel">${label}</span><span class="sv-sbadge">${cnt}</span>
      <div class="sv-sbar"><div style="width:${(frac*100).toFixed(1)}%;background:${color}"></div></div>
      <span class="sv-samt" style="color:${color}">${sign}${fmt(val)}</span></div>`;
  const top3=statCats(recs).slice(0,3);
  const donuts=top3.length
    ?top3.map((x,i)=>`<div class="sv-dcol">${ringDonut(exp>0?x.v/exp*100:0,DONUT_PALETTE[i])}
        <div class="sv-dname">${esc(x.c.name)}</div><div class="sv-damt">${fmt(x.v)}</div></div>`).join("")
    :`<div class="sv-empty">本月尚無支出</div>`;
  return `<div class="sv-sums">
      ${bar("EXP",expN,exp,exp/maxv,"#ff2e01","−")}
      ${bar("INC",incN,inc,inc/maxv,"#47b58e","+")}
      <div class="sv-divider"></div>
      ${bar("TOTAL",expN+incN,Math.abs(total),Math.abs(total)/maxv,total>=0?"#47b58e":"#ff2e01",total>=0?"+":"−")}
    </div>
    <div class="sv-h">Type</div>
    <div class="sv-donuts">${donuts}</div>`;
}
function statDetail(recs){
  if(!recs.length)return `<div class="sv-empty">本月尚無記錄</div>`;
  const sorted=[...recs].sort((a,b)=>b.date<a.date?-1:b.date>a.date?1:(b._t||0)-(a._t||0));
  const groups={};sorted.forEach(r=>{(groups[r.date]=groups[r.date]||[]).push(r);});
  let h="";
  Object.keys(groups).sort().reverse().forEach(d=>{
    const rows=groups[d].map(r=>{
      let nm,cls="",sign="−",ic;
      if(r.type==="transfer"){nm=r.note||"轉帳";ic=IC("arrow-left-right");}
      else{const c=catOf(r.categoryId);nm=r.note||(c?c.name:"未分類");ic=IC(catIcon(c));if(r.type==="income"){sign="+";cls="inc";}}
      const proj=r.projectId?projOf(r.projectId):null;
      const tag=proj?`<span class="sv-ptag">${esc(proj.name)}</span>`:"";
      return `<div class="sv-item" onclick="openAdd('${r.id}')"><span class="sv-ic">${ic}</span><span class="sv-iname">${esc(nm)}</span>${tag}<span class="sv-iamt ${cls}">${sign}${fmt(baseAmt(r))}</span></div>`;
    }).join("");
    h+=`<div class="sv-dhead">${fmtDay(d)}</div>${rows}`;
  });
  return `<div class="sv-list">${h}</div>`;
}
function statCategory(recs){
  const cats=statCats(recs);if(!cats.length)return `<div class="sv-empty">本月尚無支出</div>`;
  const exp=cats.reduce((s,x)=>s+x.v,0);
  const slices=cats.map((x,i)=>({value:x.v,color:DONUT_PALETTE[i%DONUT_PALETTE.length]}));
  const list=cats.map((x,i)=>`<div class="sv-item">
      <span class="sv-dot" style="background:${DONUT_PALETTE[i%DONUT_PALETTE.length]}"></span>
      <span class="sv-iname">${esc(x.c.name)}</span>
      <span class="sv-ipct">${(x.v/exp*100).toFixed(1)}%</span>
      <span class="sv-iamt">${fmt(x.v)}</span></div>`).join("");
  return `<div class="sv-catwrap">${donutSVG(slices,exp)}</div><div class="sv-list">${list}</div>`;
}
function statRank(recs){
  const exp=recs.filter(r=>r.type==="expense").sort((a,b)=>baseAmt(b)-baseAmt(a)).slice(0,30);
  if(!exp.length)return `<div class="sv-empty">本月尚無支出</div>`;
  const list=exp.map((r,i)=>{const c=catOf(r.categoryId);const nm=r.note||(c?c.name:"未分類");
    return `<div class="sv-item" onclick="openAdd('${r.id}')">
      <span class="sv-rank">${i+1}</span>
      <span class="sv-iname">${esc(nm)}</span>
      <span class="sv-idate">${r.date.slice(5).replace("-","/")}</span>
      <span class="sv-iamt">${fmt(baseAmt(r))}</span></div>`;}).join("");
  return `<div class="sv-list">${list}</div>`;
}
function statProject(recs){
  const by={};
  recs.forEach(r=>{if(r.type!=="expense")return;const k=r.projectId||"__none";by[k]=(by[k]||0)+baseAmt(r);});
  const keys=Object.keys(by);if(!keys.length)return `<div class="sv-empty">本月尚無支出</div>`;
  const exp=keys.reduce((s,k)=>s+by[k],0);
  const list=keys.sort((a,b)=>by[b]-by[a]).map((k,i)=>{
    const nm=k==="__none"?"（未歸專案）":((projOf(k)||{}).name||"專案");
    return `<div class="sv-item">
      <span class="sv-dot" style="background:${DONUT_PALETTE[i%DONUT_PALETTE.length]}"></span>
      <span class="sv-iname">${esc(nm)}</span>
      <span class="sv-ipct">${exp>0?(by[k]/exp*100).toFixed(1):0}%</span>
      <span class="sv-iamt">${fmt(by[k])}</span></div>`;}).join("");
  return `<div class="sv-list">${list}</div>`;
}
function statName(recs){
  const by={};
  recs.forEach(r=>{if(r.type!=="expense")return;const nm=(r.note||"").trim()||"（無備註）";const o=(by[nm]=by[nm]||{v:0,n:0});o.v+=baseAmt(r);o.n++;});
  const arr=Object.entries(by).map(([nm,o])=>({nm,v:o.v,n:o.n})).sort((a,b)=>b.v-a.v).slice(0,40);
  if(!arr.length)return `<div class="sv-empty">本月尚無支出</div>`;
  const list=arr.map(x=>`<div class="sv-item">
      <span class="sv-iname">${esc(x.nm)}</span>
      <span class="sv-icnt">${x.n} 筆</span>
      <span class="sv-iamt">${fmt(x.v)}</span></div>`).join("");
  return `<div class="sv-list">${list}</div>`;
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
function projDateRange(pid){
  let mn=null,mx=null;
  DB.records.forEach(r=>{if(r.projectId!==pid||!r.date)return;if(mn===null||r.date<mn)mn=r.date;if(mx===null||r.date>mx)mx=r.date;});
  return mn?{start:mn,end:mx}:null;
}
function fmtRange(dr){
  if(!dr)return "尚無記錄";
  const f=d=>d.replace(/-/g,"/");
  return dr.start===dr.end?f(dr.start):f(dr.start)+" – "+f(dr.end);
}
function projYears(){
  const s=new Set();
  DB.records.forEach(r=>{if(r.projectId&&r.date)s.add(r.date.slice(0,4));});
  return[...s].sort().reverse();
}
function projInYear(pid,y){return DB.records.some(r=>r.projectId===pid&&r.date&&r.date.slice(0,4)===y);}
function setProjView(v){ui.projView=v;render();}
function cycleProjYear(){
  const ys=projYears();if(!ys.length)return;
  const opts=[null,...ys];let i=opts.indexOf(ui.projYear);
  ui.projYear=opts[(i+1)%opts.length];render();
}
function projFilter(q){
  q=(q||"").trim().toLowerCase();
  document.querySelectorAll("#page-projects [data-pname]").forEach(el=>{
    el.style.display=(!q||el.dataset.pname.toLowerCase().indexOf(q)>=0)?"":"none";
  });
}
function toggleProjSearch(){
  const w=document.getElementById("pv-search");if(!w)return;
  const open=w.classList.toggle("show");
  document.querySelector(".pv-circ.search").classList.toggle("on",open);
  const inp=w.querySelector("input");
  if(open){inp.focus();}else{inp.value="";projFilter("");}
}
function renderProjects(){
  const yearLbl=ui.projYear||"全部";
  const top=`<div class="pv-top">
      <div class="pv-title">Projects</div>
      <div class="pv-actions">
        <button class="pv-pill" onclick="cycleProjYear()">${yearLbl} ${IC("chevron-down")}</button>
        <button class="pv-circ search" onclick="toggleProjSearch()" aria-label="搜尋">${IC("search")}</button>
        <button class="pv-circ toggle" onclick="setProjView('${ui.projView==="card"?"list":"card"}')" aria-label="切換檢視">${IC(ui.projView==="card"?"list":"grid")}</button>
      </div>
    </div>
    <div class="pv-search" id="pv-search"><input type="text" placeholder="搜尋專案名稱" oninput="projFilter(this.value)"></div>`;
  if(!DB.projects.length){
    document.getElementById("page-projects").innerHTML=`<div class="projv2">${top}
      <div class="pv-empty"><div class="big">${IC("folder")}</div>還沒有專案<br>用專案把一趟旅遊、一個活動的收支獨立歸在一起追蹤
      <button class="btn ghost" style="margin-top:16px;max-width:220px" onclick="openProjectEdit()">＋ 新增專案</button></div></div>`;
    return;
  }
  let list=DB.projects.map(p=>({p,s:projStats(p.id),dr:projDateRange(p.id)})).sort((a,b)=>b.s.n-a.s.n);
  if(ui.projYear)list=list.filter(x=>projInYear(x.p.id,ui.projYear));
  let body;
  if(ui.projView==="list"){
    const rows=list.map(({p,s,dr})=>`<div class="pv-row" data-pname="${esc(p.name)}" onclick="openProjectDetail('${p.id}')">
        <div class="pv-rinfo"><div class="pv-rname">${esc(p.name)}</div><div class="pv-rdate">${fmtRange(dr)}</div></div>
        <div class="pv-rtotal">${fmt(s.exp)}</div></div>`).join("");
    body=`<div class="pv-list">${rows||`<div class="pv-empty-sm">這一年沒有專案</div>`}</div>`;
  }else{
    if(list.length&&(!ui.projActive||!list.some(x=>x.p.id===ui.projActive)))ui.projActive=list[0].p.id;
    const cards=list.map(({p})=>{
      const active=p.id===ui.projActive,hasImg=!!p.cover;
      const bg=hasImg?`background-image:url('${p.cover}')`:"background-color:var(--card-grey)";
      return `<div class="projcard ${active?"active":"collapsed"} ${hasImg?"img":"plain"}" data-pname="${esc(p.name)}" style="${bg}" onclick="${active?`openProjectDetail('${p.id}')`:`setProjActive('${p.id}')`}">
        ${active?`<button class="pc-cam" onclick="event.stopPropagation();pickCover('${p.id}')" aria-label="更換封面">${IC("image")}</button>`:""}
        <div class="pc-name">${esc(p.name)}</div></div>`;
    }).join("");
    body=`<div class="projwrap">${cards||`<div class="pv-empty-sm">這一年沒有專案</div>`}</div>`;
  }
  document.getElementById("page-projects").innerHTML=`<div class="projv2">${top}
    <div class="pv-body">${body}
      <button class="pv-add" onclick="openProjectEdit()">${IC("plus")} 新增專案</button>
    </div></div>`;
}
function setProjActive(pid){ui.projActive=pid;render();}
function pickCover(pid){
  const inp=document.createElement("input");inp.type="file";inp.accept="image/*";
  inp.onchange=()=>{
    const f=inp.files&&inp.files[0];if(!f)return;
    const img=new Image(),url=URL.createObjectURL(f);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      const max=800;let w=img.width,h=img.height;
      if(w>h){if(w>max){h=Math.round(h*max/w);w=max;}}else{if(h>max){w=Math.round(w*max/h);h=max;}}
      const cv=document.createElement("canvas");cv.width=w;cv.height=h;
      cv.getContext("2d").drawImage(img,0,0,w,h);
      const p=projOf(pid);if(p){p.cover=cv.toDataURL("image/jpeg",0.72);save();render();toast("封面已更新");}
    };
    img.onerror=()=>{URL.revokeObjectURL(url);toast("圖片讀取失敗");};
    img.src=url;
  };
  inp.click();
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
  const el=document.createElement("div");el.className="sheet"+(opts.full?" full":"");
  const header=opts.customHead||`<div class="grab"></div><div class="sheet-h"><button class="x" onclick="closeTopSheet()">取消</button><span class="st">${esc(title)}</span>${opts.del?`<button class="del" onclick="${opts.del}">刪除</button>`:`<span style="width:44px"></span>`}</div>`;
  el.innerHTML=`${header}<div class="sheet-body">${bodyHtml}</div>${opts.footer||""}`;
  document.body.appendChild(el);
  sheetStack.push(el);
  document.getElementById("mask").classList.add("show");
  requestAnimationFrame(()=>el.classList.add("show"));
  return el;
}
function closeTopSheet(){
  const el=sheetStack.pop();if(!el)return;
  el.classList.remove("show");
  if(el.classList.contains("addsheet"))document.documentElement.classList.remove("adding");
  if(!sheetStack.length)document.getElementById("mask").classList.remove("show");
  setTimeout(()=>el.remove(),300);
}
function closeAllSheets(){while(sheetStack.length)closeTopSheet();}

/* =================== add / edit record =================== */
let addState=null;
function nowHM(){const d=new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
function openAdd(editId){
  let r=editId?DB.records.find(x=>x.id===editId):null;
  addState={
    id:r?r.id:null,
    type:r?(r.type==="income"?"income":"expense"):"expense",
    expr:r?String(r.amount):"0",
    cur:r?(r.cur||DB.config.baseCur):DB.config.baseCur,
    rate:r?(r.rate!=null?r.rate:curInfo(r.cur||DB.config.baseCur).rate):1,
    categoryId:r?r.categoryId:null,
    date:r?r.date:todayStr(),
    time:r?(r.time||nowHM()):nowHM(),
    note:r?r.note||"":"",
    projectId:r?(r.projectId||""):"",
    payMode:"once", instN:3, instRate:0,
    catDrill:null, catPicking:!r,
    recurEvery:"month", recurN:12,
    tab:r?(r.type==="income"?"income":"expense"):"suggest",
  };
  const head=`<div class="av-head">
      <button class="av-circ" onclick="closeTopSheet()" aria-label="關閉">${IC("x")}</button>
      <span class="av-title">${r?"Edit Transaction":"Add Transaction"}</span>
      <button class="av-circ ok" onclick="saveRecord()" aria-label="儲存">${IC("check")}</button>
    </div>`;
  const el=openSheet("","",{full:true,customHead:head});
  el.classList.add("addsheet");
  document.documentElement.classList.add("adding");
  el.querySelector(".sheet-body").innerHTML=addBody(!!r);
  const kp=document.createElement("div");kp.className="keypad av-keypad";kp.innerHTML=keypadHtml();
  el.appendChild(kp);
  bindAdd(el);
  renderAddDynamic(el);
  enableSheetDrag(el);
  if(!r)toggleKeypad(true);   // new entry: keypad up for immediate amount input
}
function addBody(editing){
  return `<div class="av-tabs" id="addtabs">
      <button data-t="suggest" class="ico">${IC("heart-o")}</button>
      <button data-t="expense">EXP</button>
      <button data-t="income">INC</button>
    </div>
    <div class="av-div"></div>
    <div id="catarea" class="av-catwrap"></div>
    <div class="av-div"></div>
    <div class="av-amtrow">
      <div class="av-cur">
        <button type="button" class="av-curpill" id="curpill" onclick="toggleCurMenu()">${addState.cur}</button>
        <button type="button" class="av-curadd" onclick="toggleCurMenu()" aria-label="貨幣">${IC("plus")}</button>
        <div class="curmenu" id="curmenu"></div>
      </div>
      <button type="button" class="av-amt" id="amtbtn" onclick="toggleKeypad(true)"><span id="amtnum">0</span></button>
    </div>
    <div id="curarea"></div>
    <div class="av-row">
      <button type="button" class="av-pill" id="datepill" onclick="openDatePicker()"></button>
      <button type="button" class="av-pill" id="timepill" onclick="openTimePicker()"></button>
    </div>
    <div class="av-row">
      <button type="button" class="av-pill" id="projpill" onclick="openProjPicker()"></button>
      <button type="button" class="av-pill" id="recurpill" onclick="openRecurPicker()"></button>
    </div>
    <textarea class="av-note" id="f_note" placeholder="NOTE" rows="4" onfocus="toggleKeypad(false)">${esc(addState.note)}</textarea>
    ${editing?`<button class="av-delete" onclick="deleteRecord()">DELETE</button>`:""}`;
}
function suggestedCats(){
  // most-used SUB categories, ranked by frequency
  const cnt={};DB.records.forEach(r=>{if(r.categoryId)cnt[r.categoryId]=(cnt[r.categoryId]||0)+1;});
  let arr=Object.keys(cnt).map(id=>({id,n:cnt[id],c:catOf(id)})).filter(x=>x.c&&x.c.parent).sort((a,b)=>b.n-a.n).slice(0,15);
  const have=new Set(arr.map(x=>x.id));
  if(arr.length<10){outer:for(const m of mainCats("expense")){for(const s of subCats(m.id)){if(!have.has(s.id)){arr.push({c:s});have.add(s.id);}if(arr.length>=10)break outer;}}}
  return arr.map(x=>x.c);
}
function keypadHtml(){
  return `<button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button data-k="back">⌫</button>
  <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="op" data-k="+">＋</button>
  <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="-">－</button>
  <button data-k=".">.</button><button data-k="0">0</button><button data-k="00">00</button><button class="done" data-k="done">完成</button>`;
}
function bindAdd(el){
  el.querySelector("#addtabs").onclick=(e)=>{
    const b=e.target.closest("button[data-t]");if(!b)return;
    addState.tab=b.dataset.t;addState.catDrill=null;addState.catPicking=true;
    if(addState.tab==="expense"||addState.tab==="income"){
      addState.type=addState.tab;
      const c=catOf(addState.categoryId);
      if(!c||c.type!==addState.type)addState.categoryId=null;
    }else if(addState.tab==="suggest"){addState.type="expense";}
    renderAddDynamic(el);
  };
  el.querySelector(".keypad").onclick=(e)=>{
    const b=e.target.closest("button[data-k]");if(!b)return;
    const k=b.dataset.k;
    if(k==="done"){toggleKeypad(false);return;}
    keyPress(k);updateAmtDisplay(el);
  };
  const fn=el.querySelector("#f_note");if(fn)fn.oninput=e=>addState.note=e.target.value;
}
function toggleKeypad(show){
  const kp=document.querySelector(".av-keypad");if(!kp)return;
  if(show===undefined)kp.classList.toggle("show");else kp.classList.toggle("show",!!show);
  const on=kp.classList.contains("show");
  if(kp.parentElement)kp.parentElement.classList.toggle("kpopen",on);
  const amt=document.getElementById("amtbtn");if(amt)amt.classList.toggle("on",on);
}
/* drag the header down to dismiss the add sheet */
function enableSheetDrag(el){
  const head=el.querySelector(".av-head");if(!head)return;
  let startY=0,dy=0,dragging=false;
  head.addEventListener("touchstart",e=>{if(e.target.closest("button"))return;startY=e.touches[0].clientY;dragging=true;dy=0;el.style.transition="none";},{passive:true});
  head.addEventListener("touchmove",e=>{if(!dragging)return;dy=e.touches[0].clientY-startY;if(dy<0)dy=0;el.style.transform="translateY("+dy+"px)";if(dy>0&&e.cancelable)e.preventDefault();},{passive:false});
  const end=()=>{if(!dragging)return;dragging=false;el.style.transition="";if(dy>110){el.style.transform="translateY(100%)";setTimeout(closeTopSheet,0);}else{el.style.transform="";}};
  head.addEventListener("touchend",end);head.addEventListener("touchcancel",end);
}
/* ---------- frosted popups for the add sheet (date / time / project / payment) ---------- */
function openAvPopup(html){
  closeAvPopup();
  const ov=document.createElement("div");ov.className="av-pop-ov";ov.id="avpop";
  ov.innerHTML=`<div class="av-pop">${html}</div>`;
  ov.addEventListener("click",e=>{if(e.target===ov)closeAvPopup();});
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add("show"));
  return ov;
}
function closeAvPopup(){const ov=document.getElementById("avpop");if(ov){ov.classList.remove("show");setTimeout(()=>ov.remove(),180);}}
function avpopBody(){const ov=document.getElementById("avpop");return ov?ov.querySelector(".av-pop"):null;}
function refreshAddSheet(){const el=sheetStack[sheetStack.length-1];if(el)updateAddPills(el);}
function shiftYM(ym,d){let[y,m]=ym.split("-").map(Number);m+=d;if(m<1){m=12;y--;}if(m>12){m=1;y++;}return y+"-"+String(m).padStart(2,"0");}
function addMonthsStr(ds,k){let[y,m,d]=ds.split("-").map(Number);m+=k;while(m>12){m-=12;y++;}const last=new Date(y,m,0).getDate();return y+"-"+String(m).padStart(2,"0")+"-"+String(Math.min(d,last)).padStart(2,"0");}
function addEveryStr(ds,every,k){let[y,m,d]=ds.split("-").map(Number);
  if(every==="day")return dstr(new Date(y,m-1,d+k));
  if(every==="week")return dstr(new Date(y,m-1,d+7*k));
  if(every==="year")return dstr(new Date(y+k,m-1,d));
  return addMonthsStr(ds,k);
}
/* date picker — month calendar */
let _dpYM="";
function openDatePicker(){_dpYM=addState.date.slice(0,7);openAvPopup(datePopupHtml());}
function datePrevMonth(){_dpYM=shiftYM(_dpYM,-1);const b=avpopBody();if(b)b.innerHTML=datePopupHtml();}
function dateNextMonth(){_dpYM=shiftYM(_dpYM,1);const b=avpopBody();if(b)b.innerHTML=datePopupHtml();}
function pickDate(ds){addState.date=ds;refreshAddSheet();closeAvPopup();}
function datePopupHtml(){
  const[y,m]=_dpYM.split("-").map(Number);
  const off=(new Date(y,m-1,1).getDay()===0?6:new Date(y,m-1,1).getDay()-1);
  const days=new Date(y,m,0).getDate();const today=todayStr();
  let cells=["一","二","三","四","五","六","日"].map(w=>`<div class="dp-w">${w}</div>`).join("");
  for(let i=0;i<off;i++)cells+=`<div></div>`;
  for(let d=1;d<=days;d++){const ds=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    cells+=`<button class="dp-d ${ds===addState.date?"on":""} ${ds===today?"today":""}" onclick="pickDate('${ds}')">${d}</button>`;}
  return `<div class="avp-h"><button class="avp-nav" onclick="datePrevMonth()">${IC("arrow-left")}</button><span>${y} / ${m}</span><button class="avp-nav" onclick="dateNextMonth()">${IC("arrow-right")}</button></div><div class="dp-grid">${cells}</div>`;
}
/* time picker — hour + minute columns */
let _tp={h:0,m:0};
function openTimePicker(){const[h,mi]=addState.time.split(":").map(Number);_tp={h:h||0,m:mi||0};openAvPopup(timePopupHtml());setTimeout(()=>{scrollTimeCol("tp-h",_tp.h);scrollTimeCol("tp-m",_tp.m);},30);}
function timePopupHtml(){
  let hh="",mm="";
  for(let i=0;i<24;i++)hh+=`<div class="tp-i ${i===_tp.h?"on":""}" data-h="${i}">${String(i).padStart(2,"0")}</div>`;
  for(let i=0;i<60;i++)mm+=`<div class="tp-i ${i===_tp.m?"on":""}" data-m="${i}">${String(i).padStart(2,"0")}</div>`;
  return `<div class="avp-title">選擇時間</div><div class="tp-cols"><div class="tp-col" id="tp-h" onclick="tpPick(event,'h')">${hh}</div><div class="tp-sep">:</div><div class="tp-col" id="tp-m" onclick="tpPick(event,'m')">${mm}</div></div><button class="avp-confirm" onclick="confirmTime()">確認</button>`;
}
function scrollTimeCol(id,idx){const c=document.getElementById(id);if(!c)return;const el=c.children[idx];if(el)c.scrollTop=el.offsetTop-c.clientHeight/2+el.clientHeight/2;}
function tpPick(e,which){const t=e.target.closest("[data-"+which+"]");if(!t)return;const v=+t.dataset[which];_tp[which]=v;const c=t.parentElement;c.querySelectorAll(".tp-i").forEach(x=>x.classList.toggle("on",x===t));scrollTimeCol(c.id,v);}
function confirmTime(){addState.time=String(_tp.h).padStart(2,"0")+":"+String(_tp.m).padStart(2,"0");refreshAddSheet();closeAvPopup();}
/* project picker */
function openProjPicker(){
  const rows=`<button class="pp-i ${!addState.projectId?"on":""}" onclick="pickProj('')">（無專案）</button>`+
    DB.projects.map(p=>`<button class="pp-i ${addState.projectId===p.id?"on":""}" onclick="pickProj('${p.id}')">${esc(p.name)}</button>`).join("");
  openAvPopup(`<div class="avp-title">選擇專案</div><div class="pp-list">${rows}</div>`);
}
function pickProj(id){addState.projectId=id;refreshAddSheet();closeAvPopup();}
/* payment type picker — one-time / installment / recurring */
function openRecurPicker(){openAvPopup(recurPopupHtml());}
function setPayMode(m){addState.payMode=m;const b=avpopBody();if(b)b.innerHTML=recurPopupHtml();}
function setRecurEvery(v){addState.recurEvery=v;const b=avpopBody();if(b)b.innerHTML=recurPopupHtml();}
function recurAdj(field,delta,min,max){addState[field]=Math.max(min,Math.min(max,(addState[field]||0)+delta));const b=avpopBody();if(b)b.innerHTML=recurPopupHtml();}
function confirmRecurPicker(){refreshAddSheet();closeAvPopup();}
function recurPopupHtml(){
  const amt=Math.round(evalExpr(addState.expr)*100)/100;
  const seg=[["once","一次"],["installment","分期"],["recurring","週期"]].map(([k,t])=>`<button class="rp-seg ${addState.payMode===k?"on":""}" onclick="setPayMode('${k}')">${t}</button>`).join("");
  let body;
  if(addState.payMode==="installment"){
    const total=Math.round(amt*(1+addState.instRate/100)*100)/100, per=Math.round(total/addState.instN*100)/100;
    body=`<div class="rp-row"><span>期數</span><div class="rp-step"><button onclick="recurAdj('instN',-1,2,60)">−</button><b>${addState.instN}</b><button onclick="recurAdj('instN',1,2,60)">＋</button></div></div>
      <div class="rp-row"><span>利率 %</span><div class="rp-step"><button onclick="recurAdj('instRate',-1,0,99)">−</button><b>${addState.instRate}</b><button onclick="recurAdj('instRate',1,0,99)">＋</button></div></div>
      <div class="rp-calc">總額 ${fmt(total)}　每期 <b>${fmt(per)}</b> × ${addState.instN} 個月</div>`;
  }else if(addState.payMode==="recurring"){
    const ev=EVERY_OPTS.map(([k,t])=>`<button class="rp-ev ${addState.recurEvery===k?"on":""}" onclick="setRecurEvery('${k}')">${t}</button>`).join("");
    body=`<div class="rp-evs">${ev}</div>
      <div class="rp-row"><span>次數</span><div class="rp-step"><button onclick="recurAdj('recurN',-1,2,120)">−</button><b>${addState.recurN}</b><button onclick="recurAdj('recurN',1,2,120)">＋</button></div></div>
      <div class="rp-calc">從 ${addState.date.replace(/-/g,"/")} 起,${everyLabel(addState.recurEvery)}一筆 ${fmt(amt)},共 ${addState.recurN} 筆</div>`;
  }else{
    body=`<div class="rp-calc">單次消費。</div>`;
  }
  return `<div class="avp-title">消費類型</div><div class="rp-segs">${seg}</div>${body}<button class="avp-confirm" onclick="confirmRecurPicker()">確認</button>`;
}
function dateLabel(ds){
  if(ds===todayStr())return "TODAY ( "+["SUN","MON","TUE","WED","THU","FRI","SAT"][new Date(ds+"T00:00").getDay()]+" )";
  const[y,m,d]=ds.split("-");return y+"/"+m+"/"+d;
}
function updateAddPills(el){
  if(!el)return;
  const chev=`<span class="pilchev">${IC("chevron-down")}</span>`;
  const set=(id,txt,on)=>{const e=el.querySelector(id);if(!e)return;e.innerHTML=`<span class="piltxt">${esc(txt)}</span>`+chev;if(on!==undefined)e.classList.toggle("set",on);};
  set("#datepill",dateLabel(addState.date));
  set("#timepill",addState.time);
  const p=addState.projectId?projOf(addState.projectId):null;
  set("#projpill",p?p.name:"PROJECT",!!p);
  set("#recurpill",payModeLabel(),addState.payMode!=="once");
}
const EVERY_OPTS=[["day","每日"],["week","每週"],["month","每月"],["year","每年"]];
function everyLabel(v){const o=EVERY_OPTS.find(x=>x[0]===v);return o?o[1]:"每月";}
function payModeLabel(){
  if(addState.payMode==="installment")return "分期 ×"+addState.instN;
  if(addState.payMode==="recurring")return everyLabel(addState.recurEvery)+" ×"+addState.recurN;
  return "ONE-TIME";
}
function catTile(c){
  const col=catColor(c)||"#cfcfcf";
  return `<button type="button" class="av-cat" data-cid="${c.id}" title="${esc(c.name)}"><span class="av-tile" style="background:${col}">${IC(catIcon(c))}</span><span class="av-lbl">${esc(catLabel(c))}</span></button>`;
}
function reopenCat(){addState.catPicking=true;addState.catDrill=null;const el=sheetStack[sheetStack.length-1];if(el)renderAddCats(el);}
function renderAddCats(el){
  const area=el.querySelector("#catarea");
  const sel=addState.categoryId?catOf(addState.categoryId):null;
  if(!addState.catPicking&&sel){   // collapsed: show the single selected category, one row
    const m=mainOf(sel),col=catColor(sel)||"#cfcfcf";
    area.style.maxHeight="";
    area.innerHTML=`<button type="button" class="av-selbox" onclick="reopenCat()"><span class="av-tile" style="background:${col}">${IC(catIcon(sel))}</span><span class="av-selname">${esc(catLabel(m))}${m&&m!==sel?' › '+esc(catLabel(sel)):''}</span><span class="pilchev">${IC("chevron-down")}</span></button>`;
    return;
  }
  let items,back=null;
  if(addState.tab==="suggest"){items=suggestedCats();}
  else if(addState.catDrill){items=subCats(addState.catDrill);back=catOf(addState.catDrill);}
  else{items=mainCats(addState.type);}
  let h=`<div class="av-grid ${back?"drilled":""}" id="avgrid">`;
  if(back){const bc=catColor(back)||"#cfcfcf";h+=`<button type="button" class="av-cat av-back" data-back="1"><span class="av-tile" style="background:${bc}">${IC("arrow-left")}</span><span class="av-lbl">${esc(catLabel(back))}</span></button>`;}
  h+=items.map(catTile).join("")+`</div>`;
  area.innerHTML=h;
  requestAnimationFrame(()=>{const f=area.querySelector(".av-cat");if(f)area.style.maxHeight=(f.offsetHeight*2+6)+"px";});
  area.querySelector("#avgrid").onclick=e=>{
    if(e.target.closest("[data-back]")){addState.catDrill=null;renderAddCats(el);return;}
    const b=e.target.closest("[data-cid]");if(!b)return;const cat=catOf(b.dataset.cid);if(!cat)return;
    if(!cat.parent){ // main: drill into subs, or select directly if it has none
      const subs=subCats(cat.id);
      if(subs.length){addState.catDrill=cat.id;addState.type=cat.type;renderAddCats(el);return;}
      addState.categoryId=cat.id;addState.type=cat.type;
    }else{addState.categoryId=cat.id;addState.type=mainOf(cat).type;}
    addState.catPicking=false;renderAddCats(el);   // collapse to the selected one
  };
}
function renderAddDynamic(el){
  el.querySelectorAll("#addtabs button").forEach(b=>b.classList.toggle("on",b.dataset.t===addState.tab));
  renderCurArea(el);
  updateAmtDisplay(el);
  renderAddCats(el);
  updateAddPills(el);
}
let _curMenuCloser=null;
function toggleCurMenu(){
  const m=document.getElementById("curmenu");if(!m)return;
  if(m.classList.contains("show")){closeCurMenu();return;}
  m.innerHTML=(DB.config.currencies||[]).map(c=>`<div class="curopt ${c.code===addState.cur?"on":""}" onclick="pickCur('${c.code}')">${c.code}<span>${esc(c.symbol)}</span></div>`).join("");
  m.classList.add("show");
  setTimeout(()=>{_curMenuCloser=(e)=>{if(!e.target.closest("#curpill")&&!e.target.closest("#curmenu"))closeCurMenu();};document.addEventListener("click",_curMenuCloser);},0);
}
function closeCurMenu(){const m=document.getElementById("curmenu");if(m)m.classList.remove("show");if(_curMenuCloser){document.removeEventListener("click",_curMenuCloser);_curMenuCloser=null;}}
function pickCur(code){
  addState.cur=code;addState.rate=curInfo(code).rate;
  closeCurMenu();
  const pill=document.getElementById("curpill");if(pill)pill.textContent=code;
  const el=sheetStack[sheetStack.length-1];renderCurArea(el);updateAmtDisplay(el);
}
function renderCurArea(el){
  const area=el.querySelector("#curarea");if(!area)return;
  if(!isForeign(addState.cur)){area.innerHTML="";return;}
  area.innerHTML=`<div class="fieldrow" style="margin:0 0 4px">
      <div class="field" style="margin:0"><label>匯率 1 ${addState.cur} = ? ${baseSym()}</label><input id="f_rate" type="number" inputmode="decimal" value="${addState.rate}"></div>
      <div class="field" style="margin:0"><label>約合 ${baseSym()}</label><div style="padding:11px 2px;font-weight:700" id="basePrev">${fmt(evalExpr(addState.expr)*(addState.rate||0))}</div></div></div>`;
  const fr=area.querySelector("#f_rate");if(fr)fr.oninput=e=>{addState.rate=parseFloat(e.target.value)||0;const bp=area.querySelector("#basePrev");if(bp)bp.textContent=fmt(evalExpr(addState.expr)*(addState.rate||0));};
}
function updateAmtDisplay(el){
  const sym=(curInfo(addState.cur)||{}).symbol||"$";
  el.querySelector("#amtnum").textContent=sym+dispExpr();
  const bp=el.querySelector("#basePrev");if(bp)bp.textContent=fmt(evalExpr(addState.expr)*(addState.rate||0));
}

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
  if(!addState.categoryId){toast("請選擇分類");return;}
  const rate=(addState.cur===DB.config.baseCur)?1:(addState.rate||curInfo(addState.cur).rate||1);
  const mk=over=>{const o=Object.assign({id:uid(),type:addState.type,amount:amt,date:addState.date,time:addState.time,
    note:addState.note.trim(),cur:addState.cur,rate:rate,categoryId:addState.categoryId,_t:Date.now()},over);
    if(addState.projectId)o.projectId=addState.projectId;return o;};
  if(!addState.id&&addState.payMode==="installment"){
    const N=addState.instN,total=amt*(1+addState.instRate/100),per=Math.round(total/N*100)/100,gid=uid();
    const base=addState.note.trim()||((catOf(addState.categoryId)||{}).name||"");
    for(let k=0;k<N;k++)DB.records.push(mk({id:uid(),amount:per,date:addMonthsStr(addState.date,k),note:base+" ("+(k+1)+"/"+N+")",instGroup:gid,_t:Date.now()+k}));
    toast("分 "+N+" 期已建立");
  }else if(!addState.id&&addState.payMode==="recurring"){
    const N=addState.recurN,gid=uid();
    for(let k=0;k<N;k++)DB.records.push(mk({id:uid(),date:addEveryStr(addState.date,addState.recurEvery,k),recurGroup:gid,_t:Date.now()+k}));
    toast(everyLabel(addState.recurEvery)+" × "+N+" 筆已建立");
  }else{
    let r=addState.id?DB.records.find(x=>x.id===addState.id):null;
    if(r){const o=mk({id:r.id,_t:r._t});delete r.accountId;delete r.toAccountId;delete r.tags;delete r.recur;
      Object.keys(o).forEach(k=>r[k]=o[k]);if(!addState.projectId)delete r.projectId;}
    else DB.records.push(mk({}));
    toast(addState.id?"已更新":"已記錄");
  }
  save();closeTopSheet();render();
}
function applyRecurring(){return false;}
function deleteRecord(){
  if(!addState||!addState.id)return;
  DB.records=DB.records.filter(x=>x.id!==addState.id);
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
