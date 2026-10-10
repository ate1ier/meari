const $=s=>document.querySelector(s);
const esc=s=>s.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
const fmt=n=>n.toLocaleString('ko-KR'),raw=t=>t.replace(/\n/g,'').length;
const SIZES=[1.02,1.15,1.3,1.5];
/* 제목 글자 수 한도 — 서버(meari-api)·DB 제약과 같은 값이에요: 원고 60, 화·설정 이름 100 */
const TL={work:60,ch:100,lore:100};
/* 목표는 두 가지예요. 하루 목표(GOALS, 홈·집필량)와 화당 목표(CGOALS, 에디터 진행 막대·원고 카드)를 따로 저장해요 */
const CGOALS=[2000,3000,4000,5000,6000];let ci=1;
const GOAL=()=>CGOALS[ci];
/* 화마다 상태(s: draft·revise·done)와 개별 목표(g: 0이면 원고 기본값)를 가져요 */
const STS=[['draft','초고'],['revise','퇴고'],['done','완료']],stName=k=>(STS.find(x=>x[0]===k)||STS[0])[1];
const cGoal=c=>c.g||GOAL();
/* 문단 모양: 들여쓰기(em)·문단 간격(em, 마지막은 한 줄 비움)·줄 폭 / 프리셋은 [들여쓰기,간격,줄폭] 인덱스 */
const PF_IND=[['없음',0],['1칸',1],['2칸',2]],PF_GAP=[['없음',0],['좁게',.4],['보통',1],['한 줄',-1]],PF_W=[['좁게','34rem'],['보통','56rem'],['넓게','72rem']];
const PF_PRE=[['웹소설형',[0,3,0]],['단행본형',[1,0,1]]],PF_DEF=[1,1,1];
let pf=PF_DEF.slice(); /* 저장된 값은 hydrate 가 채워요 */
/* 새 계정은 빈 1화 하나로 시작해요. 서버에서 내 데이터를 읽어 와 채우기 전까지 chs 는 비어 있어요(db.js → main.js hydrate) */
const SEED_CHS=[{id:1,n:1,t:'',c:'',s:'draft',g:0}];
const SEED_MEMOS=[];
let WORKS=[],wk=null; /* WORKS: 내 모든 원고, wk: 지금 열려 있는 원고. chs 는 항상 wk.chs 와 같은 배열이에요 */
let chs=[];
let cur=null,size=1,strict=false,timer,tt;
const app=$('#app'),ed=$('#ed'),ti=$('#ti'),fi=$('#fi'),ri=$('#ri');
/* 화별 글자 수 캐시: 본문 문자열이 그대로면 다시 세지 않아요(타자마다 전체 화를 훑지 않도록) */
const rawN=c=>c._rk===c.c?c._rv:(c._rk=c.c,c._rv=raw(c.c));
const lenN=c=>strict?(c._sk===c.c?c._sv:(c._sk=c.c,c._sv=c.c.replace(/\s/g,'').length)):rawN(c);
const tot=()=>WORKS.reduce((s,w)=>w.chs.reduce((a,c)=>a+rawN(c),s),0); /* 오늘 쓴 양·전체 분량은 모든 원고를 합쳐요 */
const day=new Date().toLocaleDateString('sv');
let base={d:day,s:0},lastEdit=0;
const touch=()=>{lastEdit=Date.now();if(wk)wk.at=lastEdit}; /* base: 오늘 시작 시점의 전체 글자 수, lastEdit: 마지막 수정 시각(ms) */
const gained=()=>'오늘 +'+fmt(Math.max(0,tot()-base.s))+'자';
/* 날짜별 집필량: {'2026-09-30':1234}. 오늘 +N자와 같은 값을 하루 단위로 저장 */
const dkey=x=>x.toLocaleDateString('sv');
let wlog={};
function logDay(){const g=Math.max(0,tot()-base.s);if((wlog[day]||0)===g)return;if(g)wlog[day]=g;else delete wlog[day];db.log(day)}
function toast(t,a){const e=$('#toast');e.textContent=t;e.classList.toggle('act',!!a);
  if(a){const b=document.createElement('button');b.type='button';b.textContent=a.l;b.onclick=()=>{e.classList.remove('on');a.f()};e.append(b)}
  e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),a?6000:2300)}
function setMenu(o){app.classList.toggle('open',o);$('#menu').setAttribute('aria-label',o?'메뉴 닫기':'메뉴 열기')}
const setTheme=d=>{const r=document.documentElement;d?r.dataset.theme='dark':r.removeAttribute('data-theme');const m=document.querySelector('meta[name=theme-color]');if(m)m.content=d?'#121214':'#ffffff'};
const settle=()=>setTimeout(()=>app.classList.remove('arrive'),3400);
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey,inEdit=app.dataset.v==='edit';
  if(mod&&k==='s'&&inEdit){e.preventDefault();save();toast('저장했어요.')}
  else if(mod&&k==='f'&&inEdit){e.preventDefault();findBar(true)}
  else if(mod&&e.key==='Enter'&&document.activeElement===ed){e.preventDefault();document.execCommand('insertParagraph');document.execCommand('insertText',false,'* * *');document.execCommand('insertParagraph')}
  else if(e.key==='Escape'){if(!$('#lore').hidden&&!$('#lod').hidden)closeLore();else if(!$('#fpn').hidden)fontPanel(false);else if(!$('#mp').hidden)memoPanel(false,true);else if(!$('#spp').hidden)spPanel(false,true);else if(!$('#fb').hidden)findBar(false);else if(app.classList.contains('focus'))focusMode(false);else setMenu(false)}
});
/* 창을 닫거나 탭을 숨길 때 마지막 입력을 서버로 밀어 넣고, 아직 못 보낸 게 있으면 경고 */
addEventListener('beforeunload',e=>{save();if(db.pending()){e.preventDefault();e.returnValue=''}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)save()});
document.addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(b){toast(b.dataset.t);setMenu(false)}});
$('#menu').onclick=()=>setMenu(!app.classList.contains('open'));$('#scrim').onclick=()=>setMenu(false);
