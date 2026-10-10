const LORE={
  world:{name:'세계관',cats:['장소','규칙','역사'],seed:[]},
  codex:{name:'설정집',cats:['인물','용어','복선'],seed:[]}
};
Object.values(LORE).forEach(l=>l.items=[]); /* 서버에서 읽어 온 항목은 hydrate 가 채워요 */
let lk='world',lf='전체',le=null,lt,arm;
const L=()=>LORE[lk];
const chips=(cats,on)=>cats.map(c=>`<button type="button" class="chip" data-c="${c}" aria-pressed="${c===on}">${c}</button>`).join('');
const counts=()=>{$('#cw').textContent=LORE.world.items.length;$('#cc').textContent=LORE.codex.items.length};

const DAY=864e5,day0=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
/* 작품. 실제로 쓰는 원고는 하나(wTitle)이고 나머지는 샘플 카드예요. 샘플을 지우면 wGone 에 기록해요 */
let wTitle='새 원고',wGone=[],wdq=null,wdT;
const DEMO=[],NOT_DEMO='다른 작품은 데모에 연결되어 있지 않아요.';
function workList(){
  const t=new Date(),y=day0(t);y.setDate(y.getDate()-1);
  const at=(d,h)=>new Date(d.getFullYear(),d.getMonth(),d.getDate(),h).getTime();
  let e=new Date(t.getFullYear(),8,12,20);if(e>t)e.setFullYear(e.getFullYear()-1);
  const ds={wave:at(y,18),light:e.getTime()};
  return [{k:'real',t:wTitle,real:true,at:lastEdit||at(y,23)},...DEMO.filter(w=>!wGone.includes(w.k)).map(w=>({...w,at:ds[w.k]}))].sort((a,b)=>b.at-a.at);
}
const ago=at=>Date.now()-at<6e4?'방금':when(at);
const when=at=>{const d=new Date(at),g=Math.round((day0(new Date())-day0(d))/DAY);return g<=0?'오늘':g===1?'어제':(d.getMonth()+1)+'월 '+d.getDate()+'일'};
/* 제목을 글자 하나씩 애니메이션하는 마크업 */
const letters=(s,n=0)=>s.split(' ').map(x=>'<span>'+[...x].map(c=>`<i style="--i:${n++}">${esc(c)}</i>`).join('')+'</span>').join(' ');
const WI={del:'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',ren:'M4 20h4l10-10-4-4L4 16zM13 7l4 4'};
const wBtn=(a,k,t,ask)=>ask
  ?`<button type="button" class="ask" data-wa="del" data-k="${k}" data-n="${esc(t)}" aria-label="${esc(t)} 삭제 확인">정말 삭제</button>`
  :`<button type="button" data-wa="${a}" data-k="${k}" data-n="${esc(t)}" aria-label="${esc(t)} ${a==='del'?'삭제':'제목 고치기'}" title="${a==='del'?'삭제':'제목 고치기'}"><svg viewBox="0 0 24 24"><path d="${WI[a]}"/></svg></button>`;
function workCard(w){
  const h=`<h2 aria-label="${esc(w.t)}"><span aria-hidden="true">${letters(w.t)}</span></h2>`,
    s=`<small>${when(w.at)} 수정했어요</small>`,
    acts=`<div class="wa">${w.real?wBtn('ren',w.k,w.t):''}${wBtn('del',w.k,w.t,wdq===w.k)}</div>`;
  if(!w.real)return `<article class="bk off"><button class="go" type="button" data-t="${NOT_DEMO}">${s}${h}<span class="pg"><i style="width:${w.p}%"></i></span></button>${acts}</article>`;
  const last=chs[chs.length-1],p=Math.min(100,rawN(last)/GOAL*100),open=(chs[0].c.split('\n').find(x=>x.trim())||'').trim();
  return `<article class="bk"><button class="go" type="button" data-go="edit">${s}${h}<p>${esc(open)||'아직 쓴 글이 없어요.'}</p><span class="pg"><i style="width:${p}%"></i></span><footer><span>${last.n}화 ${fmt(rawN(last))} / ${fmt(GOAL)}자</span><span>총 ${fmt(tot())}자</span></footer></button>${acts}</article>`;
}
/* 이름이 나오는 모든 곳(사이드바·홈·설정 화면 머리글·최근 원고)을 한 번에 다시 그려요 */
function paintWorks(){
  $('#sw1t').textContent=wTitle;$('#chn').textContent=wTitle;$('#lop').textContent='내 원고 · '+wTitle;
  const ti=$('#title');ti.setAttribute('aria-label',wTitle);ti.innerHTML=`<span aria-hidden="true">${letters(wTitle)}</span>`;
  const ds=workList().filter(w=>!w.real);
  $('#subx').innerHTML=ds.map(w=>`<div class="wt"><button class="si" type="button" data-t="${NOT_DEMO}">${esc(w.t)}</button><div class="kids"><div class="kin"><button class="si" type="button" data-t="${NOT_DEMO}">세계관</button><button class="si" type="button" data-t="${NOT_DEMO}">설정집</button></div></div></div>`).join('');
  $('#rcl').innerHTML=ds.map(w=>`<button class="row" type="button" data-t="${NOT_DEMO}"><b><span>${esc(w.t)}</span><em>${when(w.at)}</em></b><span class="pg"><i style="width:${w.p}%"></i></span></button>`).join('')||'<p class="none">다른 원고가 없어요.</p>';
}
function worksHome(){
  $('#wkl').innerHTML=workList().slice(0,2).map(workCard).join('');
  activity();
  [['world','#wkw'],['codex','#wkc']].forEach(([k,sel])=>{
    $(sel).innerHTML=LORE[k].items.slice(0,3).map(x=>`<button class="wc" type="button" data-go="${k}" data-id="${x.id}"><b>${esc(x.t)||'제목 없음'}</b><small>${esc(x.c)}</small><span>${esc(x.b)}</span></button>`).join('')||'<p class="none">아직 항목이 없어요.</p>';
  });
}
const newCard='<button class="bk nw" type="button" data-t="데모에서는 새 원고를 만들 수 없어요."><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>새 원고 시작</span></button>';
function worksAll(){$('#wal').innerHTML=workList().map(workCard).join('')+newCard}
const repaintCards=()=>{worksHome();worksAll()};

