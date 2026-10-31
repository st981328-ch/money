"use strict";
/* data layer: storage, model, helpers */
/* one-time lossless migration from the app's earlier storage keys */
(function(){try{var km=[["moze_data","tally_data"],["moze_sync_pat","tally_sync_pat"],["moze_sync_gist_id","tally_sync_gist_id"],["moze_sync_base","tally_sync_base"]];for(var i=0;i<km.length;i++){var o=km[i][0],n=km[i][1];if(localStorage.getItem(n)===null&&localStorage.getItem(o)!==null)localStorage.setItem(n,localStorage.getItem(o));}}catch(e){}})();
const APP_VERSION="2026.10.26-bd";
const STORE_KEY="tally_data";
const SYNC_DESC="Tally Sync — do not delete";
const SYNC_FILE="tally_data.json";
const SYNC_DESC_OLD="MozeClone Sync — do not delete";
const SYNC_FILE_OLD="moze_data.json";
const DEFAULT_CURRENCIES=[
  {code:"TWD",symbol:"$",rate:1},
  {code:"HKD",symbol:"HK$",rate:4.1},
  {code:"JPY",symbol:"¥",rate:0.22},
  {code:"USD",symbol:"US$",rate:31},
];

const DEFAULT_ACCOUNTS=[
  {id:"a_cash",name:"現金",type:"cash",init:0,icon:"banknote",color:"#30a46c"},
  {id:"a_bank",name:"銀行帳戶",type:"bank",init:0,icon:"landmark",color:"#5b6cff"},
  {id:"a_card",name:"信用卡",type:"credit",init:0,icon:"credit-card",color:"#e5484d"},
];
const DEFAULT_CATS=[
  // expense
  {id:"c_food",name:"餐飲",type:"expense",icon:"utensils",color:"#f59e0b"},
  {id:"c_daily",name:"日用品",type:"expense",icon:"package",color:"#06b6d4"},
  {id:"c_traffic",name:"交通",type:"expense",icon:"car",color:"#3b82f6"},
  {id:"c_shop",name:"購物",type:"expense",icon:"shopping-bag",color:"#ec4899"},
  {id:"c_fun",name:"娛樂",type:"expense",icon:"gamepad-2",color:"#8b5cf6"},
  {id:"c_home",name:"居家",type:"expense",icon:"house",color:"#14b8a6"},
  {id:"c_med",name:"醫療",type:"expense",icon:"pill",color:"#ef4444"},
  {id:"c_edu",name:"教育",type:"expense",icon:"graduation-cap",color:"#6366f1"},
  {id:"c_cloth",name:"服飾",type:"expense",icon:"shopping-bag",color:"#f43f5e"},
  {id:"c_comm",name:"通訊",type:"expense",icon:"smartphone",color:"#0ea5e9"},
  {id:"c_social",name:"社交",type:"expense",icon:"users",color:"#d97706"},
  {id:"c_travel",name:"旅行",type:"expense",icon:"sparkles",color:"#0891b2"},
  {id:"c_other_e",name:"其他",type:"expense",icon:"package",color:"#78716c"},
  // income
  {id:"c_salary",name:"薪資",type:"income",icon:"coins",color:"#30a46c"},
  {id:"c_bonus",name:"獎金",type:"income",icon:"sparkles",color:"#16a34a"},
  {id:"c_invest",name:"投資",type:"income",icon:"trending-up",color:"#059669"},
  {id:"c_parttime",name:"兼職",type:"income",icon:"user",color:"#10b981"},
  {id:"c_refund",name:"退款",type:"income",icon:"coins",color:"#22c55e"},
  {id:"c_other_i",name:"其他",type:"income",icon:"coins",color:"#65a30d"},
  // example subcategories (names match SUB_ICON_MAP -> each gets its own icon; colour inherits the main)
  {id:"c_food_s1",name:"早餐",type:"expense",parent:"c_food"},
  {id:"c_food_s2",name:"午餐",type:"expense",parent:"c_food"},
  {id:"c_food_s3",name:"晚餐",type:"expense",parent:"c_food"},
  {id:"c_food_s4",name:"飲料",type:"expense",parent:"c_food"},
  {id:"c_food_s5",name:"點心",type:"expense",parent:"c_food"},
  {id:"c_food_s6",name:"食材",type:"expense",parent:"c_food"},
  {id:"c_daily_s1",name:"日常用品",type:"expense",parent:"c_daily"},
  {id:"c_daily_s2",name:"洗衣費",type:"expense",parent:"c_daily"},
  {id:"c_traffic_s1",name:"捷運",type:"expense",parent:"c_traffic"},
  {id:"c_traffic_s2",name:"公車",type:"expense",parent:"c_traffic"},
  {id:"c_traffic_s3",name:"計程車",type:"expense",parent:"c_traffic"},
  {id:"c_traffic_s4",name:"加油費",type:"expense",parent:"c_traffic"},
  {id:"c_traffic_s5",name:"停車費",type:"expense",parent:"c_traffic"},
  {id:"c_shop_s1",name:"衣物",type:"expense",parent:"c_shop"},
  {id:"c_shop_s2",name:"鞋子",type:"expense",parent:"c_shop"},
  {id:"c_shop_s3",name:"美妝保養",type:"expense",parent:"c_shop"},
  {id:"c_shop_s4",name:"配件",type:"expense",parent:"c_shop"},
  {id:"c_shop_s5",name:"日常採買",type:"expense",parent:"c_shop"},
  {id:"c_shop_s6",name:"禮物",type:"expense",parent:"c_shop"},
  {id:"c_fun_s1",name:"電影",type:"expense",parent:"c_fun"},
  {id:"c_fun_s2",name:"遊戲",type:"expense",parent:"c_fun"},
  {id:"c_fun_s3",name:"唱歌",type:"expense",parent:"c_fun"},
  {id:"c_fun_s4",name:"運動",type:"expense",parent:"c_fun"},
  {id:"c_fun_s5",name:"展覽",type:"expense",parent:"c_fun"},
  {id:"c_home_s1",name:"房租",type:"expense",parent:"c_home"},
  {id:"c_home_s2",name:"電費",type:"expense",parent:"c_home"},
  {id:"c_home_s3",name:"網路費",type:"expense",parent:"c_home"},
  {id:"c_home_s4",name:"家具",type:"expense",parent:"c_home"},
  {id:"c_med_s1",name:"門診",type:"expense",parent:"c_med"},
  {id:"c_med_s2",name:"藥品",type:"expense",parent:"c_med"},
  {id:"c_med_s3",name:"保健品",type:"expense",parent:"c_med"},
  {id:"c_edu_s1",name:"課程",type:"expense",parent:"c_edu"},
  {id:"c_edu_s2",name:"圖書",type:"expense",parent:"c_edu"},
  {id:"c_comm_s1",name:"電話費",type:"expense",parent:"c_comm"},
  {id:"c_comm_s2",name:"網路費",type:"expense",parent:"c_comm"},
  {id:"c_social_s1",name:"聚餐",type:"expense",parent:"c_social"},
  {id:"c_social_s2",name:"請客",type:"expense",parent:"c_social"},
  {id:"c_social_s3",name:"喝酒",type:"expense",parent:"c_social"},
  {id:"c_travel_s1",name:"住宿",type:"expense",parent:"c_travel"},
  {id:"c_travel_s2",name:"機票",type:"expense",parent:"c_travel"},
  {id:"c_salary_s1",name:"薪水",type:"income",parent:"c_salary"},
  {id:"c_bonus_s1",name:"獎金",type:"income",parent:"c_bonus"},
  {id:"c_bonus_s2",name:"彩券",type:"income",parent:"c_bonus"},
  {id:"c_parttime_s1",name:"接案",type:"income",parent:"c_parttime"},
];
const EMOJIS=["🍜","🍔","🍱","☕","🍰","🍺","🛒","🧴","🚗","🚌","🚇","⛽","🛍️","👕","👟","🎮","🎬","🎵","🏠","💡","💧","📱","💻","💊","🏥","📚","✏️","✈️","🏨","🎁","💰","💵","💳","📈","💼","🏦","🎯","🐾","👶","💄","✂️","🔧","🎾","⚽","🚭","🧾","📦","❤️","🌐","⚡"];
const COLORS=["#e5484d","#f59e0b","#eab308","#30a46c","#06b6d4","#3b82f6","#5b6cff","#8b5cf6","#ec4899","#f43f5e","#14b8a6","#78716c"];

