const LORE={
  world:{name:'세계관',def:['장소','규칙','역사']},
  codex:{name:'설정집',def:['인물','용어','복선']}
};
/* 분류는 원고마다 따로 가져요. 기본값에서 바꾼 원고만 CATS[원고id]={world:[…],codex:[…]} 로 계정 설정(cats)에 저장해요 */
let CATS={};const CAT_MAX=10,CAT_LEN=12;
const catsOf=k=>{
  const base=(wk&&CATS[wk.id]&&CATS[wk.id][k])||LORE[k].def,out=base.slice();
  LORE[k].items.forEach(x=>{if(x.c&&!out.includes(x.c))out.push(x.c)});   /* 목록에 없는 분류로 저장된 항목도 사라지지 않게 */
  return out;
};
function loadCats(p,works){
  const ids=new Set(works.map(w=>String(w.id))),src=p&&p.cats&&typeof p.cats==='object'&&!Array.isArray(p.cats)?p.cats:{},out={};
  const clean=a=>Array.isArray(a)?[...new Set(a.filter(x=>typeof x==='string'&&x.trim()&&x.length<=CAT_LEN).map(x=>x.trim()))].slice(0,CAT_MAX):[];
  for(const id of Object.keys(src)){
    if(!ids.has(id)||!src[id]||typeof src[id]!=='object')continue;
    const o={};['world','codex'].forEach(k=>{const l=clean(src[id][k]);if(l.length)o[k]=l});
    if(Object.keys(o).length)out[id]=o;
  }
  CATS=out;
  if(JSON.stringify(out)!==JSON.stringify(src))db.pref('cats',out);   /* 지워진 원고의 분류는 정리 */
}
function setCats(k,list){
  const e=CATS[wk.id]=CATS[wk.id]||{};e[k]=list.slice();
  ['world','codex'].forEach(q=>{if(e[q]&&JSON.stringify(e[q])===JSON.stringify(LORE[q].def))delete e[q]});
  if(!Object.keys(e).length)delete CATS[wk.id];
  db.pref('cats',JSON.parse(JSON.stringify(CATS)));
}
/* LORE.world.items / LORE.codex.items 는 지금 열려 있는 원고(wk)의 세계관·설정집을 가리켜요. 원고를 바꾸면 자동으로 따라가요 */
Object.keys(LORE).forEach(k=>{Object.defineProperty(LORE[k],'items',{get:()=>wk?wk[k]:[],set:v=>{if(wk)wk[k]=v}});Object.defineProperty(LORE[k],'cats',{get:()=>catsOf(k)})});
let lk='world',lf='전체',le=null,lt,arm;
const L=()=>LORE[lk];
const chips=(cats,on)=>cats.map(c=>`<button type="button" class="chip" data-c="${esc(c)}" aria-pressed="${c===on}">${esc(c)}</button>`).join('');
const counts=()=>{$('#cw').textContent=LORE.world.items.length;$('#cc').textContent=LORE.codex.items.length};