/* ── 원고 삭제: 휴지통을 한 번 누르면 "정말 삭제"로 바뀌고(3초), 한 번 더 누르면 지워요. 6초 안에는 되돌릴 수 있어요 ── */
function syncAsk(focus){
  document.querySelectorAll('.wa [data-wa="del"]').forEach(b=>{
    const had=document.activeElement===b,k=b.dataset.k;
    b.outerHTML=wBtn('del',k,b.dataset.n,wdq===k);
    if(had||(focus&&wdq===k)){const nb=document.querySelector(`.wa [data-wa="del"][data-k="${k}"]`);nb&&nb.focus()}
  });
}
function wAct(a,k){
  if(a==='ren')return wRename();
  if(wdq!==k){wdq=k;clearTimeout(wdT);wdT=setTimeout(()=>{wdq=null;syncAsk()},3000);syncAsk(true);return}
  clearTimeout(wdT);wdq=null;
  k==='real'?delReal():delDemo(k);
}
function delDemo(k){
  const w=DEMO.find(x=>x.k===k);if(!w)return;
  wGone=[...wGone,k];db.pref('gone',wGone);paintWorks();repaintCards();
  toast(`'${w.t}'을(를) 삭제했어요.`,{l:'되돌리기',f:()=>{wGone=wGone.filter(x=>x!==k);db.pref('gone',wGone);paintWorks();repaintCards()}});
}
function delReal(){
  clearTimeout(timer);if(app.classList.contains('focus'))focusMode(false);
  const old={chs,world:LORE.world.items,codex:LORE.codex.items,t:wTitle,base:{...base}},
    blank={id:Date.now(),n:1,t:'',c:'',_sig:'\0'},
    gone=[...chs.map(c=>({ch:c.id})),...old.world.map(x=>({k:'world',id:x.id})),...old.codex.map(x=>({k:'codex',id:x.id}))];
  cur=null;chs=[blank];LORE.world.items=[];LORE.codex.items=[];wTitle='새 원고';base={d:day,s:0};lastEdit=Date.now();
  if(le){le=null}
  db.dropWork(gone);db.chapter(blank);db.pref('title',wTitle);db.pref('base',base);
  ed.innerHTML='';ti.value='';list(true);paintWorks();counts();repaintCards();home();
  toast(`'${old.t}'을(를) 삭제했어요. 빈 원고로 새로 시작해요.`,{l:'되돌리기',f:()=>{
    if(chs.length!==1||chs[0]!==blank||blank.c.trim()||chs.length>1){toast('새로 쓴 내용이 있어서 되돌릴 수 없어요.');return}
    cur=null;chs=old.chs;LORE.world.items=old.world;LORE.codex.items=old.codex;wTitle=old.t;base=old.base;lastEdit=Date.now();
    db.delChapter(blank.id);db.restoreWork();db.pref('title',wTitle);db.pref('base',base);
    ed.innerHTML='';ti.value='';list(true);paintWorks();counts();repaintCards();home();
  }});
}
function wRename(){
  const v=prompt('원고 제목을 입력하세요',wTitle);if(v===null)return;
  const t=v.trim().slice(0,30);if(!t||t===wTitle)return;
  wTitle=t;db.pref('title',t);paintWorks();repaintCards();
}
function streak(){
  const x=new Date();if(!wlog[dkey(x)])x.setDate(x.getDate()-1);
  let n=0;while(wlog[dkey(x)]>0){n++;x.setDate(x.getDate()-1)}return n;
}
function activity(){
  const t=new Date(),ds=[];
  for(let i=13;i>=0;i--){const x=new Date(t.getFullYear(),t.getMonth(),t.getDate()-i);ds.push({x,v:wlog[dkey(x)]||0})}
  const mx=Math.max(GOAL,...ds.map(o=>o.v));
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
$('#loa').onclick=()=>{const l=L(),x={id:Date.now(),t:'',c:lf==='전체'?l.cats[0]:lf,b:'',p:Math.min(0,...l.items.map(i=>i.p||0))-1};l.items.unshift(x);openLore(x);$('#loti').focus()};
$('#lob').onclick=closeLore;
$('#lodel').onclick=e=>{
  const b=e.currentTarget;
  if(!b.dataset.arm){b.dataset.arm=1;b.textContent='한 번 더 누르면 삭제돼요';arm=setTimeout(()=>{delete b.dataset.arm;b.textContent='삭제'},3000);return}
  const gone=le;L().items=L().items.filter(x=>x!==gone);db.delLore(lk,gone.id);le=null;closeLore();toast('삭제했어요.');
};
counts();
