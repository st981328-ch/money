"use strict";
/* cloud sync (GitHub Gist) */
/* =================== cloud sync (GitHub Gist) =================== */
const SYNC_POLL_MS=15000;
let _localDirty=false,_syncing=false,_pushTimer=null,_pollTimer=null;
function pat(){return localStorage.getItem("tally_sync_pat")||"";}
function gistId(){return localStorage.getItem("tally_sync_gist_id")||"";}
function syncBase(){return +localStorage.getItem("tally_sync_base")||0;}
function syncOn(){return !!pat();}
function isBusyEditing(){
  if(sheetStack.length)return true;
  const a=document.activeElement;if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return true;
  return false;
}
async function ghFetch(url,opts){
  opts=opts||{};opts.headers=Object.assign({"Authorization":"Bearer "+pat(),"Accept":"application/vnd.github+json"},opts.headers||{});
  return fetch(url,opts);
}
function schedulePush(){if(!syncOn())return;clearTimeout(_pushTimer);_pushTimer=setTimeout(()=>syncPush({auto:true}),2500);}
async function findOrCreateGist(){
  let gid=gistId();if(gid)return gid;
  let r=await ghFetch("https://api.github.com/gists?per_page=100");
  if(r.ok){const list=await r.json();const found=list.find(g=>g.description===SYNC_DESC||g.description===SYNC_DESC_OLD||(g.files&&(g.files[SYNC_FILE]||g.files[SYNC_FILE_OLD])));if(found){localStorage.setItem("tally_sync_gist_id",found.id);return found.id;}}
  // create
  let cr=await ghFetch("https://api.github.com/gists",{method:"POST",body:JSON.stringify({description:SYNC_DESC,public:false,files:{[SYNC_FILE]:{content:JSON.stringify(DB)}}})});
  if(!cr.ok)throw new Error("建立 Gist 失敗");
  const g=await cr.json();localStorage.setItem("tally_sync_gist_id",g.id);return g.id;
}
async function syncPush(opts){
  opts=opts||{};if(!syncOn()||_syncing)return;
  _syncing=true;let _hasOld=false;
  try{
    const gid=await findOrCreateGist();
    // conflict check
    let rr=await ghFetch("https://api.github.com/gists/"+gid);
    if(rr.ok){const g=await rr.json();const f=g.files&&(g.files[SYNC_FILE]||g.files[SYNC_FILE_OLD]);_hasOld=!!(g.files&&g.files[SYNC_FILE_OLD]);
      if(f){let remote={};try{remote=JSON.parse(f.content);}catch(e){}
        if(remote._exportedAt&&remote._exportedAt!==syncBase()&&remote._exportedAt>DB._exportedAt){
          if(opts.auto){toast("雲端有較新資料，請先拉取");_syncing=false;return;}
          if(!confirm("雲端有較新的版本，直接上傳會覆蓋它。確定？")){_syncing=false;return;}
        }
      }
    }
    let files={[SYNC_FILE]:{content:JSON.stringify(DB)}};
    if(_hasOld)files[SYNC_FILE_OLD]=null; // remove legacy file after migrating
    let pr=await ghFetch("https://api.github.com/gists/"+gid,{method:"PATCH",body:JSON.stringify({description:SYNC_DESC,files:files})});
    if(pr.ok){localStorage.setItem("tally_sync_base",String(DB._exportedAt));_localDirty=false;if(!opts.silent)toast("已同步到雲端");updateSyncUI();}
    else toast("上傳失敗 ("+pr.status+")");
  }catch(e){toast("同步錯誤："+e.message);}
  _syncing=false;
}
async function syncPull(opts){
  opts=opts||{};if(!syncOn()||_syncing)return;
  try{
    const gid=await findOrCreateGist();
    let r=await ghFetch("https://api.github.com/gists/"+gid);if(!r.ok)return;
    const g=await r.json();const f=g.files&&(g.files[SYNC_FILE]||g.files[SYNC_FILE_OLD]);if(!f)return;
    let remote={};try{remote=JSON.parse(f.content);}catch(e){return;}
    if(!remote._exportedAt)return;
    if(remote._exportedAt===syncBase())return; // nothing new
    if(remote._exportedAt<=DB._exportedAt&&!opts.force)return;
    if(opts.background&&(_localDirty||_syncing||isBusyEditing()))return;
    DB=remote;DB.config=Object.assign({currency:"$",theme:"auto",accent:"#5b6cff"},DB.config||{});
    localStorage.setItem(STORE_KEY,JSON.stringify(DB));
    localStorage.setItem("tally_sync_base",String(DB._exportedAt));
    _localDirty=false;applyTheme();render();updateSyncUI();
    if(!opts.silent)toast("已從雲端更新");
  }catch(e){if(!opts.background)toast("拉取錯誤："+e.message);}
}
function openSync(){
  const on=syncOn();
  let body;
  if(!on){
    body=`<div class="hint">在每台裝置貼上同一組 GitHub Token（需 <b>gist</b> 權限），資料就會存進你 GitHub 帳號下的一個私密 Gist，手機和電腦共用同一份。Token 只存在這台瀏覽器，不會外流。</div>
    <div class="field" style="margin-top:12px"><label>GitHub Personal Access Token</label><input id="sy_pat" placeholder="ghp_..." autocomplete="off"></div>
    <button class="btn" onclick="enableSync()">啟用雲端同步</button>
    <div class="hint" style="margin-top:14px">取得方式：GitHub → Settings → Developer settings → Personal access tokens → 勾選 <b>gist</b> 權限。</div>`;
  }else{
    const last=syncBase()?new Date(syncBase()).toLocaleString("zh-TW"):"尚未";
    body=`<div class="hint">雲端同步已啟用。上次同步：${last}</div>
    <button class="btn" onclick="syncPush({})">⬆️ 立即上傳</button>
    <button class="btn ghost" style="margin-top:10px" onclick="syncPull({force:true})">⬇️ 從雲端拉取</button>
    <button class="btn danger sm" style="margin-top:14px" onclick="disableSync()">停用同步（清除本機 Token）</button>`;
  }
  openSheet("雲端同步",body);
}
function enableSync(){
  const el=sheetStack[sheetStack.length-1];const v=el.querySelector("#sy_pat").value.trim();
  if(!v){toast("請貼上 Token");return;}
  localStorage.setItem("tally_sync_pat",v);
  closeTopSheet();toast("連線中…");
  (async()=>{try{
    const gid=await findOrCreateGist();
    let r=await ghFetch("https://api.github.com/gists/"+gid);const g=await r.json();const f=g.files&&(g.files[SYNC_FILE]||g.files[SYNC_FILE_OLD]);
    let remote=null;if(f){try{remote=JSON.parse(f.content);}catch(e){}}
    if(remote&&remote.records&&(remote.records.length||!DB.records.length)&&remote._exportedAt){
      if(confirm("雲端已有資料，要用雲端資料覆蓋本機嗎？\n（選取消＝改用本機資料上傳覆蓋雲端）")){await syncPull({force:true,silent:true});toast("已套用雲端資料");}
      else{await syncPush({silent:true});toast("已上傳本機資料");}
    }else{await syncPush({silent:true});toast("雲端同步已啟用");}
    startPoll();renderSettings();
  }catch(e){toast("啟用失敗："+e.message);localStorage.removeItem("tally_sync_pat");}})();
}
function disableSync(){
  if(!confirm("停用後這台裝置不再同步（雲端資料保留）。確定？"))return;
  localStorage.removeItem("tally_sync_pat");localStorage.removeItem("tally_sync_gist_id");localStorage.removeItem("tally_sync_base");
  clearInterval(_pollTimer);closeTopSheet();render();toast("已停用同步");
}
function updateSyncUI(){if(ui.page==="settings")renderSettings();}
function startPoll(){clearInterval(_pollTimer);if(!syncOn())return;_pollTimer=setInterval(()=>{if(document.visibilityState==="visible")syncPull({background:true,silent:true});},SYNC_POLL_MS);}
