const LORE={
  world:{name:'세계관',cats:['장소','규칙','역사']},
  codex:{name:'설정집',cats:['인물','용어','복선']}
};
/* LORE.world.items / LORE.codex.items 는 지금 열려 있는 원고(wk)의 세계관·설정집을 가리켜요. 원고를 바꾸면 자동으로 따라가요 */
Object.keys(LORE).forEach(k=>Object.defineProperty(LORE[k],'items',{get:()=>wk?wk[k]:[],set:v=>{if(wk)wk[k]=v}}));
let lk='world',lf='전체',le=null,lt,arm;
const L=()=>LORE[lk];
const chips=(cats,on)=>cats.map(c=>`<button type="button" class="chip" data-c="${c}" aria-pressed="${c===on}">${c}</button>`).join('');
const counts=()=>{$('#cw').textContent=LORE.world.items.length;$('#cc').textContent=LORE.codex.items.length};

const DAY=864e5,day0=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
/* 원고(작품)는 여러 개예요. 각 원고가 자기 화·세계관·설정집을 따로 가져요: {id,t,pos,at,chs,world,codex} */
let wdq=null,wdT;
const MAXW=30,wList=()=>WORKS.slice().sort((a,b)=>b.at-a.at),wTotal=w=>w.chs.reduce((s,c)=>s+rawN(c),0);
const wPct=w=>{const c=w.chs[w.chs.length-1];return Math.min(100,rawN(c)/cGoal(c)*100)};
const ago=at=>Date.now()-at<6e4?'방금':when(at);
const when=at=>{const d=new Date(at),g=Math.round((day0(new Date())-day0(d))/DAY);return g<=0?'오늘':g===1?'어제':(d.getMonth()+1)+'월 '+d.getDate()+'일'};
/* 제목을 글자 하나씩 애니메이션하는 마크업 */
const letters=(s,n=0)=>s.split(' ').map(x=>'<span>'+[...x].map(c=>`<i style="--i:${n++}">${esc(c)}</i>`).join('')+'</span>').join(' ');
const WI={del:'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',ren:'M4 20h4l10-10-4-4L4 16zM13 7l4 4'};
const wBtn=(a,k,t,ask)=>ask
  ?`<button type="button" class="ask" data-wa="del" data-k="${k}" data-n="${esc(t)}" aria-label="${esc(t)} 삭제 확인">정말 삭제</button>`
  :`<button type="button" data-wa="${a}" data-k="${k}" data-n="${esc(t)}" aria-label="${esc(t)} ${a==='del'?'삭제':'제목 고치기'}" title="${a==='del'?'삭제':'제목 고치기'}"><svg viewBox="0 0 24 24"><path d="${WI[a]}"/></svg></button>`;
