import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import './style.css';
(()=>{
/* ================= helpers ================= */
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const addMonths=(d,n)=>new Date(d.getFullYear(),d.getMonth()+n,1);
const firstOf=s=>parse(s.slice(0,8)+'01');
const today=()=>ymd(new Date());
const utc=s=>{const[y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)};
const dayDiff=(a,b)=>Math.round((utc(b)-utc(a))/864e5);
const shift=(s,n)=>ymd(addDays(parse(s),n));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const snap=m=>Math.round(m/15)*15;
const uid=p=>p+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const M3=MONTHS.map(m=>m.slice(0,3));
const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const D3=DOW.map(d=>d.slice(0,3));
const toMin=t=>{if(!t)return 0;const[h,m]=t.split(':').map(Number);return h*60+m};
const fromMin=m=>m>=1440?'24:00':`${pad(Math.floor(m/60))}:${pad(m%60)}`;
const longDate=s=>{const d=parse(s);return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`};
const fullDate=s=>{const d=parse(s);return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`};
const cardDate=s=>{const d=parse(s);return `${D3[d.getDay()]}, ${d.getDate()} ${M3[d.getMonth()]} ${d.getFullYear()}`};
const shortDate=s=>{const d=parse(s);return `${d.getDate()} ${M3[d.getMonth()]}`};
const haptic=()=>{try{if(Capacitor.isNativePlatform())Haptics.impact({style:ImpactStyle.Light});else navigator.vibrate&&navigator.vibrate(12)}catch(e){}};
const REMAP={'#3B78F2':'#0A84FF','#D6455A':'#FF375F','#EE8420':'#FF9F0A','#23A06A':'#30D158','#9A5BE3':'#BF5AF2','#0E9AA7':'#64D2FF','#B8860B':'#FFD60A'};
const col=c=>REMAP[c]||c;
const COLORS=['#FF453A','#FF9F0A','#FFD60A','#30D158','#64D2FF','#0A84FF','#BF5AF2','#FF375F','#AC8E68'];
const LIST_COLORS=['#0A84FF','#30D158','#FF9F0A','#BF5AF2','#FF375F','#64D2FF','#FFD60A'];
const DEFAULT_CALS=[{id:'work',name:'Work',color:'#0A84FF',on:true},{id:'ops',name:'Site & Operations',color:'#FF375F',on:true},
  {id:'travel',name:'Travel',color:'#FF9F0A',on:true},{id:'personal',name:'Personal',color:'#30D158',on:true},{id:'family',name:'Family',color:'#BF5AF2',on:true}];
const REP=[['none','Never'],['daily','Every Day'],['weekdays','Every Weekday'],['weekly','Every Week'],['biweekly','Every 2 Weeks'],['monthly','Every Month'],['yearly','Every Year']];
const repName=r=>(REP.find(x=>x[0]===(r||'none'))||REP[0])[1];
const svg=(p,s='')=>`<svg class="ico" viewBox="0 0 24 24" ${s}>${p}</svg>`;
const I={
  x:svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'), check:svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  back:svg('<path d="m15 5-7 7 7 7"/>'), chev:'<svg class="ico chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  dock:svg('<path d="m10 6 6 6-6 6"/>'), plus:svg('<path d="M12 5v14M5 12h14"/>'),
  cal:svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  pin:svg('<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
  rep:svg('<path d="M17 2.5 20.5 6 17 9.5"/><path d="M3.5 12V10a4 4 0 0 1 4-4h13M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12v2a4 4 0 0 1-4 4h-13"/>'),
  end:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  notes:svg('<path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>'),
  link:svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
  search:svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/>','style="width:18px;height:18px;color:var(--muted)"')};

/* ================= storage: local cache + Supabase sync ================= */
const LS='daybook-v1', LSUI='daybook-ui3', LSP='daybook-pending', LSCFG='daybook-server', LSSYNC='daybook-lastsync';
const S={events:{},lists:{},settings:null};
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let cacheT=0;const cacheLocal=()=>{clearTimeout(cacheT);cacheT=setTimeout(()=>lsSet(LS,S),120)};
let sb=null,session=null,channel=null,mode='offline',lastSync=lsGet(LSSYNC),pending=lsGet(LSP)||{};
function typeOf(id){return S.events[id]?'event':S.lists[id]?'list':id==='settings'?'settings':null}
function put(id,obj){
  if(obj.type==='event')S.events[id]=obj;else if(obj.type==='list')S.lists[id]=obj;else S.settings=obj;
  cacheLocal();scheduleRender();
  pending[id]={type:obj.type||'settings',data:clone(obj),deleted:false};lsSet(LSP,pending);flushSoon();
}
function drop(id){const type=typeOf(id);delete S.events[id];delete S.lists[id];cacheLocal();scheduleRender();
  if(!type)return;pending[id]={type,data:{},deleted:true};lsSet(LSP,pending);flushSoon()}
let flushT=0,flushing=false;
function flushSoon(ms=250){clearTimeout(flushT);flushT=setTimeout(flush,ms)}
async function flush(){
  if(!sb||!session||flushing)return;const ids=Object.keys(pending);if(!ids.length){setMode('synced');return}
  if(!navigator.onLine){setMode('offline');return}
  flushing=true;const snap={...pending};
  const rows=ids.map(id=>({user_id:session.user.id,id,type:snap[id].type,data:snap[id].data,deleted:snap[id].deleted}));
  let error=null;
  for(let i=0;i<rows.length&&!error;i+=200){({error}=await sb.from('items').upsert(rows.slice(i,i+200),{onConflict:'user_id,id'}))}
  flushing=false;
  if(error){console.warn('Daybook sync',error);setMode('error');flushSoon(8000);return}
  for(const id of ids)if(pending[id]===snap[id])delete pending[id];
  lsSet(LSP,pending);
  if(Object.keys(pending).length)flushSoon();else setMode('synced');
}
function applyRow(r){
  if(!r||!r.id||pending[r.id])return;
  if(r.deleted){delete S.events[r.id];delete S.lists[r.id];if(r.type==='settings')S.settings=null;return}
  if(r.type==='event'){delete S.lists[r.id];S.events[r.id]=r.data}
  else if(r.type==='list'){delete S.events[r.id];S.lists[r.id]=r.data}
  else if(r.type==='settings')S.settings=r.data;
}
function noteSync(ts){if(ts&&(!lastSync||ts>lastSync)){lastSync=ts;lsSet(LSSYNC,lastSync)}}
async function pull(full){
  if(!sb||!session||!navigator.onLine)return false;
  const since=!full&&lastSync?new Date(new Date(lastSync).getTime()-60000).toISOString():null;
  let from=0,got=0;
  for(;;){
    let q=sb.from('items').select('id,type,data,deleted,updated_at').order('updated_at',{ascending:true}).range(from,from+999);
    if(since)q=q.gt('updated_at',since);
    const{data,error}=await q;
    if(error){console.warn('Daybook pull',error);setMode('error');return false}
    for(const r of data){applyRow(r);noteSync(r.updated_at)}
    got+=data.length;if(data.length<1000)break;from+=1000;
  }
  if(got){cacheLocal();scheduleRender()}
  return true;
}
function setMode(m){mode=m;const el=document.getElementById('syncdot');if(el){el.dataset.m=m;el.title=modeText()}}
function modeText(){const n=Object.keys(pending).length;
  if(!session)return 'Not signed in. Changes are kept on this device.';
  if(mode==='synced')return 'Synced with your Daybook server.';
  if(mode==='error')return `Can't reach your server right now. ${n} change${n===1?'':'s'} will sync when it's back.`;
  return n?`Offline. ${n} change${n===1?'':'s'} waiting to sync.`:'Offline. Showing your saved copy.';}
function syncStatusHTML(){
  return `<div class="group"><div class="status ${mode==='synced'?'cloud':''}"><i></i><span>${esc(modeText())}${session?`<br><small style="color:var(--muted)">${esc(session.user.email||'')}</small>`:''}</span></div>
    ${session?'<button class="row red" data-signout>Sign Out</button>':'<button class="row" data-signin style="color:var(--accent)">Sign In</button>'}</div>`;
}
async function startSync(){
  const uidv=session.user.id;
  const firstEver=!lastSync;
  await pull(firstEver);
  if(firstEver){
    const local=Object.keys(S.events).length+Object.keys(S.lists).length;
    if(!local)seedWelcome();
  }
  flushSoon(0);
  if(channel)sb.removeChannel(channel);
  channel=sb.channel('items-'+uidv).on('postgres_changes',{event:'*',schema:'public',table:'items',filter:`user_id=eq.${uidv}`},p=>{
    const r=p.new;if(!r||!r.id)return;applyRow(r);noteSync(r.updated_at);cacheLocal();scheduleRender();
  }).subscribe(st=>{if(st==='SUBSCRIBED'){pull();if(!Object.keys(pending).length)setMode('synced')}else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT')setMode(navigator.onLine?'error':'offline')});
}
addEventListener('online',()=>{if(session){pull();flushSoon(0)}});
addEventListener('offline',()=>setMode('offline'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&session){pull();flushSoon(0)}});
async function signOut(){
  const a=await actionSheet([{label:'Sign Out',act:'out',red:true}],Object.keys(pending).length?'Some changes have not synced yet and will be lost on this device.':'Your data stays on your server. This device forgets it until you sign in again.');
  if(!a)return;
  try{if(channel)sb.removeChannel(channel);await sb.auth.signOut()}catch(e){}
  session=null;pending={};lastSync=null;S.events={};S.lists={};S.settings=null;
  [LS,LSP,LSSYNC].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
  sheetClose();render();showAuth();
}
function settings(){if(!S.settings)S.settings={type:'settings',cals:clone(DEFAULT_CALS),defaultCal:'work'};return S.settings}
const calOf=id=>settings().cals.find(c=>c.id===id)||settings().cals[0];
const cc=ev=>col(calOf(ev.cal).color);
function seedWelcome(){
  put(uid('ls'),{type:'list',name:'Getting started',color:LIST_COLORS[0],x:null,y:null,state:'float',collapsed:false,showDone:false,created:Date.now(),tasks:[
    {id:uid('t'),text:'Drag this window by its top edge',done:false},
    {id:uid('t'),text:'Swipe it right to tuck it into the screen edge',done:false},
    {id:uid('t'),text:'Hold a task and drop it on a day',done:false},
    {id:uid('t'),text:'Long-press an hour in Day view to add an event',done:false}]});
}

/* sign-in screen */
/* Public project address and publishable key: safe to ship, data is protected by sign-in and row-level security. */
const DEFAULT_SERVER={url:'https://bfybypdzttvahljnxgfl.supabase.co',key:'sb_publishable_zwYFbpyF0Ps9UiLxrTJHMg_UGMrNxDX'};
function serverCfg(){const c=lsGet(LSCFG)||{};return{url:c.url||import.meta.env.VITE_SUPABASE_URL||DEFAULT_SERVER.url,key:c.key||import.meta.env.VITE_SUPABASE_ANON_KEY||DEFAULT_SERVER.key}}
function makeClient(cfg){return createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'daybook-auth'}})}
function showAuth(msg){
  const cfg=serverCfg(),el=document.getElementById('auth'),built=!!(cfg.url&&cfg.key);
  el.innerHTML=`<form class="authcard" id="authf" autocomplete="on">
    <div class="authlogo" aria-hidden="true"><span></span><b>${new Date().getDate()}</b></div>
    <h1>Daybook</h1><p class="note" style="text-align:center;margin:0 0 6px">Sign in to sync your calendar and tasks between your devices.</p>
    <div class="group">
      <div class="row"><input id="a-email" type="email" placeholder="Email" autocomplete="username" required value="${esc(lsGet('daybook-email')||'')}"></div>
      <div class="row"><input id="a-pass" type="password" placeholder="Password" autocomplete="current-password" required></div>
    </div>
    <details ${built?'':'open'} class="srv"><summary>Server</summary><div class="group">
      <div class="row"><input id="a-url" placeholder="Project URL (https://….supabase.co)" value="${esc(cfg.url)}" autocomplete="off" inputmode="url"></div>
      <div class="row"><input id="a-key" placeholder="Publishable (anon) key" value="${esc(cfg.key)}" autocomplete="off"></div></div></details>
    <div class="err" id="a-err" ${msg?'':'hidden'}>${esc(msg||'')}</div>
    <button class="btn-pri" id="a-go" type="submit">Sign In</button>
  </form>`;
  el.hidden=false;
  el.querySelector('#authf').onsubmit=async e=>{e.preventDefault();
    const err=el.querySelector('#a-err'),go=el.querySelector('#a-go');err.hidden=true;
    const c={url:el.querySelector('#a-url').value.trim().replace(/\/+$/,''),key:el.querySelector('#a-key').value.trim()};
    const email=el.querySelector('#a-email').value.trim(),pass=el.querySelector('#a-pass').value;
    if(!/^https:\/\/.+/.test(c.url)||!c.key){err.textContent='Enter your server address and key under Server.';err.hidden=false;el.querySelector('details').open=true;return}
    go.disabled=true;go.textContent='Signing in…';
    try{sb=makeClient(c);const{data,error}=await sb.auth.signInWithPassword({email,password:pass});
      if(error)throw error;lsSet(LSCFG,c);lsSet('daybook-email',email);session=data.session;el.hidden=true;el.innerHTML='';setMode('offline');await startSync();render()}
    catch(x){const m=x?.message||'';err.textContent=/invalid login/i.test(m)?'That email and password don’t match.':/fetch|network|load failed/i.test(m)||!m?'Could not reach the server. Check the address under Server and your connection.':m;err.hidden=false;go.disabled=false;go.textContent='Sign In'}};
}

/* ================= ui state ================= */
const sv=lsGet(LSUI)||{};
const ROWMIN=58, HMIN=22, HMAX=170;
const rowMax=()=>innerWidth>=700?240:204;
const ui={view:['year','month','week','day','list'].includes(sv.view)?sv.view:'month',ws:sv.ws??0,pinchRev:!!sv.pinchRev,
  rowH:sv.rowH||112,hourH:sv.hourH||56,sel:today(),year:new Date().getFullYear(),rStart:null,rCount:0,visM:firstOf(today())};
let uiT=0;function saveUi(){clearTimeout(uiT);uiT=setTimeout(()=>lsSet(LSUI,{view:ui.view,ws:ui.ws,pinchRev:ui.pinchRev,rowH:Math.round(ui.rowH),hourH:Math.round(ui.hourH)}),300)}
const setSel=d=>{ui.sel=d};
const offOf=d=>(d.getDay()-ui.ws+7)%7;
const weekStart=s=>{const d=parse(s);return addDays(d,-offOf(d))};
const weekDays=s=>{const w=weekStart(s);return [...Array(7)].map((_,i)=>ymd(addDays(w,i)))};
const isWE=d=>{const w=d.getDay();return w===0||w===6};

/* ================= event logic ================= */
const isMulti=ev=>!!(ev.endDate&&ev.endDate>ev.date&&!isRep(ev));
const isRep=ev=>!!(ev.repeat&&ev.repeat!=='none');
function occurs(ev,d){
  if(d<ev.date)return false;
  if(ev.skip&&ev.skip.includes(d))return false;
  if(!isRep(ev))return d<=(isMulti(ev)?ev.endDate:ev.date);
  if(ev.until&&d>ev.until)return false;
  const a=parse(ev.date),b=parse(d);
  switch(ev.repeat){case 'daily':return true;case 'weekdays':{const w=b.getDay();return w>0&&w<6}
    case 'weekly':return a.getDay()===b.getDay();
    case 'biweekly':return a.getDay()===b.getDay()&&(dayDiff(ev.date,d)/7)%2===0;
    case 'monthly':return a.getDate()===b.getDate();
    case 'yearly':return a.getDate()===b.getDate()&&a.getMonth()===b.getMonth()}
  return d===ev.date;
}
const isTop=ev=>ev.allDay||isMulti(ev); /* shown in all-day band on timelines */
let onCache=null;
function eventsOn(d){
  if(!onCache)onCache=new Map();if(onCache.has(d))return onCache.get(d);
  const on=new Set(settings().cals.filter(c=>c.on).map(c=>c.id));
  const r=Object.entries(S.events).filter(([id,e])=>on.has(e.cal)&&occurs(e,d)).map(([id,e])=>({id,...e}))
    .sort((a,b)=>(isTop(b)-isTop(a))||(toMin(a.start)-toMin(b.start))||a.title.localeCompare(b.title));
  onCache.set(d,r);return r;
}
let taskIdx=null;
function tasksDue(d){if(!taskIdx){taskIdx=new Map();for(const[lid,l]of Object.entries(S.lists))for(const t of l.tasks||[])if(t.due){if(!taskIdx.has(t.due))taskIdx.set(t.due,[]);taskIdx.get(t.due).push({lid,l,t})}}return taskIdx.get(d)||[]}
const dueLabel=d=>{const t=today();return d===t?'Today':d===shift(t,1)?'Tomorrow':d===shift(t,-1)?'Yesterday':shortDate(d)};
function taskChip(it,pos){const{lid,l,t}=it.tk;return `<button class="ev tk${t.done?' done':''}${it.d<today()?' past':''}" data-task="${lid}|${t.id}" data-d="${it.d}" style="${pos};--c:${col(l.color)}"><span class="tbox" data-tchk></span><span class="et">${esc(t.text)}</span></button>`}
function span(ev){let s=toMin(ev.start),e=toMin(ev.end);if(e<=s)e=Math.min(1440,s+30);return{s,e}}
function rowItems(days,filter,withTasks){
  const n=days.length,items=[],seen=new Set();
  days.forEach((d,i)=>{if(!d)return;for(const ev of eventsOn(d)){if(filter&&!filter(ev))continue;
    if(isMulti(ev)){if(seen.has(ev.id))continue;seen.add(ev.id);let e=i;while(e+1<n&&days[e+1]&&occurs(ev,days[e+1]))e++;items.push({ev,s:i,e,d,len:e-i+1,span:e>i})}
    else items.push({ev,s:i,e:i,d,len:1,span:false})}});
  if(withTasks)days.forEach((d,i)=>{if(!d)return;for(const x of tasksDue(d))items.push({tk:x,s:i,e:i,d,len:1,span:false})});
  items.sort((a,b)=>{if(a.tk||b.tk)return((a.tk?1:0)-(b.tk?1:0))||((a.tk?.t.done?1:0)-(b.tk?.t.done?1:0));return(b.len-a.len)||(isTop(b.ev)-isTop(a.ev))||(toMin(a.ev.start)-toMin(b.ev.start))});
  const lanes=[];
  for(const it of items){let k=0;for(;;k++){lanes[k]=lanes[k]||[];let ok=true;for(let c=it.s;c<=it.e;c++)if(lanes[k][c]){ok=false;break}if(ok)break}
    for(let c=it.s;c<=it.e;c++)lanes[k][c]=1;it.k=k}
  return items;
}
function lanesFor(evs){
  const timed=evs.filter(e=>!isTop(e)).map(e=>({...e,...span(e)})).sort((a,b)=>a.s-b.s||b.e-a.e);
  let cluster=[],cEnd=-1;const laid=[];
  const flush=()=>{const lanes=[];for(const e of cluster){let k=lanes.findIndex(end=>end<=e.s);if(k<0){k=lanes.length;lanes.push(0)}lanes[k]=e.e;e.lane=k}cluster.forEach(e=>{e.n=lanes.length;laid.push(e)});cluster=[]};
  for(const e of timed){if(e.s>=cEnd&&cluster.length){flush();cEnd=-1}cluster.push(e);cEnd=Math.max(cEnd,e.e)}
  if(cluster.length)flush();return laid;
}

/* ================= rendering ================= */
const view=$('#view'),pane=$('#pane');
let rq=0,dirty=false;
function scheduleRender(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;render()})}
function busy(){return G.mode==='drag'||G.mode==='pinch'||!!P}
function render(o={}){
  onCache=null;taskIdx=null;
  if(busy()&&!o.force){dirty=true;return}
  dirty=false;
  if(ui.view==='month'){const a=o.noAnchor?null:captureAnchor();pane.innerHTML=monthHTML();setRowH(ui.rowH);if(a)restoreAnchor(a)}
  else{pane.innerHTML=ui.view==='week'?weekHTML():ui.view==='day'?dayHTML():ui.view==='year'?yearHTML():listHTML()}
  view.style.setProperty('--hour',ui.hourH+'px');
  renderHeader();renderPanels();
}
function flushDirty(){if(dirty)render()}
const topH=()=>$('#top').getBoundingClientRect().bottom;

