const PANE={home:'home',works:'works',all:'wall',edit:'edit',world:'lore',codex:'lore'};
const NAV={nh:'home',ne:'works',sw1:'edit',nwd:'world',ncd:'codex'};
/* 원고를 누르면 세계관·설정집이 펼쳐져요. 설정 화면에 있을 땐 항상 펼쳐 둬요 */
function kids(on){const w=$('#wt1');w.dataset.open=on;$('#sw1').setAttribute('aria-expanded',on);$('#kd1').inert=!on;[...$('#kd1').querySelectorAll('.si')].forEach(b=>b.tabIndex=on?0:-1)}
function view(v){
  if(v!=='edit'&&cur){clearTimeout(timer);save();if(app.classList.contains('focus'))focusMode(false)}
  if(le&&PANE[v]!=='lore')closeLore();
  app.dataset.v=v;
  fontPanel(false);spPanel(false);ltHide();
  ['home','works','wall','edit','lore'].forEach(p=>$('#'+p).hidden=p!==PANE[v]);
  Object.entries(NAV).forEach(([id,k])=>$('#'+id).setAttribute('aria-current',(v===k||(k==='works'&&v==='all'))?(id==='nh'||id==='ne'?'page':'true'):'false'));
  $('#sw1').dataset.in=(v==='world'||v==='codex');if(v==='world'||v==='codex')kids(true);
  if(v==='edit'&&!cur)openCh(chs[chs.length-1]);
  if(v==='edit')scan();
  if(v==='home')home();
  if(v==='works')worksHome();
  if(v==='all')worksAll();
  if(v==='world'||v==='codex')lore(v);
  setMenu(false);scrollTo(0,0);
}
function home(){
  if(!chs.length)return;
  const last=chs[chs.length-1],src=chs.slice().reverse().find(c=>c.c.trim())||last,paras=src.c.split('\n').filter(x=>x.trim()); /* src: 글이 있는 가장 뒤쪽 화 */
  const none=!chs.some(c=>c.c.trim()),wrote=!!last.c.trim(); /* none: 이 원고에 쓴 글이 아직 하나도 없음(새 계정의 첫 화면) */
  const g=none?'새 원고 · 첫 화':wk.at?(when(wk.at)==='오늘'?'오늘':when(wk.at)==='어제'?'어제':when(wk.at)+'에')+' 멈춘 곳':'멈춘 곳';
  $('#cs').textContent=g;
  $('#ex').textContent=none?'아직 쓴 글이 없어요. 첫 문장을 남기면 여기에 이어서 나와요.':paras[paras.length-1]||'아직 쓴 글이 없어요.';
  $('#gt').firstChild.textContent=none?'첫 화 쓰기':last.n+(wrote?'화 이어 쓰기':'화 쓰기');$('#tod').textContent=gained();goal();
}
$('#nh').onclick=()=>view('home');$('#ne').onclick=()=>view('works');$('#sw1').onclick=()=>{if(app.dataset.v==='edit')kids($('#wt1').dataset.open!=='true');else{view('edit');kids(true)}};$('#nwd').onclick=()=>view('world');$('#ncd').onclick=()=>view('codex');
$('#resume').onclick=()=>view('edit');
let uname='';
function paintDate(){ /* 날짜·인사말: 로그인할 때와 날짜가 바뀔 때 다시 그려요 */
  const d=new Date(),h=d.getHours();
  $('#dt').textContent=d.toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'});
  if(uname)$('#gr').textContent=(h<5?'늦은 밤이에요':h<11?'좋은 아침이에요':h<17?'좋은 오후예요':'좋은 저녁이에요')+', '+uname+'.';
}
const setUser=u=>{uname=u;$('#me').textContent=u;paintDate()};
paintDate();
let memos=[]; /* {id,t,at} — 서버에서 읽어 온 메모는 hydrate 가 채워요 */
const memoLi=(m,i)=>`<li><span>${esc(m.t)}</span><small>${ago(m.at)}</small><button type="button" data-i="${i}" aria-label="메모 삭제"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`;
function notes(){
  const none='<li class="none">아직 메모가 없어요. 떠오른 생각을 바로 적어 두세요.</li>';
  $('#notes').innerHTML=memos.length?memos.slice(0,4).map(memoLi).join(''):none;
  $('#mpl').innerHTML=memos.length?memos.map(memoLi).join(''):none;
  $('#sbl').innerHTML=memos.slice(0,3).map(memoLi).join('');
}
const addMemo=t=>{const m={id:Date.now(),t,at:Date.now()};memos.unshift(m);db.memoAdd(m);while(memos.length>30)db.memoDel(memos.pop().id);notes()};
const memoClick=e=>{const b=e.target.closest('button');if(!b)return;const [m]=memos.splice(+b.dataset.i,1);if(m)db.memoDel(m.id);notes()};
$('#mf').onsubmit=e=>{e.preventDefault();const i=$('#mi'),t=i.value.trim();if(!t)return;addMemo(t);i.value=''};
$('#sbf').onsubmit=e=>{e.preventDefault();const i=$('#sbi'),t=i.value.trim();if(!t)return;addMemo(t);i.value=''};
$('#notes').onclick=$('#mpl').onclick=$('#sbl').onclick=memoClick;

const GOALS=[1000,2000,3000,5000],calm=matchMedia('(prefers-reduced-motion:reduce)').matches;let gi=1;
function countUp(el,to){
  const f=+el.dataset.v||0,dl=app.classList.contains('arrive')&&!f?1500:0;el.dataset.v=to;el.textContent=fmt(f);
  if(f===to||calm){el.textContent=fmt(to);return}
  const t0=performance.now()+dl;(function s(t){const k=Math.min(1,Math.max(0,(t-t0)/900));el.textContent=fmt(Math.round(f+(to-f)*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(s)})(t0);
}
function goal(){
  const g=Math.max(0,tot()-base.s),tg=GOALS[gi];
  countUp($('#gnum'),g);countUp($('#gst'),streak());countUp($('#gtt'),tot());
  $('#gtg').textContent='/ '+fmt(tg)+'자';$('#goal').classList.toggle('hit',g>=tg);
  setTimeout(()=>$('#goal .gbar i').style.width=Math.min(100,g/tg*100)+'%',app.classList.contains('arrive')?1500:30);
}
/* 하루 목표·화당 목표: 홈 버튼과 에디터 패널(Aa)이 같은 함수를 써요 */
function paintGoals(){
  $('#cgo').innerHTML=CGOALS.map((n,i)=>`<button type="button" data-i="${i}" aria-pressed="${i===ci}">${fmt(n)}자</button>`).join('');
  $('#dgo').innerHTML=GOALS.map((n,i)=>`<button type="button" data-i="${i}" aria-pressed="${i===gi}">${fmt(n)}자</button>`).join('');
}
function setDaily(i,quiet){gi=i;db.pref('goal',gi);goal();paintGoals();if(!quiet)toast('하루 목표를 '+fmt(GOALS[gi])+'자로 바꿨어요.')}
function setChGoal(i){ci=i;db.pref('cgoal',ci);paintGoals();if(cur){paintCmeta();stats()}paintWorks();repaintCards();toast('한 화 목표를 '+fmt(CGOALS[ci])+'자로 바꿨어요.')}
$('#gbtn').onclick=()=>setDaily((gi+1)%GOALS.length);
$('#cgo').onclick=e=>{const b=e.target.closest('button');if(b)setChGoal(+b.dataset.i)};
$('#dgo').onclick=e=>{const b=e.target.closest('button');if(b)setDaily(+b.dataset.i)};
paintGoals();

kids(false);