function workCard(w){
  const k=String(w.id),on=w===wk,last=w.chs[w.chs.length-1],open=(w.chs[0].c.split('\n').find(x=>x.trim())||'').trim();
  return `<article class="${on?'bk':'bk off'}"><button class="go" type="button" data-w="${k}"><small>${when(w.at)} 수정했어요${on?' · 지금 쓰는 원고':''}</small><h2 aria-label="${esc(w.t)}"><span aria-hidden="true">${letters(w.t)}</span></h2><p>${esc(open)||'아직 쓴 글이 없어요.'}</p><span class="pg"><i style="width:${wPct(w)}%"></i></span><footer><span>${last.n}화 ${fmt(rawN(last))} / ${fmt(cGoal(last))}자</span><span>총 ${fmt(wTotal(w))}자 · ${w.chs.length}화</span></footer></button><div class="wa">${wBtn('ren',k,w.t)}${wBtn('del',k,w.t,wdq===k)}</div></article>`;
}
/* 이름이 나오는 모든 곳(사이드바·홈·설정 화면 머리글·최근 원고)을 한 번에 다시 그려요 */
function paintWorks(){
  const t=wk.t;
  $('#sw1t').textContent=t;$('#chn').textContent=t;$('#lop').textContent='내 원고 · '+t;
  const ti=$('#title');ti.setAttribute('aria-label',t);ti.innerHTML=`<span aria-hidden="true">${letters(t)}</span>`;
  $('#subx').innerHTML=WORKS.filter(w=>w!==wk).map(w=>`<button class="si" type="button" data-sw="${w.id}">${esc(w.t)}</button>`).join('')+'<button class="si add2" type="button" data-nw="1">+ 새 원고</button>';
  $('#rcl').innerHTML=wList().slice(0,4).map(w=>`<button class="row" type="button" data-w="${w.id}"><b><span>${esc(w.t)}</span><em>${w===wk?'지금 · ':''}${when(w.at)}</em></b><span class="pg"><i style="width:${wPct(w)}%"></i></span></button>`).join('');
}
function worksHome(){
  const ws=wList().slice(0,2);
  $('#wkl').innerHTML=ws.map(workCard).join('')+(ws.length<2?newCard:'');
  $('#wkwh').textContent='세계관 · '+wk.t;$('#wkch').textContent='설정집 · '+wk.t;
  activity();
  [['world','#wkw'],['codex','#wkc']].forEach(([k,sel])=>{
    $(sel).innerHTML=LORE[k].items.slice(0,3).map(x=>`<button class="wc" type="button" data-go="${k}" data-id="${x.id}"><b>${esc(x.t)||'제목 없음'}</b><small>${esc(x.c)}</small><span>${esc(x.b)}</span></button>`).join('')||'<p class="none">아직 항목이 없어요.</p>';
  });
}
const newCard='<button class="bk nw" type="button" data-nw="1"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>새 원고 시작</span></button>';
function worksAll(){$('#wal').innerHTML=wList().map(workCard).join('')+newCard}
const repaintCards=()=>{worksHome();worksAll()};