function renderHeader(){
  const v=ui.view,sel=parse(ui.sel);
  const back=$('#b-back'),ttl=$('#ttl'),strip=$('#strip'),dl=$('#dateline');
  back.hidden=v==='year';
  $('#backlbl').textContent=v==='month'?String(ui.visM.getFullYear()):MONTHS[sel.getMonth()];
  ttl.hidden=v==='week'||v==='day';
  $('#title').textContent=v==='year'?ui.year:v==='month'?MONTHS[ui.visM.getMonth()]:v==='list'?'Upcoming':'';
  dl.hidden=v!=='day';
  if(v==='day'){const d=parse(ui.sel);dl.textContent=`${DOW[d.getDay()]} – ${d.getDate()} ${M3[d.getMonth()]} ${d.getFullYear()}`}
  strip.className='strip';const L=['S','M','T','W','T','F','S'];
  if(v==='month'){strip.hidden=false;strip.innerHTML=[0,1,2,3,4,5,6].map(i=>`<span>${L[(i+ui.ws)%7]}</span>`).join('')}
  else if(v==='week'||v==='day'){strip.hidden=false;if(v==='week')strip.classList.add('gut');const td=today();
    strip.innerHTML=weekDays(ui.sel).map(s=>{const d=parse(s);return `<button class="hd${isWE(d)?' we':''}${s<td?' past':''}${s===td?' today':''}${s===ui.sel&&v==='day'?' sel':''}" data-hd="${s}" aria-label="${longDate(s)}">${L[d.getDay()]}<b>${d.getDate()}</b></button>`}).join('')}
  else{strip.hidden=true;strip.innerHTML=''}
  document.documentElement.style.setProperty('--toph',$('#top').offsetHeight+'px');
  let n=0;for(const l of Object.values(S.lists))n+=(l.tasks||[]).filter(t=>!t.done).length;
  const b=$('#tcount');b.hidden=!n;b.textContent=n>99?'99+':n;
}
function updateTitleOnly(){if(ui.view!=='month')return;$('#title').textContent=MONTHS[ui.visM.getMonth()];$('#backlbl').textContent=String(ui.visM.getFullYear())}

/* ---- month ---- */
function initRange(d){ui.rStart=addMonths(firstOf(d),-6);ui.rCount=18}
function weekRowHTML(days,key){
  const td=today(),items=rowItems(days,null,true);let chips='';
  for(const it of items){if(it.k>7)continue;if(it.tk){chips+=taskChip(it,`grid-column:${it.s+1};grid-row:${it.k+2}`);continue}const ev=it.ev,timed=!isTop(ev);
    chips+=`<button class="ev${isTop(ev)?' ad':''}${it.span?' span':''}${days[it.e]<td?' past':''}" data-ev="${ev.id}" data-d="${it.d}" style="grid-column:${it.s+1}/${it.e+2};grid-row:${it.k+2};--c:${cc(ev)}"><span class="et">${esc(ev.title)}</span>${timed?`<span class="t">${ev.start}</span>`:''}</button>`}
  let bg='',heads='';
  days.forEach((d,i)=>{if(!d)return;const dt=parse(d),evs=eventsOn(d);
    bg+=`<button class="dbg" data-day="${d}" style="grid-column:${i+1}" aria-label="${longDate(d)}${evs.length?', '+evs.length+' events':''}"></button>`;
    heads+=`<div class="dh${d<td?' past':''}" style="grid-column:${i+1}"><span class="dn${d===td?' today':''}${isWE(dt)?' we':''}${d<td?' past':''}">${dt.getDate()}</span><span class="dots">${evs.slice(0,3).map(e=>`<i style="--c:${cc(e)}"></i>`).join('')}${evs.length<3&&tasksDue(d).some(x=>!x.t.done)?'<i class="task"></i>':''}</span></div>`});
  return `<div class="wrow" data-w="${key}">${bg}${heads}${chips}</div>`;
}
function monthSection(m){
  const off=offOf(m),dim=new Date(m.getFullYear(),m.getMonth()+1,0).getDate(),rows=Math.ceil((off+dim)/7),now=new Date();
  const isNow=m.getFullYear()===now.getFullYear()&&m.getMonth()===now.getMonth(),mk=ymd(m);
  let h=`<section class="msec" data-m="${mk}"><div class="mlabel"><b class="${isNow?'cur':''}" style="grid-column:${off+1}/8">${M3[m.getMonth()]}${m.getMonth()===0?' '+m.getFullYear():''}</b></div>`;
  for(let r=0;r<rows;r++){const days=[];for(let c=0;c<7;c++){const n=r*7+c-off+1;days.push(n>=1&&n<=dim?ymd(new Date(m.getFullYear(),m.getMonth(),n)):null)}h+=weekRowHTML(days,mk+'_'+r)}
  return h+'</section>';
}
function monthHTML(){if(!ui.rStart)initRange(ui.sel);let h='';for(let i=0;i<ui.rCount;i++)h+=monthSection(addMonths(ui.rStart,i));return `<div class="mgrid bleed">${h}</div>`}
function setRowH(h){
  ui.rowH=h;const g=pane.querySelector('.mgrid');if(!g)return;
  const z=clamp((h-ROWMIN)/(rowMax()-ROWMIN),0,1);
  g.style.setProperty('--rowH',h+'px');g.style.setProperty('--co',clamp((z-.04)*5,0,1).toFixed(3));g.style.setProperty('--do',clamp(1-z*6,0,1).toFixed(3));
  g.classList.toggle('deep',h>=146);
}
function captureAnchor(){const th=topH();for(const r of pane.querySelectorAll('.wrow')){const b=r.getBoundingClientRect();if(b.bottom>th+4)return{key:r.dataset.w,top:b.top}}return null}
function restoreAnchor(a){const r=pane.querySelector(`.wrow[data-w="${a.key}"]`);if(r)quietScroll(r.getBoundingClientRect().top-a.top)}
let quiet=false;
function quietScroll(dy){if(!dy)return;quiet=true;window.scrollBy(0,dy);requestAnimationFrame(()=>quiet=false)}
function positionMonth(d,oy,toSection){
  const sec=pane.querySelector(`.msec[data-m="${ymd(firstOf(d))}"]`);if(!sec)return;
  let el=sec,target=topH()+2;
  if(!toSection){const cell=sec.querySelector(`.dbg[data-day="${d}"]`);if(cell){el=cell.closest('.wrow');const h=el.getBoundingClientRect().height;target=oy!=null?oy-h/2:topH()+(innerHeight-topH())*.28}}
  quiet=true;window.scrollTo(0,Math.max(0,scrollY+el.getBoundingClientRect().top-target));requestAnimationFrame(()=>{quiet=false;updateVisMonth()});
}
function updateVisMonth(){
  if(ui.view!=='month')return;const th=topH()+50;let cur=null;
  for(const s of pane.querySelectorAll('.msec')){if(s.getBoundingClientRect().top<=th)cur=s;else break}
  const m=cur?parse(cur.dataset.m):ui.rStart;if(m&&m.getTime()!==ui.visM.getTime()){ui.visM=m;updateTitleOnly()}
}
function extendIfNeeded(){
  if(ui.view!=='month'||busy())return;
  const H=document.documentElement.scrollHeight;
  if(scrollY+innerHeight>H-innerHeight*1.3){ui.rCount+=6;if(ui.rCount>48){ui.rStart=addMonths(ui.rStart,6);ui.rCount-=6}render()}
  else if(scrollY<innerHeight*1.3){ui.rStart=addMonths(ui.rStart,-6);ui.rCount+=6;if(ui.rCount>48)ui.rCount-=6;render()}
}
let scT=0;
addEventListener('scroll',()=>{if(quiet||ui.view!=='month')return;if(scT)return;scT=requestAnimationFrame(()=>{scT=0;updateVisMonth();extendIfNeeded()})},{passive:true});

