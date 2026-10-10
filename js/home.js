const PANE = {
  home: 'home',
  works: 'works',
  all: 'wall',
  edit: 'edit',
  world: 'lore',
  codex: 'lore',
};
/* 원고 구역(원고·세계관·설정집)은 위쪽 탭으로 옮겨요. 사이드바는 홈 · 내 원고 · 화 목록만 맡아요 */
const NAV = { nh: 'home', ne: 'works' },
  WORK_V = ['edit', 'world', 'codex'];
const TABS = { tbe: 'edit', tbw: 'world', tbc: 'codex' };
/* 사이드바 접기: 에디터에 들어가면 기본으로 접고, 탭 왼쪽 버튼으로 다시 펼쳐요 */
function sideCollapse(on) {
  app.classList.toggle('sbc', on);
  const b = $('#sbt');
  b.setAttribute('aria-expanded', !on);
  b.setAttribute('aria-label', on ? '사이드바 펼치기' : '사이드바 접기');
}
const sideToggle = () => sideCollapse(!app.classList.contains('sbc'));
/* 지금 어디인지: 원고 탭에 보여 줘요 */
function paintWhere() {
  const v = app.dataset.v;
  if (wk) $('#wtt').textContent = wk.t;
  Object.entries(TABS).forEach(([id, k]) =>
    $('#' + id).setAttribute('aria-current', k === v ? 'page' : 'false')
  );
  const t = $('#tbe');
  t.firstChild.textContent = v === 'edit' && cur ? '원고 · ' + cur.n + '화' : '원고';
}
function view(v) {
  const pv = app.dataset.v;
  if (v !== 'edit' && cur) {
    clearTimeout(timer);
    save();
    if (app.classList.contains('focus')) focusMode(false);
  }
  if (le && PANE[v] !== 'lore') closeLore();
  app.dataset.v = v;
  if (!WORK_V.includes(v)) sideCollapse(false);
  else if (v === 'edit' && !WORK_V.includes(pv))
    sideCollapse(true); /* 에디터에 새로 들어가면 접힌 채로, 홈·원고 목록으로 나오면 다시 펼쳐요 */
  $('#wtab').hidden = !WORK_V.includes(v);
  fontPanel(false);
  spPanel(false);
  ltHide();
  ['home', 'works', 'wall', 'edit', 'lore'].forEach(p => ($('#' + p).hidden = p !== PANE[v]));
  Object.entries(NAV).forEach(([id, k]) =>
    $('#' + id).setAttribute(
      'aria-current',
      v === k || (k === 'works' && (v === 'all' || WORK_V.includes(v))) ? 'page' : 'false'
    )
  ); /* 원고를 열어 둔 동안에도 '내 원고'가 켜져 있어요 */
  paintWhere();
  if (v === 'edit' && !cur) openCh(chs[chs.length - 1]);
  if (v === 'edit') scan();
  if (v === 'home') home();
  if (v === 'works') worksHome();
  if (v === 'all') worksAll();
  if (v === 'world' || v === 'codex') lore(v);
  scrollTo(0, 0);
}
function home() {
  if (!chs.length) return;
  const last = chs[chs.length - 1],
    src = chs.slice().reverse().find(hasText) || last; /* src: 글이 있는 가장 뒤쪽 화 */
  if (src._lz) {
    /* 이어 쓰기 카드는 그 화의 마지막 문단이 필요해서 이 화 하나만 받아요(로그인 직후에 미리 받아 두지만 못 받았을 때를 위해) */
    const w = wk;
    db.bodies([src])
      .then(() => {
        if (wk === w && chs.includes(src)) home();
      })
      .catch(() => {
        if (wk === w && chs.includes(src) && src._lz)
          $('#ex').textContent = '불러오지 못했어요 · 이어 쓰기를 누르면 다시 시도해요';
      });
  }
  const paras = src._lz ? [] : src.c.split('\n').filter(x => x.trim());
  const none = !chs.some(hasText),
    wrote = hasText(last); /* none: 이 원고에 쓴 글이 아직 하나도 없음(새 계정의 첫 화면) */
  const g = none
    ? '새 원고 · 첫 화'
    : wk.at
      ? (when(wk.at) === '오늘' ? '오늘' : when(wk.at) === '어제' ? '어제' : when(wk.at) + '에') +
        ' 멈춘 곳'
      : '멈춘 곳';
  $('#cs').textContent = g;
  $('#ex').textContent = none
    ? '아직 쓴 글이 없어요. 첫 문장을 남기면 여기에 이어서 나와요.'
    : src._lz
      ? '불러오는 중…'
      : paras[paras.length - 1] || '아직 쓴 글이 없어요.';
  $('#gt').firstChild.textContent = none
    ? '첫 화 쓰기'
    : last.n + (wrote ? '화 이어 쓰기' : '화 쓰기');
  $('#tod').textContent = gained();
  goal();
}
$('#nh').onclick = () => view('home');
$('#ne').onclick = () => view('works');
Object.entries(TABS).forEach(([id, k]) => ($('#' + id).onclick = () => view(k)));
$('#wcr').onclick = () => view('works');
$('#sbt').onclick = sideToggle;
new ResizeObserver(() =>
  document.documentElement.style.setProperty('--wh', $('#wtab').offsetHeight + 'px')
).observe($('#wtab')); /* 탭 줄 높이만큼 에디터 도구 줄을 아래로 붙여요 */
$('#resume').onclick = () => view('edit');
$('#grec').onclick = () => {
  view('works');
  requestAnimationFrame(() =>
    $('#rec').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' })
  );
}; /* 집필 기록은 내 원고 아래에 있어서 바로 그 자리로 가요 */
let uname = '';
function paintDate() {
  /* 날짜·인사말: 로그인할 때와 날짜가 바뀔 때 다시 그려요 */
  const d = new Date(),
    h = d.getHours();
  $('#dt').textContent = d.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  if (uname)
    $('#gr').textContent =
      (h < 5
        ? '늦은 밤이에요'
        : h < 11
          ? '좋은 아침이에요'
          : h < 17
            ? '좋은 오후예요'
            : '좋은 저녁이에요') +
      ', ' +
      uname +
      '.';
}
const setUser = u => {
  uname = u;
  $('#me').textContent = u;
  paintDate();
};
paintDate();
let memos = []; /* {id,t,at} — 서버에서 읽어 온 메모는 hydrate 가 채워요 */
const memoLi = (m, i) =>
  `<li><span>${esc(m.t)}</span><small>${ago(m.at)}</small><button type="button" data-i="${i}" aria-label="메모 삭제"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`;
