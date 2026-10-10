const $ = s => document.querySelector(s);
/* HTML 에 글자를 넣을 때는 반드시 esc() 를 거쳐요(innerHTML·템플릿 문자열 모두). 본문 텍스트와 따옴표(" ')로 감싼 속성값 어디에 넣어도 안전해요.
   <script>·<style>·on* 속성·style 속성 안, 그리고 href·src 같은 주소 속성에는 쓸 수 없어요(이미지 주소는 imgOk 로 따로 검증해요). 글자만 바꿀 때는 esc 없이 textContent 를 써요. */
const ESC = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[<>&"']/g, c => ESC[c]);
const fmt = n => n.toLocaleString('ko-KR');
/* 글자 수는 "보이는 글자" 기준(유니코드 코드포인트)이에요. JS 길이(UTF-16)로 세면 이모지·드문 한자가 2자로 잡혀요. DB char_length 와 같은 기준이라 서버 값과도 맞아요 */
const SURR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
  cp = t => t.length - (t.match(SURR) || []).length,
  raw = t => cp(t.replace(/\n/g, '')),
  nsp = t => cp(t.replace(/\s/g, ''));
const SIZES = [1.02, 1.15, 1.3, 1.5];
/* 제목 글자 수 한도 — 서버(meari-api)·DB 제약과 같은 값이에요: 원고 60, 화·설정 이름 100 */
const TL = { work: 60, ch: 100, lore: 100 },
  BODY_MAX = 300000; /* 화 본문 글자 수 한도(서버·DB 제약과 같은 값, JS 길이 기준) */
/* 목표는 두 가지예요. 하루 목표(GOALS, 홈·집필량)와 화당 목표(CGOALS, 에디터 진행 막대·원고 카드)를 따로 저장해요 */
const CGOALS = [2000, 3000, 4000, 5000, 6000];
let ci = 1;
const GOAL = () => CGOALS[ci];
/* 화마다 상태(s: draft·revise·done)와 개별 목표(g: 0이면 원고 기본값)를 가져요 */
const STS = [
    ['draft', '초고'],
    ['revise', '퇴고'],
    ['done', '완료'],
  ],
  stName = k => (STS.find(x => x[0] === k) || STS[0])[1];
const cGoal = c => c.g || GOAL();
/* 문단 모양: 들여쓰기(em)·문단 간격(em, 마지막은 한 줄 비움)·줄 폭 / 프리셋은 [들여쓰기,간격,줄폭] 인덱스 */
const PF_IND = [
    ['없음', 0],
    ['1칸', 1],
    ['2칸', 2],
  ],
  PF_GAP = [
    ['없음', 0],
    ['좁게', 0.4],
    ['보통', 1],
    ['한 줄', -1],
  ],
  PF_W = [
    ['좁게', '34rem'],
    ['보통', '56rem'],
    ['넓게', '72rem'],
  ];
const PF_PRE = [
    ['웹소설형', [0, 3, 0]],
    ['단행본형', [1, 0, 1]],
  ],
  PF_DEF = [1, 1, 1];
let pf = PF_DEF.slice(); /* 저장된 값은 hydrate 가 채워요 */
/* 새 계정은 빈 1화 하나로 시작해요. 서버에서 내 데이터를 읽어 와 채우기 전까지 chs 는 비어 있어요(db.js → main.js hydrate) */
const SEED_CHS = [{ id: 1, n: 1, t: '', c: '', s: 'draft', g: 0 }];
const SEED_MEMOS = [];
let WORKS = [],
  wk =
    null; /* WORKS: 내 모든 원고, wk: 지금 열려 있는 원고. chs 는 항상 wk.chs 와 같은 배열이에요 */
let chs = [];
let cur = null,
  size = 1,
  strict = false,
  timer,
  tt;
const app = $('#app'),
  ed = $('#ed'),
  ti = $('#ti'),
  fi = $('#fi'),
  ri = $('#ri');
/* ── 입력 계층: 본문을 고치는 모든 동작(따옴표 변환·붙여넣기·맞춤법 고치기·설정 자동완성·장면 구분선)은 여기 IN 만 거쳐요.
   document.execCommand 는 폐기 예정이라 이 한 곳에서만 부르고, 브라우저가 막으면 Range 로 직접 고쳐 쓰는 대체 경로로 넘어가요.
   (대체 경로는 브라우저 기본 실행 취소(Ctrl+Z) 기록에 남지 않아요.) */
const IN = (() => {
  const sel = () => {
    const s = getSelection();
    return s.rangeCount && ed.contains(s.anchorNode) ? s : null;
  };
  const blockOf = n => {
    while (n && n.parentNode !== ed) n = n.parentNode;
    return n && n.nodeType === 1 ? n : null;
  };
  const fill = b => {
    if (!b.firstChild) b.appendChild(document.createElement('br'));
  };
  const caret = (n, o) => {
    const s = getSelection();
    s.setBaseAndExtent(n, o, n, o);
  };
  function wrap() {
    /* 본문이 블록 없이 맨 글자만 있으면 div 로 감싸요 */
    if (ed.firstElementChild && ![...ed.childNodes].some(n => n.nodeType === 3)) return;
    const d = document.createElement('div');
    while (ed.firstChild) d.appendChild(ed.firstChild);
    fill(d);
    ed.appendChild(d);
    caret(d, 0);
  }
  function split() {
    /* 캐럿 자리에서 문단을 둘로 나눠요(Enter) */
    let s = sel();
    if (!s) return false;
    const r = s.getRangeAt(0);
    r.deleteContents();
    wrap();
    s = sel();
    if (!s) return false;
    const r2 = s.getRangeAt(0),
      b = blockOf(r2.startContainer) || ed.firstElementChild,
      t = new Range();
    t.setStart(r2.startContainer, r2.startOffset);
    t.setEndAfter(b.lastChild || b);
    const nb = document.createElement('div');
    if (t.endContainer !== b || t.endOffset) nb.appendChild(t.extractContents());
    b.normalize();
    nb.normalize();
    b.querySelectorAll(':scope>br').forEach(x => {
      if (b.childNodes.length > 1) x.remove();
    });
    fill(b);
    fill(nb);
    b.after(nb);
    caret(nb, 0);
    return true;
  }
  function soft(s) {
    if (!sel()) return false;
    const be = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: s,
    });
    if (!ed.dispatchEvent(be)) return true; /* 한도 초과 등으로 막혔어요 */
    getSelection().getRangeAt(0).deleteContents();
    wrap();
    s.replace(/\r\n?/g, '\n')
      .split('\n')
      .forEach((line, i) => {
        if (i && !split()) return;
        if (!line) return;
        const r = getSelection().getRangeAt(0),
          t = document.createTextNode(line);
        const b = blockOf(r.startContainer);
        if (b) b.querySelectorAll(':scope>br').forEach(x => x.remove());
        r.insertNode(t);
        caret(t, t.length);
      });
    ed.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: s }));
    return true;
  }
  const exec = (c, v) => {
    try {
      return typeof document.execCommand === 'function' && document.execCommand(c, false, v);
    } catch (_) {
      return false;
    }
  };
  return {
    /* 캐럿(또는 선택 영역)에 글자를 넣어요. 줄바꿈이 들어 있으면 문단으로 나눠요 */
    text(s) {
      return exec('insertText', s) || soft(s);
    },
    /* 새 문단(Enter) */
    para() {
      if (exec('insertParagraph')) return true;
      if (!split()) return false;
      ed.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' }));
      return true;
    },
    /* 맨 글자만 있는 본문을 div 문단으로 */
    block() {
      if (exec('formatBlock', 'div')) return true;
      wrap();
      return true;
    },
    /* 범위(Range 비슷한 객체)를 골라 그 자리를 바꿔요 */
    replace(r, s) {
      ed.focus();
      getSelection().setBaseAndExtent(r.startContainer, r.startOffset, r.endContainer, r.endOffset);
      return IN.text(s);
    },
    /* 장면 구분선 */
    scene() {
      IN.para();
      IN.text('* * *');
      IN.para();
    },
  };
})();
/* 화별 글자 수 캐시: 본문 문자열이 그대로면 다시 세지 않아요(타자마다 전체 화를 훑지 않도록) */
const rawN = c => (c._rk === c.c ? c._rv : ((c._rk = c.c), (c._rv = raw(c.c))));
const lenN = c =>
  strict ? (c._sk === c.c ? c._sv : ((c._sk = c.c), (c._sv = nsp(c.c)))) : rawN(c);
