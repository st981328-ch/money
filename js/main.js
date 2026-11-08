"use strict";
/* toast + haptics + feedback + bootstrap */
/* =================== motion / haptics =================== */
let _rMotion=false;try{_rMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){}
/* =================== lock zoom (iOS Safari ignores user-scalable=no / maximum-scale) =================== */
(function lockZoom(){
  // pinch-zoom: iOS Safari-specific gesture events
  ["gesturestart","gesturechange","gestureend"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
  // double-tap-to-zoom: block only the 2nd of two quick taps at the same spot (nothing in the app uses double-tap)
  let lt=0,lx=0,ly=0;
  document.addEventListener("touchend",e=>{
    const t=e.changedTouches[0];if(!t)return;const now=Date.now();
    if(now-lt<=320&&Math.abs(t.clientX-lx)<42&&Math.abs(t.clientY-ly)<42)e.preventDefault();
    lt=now;lx=t.clientX;ly=t.clientY;
  },{passive:false});
})();
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
seedCatColors();
applyTheme();
document.querySelectorAll("[data-ic]").forEach(e=>{e.innerHTML=IC(e.dataset.ic);});
if(applyRecurring())save(true);
go("records");
if(syncOn()){syncPull({force:true,silent:true});startPoll();}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&syncOn())syncPull({background:true,silent:true});});
window.addEventListener("focus",()=>{if(syncOn())syncPull({background:true,silent:true});});
// prevent double-tap zoom on buttons
document.addEventListener("dblclick",e=>e.preventDefault(),{passive:false});

/* auto-update: when a strictly-newer version is deployed, reload on return so the
   running code isn't stale. Never reloads mid-interaction (crop / hero / sheet /
   add open), and never downgrades to a momentarily-stale CDN copy. */
(function(){
  let busy=false;
  const overlayOpen=()=>!!(document.getElementById("cropOv")||document.getElementById("phero")||(typeof sheetStack!=="undefined"&&sheetStack.length)||document.documentElement.classList.contains("adding"));
  async function chk(){
    if(busy||overlayOpen())return;busy=true;
    try{
      const run=(document.querySelector('script[src*="app.js"]')||{}).src||"";
      const cur=(run.match(/[?&]v=([\w.-]+)/)||[])[1]||"";
      const res=await fetch("index.html?cb="+Date.now(),{cache:"no-store"});
      const dep=((await res.text()).match(/app\.js\?v=([\w.-]+)/)||[])[1]||"";
      if(dep&&cur&&dep>cur&&!overlayOpen()&&sessionStorage.getItem("_tv")!==dep){sessionStorage.setItem("_tv",dep);location.reload();return;}
    }catch(e){}
    busy=false;
  }
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")chk();});
})();