const DAY=864e5,day0=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
/* 원고(작품)는 여러 개예요. 각 원고가 자기 화·세계관·설정집을 따로 가져요: {id,t,pos,at,chs,world,codex} */
let wdq=null,wdT,wRn=null,wNew=null; /* wRn: 제목을 고치는 중인 원고 id, wNew: 방금 만든 원고(제목을 정하면 바로 열어요) */
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
  const k=String(w.id),on=w===wk,last=w.chs[w.chs.length-1],open=(w.chs[0].c.split('\n').find(x=>x.trim())||'').trim(),rn=wRn===w.id;
  const T=rn?'div':'button',A=rn?'':` type="button" data-w="${k}"`;
  return `<article class="${on?'bk':'bk off'}"><${T} class="go"${A}><small>${when(w.at)} 수정했어요${on?' · 지금 쓰는 원고':''}</small>${rn?`<input class="wrn" maxlength="${TL.work}" value="${esc(w.t)}" placeholder="원고 제목" aria-label="원고 제목" autocomplete="off">`:`<h2 aria-label="${esc(w.t)}"><span aria-hidden="true">${letters(w.t)}</span></h2>`}<p>${esc(open)||'아직 쓴 글이 없어요.'}</p><span class="pg"><i style="width:${wPct(w)}%"></i></span><footer><span>${last.n}화 ${fmt(rawN(last))} / ${fmt(cGoal(last))}자</span><span>총 ${fmt(wTotal(w))}자 · ${w.chs.length}화</span></footer></${T}><div class="wa">${wBtn('ren',k,w.t)}${wBtn('del',k,w.t,wdq===k)}</div></article>`;
}
/* 이름이 나오는 모든 곳(사이드바·홈·설정 화면 머리글·최근 원고)을 한 번에 다시 그려요 */
function paintWorks(){
  const t=wk.t;
  $('#sw1t').textContent=t;$('#lop').textContent='내 원고 · '+t;
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
  setWork(w);if(fi.value)findText();
  paintWorks();counts();home();repaintCards();
}
function enterWork(id){
  const w=WORKS.find(x=>x.id===id);if(!w)return;
  switchWork(w);view('edit');kids(true);
}
function newWork(){
  if(WORKS.length>=MAXW)return toast('원고는 '+MAXW+'개까지 만들 수 있어요.');
  const id=Date.now(),w={id,t:'새 원고',pos:Math.max(-1,...WORKS.map(x=>x.pos))+1,at:Date.now(),chs:[{id:id+1,n:1,t:'',c:'',w:id,_sig:'\0'}],world:[],codex:[]};
  WORKS.push(w);db.work(w);db.chapter(w.chs[0]);
  switchWork(w);wRn=wNew=id;view('works');wFocus();   /* 카드에서 바로 제목을 정하고 Enter 를 누르면 1화로 들어가요 */
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
  wNew=null;wRn=id;repaintCards();wFocus();
}
function wFocus(){const i=document.querySelector('main:not([hidden]) .wrn');if(i){i.focus();i.select()}}
function wEndRn(ok){
  if(wRn===null)return;
  const w=WORKS.find(x=>x.id===wRn),i=document.querySelector('main:not([hidden]) .wrn'),v=i?i.value.trim().slice(0,TL.work):'',nw=wNew===wRn;wRn=wNew=null;
  if(w&&ok&&v&&v!==w.t){w.t=v;db.work(w);paintWorks()}
  repaintCards();
  if(nw&&w){enterWork(w.id);ti.focus()}
}
document.addEventListener('keydown',e=>{
  if(!e.target.classList||!e.target.classList.contains('wrn')||e.isComposing)return;
  if(e.key==='Enter'){e.preventDefault();wEndRn(true)}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();wEndRn(false)}
});
document.addEventListener('focusout',e=>{if(e.target.classList&&e.target.classList.contains('wrn'))wEndRn(true)});
document.addEventListener('click',e=>{
  const n=e.target.closest('[data-nw]');if(n){newWork();return}
  const b=e.target.closest('[data-sw],[data-w]');if(b)enterWork(+(b.dataset.sw||b.dataset.w));
});
function streak(){
  const x=new Date();if(!wlog[dkey(x)])x.setDate(x.getDate()-1);
  let n=0;while(wlog[dkey(x)]>0){n++;x.setDate(x.getDate()-1)}return n;
}
$('#works').onclick=$('#wall').onclick=e=>{
  const a=e.target.closest('[data-wa]');if(a)return wAct(a.dataset.wa,a.dataset.k);
  const b=e.target.closest('[data-go]');if(!b)return;
  view(b.dataset.go);
  if(b.dataset.id)openLore(L().items.find(x=>x.id==b.dataset.id));
};