/* ---- timelines ---- */
function hoursHTML(){let h='';for(let i=0;i<24;i++){h+=`<div class="hr" style="top:calc(var(--hour)*${i})"><span>${i?pad(i)+':00':''}</span></div>`;
  h+=`<div class="hr half" style="top:calc(var(--hour)*${i+.5});display:var(--halfs,none)"></div>`}return h}
function blkHTML(e,d){const t=today(),n=new Date(),past=d<t||(d===t&&e.e<=n.getHours()*60+n.getMinutes());return `<button class="blk${past?' past':''}" data-ev="${e.id}" data-d="${d}" style="--c:${cc(e)};top:calc(var(--hour)*${e.s/60});height:calc(var(--hour)*${(e.e-e.s)/60} - 2px);left:calc(${e.lane}*100%/${e.n});width:calc(100%/${e.n} - 2px)"><b>${esc(e.title)}</b><small>${fromMin(e.s)}${e.loc?' · '+esc(e.loc):''}</small></button>`}
function nowHTML(days){if(!days.includes(today()))return '';const n=new Date(),mm=n.getHours()*60+n.getMinutes();
  return `<div class="now" style="top:calc(var(--hour)*${mm/60})"></div><div class="nowlbl" style="top:calc(var(--hour)*${mm/60})">${fromMin(mm)}</div>`}
function allDayHTML(days){
  const items=rowItems(days,isTop,true);if(!items.length)return '';
  return `<div class="alld"><span class="adl">all-day</span><div class="adgrid" style="grid-template-columns:repeat(${days.length},minmax(0,1fr))">${items.map(it=>it.tk?taskChip(it,`grid-column:${it.s+1};grid-row:${it.k+1}`):`<button class="ev ad${it.span?' span':''}" data-ev="${it.ev.id}" data-d="${it.d}" style="grid-column:${it.s+1}/${it.e+2};grid-row:${it.k+1};--c:${cc(it.ev)}"><span class="et">${esc(it.ev.title)}</span></button>`).join('')}</div></div>`;
}
function timelineHTML(days){
  return `${allDayHTML(days)}<div class="tl" id="tl">${hoursHTML()}<div class="cols${days.length>1&&innerWidth<640?' narrow':''}" style="grid-template-columns:repeat(${days.length},minmax(0,1fr))">${days.map(d=>`<div class="col${d<today()?' past':''}" data-col="${d}">${lanesFor(eventsOn(d)).map(e=>blkHTML(e,d)).join('')}</div>`).join('')}</div>${nowHTML(days)}</div>`;
}
function weekHTML(){return timelineHTML(weekDays(ui.sel))}
function dayHTML(){return timelineHTML([ui.sel])}
function taskItem({lid,l,t}){return `<div class="titem" style="--lc:${col(l.color)}"><button class="chk${t.done?' on':''}" data-agchk="${lid}|${t.id}" aria-label="Toggle task"></button><span style="${t.done?'text-decoration:line-through;color:var(--muted)':''}">${esc(t.text)}</span><em>${esc(l.name)}</em></div>`}
function setHour(h){ui.hourH=h;view.style.setProperty('--hour',h+'px');view.style.setProperty('--halfs',h>=96?'block':'none')}
function minuteAt(y){const tl=$('#tl');return tl?(y-tl.getBoundingClientRect().top)/ui.hourH*60:0}
function colDayAt(x){const cols=[...pane.querySelectorAll('.col')];if(!cols.length)return null;
  for(const c of cols){const r=c.getBoundingClientRect();if(x>=r.left&&x<r.right)return c.dataset.col}
  return x<cols[0].getBoundingClientRect().left?cols[0].dataset.col:cols[cols.length-1].dataset.col}
function positionTimeline(minute,oy){
  const tl=$('#tl');if(!tl)return;
  let m=minute;
  if(m==null){const days=ui.view==='day'?[ui.sel]:weekDays(ui.sel);
    if(days.includes(today())){const n=new Date();m=n.getHours()*60+n.getMinutes()-90}
    else{const f=Math.min(...days.flatMap(d=>eventsOn(d).filter(e=>!isTop(e)).map(e=>toMin(e.start))),8*60);m=f-30}}
  const target=oy!=null?oy:topH()+8;
  window.scrollTo(0,Math.max(0,scrollY+tl.getBoundingClientRect().top+clamp(m,0,1440)/60*ui.hourH-target));
}

/* ---- year & list ---- */
function yearHTML(){
  const y=ui.year,t=today(),now=new Date();let h='';
  for(let m=0;m<12;m++){const f=new Date(y,m,1),off=offOf(f),dim=new Date(y,m+1,0).getDate();let g='';
    for(let i=0;i<off;i++)g+='<i></i>';for(let n=1;n<=dim;n++){const d=ymd(new Date(y,m,n));g+=`<i class="${d===t?'today':d<t?'past':''}">${n}</i>`}
    h+=`<button class="ym" data-m="${ymd(f)}" aria-label="${MONTHS[m]} ${y}"><h3 class="${y===now.getFullYear()&&m===now.getMonth()?'cur':''}">${M3[m]}</h3><div class="ymg">${g}</div></button>`}
  return `<div class="year">${h}</div>`;
}
function itemHTML(ev,d){
  const tl=isTop(ev)?'All-day':`${ev.start}<br>${ev.end}`,sub=[ev.loc,ev.notes].filter(Boolean).join(' · ');
  return `<button class="item" data-ev="${ev.id}" data-d="${d}" style="--c:${cc(ev)}"><span class="bar"></span><span><b>${esc(ev.title)}</b>${sub?`<small>${esc(sub)}</small>`:''}</span><span class="tm">${tl}</span></button>`;
}
function listHTML(){
  const start=parse(today());let h='',count=0;const t=today();
  for(let i=0;i<180&&count<80;i++){const d=ymd(addDays(start,i)),evs=eventsOn(d),ts=tasksDue(d).filter(x=>!x.t.done);
    if(!evs.length&&!ts.length)continue;count++;
    h+=`<section class="lgroup"><h3 class="${d===t?'is-today':''}">${longDate(d)}${d===t?' · Today':''}</h3>${evs.length?`<div class="items">${evs.map(e=>itemHTML(e,d)).join('')}</div>`:''}${ts.length?`<div class="items">${ts.map(taskItem).join('')}</div>`:''}</section>`}
  return h||`<div class="empty" style="margin-top:14px">Nothing scheduled in the next six months. <button data-new="${t}">Add an event</button></div>`;
}

/* ================= navigation ================= */
function zoomAnim(dir,ox,oy){
  const r=pane.getBoundingClientRect();pane.style.transformOrigin=ox!=null?`${ox-r.left}px ${oy-r.top}px`:`50% ${Math.max(0,topH()-r.top+120)}px`;
  try{pane.animate([{transform:`scale(${dir>0?.84:1.18})`,opacity:.05},{transform:'none',opacity:1}],{duration:400,easing:'cubic-bezier(.2,.9,.25,1)'})}catch(e){}
}
function go(v,o={}){
  if(o.date)setSel(o.date);
  ui.view=v;saveUi();closeMenu();
  pane.style.transform='';pane.style.opacity='';
  if(v==='month'){if(o.rowH!=null)ui.rowH=o.rowH;initRange(o.date||ui.sel);ui.visM=firstOf(o.date||ui.sel)}
  if(v==='year')ui.year=parse(o.date||ui.sel).getFullYear();
  render({noAnchor:true,force:true});
  if(v==='month')positionMonth(o.date||ui.sel,o.oy,o.toSection);
  else if(v==='week'||v==='day')positionTimeline(o.minute,o.my);
  else window.scrollTo(0,0);
  if(o.dir)zoomAnim(o.dir,o.ox,o.oy);
}
function stepData(dir){if(ui.view==='year')ui.year+=dir;else if(ui.view==='week')setSel(shift(ui.sel,7*dir));else if(ui.view==='day')setSel(shift(ui.sel,dir))}
function slide(dir){
  const w=pane.offsetWidth+40;pane.style.transition='transform .17s ease-in';pane.style.transform=`translateX(${-dir*w}px)`;
  setTimeout(()=>{stepData(dir);render({force:true});pane.style.transition='none';pane.style.transform=`translateX(${dir*w}px)`;void pane.offsetWidth;
    pane.style.transition='transform .32s cubic-bezier(.2,.9,.25,1)';pane.style.transform='';setTimeout(()=>pane.style.transition='',340)},170);
}
function selectDay(d){if(d===ui.sel)return;const dir=d>ui.sel?1:-1;
  if(ui.view==='day'){const w=pane.offsetWidth+40;pane.style.transition='transform .17s ease-in';pane.style.transform=`translateX(${-dir*w}px)`;
    setTimeout(()=>{setSel(d);render({force:true});pane.style.transition='none';pane.style.transform=`translateX(${dir*w}px)`;void pane.offsetWidth;pane.style.transition='transform .32s cubic-bezier(.2,.9,.25,1)';pane.style.transform=''},170)}
  else{setSel(d);render()}}

/* ================= gestures ================= */
let G={mode:null},P=null,noClickUntil=0;
const suppressClick=()=>{noClickUntil=performance.now()+450};
function hit(x,y,sel){for(const el of document.elementsFromPoint(x,y)){const c=el.closest&&el.closest(sel);if(c&&pane.contains(c))return c}return null}
const rubber=(v,a,b)=>v>b?b+(v-b)*.22:v<a?a-(a-v)*.22:v;
function tween(from,to,ms,fn,done){const t0=performance.now();const st=t=>{const k=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-k,3);fn(from+(to-from)*e);if(k<1)requestAnimationFrame(st);else done&&done()};requestAnimationFrame(st)}

/* pinch core: s = finger distance ratio, sy = vertical distance ratio */
function pinchBegin(cx,cy,axis){
  P={cx,cy,axis,view:ui.view,s:1,raw:null};
  if(ui.view==='month'){P.h0=ui.rowH;P.row=hit(cx,cy,'.wrow')||captureRow();if(P.row){const r=P.row.getBoundingClientRect();P.ratio=clamp((cy-r.top)/r.height,0,1)}}
  else if((ui.view==='week'||ui.view==='day')&&axis==='v'){P.h0=ui.hourH;P.min=minuteAt(cy)}
  else{const r=pane.getBoundingClientRect();pane.style.transformOrigin=`${cx-r.left}px ${cy-r.top}px`;pane.style.transition='none'}
}
function captureRow(){const a=captureAnchor();return a?pane.querySelector(`.wrow[data-w="${a.key}"]`):null}
function pinchMove(s,sy,cx,cy){
  if(!P)return;if(ui.pinchRev){s=1/s;sy=1/sy}
  P.s=s;P.cx=cx;P.cy=cy;
  if(P.view==='month'){const raw=P.h0*s;P.raw=raw;setRowH(rubber(raw,ROWMIN,rowMax()));
    if(P.row){const r=P.row.getBoundingClientRect();quietScroll(r.top-(cy-P.ratio*r.height))}}
  else if(P.min!=null){const raw=P.h0*sy;P.raw=raw;setHour(rubber(raw,HMIN,HMAX));const tl=$('#tl');if(tl)quietScroll(tl.getBoundingClientRect().top+P.min/60*ui.hourH-cy)}
  else{const k=1+(s-1)*.3;pane.style.transform=`scale(${k})`;pane.style.opacity=String(clamp(1-Math.abs(s-1)*1.4,.3,1))}
}
function pinchEnd(){
  const p=P;P=null;if(!p)return;const{s,cx,cy}=p;
  if(p.view==='month'){
    const mx=rowMax();
    if(p.raw>mx*1.16){const d=hit(cx,cy,'[data-day]')?.dataset.day||firstDayOfRow(p.row)||ui.sel;ui.rowH=mx;haptic();return go('week',{date:d,dir:1,ox:cx,oy:cy})}
    if(p.raw<ROWMIN*.8){ui.rowH=ROWMIN;haptic();return go('year',{date:ymd(ui.visM),dir:-1,ox:cx,oy:cy})}
    const to=clamp(ui.rowH,ROWMIN,mx);
    if(to!==ui.rowH){const row=p.row,ratio=p.ratio;tween(ui.rowH,to,220,h=>{setRowH(h);if(row){const r=row.getBoundingClientRect();quietScroll(r.top-(cy-ratio*r.height))}},()=>{saveUi();flushDirty();updateVisMonth()})}
    else{saveUi();flushDirty();updateVisMonth()}
    return;
  }
  if(p.min!=null){
    if(p.raw<HMIN*.72){setHour(HMIN);saveUi();haptic();return ui.view==='day'?go('week',{dir:-1,ox:cx,oy:cy}):go('month',{date:ui.sel,rowH:rowMax(),dir:-1,ox:cx,oy:cy})}
    if(p.raw>HMAX*1.3&&ui.view==='week'){setHour(HMAX*.6);saveUi();haptic();return go('day',{date:colDayAt(cx)||ui.sel,dir:1,ox:cx,oy:cy,minute:p.min,my:cy})}
    const to=clamp(ui.hourH,HMIN,HMAX),m=p.min;
    if(to!==ui.hourH)tween(ui.hourH,to,220,h=>{setHour(h);const tl=$('#tl');if(tl)quietScroll(tl.getBoundingClientRect().top+m/60*h-cy)},()=>{saveUi();flushDirty()});
    else{saveUi();flushDirty()}
    return;
  }
  const reset=()=>{pane.style.transition='transform .25s cubic-bezier(.2,.9,.25,1),opacity .25s';pane.style.transform='';pane.style.opacity='';setTimeout(()=>pane.style.transition='',260)};
  const v=p.view;
  if(v==='year'&&s>1.14){const m=hit(cx,cy,'[data-m]');haptic();return go('month',{date:m?m.dataset.m:ymd(new Date(ui.year,0,1)),dir:1,ox:cx,oy:cy,toSection:true})}
  if(v==='week'&&s>1.14){haptic();return go('day',{date:colDayAt(cx)||ui.sel,dir:1,ox:cx,oy:cy,minute:minuteAt(cy),my:cy})}
  if(v==='week'&&s<.88){haptic();return go('month',{date:ui.sel,rowH:rowMax(),dir:-1,ox:cx,oy:cy})}
  if(v==='day'&&s<.88){haptic();return go('week',{dir:-1,ox:cx,oy:cy,minute:minuteAt(cy),my:cy})}
  if(v==='list'&&s<.88)return go('month',{dir:-1});
  reset();flushDirty();
}
const firstDayOfRow=row=>row?.querySelector('[data-day]')?.dataset.day;

