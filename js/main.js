"use strict";
/* toast + haptics + feedback + bootstrap */
/* =================== motion / haptics =================== */
let _rMotion=false;try{_rMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){}
/* progressive enhancement: vibrates on Android; silently a no-op on iOS (no Web Vibration API) */
const _HAPT={tap:8,soft:4,ok:[0,16,30,22],warn:[0,34,48,34],heavy:22};
function haptic(type){try{if(navigator.vibrate)navigator.vibrate(_HAPT[type]||8);}catch(e){}}

/* =================== toast =================== */
let _toastT=null;
function toast(msg,type){
  const t=document.getElementById("toast");
  t.classList.remove("show");
  t.className="toast "+(type||"");
  void t.offsetWidth;                 // restart the transition even if one is on screen
  t.textContent=msg;
  t.classList.add("show");
  if(type==="warn")haptic("warn");
  clearTimeout(_toastT);_toastT=setTimeout(()=>t.classList.remove("show"),type==="warn"?2100:1800);
}

/* =================== signature confirmation burst (used after a record is saved) =================== */
function celebrate(){
  haptic("ok");
  if(_rMotion)return;
  const c=document.createElement("div");c.className="burst";
  c.innerHTML='<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23"/><path d="M15 27l8 8 15-16"/></svg>';
  document.body.appendChild(c);
  setTimeout(()=>c.remove(),780);
}

/* =================== init =================== */
applyTheme();
document.querySelectorAll("[data-ic]").forEach(e=>{e.innerHTML=IC(e.dataset.ic);});
if(applyRecurring())save(true);
go("records");
if(syncOn()){syncPull({force:true,silent:true});startPoll();}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&syncOn())syncPull({background:true,silent:true});});
window.addEventListener("focus",()=>{if(syncOn())syncPull({background:true,silent:true});});
// prevent double-tap zoom on buttons
document.addEventListener("dblclick",e=>e.preventDefault(),{passive:false});