function lore(k){
  if(le)closeLore();
  lk=k;lf='전체';$('#lot').textContent=L().name;$('#lol').hidden=false;$('#lod').hidden=true;cmShow(false);paintLore();
}
function paintLore(){
  const l=L(),it=l.items.filter(x=>lf==='전체'||x.c===lf);
  $('#loc').innerHTML=chips(['전체',...l.cats],lf);
  $('#log').innerHTML=it.length?it.map(x=>`<button class="card" type="button" data-id="${x.id}"><small>${esc(x.c)}${badges(x)}</small><b>${esc(x.t)||'제목 없음'}</b><span>${esc(x.b)}</span></button>`).join(''):'<p class="none">아직 항목이 없어요. 새 항목으로 첫 설정을 적어 보세요.</p>';
}
function sizeBody(){const b=$('#lobd');b.style.height='auto';b.style.height=b.scrollHeight+'px'}
function openLore(x){
  le=x;$('#lol').hidden=true;$('#lod').hidden=false;
  $('#lob span').textContent=L().name;$('#lodc').innerHTML=chips(L().cats,x.c);
  $('#loti').value=x.t;$('#lobd').value=x.b;$('#lost').textContent='저장됨';lkPick(false);paintLinks();
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
$('#loa').onclick=()=>{const l=L(),x={id:Date.now(),w:wk.id,t:'',c:lf==='전체'?l.cats[0]:lf,b:'',l:[],p:Math.min(0,...l.items.map(i=>i.p||0))-1};l.items.unshift(x);openLore(x);$('#loti').focus()};
$('#lob').onclick=closeLore;
$('#lodel').onclick=e=>{
  const b=e.currentTarget;
  if(!b.dataset.arm){b.dataset.arm=1;b.textContent='한 번 더 누르면 삭제돼요';arm=setTimeout(()=>{delete b.dataset.arm;b.textContent='삭제'},3000);return}
  const gone=le;L().items=L().items.filter(x=>x!==gone);db.delLore(lk,gone.id);le=null;closeLore();toast('삭제했어요.');
};
/* ── 분류 편집: 이 원고의 세계관/설정집 분류를 직접 추가·이름 바꾸기·삭제 ── */
const cmN=c=>L().items.filter(x=>x.c===c).length;
function cmShow(on){const p=$('#lcm'),b=$('#lcb');p.hidden=!on;b.setAttribute('aria-expanded',on);if(on)paintCm()}
function paintCm(){
  const cs=L().cats,one=cs.length<=1;
  $('#lcm').innerHTML=`<p class="lch">${esc(L().name)} 분류 <small>이 원고에만 적용돼요 · 최대 ${CAT_MAX}개</small></p>`
    +`<ul>${cs.map((c,i)=>`<li><input class="cin" value="${esc(c)}" maxlength="${CAT_LEN}" data-i="${i}" aria-label="분류 이름" autocomplete="off"><span class="cn">${cmN(c)}개</span><button type="button" class="cdl" data-i="${i}" ${one?'disabled title="분류는 하나 이상 있어야 해요"':''}>삭제</button></li>`).join('')}</ul>`
    +(cs.length<CAT_MAX?`<form id="lcf"><label class="sr" for="lci">새 분류 이름</label><input class="cin" id="lci" maxlength="${CAT_LEN}" placeholder="새 분류 이름 + Enter" autocomplete="off"><button type="submit">추가</button></form>`:'');
}
function catName(v,except){
  v=v.trim();
  if(!v){toast('분류 이름을 적어 주세요.');return null}
  if(L().cats.some((c,i)=>c===v&&i!==except)){toast('이미 있는 분류예요.');return null}
  return v;
}
$('#lcb').onclick=()=>cmShow($('#lcm').hidden);
$('#lcm').addEventListener('change',e=>{
  const t=e.target;if(!t.classList.contains('cin')||t.id==='lci')return;
  const cs=L().cats,i=+t.dataset.i,old=cs[i],nv=catName(t.value,i);
  if(nv===null||nv===old){paintCm();return}
  cs[i]=nv;L().items.forEach(x=>{if(x.c===old){x.c=nv;db.lore(lk,x)}});
  if(lf===old)lf=nv;
  setCats(lk,cs);paintCm();paintLore();
});
$('#lcm').addEventListener('submit',e=>{
  e.preventDefault();const i=$('#lci'),cs=L().cats;if(!i||cs.length>=CAT_MAX)return;
  const nv=catName(i.value,-1);if(nv===null)return;
  cs.push(nv);setCats(lk,cs);paintCm();paintLore();$('#lci')&&$('#lci').focus();
});
let cdT;
$('#lcm').addEventListener('click',e=>{
  const b=e.target.closest('.cdl');if(!b||b.disabled)return;
  const cs=L().cats,i=+b.dataset.i,c=cs[i],n=cmN(c);
  if(!b.dataset.arm){
    b.dataset.arm=1;b.textContent=n?`항목 ${n}개 옮기고 삭제`:'정말 삭제';
    clearTimeout(cdT);cdT=setTimeout(()=>{if(b.isConnected){delete b.dataset.arm;b.textContent='삭제'}},3000);return;
  }
  clearTimeout(cdT);
  const rest=cs.filter((_,j)=>j!==i),to=rest[0];
  L().items.forEach(x=>{if(x.c===c){x.c=to;db.lore(lk,x)}});
  if(lf===c)lf='전체';
  setCats(lk,rest);paintCm();paintLore();
  toast(n?`‘${c}’ 분류를 지우고 항목 ${n}개를 ‘${to}’로 옮겼어요.`:`‘${c}’ 분류를 지웠어요.`);
});

/* ── 항목 연결: 세계관·설정집 항목과 화를 서로 이어요. 연결은 항목에 {k:'world'|'codex'|'ch', id, r:관계}로 저장하고, 반대쪽은 계산해서 보여 줘요 ── */
const LK_MAX=30,KN={world:'세계관',codex:'설정집',ch:'화'};
const REL=['관련','가족','친구','연인','적대','스승','소속','등장','심은 화','회수'];
const tgt=(k,id)=>wk?(k==='ch'?wk.chs:wk[k]||[]).find(o=>o.id===id):null;
const tName=(k,o)=>k==='ch'?o.n+'화'+(o.t&&o.t.trim()?' · '+o.t.trim():''):(o.t&&o.t.trim())||'제목 없음';
const lks=x=>(x.l||[]).filter(o=>tgt(o.k,o.id)&&!(o.k===lk&&o.id===x.id));   /* 사라진 대상은 걸러요 */
const lkAll=x=>(x.l||[]).filter(o=>tgt(o.k,o.id));
function badges(x){
  const a=(x.l||[]).filter(o=>tgt(o.k,o.id)),rv=a.find(o=>o.k==='ch'&&o.r==='회수');
  let h='';
  if(rv)h+=`<em class="bd ok">회수됨 · ${tgt('ch',rv.id).n}화</em>`;
  else if(x.c==='복선')h+='<em class="bd">미회수</em>';
  if(a.length)h+=`<em class="bd">연결 ${a.length}</em>`;
  return h;
}
const lkTag=k=>`<span class="lkt">${KN[k]}</span>`;
function paintLinks(){
  if(!le)return;
  le.l=lks(le);   /* 사라진 대상·자기 자신으로의 연결을 정리해서 아래 번호(i)가 항상 맞게 해요 */
  const out=le.l.map((o,i)=>[o,i]);
  $('#lll').innerHTML=out.length?out.map(([o,i])=>`<li>${lkTag(o.k)}<button type="button" class="lgo" data-k="${o.k}" data-id="${o.id}">${esc(tName(o.k,tgt(o.k,o.id)))}</button><input class="lrel" value="${esc(o.r||'')}" maxlength="12" data-i="${i}" placeholder="관계" aria-label="관계 이름" autocomplete="off"><button type="button" class="lx" data-i="${i}" aria-label="연결 해제" title="연결 해제">×</button></li>`).join(''):'<li class="none">아직 연결이 없어요. 인물 관계나 복선을 회수한 화를 이어 보세요.</li>';
  const back=[];
  ['world','codex'].forEach(k=>(wk[k]||[]).forEach(y=>{if(y===le)return;(y.l||[]).forEach(o=>{if(o.k===lk&&o.id===le.id)back.push([k,y,o.r])})}));
  $('#llb').innerHTML=back.map(([k,y,r])=>`<li>${lkTag(k)}<button type="button" class="lgo" data-k="${k}" data-id="${y.id}">${esc(tName(k,y))}</button>${r?`<em class="lr">${esc(r)}</em>`:''}</li>`).join('');
  $('#llbh').hidden=!back.length;$('#llb').hidden=!back.length;
}
function lkPick(on){
  const p=$('#llp'),b=$('#lla');p.hidden=!on;b.setAttribute('aria-expanded',on);
  if(on){$('#llq').value='';$('#llr').value='';$('#llc2').innerHTML=REL.map(r=>`<button type="button" class="chip" data-r="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join('');paintPick();$('#llq').focus()}
}
function paintPick(){
  const q=$('#llq').value.trim().toLowerCase(),have=new Set((le.l||[]).map(o=>o.k+':'+o.id)),rows=[];
  ['world','codex'].forEach(k=>(wk[k]||[]).forEach(y=>{if(!(k===lk&&y.id===le.id)&&!have.has(k+':'+y.id))rows.push([k,y])}));
  wk.chs.forEach(c=>{if(!have.has('ch:'+c.id))rows.push(['ch',c])});
  const hit=rows.filter(([k,y])=>!q||tName(k,y).toLowerCase().includes(q)||(k!=='ch'&&y.c&&y.c.toLowerCase().includes(q))).slice(0,40);
  $('#llc').innerHTML=hit.length?hit.map(([k,y])=>`<li><button type="button" data-k="${k}" data-id="${y.id}">${lkTag(k)}<span>${esc(tName(k,y))}</span>${k!=='ch'&&y.c?`<small>${esc(y.c)}</small>`:''}</button></li>`).join(''):'<li class="none">연결할 수 있는 항목이 없어요.</li>';
}
$('#lla').onclick=()=>lkPick($('#llp').hidden);
$('#llq').addEventListener('input',paintPick);
$('#llc2').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;$('#llr').value=b.dataset.r;$('#llc2').querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c===b))};
$('#llr').addEventListener('input',()=>$('#llc2').querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c.dataset.r===$('#llr').value.trim())));
$('#llc').onclick=e=>{
  const b=e.target.closest('button[data-id]');if(!b||!le)return;
  if(lkAll(le).length>=LK_MAX)return toast('연결은 항목마다 '+LK_MAX+'개까지 걸 수 있어요.');
  const k=b.dataset.k,id=+b.dataset.id,r=$('#llr').value.trim().slice(0,12)||(k==='ch'?'등장':'관련');
  le.l=lks(le);le.l.push({k,id,r});saveLore();lkPick(false);paintLinks();
};
$('#lll').addEventListener('change',e=>{
  const t=e.target;if(!t.classList.contains('lrel')||!le||!le.l[+t.dataset.i])return;
  le.l[+t.dataset.i].r=t.value.trim().slice(0,12);saveLore();
});
function lkGo(k,id){
  const o=tgt(k,id);if(!o)return;
  closeLore();
  if(k==='ch'){view('edit');openCh(o)}
  else{view(k);openLore(o)}
}
$('#llk').addEventListener('click',e=>{
  const g=e.target.closest('.lgo');if(g)return lkGo(g.dataset.k,+g.dataset.id);
  const x=e.target.closest('.lx');
  if(x&&le){le.l.splice(+x.dataset.i,1);saveLore();paintLinks()}
});

counts();