/* touch handling */
view.addEventListener('touchstart',e=>{
  const n=e.touches.length;
  if(n===2){if(G.mode==='drag')return;clearTimeout(G.timer);if(G.mode==='swipe')swipeReset();
    const[a,b]=e.touches,dx=Math.abs(a.clientX-b.clientX),dy=Math.abs(a.clientY-b.clientY);
    G={mode:'pinch',d0:Math.max(Math.hypot(dx,dy),20),dy0:Math.max(dy,40)};
    pinchBegin((a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2,dx>dy*1.15?'h':'v');return}
  if(n!==1||G.mode)return;
  const t=e.touches[0];
  G={mode:'pending',x0:t.clientX,y0:t.clientY,x:t.clientX,y:t.clientY,t0:performance.now(),target:e.target};
  G.timer=setTimeout(longPress,430);
},{passive:true});
view.addEventListener('touchmove',e=>{
  if(G.mode==='pinch'){if(e.touches.length<2)return;e.preventDefault();const[a,b]=e.touches;
    pinchMove(Math.max(Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),1)/G.d0,Math.max(Math.abs(a.clientY-b.clientY),40)/G.dy0,(a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);return}
  const t=e.touches[0];if(!t)return;G.x=t.clientX;G.y=t.clientY;
  if(G.mode==='drag'){e.preventDefault();dragMove();return}
  if(G.mode==='pending'){const dx=G.x-G.x0,dy=G.y-G.y0;if(Math.hypot(dx,dy)>9){clearTimeout(G.timer);
    G.mode=(['day','week','year'].includes(ui.view)&&Math.abs(dx)>Math.abs(dy)*1.2)?'swipe':'scroll';if(G.mode==='swipe')pane.style.transition='none'}}
  if(G.mode==='swipe'){e.preventDefault();pane.style.transform=`translateX(${G.x-G.x0}px)`}
},{passive:false});
function touchFinish(e,cancel){
  if(G.mode==='pinch'){if(e.touches.length<2){pinchEnd();G={mode:e.touches.length?'done':null}}return}
  if(G.mode==='done'){if(!e.touches.length)G={mode:null};return}
  clearTimeout(G.timer);const lp=G.lp;
  if(G.mode==='drag'){cancel?dragCancel():dragEnd()}
  else if(G.mode==='swipe'){const dx=G.x-G.x0,v=dx/(performance.now()-G.t0);if(!cancel&&(Math.abs(dx)>pane.offsetWidth*.22||Math.abs(v)>.55))slide(dx<0?1:-1);else swipeReset()}
  if(lp)suppressClick();
  if(!e.touches||!e.touches.length)G={mode:null};
  flushDirty();
}
view.addEventListener('touchend',e=>touchFinish(e,false));
view.addEventListener('touchcancel',e=>touchFinish(e,true));
function swipeReset(){pane.style.transition='transform .28s cubic-bezier(.2,.9,.25,1)';pane.style.transform='';setTimeout(()=>pane.style.transition='',300)}
view.addEventListener('contextmenu',e=>e.preventDefault());

/* mouse: hold to create/drag, double-click to create, ctrl+wheel to zoom */
view.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||G.mode)return;
  G={mode:'pending',mouse:true,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,t0:performance.now(),target:e.target};G.timer=setTimeout(longPress,450)});
addEventListener('pointermove',e=>{if(!G.mouse)return;G.x=e.clientX;G.y=e.clientY;
  if(G.mode==='pending'&&Math.hypot(G.x-G.x0,G.y-G.y0)>5){clearTimeout(G.timer);G.mode='scroll'}
  if(G.mode==='drag')dragMove()});
addEventListener('pointerup',e=>{if(!G.mouse)return;clearTimeout(G.timer);const lp=G.lp;if(G.mode==='drag')dragEnd();if(lp)suppressClick();G={mode:null};flushDirty()});
view.addEventListener('dblclick',e=>{if(ui.view!=='week'&&ui.view!=='day')return;if(e.target.closest('.blk,.ev'))return;const tl=$('#tl');if(!tl||e.clientY<tl.getBoundingClientRect().top)return;
  const day=colDayAt(e.clientX),s=clamp(Math.floor(minuteAt(e.clientY)/30)*30,0,1380);openNew({date:day,start:fromMin(s),end:fromMin(s+60),draft:makeDraft(day,s,s+60)})});
let W=null,wT=0;
addEventListener('wheel',e=>{if(!e.ctrlKey||!$('#sheet').hidden)return;e.preventDefault();
  if(!W){W={s:1};pinchBegin(e.clientX,e.clientY,'v')}
  W.s*=Math.exp(-e.deltaY/110);pinchMove(W.s,W.s,e.clientX,e.clientY);
  clearTimeout(wT);wT=setTimeout(()=>{W=null;pinchEnd()},170)},{passive:false});

/* long press */
function longPress(){
  if(G.mode!=='pending')return;
  const{x,y,target}=G;G.lp=true;
  if((ui.view==='week'||ui.view==='day')&&pane.contains(target)){
    const blk=target.closest('.blk');
    if(blk){const ev=S.events[blk.dataset.ev];
      if(!ev||isRep(ev)||isMulti(ev)){G.mode='done';haptic();toast('Open a repeating event to change its time');return}
      const r=blk.getBoundingClientRect(),{s,e}=span(ev),resize=r.height>34&&y>r.bottom-Math.max(14,r.height*.25);
      haptic();blk.classList.add('lift');if(!blk.querySelector('.h2'))blk.insertAdjacentHTML('beforeend','<span class="h2"></span>');
      G.mode='drag';G.drag={kind:resize?'resize':'move',el:blk,id:blk.dataset.ev,s,e,day:blk.dataset.d,grab:minuteAt(y)-s};autoScroll();return}
    const ach=target.closest('.alld .ev');if(ach){if(ach.dataset.task||(S.events[ach.dataset.ev]&&!isRep(S.events[ach.dataset.ev])&&ui.view==='week')){startChipDrag(ach,x,y);return}G.mode='done';return}
    if(target.closest('.alld')){G.mode='done';haptic();openNew({date:colDayAt(x)||ui.sel,allDay:true});return}
    const tl=$('#tl');if(tl&&y>tl.getBoundingClientRect().top){const day=ui.view==='day'?ui.sel:colDayAt(x);
      const s=clamp(snap(minuteAt(y)-30),0,1380);haptic();
      G.mode='drag';G.drag={kind:'create',el:makeDraft(day,s,s+60),s,e:s+60,day,grab:minuteAt(y)-s};autoScroll();return}
    G.mode='done';return;
  }
  if(ui.view==='month'){
    const chip=target.closest('.ev[data-ev],.ev[data-task]');
    if(chip){if(chip.dataset.task||(S.events[chip.dataset.ev]&&!isRep(S.events[chip.dataset.ev]))){startChipDrag(chip,x,y);return}G.mode='done';return}
    const day=target.closest('[data-day]');if(day){G.mode='done';haptic();openNew({date:day.dataset.day});return}
  }
  G.mode='done';
}
function startChipDrag(chip,x,y){haptic();const r=chip.getBoundingClientRect(),gh=chip.cloneNode(true);gh.classList.add('ghost');gh.style.width=r.width+'px';gh.style.height=r.height+'px';
  gh.style.transform=`translate(${r.left}px,${r.top}px) scale(1.06)`;document.body.appendChild(gh);chip.style.opacity='.3';
  G.mode='drag';G.drag={kind:'chip',id:chip.dataset.ev,task:chip.dataset.task?chip.dataset.task.split('|'):null,ghost:gh,src:chip,gx:x-r.left,gy:y-r.top,from:dropDayAt(x,y)?.d||chip.dataset.d,over:null,to:null};autoScroll()}
function dropDayAt(x,y){for(const el of document.elementsFromPoint(x,y)){if(!el.closest)continue;const h=el.closest('[data-hd]');if(h)return{d:h.dataset.hd,el:h};const b=el.closest('.dbg');if(b&&pane.contains(b))return{d:b.dataset.day,el:b}}
  if((ui.view==='week'||ui.view==='day')&&y>topH()){const d=colDayAt(x);if(d)return{d,el:null}}return null}
function makeDraft(day,s,e){
  const c=pane.querySelector(`.col[data-col="${day}"]`);if(!c)return null;
  const el=document.createElement('div');el.className='blk draft lift';el.style.setProperty('--c',col(calOf(settings().defaultCal).color));
  el.innerHTML='<b>New Event</b><small></small><span class="h2"></span>';c.appendChild(el);placeBlk(el,s,e);return el;
}
function placeBlk(el,s,e){if(!el)return;el.style.top=`calc(var(--hour)*${s/60})`;el.style.height=`calc(var(--hour)*${(e-s)/60} - 2px)`;const sm=el.querySelector('small');if(sm)sm.textContent=`${fromMin(s)} – ${fromMin(e)}`}
function dragMove(){
  const d=G.drag;if(!d)return;const x=G.x,y=G.y;
  if(d.kind==='chip'){d.ghost.style.transform=`translate(${x-d.gx}px,${y-d.gy}px) scale(1.06)`;const t=dropDayAt(x,y),el=t?.el||null;if(d.over!==el){d.over?.classList.remove('drop');el?.classList.add('drop');d.over=el}if(d.to!==(t?.d||null)){d.to=t?.d||null;if(t)haptic()}return}
  const m=minuteAt(y);
  if(d.kind==='resize'){const e=clamp(snap(m),d.s+15,1440);if(e!==d.e){d.e=e;haptic()}}
  else{const dur=d.e-d.s,s=clamp(snap(m-d.grab),0,1440-dur);if(s!==d.s){d.s=s;d.e=s+dur}
    if(ui.view==='week'){const day=colDayAt(x);if(day&&day!==d.day){d.day=day;pane.querySelector(`.col[data-col="${day}"]`)?.appendChild(d.el);haptic()}}}
  placeBlk(d.el,d.s,d.e);
}
function autoScroll(){const loop=()=>{if(G.mode!=='drag')return;const top=topH()+30,bot=innerHeight-110;let v=0;
  if(G.y<top)v=-Math.min(16,(top-G.y)/3);else if(G.y>bot)v=Math.min(16,(G.y-bot)/3);
  if(v){window.scrollBy(0,v);dragMove()}requestAnimationFrame(loop)};requestAnimationFrame(loop)}
function dragEnd(){
  const d=G.drag;G.drag=null;if(!d)return;
  if(d.kind==='chip'){d.ghost.remove();d.over?.classList.remove('drop');d.src.style.opacity='';const to=d.to;
    if(to&&to!==d.from&&d.task){editList(d.task[0],l=>{const t=findTask(l,d.task[1]);if(t)t.due=to});return}
    if(to&&to!==d.from&&d.id){const ev=clone(S.events[d.id]),k=dayDiff(d.from,to);ev.date=shift(ev.date,k);if(ev.endDate)ev.endDate=shift(ev.endDate,k);put(d.id,ev)}return}
  if(d.kind==='create'){const el=d.el;G.mode=null;openNew({date:d.day,start:fromMin(d.s),end:fromMin(Math.min(d.e,1439)),draft:el,half:true});return}
  d.el.classList.remove('lift');const ev=clone(S.events[d.id]);
  ev.date=d.day;ev.endDate='';ev.start=fromMin(d.s);ev.end=d.e>=1440?'23:59':fromMin(d.e);put(d.id,ev);
}
function dragCancel(){const d=G.drag;G.drag=null;if(!d)return;if(d.kind==='chip'){d.ghost.remove();d.over?.classList.remove('drop');d.src.style.opacity=''}else if(d.kind==='create')d.el?.remove();render({force:true})}

