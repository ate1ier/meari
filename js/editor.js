const OPT_DEF={hl:1,sp:1,rep:0,q:1,el:1,da:0},OPT={...OPT_DEF};
const text=()=>ed.innerText.replace(/\n$/,''),len=t=>strict?t.replace(/\s/g,'').length:raw(t);
let chRn=null,chDq=null,chDt,listHtml='';
const EL={cnt:$('#cnt'),mae:$('#mae'),td:$('#td'),gl:$('#gl'),glr:$('#glr'),edit:$('#edit'),page:$('#page'),st:$('#st'),chs:$('#chs')}; /* 타자마다 쓰는 요소는 한 번만 찾아 둬요 */
const CI={ren:'M4 20h4l10-10-4-4L4 16zM13 7l4 4',up:'M6 15l6-6 6 6',dn:'M6 9l6 6 6-6',del:'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13'};
const chBtn=(a,l,d)=>`<button type="button" data-a="${a}" aria-label="${l}" title="${l}"${d?' disabled':''}><svg viewBox="0 0 24 24"><path d="${CI[a]}"/></svg></button>`;
function list(f){
  if(!f&&($('#chs .rn')||$('#chs').contains(document.activeElement)))return;
  const html=chs.map((c,i)=>{
    if(chRn===c.id)return `<div class="chw"><div class="rnb"><b>${c.n}화</b><input class="rn" maxlength="40" value="${esc(c.t)}" placeholder="제목 없음" aria-label="${c.n}화 제목"></div></div>`;
    const ask=chDq===c.id;
    return `<div class="chw${c===cur?' on':''}${ask?' dq':''}" data-id="${c.id}"><button class="ch" type="button" data-id="${c.id}" aria-current="${c===cur}"><b>${c.n}화</b><span>${esc(c.t)||'제목 없음'}</span><small>${fmt(lenN(c))}자</small></button><div class="cact">${chBtn('ren','제목 고치기')}${chBtn('up','위로',i===0)}${chBtn('dn','아래로',i===chs.length-1)}${ask?'<button type="button" class="ask" data-a="del">정말 삭제</button>':chBtn('del','삭제')}</div></div>`;
  }).join('');
  if(html!==listHtml){listHtml=html;EL.chs.innerHTML=html} /* 바뀐 게 없으면 다시 그리지 않아요 */
}
function stats(){queueMicrotask(men);scanSoon();
  const t=text(),r=raw(t),n=strict?len(t):r;cur.c=t;cur._rk=t;cur._rv=r;
  EL.cnt.textContent=fmt(n)+'자';EL.mae.textContent='원고지 '+Math.ceil(r/200)+'매';EL.td.textContent=gained();
  const p=Math.min(100,n/GOAL*100);EL.gl.style.width=p+'%';EL.glr.setAttribute('aria-label','한 화 목표 3,000자 중 '+Math.round(p)+'%');
  EL.edit.classList.toggle('done',n>=GOAL);EL.page.classList.toggle('empty',!t.trim());
  [...ed.children].forEach(el=>el.classList.toggle('sb',/^\s*(\*\s*){3}$/.test(el.textContent)));
}
function save(){
  if(!cur)return;cur.c=text();cur.t=ti.value.trim();
  const sig=cur.t+'\0'+cur.c;
  if(cur._sig!==sig){cur._sig=sig;db.chapter(cur)}else if(!db.pending())EL.st.textContent='저장됨';
  logDay();list()
}
function later(){lastEdit=Date.now();EL.st.textContent='저장 중…';clearTimeout(timer);timer=setTimeout(save,700)}
function open(c){
  if(cur){clearTimeout(timer);save()}
  cur=c;$('#num').textContent=c.n;ti.value=c.t;
  ed.innerHTML=c.c.split('\n').map(l=>`<div>${l?esc(l):'<br>'}</div>`).join('');
  list(true);stats();mark();if(fi.value)find();scrollTo(0,0);
}
function mark(){
  const s=getSelection().anchorNode;let el=s&&ed.contains(s)?(s.nodeType===3?s.parentNode:s):null;
  while(el&&el!==ed&&el.parentNode!==ed)el=el.parentNode;
  ed.querySelectorAll('.on').forEach(x=>x.classList.remove('on'));
  if(el&&el!==ed){el.classList.add('on');return el}
}
function edited(){stats();later();if(fi.value)find(true)}
ed.addEventListener('beforeinput',e=>{
  if(!OPT.q||e.inputType!=='insertText'||(e.data!=='"'&&e.data!=="'"))return;
  const r=getSelection().getRangeAt(0),nd=r.startContainer,prev=nd.nodeType===3?nd.data[r.startOffset-1]:'';
  const op=!prev||/[\s(\[“‘—]/.test(prev);
  e.preventDefault();document.execCommand('insertText',false,e.data==='"'?(op?'“':'”'):(op?'‘':'’'));
});
ed.addEventListener('input',e=>{
  if(!ed.firstElementChild)document.execCommand('formatBlock',false,'div');
  if(e.data==='.'&&OPT.el||e.data==='-'&&OPT.da){const s=getSelection(),nd=s.anchorNode,o=s.anchorOffset,dot=e.data==='.';
    if(nd&&nd.nodeType===3&&nd.data.slice(o-(dot?3:2),o)===(dot?'...':'--')){s.setBaseAndExtent(nd,o-(dot?3:2),nd,o);document.execCommand('insertText',false,dot?'…':'—')}}
  edited();
  if(app.classList.contains('focus')){const el=mark();if(el)scrollBy({top:el.getBoundingClientRect().top-innerHeight*.4})}
});
ed.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,(e.clipboardData||window.clipboardData).getData('text/plain'))});
document.addEventListener('selectionchange',mark);
ti.addEventListener('input',()=>{cur.t=ti.value.trim();later()});
ti.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ed.focus()}});
let ranges=[],ai=0;
function find(keep){
  ranges=[];const q=fi.value.toLowerCase();
  if(q){const w=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);let nd;
    while(nd=w.nextNode()){const t=nd.data.toLowerCase();let i=0;
      while((i=t.indexOf(q,i))>-1){const r=new Range();r.setStart(nd,i);r.setEnd(nd,i+q.length);ranges.push(r);i+=q.length}}}
  if(ai>=ranges.length)ai=0;paint(!keep);
}
function paint(sc){
  if(window.CSS&&CSS.highlights){CSS.highlights.delete('f');CSS.highlights.delete('fc');
    if(ranges.length){CSS.highlights.set('f',new Highlight(...ranges));const hh=new Highlight(ranges[ai]);hh.priority=1;CSS.highlights.set('fc',hh)}}
  $('#fn').textContent=fi.value?(ranges.length?(ai+1)+' / '+ranges.length:'없음'):'';
  if(sc&&ranges[ai])ranges[ai].startContainer.parentElement.scrollIntoView({block:'center',behavior:'smooth'});
}
function step(x){if(!ranges.length)return;ai=(ai+x+ranges.length)%ranges.length;paint(true)}
function rep(all){
  if(!ranges.length)return;const rv=ri.value,k=ranges.length;
  (all?[...ranges].reverse():[ranges[ai]]).forEach(r=>{r.deleteContents();r.insertNode(document.createTextNode(rv))});
  ed.normalize();edited();find();if(all)toast(k+'곳을 바꿨어요.');
}
function findBar(on){
  $('#fb').hidden=!on;$('#fdb').setAttribute('aria-expanded',on);
  if(on){const s=getSelection().toString();if(s&&!s.includes('\n'))fi.value=s;fi.focus();fi.select();find()}else{fi.value='';find();ed.focus()}
}
$('#fdb').onclick=()=>findBar($('#fb').hidden);$('#fx').onclick=()=>findBar(false);
fi.oninput=()=>{ai=0;find()};
fi.onkeydown=ri.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.target===ri?rep(false):step(e.shiftKey?-1:1)}};
$('#fnx').onclick=()=>step(1);$('#fpv').onclick=()=>step(-1);$('#r1').onclick=()=>rep(false);$('#ra').onclick=()=>rep(true);
const persist=()=>{lastEdit=Date.now();db.chapters()}; /* 순서·번호·제목 변경은 전체 목록을 한 번에 저장 */
const renum=b=>{chs.forEach((c,i)=>c.n=b+i);if(cur)$('#num').textContent=cur.n};
function chFocus(id,a){const w=$(`#chs .chw[data-id="${id}"]`);if(!w)return;const b=w.querySelector(`[data-a="${a}"]:not(:disabled)`)||w.querySelector('[data-a]:not(:disabled)')||w.querySelector('.ch');b&&b.focus()}
function chRename(c){clearTimeout(chDt);chDq=null;chRn=c.id;list(true);const i=$('#chs .rn');i.focus();i.select()}
function chEndRn(ok){
  if(chRn===null)return;const c=chs.find(x=>x.id===chRn),i=$('#chs .rn'),v=i?i.value.trim():null;chRn=null;
  if(c&&ok&&v!==null&&v!==c.t){c.t=v;if(c===cur)ti.value=v;persist()}
  list(true);if(c)chFocus(c.id,'ren');
}
function chMove(c,d){
  const i=chs.indexOf(c),j=i+d;if(j<0||j>=chs.length)return;
  const b=chs[0].n;[chs[i],chs[j]]=[chs[j],chs[i]];renum(b);persist();list(true);chFocus(c.id,d<0?'up':'dn');
}
function chDel(c){
  if(chs.length<2){toast('마지막 한 화는 지울 수 없어요.');chDq=null;list(true);return}
  const i=chs.indexOf(c),b=chs[0].n,sz=rawN(c),nn=c.n;
  chs.splice(i,1);renum(b);base.s=Math.max(0,base.s-sz);db.pref('base',base);db.delChapter(c.id);persist();chDq=null;
  if(c===cur){clearTimeout(timer);cur=null;open(chs[Math.min(i,chs.length-1)])}else list(true);
  toast(nn+'화를 삭제했어요.',{l:'되돌리기',f:()=>{
    if(chs.includes(c))return;chs.splice(Math.min(i,chs.length),0,c);renum(b);base.s+=sz;db.pref('base',base);persist();db.chapter(c);open(c);
  }});
}
$('#chs').onclick=e=>{
  const a=e.target.closest('[data-a]');
  if(a){
    const c=chs.find(x=>x.id==a.closest('.chw').dataset.id);if(!c)return;
    if(a.dataset.a==='ren')chRename(c);
    else if(a.dataset.a==='up')chMove(c,-1);
    else if(a.dataset.a==='dn')chMove(c,1);
    else if(chDq===c.id){clearTimeout(chDt);chDel(c)}
    else{chDq=c.id;clearTimeout(chDt);chDt=setTimeout(()=>{chDq=null;list(true)},3000);list(true);chFocus(c.id,'del')}
    return;
  }
  const b=e.target.closest('.ch');if(!b)return;const c=chs.find(c=>c.id==b.dataset.id);
  if(e.detail===2){chRename(c);return}/* 더블클릭: 첫 클릭이 목록을 다시 그리므로 dblclick 대신 click 횟수로 판단 */
  open(c);setMenu(false);
};
$('#chs').addEventListener('keydown',e=>{
  if(!e.target.classList.contains('rn'))return;
  if(e.isComposing)return;
  if(e.key==='Enter'){e.preventDefault();chEndRn(true)}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();chEndRn(false)}
});
$('#chs').addEventListener('focusout',e=>{if(e.target.classList.contains('rn'))chEndRn(true)});
$('#chm').onclick=()=>{const on=$('#chm').getAttribute('aria-pressed')!=='true';$('#chm').setAttribute('aria-pressed',on);$('#chs').classList.toggle('mg',on)};
$('#add').onclick=()=>{save();const c={id:Date.now(),n:Math.max(...chs.map(x=>x.n))+1,t:'',c:'',_sig:'\0'};chs.push(c);persist();open(c);setMenu(false);ti.focus()};
$('#cm').onclick=()=>{strict=!strict;stats();list(true);selc();toast(strict?'공백 제외로 셉니다.':'공백 포함으로 셉니다.')};
function setSize(i,keep=true){size=Math.max(0,Math.min(SIZES.length-1,i));document.documentElement.style.setProperty('--fs',SIZES[size]+'rem');if(keep)db.pref('size',size)}
$('#fm').onclick=()=>setSize(size-1);$('#fp').onclick=()=>setSize(size+1);setSize(size,false);
function focusMode(on){app.classList.toggle('focus',on);$('#fc').setAttribute('aria-pressed',on);if(on){ed.focus();mark()}else ed.querySelectorAll('.on').forEach(x=>x.classList.remove('on'))}
$('#fc').onclick=()=>focusMode(!app.classList.contains('focus'));