/* ── 원고 전환 · 만들기 · 삭제 ── */
/* 저장 없이 화면 상태만 바꾸는 가장 아래 단계(삭제·되돌리기·로그인 때 써요) */
function setWork(w){
  clearTimeout(timer);wk=w;chs=w.chs;cur=null;le=null;chRn=chDq=null;
  ed.innerHTML='';ti.value='';db.pref('cur',w.id);list(true);scan();
}
function switchWork(w){
  if(!w||w===wk)return;
  if(cur){clearTimeout(timer);save()}
  if(le)closeLore();
  if(app.classList.contains('focus'))focusMode(false);
  setWork(w);if(fi.value)find();
  paintWorks();counts();home();repaintCards();
}
function enterWork(id){
  const w=WORKS.find(x=>x.id===id);if(!w)return;
  switchWork(w);view('edit');kids(true);
}
function newWork(){
  if(WORKS.length>=MAXW)return toast('원고는 '+MAXW+'개까지 만들 수 있어요.');
  const v=prompt('새 원고의 제목을 입력하세요','새 원고');if(v===null)return;
  const id=Date.now(),w={id,t:v.trim().slice(0,30)||'새 원고',pos:Math.max(-1,...WORKS.map(x=>x.pos))+1,at:Date.now(),chs:[{id:id+1,n:1,t:'',c:'',w:id,_sig:'\0'}],world:[],codex:[]};
  WORKS.push(w);db.work(w);db.chapter(w.chs[0]);
  switchWork(w);view('edit');kids(true);ti.focus();
  toast(`'${w.t}'을(를) 만들었어요. 1화부터 시작해요.`);
}
function wAct(a,k){
  if(a==='ren')return wRename(+k);
  if(wdq!==k){wdq=k;clearTimeout(wdT);wdT=setTimeout(()=>{wdq=null;syncAsk()},3000);syncAsk(true);return}
  clearTimeout(wdT);wdq=null;delWork(+k);
}
/* 원고 삭제: 휴지통을 한 번 누르면 "정말 삭제"로 바뀌고(3초), 한 번 더 누르면 지워요. 6초 안에는 되돌릴 수 있어요 */
function syncAsk(focus){
  document.querySelectorAll('.wa [data-wa="del"]').forEach(b=>{
    const had=document.activeElement===b,k=b.dataset.k;
    b.outerHTML=wBtn('del',k,b.dataset.n,wdq===k);
    if(had||(focus&&wdq===k)){const nb=document.querySelector(`.wa [data-wa="del"][data-k="${k}"]`);nb&&nb.focus()}
  });
}
function delWork(id){
  const w=WORKS.find(x=>x.id===id);if(!w)return;
  const idx=WORKS.indexOf(w),sz=wTotal(w),was=wk===w;let blank=null;
  if(was&&app.classList.contains('focus'))focusMode(false);
  WORKS.splice(idx,1);base.s=Math.max(0,base.s-sz);db.pref('base',base);db.delWork(w.id);
  if(!WORKS.length){ /* 마지막 원고를 지우면 빈 원고로 새로 시작해요 */
    const bid=Date.now();blank={id:bid,t:'새 원고',pos:0,at:Date.now(),chs:[{id:bid+1,n:1,t:'',c:'',w:bid,_sig:'\0'}],world:[],codex:[]};
    WORKS.push(blank);db.work(blank);db.chapter(blank.chs[0]);
  }
  if(was||blank)setWork(WORKS[Math.min(idx,WORKS.length-1)]);
  paintWorks();counts();repaintCards();home();
  toast(`'${w.t}'을(를) 삭제했어요.${blank?' 빈 원고로 새로 시작해요.':''}`,{l:'되돌리기',f:()=>{
    if(WORKS.includes(w))return;
    if(blank){
      if(WORKS.length!==1||WORKS[0]!==blank||blank.chs.length>1||blank.chs[0].c.trim()||blank.t!=='새 원고'){toast('새로 쓴 내용이 있어서 되돌릴 수 없어요.');return}
      WORKS.length=0;db.delWork(blank.id);
    }
    WORKS.splice(Math.min(idx,WORKS.length),0,w);base.s+=sz;db.pref('base',base);db.restoreWork(w);
    if(was||blank)setWork(w);
    paintWorks();counts();repaintCards();home();
  }});
}
function wRename(id){
  const w=WORKS.find(x=>x.id===id);if(!w)return;
  const v=prompt('원고 제목을 입력하세요',w.t);if(v===null)return;
  const t=v.trim().slice(0,30);if(!t||t===w.t)return;
  w.t=t;db.work(w);paintWorks();repaintCards();
}
document.addEventListener('click',e=>{
  const n=e.target.closest('[data-nw]');if(n){newWork();return}
  const b=e.target.closest('[data-sw],[data-w]');if(b)enterWork(+(b.dataset.sw||b.dataset.w));
});
function streak(){
  const x=new Date();if(!wlog[dkey(x)])x.setDate(x.getDate()-1);
  let n=0;while(wlog[dkey(x)]>0){n++;x.setDate(x.getDate()-1)}return n;
}
function activity(){
  const t=new Date(),ds=[];
  for(let i=13;i>=0;i--){const x=new Date(t.getFullYear(),t.getMonth(),t.getDate()-i);ds.push({x,v:wlog[dkey(x)]||0})}
  const mx=Math.max(GOALS[gi],...ds.map(o=>o.v));
  $('#act').innerHTML=ds.map((o,i)=>{
    const l=(o.x.getMonth()+1)+'월 '+o.x.getDate()+'일',c=(i===13?'now ':'')+(o.v?'':'z');
    return `<li class="${c.trim()}" style="--i:${i}" title="${l} · ${fmt(o.v)}자"><span class="sr">${l} ${fmt(o.v)}자</span><span class="trk" aria-hidden="true"><i style="height:${o.v?Math.max(4,o.v/mx*100):0}%"></i></span><small aria-hidden="true">${o.x.getDate()}</small></li>`;
  }).join('');
  const s=streak();$('#stk').textContent=s?s+'일 연속 집필':'연속 기록이 없어요';
}
$('#works').onclick=$('#wall').onclick=e=>{
  const a=e.target.closest('[data-wa]');if(a)return wAct(a.dataset.wa,a.dataset.k);
  const b=e.target.closest('[data-go]');if(!b)return;
  view(b.dataset.go);
  if(b.dataset.id)openLore(L().items.find(x=>x.id==b.dataset.id));
};