/* taps */
view.addEventListener('click',e=>{
  if(performance.now()<noClickUntil)return;
  const tk=e.target.closest('[data-task]');if(tk){const[lid,tid]=tk.dataset.task.split('|');if(e.target.closest('[data-tchk]')){haptic();return editList(lid,l=>{const t=findTask(l,tid);if(t)t.done=!t.done})}return sheetOpen(taskPage(lid,tid))}
  const ev=e.target.closest('[data-ev]');if(ev)return openDetail(ev.dataset.ev,ev.dataset.d);
  const nw=e.target.closest('[data-new]');if(nw)return openNew({date:nw.dataset.new});
  const ag=e.target.closest('[data-agchk]');if(ag){const[lid,tid]=ag.dataset.agchk.split('|');return editList(lid,l=>{const t=findTask(l,tid);t.done=!t.done})}
  if(ui.view==='month'){const d=e.target.closest('[data-day]');if(d)return go('day',{date:d.dataset.day,dir:1,ox:e.clientX,oy:e.clientY})}
  if(ui.view==='year'){const m=e.target.closest('[data-m]');if(m)return go('month',{date:m.dataset.m,dir:1,ox:e.clientX,oy:e.clientY,toSection:true})}
});
$('#strip').addEventListener('click',e=>{const b=e.target.closest('[data-hd]');if(!b)return;
  if(ui.view==='week')go('day',{date:b.dataset.hd,dir:1,ox:e.clientX,oy:e.clientY,minute:minuteAt(topH()+10),my:topH()+10});else selectDay(b.dataset.hd)});
$('#b-back').onclick=e=>{if(ui.view==='month')go('year',{date:ymd(ui.visM),dir:-1});else go('month',{date:ui.sel,dir:-1})};
$('#b-today').onclick=()=>{const t=today();
  if(ui.view==='month'){const cell=pane.querySelector(`.dbg[data-day="${t}"]`);if(!cell){initRange(t);render({noAnchor:true})}
    const row=pane.querySelector(`.dbg[data-day="${t}"]`)?.closest('.wrow');if(row)window.scrollTo({top:scrollY+row.getBoundingClientRect().top-topH()-(innerHeight-topH())*.28,behavior:'smooth'})}
  else if(ui.view==='year'){if(ui.year!==new Date().getFullYear()){ui.year=new Date().getFullYear();render()}window.scrollTo({top:0,behavior:'smooth'})}
  else if(ui.view==='list')window.scrollTo({top:0,behavior:'smooth'});
  else if(weekDays(ui.sel).includes(t)){if(ui.view==='day')selectDay(t);else{setSel(t);render()}positionTimeline(null)}
  else{const dir=t>ui.sel?1:-1;const w=pane.offsetWidth+40;pane.style.transition='transform .17s ease-in';pane.style.transform=`translateX(${-dir*w}px)`;
    setTimeout(()=>{setSel(t);render({force:true});positionTimeline(null);pane.style.transition='none';pane.style.transform=`translateX(${dir*w}px)`;void pane.offsetWidth;pane.style.transition='transform .32s cubic-bezier(.2,.9,.25,1)';pane.style.transform=''},170)}
};
function defaultNewDate(){if(ui.view==='month'){const t=today();return ui.visM.getTime()===firstOf(t).getTime()?t:ymd(ui.visM)}if(ui.view==='year'||ui.view==='list')return today();return ui.sel}
$('#b-add').onclick=()=>openNew({date:defaultNewDate()});
$('#b-lists').onclick=()=>sheetOpen(listsPage(),{detent:'large'});
$('#b-cals').onclick=()=>sheetOpen(calsPage(),{detent:'large'});
$('#b-search').onclick=()=>sheetOpen(searchPage(),{detent:'large'});
addEventListener('keydown',e=>{if(!$('#sheet').hidden||e.target.matches('input,textarea,select'))return;
  if(e.key==='ArrowLeft'&&['day','week','year'].includes(ui.view))slide(-1);else if(e.key==='ArrowRight'&&['day','week','year'].includes(ui.view))slide(1);
  else if(e.key==='t')$('#b-today').click()});
let rzT=0;addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(()=>render(),120)});

/* view menu */
const menu=$('#menu');
function closeMenu(){menu.hidden=true}
$('#b-mode').onclick=e=>{e.stopPropagation();if(!menu.hidden)return closeMenu();
  const v=ui.view,opts=[['year','Year'],['month','Month'],['week','Week'],['day','Day'],['list','List']];
  menu.innerHTML=opts.map(([k,n])=>`<button role="menuitemradio" data-mode="${k}" aria-checked="${v===k}"><span class="ck">${v===k?'✓':''}</span>${n}</button>`).join('')
    +(v==='month'?`<hr><small>Month detail</small>${[['c','Compact',ROWMIN],['s','Stacked',112],['d','Details',rowMax()]].map(([k,n,h])=>`<button data-den="${h}"><span class="ck">${Math.abs(ui.rowH-h)<12?'✓':''}</span>${n}</button>`).join('')}`:'');
  const r=$('#b-mode').getBoundingClientRect();menu.hidden=false;menu.style.top=(r.bottom+8)+'px';menu.style.right=Math.max(12,innerWidth-r.right-4)+'px'};
menu.addEventListener('click',e=>{
  const b=e.target.closest('[data-mode]');if(b){const order=['year','month','week','day'],a=order.indexOf(ui.view),z=order.indexOf(b.dataset.mode);
    closeMenu();if(b.dataset.mode!==ui.view)go(b.dataset.mode,{dir:a<0||z<0?0:(z>a?1:-1),date:b.dataset.mode==='month'&&ui.view==='year'?ymd(new Date(ui.year,new Date().getMonth(),1)):undefined});return}
  const d=e.target.closest('[data-den]');if(d){closeMenu();const row=captureRow(),r0=row?.getBoundingClientRect().top;
    tween(ui.rowH,+d.dataset.den,320,h=>{setRowH(h);if(row)quietScroll(row.getBoundingClientRect().top-r0)},()=>{saveUi();updateVisMonth()})}});
addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!e.target.closest('#b-mode'))closeMenu()});

/* ================= sheets ================= */
const sheetEl=$('#sheet');
const SH={stack:[],onClose:null};
function sheetOpen(page,o={}){
  closeMenu();
  sheetEl.innerHTML=`<div class="scrim"></div><div class="sheet ${o.detent||''}" role="dialog" aria-modal="true"><div class="grabber"></div><div class="pages"></div></div>`;
  sheetEl.hidden=false;sheetEl.classList.toggle('light',o.detent==='half');SH.stack=[];SH.onClose=o.onClose||null;
  pushPage(page,false);
  requestAnimationFrame(()=>requestAnimationFrame(()=>sheetEl.classList.add('open')));
  const scr=sheetEl.querySelector('.scrim');scr.onclick=()=>sheetClose();scr.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});scr.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
  bindSheetDrag();
}
function headHTML(page,depth){
  const L=page.left||(depth?'back':'close');
  const left=L==='none'?'<span class="cbtn ghostbtn"></span>':`<button class="cbtn" data-h="left" aria-label="${L==='back'?'Back':'Close'}">${L==='back'?I.back:I.x}</button>`;
  const R=page.right;let right='<span class="cbtn ghostbtn"></span>';
  if(R)right=R.label?`<button class="tbtn" data-h="right">${esc(R.label)}</button>`:`<button class="cbtn ok" data-h="right" aria-label="${esc(R.aria||'Done')}" ${R.disabled?'disabled':''}>${I.check}</button>`;
  return `<div class="phd">${left}<h2>${esc(page.title||'')}</h2>${right}</div>`;
}
function pushPage(page,anim=true){
  const pages=sheetEl.querySelector('.pages');if(!pages)return;
  const el=document.createElement('section');el.className='page';
  el.innerHTML=headHTML(page,SH.stack.length)+`<div class="pbody">${page.html()}</div>`;
  const prev=SH.stack[SH.stack.length-1];
  if(anim){el.classList.add('enter');pages.appendChild(el);void el.offsetWidth;el.classList.remove('enter');prev&&prev.el.classList.add('under')}else pages.appendChild(el);
  SH.stack.push({page,el});
  el.querySelector('[data-h="left"]')?.addEventListener('click',()=>SH.stack.length>1&&(page.left||'back')!=='close'?popPage():(page.onLeft?page.onLeft():sheetClose()));
  el.querySelector('[data-h="right"]')?.addEventListener('click',()=>page.right&&page.right.act());
  page.mount&&page.mount(el);
}
function popPage(){if(SH.stack.length<2)return sheetClose();const top=SH.stack.pop();top.el.classList.add('enter');const prev=SH.stack[SH.stack.length-1];prev.el.classList.remove('under');
  prev.page.resume&&prev.page.resume(prev.el);setTimeout(()=>top.el.remove(),400)}
function refreshPage(entry){entry.el.querySelector('.pbody').innerHTML=entry.page.html();entry.page.mount&&entry.page.mount(entry.el)}
function sheetClose(){if(sheetEl.hidden)return;sheetEl.classList.remove('open');const cb=SH.onClose;SH.onClose=null;
  setTimeout(()=>{sheetEl.hidden=true;sheetEl.innerHTML='';SH.stack=[]},420);cb&&cb()}
function setDetent(d){const s=sheetEl.querySelector('.sheet');if(!s)return;s.classList.remove('half','large');if(d)s.classList.add(d);sheetEl.classList.toggle('light',d==='half')}
function bindSheetDrag(){
  const sh=sheetEl.querySelector('.sheet');let st=null;
  sh.addEventListener('touchstart',e=>{if(!e.target.closest('.grabber,.phd')||e.target.closest('button'))return;st={y:e.touches[0].clientY,t:performance.now(),dy:0};sh.style.transition='none'},{passive:true});
  sh.addEventListener('touchmove',e=>{if(!st)return;st.dy=e.touches[0].clientY-st.y;sh.style.transform=`translateY(${Math.max(st.dy,-30)*(st.dy<0?.3:1)}px)`},{passive:true});
  sh.addEventListener('touchend',()=>{if(!st)return;const{dy,t}=st;st=null;sh.style.transition='';sh.style.transform='';const v=dy/(performance.now()-t);
    if(dy>110||v>.7)sheetClose();else if(dy<-20&&sh.classList.contains('half'))setDetent('large')});
}
addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#act').hidden)return;if(!sheetEl.hidden)(SH.stack.length>1?popPage():sheetClose());closeMenu()}});

function actionSheet(opts,msg){
  return new Promise(res=>{const el=$('#act');
    el.innerHTML=`<div class="ascrim"></div><div class="acards"><div class="acard glass">${msg?`<p>${esc(msg)}</p>`:''}${opts.map((o,i)=>`<button data-i="${i}" class="${o.red?'red':'plain'}">${esc(o.label)}</button>`).join('')}</div><div class="acard glass"><button data-i="-1" class="bold">Cancel</button></div></div>`;
    el.hidden=false;requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('open')));
    el.onclick=e=>{const b=e.target.closest('[data-i]');if(!b&&!e.target.classList.contains('ascrim'))return;const i=b?+b.dataset.i:-1;
      el.classList.remove('open');setTimeout(()=>{el.hidden=true;el.innerHTML=''},300);res(i>=0?opts[i].act:null)}});
}