function men(){
  const t=cur?cur.c:'',all=[['world',LORE.world],['codex',LORE.codex]].flatMap(([k,l])=>l.items.map(x=>[k,x]));
  const h=all.filter(([k,x])=>x.t.trim()&&t.includes(x.t.trim())).map(([k,x])=>`<button class="mn" type="button" data-k="${k}" data-id="${x.id}">${esc(x.t)}<small>${esc(x.c)}</small></button>`).join('');
  const m=$('#men');if(m.dataset.h!==h){m.dataset.h=h;m.innerHTML=h}
}
$('#men').onclick=e=>{const b=e.target.closest('.mn');if(!b)return;view(b.dataset.k);openLore(L().items.find(x=>x.id==b.dataset.id))};

/* 선택 영역 글자 수 */
function selc(){
  const s=getSelection(),e=$('#sel');let n=0;
  if(s.rangeCount&&!s.isCollapsed&&ed.contains(s.anchorNode)&&ed.contains(s.focusNode))n=len(s.toString());
  e.hidden=!n;if(n)e.textContent='선택 '+fmt(n)+'자';
}

/* @ 설정 자동완성 */
let atmI=0,atmL=[],atmQ=null,atmX=null;
const atmBox=$('#atm');
function atmCtx(){
  const s=getSelection();if(!s.rangeCount||!s.isCollapsed)return null;
  const nd=s.anchorNode;if(!nd||nd.nodeType!==3||!ed.contains(nd))return null;
  const o=s.anchorOffset,m=/(^|[\s(\[“‘—])@([^\s@]{0,20})$/.exec(nd.data.slice(0,o));
  return m?{nd,o,q:m[2],s:o-m[2].length-1}:null;
}
function atmClose(){if(atmBox.hidden)return;atmBox.hidden=true;atmQ=null;ed.removeAttribute('aria-activedescendant')}
function atmPaint(){
  [...atmBox.children].forEach((x,i)=>{x.setAttribute('aria-selected',i===atmI);if(i===atmI){ed.setAttribute('aria-activedescendant',x.id);x.scrollIntoView({block:'nearest'})}});
}
function atm(){
  const c=document.activeElement===ed?atmCtx():null;
  if(!c){atmX=null;atmClose();return}
  if(atmX&&atmX.nd===c.nd&&atmX.s===c.s){atmClose();return}
  const q=c.q.toLowerCase();
  atmL=[['world',LORE.world],['codex',LORE.codex]].flatMap(([k,l])=>l.items.map(x=>({x,k,n:l.name})))
    .filter(o=>o.x.t.trim()&&o.x.t.toLowerCase().includes(q)).slice(0,8);
  if(!atmL.length){atmClose();return}
  if(c.q!==atmQ){atmQ=c.q;atmI=0}
  atmI=Math.min(atmI,atmL.length-1);
  atmBox.innerHTML=atmL.map((o,i)=>`<div class="atmo" role="option" id="atmo${i}" data-i="${i}">${esc(o.x.t.trim())}<small>${esc(o.n)} · ${esc(o.x.c)}</small></div>`).join('');
  atmBox.hidden=false;atmPaint();
  const r=getSelection().getRangeAt(0).cloneRange();let b=r.getClientRects()[0]||r.getBoundingClientRect();
  if(!b||(!b.top&&!b.bottom))b=c.nd.parentElement.getBoundingClientRect();
  const w=atmBox.offsetWidth,h=atmBox.offsetHeight;
  let top=b.bottom+6;if(top+h>innerHeight-8)top=Math.max(8,b.top-h-6);
  atmBox.style.left=Math.max(8,Math.min(b.left,innerWidth-w-8))+'px';atmBox.style.top=top+'px';
}
function atmPick(i){
  const c=atmCtx(),o=atmL[i];if(!c||!o)return;
  getSelection().setBaseAndExtent(c.nd,c.s,c.nd,c.o);
  document.execCommand('insertText',false,o.x.t.trim());atmX=null;atmClose();
}
ed.addEventListener('keydown',e=>{
  if(atmBox.hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();atmX=atmCtx();atmClose();return}
  if(e.isComposing||e.keyCode===229)return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();atmI=(atmI+(e.key==='ArrowDown'?1:-1)+atmL.length)%atmL.length;atmPaint()}
  else if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();atmPick(atmI)}
});
atmBox.addEventListener('mousedown',e=>e.preventDefault());
atmBox.addEventListener('click',e=>{const o=e.target.closest('.atmo');if(o)atmPick(+o.dataset.i)});
ed.addEventListener('input',atm);
ed.addEventListener('blur',()=>{atmX=null;atmClose()});
addEventListener('scroll',()=>{if(!atmBox.hidden)atm()},{passive:true});
document.addEventListener('selectionchange',()=>{selc();atm()});

