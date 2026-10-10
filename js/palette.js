const pal=$('#pal'),pq=$('#pq'),pl=$('#pl');let pit=[],pi=0;
$('#kb kbd').textContent=/Mac|iP/.test(navigator.platform)?'⌘K':'Ctrl K';
function pall(){
  const a=[['홈','이동',()=>view('home')],['내 원고','이동',()=>view('works')],['세계관',wTitle,()=>view('world')],['설정집',wTitle,()=>view('codex')],['집중 모드','편집',()=>{view('edit');focusMode(!app.classList.contains('focus'))}]];
  chs.slice().reverse().forEach(c=>a.push([c.n+'화 '+(c.t||'제목 없음'),'원고',()=>{view('edit');open(c)}]));
  [['world','세계관'],['codex','설정집']].forEach(([k,n])=>LORE[k].items.forEach(x=>x.t.trim()&&a.push([x.t,n+' · '+x.c,()=>{view(k);openLore(x)}])));
  return a;
}
function prender(){
  const q=pq.value.trim().toLowerCase();pit=pall().filter(i=>!q||i[0].toLowerCase().includes(q)).slice(0,8);pi=Math.min(pi,Math.max(0,pit.length-1));
  pl.innerHTML=pit.length?pit.map((i,k)=>`<li role="option" data-k="${k}" aria-selected="${k===pi}"><span>${esc(i[0])}</span><small>${esc(i[1])}</small></li>`).join(''):'<li class="none">찾는 항목이 없어요.</li>';
}
function popen(on){pal.hidden=!on;if(on){pq.value='';pi=0;prender();pq.focus()}}
const pgo=k=>{const i=pit[k];if(!i)return;popen(false);i[2]()};
pq.oninput=()=>{pi=0;prender()};
pq.onkeydown=e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();pi=(pi+(e.key==='ArrowDown'?1:-1)+pit.length)%(pit.length||1);prender()}
  else if(e.key==='Enter'){e.preventDefault();pgo(pi)}
  else if(e.key==='Escape'){e.stopPropagation();popen(false)}
};
pl.onclick=e=>{const li=e.target.closest('li[data-k]');if(li)pgo(+li.dataset.k)};
pal.onclick=e=>{if(e.target===pal)popen(false)};
$('#kb').onclick=()=>popen(true);
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!app.inert){e.preventDefault();popen(pal.hidden)}});
