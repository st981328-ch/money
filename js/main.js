"use strict";
/* toast + bootstrap */
/* =================== toast =================== */
let _toastT=null;
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(_toastT);_toastT=setTimeout(()=>t.classList.remove("show"),1800);}

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