/* line-icon registry (Lucide, ISC license) — key -> inner svg markup */

let DB=load();
let ui={page:"records",month:curMonth(),selDate:todayStr(),statType:"expense",statMain:null,projView:"card",projYear:null,statTab:"overview"};

function curMonth(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");}
function todayStr(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

function load(){
  let raw=null;try{raw=JSON.parse(localStorage.getItem(STORE_KEY));}catch(e){}
  if(!raw||!raw.accounts){
    return {version:1,accounts:structuredClone(DEFAULT_ACCOUNTS),categories:structuredClone(DEFAULT_CATS),
            records:[],budgets:[],tags:["早餐","午餐","晚餐"],projects:[],
            config:defaultConfig(),_exportedAt:0};
  }
  raw.tags=raw.tags||[];raw.budgets=raw.budgets||[];
  raw.projects=(raw.projects||[]).map((p,i)=> (typeof p==="string")
    ? {id:"p_"+uid(),name:p,color:COLORS[i%COLORS.length],icon:"📁"} : p);
  raw.config=normalizeConfig(raw.config);
  return raw;
}
function defaultConfig(){return {baseCur:"TWD",currencies:structuredClone(DEFAULT_CURRENCIES),theme:"auto",accent:"#5b6cff"};}
function normalizeConfig(c){
  c=c||{};
  if(!c.currencies){
    const cs=structuredClone(DEFAULT_CURRENCIES);
    if(c.currency){const b=cs.find(x=>x.code==="TWD");if(b)b.symbol=c.currency;}
    c.currencies=cs;
  }
  if(!c.baseCur)c.baseCur="TWD";
  if(!c.currencies.some(x=>x.code===c.baseCur))c.baseCur=c.currencies[0].code;
  if(c.theme==null)c.theme="auto";if(c.accent==null)c.accent="#5b6cff";
  return c;
}
function save(skipSync){
  DB._exportedAt=Date.now();
  localStorage.setItem(STORE_KEY,JSON.stringify(DB));
  if(!skipSync){_localDirty=true;schedulePush();}
}

/* =================== helpers =================== */
function curInfo(code){return (DB.config.currencies||[]).find(x=>x.code===code)||{code:code||"",symbol:code||"$",rate:1};}
function baseSym(){return curInfo(DB.config.baseCur).symbol;}
function cur(){return baseSym();}
function isForeign(code){return !!code&&code!==DB.config.baseCur;}
function baseAmt(r){const rt=(r.rate!=null)?r.rate:curInfo(r.cur||DB.config.baseCur).rate;return (r.amount||0)*(rt||1);}
function numStr(n){const a=Math.abs(n);return (a%1===0)?a.toLocaleString("en-US"):a.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});}
function fmt(n,signed){n=Math.round((n||0)*100)/100;const neg=n<0;const out=baseSym()+numStr(n);if(signed)return (neg?"−":"+")+out;return (neg?"−":"")+out;}
function fmtCur(amount,code,signed){const info=curInfo(code);const neg=amount<0;const out=info.symbol+numStr(amount);if(signed)return (neg?"−":"+")+out;return (neg?"−":"")+out;}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function acc(id){return DB.accounts.find(a=>a.id===id);}
function catOf(id){return DB.categories.find(c=>c.id===id);}
function projOf(id){return DB.projects.find(p=>p.id===id);}
function mainCats(type){return DB.categories.filter(c=>c.type===type&&!c.parent);}
function subCats(mainId){return DB.categories.filter(c=>c.parent===mainId);}
function mainOf(cat){return (cat&&cat.parent)?(catOf(cat.parent)||cat):cat;}
/* designed skin (colour + icon) per main category, straight from the Figma tiles */
const CAT_SKIN={
  "飲食":["#FBEF97","cat-food","FOOD"],"餐飲":["#FBEF97","cat-food","FOOD"],
  "交通":["#B6E8E7","cat-transit","TRANSIT"],
  "娛樂":["#D53128","cat-fun","FUN"],
  "個人":["#CCC9B6","cat-personal","PERSONAL"],
  "醫療":["#D14C35","cat-health","HEALTH"],
  "家居":["#6C84C0","cat-home","HOME"],"居家":["#6C84C0","cat-home","HOME"],
  "購物":["#F1A258","cat-shop","SHOP"],
  "家庭":["#FF9A93","cat-family","FAMILY"],
  "生活":["#68773E","cat-life","LIFE"],
  "學習":["#C7E3B5","cat-study","STUDY"],"教育":["#C7E3B5","cat-study","STUDY"],
};
function catSkin(cat){const m=cat?(cat.parent?catOf(cat.parent):cat):null;return (m&&CAT_SKIN[m.name])||null;}
/* short English labels for sub-categories (length-controlled, <=8 chars) */
const SUB_EN={
  "早餐":"BRKFAST","午餐":"LUNCH","晚餐":"DINNER","飲料":"DRINK","點心":"SNACK","食材":"GROCERY","菸酒":"SMOKE",
  "計程車":"TAXI","加油費":"GAS","罰單啦幹":"TICKET","摩托車":"SCOOTER","捷運":"MRT","公車":"BUS","停車費":"PARKING","維修":"REPAIR","機票":"FLIGHT","船票":"FERRY","單車":"BIKE","火車":"TRAIN","高鐵":"HSR",
  "喝酒":"BOOZE","消遣":"LEISURE","聚餐":"GATHER","請客":"TREAT","遊樂園":"PARK","唱歌":"KARAOKE","音樂":"MUSIC","電影":"MOVIE","遊戲":"GAME","影音":"MEDIA","展覽":"EXHIBIT","健身":"GYM","博弈":"GAMBLE","運動":"SPORTS",
  "美妝保養":"BEAUTY","衣物":"CLOTHES","鞋子":"SHOES","禮物":"GIFT","配件":"EXTRAS","電子產品":"TECH","應用軟體":"APP","精品":"LUXURY","日常採買":"DAILY","文具":"PENS","圖書":"BOOKS","市場":"MARKET","包包":"BAGS","訂閱":"SUBS","小費":"TIP",
  "寵物":"PET","手機電話費":"PHONE","接案":"FREELANCE","保險":"INSURE","投資":"INVEST",
  "醫療用品":"MEDKIT","門診":"CLINIC","保健品":"VITAMIN","藥品":"MEDS","健康檢查":"CHECKUP","牙齒保健":"DENTAL",
  "日常用品":"SUPPLY","電話費":"PHONE","網路費":"WIFI","房租":"RENT","燃料費":"FUEL","洗衣費":"LAUNDRY","電費":"POWER","家具":"FURNISH","家電":"DEVICES",
  "美容美髮":"SALON","旅行":"TRAVEL","住宿":"STAY","泡湯":"SPA",
  "課程":"COURSE","圖書館":"LIBRARY",
  "薪水":"SALARY","獎金":"BONUS","收款":"PAYMENT","彩券":"LOTTERY","發票中獎":"WIN","薪資":"SALARY",
};
/* English labels for main categories not covered by the designed CAT_SKIN tiles (income + leftover expense mains) */
const MAIN_EN={"收入":"INCOME","餘額調整":"ADJUST","其他":"OTHER","房租":"RENT","薪資":"SALARY","獎金":"BONUS","投資":"INVEST","兼職":"PARTTIME","退款":"REFUND"};
function catLabel(c){if(!c)return "";if(!c.parent){const sk=CAT_SKIN[c.name];if(sk&&sk[2])return sk[2];return MAIN_EN[c.name]||c.name;}return SUB_EN[c.name]||c.name;}
function catColor(cat){if(!cat)return "#999";const sk=catSkin(cat);if(sk)return sk[0];if(cat.color)return cat.color;const m=cat.parent?catOf(cat.parent):null;return (m&&m.color)||"#999";}
function catIcon(cat){if(!cat)return "❓";if(!cat.parent){const sk=CAT_SKIN[cat.name];if(sk)return sk[1];}if(cat.icon)return cat.icon;if(cat.parent&&typeof SUB_ICON_MAP!=="undefined"&&SUB_ICON_MAP[cat.name])return SUB_ICON_MAP[cat.name];const m=cat.parent?catOf(cat.parent):null;return (m&&CAT_SKIN[m.name]?CAT_SKIN[m.name][1]:(m&&m.icon))||"📦";}
function monthLabel(m){const[y,mo]=m.split("-");return y+"年"+parseInt(mo)+"月";}
function inMonth(dateStr,m){return dateStr&&dateStr.slice(0,7)===m;}
function recsInMonth(m){return DB.records.filter(r=>inMonth(r.date,m));}

function accBalance(id){
  const a=acc(id);if(!a)return 0;let b=a.init||0;
  for(const r of DB.records){
    const v=baseAmt(r);
    if(r.type==="income"&&r.accountId===id)b+=v;
    else if(r.type==="expense"&&r.accountId===id)b-=v;
    else if(r.type==="transfer"){if(r.accountId===id)b-=v;if(r.toAccountId===id)b+=v;}
  }
  return b;
}