/* 본문을 아직 안 받은 화(_lz): 글자 수는 서버가 센 값(_rv·_sv)이 들어 있고, 본문 앞 200자는 _h 에 있어요 */
const headOf = c => (c._lz ? c._h : c.c); /* 첫 줄 미리보기용(앞부분) */
const hasText = c =>
  c._lz ? !!(c._h.trim() || c._rv > 200) : !!c.c.trim(); /* 글이 있는 화인가(공백만이면 없음) */
const tot = () =>
  WORKS.reduce(
    (s, w) => w.chs.reduce((a, c) => a + rawN(c), s),
    0
  ); /* 오늘 쓴 양·전체 분량은 모든 원고를 합쳐요 */
let day = new Date().toLocaleDateString('sv'); /* 자정이 지나면 rollDay 가 바꿔요 */
let base = { d: day, s: 0 },
  lastEdit = 0;
const touch = () => {
  lastEdit = Date.now();
  if (wk) wk.at = lastEdit;
}; /* base: 오늘 시작 시점의 전체 글자 수, lastEdit: 마지막 수정 시각(ms) */
const gained = () => '오늘 +' + fmt(Math.max(0, tot() - base.s)) + '자';
/* 날짜별 집필량: {'2026-09-30':1234}. 오늘 +N자와 같은 값을 하루 단위로 저장 */
const dkey = x => x.toLocaleDateString('sv');
let wlog = {};
function logDay() {
  const g = Math.max(0, tot() - base.s);
  if ((wlog[day] || 0) === g) return;
  if (g) wlog[day] = g;
  else delete wlog[day];
  db.log(day);
}
/* 앱을 켜 둔 채 자정을 넘기면: 어제 기록을 확정하고, 오늘 기준점(base)을 새로 잡고, 날짜·인사말·목표 표시를 다시 그려요 */
function rollDay() {
  const n = new Date().toLocaleDateString('sv');
  if (n === day || !wk) return;
  logDay();
  day = n;
  base = { d: day, s: tot() };
  db.pref('base', base);
  paintDate();
  home();
  if (app.dataset.v === 'works') worksHome();
}
setInterval(rollDay, 30000);
function toast(t, a) {
  const e = $('#toast');
  e.textContent = t;
  e.classList.toggle('act', !!a);
  if (a) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = a.l;
    b.onclick = () => {
      e.classList.remove('on');
      a.f();
    };
    e.append(b);
  }
  e.classList.add('on');
  clearTimeout(tt);
  tt = setTimeout(() => e.classList.remove('on'), a ? 6000 : 2300);
}
const setTheme = d => {
  const r = document.documentElement;
  d ? (r.dataset.theme = 'dark') : r.removeAttribute('data-theme');
};
const settle = () => setTimeout(() => app.classList.remove('arrive'), 3400);
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(),
    mod = e.ctrlKey || e.metaKey,
    inEdit = app.dataset.v === 'edit';
  if (mod && k === 's' && inEdit) {
    e.preventDefault();
    save();
    toast('저장했어요.');
  } else if (mod && k === 'f' && inEdit) {
    e.preventDefault();
    findBar(true);
  } else if (mod && e.key === 'Enter' && document.activeElement === ed) {
    e.preventDefault();
    IN.scene();
  } else if (e.key === 'Escape') {
    if (!$('#lore').hidden && !$('#lod').hidden) closeLore();
    else if (!$('#xmn').hidden) xMenu(false);
    else if (!$('#fpn').hidden) fontPanel(false);
    else if (!$('#mp').hidden) memoPanel(false, true);
    else if (!$('#spp').hidden) spPanel(false, true);
    else if (!$('#fb').hidden) findBar(false);
    else if (app.classList.contains('focus')) focusMode(false);
  }
});
/* 창을 닫거나 탭을 숨길 때 마지막 입력을 서버로 밀어 넣고, 아직 못 보낸 게 있으면 경고 */
addEventListener('beforeunload', e => {
  save();
  if (db.pending() || db.problem() || (cur && (cur._over || cur._cf))) {
    e.preventDefault();
    e.returnValue = '';
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else rollDay();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-t]');
  if (b) toast(b.dataset.t);
});