/* 글꼴 · 줄간격 */
const FONTS=[['명조','"Noto Serif KR",serif'],['바탕','"Gowun Batang","Noto Serif KR",serif'],['고딕','"Noto Sans KR",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif'],['시스템','Pretendard,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif']];
const LHS=[['촘촘',1.75],['보통',2.05],['넓게',2.35],['아주 넓게',2.7]];
let fnt=0,lhi=1; /* 저장된 값은 로그인 후 main.js 의 hydrate 가 채워요 */
function paintFmt(){
  const r=document.documentElement.style;r.setProperty('--ff',FONTS[fnt][1]);r.setProperty('--lh',LHS[lhi][1]);
  $('#ffo').innerHTML=FONTS.map((f,i)=>`<button type="button" data-i="${i}" aria-pressed="${i===fnt}" style="font-family:${f[1].replace(/"/g,'&quot;')}">${f[0]}</button>`).join('');
  $('#flo').innerHTML=LHS.map((f,i)=>`<button type="button" data-i="${i}" aria-pressed="${i===lhi}">${f[0]}</button>`).join('');
  $('#frs').disabled=fnt===0&&lhi===1;
}
function fontPanel(on){if(on)memoPanel(false);$('#fpn').hidden=!on;$('#fo').setAttribute('aria-expanded',on)}
$('#fo').onclick=()=>fontPanel($('#fpn').hidden);
$('#ffo').onclick=e=>{const b=e.target.closest('button');if(!b)return;fnt=+b.dataset.i;db.pref('font',fnt);paintFmt();$('#ffo').children[fnt].focus()};
$('#flo').onclick=e=>{const b=e.target.closest('button');if(!b)return;lhi=+b.dataset.i;db.pref('lh',lhi);paintFmt();$('#flo').children[lhi].focus()};
$('#frs').onclick=()=>{fnt=0;lhi=1;db.pref('font',0);db.pref('lh',1);paintFmt();$('#fo').focus()};
document.addEventListener('click',e=>{const p=e.composedPath();if(!$('#fpn').hidden&&!p.includes($('#fpn'))&&!p.includes($('#fo')))fontPanel(false)});
paintFmt();