function lore(k){
  if(le)closeLore();
  lk=k;lf='전체';$('#lot').textContent=L().name;$('#lol').hidden=false;$('#lod').hidden=true;paintLore();
}
function paintLore(){
  const l=L(),it=l.items.filter(x=>lf==='전체'||x.c===lf);
  $('#loc').innerHTML=chips(['전체',...l.cats],lf);
  $('#log').innerHTML=it.length?it.map(x=>`<button class="card" type="button" data-id="${x.id}"><small>${esc(x.c)}</small><b>${esc(x.t)||'제목 없음'}</b><span>${esc(x.b)}</span></button>`).join(''):'<p class="none">아직 항목이 없어요. 새 항목으로 첫 설정을 적어 보세요.</p>';
}
function sizeBody(){const b=$('#lobd');b.style.height='auto';b.style.height=b.scrollHeight+'px'}
function openLore(x){
  le=x;$('#lol').hidden=true;$('#lod').hidden=false;
  $('#lob span').textContent=L().name;$('#lodc').innerHTML=chips(L().cats,x.c);
  $('#loti').value=x.t;$('#lobd').value=x.b;$('#lost').textContent='저장됨';
  const d=$('#lodel');clearTimeout(arm);delete d.dataset.arm;d.textContent='삭제';
  sizeBody();scrollTo(0,0);
}
function closeLore(){
  clearTimeout(lt);const l=L();
  if(le){if(!le.t.trim()&&!le.b.trim()){l.items=l.items.filter(x=>x!==le);db.delLore(lk,le.id)}else db.lore(lk,le)}
  le=null;counts();
  $('#lod').hidden=true;$('#lol').hidden=false;paintLore();
}
function saveLore(){if(le)db.lore(lk,le);counts()}
$('#lod').addEventListener('input',e=>{
  if(e.target.id==='loti')le.t=e.target.value;else if(e.target.id==='lobd'){le.b=e.target.value;sizeBody()}else return;
  $('#lost').textContent='저장 중…';clearTimeout(lt);lt=setTimeout(saveLore,600);
});
$('#lodc').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;le.c=b.dataset.c;$('#lodc').innerHTML=chips(L().cats,le.c);saveLore()};
$('#loc').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;lf=b.dataset.c;paintLore()};
$('#log').onclick=e=>{const b=e.target.closest('.card');if(b)openLore(L().items.find(x=>x.id==b.dataset.id))};
$('#loa').onclick=()=>{const l=L(),x={id:Date.now(),w:wk.id,t:'',c:lf==='전체'?l.cats[0]:lf,b:'',p:Math.min(0,...l.items.map(i=>i.p||0))-1};l.items.unshift(x);openLore(x);$('#loti').focus()};
$('#lob').onclick=closeLore;
$('#lodel').onclick=e=>{
  const b=e.currentTarget;
  if(!b.dataset.arm){b.dataset.arm=1;b.textContent='한 번 더 누르면 삭제돼요';arm=setTimeout(()=>{delete b.dataset.arm;b.textContent='삭제'},3000);return}
  const gone=le;L().items=L().items.filter(x=>x!==gone);db.delLore(lk,gone.id);le=null;closeLore();toast('삭제했어요.');
};
counts();
