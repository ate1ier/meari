/* 서버에서 읽어 온 내 데이터를 화면 상태에 채워 넣어요 */
function hydrate(d) {
  WORKS = d.works;
  le = null;
  const p = d.prefs;
  loadCats(p, d.works);
  const pick = (v, n, def) => (Number.isInteger(v) && v >= 0 && v < n ? v : def);
  wk = WORKS.find(w => w.id === p.cur) || WORKS.reduce((a, b) => (b.at > a.at ? b : a));
  chs = wk.chs;
  cur = null;
  WORKS.forEach(w => {
    if (w.chs.some((c, i) => c.n !== i + 1)) {
      w.chs.forEach((c, i) => (c.n = i + 1));
      db.chapters(w);
    }
  }); /* 화 번호는 원고마다 1, 2, 3… */
  memos = d.memos;
  wlog = d.wlog;
  lastEdit = d.lastEdit;
  Object.assign(OPT, OPT_DEF, p.opt || {});
  SPI = new Set(
    (Array.isArray(p.ign) ? p.ign : [])
      .filter(x => typeof x === 'string' && x && x.length <= 20)
      .slice(-SP_MAX)
  );
  size = pick(p.size, SIZES.length, 1);
  fnt = pick(p.font, FONTS.length, 0);
  lhi = pick(p.lh, LHS.length, 1);
  gi = pick(p.goal, GOALS.length, 1);
  ci = pick(p.cgoal, CGOALS.length, 1);
  pf = Array.isArray(p.pf)
    ? [
        pick(p.pf[0], PF_IND.length, PF_DEF[0]),
        pick(p.pf[1], PF_GAP.length, PF_DEF[1]),
        pick(p.pf[2], PF_W.length, PF_DEF[2]),
      ]
    : PF_DEF.slice();
  LONGI = pick(p.lg, LONGS.length, 1);
  HAB = (Array.isArray(p.habs) ? p.habs : [])
    .filter(x => typeof x === 'string' && x.trim() && x.length <= 20)
    .slice(0, HAB_MAX);
  base = p.base && p.base.d === day ? p.base : null;
  if (!base) {
    base = { d: day, s: tot() };
    db.pref('base', base);
  }
  paintWorks();
  list(true);
  counts();
  notes();
  paintFmt();
  setSize(size, false);
  paintOpt();
  paintGoals();
  home();
  bakCheck();
  /* 로그인 직후 바로 쓰이는 본문만 먼저 받아 둬요: 홈의 이어 쓰기 카드가 보여 줄 화 · 편집 화면이 맨 먼저 열 마지막 화. 나머지는 열 때 받아요 */
  const w0 = wk,
    first = [chs[chs.length - 1], chs.slice().reverse().find(hasText)].filter(
      (c, i, a) => c && a.indexOf(c) === i
    );
  db.bodies(first)
    .then(() => {
      if (wk === w0) home();
    })
    .catch(() => {});
}
/* 같은 브라우저의 다른 탭이 저장한 화: 내가 고치던 중이 아니면 바로 받아 오고, 고치던 중이면 저장할 때 충돌로 물어봐요 */
db.onSync(m => {
  if (!m || !uname || m.u !== uname || typeof m.c !== 'string' || typeof m.t !== 'string' || !m.at)
    return;
  const c = WORKS.flatMap(w => w.chs).find(x => x.id === m.id);
  if (!c || c._v === m.at) return;
  if (!c._lz) {
    /* 본문을 아직 안 받은 화는 고치던 글이 없으니 받은 글로 바로 채워요 */
    const live = c === cur ? ti.value.trim() + '\0' + text() : c.t + '\0' + c.c;
    if (c._cf || live !== c._sig || (c === cur && db.pending())) {
      if (c === cur && Date.now() - (c._sw || 0) > 20000) {
        c._sw = Date.now();
        toast('다른 탭에서 이 화를 고쳤어요. 저장할 때 어느 쪽을 남길지 물어볼게요.');
      }
      return;
    }
  }
  c.t = m.t;
  c.c = m.c;
  c._sig = m.t + '\0' + m.c;
  c._v = m.at;
  c._lz = false;
  c._rk = null;
  c._sk = null;
  if (c === cur) {
    cur = null;
    const y = scrollY;
    openCh(c);
    scrollTo(0, y);
  } else {
    list(true);
    counts();
  }
});
/* 저장하지 못해 이 브라우저에 남겨 둔 글이 있으면 알려요(받으면 지워요) */
async function bakCheck() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('meari-bak:')) keys.push(k);
    }
    for (const k of keys) {
      const c = WORKS.flatMap(w => w.chs).find(x => x.id === +k.slice(10));
      if (!c) continue;
      const b = JSON.parse(localStorage.getItem(k));
      if (!b || typeof b.c !== 'string') continue;
      if (c._lz) {
        try {
          await db.bodies([c]);
        } catch (e) {
          continue;
        }
      } /* 서버에 저장된 글과 견주려면 본문이 있어야 해요 */
      if (b.c === c.c) {
        localStorage.removeItem(k);
        continue;
      }
      toast(c.n + '화의 저장하지 못한 글이 이 브라우저에 남아 있어요.', {
        l: '내려받기',
        f: () => chDownload({ id: c.id, n: c.n, t: b.t || c.t, c: b.c }),
      });
      return;
    }
  } catch (e) {}
}
/* 로그아웃 후 다른 계정이 들어와도 이전 데이터가 보이지 않도록 비워요 */
function resetState() {
  clearTimeout(timer);
  cur = null;
  opening = null;
  edBusy(false);
  le = null;
  chs = [];
  WORKS = [];
  wk = null;
  uname = '';
  SPI = new Set();
  memos = [];
  wlog = {};
  lastEdit = 0;
  base = { d: day, s: 0 };
  CATS = {};
  cmShow(false);
  ed.innerHTML = '';
  ti.value = '';
  fi.value = '';
  EL.chs.innerHTML = '';
  listHtml = '';
  $('#fb').hidden = true;
  spPanel(false);
  Object.assign(OPT, OPT_DEF);
  size = 1;
  fnt = 0;
  lhi = 1;
  gi = 1;
  ci = 1;
  pf = PF_DEF.slice();
  LONGI = 1;
  HAB = [];
  wdq = null;
  $('#rcl').innerHTML = '';
  counts();
  notes();
  paintFmt();
  paintOpt();
  paintGoals();
  db.reset();
  svPaint();
}
/* 저장 상태 표시(편집 화면 위 · 설정 상세 아래) */
/* 저장이 계속 안 될 때(연속 2번 실패하거나 오프라인): 화면 위에 알림줄을 띄우고 다음 재시도까지 남은 시간을 보여 줘요. 저장되면 사라져요 */
const sv = $('#svbar'),
  svm = $('#svm'),
  svc = $('#svc');
