const pal=$('#pal'),pq=$('#pq'),pl=$('#pl');let pit=[],pi=0;
const MOD=/Mac|iP/.test(navigator.platform)?'⌘':'Ctrl';
document.querySelectorAll('#kb kbd,#kb2 kbd').forEach(k=>k.textContent=MOD==='⌘'?'⌘K':'Ctrl K');
function pall(){
  const a=[['홈','이동',()=>view('home')],['내 원고','이동',()=>view('works')],['세계관',wk.t,()=>view('world')],['설정집',wk.t,()=>view('codex')],['집중 모드','편집',()=>{view('edit');focusMode(!app.classList.contains('focus'))}],['맞춤법 오류 목록','편집',()=>{view('edit');spPanel(true)}],['새 원고 만들기','원고',newWork]];
  a.push(['단축키 도움말','도움말',()=>hopen(true)]);
  WORKS.filter(w=>w!==wk).forEach(w=>a.push([w.t,'원고 전환',()=>enterWork(w.id)]));
  chs.slice().reverse().forEach(c=>a.push([c.n+'화 '+(c.t||'제목 없음'),'원고',()=>{view('edit');open(c)}]));
  [['world','세계관'],['codex','설정집']].forEach(([k,n])=>LORE[k].items.forEach(x=>x.t.trim()&&a.push([x.t,n+' · '+x.c,()=>{view(k);openLore(x)}])));
  return a;
}
function prender(){
  const q=pq.value.trim().toLowerCase();pit=pall().filter(i=>!q||i[0].toLowerCase().includes(q)).slice(0,8);pi=Math.min(pi,Math.max(0,pit.length-1));
  pl.innerHTML=pit.length?pit.map((i,k)=>`<li role="option" data-k="${k}" aria-selected="${k===pi}"><span>${esc(i[0])}</span><small>${esc(i[1])}</small></li>`).join(''):'<li class="none">찾는 항목이 없어요.</li>';
}
function popen(on){if(on)setMenu(false);pal.hidden=!on;if(on){pq.value='';pi=0;prender();pq.focus()}}
const pgo=k=>{const i=pit[k];if(!i)return;popen(false);i[2]()};
pq.oninput=()=>{pi=0;prender()};
pq.onkeydown=e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();pi=(pi+(e.key==='ArrowDown'?1:-1)+pit.length)%(pit.length||1);prender()}
  else if(e.key==='Enter'){e.preventDefault();pgo(pi)}
  else if(e.key==='Escape'){e.stopPropagation();popen(false)}
};
pl.onclick=e=>{const li=e.target.closest('li[data-k]');if(li)pgo(+li.dataset.k)};
pal.onclick=e=>{if(e.target===pal)popen(false)};
$('#kb').onclick=()=>popen(true);$('#kb2').onclick=()=>popen(true);
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!app.inert){e.preventDefault();popen(pal.hidden)}});

/* 단축키 도움말: 사이드바의 '단축키' 버튼, ? 키, 빠른 이동에서 열어요 */
const HP=[
 ['어디서나',[['빠른 이동 열기',[MOD,'K']],['이 도움말 열기',['?']]]],
 ['글 쓰는 중',[['저장',[MOD,'S']],['찾기·바꾸기',[MOD,'F']],['장면 구분선(* * *) 넣기',[MOD,'Enter']],['@ 다음에 이름을 치면 설정 자동완성',['@']],['다음 맞춤법 오류로',['F8']],['이전 맞춤법 오류로',['Shift','F8']],['밑줄 친 설정 이름으로 이동',[MOD,'클릭']]]],
 ['닫기·되돌리기',[['열린 패널·찾기·집중 모드 닫기',['Esc']],['제목 입력 취소',['Esc']]]],
 ['마우스·터치',[['화 제목 고치기','목록에서 더블클릭'],['원고 제목 고치기','카드 오른쪽 위 연필']]]];
const kbd=a=>Array.isArray(a)?a.map(k=>`<kbd>${esc(k)}</kbd>`).join(''):`<span class="hn">${esc(a)}</span>`;
let hFrom=null;
function hopen(on){
  const hp=$('#hp');if(on===!hp.hidden)return;
  if(on){hFrom=document.activeElement;setMenu(false);
    $('#hpl').innerHTML=HP.map(([g,r])=>`<h3>${g}</h3>`+r.map(([t,k])=>`<div class="hr"><span>${t}</span><span>${kbd(k)}</span></div>`).join('')).join('');
    hp.hidden=false;$('#hpx').focus()}
  else{hp.hidden=true;hFrom&&hFrom.isConnected&&hFrom.focus();hFrom=null}
}
$('#hlp').onclick=()=>hopen(true);$('#hpx').onclick=()=>hopen(false);
$('#hp').onclick=e=>{if(e.target.id==='hp')hopen(false)};
$('#hp').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();hopen(false)}else if(e.key==='Tab'){e.preventDefault();$('#hpx').focus()}});
addEventListener('keydown',e=>{
  if(e.key!=='?'||e.ctrlKey||e.metaKey||e.altKey||app.inert||e.isComposing)return;
  const t=e.target;if(t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||t.isContentEditable))return;
  e.preventDefault();hopen($('#hp').hidden);
});