/* ---- event detail ---- */
function openDetail(id,occ){if(!S.events[id])return;sheetOpen(detailPage(id,occ||S.events[id].date))}
function whenLines(ev,occ){
  if(isMulti(ev))return ev.allDay?[`${cardDate(ev.date)} –`,`${cardDate(ev.endDate)}`]:[`from ${ev.start} ${cardDate(ev.date)}`,`to ${ev.end} ${cardDate(ev.endDate)}`];
  return [fullDate(occ),ev.allDay?'All-day':`from ${ev.start} to ${ev.end}`];
}
function detailPage(id,occ){
  const pg={title:'',right:{label:'Edit',act:()=>pushPage(editorPage(id,{occ}))},
    html(){const ev=S.events[id];if(!ev)return '<div class="empty">This event was deleted.</div>';const c=calOf(ev.cal),[l1,l2]=whenLines(ev,occ);
      return `<div class="dhead" style="--c:${col(c.color)}"><span class="dbar"></span><div><h2>${esc(ev.title)}</h2>${ev.loc?`<p class="m">${esc(ev.loc)}</p>`:''}<p>${l1}</p><p>${l2}</p>${isRep(ev)?`<p class="m">Repeats ${repName(ev.repeat).toLowerCase()}${ev.until?' until '+cardDate(ev.until):''}</p>`:''}</div></div>
        <div class="group"><div class="row"><span class="ri">${I.cal}</span><span>Calendar</span><span class="val" style="--c:${col(c.color)}"><i></i><span class="vt">${esc(c.name)}</span></span></div></div>
        ${ev.url?`<div class="group"><a class="row" href="${esc(/^https?:/i.test(ev.url)?ev.url:'https://'+ev.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="ri">${I.link}</span><span style="color:var(--accent);overflow-wrap:anywhere">${esc(ev.url)}</span></a></div>`:''}
        ${ev.notes?`<div class="sec"><h4>Notes</h4><div class="group"><div class="notes">${esc(ev.notes)}</div></div></div>`:''}
        <div class="group"><button class="row red" data-del>Delete Event</button></div>`},
    mount(el){el.querySelector('[data-del]')?.addEventListener('click',async()=>{const ev=S.events[id];if(!ev)return;
      if(isRep(ev)){const a=await actionSheet([{label:'Delete This Event Only',act:'one',red:true},{label:'Delete All Future Events',act:'future',red:true}],'This is a repeating event.');if(!a)return;
        if(a==='one'){const n=clone(ev);n.skip=[...(n.skip||[]),occ];put(id,n)}else if(occ<=ev.date)drop(id);else{const n=clone(ev);n.until=shift(occ,-1);put(id,n)}}
      else{const a=await actionSheet([{label:'Delete Event',act:'del',red:true}],'Are you sure you want to delete this event?');if(!a)return;drop(id)}
      sheetClose()})},
    resume(el){refreshPage(SH.stack[SH.stack.length-1])}};
  return pg;
}

/* ---- event editor ---- */
function openNew(o){
  const half=!!o.half;
  sheetOpen(editorPage(null,o),{detent:half?'half':'large',onClose:()=>{if(o.draft)o.draft.remove();render()}});
  if(o.draft&&half){const r=o.draft.getBoundingClientRect(),room=innerHeight*.42-10;if(r.bottom>room||r.top<topH())window.scrollBy({top:r.top-Math.max(topH()+12,room-r.height),behavior:'smooth'})}
}
function editorPage(id,o={}){
  const ex=id?S.events[id]:null,st=settings();
  const occ=o.occ||(ex&&ex.date);
  let f;
  if(ex){f=clone(ex);if(isRep(ex)&&occ){f.date=occ}f.endDate=isMulti(ex)?ex.endDate:f.date;f.start=f.start||'09:00';f.end=f.end||'10:00';f.until=f.until||''}
  else{const d=o.date||today();let s=o.start,e=o.end;if(!s){const h=d===today()?Math.min(23,new Date().getHours()+1):9;s=`${pad(h)}:00`;e=fromMin(Math.min(1439,h*60+60))}
    f={title:'',loc:'',allDay:!!o.allDay,date:d,endDate:d,start:s,end:e,repeat:'none',until:'',cal:st.defaultCal,url:'',notes:''}}
  let expanded=!ex&&!o.draft||o.allDay;
  const draft=o.draft;
  const bad=()=>!f.allDay&&f.endDate===f.date&&toMin(f.end)<=toMin(f.start)||f.endDate<f.date;
  const page={title:ex?'Edit Event':'New Event',left:ex?undefined:'close',
    right:{aria:ex?'Save':'Add',disabled:!f.title.trim(),act:()=>save()},
    html(){const c=calOf(f.cal);
      return `<div class="ecard" style="--c:${col(c.color)}">
          <input class="etitle" id="e-title" placeholder="Title" value="${esc(f.title)}" autocomplete="off" enterkeyhint="done">
          <button class="ewhen" id="e-when"><span class="wd"></span><span class="wt"></span></button>
        </div>
        <div class="group" id="e-x" ${expanded?'':'hidden'}>
          <div class="row"><span>All-day</span><input type="checkbox" class="sw" id="e-ad" ${f.allDay?'checked':''}></div>
          <div class="row"><span>Starts</span><span class="pills"><input type="date" class="pill" id="e-sd" value="${f.date}"><input type="time" class="pill" id="e-st" value="${f.start}" ${f.allDay?'hidden':''}></span></div>
          <div class="row"><span>Ends</span><span class="pills"><input type="date" class="pill" id="e-ed" value="${f.endDate}"><input type="time" class="pill" id="e-et" value="${f.end}" ${f.allDay?'hidden':''}></span></div>
        </div>
        <div class="sec"><h4>Location</h4><div class="group"><div class="row"><span class="ri">${I.pin}</span><input id="e-loc" placeholder="Location or Video Call" value="${esc(f.loc)}" autocomplete="off"></div></div></div>
        <div class="sec"><h4>Options</h4><div class="group">
          <button class="row nav" data-go="cal"><span class="ri">${I.cal}</span><span>Calendar</span><span class="val" style="--c:${col(c.color)}"><i></i><span class="vt">${esc(c.name)}</span></span></button>
          <button class="row nav" data-go="rep"><span class="ri">${I.rep}</span><span>Repeat</span><span class="val">${repName(f.repeat)}</span></button>
          ${isRep(f)?`<button class="row nav" data-go="until"><span class="ri">${I.end}</span><span>End Repeat</span><span class="val">${f.until?cardDate(f.until):'Never'}</span></button>`:''}
        </div></div>
        <div class="sec"><h4>Details</h4><div class="group">
          <div class="row rtop"><span class="ri">${I.notes}</span><textarea id="e-notes" placeholder="Notes">${esc(f.notes)}</textarea></div>
          <div class="row"><span class="ri">${I.link}</span><input id="e-url" placeholder="URL" value="${esc(f.url)}" inputmode="url" autocomplete="off"></div>
        </div></div>
        <div class="err" id="e-err" hidden></div>`},
    mount(el){
      const q=s=>el.querySelector(s),okBtn=el.querySelector('[data-h="right"]');
      const paint=()=>{q('.wd').textContent=f.allDay?(f.endDate>f.date?`${cardDate(f.date)} – ${shortDate(f.endDate)}`:cardDate(f.date)):cardDate(f.date);
        q('.wt').textContent=f.allDay?'All-day':(f.endDate>f.date?`${f.start} → ${shortDate(f.endDate)} ${f.end}`:`${f.start}–${f.end}`);
        q('#e-when').classList.toggle('bad',bad());q('#e-et')?.classList.toggle('bad',bad());
        if(okBtn)okBtn.disabled=!f.title.trim()||bad();
        if(draft){if(f.allDay||f.endDate!==f.date)draft.style.display='none';else{draft.style.display='';const c2=pane.querySelector(`.col[data-col="${f.date}"]`);if(c2&&draft.parentNode!==c2)c2.appendChild(draft);
          draft.style.display=c2?'':'none';draft.style.setProperty('--c',col(calOf(f.cal).color));placeBlk(draft,toMin(f.start),Math.max(toMin(f.end),toMin(f.start)+15));draft.querySelector('b').textContent=f.title||'New Event'}}};
      paint();
      const ti=q('#e-title');ti.oninput=()=>{f.title=ti.value;paint()};ti.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ti.blur()}};
      if(!ex)setTimeout(()=>{if(!o.half)ti.focus({preventScroll:true})},380);
      el.addEventListener('focusin',e=>{if(e.target.matches('input,textarea')&&sheetEl.querySelector('.sheet.half'))setDetent('large')});
      q('#e-when').onclick=()=>{expanded=!expanded;q('#e-x').hidden=!expanded};
      q('#e-ad').onchange=e=>{f.allDay=e.target.checked;q('#e-st').hidden=q('#e-et').hidden=f.allDay;paint()};
      q('#e-sd').onchange=e=>{if(!e.target.value)return;const k=dayDiff(f.date,f.endDate);f.date=e.target.value;f.endDate=shift(f.date,Math.max(0,k));q('#e-ed').value=f.endDate;paint()};
      q('#e-ed').onchange=e=>{if(!e.target.value)return;f.endDate=e.target.value;paint()};
      q('#e-st').onchange=e=>{if(!e.target.value)return;const dur=Math.max(15,toMin(f.end)-toMin(f.start));f.start=e.target.value;if(f.endDate===f.date){f.end=fromMin(Math.min(1439,toMin(f.start)+dur));q('#e-et').value=f.end}paint()};
      q('#e-et').onchange=e=>{if(!e.target.value)return;f.end=e.target.value;paint()};
      q('#e-loc').oninput=e=>f.loc=e.target.value;q('#e-notes').oninput=e=>f.notes=e.target.value;q('#e-url').oninput=e=>f.url=e.target.value;
      el.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const g=b.dataset.go;setDetent('large');
        if(g==='cal')pushPage(choicePage('Calendar',settings().cals.map(c=>({k:c.id,label:c.name,color:col(c.color)})),f.cal,k=>{f.cal=k}));
        if(g==='rep')pushPage(choicePage('Repeat',REP.map(([k,l])=>({k,label:l})),f.repeat||'none',k=>{f.repeat=k;if(k==='none')f.until=''}));
        if(g==='until')pushPage(untilPage(f))});
    },
    resume(el){refreshPage(SH.stack[SH.stack.length-1])}};
  async function save(){
    const err=sheetEl.querySelector('#e-err');
    if(!f.title.trim()){err.textContent='Add a title.';err.hidden=false;return}
    if(bad()){err.textContent='The event ends before it starts.';err.hidden=false;return}
    const obj={type:'event',title:f.title.trim(),loc:(f.loc||'').trim(),allDay:!!f.allDay,date:f.date,endDate:f.endDate>f.date?f.endDate:'',
      start:f.allDay?'':f.start,end:f.allDay?'':f.end,repeat:f.repeat||'none',until:isRep(f)?(f.until||''):'',cal:f.cal,url:(f.url||'').trim(),notes:(f.notes||'').trim(),skip:[],updated:Date.now()};
    if(!ex){put(uid('ev'),obj)}
    else if(!isRep(ex)){obj.skip=ex.skip||[];put(id,obj)}
    else{const a=await actionSheet([{label:'Save for This Event Only',act:'one'},{label:'Save for Future Events',act:'future'}],'This is a repeating event.');if(!a)return;
      if(a==='one'){const n=clone(ex);n.skip=[...(n.skip||[]),occ];put(id,n);obj.repeat='none';obj.until='';obj.endDate=obj.endDate;put(uid('ev'),obj)}
      else if(occ<=ex.date){obj.skip=ex.skip||[];put(id,obj)}
      else{const n=clone(ex);n.until=shift(occ,-1);put(id,n);put(uid('ev'),obj)}}
    if(draft)draft.remove();
    SH.onClose=null;sheetClose();
  }
  return page;
}
function choicePage(title,items,cur,onPick){
  return{title,html(){return `<div class="group">${items.map(it=>`<button class="row" data-k="${esc(it.k)}">${it.color?`<span style="width:12px;height:12px;border-radius:50%;background:${it.color};flex:none"></span>`:''}<span>${esc(it.label)}</span>${it.k===cur?`<span class="ck">${I.check}</span>`:''}</button>`).join('')}</div>`},
    mount(el){el.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{cur=b.dataset.k;onPick(cur);el.querySelectorAll('.ck').forEach(x=>x.remove());b.insertAdjacentHTML('beforeend',`<span class="ck">${I.check}</span>`);setTimeout(popPage,160)})}};
}
function untilPage(f){
  return{title:'End Repeat',html(){return `<div class="group"><button class="row" data-u="never"><span>Never</span>${!f.until?`<span class="ck">${I.check}</span>`:''}</button>
      <div class="row"><span>On Date</span><span class="pills"><input type="date" class="pill" id="u-d" value="${f.until||shift(f.date,30)}"></span>${f.until?`<span class="ck" style="margin-left:8px">${I.check}</span>`:''}</div></div>`},
    mount(el){el.querySelector('[data-u]').onclick=()=>{f.until='';setTimeout(popPage,120)};el.querySelector('#u-d').onchange=e=>{if(e.target.value&&e.target.value>=f.date){f.until=e.target.value;setTimeout(popPage,150)}}}};
}

/* ---- calendars & settings ---- */
function calsPage(){
  const pg={title:'Calendars',left:'close',
    html(){const st=settings();
      return `<div class="sec"><h4>My Calendars</h4><div class="group">${st.cals.map(c=>`<div class="row" style="--c:${col(c.color)}"><button class="cbox${c.on?' on':''}" data-tog="${c.id}" aria-label="Show ${esc(c.name)}"></button><span style="flex:1">${esc(c.name)}</span><button class="tbtn" style="height:32px;padding:0 12px;font-size:14px" data-edit="${c.id}">Edit</button></div>`).join('')}
        <button class="row" data-add style="color:var(--accent)">Add Calendar</button></div></div>
        <div class="sec"><h4>Preferences</h4><div class="group">
          <button class="row nav" data-defcal><span>Default Calendar</span><span class="val"><span class="vt">${esc(calOf(st.defaultCal).name)}</span></span></button>
          <div class="row"><span>Week Starts On</span><div class="mseg"><button data-ws="0" aria-pressed="${ui.ws===0}">Sunday</button><button data-ws="1" aria-pressed="${ui.ws===1}">Monday</button></div></div>
          <div class="row"><span>Reverse Pinch</span><input type="checkbox" class="sw" id="prv" ${ui.pinchRev?'checked':''}></div></div>
          <p class="note" style="margin-top:8px">Spread two fingers on the month to see more of each event, keep spreading to open the week, then the day. Pinch to go back out to the year.</p></div>
        ${syncStatusHTML()}
        <div class="group"><button class="row" data-export>Export Backup</button><label class="row" style="cursor:pointer">Import Backup<input type="file" accept=".json,application/json" id="imp" hidden></label></div>
        <p class="note">Your calendar and tasks live on your Daybook server and sync between your devices. A backup file is an extra copy you keep yourself.</p>`},
    mount(el){
      const upd=fn=>{const s=clone(settings());fn(s);put('settings',s);refreshPage(SH.stack[SH.stack.length-1])};
      el.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>upd(s=>{const c=s.cals.find(x=>x.id===b.dataset.tog);c.on=!c.on}));
      el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>pushPage(calEditPage(b.dataset.edit)));
      el.querySelector('[data-add]').onclick=()=>{const id=uid('cal');upd(s=>s.cals.push({id,name:'New Calendar',color:COLORS[s.cals.length%COLORS.length],on:true}));pushPage(calEditPage(id))};
      el.querySelector('[data-defcal]').onclick=()=>pushPage(choicePage('Default Calendar',settings().cals.map(c=>({k:c.id,label:c.name,color:col(c.color)})),settings().defaultCal,k=>{const s=clone(settings());s.defaultCal=k;put('settings',s)}));
      el.querySelectorAll('[data-ws]').forEach(b=>b.onclick=()=>{ui.ws=+b.dataset.ws;saveUi();el.querySelectorAll('[data-ws]').forEach(x=>x.setAttribute('aria-pressed',x===b));if(ui.view==='month'){initRange(ymd(ui.visM));render({noAnchor:true});positionMonth(ymd(ui.visM),null,true)}else render()});
      el.querySelector('#prv').onchange=e=>{ui.pinchRev=e.target.checked;saveUi()};
      el.querySelector('[data-export]').onclick=exportData;
      el.querySelector('#imp').onchange=e=>importFile(e.target.files[0]);
      el.querySelector('[data-signout]')?.addEventListener('click',signOut);
      el.querySelector('[data-signin]')?.addEventListener('click',()=>{sheetClose();showAuth()});
    },
    resume(el){refreshPage(SH.stack[SH.stack.length-1])}};
  return pg;
}
function calEditPage(cid){
  return{title:'Edit Calendar',html(){const c=settings().cals.find(x=>x.id===cid);if(!c)return '';
      return `<div class="group"><div class="row"><input id="cn" value="${esc(c.name)}" placeholder="Calendar name" style="font-weight:600"></div></div>
        <div class="sec"><h4>Colour</h4><div class="group"><div class="swatches">${COLORS.map(k=>`<button data-color="${k}" style="--c:${k}" aria-pressed="${col(c.color)===k}" aria-label="Colour"></button>`).join('')}</div></div></div>
        ${settings().cals.length>1?`<div class="group"><button class="row red" data-delcal>Delete Calendar</button></div>`:''}`},
    mount(el){const upd=fn=>{const s=clone(settings());const c=s.cals.find(x=>x.id===cid);if(c){fn(c,s);put('settings',s)}};
      el.querySelector('#cn').onchange=e=>{const v=e.target.value.trim();if(v)upd(c=>c.name=v)};
      el.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{upd(c=>c.color=b.dataset.color);el.querySelectorAll('[data-color]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
      el.querySelector('[data-delcal]')?.addEventListener('click',async()=>{const n=Object.values(S.events).filter(e=>e.cal===cid).length;
        const a=await actionSheet([{label:'Delete Calendar',act:'d',red:true}],n?`Its ${n} events move to your default calendar.`:'This calendar has no events.');if(!a)return;
        const s=clone(settings());s.cals=s.cals.filter(x=>x.id!==cid);if(s.defaultCal===cid)s.defaultCal=s.cals[0].id;put('settings',s);
        for(const[id,e]of Object.entries(S.events))if(e.cal===cid){const x=clone(e);x.cal=s.defaultCal;put(id,x)}popPage()})}};
}

/* ---- search ---- */
function searchPage(){
  return{title:'Search',left:'close',html(){return `<div class="sinput">${I.search}<input id="q" placeholder="Events, places, notes and tasks" autocomplete="off" enterkeyhint="search"></div><div id="qr" style="display:flex;flex-direction:column;gap:14px"></div>`},
    mount(el){const q=el.querySelector('#q'),qr=el.querySelector('#qr');setTimeout(()=>q.focus(),380);
      q.oninput=()=>{const s=q.value.trim().toLowerCase();if(!s){qr.innerHTML='';return}
        const evs=Object.entries(S.events).filter(([id,e])=>(e.title+' '+(e.loc||'')+' '+(e.notes||'')).toLowerCase().includes(s)).sort((a,b)=>b[1].date.localeCompare(a[1].date)).slice(0,50);
        const ts=[];for(const[lid,l]of Object.entries(S.lists))for(const t of l.tasks||[])if(t.text.toLowerCase().includes(s))ts.push({l,t});
        qr.innerHTML=(evs.length?`<div class="items">${evs.map(([id,e])=>`<button class="item" data-sev="${id}" data-d="${e.date}" style="--c:${cc(e)}"><span class="bar"></span><span><b>${esc(e.title)}</b><small>${fullDate(e.date)}${isRep(e)?' · repeats':''}</small></span><span class="tm">${e.allDay?'All-day':e.start}</span></button>`).join('')}</div>`:'')
          +(ts.length?`<div class="sec"><h4>Tasks</h4><div class="items">${ts.slice(0,30).map(({l,t})=>`<div class="titem"><span style="${t.done?'text-decoration:line-through;color:var(--muted)':''}">${esc(t.text)}</span><em>${esc(l.name)}${t.due?' · '+shortDate(t.due):''}</em></div>`).join('')}</div></div>`:'')
          ||`<div class="empty">No results for “${esc(q.value)}”.</div>`};
      qr.addEventListener('click',e=>{const it=e.target.closest('[data-sev]');if(!it)return;const d=it.dataset.d,id=it.dataset.sev;sheetClose();setTimeout(()=>{go('day',{date:d,dir:1});openDetail(id,d)},300)})}};
}

/* ---- task lists ---- */
function listsPage(){
  const pg={title:'Task Lists',left:'close',
    html(){const entries=Object.entries(S.lists).sort((a,b)=>(a[1].created||0)-(b[1].created||0));
      return `${entries.length?`<div class="group">${entries.map(([id,l])=>{const n=(l.tasks||[]).filter(t=>!t.done).length,stt=l.state||'float';
        return `<button class="row nav" data-l="${id}" style="--c:${col(l.color)}"><span style="width:12px;height:12px;border-radius:50%;background:var(--c);flex:none"></span><span style="flex:1;font-weight:600">${esc(l.name)}</span><span class="val">${n} · ${stt==='float'?'Floating':stt==='dock'?'Tucked':'Hidden'}</span></button>`}).join('')}</div>`:'<div class="empty">No task lists yet.</div>'}
        <div class="group"><button class="row" data-newl style="color:var(--accent)">New List</button></div>
        <p class="note">Floating lists stay on screen. Swipe a window to the right, or tap its arrow, to tuck it into the edge. Tasks with a due date appear in the calendar on that day.</p>`},
    mount(el){el.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>pushPage(listEditPage(b.dataset.l)));
      el.querySelector('[data-newl]').onclick=()=>{const id=uid('ls'),n=Object.keys(S.lists).length;zMap[id]=++zTop;
        put(id,{type:'list',name:'New List',color:LIST_COLORS[n%LIST_COLORS.length],x:null,y:null,state:'float',collapsed:false,showDone:false,created:Date.now(),tasks:[]});pushPage(listEditPage(id,true))}},
    resume(el){refreshPage(SH.stack[SH.stack.length-1])}};
  return pg;
}
function listEditPage(id,fresh){
  return{title:'List',html(){const l=S.lists[id];if(!l)return '';const stt=l.state||'float';
      return `<div class="group"><div class="row"><input id="ln" value="${esc(l.name)}" placeholder="List name" style="font-weight:700;color:${col(l.color)}"></div></div>
        <div class="sec"><h4>Show</h4><div class="group">${[['float','Floating on screen'],['dock','Tucked into the edge'],['closed','Hidden']].map(([k,t])=>`<button class="row" data-st="${k}"><span>${t}</span>${stt===k?`<span class="ck">${I.check}</span>`:''}</button>`).join('')}</div></div>
        <div class="sec"><h4>Colour</h4><div class="group"><div class="swatches">${LIST_COLORS.map(c=>`<button data-color="${c}" style="--c:${c}" aria-pressed="${col(l.color)===c}" aria-label="Colour"></button>`).join('')}</div></div></div>
        <div class="group"><button class="row" data-clear>Clear Completed Tasks</button><button class="row red" data-dell>Delete List</button></div>`},
    mount(el){const q=s=>el.querySelector(s),ln=q('#ln');if(fresh)setTimeout(()=>{ln.focus();ln.select()},420);
      ln.onchange=()=>{const v=ln.value.trim();if(v)editList(id,l=>l.name=v)};
      el.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{editList(id,l=>l.state=b.dataset.st);el.querySelectorAll('[data-st] .ck').forEach(x=>x.remove());b.insertAdjacentHTML('beforeend',`<span class="ck">${I.check}</span>`)});
      el.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{editList(id,l=>l.color=b.dataset.color);ln.style.color=b.dataset.color;el.querySelectorAll('[data-color]').forEach(x=>x.setAttribute('aria-pressed',x===b))});
      q('[data-clear]').onclick=()=>{editList(id,l=>l.tasks=l.tasks.filter(t=>!t.done));toast('Completed tasks cleared')};
      q('[data-dell]').onclick=async()=>{const a=await actionSheet([{label:'Delete List',act:'d',red:true}],'The list and all its tasks will be deleted.');if(!a)return;drop(id);popPage()}}};
}

async function exportData(){
  const data=JSON.stringify({app:'daybook',version:1,exported:new Date().toISOString(),events:S.events,lists:S.lists,settings:S.settings},null,2),name=`daybook-backup-${today()}.json`;
  if(Capacitor.isNativePlatform()){
    try{const r=await Filesystem.writeFile({path:name,data,directory:Directory.Cache,encoding:Encoding.UTF8});await Share.share({title:'Daybook backup',files:[r.uri]})}
    catch(e){if(!/cancel/i.test(String(e?.message||e)))toast('The backup could not be shared.')}
    return}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),3000);toast('Backup saved');
}
function importFile(f){if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const j=JSON.parse(r.result);if(j.app!=='daybook')throw 0;let n=0;
    for(const[id,e]of Object.entries(j.events||{})){put(id,e);n++}for(const[id,l]of Object.entries(j.lists||{})){put(id,l);n++}
    if(j.settings)put('settings',j.settings);sheetClose();toast(`Imported ${n} items`)}catch(e){toast('That file is not a Daybook backup.')}};r.readAsText(f)}

/* ================= floating task windows ================= */
const floats=$('#floats'),dock=$('#dock');
let editingTask=null,noFloatClick=0,td=null;
let zTop=1;const zMap={};
const panelW=()=>Math.min(300,innerWidth-32);
function defaultPos(i){const w=panelW();return{x:Math.max(8,innerWidth-w-16-i*18),y:Math.max(150,innerHeight-480+i*26)}}
function taskRow(t){const late=t.due&&!t.done&&t.due<today();
  return `<li class="task${t.done?' is-done':''}" data-t="${t.id}"><button class="chk" data-act="check" aria-label="${t.done?'Mark not done':'Mark done'}"></button>
    ${editingTask===t.id?`<input class="tt" id="tt-${t.id}" value="${esc(t.text)}" aria-label="Task" enterkeyhint="done">`:`<span class="tt" data-act="edit">${esc(t.text)}</span>`}
    ${t.due?`<button class="due${late?' late':''}" data-act="date" aria-label="Change date">${dueLabel(t.due)}</button>`:`<button class="mini" data-act="date" aria-label="Add to a date">${I.cal}</button>`}<button class="mini" data-act="rm" aria-label="Delete task">${I.x}</button></li>`}
function renderPanels(){
  const act=document.activeElement,aid=act&&floats.contains(act)?act.id:null,sel=aid&&act.selectionStart!=null?[act.selectionStart,act.selectionEnd]:null;
  const open=Array.from(floats.querySelectorAll('.task.dating')).map(li=>li.dataset.t);
  const entries=Object.entries(S.lists).sort((a,b)=>(a[1].created||0)-(b[1].created||0));
  let html='',tabs='',i=0;const w=panelW();
  for(const[id,l]of entries){const c=col(l.color);
    if(l.state==='dock'){tabs+=`<button class="tab glass" data-undock="${id}" style="--lc:${c}" aria-label="Show ${esc(l.name)}">${esc(l.name)} <em>${(l.tasks||[]).filter(t=>!t.done).length}</em></button>`;continue}
    if(l.state!=='float')continue;
    const p=l.x==null?defaultPos(i):{x:l.x,y:l.y};i++;
    const x=Math.min(Math.max(8,p.x),innerWidth-w-8),y=Math.min(Math.max(70,p.y),innerHeight-150);
    const todo=(l.tasks||[]).filter(t=>!t.done),done=(l.tasks||[]).filter(t=>t.done);
    html+=`<section class="panel glass${l.collapsed?' collapsed':''}" data-l="${id}" style="--lc:${c};left:${x}px;top:${y}px;z-index:${zMap[id]||1}">
      <header class="ph" data-drag><span class="grab"></span><h3>${esc(l.name)}</h3><span class="pcount">${todo.length}</span>
        <button class="ib" data-act="collapse" aria-label="${l.collapsed?'Expand':'Collapse'}">${I.chev}</button><button class="ib" data-act="dock" aria-label="Tuck into the right edge">${I.dock}</button></header>
      <div class="pb"><ul class="tasks">${todo.map(taskRow).join('')}</ul>
        <form class="padd" data-add="${id}"><input id="add-${id}" placeholder="New task" autocomplete="off" enterkeyhint="done"><button aria-label="Add task">${I.plus}</button></form>
        ${done.length?`<button class="showdone" data-act="showdone">${l.showDone?'Hide':'Show'} completed (${done.length})</button>${l.showDone?`<ul class="tasks">${done.map(taskRow).join('')}</ul>`:''}`:''}
      </div></section>`}
  floats.innerHTML=html;dock.innerHTML=tabs;
  open.forEach(t=>floats.querySelector(`[data-t="${t}"]`)?.classList.add('dating'));
  if(aid){const el=document.getElementById(aid);if(el){el.focus({preventScroll:true});if(sel)try{el.setSelectionRange(sel[0],sel[1])}catch(e){}}}
}
function editList(id,fn){if(!S.lists[id])return;const l=clone(S.lists[id]);l.tasks=l.tasks||[];fn(l);put(id,l)}
const findTask=(l,tid)=>l.tasks.find(t=>t.id===tid);
floats.addEventListener('click',e=>{if(performance.now()<noFloatClick)return;const p=e.target.closest('.panel');if(!p)return;const id=p.dataset.l;const b=e.target.closest('[data-act]');if(!b)return;
  const act=b.dataset.act,tid=b.closest('[data-t]')?.dataset.t;
  if(act==='collapse')editList(id,l=>l.collapsed=!l.collapsed);else if(act==='dock')editList(id,l=>l.state='dock');
  else if(act==='showdone')editList(id,l=>l.showDone=!l.showDone);
  else if(act==='check'){haptic();editList(id,l=>{const t=findTask(l,tid);t.done=!t.done;t.doneAt=t.done?Date.now():null})}
  else if(act==='rm')editList(id,l=>l.tasks=l.tasks.filter(t=>t.id!==tid));
  else if(act==='date')sheetOpen(datePage(id,tid));
  else if(act==='edit'){editingTask=tid;renderPanels();const inp=document.getElementById('tt-'+tid);if(inp){inp.focus();const n=inp.value.length;try{inp.setSelectionRange(n,n)}catch(e){}}}});
floats.addEventListener('submit',e=>{e.preventDefault();const f=e.target.closest('[data-add]');if(!f)return;const inp=f.querySelector('input'),txt=inp.value.trim();if(!txt)return;
  inp.value='';editList(f.dataset.add,l=>l.tasks.push({id:uid('t'),text:txt,done:false,created:Date.now()}))});
floats.addEventListener('change',e=>{const p=e.target.closest('.panel');if(!p)return;const tid=e.target.closest('[data-t]')?.dataset.t;
  if(e.target.classList.contains('tt')){editingTask=null;const v=e.target.value.trim();editList(p.dataset.l,l=>{if(!v)l.tasks=l.tasks.filter(t=>t.id!==tid);else findTask(l,tid).text=v})}
  if(e.target.classList.contains('dd'))editList(p.dataset.l,l=>{findTask(l,tid).due=e.target.value||null})});
floats.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList.contains('tt'))e.target.blur()});
let pdrag=null;
floats.addEventListener('pointerdown',e=>{const p=e.target.closest('.panel');if(!p)return;zMap[p.dataset.l]=++zTop;p.style.zIndex=zTop;
  const h=e.target.closest('[data-drag]');if(!h||e.target.closest('button'))return;
  pdrag={p,id:p.dataset.l,sx:e.clientX,sy:e.clientY,ox:p.offsetLeft,oy:p.offsetTop,t:performance.now(),moved:false};try{h.setPointerCapture(e.pointerId)}catch(err){}});
floats.addEventListener('pointermove',e=>{if(!pdrag)return;const dx=e.clientX-pdrag.sx,dy=e.clientY-pdrag.sy;if(!pdrag.moved&&Math.hypot(dx,dy)<5)return;pdrag.moved=true;
  const w=pdrag.p.offsetWidth;pdrag.p.style.left=Math.min(Math.max(8,pdrag.ox+dx),innerWidth-48)+'px';pdrag.p.style.top=Math.min(Math.max(60,pdrag.oy+dy),innerHeight-150)+'px';
  pdrag.p.style.opacity=(pdrag.ox+dx+w*.5>innerWidth)?'.5':''});
floats.addEventListener('pointerup',e=>{if(!pdrag)return;const d=pdrag;pdrag=null;if(!d.moved)return;
  const dx=e.clientX-d.sx,dy=e.clientY-d.sy,dt=performance.now()-d.t,w=d.p.offsetWidth;
  if((dx>70&&Math.abs(dy)<60&&dt<450)||d.ox+dx+w*.5>innerWidth){haptic();editList(d.id,l=>{l.x=d.ox;l.y=d.oy;l.state='dock'})}
  else editList(d.id,l=>{l.x=d.p.offsetLeft;l.y=d.p.offsetTop})});
floats.addEventListener('pointercancel',()=>{if(pdrag){pdrag.p.style.opacity='';pdrag=null;renderPanels()}});
dock.addEventListener('click',e=>{const b=e.target.closest('[data-undock]');if(!b)return;zMap[b.dataset.undock]=++zTop;editList(b.dataset.undock,l=>l.state='float')});

floats.addEventListener('focusout',e=>{if(e.target.matches('input.tt')&&editingTask){editingTask=null;setTimeout(renderPanels,0)}});
function tdStart(){if(!td)return;const l=S.lists[td.lid],t=l&&findTask(l,td.tid);if(!t){td=null;return}td.active=true;haptic();
  const g=document.createElement('div');g.className='tghost glass';g.style.setProperty('--lc',col(l.color));g.innerHTML=`<span>${esc(t.text)}</span><small>Drop on a day</small>`;
  document.body.appendChild(g);td.g=g;td.row.style.opacity='.35';td.panel=td.row.closest('.panel');td.panel?.classList.add('dragging');tdMove();tdAuto()}
function tdMove(){const{x,y,g}=td;g.style.transform=`translate(${Math.min(x+14,innerWidth-250)}px,${y-30}px)`;const t=dropDayAt(x,y),el=t?.el||null;
  if(td.over!==el){td.over?.classList.remove('drop');el?.classList.add('drop');td.over=el}
  const to=t?.d||null;if(td.to!==to){td.to=to;if(to)haptic();g.querySelector('small').textContent=to?cardDate(to):'Drop on a day'}}
function tdEnd(cancel){const d=td;td=null;if(!d)return;clearTimeout(d.timer);if(!d.active)return;noFloatClick=performance.now()+450;
  d.g.remove();d.over?.classList.remove('drop');d.row.style.opacity='';d.panel?.classList.remove('dragging');
  if(!cancel&&d.to){editList(d.lid,l=>{const t=findTask(l,d.tid);if(t)t.due=d.to});toast(`Added to ${longDate(d.to)}`)}}
function tdAuto(){const loop=()=>{if(!td||!td.active)return;const top=topH()+20,bot=innerHeight-100;let v=0;
  if(td.y<top)v=-Math.min(14,(top-td.y)/3);else if(td.y>bot)v=Math.min(14,(td.y-bot)/3);if(v){window.scrollBy(0,v);tdMove()}requestAnimationFrame(loop)};requestAnimationFrame(loop)}
floats.addEventListener('touchstart',e=>{const row=e.target.closest('.task');if(!row||e.touches.length>1||e.target.closest('button,input'))return;const t=e.touches[0];
  td={row,lid:row.closest('.panel').dataset.l,tid:row.dataset.t,x0:t.clientX,y0:t.clientY,x:t.clientX,y:t.clientY,active:false};td.timer=setTimeout(tdStart,360)},{passive:true});
floats.addEventListener('touchmove',e=>{if(!td||td.mouse)return;const t=e.touches[0];td.x=t.clientX;td.y=t.clientY;
  if(td.active){e.preventDefault();tdMove()}else if(Math.hypot(td.x-td.x0,td.y-td.y0)>8){clearTimeout(td.timer);td=null}},{passive:false});
floats.addEventListener('touchend',()=>{if(td&&!td.mouse)tdEnd(false)});floats.addEventListener('touchcancel',()=>{if(td&&!td.mouse)tdEnd(true)});
floats.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;const row=e.target.closest('.task');if(!row||e.target.closest('button,input'))return;
  td={row,lid:row.closest('.panel').dataset.l,tid:row.dataset.t,x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY,active:false,mouse:true}});
addEventListener('pointermove',e=>{if(!td||!td.mouse)return;td.x=e.clientX;td.y=e.clientY;if(!td.active){if(Math.hypot(td.x-td.x0,td.y-td.y0)>6)tdStart()}else tdMove()});
addEventListener('pointerup',()=>{if(td&&td.mouse)tdEnd(false)});

function datePage(lid,tid){
  return{title:'Date',html(){const l=S.lists[lid],t=l&&findTask(l,tid);if(!t)return '';const td0=today(),dw=parse(td0).getDay();
      const opts=[['Today',td0],['Tomorrow',shift(td0,1)],['This Weekend',shift(td0,(6-dw+7)%7)],['Next Week',shift(td0,((8-dw)%7)||7)]];
      return `<div class="group">${opts.map(([n,d])=>`<button class="row" data-pick="${d}"><span>${n}</span><span class="val">${D3[parse(d).getDay()]} ${shortDate(d)}</span>${t.due===d?`<span class="ck" style="margin-left:8px">${I.check}</span>`:''}</button>`).join('')}
        <div class="row"><span>Pick a Date</span><span class="pills"><input type="date" class="pill" id="pd" value="${t.due||td0}"></span></div></div>
        ${t.due?`<div class="group"><button class="row red" data-clear>Remove Date</button></div>`:''}
        <p class="note">You can also hold a task in its window and drag it onto any day in the calendar.</p>`},
    mount(el){const set=d=>{editList(lid,l=>{const t=findTask(l,tid);if(t)t.due=d||null});haptic();toast(d?`Added to ${longDate(d)}`:'Date removed');SH.stack.length>1?popPage():sheetClose()};
      el.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>set(b.dataset.pick));
      el.querySelector('#pd')?.addEventListener('change',e=>{if(e.target.value)set(e.target.value)});
      el.querySelector('[data-clear]')?.addEventListener('click',()=>set(null))}};
}
function taskPage(lid,tid){
  let cur=lid;
  return{title:'Task',left:'close',
    html(){const l=S.lists[cur],t=l&&findTask(l,tid);if(!t)return '<div class="empty">This task was deleted.</div>';const c=col(l.color);
      return `<div class="group"><div class="row" style="--c:${c}"><button class="cbox${t.done?' on':''}" data-done aria-label="${t.done?'Mark not done':'Mark done'}"></button><input id="tk-t" value="${esc(t.text)}" style="font-weight:600;font-size:17px;${t.done?'text-decoration:line-through;color:var(--muted)':''}" aria-label="Task"></div></div>
        <div class="group"><button class="row nav" data-date><span class="ri">${I.cal}</span><span>Date</span><span class="val"><span class="vt">${t.due?fullDate(t.due):'None'}</span></span></button>
          <button class="row nav" data-list><span class="ri">${I.notes}</span><span>List</span><span class="val" style="--c:${c}"><i></i><span class="vt">${esc(l.name)}</span></span></button></div>
        <div class="group"><button class="row red" data-del>Delete Task</button></div>`},
    mount(el){const q=s=>el.querySelector(s);if(!q('#tk-t'))return;
      q('[data-done]').onclick=()=>{haptic();editList(cur,l=>{const t=findTask(l,tid);if(t)t.done=!t.done});refreshPage(SH.stack[SH.stack.length-1])};
      q('#tk-t').onchange=e=>{const v=e.target.value.trim();if(v)editList(cur,l=>{const t=findTask(l,tid);if(t)t.text=v})};
      q('[data-date]').onclick=()=>pushPage(datePage(cur,tid));
      q('[data-list]').onclick=()=>pushPage(choicePage('List',Object.entries(S.lists).map(([k,l])=>({k,label:l.name,color:col(l.color)})),cur,k=>{if(k===cur)return;
        const t=clone(findTask(S.lists[cur],tid));editList(cur,l=>l.tasks=l.tasks.filter(x=>x.id!==tid));editList(k,l=>l.tasks.push(t));cur=k}));
      q('[data-del]').onclick=()=>{editList(cur,l=>l.tasks=l.tasks.filter(x=>x.id!==tid));sheetClose();toast('Task deleted')}},
    resume(){refreshPage(SH.stack[SH.stack.length-1])}};
}

let tt;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,2600)}

/* ================= boot ================= */
const local=lsGet(LS);
if(local){S.events=local.events||{};S.lists=local.lists||{};S.settings=local.settings||null}
setHour(ui.hourH);
go(ui.view,{date:ui.sel,toSection:ui.view==='month'});
setInterval(()=>{if((ui.view==='day'||ui.view==='week')&&sheetEl.hidden&&!busy())render()},60000);
(async()=>{
  const cfg=serverCfg();
  if(!cfg.url||!cfg.key){showAuth();return}
  try{sb=makeClient(cfg)}catch(e){showAuth('The saved server address is not valid.');return}
  const{data}=await sb.auth.getSession();
  if(!data.session){showAuth();return}
  session=data.session;setMode('offline');
  sb.auth.onAuthStateChange((ev,s)=>{if(s)session=s});
  startSync();
})();
if(Capacitor.isNativePlatform()){
  App.addListener('backButton',()=>{
    const act=$('#act');if(!act.hidden){act.querySelector('[data-i="-1"]')?.click();return}
    if(!sheetEl.hidden){SH.stack.length>1?popPage():sheetClose();return}
    if(!menu.hidden){closeMenu();return}
    if(ui.view==='day'||ui.view==='week'||ui.view==='list'){go('month',{date:ui.sel,dir:-1});return}
    if(ui.view==='year'){go('month',{date:ymd(new Date(ui.year,new Date().getMonth(),1)),dir:1});return}
    App.minimizeApp();
  });
  App.addListener('resume',()=>{if(session){pull();flushSoon(0)}render()});
}
})();