/* 설정 이름 표시 · 표기 점검 · 반복 표현 점검 */
let hits=[],sph=[],spN=0,SPI=new Set(),scT,repN=0,patKey='',pats=[];
const scanSoon=()=>{clearTimeout(scT);scT=setTimeout(scan,220)};
const hlSet=(k,rs)=>{if(!(window.CSS&&CSS.highlights))return;rs.length?CSS.highlights.set(k,new Highlight(...rs)):CSS.highlights.delete(k)};
const rg=(nd,s,e)=>{const r=new Range();r.setStart(nd,s);r.setEnd(nd,e);return r};
const canon=t=>t.trim().replace(/\s+/g,' ');
const STOP=new Set(['그녀','그가','그는','그것','이것','저것','하지','하고','있는','있던','없는','없던','같은','같이','그리고','하지만','그러나','그때','다시','이미','아직','모든','어떤','무슨','자신','사람','순간','느낌']);
const JOSA=/(으로서|으로써|에서는|에게서|에서|에게|으로|까지|부터|처럼|보다|이라|라고|하게|하고|이|가|은|는|을|를|의|에|도|만|와|과|로|고|며|던|인|한)$/;
function scan(){
  const lore=OPT.hl?[['world',LORE.world],['codex',LORE.codex]].flatMap(([k,l])=>l.items.map(x=>({k,x,n:l.name,c:canon(x.t)}))).filter(o=>o.c.replace(/ /g,'').length>=2).sort((a,b)=>b.c.length-a.c.length):[];
  const key=lore.map(o=>o.k+o.x.id+':'+o.c).join('|');   /* 설정 제목이 그대로면 정규식을 다시 만들지 않아요 */
  if(key!==patKey){patKey=key;pats=lore.map(o=>({o,re:new RegExp([...o.c.replace(/ /g,'')].map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s*'),'g')}))}
  const toks=[],taken=new Map();hits=[];sph=[];
  const w=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);let nd;
  while(nd=w.nextNode()){
    const tk=[];taken.set(nd,tk);
    for(const {o,re} of pats){re.lastIndex=0;let m;
      while(m=re.exec(nd.data)){const s=m.index,e=s+m[0].length;if(tk.some(([a,b])=>s<b&&e>a))continue;tk.push([s,e]);hits.push({nd,s,e,o,v:m[0]!==o.c,r:rg(nd,s,e)})}}
    if(OPT.sp)for(const m of spellFind(nd.data)){if(SPI.has(m.t)||tk.some(([a,b])=>m.s<b&&m.e>a))continue;sph.push({nd,s:m.s,e:m.e,sp:1,m,r:rg(nd,m.s,m.e)})}
    if(OPT.rep){const re=/[가-힣A-Za-z0-9]+/g;let m;
      while(m=re.exec(nd.data)){const s=m.index,e=s+m[0].length;if(tk.some(([a,b])=>s<b&&e>a))continue;toks.push({nd,s,e,t:m[0]})}}
  }
  hlSet('lore',hits.filter(h=>!h.v).map(h=>h.r));hlSet('lov',hits.filter(h=>h.v).map(h=>h.r));spN=sph.length;hlSet('sp',sph.map(h=>h.r));
  const marks=[];
  if(OPT.rep){
    const by=new Map();
    toks.forEach((k,i)=>{const st=k.t.replace(JOSA,'');if(st.length<2||STOP.has(st)||/^\d+$/.test(st))return;(by.get(st)||by.set(st,[]).get(st)).push(i)});
    const mk=new Set();
    by.forEach(p=>{for(let k=0;k+2<p.length;k++)if(p[k+2]-p[k]<=30)[p[k],p[k+1],p[k+2]].forEach(i=>mk.add(i))});
    mk.forEach(i=>{const k=toks[i],st=k.t.replace(JOSA,'');marks.push(rg(k.nd,k.s,k.s+st.length))});
    const fin=toks.filter(k=>k.t.length>=2&&k.t.endsWith('다')&&/^(?:[.?!…”’"']|$)/.test(k.nd.data.slice(k.e)));
    for(let i=0;i<fin.length;){let j=i;const key=fin[i].t.slice(-2);while(j<fin.length&&fin[j].t.slice(-2)===key)j++;
      if(j-i>=3)for(let k=i;k<j;k++)marks.push(rg(fin[k].nd,fin[k].e-2,fin[k].e));i=j}
  }
  repN=marks.length;hlSet('rep',marks);paintOpt();
}

/* 이름 위에 마우스를 올리면 설정 요약 */
const tip=$('#lt');let ltH=null,ltT,ltRaf=0;
function ltHide(){clearTimeout(ltT);tip.hidden=true;ltH=null}
const ltLater=()=>{clearTimeout(ltT);ltT=setTimeout(ltHide,260)};
function hitAt(x,y){
  for(const h of hits.concat(sph))for(const q of h.r.getClientRects())if(x>=q.left-1&&x<=q.right+1&&y>=q.top-5&&y<=q.bottom+5)return h;
  return null;
}
function ltShow(h){
  clearTimeout(ltT);if(ltH&&ltH.r===h.r&&!tip.hidden)return;ltH=h;
  if(h.sp)tip.innerHTML=`<small>맞춤법</small><b>${esc(h.m.t)} → ${esc(h.m.fix)}</b><p>${esc(h.m.note)}</p><div class="ltb"><button type="button" data-a="sp" class="pri">고치기</button><button type="button" data-a="ig">이대로 두기</button></div><em>이 창을 닫기 전까지만 ‘이대로 두기’가 기억돼요</em>`;
  else{const x=h.o.x,b=(x.b||'').trim();
  tip.innerHTML=`<small>${esc(h.o.n)} · ${esc(x.c)}</small><b>${esc(h.o.c)}</b><p>${b?esc(b.length>90?b.slice(0,90)+'…':b):'아직 적어 둔 내용이 없어요.'}</p>`
    +(h.v?`<p class="warn">설정집에는 ‘${esc(h.o.c)}’로 적혀 있어요.</p>`:'')
    +`<div class="ltb"><button type="button" data-a="go">설정으로 이동</button>${h.v?'<button type="button" data-a="fix" class="pri">표기 맞추기</button>':''}</div><em>Ctrl/⌘+클릭으로도 이동해요</em>`}
  tip.hidden=false;
  const q=h.r.getClientRects()[0],wd=tip.offsetWidth,ht=tip.offsetHeight;
  let top=q.bottom+8;if(top+ht>innerHeight-8)top=Math.max(8,q.top-ht-8);
  tip.style.left=Math.max(8,Math.min(q.left,innerWidth-wd-8))+'px';tip.style.top=top+'px';
}
const loreGo=h=>{ltHide();view(h.o.k);openLore(h.o.x)};
ed.addEventListener('mousemove',e=>{
  if(!(OPT.hl||OPT.sp)||e.buttons||ltRaf)return;ltRaf=1;
  requestAnimationFrame(()=>{ltRaf=0;const h=hitAt(e.clientX,e.clientY);h?ltShow(h):ltLater()});
});
ed.addEventListener('mouseleave',ltLater);ed.addEventListener('input',ltHide);addEventListener('scroll',ltHide,{passive:true});
tip.addEventListener('mouseenter',()=>clearTimeout(ltT));tip.addEventListener('mouseleave',ltLater);
tip.addEventListener('mousedown',e=>e.preventDefault());
tip.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!ltH)return;const h=ltH;
  if(b.dataset.a==='sp'||b.dataset.a==='ig'){
    ltHide();
    if(b.dataset.a==='ig'){SPI.add(h.m.t);scan();return}
    const r=h.r;ed.focus();getSelection().setBaseAndExtent(r.startContainer,r.startOffset,r.endContainer,r.endOffset);document.execCommand('insertText',false,h.m.fix);toast('맞춤법을 고쳤어요.');return;
  }
  if(b.dataset.a==='go')loreGo(h);
  else{const r=h.r;ed.focus();getSelection().setBaseAndExtent(r.startContainer,r.startOffset,r.endContainer,r.endOffset);document.execCommand('insertText',false,h.o.c);ltHide();toast('표기를 맞췄어요.')}
});
ed.addEventListener('click',e=>{if(!(e.ctrlKey||e.metaKey)||!OPT.hl)return;const h=hitAt(e.clientX,e.clientY);if(h&&!h.sp){e.preventDefault();loreGo(h)}});

/* 글쓰기 도우미 설정 */
const TOG=[['hl','본문에서 설정 이름 표시','이름에 밑줄, 올리면 요약·띄어쓰기 불일치 표시'],['sp','맞춤법 검사','자주 틀리는 표현에 파란 물결선, 올리면 고칠 표현 제안'],['rep','반복 표현 점검','같은 단어·어미가 가까이 반복되면 연하게 표시'],['q','따옴표 자동 전환','" → “ ”   \' → ‘ ’'],['el','말줄임표 자동 변환','... → …'],['da','줄표 자동 변환','-- → —']];
$('#tgl').innerHTML=TOG.map(([k,n,d])=>`<button type="button" role="switch" data-k="${k}" aria-checked="false"><span>${n}<small id="tg-${k}">${d}</small></span><i></i></button>`).join('');
function paintOpt(){
  TOG.forEach(([k,n,d])=>{const b=$(`#tgl [data-k="${k}"]`);b.setAttribute('aria-checked',!!OPT[k]);$('#tg-'+k).textContent=k==='rep'&&OPT.rep?(repN?repN+'곳 표시 중':'반복되는 표현이 없어요'):k==='sp'&&OPT.sp?(spN?spN+'곳 확인해 보세요':'틀린 표현이 없어요'):d});
}
$('#tgl').onclick=e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k;OPT[k]=OPT[k]?0:1;db.pref('opt',{...OPT});if(k==='hl'||k==='sp')ltHide();scan()};

/* 에디터 옆 빠른 메모 */
function memoPanel(on,back){
  if(on)fontPanel(false);
  $('#mp').hidden=!on;$('#mo').setAttribute('aria-expanded',on);
  if(on)$('#mpi').focus();else if(back)ed.focus();
}
$('#mo').onclick=()=>memoPanel($('#mp').hidden);
$('#mpf').onsubmit=e=>{e.preventDefault();const i=$('#mpi'),t=i.value.trim();if(!t)return;addMemo(t);i.value=''};
$('#mpi').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();memoPanel(false,true)}});
paintOpt();