let svT = null;
function svPaint() {
  const s = db.state();
  if (!(s.fails >= 2 || s.offline)) {
    sv.hidden = true;
    clearInterval(svT);
    svT = null;
    return;
  }
  const sec = s.next ? Math.max(0, Math.ceil((s.next - Date.now()) / 1000)) : 0;
  sv.hidden = false;
  svm.textContent = s.offline
    ? '오프라인이에요. 연결되면 바로 저장해요.'
    : '서버에 저장하지 못하고 있어요.';
  svc.textContent = s.offline
    ? ''
    : s.next
      ? (sec ? sec + '초 뒤 다시 시도' : '다시 시도하는 중') + ' · ' + s.fails + '번째 실패'
      : '';
  $('#svd').hidden = !cur;
  if (!svT) svT = setInterval(svPaint, 1000);
}
$('#svr').onclick = () => db.retryNow();
$('#svd').onclick = () => {
  if (cur) chDownload({ id: cur.id, n: cur.n, t: ti.value.trim(), c: text() });
};
db.on(s => {
  svPaint();
  if (s === 'expired') return;
  const st = db.state(),
    pb = db.problem(),
    t =
      pb === 'conflict'
        ? '저장 안 됨 · 다른 곳에서 바뀐 글이 있어요'
        : pb
          ? '저장 안 됨 · 저장하지 못한 내용이 있어요'
          : st.offline
            ? '저장 대기 중 · 오프라인이에요'
            : st.fails >= 2
              ? '저장 안 됨 · 다시 시도하고 있어요'
              : s === 'saving'
                ? '저장 중…'
                : '저장됨';
  $('#st').textContent = (cur && stMsg()) || t;
  $('#lost').textContent = t;
  if (s === 'error')
    toast(
      '서버에 저장하지 못하고 있어요. 연결되면 자동으로 다시 시도할게요.'
    ); /* 연속 3번째 실패에서 한 번만 */
});
(async () => {
  const resume = document.documentElement.classList;
  const unhide = setTimeout(
    () => resume.remove('resume'),
    8000
  ); /* 서버 응답이 느려도 로그인 화면은 보이게 */
  try {
    if (authStore.getItem('meari-token')) {
      const d = await db.load();
      hydrate(d);
      setTheme(true);
      setUser(d.user.username);
      gate.hidden = true;
      $('#lg').classList.remove('intro');
      app.inert = false;
      app.classList.add('arrive');
      settle();
      return;
    }
  } catch (e) {
    console.error('[meari] 자동 로그인 실패', e);
    resetState();
    if (e && e.status === 401) {
      authStore.removeItem('meari-token');
      authStore.removeItem('meari-user');
    }
  } finally {
    clearTimeout(unhide);
    resume.remove('resume');
  }
  authStore.removeItem('meari-user');
  setTheme(false);
  login.intro();
})();