function notes() {
  const none = '<li class="none">아직 메모가 없어요. 떠오른 생각을 바로 적어 두세요.</li>';
  $('#notes').innerHTML = memos.length ? memos.slice(0, 3).map(memoLi).join('') : none;
  $('#mpl').innerHTML = memos.length ? memos.map(memoLi).join('') : none;
}
const addMemo = t => {
  const m = { id: Date.now(), t, at: Date.now() };
  memos.unshift(m);
  db.memoAdd(m);
  while (memos.length > 30) db.memoDel(memos.pop().id);
  notes();
};
const memoClick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  const [m] = memos.splice(+b.dataset.i, 1);
  if (m) db.memoDel(m.id);
  notes();
};
$('#mf').onsubmit = e => {
  e.preventDefault();
  const i = $('#mi'),
    t = i.value.trim();
  if (!t) return;
  addMemo(t);
  i.value = '';
};
$('#notes').onclick = $('#mpl').onclick = memoClick;

const GOALS = [1000, 2000, 3000, 5000],
  calm = matchMedia('(prefers-reduced-motion:reduce)').matches;
let gi = 1;
function countUp(el, to) {
  const f = +el.dataset.v || 0,
    dl = app.classList.contains('arrive') && !f ? 1500 : 0;
  el.dataset.v = to;
  el.textContent = fmt(f);
  if (f === to || calm) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now() + dl;
  (function s(t) {
    const k = Math.min(1, Math.max(0, (t - t0) / 900));
    el.textContent = fmt(Math.round(f + (to - f) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(s);
  })(t0);
}
function goal() {
  const g = Math.max(0, tot() - base.s),
    tg = GOALS[gi],
    pc = Math.min(100, (g / tg) * 100);
  countUp($('#gnum'), g);
  countUp($('#gst'), streak());
  countUp($('#gtt'), tot());
  $('#gtg').textContent = '/ ' + fmt(tg) + '자';
  $('#goal').classList.toggle('hit', g >= tg);
  $('#gpc').textContent = Math.floor(pc) + '%' + (g >= tg ? ' · 오늘 목표를 채웠어요' : '');
  $('#gbar').setAttribute('aria-valuenow', Math.floor(pc));
  setTimeout(
    () => ($('#goal .gbar i').style.width = pc + '%'),
    app.classList.contains('arrive') ? 1500 : 30
  );
  dots();
}
/* 최근 2주를 작은 칸으로: 색이 짙을수록 하루 목표에 가까워요(집필 기록의 달력과 같은 농도) */
function dots() {
  const t = new Date(),
    n = 14;
  let h = '';
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i),
      v = wlog[dkey(x)] || 0,
      l = `${mdk(x)} · ${fmt(v)}자`;
    h += `<li class="c l${hl(v)}${i === 0 ? ' now' : ''}" title="${l}"><span class="sr">${l}</span></li>`;
  }
  $('#gdots').innerHTML = h;
}
/* 하루 목표·화당 목표: 홈 버튼과 에디터 패널(Aa)이 같은 함수를 써요 */
function paintGoals() {
  $('#cgo').innerHTML = CGOALS.map(
    (n, i) => `<button type="button" data-i="${i}" aria-pressed="${i === ci}">${fmt(n)}자</button>`
  ).join('');
  $('#dgo').innerHTML = GOALS.map(
    (n, i) => `<button type="button" data-i="${i}" aria-pressed="${i === gi}">${fmt(n)}자</button>`
  ).join('');
}
function setDaily(i, quiet) {
  gi = i;
  db.pref('goal', gi);
  goal();
  paintGoals();
  if (!quiet) toast('하루 목표를 ' + fmt(GOALS[gi]) + '자로 바꿨어요.');
}
function setChGoal(i) {
  ci = i;
  db.pref('cgoal', ci);
  paintGoals();
  if (cur) {
    paintCmeta();
    stats();
  }
  paintWorks();
  repaintCards();
  toast('한 화 목표를 ' + fmt(CGOALS[ci]) + '자로 바꿨어요.');
}
$('#gbtn').onclick = () => setDaily((gi + 1) % GOALS.length);
$('#cgo').onclick = e => {
  const b = e.target.closest('button');
  if (b) setChGoal(+b.dataset.i);
};
$('#dgo').onclick = e => {
  const b = e.target.closest('button');
  if (b) setDaily(+b.dataset.i);
};
paintGoals();
