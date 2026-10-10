const OPT_DEF = {
    hl: 1,
    sp: 1,
    rep: 0,
    q: 1,
    el: 1,
    da: 0,
    tw: 0,
    ratio: 0,
    rd: 0,
    long: 0,
    hab: 1,
  },
  OPT = { ...OPT_DEF };
/* 본문 읽기: innerText(레이아웃 강제)와 문단 전체 재계산 대신, 문단(ed 의 직속 자식)별로 글·글자 수를 캐시해 두고 바뀐 문단만 다시 읽어요.
   바뀐 문단은 MutationObserver 가 알려 줘요(속성 변화는 보지 않아서 .on · .sb 클래스 토글은 캐시를 깨지 않아요). ed 는 white-space:pre-wrap 이라 textContent 와 innerText 결과가 같아요 */
const lineC = new WeakMap(),
  SB = /^\s*(\*\s*){3}$/;
const lineTop = n => {
  while (n && n.parentNode !== ed) n = n.parentNode;
  return n;
};
function lineDrop(rs) {
  for (const r of rs) {
    if (r.target === ed) continue;
    const n = lineTop(r.target);
    if (n) lineC.delete(n);
  }
}
const lineMo = new MutationObserver(lineDrop);
lineMo.observe(ed, { childList: true, characterData: true, subtree: true });
function lineOf(el) {
  let o = lineC.get(el);
  if (o) return o;
  let t = el.nodeType === 3 ? el.data : el.textContent;
  if (t && el.nodeType === 1 && el.querySelector('br'))
    t = el.innerText; /* 문단 안 줄바꿈(<br>)이 있는 드문 경우만 예전처럼 innerText */
  o = { t, r: raw(t), s: nsp(t) };
  if (el.nodeType === 1)
    el.classList.toggle(
      'sb',
      t.length < 24 && SB.test(t)
    ); /* 장면 구분선(* * *) 표시는 바뀐 문단만 다시 판단해요 */
  lineC.set(el, o);
  return o;
}
function body() {
  /* → {t: 본문 전체, r: 줄바꿈 뺀 글자 수, s: 공백 뺀 글자 수} */
  lineDrop(lineMo.takeRecords());
  const ls = [];
  let r = 0,
    s = 0;
  for (const el of ed.childNodes) {
    if (el.nodeType !== 1 && el.nodeType !== 3) continue;
    const o = lineOf(el);
    ls.push(o.t);
    r += o.r;
    s += o.s;
  }
  return { t: ls.join('\n'), r, s };
}
const text = () => body().t,
  len = t => (strict ? nsp(t) : raw(t));
let chRn = null,
  chDq = null,
  chDt,
  listHtml = '';
const EL = {
  cnt: $('#cnt'),
  mae: $('#mae'),
  td: $('#td'),
  gl: $('#gl'),
  glr: $('#glr'),
  edit: $('#edit'),
  page: $('#page'),
  st: $('#st'),
  chs: $('#chs'),
}; /* 타자마다 쓰는 요소는 한 번만 찾아 둬요 */
const CI = {
  ren: 'M4 20h4l10-10-4-4L4 16zM13 7l4 4',
  up: 'M6 15l6-6 6 6',
  dn: 'M6 9l6 6 6-6',
  del: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
};
const chBtn = (a, l, d) =>
  `<button type="button" data-a="${a}" aria-label="${l}" title="${l}"${d ? ' disabled' : ''}><svg viewBox="0 0 24 24"><path d="${CI[a]}"/></svg></button>`;
/* ── 저장하지 못한 글 보호: 길이 한도 · 충돌 · 거절 ── */
const stMsg = () =>
  cur && cur._over
    ? '저장 안 됨 · 한 화 한도(30만 자) 초과'
    : cur && cur._cf
      ? '저장 안 됨 · 충돌을 해결해 주세요'
      : db.problem()
        ? '저장 안 됨 · 저장하지 못한 내용이 있어요'
        : null;
/* 저장 못 한 글을 이 브라우저에 남겨 둬요(flag: 저장에 성공하면 지워도 되는 백업) */
function chBackup(c, flag) {
  try {
    localStorage.setItem('meari-bak:' + c.id, JSON.stringify({ t: c.t, c: c.c, at: Date.now() }));
    if (flag) c._bak = 1;
  } catch (e) {}
}
function chDownload(c) {
  const b = new Blob([(c.t ? c.t + '\n\n' : '') + c.c], { type: 'text/plain;charset=utf-8' }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download =
    ((c.n ? c.n + '화 ' : '') + (c.t || '제목 없음')).replace(/[\\/:*?"<>|]/g, '_') + '.txt';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try {
    localStorage.removeItem('meari-bak:' + c.id);
  } catch (e) {}
}
function capNote(n) {
  const over = n > BODY_MAX,
    c = cur;
  if (over && !c._over)
    toast('이 화가 30만 자를 넘어서 저장할 수 없어요. 새 화로 나눠 주세요.', {
      l: '내 글 내려받기',
      f: () => chDownload(c),
    });
  else if (!over && n >= BODY_MAX * 0.9 && !c._warn) {
    c._warn = 1;
    toast('이 화가 한 화 저장 한도(30만 자)의 90%에 가까워요. 새 화로 나누는 걸 권해요.');
  }
  if (n < BODY_MAX * 0.85) c._warn = 0;
  c._over = over;
}
/* 서버가 거절한 화(db.js 가 호출) */
function chRejected(c) {
  chBackup(c, 1);
  toast(
    c.c.length > BODY_MAX
      ? '이 화가 너무 길어서(30만 자 초과) 저장하지 못했어요. 새 화로 나눠 주세요.'
      : '이 화를 서버에 저장하지 못했어요.',
    { l: '내 글 내려받기', f: () => chDownload(c) }
  );
  if (c === cur) EL.st.textContent = stMsg() || EL.st.textContent;
}
/* 다른 탭·기기에서 먼저 바뀐 화(db.js 가 호출): 덮어쓰지 않고 어느 쪽을 남길지 물어요. 여러 건이면 하나씩 */
let cfQ = [],
  cfO = null;
function chConflict(c, srv) {
  c._cf = true;
  chBackup(c, 1);
  cfQ.push({ c, srv });
  if (!cfO) cfNext();
  if (c === cur) EL.st.textContent = stMsg();
}
function cfNext() {
  cfO = cfQ.shift() || null;
  const box = $('#cf');
  if (!cfO) {
    box.hidden = true;
    return;
  }
  const { c, srv } = cfO,
    gone = !!srv.gone,
    nm = c.n + '화' + (c.t ? ' ‘' + c.t + '’' : '');
  $('#cfm').textContent = gone
    ? nm + '이(가) 다른 곳에서 지워졌어요.'
    : nm + '이(가) 다른 탭이나 기기에서 먼저 바뀌었어요.';
  $('#cfi').textContent = gone
    ? '내 글은 이 화면에 그대로 있어요. 다시 저장하면 이 화가 되살아나요.'
    : '내 글 ' +
      fmt(raw(c.c)) +
      '자 · 다른 쪽 글 ' +
      fmt(raw(srv.body || '')) +
      '자예요. 어느 쪽을 남길지 골라 주세요.';
  $('#cft').hidden = gone;
  $('#cfk').textContent = gone ? '다시 저장하기' : '내 글로 저장하기';
  box.hidden = false;
  $('#cfk').focus();
}
$('#cfk').onclick = () => {
  const { c, srv } = cfO;
  c._cf = false;
  c._v = srv.gone ? null : srv.at;
  c._sig = null;
  db.clear('ch:' + c.id);
  if (c === cur) save();
  else db.chapter(c);
  cfNext();
};
$('#cft').onclick = () => {
  const { c, srv } = cfO,
    mine = { id: c.id, n: c.n, t: c.t, c: c.c };
  chBackup(mine);
  c._bak = 0; /* 내 글은 내려받기 전까지 남겨 둬요 */
  c.t = srv.title;
  c.c = srv.body;
  c._v = srv.at;
  c._sig = c.t + '\0' + c.c;
  c._cf = false;
  c._over = false;
  db.clear('ch:' + c.id);
  if (c === cur) {
    cur = null;
    const y = scrollY;
    openCh(c);
    scrollTo(0, y);
  } else {
    list(true);
    counts();
  }
  toast('다른 쪽 글로 바꿨어요.', { l: '내 글 내려받기', f: () => chDownload(mine) });
  cfNext();
};
$('#cfd').onclick = () => chDownload(cfO.c);
/* 한도를 넘기는 입력은 막아요(IME 조합 중인 글자는 막을 수 없어서 아래 저장 단계에서도 한 번 더 지켜요) */
ed.addEventListener('beforeinput', e => {
  if (!cur || !e.inputType.startsWith('insert') || e.inputType === 'insertCompositionText') return;
  const add =
    e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak'
      ? 1
      : (e.data || (e.dataTransfer && e.dataTransfer.getData('text/plain')) || '').length;
  if (cur.c.length + add > BODY_MAX) {
    e.preventDefault();
    toast('한 화는 30만 자까지 쓸 수 있어요. 새 화로 나눠 주세요.');
  }
});
function list(f) {
  if (!f && ($('#chs .rn') || $('#chs').contains(document.activeElement))) return;
  const html = chs
    .map((c, i) => {
      if (chRn === c.id)
        return `<div class="chw"><div class="rnb"><b>${c.n}화</b><input class="rn" maxlength="${TL.ch}" value="${esc(c.t)}" placeholder="제목 없음" aria-label="${c.n}화 제목"></div></div>`;
      const ask = chDq === c.id;
      return `<div class="chw${c === cur ? ' on' : ''}${ask ? ' dq' : ''}" data-id="${c.id}" data-s="${c.s || 'draft'}"><button class="ch" type="button" data-id="${c.id}" aria-current="${c === cur}"><b>${c.n}화</b><span>${esc(c.t) || '제목 없음'}</span><small>${fmt(lenN(c))}${c.g ? ' / ' + fmt(c.g) : ''}자 · <em class="stl">${stName(c.s)}</em></small></button><div class="cact">${chBtn('ren', '제목 고치기')}${chBtn('up', '위로', i === 0)}${chBtn('dn', '아래로', i === chs.length - 1)}${ask ? '<button type="button" class="ask" data-a="del">정말 삭제</button>' : chBtn('del', '삭제')}</div></div>`;
    })
    .join('');
  $('#chsum').textContent = STS.map(
    ([k, n]) => n + ' ' + chs.filter(c => (c.s || 'draft') === k).length
  ).join(' · ');
  if (html !== listHtml) {
    listHtml = html;
    EL.chs.innerHTML = html;
  } /* 바뀐 게 없으면 다시 그리지 않아요 */
}
function stats() {
  scanSoon();
  const b = body(),
    t = b.t,
    r = b.r,
    n = strict ? b.s : r;
  cur.c = t;
  cur._rk = t;
  cur._rv = r;
  capNote(t.length);
  EL.cnt.textContent = fmt(n) + '자';
  EL.mae.textContent = '원고지 ' + Math.ceil(r / 200) + '매';
  EL.td.textContent = gained();
  const g = cGoal(cur),
    p = Math.min(100, (n / g) * 100);
  EL.gl.style.width = p + '%';
  EL.glr.setAttribute('aria-label', '한 화 목표 ' + fmt(g) + '자 중 ' + Math.round(p) + '%');
  EL.edit.classList.toggle('done', n >= g);
  EL.page.classList.toggle('empty', !t.trim());
}
let saveSince = 0; /* 저장 대기가 시작된 시각: 쉬지 않고 계속 써도 최대 10초마다는 저장해요 */
function save() {
  saveSince = 0;
  if (!cur) return;
  cur.c = text();
  cur.t = ti.value.trim();
  const sig = cur.t + '\0' + cur.c;
  if (cur.c.length > BODY_MAX) {
    cur._over = true;
    chBackup(cur, 1);
    EL.st.textContent = stMsg();
    logDay();
    list();
    return;
  } /* 한도 초과: 서버가 거절하니 보내지 않고 이 브라우저에 백업 */
  cur._over = false;
  if (cur._sig !== sig) {
    if (cur._cf) {
      chBackup(cur, 1);
      EL.st.textContent = stMsg();
    } /* 충돌 해결 전: 보내지 않고 백업만 */ else {
      cur._sig = sig;
      db.chapter(cur);
      if (db.state().fails) chBackup(cur, 1);
    } /* 서버 저장이 계속 실패하는 동안은 이 브라우저에도 남겨 둬요(저장에 성공하면 지워요) */
  } else if (!db.pending()) EL.st.textContent = stMsg() || '저장됨';
  logDay();
  list();
}
/* 저장 간격: 본문이 길수록 한 번에 보내는 양이 커지니 쉬는 시간을 늘려요(짧은 글 0.7초 → 긴 글 최대 2.5초). 계속 쓰는 중에도 10초가 지나면 저장해요 */
function later() {
  touch();
  EL.st.textContent = stMsg() || '저장 중…';
  clearTimeout(timer);
  const now = Date.now(),
    n = cur && cur.c ? cur.c.length : 0;
  if (!saveSince) saveSince = now;
  timer = setTimeout(
    save,
    Math.max(0, Math.min(n < 3e4 ? 700 : n < 1e5 ? 1500 : 2500, saveSince + 1e4 - now))
  );
}
/* 화 본문은 로그인 때 받지 않고 열 때 받아요(c._lz). 받는 동안에는 cur 를 비우고 본문·제목 입력을 잠가서, 빈 본문이 저장되는 일이 없게 해요 */
let opening = null; /* 본문을 받는 중인 화 */
function edBusy(on, msg) {
  ed.contentEditable = on ? 'false' : 'true';
  ti.disabled = !!on;
  if (on) {
    ed.setAttribute('aria-busy', 'true');
    ed.dataset.ph = msg || '';
  } else {
    ed.removeAttribute('aria-busy');
    delete ed.dataset.ph;
  }
}
function openCh(c) {
  if (c._lz && opening === c) return; /* 이미 받는 중이에요 */
  if (cur) {
    clearTimeout(timer);
    save();
  }
  if (c._lz) {
    cur = null;
    opening = c;
    clearTimeout(timer);
    $('#num').textContent = c.n;
    ti.value = c.t;
    ed.innerHTML = '';
    edBusy(true, '불러오는 중…');
    EL.st.textContent = '화를 불러오는 중…';
    list(true);
    db.bodies([c])
      .then(() => {
        if (opening !== c) return;
        opening = null;
        openCh(c);
      })
      .catch(e => {
        if (opening !== c) return;
        opening = null;
        edBusy(true, '불러오지 못했어요');
        EL.st.textContent = '화를 불러오지 못했어요';
        toast((e && e.t) || '화를 불러오지 못했어요.', { l: '다시 시도', f: () => openCh(c) });
      });
    return;
  }
  opening = null;
  edBusy(false);
  cur = c;
  $('#num').textContent = c.n;
  ti.value = c.t;
  ed.innerHTML = c.c
    .split('\n')
    .map(l => `<div>${l ? esc(l) : '<br>'}</div>`)
    .join('');
  list(true);
  paintCmeta();
  stats();
  mark();
  if (fi.value) findText();
  scrollTo(0, 0);
  paintWhere();
}
function mark() {
  const s = getSelection().anchorNode;
  let el = s && ed.contains(s) ? (s.nodeType === 3 ? s.parentNode : s) : null;
  while (el && el !== ed && el.parentNode !== ed) el = el.parentNode;
  ed.querySelectorAll('.on').forEach(x => x.classList.remove('on'));
  if (el && el !== ed) {
    el.classList.add('on');
    return el;
  }
}
function edited() {
  rollDay();
  stats();
  later();
  if (fi.value) findText(true);
}
ed.addEventListener('beforeinput', e => {
  if (!OPT.q || e.inputType !== 'insertText' || (e.data !== '"' && e.data !== "'")) return;
  const r = getSelection().getRangeAt(0),
    nd = r.startContainer,
    prev = nd.nodeType === 3 ? nd.data[r.startOffset - 1] : '';
  const op = !prev || /[\s(\[“‘—]/.test(prev);
  e.preventDefault();
  IN.text(e.data === '"' ? (op ? '“' : '”') : op ? '‘' : '’');
});
ed.addEventListener('input', e => {
  if (!ed.firstElementChild) IN.block();
  if ((e.data === '.' && OPT.el) || (e.data === '-' && OPT.da)) {
    const s = getSelection(),
      nd = s.anchorNode,
      o = s.anchorOffset,
      dot = e.data === '.';
    if (nd && nd.nodeType === 3 && nd.data.slice(o - (dot ? 3 : 2), o) === (dot ? '...' : '--')) {
      s.setBaseAndExtent(nd, o - (dot ? 3 : 2), nd, o);
      IN.text(dot ? '…' : '—');
    }
  }
  edited();
  if (OPT.tw) twScroll();
  else if (app.classList.contains('focus')) {
    const el = mark();
    if (el) scrollBy({ top: el.getBoundingClientRect().top - innerHeight * 0.4 });
  }
});
ed.addEventListener('paste', e => {
  e.preventDefault();
  IN.text((e.clipboardData || window.clipboardData).getData('text/plain'));
});
document.addEventListener('selectionchange', mark);
ti.addEventListener('input', () => {
  cur.t = ti.value.trim();
  later();
});
ti.addEventListener('keydown', e => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    ed.focus();
  }
});
let ranges = [],
  ai = 0;
function findText(keep) {
  ranges = [];
  const q = fi.value.toLowerCase();
  if (q) {
    const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let nd;
    while ((nd = w.nextNode())) {
      const t = nd.data.toLowerCase();
      let i = 0;
      while ((i = t.indexOf(q, i)) > -1) {
        const r = new Range();
        r.setStart(nd, i);
        r.setEnd(nd, i + q.length);
        ranges.push(r);
        i += q.length;
      }
    }
  }
  if (ai >= ranges.length) ai = 0;
  paint(!keep);
}
function paint(sc) {
  if (window.CSS && CSS.highlights) {
    CSS.highlights.delete('f');
    CSS.highlights.delete('fc');
    if (ranges.length) {
      CSS.highlights.set('f', new Highlight(...ranges));
      const hh = new Highlight(ranges[ai]);
      hh.priority = 1;
      CSS.highlights.set('fc', hh);
    }
  }
  $('#fn').textContent = fi.value ? (ranges.length ? ai + 1 + ' / ' + ranges.length : '없음') : '';
  if (sc && ranges[ai])
    ranges[ai].startContainer.parentElement.scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth',
    });
}
function step(x) {
  if (!ranges.length) return;
  ai = (ai + x + ranges.length) % ranges.length;
  paint(true);
}
function rep(all) {
  if (!ranges.length) return;
  const rv = ri.value,
    k = ranges.length;
  (all ? [...ranges].reverse() : [ranges[ai]]).forEach(r => {
    r.deleteContents();
    r.insertNode(document.createTextNode(rv));
  });
  ed.normalize();
  edited();
  findText();
  if (all) toast(k + '곳을 바꿨어요.');
}
function closeFind() {
  if ($('#fb').hidden) return;
  $('#fb').hidden = true;
  $('#fdb').setAttribute('aria-expanded', false);
  fi.value = '';
  findText();
}
function findBar(on) {
  if (on) {
    fontPanel(false);
    spPanel(false);
    memoPanel(false);
    xMenu(false);
  }
  $('#fb').hidden = !on;
  $('#fdb').setAttribute('aria-expanded', on);
  if (on) {
    const s = getSelection().toString();
    if (s && !s.includes('\n')) fi.value = s;
    fi.focus();
    fi.select();
    findText();
  } else {
    fi.value = '';
    findText();
    ed.focus();
  }
}
$('#fdb').onclick = () => findBar($('#fb').hidden);
$('#fx').onclick = () => findBar(false);
fi.oninput = () => {
  ai = 0;
  findText();
};
fi.onkeydown = ri.onkeydown = e => {
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    e.target === ri ? rep(false) : step(e.shiftKey ? -1 : 1);
  }
};
$('#fnx').onclick = () => step(1);
$('#fpv').onclick = () => step(-1);
$('#r1').onclick = () => rep(false);
$('#ra').onclick = () => rep(true);
const persist = () => {
  touch();
  db.chapters(wk);
}; /* 순서·번호·제목 변경은 전체 목록을 한 번에 저장 */
const renum = () => {
  chs.forEach((c, i) => (c.n = i + 1));
  /* 화 번호는 원고마다 1, 2, 3… 으로 이어져요 */ if (cur) {
    $('#num').textContent = cur.n;
    paintWhere();
  }
};
function chFocus(id, a) {
  const w = $(`#chs .chw[data-id="${id}"]`);
  if (!w) return;
  const b =
    w.querySelector(`[data-a="${a}"]:not(:disabled)`) ||
    w.querySelector('[data-a]:not(:disabled)') ||
    w.querySelector('.ch');
  b && b.focus();
}
function chRename(c) {
  clearTimeout(chDt);
  chDq = null;
  chRn = c.id;
  list(true);
  const i = $('#chs .rn');
  i.focus();
  i.select();
}
function chEndRn(ok) {
  if (chRn === null) return;
  const c = chs.find(x => x.id === chRn),
    i = $('#chs .rn'),
    v = i ? i.value.trim() : null;
  chRn = null;
  if (c && ok && v !== null && v !== c.t) {
    c.t = v;
    if (c === cur) ti.value = v;
    persist();
  }
  list(true);
  if (c) chFocus(c.id, 'ren');
}
function chMove(c, d) {
  const i = chs.indexOf(c),
    j = i + d;
  if (j < 0 || j >= chs.length) return;
  [chs[i], chs[j]] = [chs[j], chs[i]];
  renum();
  persist();
  list(true);
  chFocus(c.id, d < 0 ? 'up' : 'dn');
}
async function chDel(c) {
  if (chs.length < 2) {
    toast('마지막 한 화는 지울 수 없어요.');
    chDq = null;
    list(true);
    return;
  }
  if (c._lz) {
    /* '되돌리기'가 글을 되살리려면 본문이 있어야 해서, 아직 안 받았으면 지우기 전에 받아요 */
    try {
      await db.bodies([c]);
    } catch (e) {
      toast('본문을 받지 못해서 지우지 못했어요. 연결을 확인해 주세요.');
      chDq = null;
      list(true);
      return;
    }
    if (!chs.includes(c)) return;
  }
  const i = chs.indexOf(c),
    sz = rawN(c),
    nn = c.n;
  chs.splice(i, 1);
  renum();
  base.s = Math.max(0, base.s - sz);
  db.pref('base', base);
  db.delChapter(c.id);
  persist();
  chDq = null;
  if (c === cur) {
    clearTimeout(timer);
    cur = null;
    openCh(chs[Math.min(i, chs.length - 1)]);
  } else list(true);
  toast(nn + '화를 삭제했어요.', {
    l: '되돌리기',
    f: () => {
      if (chs.includes(c)) return;
      chs.splice(Math.min(i, chs.length), 0, c);
      renum();
      base.s += sz;
      db.pref('base', base);
      persist();
      c._v = null;
      c._cf = false;
      db.chapter(c);
      openCh(c);
    },
  });
}
$('#chs').onclick = e => {
  const a = e.target.closest('[data-a]');
  if (a) {
    const c = chs.find(x => x.id == a.closest('.chw').dataset.id);
    if (!c) return;
    if (a.dataset.a === 'ren') chRename(c);
    else if (a.dataset.a === 'up') chMove(c, -1);
    else if (a.dataset.a === 'dn') chMove(c, 1);
    else if (chDq === c.id) {
      clearTimeout(chDt);
      chDel(c);
    } else {
      chDq = c.id;
      clearTimeout(chDt);
      chDt = setTimeout(() => {
        chDq = null;
        list(true);
      }, 3000);
      list(true);
      chFocus(c.id, 'del');
    }
    return;
  }
  const b = e.target.closest('.ch');
  if (!b) return;
  const c = chs.find(c => c.id == b.dataset.id);
  if (e.detail === 2) {
    chRename(c);
    return;
  } /* 더블클릭: 첫 클릭이 목록을 다시 그리므로 dblclick 대신 click 횟수로 판단 */
  if (app.dataset.v !== 'edit') view('edit'); /* 설정·홈 화면에서 화를 누르면 에디터로 들어가요 */
  openCh(c);
};
$('#chs').addEventListener('keydown', e => {
  if (!e.target.classList.contains('rn')) return;
  if (e.isComposing) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    chEndRn(true);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    chEndRn(false);
  }
});
$('#chs').addEventListener('focusout', e => {
  if (e.target.classList.contains('rn')) chEndRn(true);
});
$('#chm').onclick = () => {
  const on = $('#chm').getAttribute('aria-pressed') !== 'true';
  $('#chm').setAttribute('aria-pressed', on);
  $('#chs').classList.toggle('mg', on);
};
$('#add').onclick = () => {
  if (app.dataset.v !== 'edit') view('edit');
  save();
  const c = {
    id: Date.now(),
    n: chs.length + 1,
    t: '',
    c: '',
    s: 'draft',
    g: 0,
    w: wk.id,
    _sig: '\0',
  };
  chs.push(c);
  db.chapter(c);
  persist();
  openCh(c);
  ti.focus();
};
$('#cm').onclick = () => {
  strict = !strict;
  stats();
  list(true);
  selc();
  toast(strict ? '공백 제외로 셉니다.' : '공백 포함으로 셉니다.');
};
function setSize(i, keep = true) {
  size = Math.max(0, Math.min(SIZES.length - 1, i));
  document.documentElement.style.setProperty('--fs', SIZES[size] + 'rem');
  if (keep) db.pref('size', size);
}
$('#fm').onclick = () => setSize(size - 1);
$('#fp').onclick = () => setSize(size + 1);
setSize(size, false);

/* ── 화 상태(초고·퇴고·완료) · 화별 목표 ── */
const CG_STEPS = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 8000];
function paintCmeta() {
  if (!cur) return;
  $('#cst').innerHTML = STS.map(
    ([k, n]) =>
      `<button type="button" data-s="${k}" aria-pressed="${(cur.s || 'draft') === k}">${n}</button>`
  ).join('');
  const vs = [...new Set([...CG_STEPS, ...(cur.g ? [cur.g] : [])])].sort((a, b) => a - b);
  $('#cgs').innerHTML =
    `<option value="0">목표 ${fmt(GOAL())}자 (원고 기본)</option>` +
    vs.map(v => `<option value="${v}">목표 ${fmt(v)}자</option>`).join('');
  $('#cgs').value = String(cur.g || 0);
  $('#cmt').textContent = stName(cur.s) + ' · 목표 ' + fmt(cGoal(cur)) + '자';
  paintChLinks();
}
/* 이 화와 연결된 세계관·설정집 항목(설정 쪽에서 이 화로 건 연결)을 제목 아래에 보여요 */
function paintChLinks() {
  const box = $('#clk');
  if (!box || !cur || !wk) return;
  const hit = [];
  ['codex', 'world'].forEach(k =>
    (wk[k] || []).forEach(x =>
      (x.l || []).forEach(o => {
        if (o.k === 'ch' && o.id === cur.id) hit.push([k, x, o.r]);
      })
    )
  );
  box.hidden = !hit.length;
  box.innerHTML = hit.length
    ? '<span>연결된 설정</span>' +
      hit
        .slice(0, 12)
        .map(
          ([k, x, r]) =>
            `<button type="button" data-k="${k}" data-id="${x.id}" title="${k === 'codex' ? '설정집' : '세계관'}에서 열기">${esc((x.t && x.t.trim()) || '제목 없음')}${r ? ' · ' + esc(r) : ''}</button>`
        )
        .join('') +
      (hit.length > 12 ? `<span>외 ${hit.length - 12}개</span>` : '')
    : '';
}
$('#clk').onclick = e => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  const k = b.dataset.k,
    x = (wk[k] || []).find(o => o.id === +b.dataset.id);
  if (!x) return;
  if (cur) {
    clearTimeout(timer);
    save();
  }
  view(k);
  openLore(x);
};
function cmetaSave() {
  touch();
  db.chapters(wk);
  list(true);
  paintCmeta();
  stats();
  repaintCards();
}
$('#cst').onclick = e => {
  const b = e.target.closest('button');
  if (!b || !cur || (cur.s || 'draft') === b.dataset.s) return;
  cur.s = b.dataset.s;
  cmetaSave();
  toast(cur.n + '화를 ‘' + stName(cur.s) + '’ 상태로 바꿨어요.');
};
$('#cgs').onchange = () => {
  if (!cur) return;
  cur.g = +$('#cgs').value;
  cmetaSave();
  toast(
    cur.g
      ? cur.n + '화 목표를 ' + fmt(cur.g) + '자로 정했어요.'
      : cur.n + '화는 원고 기본 목표(' + fmt(GOAL()) + '자)를 따라요.'
  );
};

/* ── 타자기 스크롤: 글 쓰는 줄을 화면 가운데에 둬요(집중 모드와 따로) ── */
function twScroll() {
  if (!OPT.tw || document.activeElement !== ed) return;
  const s = getSelection();
  if (!s.rangeCount) return;
  const r = s.getRangeAt(0).cloneRange();
  r.collapse(false);
  let b = r.getClientRects()[0];
  if (!b || (!b.top && !b.bottom)) {
    const el = mark();
    b = el && el.getBoundingClientRect();
  }
  if (!b) return;
  const d = b.top + b.height / 2 - innerHeight * 0.5;
  if (Math.abs(d) > 6) scrollBy(0, d);
}
ed.addEventListener('keyup', e => {
  if (/^(Arrow|Page|Home|End)/.test(e.key)) twScroll();
});

function focusMode(on) {
  app.classList.toggle('focus', on);
  $('#fc').setAttribute('aria-pressed', on);
  if (on) {
    ed.focus();
    mark();
  } else ed.querySelectorAll('.on').forEach(x => x.classList.remove('on'));
}
$('#fc').onclick = () => focusMode(!app.classList.contains('focus'));

function men() {
  const t = cur ? cur.c : '',
    all = [
      ['world', LORE.world],
      ['codex', LORE.codex],
    ].flatMap(([k, l]) => l.items.map(x => [k, x]));
  const h = all
    .filter(([k, x]) => x.t.trim() && t.includes(x.t.trim()))
    .map(
      ([k, x]) =>
        `<button class="mn" type="button" data-k="${k}" data-id="${x.id}">${esc(x.t)}<small>${esc(x.c)}</small></button>`
    )
    .join('');
  const m = $('#men');
  if (m.dataset.h !== h) {
    m.dataset.h = h;
    m.innerHTML = h;
  }
}
$('#men').onclick = e => {
  const b = e.target.closest('.mn');
  if (!b) return;
  view(b.dataset.k);
  openLore(L().items.find(x => x.id == b.dataset.id));
};

/* 선택 영역 글자 수 */
function selc() {
  const s = getSelection(),
    e = $('#sel');
  let n = 0;
  if (s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode) && ed.contains(s.focusNode))
    n = len(s.toString());
  e.hidden = !n;
  if (n) e.textContent = '선택 ' + fmt(n) + '자';
}

/* @ 설정 자동완성 */
let atmI = 0,
  atmL = [],
  atmQ = null,
  atmX = null;
const atmBox = $('#atm');
function atmCtx() {
  const s = getSelection();
  if (!s.rangeCount || !s.isCollapsed) return null;
  const nd = s.anchorNode;
  if (!nd || nd.nodeType !== 3 || !ed.contains(nd)) return null;
  const o = s.anchorOffset,
    m = /(^|[\s(\[“‘—])@([^\s@]{0,20})$/.exec(nd.data.slice(0, o));
  return m ? { nd, o, q: m[2], s: o - m[2].length - 1 } : null;
}
function atmClose() {
  if (atmBox.hidden) return;
  atmBox.hidden = true;
  atmQ = null;
  ed.removeAttribute('aria-activedescendant');
}
function atmPaint() {
  [...atmBox.children].forEach((x, i) => {
    x.setAttribute('aria-selected', i === atmI);
    if (i === atmI) {
      ed.setAttribute('aria-activedescendant', x.id);
      x.scrollIntoView({ block: 'nearest' });
    }
  });
}
function atm() {
  const c = document.activeElement === ed ? atmCtx() : null;
  if (!c) {
    atmX = null;
    atmClose();
    return;
  }
  if (atmX && atmX.nd === c.nd && atmX.s === c.s) {
    atmClose();
    return;
  }
  const q = c.q.toLowerCase();
  atmL = [
    ['world', LORE.world],
    ['codex', LORE.codex],
  ]
    .flatMap(([k, l]) => l.items.map(x => ({ x, k, n: l.name })))
    .filter(o => o.x.t.trim() && o.x.t.toLowerCase().includes(q))
    .slice(0, 8);
  if (!atmL.length) {
    atmClose();
    return;
  }
  if (c.q !== atmQ) {
    atmQ = c.q;
    atmI = 0;
  }
  atmI = Math.min(atmI, atmL.length - 1);
  atmBox.innerHTML = atmL
    .map(
      (o, i) =>
        `<div class="atmo" role="option" id="atmo${i}" data-i="${i}">${esc(o.x.t.trim())}<small>${esc(o.n)} · ${esc(o.x.c)}</small></div>`
    )
    .join('');
  atmBox.hidden = false;
  atmPaint();
  const r = getSelection().getRangeAt(0).cloneRange();
  let b = r.getClientRects()[0] || r.getBoundingClientRect();
  if (!b || (!b.top && !b.bottom)) b = c.nd.parentElement.getBoundingClientRect();
  const w = atmBox.offsetWidth,
    h = atmBox.offsetHeight;
  let top = b.bottom + 6;
  if (top + h > innerHeight - 8) top = Math.max(8, b.top - h - 6);
  atmBox.style.left = Math.max(8, Math.min(b.left, innerWidth - w - 8)) + 'px';
  atmBox.style.top = top + 'px';
}
function atmPick(i) {
  const c = atmCtx(),
    o = atmL[i];
  if (!c || !o) return;
  getSelection().setBaseAndExtent(c.nd, c.s, c.nd, c.o);
  IN.text(o.x.t.trim());
  atmX = null;
  atmClose();
}
ed.addEventListener('keydown', e => {
  if (atmBox.hidden) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    atmX = atmCtx();
    atmClose();
    return;
  }
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    atmI = (atmI + (e.key === 'ArrowDown' ? 1 : -1) + atmL.length) % atmL.length;
    atmPaint();
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault();
    atmPick(atmI);
  }
});
atmBox.addEventListener('mousedown', e => e.preventDefault());
atmBox.addEventListener('click', e => {
  const o = e.target.closest('.atmo');
  if (o) atmPick(+o.dataset.i);
});
ed.addEventListener('input', atm);
ed.addEventListener('blur', () => {
  atmX = null;
  atmClose();
});
addEventListener(
  'scroll',
  () => {
    if (!atmBox.hidden) atm();
  },
  { passive: true }
);
document.addEventListener('selectionchange', () => {
  selc();
  atm();
});

/* 글꼴 · 줄간격 */
const FONTS = [
  ['명조', '"Noto Serif KR",serif'],
  ['바탕', '"Gowun Batang","Noto Serif KR",serif'],
  ['고딕', '"Noto Sans KR",Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif'],
  ['시스템', 'Pretendard,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif'],
];
const LHS = [
  ['촘촘', 1.75],
  ['보통', 2.05],
  ['넓게', 2.35],
  ['아주 넓게', 2.7],
];
let fnt = 0,
  lhi = 1; /* 저장된 값은 로그인 후 main.js 의 hydrate 가 채워요 */
function paintFmt() {
  const r = document.documentElement.style;
  r.setProperty('--ff', FONTS[fnt][1]);
  r.setProperty('--lh', LHS[lhi][1]);
  $('#ffo').innerHTML = FONTS.map(
    (f, i) =>
      `<button type="button" data-i="${i}" aria-pressed="${i === fnt}" style="font-family:${f[1].replace(/"/g, '&quot;')}">${f[0]}</button>`
  ).join('');
  $('#flo').innerHTML = LHS.map(
    (f, i) => `<button type="button" data-i="${i}" aria-pressed="${i === lhi}">${f[0]}</button>`
  ).join('');
  $('#frs').disabled = fnt === 0 && lhi === 1;
  paintPf();
}
/* 문단 모양(들여쓰기·문단 간격·줄 폭) */
function paintPf() {
  const r = document.documentElement.style,
    g = PF_GAP[pf[1]][1];
  r.setProperty('--pin', PF_IND[pf[0]][1] + 'em');
  r.setProperty('--pgap', g < 0 ? 'calc(var(--lh,2.05)*1em)' : g + 'em');
  r.setProperty('--ew', PF_W[pf[2]][1]);
  const row = (id, list, k) =>
    ($(id).innerHTML = list
      .map(
        (f, i) =>
          `<button type="button" data-i="${i}" aria-pressed="${i === pf[k]}">${f[0]}</button>`
      )
      .join(''));
  row('#pfi', PF_IND, 0);
  row('#pfg', PF_GAP, 1);
  row('#pfw', PF_W, 2);
  $('#pfp').innerHTML =
    PF_PRE.map(
      ([n, v], i) =>
        `<button type="button" data-i="${i}" aria-pressed="${v.every((x, k) => x === pf[k])}">${n}</button>`
    ).join('') +
    `<button type="button" data-i="r" ${pf.every((x, k) => x === PF_DEF[k]) ? 'disabled' : ''}>기본값</button>`;
}
const setPf = v => {
  pf = v;
  db.pref('pf', pf);
  paintPf();
};
$('#pfp').onclick = e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  setPf(b.dataset.i === 'r' ? PF_DEF.slice() : PF_PRE[+b.dataset.i][1].slice());
};
[
  ['#pfi', 0],
  ['#pfg', 1],
  ['#pfw', 2],
].forEach(
  ([id, k]) =>
    ($(id).onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      const v = pf.slice();
      v[k] = +b.dataset.i;
      setPf(v);
    })
);
function fontPanel(on) {
  if (on) {
    memoPanel(false);
    spPanel(false);
    closeFind();
    xMenu(false);
  }
  $('#fpn').hidden = !on;
  $('#fo').setAttribute('aria-expanded', on);
}
$('#fo').onclick = () => fontPanel($('#fpn').hidden);
$('#ffo').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  fnt = +b.dataset.i;
  db.pref('font', fnt);
  paintFmt();
  $('#ffo').children[fnt].focus();
};
$('#flo').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  lhi = +b.dataset.i;
  db.pref('lh', lhi);
  paintFmt();
  $('#flo').children[lhi].focus();
};
$('#frs').onclick = () => {
  fnt = 0;
  lhi = 1;
  db.pref('font', 0);
  db.pref('lh', 1);
  paintFmt();
  $('#fo').focus();
};
document.addEventListener('click', e => {
  const p = e.composedPath();
  if (!$('#fpn').hidden && !p.includes($('#fpn')) && !p.includes($('#fo'))) fontPanel(false);
});
paintFmt();
/* 패널 탭(보기·도우미)과 도구줄 지표 더 보기 */
function panelTab(t) {
  $('#ptv').hidden = t !== 'v';
  $('#pta').hidden = t !== 'a';
  $('#ptb')
    .querySelectorAll('button')
    .forEach(b => b.setAttribute('aria-pressed', b.dataset.pt === t));
}
$('#ptb').onclick = e => {
  const b = e.target.closest('button');
  if (b) panelTab(b.dataset.pt);
};
function statMore(on) {
  $('#stx').hidden = !on;
  $('#sm').setAttribute('aria-expanded', on);
  $('#sm').textContent = on ? '접기' : '더 보기';
  try {
    localStorage.setItem('meari-sm', on ? '1' : '');
  } catch (_) {}
}
$('#sm').onclick = () => statMore($('#stx').hidden);
try {
  statMore(!!localStorage.getItem('meari-sm'));
} catch (_) {}

/* 설정 이름 표시 · 표기 점검 · 반복 표현 점검 */
let lgHits = [],
  hits = [],
  sph = [],
  spN = 0,
  SPI = new Set(),
  scT,
  repN = 0,
  patKey = '',
  pats = [],
  blkC = new WeakMap(),
  blkSig = '';
const scanSoon = () => {
  clearTimeout(scT);
  scT = setTimeout(() => {
    men();
    scan();
  }, 220);
};
const hlSet = (k, rs) => {
  if (!(window.CSS && CSS.highlights)) return;
  rs.length ? CSS.highlights.set(k, new Highlight(...rs)) : CSS.highlights.delete(k);
};
const rg = (nd, s, e) => {
  const r = new Range();
  r.setStart(nd, s);
  r.setEnd(nd, e);
  return r;
};
const canon = t => t.trim().replace(/\s+/g, ' ');
const STOP = new Set([
  '그녀',
  '그가',
  '그는',
  '그것',
  '이것',
  '저것',
  '하지',
  '하고',
  '있는',
  '있던',
  '없는',
  '없던',
  '같은',
  '같이',
  '그리고',
  '하지만',
  '그러나',
  '그때',
  '다시',
  '이미',
  '아직',
  '모든',
  '어떤',
  '무슨',
  '자신',
  '사람',
  '순간',
  '느낌',
]);
const JOSA =
  /(으로서|으로써|에서는|에게서|에서|에게|으로|까지|부터|처럼|보다|이라|라고|하게|하고|이|가|은|는|을|를|의|에|도|만|와|과|로|고|며|던|인|한)$/;
const textNodes = b => {
  if (b.nodeType === 3) return [b];
  if (b.nodeType !== 1) return [];
  const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT),
    a = [];
  let n;
  while ((n = w.nextNode())) a.push(n);
  return a;
};
function scanBlock(nds) {
  const hits = [],
    sph = [],
    lg = [],
    hb = [],
    toks = [],
    hc = HAB.map(() => 0);
  for (const nd of nds) {
    const tk = [];
    for (const { o, re } of pats) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(nd.data))) {
        const s = m.index,
          e = s + m[0].length;
        if (tk.some(([a, b]) => s < b && e > a)) continue;
        tk.push([s, e]);
        hits.push({ nd, s, e, o, v: m[0] !== o.c, r: rg(nd, s, e) });
      }
    }
    if (OPT.sp)
      for (const m of spellFind(nd.data)) {
        if (SPI.has(m.t) || tk.some(([a, b]) => m.s < b && m.e > a)) continue;
        sph.push({ nd, s: m.s, e: m.e, sp: 1, m, r: rg(nd, m.s, m.e) });
      }
    if (OPT.long) {
      const re = /[^.!?…\n]+[.!?…]*["”’']*/g;
      let m;
      while ((m = re.exec(nd.data))) {
        const t = m[0].trim();
        if (t.length > LONGS[LONGI]) {
          const s = m.index + m[0].indexOf(t);
          lg.push({ r: rg(nd, s, s + t.length), n: t.length });
        }
      }
    }
    if (OPT.hab && HAB.length)
      HAB.forEach((w, i) => {
        let p = 0;
        while ((p = nd.data.indexOf(w, p)) > -1) {
          hb.push(rg(nd, p, p + w.length));
          hc[i]++;
          p += w.length;
        }
      });
    if (OPT.rep) {
      const re = /[가-힣A-Za-z0-9]+/g;
      let m;
      while ((m = re.exec(nd.data))) {
        const s = m.index,
          e = s + m[0].length;
        if (tk.some(([a, b]) => s < b && e > a)) continue;
        toks.push({ nd, s, e, t: m[0], st: m[0].replace(JOSA, '') });
      }
    }
  }
  return { nds, ds: nds.map(n => n.data), hits, sph, lg, hb, toks, hc };
}
function scan() {
  const lore = OPT.hl
    ? [
        ['world', LORE.world],
        ['codex', LORE.codex],
      ]
        .flatMap(([k, l]) => l.items.map(x => ({ k, x, n: l.name, c: canon(x.t) })))
        .filter(o => o.c.replace(/ /g, '').length >= 2)
        .sort((a, b) => b.c.length - a.c.length)
    : [];
  const key = lore
    .map(o => o.k + o.x.id + ':' + o.c)
    .join('|'); /* 설정 제목이 그대로면 정규식을 다시 만들지 않아요 */
  if (key !== patKey) {
    patKey = key;
    pats = lore.map(o => ({
      o,
      re: new RegExp(
        [...o.c.replace(/ /g, '')].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'),
        'g'
      ),
    }));
  }
  /* 문단(편집기의 직계 자식) 단위 캐시: 글자가 바뀐 문단만 다시 훑어요. 설정·옵션이 바뀌면 전부 새로 계산해요. */
  const csig = [
    patKey,
    OPT.hl,
    OPT.sp,
    OPT.long,
    OPT.hab,
    OPT.rep,
    LONGI,
    HAB.join('\u0001'),
    [...SPI].join('\u0001'),
  ].join('|');
  if (csig !== blkSig) {
    blkSig = csig;
    blkC = new WeakMap();
  }
  const toks = [],
    lg = [],
    hb = [];
  hits = [];
  sph = [];
  habC = HAB.map(() => 0);
  for (const b of ed.childNodes) {
    const nl = textNodes(b);
    let c = blkC.get(b);
    if (
      !(c && c.nds.length === nl.length && nl.every((n, i) => n === c.nds[i] && n.data === c.ds[i]))
    )
      blkC.set(b, (c = scanBlock(nl)));
    for (const x of c.hits) hits.push(x);
    for (const x of c.sph) sph.push(x);
    for (const x of c.lg) lg.push(x);
    for (const x of c.hb) hb.push(x);
    for (const x of c.toks) toks.push(x);
    c.hc.forEach((n, i) => (habC[i] += n));
  }
  hlSet(
    'lore',
    hits.filter(h => !h.v).map(h => h.r)
  );
  hlSet(
    'lov',
    hits.filter(h => h.v).map(h => h.r)
  );
  spN = sph.length;
  hlSet(
    'sp',
    sph.map(h => h.r)
  );
  const marks = [];
  if (OPT.rep) {
    const by = new Map();
    toks.forEach((k, i) => {
      const st = k.st;
      if (st.length < 2 || STOP.has(st) || /^\d+$/.test(st)) return;
      (by.get(st) || by.set(st, []).get(st)).push(i);
    });
    const mk = new Set();
    by.forEach(p => {
      for (let k = 0; k + 2 < p.length; k++)
        if (p[k + 2] - p[k] <= 30) [p[k], p[k + 1], p[k + 2]].forEach(i => mk.add(i));
    });
    mk.forEach(i => {
      const k = toks[i],
        st = k.st;
      marks.push(rg(k.nd, k.s, k.s + st.length));
    });
    const fin = toks.filter(
      k => k.t.length >= 2 && k.t.endsWith('다') && /^(?:[.?!…”’"']|$)/.test(k.nd.data.slice(k.e))
    );
    for (let i = 0; i < fin.length; ) {
      let j = i;
      const key = fin[i].t.slice(-2);
      while (j < fin.length && fin[j].t.slice(-2) === key) j++;
      if (j - i >= 3) for (let k = i; k < j; k++) marks.push(rg(fin[k].nd, fin[k].e - 2, fin[k].e));
      i = j;
    }
  }
  repN = marks.length;
  hlSet('rep', marks);
  longN = lg.length;
  lgHits = lg;
  hlSet(
    'long',
    lg.map(x => x.r)
  );
  hlSet('hab', hb);
  metrics();
  paintOpt();
  spPaint();
}

/* 도구줄 지표: 대사·지문 비율, 읽는 시간(공백 뺀 글자 수 ÷ 분당 500자) */
const RD_CPM = 500;
function metrics() {
  const t = cur ? cur.c : '',
    ns = nsp(t);
  let dl = 0;
  if (OPT.ratio && ns) for (const m of t.matchAll(/“[^”\n]*”?|"[^"\n]*"/g)) dl += nsp(m[0]);
  const p = ns ? Math.round((dl / ns) * 100) : 0,
    rt = $('#rt'),
    rd = $('#rd');
  rt.hidden = !(OPT.ratio && ns);
  if (!rt.hidden) {
    rt.textContent = '대사 ' + p + '% · 지문 ' + (100 - p) + '%';
    rt.title = '따옴표(“ ”) 안의 글자 수 ÷ 공백을 뺀 전체 글자 수';
  }
  rd.hidden = !(OPT.rd && ns);
  if (!rd.hidden) {
    const mn = ns / RD_CPM;
    rd.textContent = mn < 1 ? '읽는 시간 1분 미만' : '읽는 시간 약 ' + Math.round(mn) + '분';
    rd.title = '공백을 뺀 글자 수 기준, 분당 약 ' + RD_CPM + '자로 어림했어요';
  }
}

/* 이름 위에 마우스를 올리면 설정 요약 */
const tip = $('#lt');
let ltH = null,
  ltT,
  ltRaf = 0;
function ltHide() {
  clearTimeout(ltT);
  tip.hidden = true;
  ltH = null;
}
const ltLater = () => {
  clearTimeout(ltT);
  ltT = setTimeout(ltHide, 260);
};
function hitAt(x, y) {
  for (const h of hits.concat(
    sph,
    lgHits.map(x => ({ ...x, lg: 1 }))
  ))
    for (const q of h.r.getClientRects())
      if (x >= q.left - 1 && x <= q.right + 1 && y >= q.top - 5 && y <= q.bottom + 5) return h;
  return null;
}
function ltShow(h) {
  clearTimeout(ltT);
  if (ltH && ltH.r === h.r && !tip.hidden) return;
  ltH = h;
  if (h.lg)
    tip.innerHTML = `<small>긴 문장</small><b>${h.n}자</b><p>한 문장이 ${LONGS[LONGI]}자를 넘었어요. 쉼표나 마침표로 나눠 보세요.</p><em>기준은 Aa 패널에서 바꿀 수 있어요</em>`;
  else if (h.sp)
    tip.innerHTML = `<small>맞춤법</small><b>${esc(h.m.t)} → ${esc(h.m.fix)}</b><p>${esc(h.m.note)}</p><div class="ltb"><button type="button" data-a="sp" class="pri">고치기</button><button type="button" data-a="ig">이대로 두기</button></div><em>‘이대로 두기’는 내 계정에 저장돼요 · F8 다음 오류</em>`;
  else {
    const x = h.o.x,
      b = (x.b || '').trim();
    tip.innerHTML =
      `<small>${esc(h.o.n)} · ${esc(x.c)}</small><b>${esc(h.o.c)}</b><p>${b ? esc(b.length > 90 ? b.slice(0, 90) + '…' : b) : '아직 적어 둔 내용이 없어요.'}</p>` +
      (h.v ? `<p class="warn">설정집에는 ‘${esc(h.o.c)}’로 적혀 있어요.</p>` : '') +
      `<div class="ltb"><button type="button" data-a="go">설정으로 이동</button>${h.v ? '<button type="button" data-a="fix" class="pri">표기 맞추기</button>' : ''}</div><em>Ctrl/⌘+클릭으로도 이동해요</em>`;
  }
  tip.hidden = false;
  const q = h.r.getClientRects()[0],
    wd = tip.offsetWidth,
    ht = tip.offsetHeight;
  let top = q.bottom + 8;
  if (top + ht > innerHeight - 8) top = Math.max(8, q.top - ht - 8);
  tip.style.left = Math.max(8, Math.min(q.left, innerWidth - wd - 8)) + 'px';
  tip.style.top = top + 'px';
}
const loreGo = h => {
  ltHide();
  view(h.o.k);
  openLore(h.o.x);
};
ed.addEventListener('mousemove', e => {
  if (!(OPT.hl || OPT.sp || OPT.long) || e.buttons || ltRaf) return;
  ltRaf = 1;
  requestAnimationFrame(() => {
    ltRaf = 0;
    const h = hitAt(e.clientX, e.clientY);
    h ? ltShow(h) : ltLater();
  });
});
ed.addEventListener('mouseleave', ltLater);
ed.addEventListener('input', ltHide);
addEventListener('scroll', ltHide, { passive: true });
tip.addEventListener('mouseenter', () => clearTimeout(ltT));
tip.addEventListener('mouseleave', ltLater);
tip.addEventListener('mousedown', e => e.preventDefault());
tip.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !ltH) return;
  const h = ltH;
  if (b.dataset.a === 'sp' || b.dataset.a === 'ig') {
    ltHide();
    if (b.dataset.a === 'ig') {
      spIgnore(h.m.t);
      return;
    }
    IN.replace(h.r, h.m.fix);
    toast('맞춤법을 고쳤어요.');
    return;
  }
  if (b.dataset.a === 'go') loreGo(h);
  else {
    IN.replace(h.r, h.o.c);
    ltHide();
    toast('표기를 맞췄어요.');
  }
});
ed.addEventListener('click', e => {
  if (!(e.ctrlKey || e.metaKey) || !OPT.hl) return;
  const h = hitAt(e.clientX, e.clientY);
  if (h && !h.sp && !h.lg) {
    e.preventDefault();
    loreGo(h);
  }
});

/* 글쓰기 도우미 설정 */
const TOG = [
  ['hl', '본문에서 설정 이름 표시', '이름에 밑줄, 올리면 요약·띄어쓰기 불일치 표시'],
  ['sp', '맞춤법 검사', '자주 틀리는 표현에 파란 물결선, 올리면 고칠 표현 제안'],
  ['rep', '반복 표현 점검', '같은 단어·어미가 가까이 반복되면 연하게 표시'],
  ['q', '따옴표 자동 전환', '" → “ ”   \' → ‘ ’'],
  ['el', '말줄임표 자동 변환', '... → …'],
  ['da', '줄표 자동 변환', '-- → —'],
  ['tw', '타자기 스크롤', '글 쓰는 줄이 화면 가운데에 머물러요(집중 모드와 따로)'],
  ['ratio', '대사·지문 비율', '위쪽 도구줄에 대사와 지문의 비율을 보여줘요'],
  ['rd', '읽는 시간', '위쪽 도구줄에 이 화의 읽는 시간을 어림해서 보여줘요'],
  ['long', '너무 긴 문장 경고', '기준을 넘는 문장에 주황 점선, 올리면 글자 수 표시'],
  ['hab', '습관어 표시', '아래에 등록한 말을 본문에서 연보라로 표시'],
];
const LONGS = [60, 80, 100, 120],
  HAB_MAX = 30;
let LONGI = 1,
  HAB = [],
  longN = 0,
  habC = [],
  habKey = '';
$('#tgl').innerHTML = TOG.map(
  ([k, n, d]) =>
    `<button type="button" role="switch" data-k="${k}" aria-checked="false"><span>${n}<small id="tg-${k}">${d}</small></span><i></i></button>`
).join('');
function paintOpt() {
  paintSp();
  TOG.forEach(([k, n, d]) => {
    const b = $(`#tgl [data-k="${k}"]`);
    b.setAttribute('aria-checked', !!OPT[k]);
    $('#tg-' + k).textContent =
      k === 'rep' && OPT.rep
        ? repN
          ? repN + '곳 표시 중'
          : '반복되는 표현이 없어요'
        : k === 'sp' && OPT.sp
          ? spN
            ? spN + '곳 확인해 보세요'
            : '틀린 표현이 없어요'
          : k === 'long' && OPT.long
            ? longN
              ? longN + '개 문장이 ' + LONGS[LONGI] + '자를 넘어요'
              : '긴 문장이 없어요'
            : k === 'hab' && OPT.hab && HAB.length
              ? habC.reduce((a, b) => a + b, 0) + '곳 표시 중'
              : d;
  });
  paintHab();
  paintLg();
}
function paintLg() {
  const n = ['hl', 'sp', 'rep', 'long', 'hab'].filter(k => OPT[k]).length;
  document.documentElement.toggleAttribute(
    'data-dense',
    n >= 3
  ); /* 표시를 3가지 이상 켜면 색을 연하게 */
  $('#lgd')
    .querySelectorAll('li')
    .forEach(li => li.classList.toggle('off', !OPT[li.dataset.k]));
}
function paintSp() {
  $('#spt').textContent = OPT.sp && spN ? '맞춤법 ' + spN : '맞춤법';
}
$('#tgl').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  const k = b.dataset.k;
  OPT[k] = OPT[k] ? 0 : 1;
  db.pref('opt', { ...OPT });
  if (k === 'hl' || k === 'sp') ltHide();
  if (k === 'tw' && OPT.tw) twScroll();
  scan();
};
function paintLong() {
  $('#lno').innerHTML = LONGS.map(
    (n, i) => `<button type="button" data-i="${i}" aria-pressed="${i === LONGI}">${n}자</button>`
  ).join('');
}
$('#lno').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  LONGI = +b.dataset.i;
  db.pref('lg', LONGI);
  paintLong();
  scan();
};
function paintHab() {
  const h = HAB.map(
    (w, i) =>
      `<li><span>${esc(w)}</span><small>${habC[i] || 0}회</small><button type="button" data-i="${i}" aria-label="${esc(w)} 삭제"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></li>`
  ).join('');
  if (h !== habKey) {
    habKey = h;
    $('#habl').innerHTML = h;
  }
}
$('#habf').onsubmit = e => {
  e.preventDefault();
  const i = $('#habi'),
    t = canon(i.value);
  if (!t) return;
  if (HAB.includes(t)) {
    toast('이미 등록한 말이에요.');
    return;
  }
  if (HAB.length >= HAB_MAX) {
    toast('습관어는 ' + HAB_MAX + '개까지 등록할 수 있어요.');
    return;
  }
  HAB.push(t);
  db.pref('habs', HAB.slice());
  i.value = '';
  OPT.hab || ((OPT.hab = 1), db.pref('opt', { ...OPT }));
  scan();
};
$('#habi').addEventListener('keydown', e => {
  if (e.key === 'Escape') e.stopPropagation();
});
$('#habl').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  HAB.splice(+b.dataset.i, 1);
  db.pref('habs', HAB.slice());
  scan();
};
paintLong();

/* 에디터 옆 빠른 메모 */
function memoPanel(on, back) {
  if (on) {
    fontPanel(false);
    spPanel(false);
    closeFind();
    xMenu(false);
  }
  $('#mp').hidden = !on;
  $('#mo').setAttribute('aria-expanded', on);
  if (on) $('#mpi').focus();
  else if (back) ed.focus();
}
$('#mo').onclick = () => memoPanel($('#mp').hidden);
$('#mpf').onsubmit = e => {
  e.preventDefault();
  const i = $('#mpi'),
    t = i.value.trim();
  if (!t) return;
  addMemo(t);
  i.value = '';
};
$('#mpi').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    memoPanel(false, true);
  }
});
paintOpt();

/* ── 맞춤법: 이대로 두기(계정 저장) · 다음/이전 오류 이동 · 전체 오류 목록 ── */
const SP_MAX = 150;
function spIgnore(t) {
  SPI.delete(t);
  SPI.add(t);
  while (SPI.size > SP_MAX) SPI.delete(SPI.values().next().value);
  db.pref('ign', [...SPI]);
  scan();
}
/* 본문에서 오류 한 곳을 골라 선택하고 화면 가운데로 가져와요 */
function spSelect(nd, s, e) {
  ed.focus();
  const g = getSelection();
  g.setBaseAndExtent(nd, s, nd, e);
  nd.parentElement.scrollIntoView({ block: 'center', behavior: 'instant' });
}
function spStep(d) {
  if (!OPT.sp) {
    toast('글쓰기 도우미에서 맞춤법 검사를 켜 주세요.');
    return;
  }
  scan();
  if (!sph.length) {
    toast('맞춤법 오류가 없어요.');
    return;
  }
  const g = getSelection();
  let i;
  if (g.rangeCount && ed.contains(g.anchorNode)) {
    const r = g.getRangeAt(0),
      c = r.cloneRange(),
      col = r.collapsed;
    c.collapse(d < 0);
    const cmp = h => h.r.compareBoundaryPoints(Range.START_TO_START, c);
    if (d > 0) i = sph.findIndex(h => (col ? cmp(h) >= 0 : cmp(h) > 0));
    else {
      i = -1;
      sph.forEach((h, k) => {
        if (cmp(h) < 0) i = k;
      });
    }
  } else i = d > 0 ? 0 : sph.length - 1;
  if (i < 0) i = d > 0 ? 0 : sph.length - 1; /* 끝에 닿으면 처음(또는 끝)으로 돌아가요 */
  const h = sph[i];
  spSelect(h.nd, h.s, h.e);
  toast('맞춤법 ' + (i + 1) + ' / ' + sph.length + ' · ' + h.m.t + ' → ' + h.m.fix.trim());
  setTimeout(() => {
    const x = getSelection();
    if (x.rangeCount && x.anchorNode === h.nd && x.anchorOffset === h.s) ltShow(h);
  }, 180);
}
addEventListener('keydown', e => {
  if (app.dataset.v !== 'edit' || e.isComposing || e.ctrlKey || e.metaKey) return;
  const nx = (e.key === 'F8' && !e.shiftKey) || (e.altKey && e.code === 'BracketRight'),
    pv = (e.key === 'F8' && e.shiftKey) || (e.altKey && e.code === 'BracketLeft');
  if (nx || pv) {
    e.preventDefault();
    spStep(nx ? 1 : -1);
  }
});

/* 전체 오류 목록: 이 원고의 모든 화를 훑어요(글자 그대로이면 결과를 다시 쓰고, 새로 계산하지 않아요) */
let spOn = false;
function spAll() {
  const out = [];
  wk.chs.forEach(c => {
    if (c._lz) return; /* 본문을 아직 안 받은 화는 spLoad 가 받아 오면 다시 검사해요 */
    if (c._spk !== c.c) {
      c._spk = c.c;
      c._spv = spellText(c.c);
    }
    c._spv.forEach(m => {
      if (!SPI.has(m.t)) out.push({ c, m });
    });
  });
  return out;
}
/* 이 원고에서 본문을 아직 안 받은 화를 받아 와서 다시 그려요(패널을 열 때 · 다시 검사할 때) */
function spLoad() {
  const need = wk.chs.filter(c => c._lz),
    w = wk;
  if (!need.length) return;
  $('#spn').textContent = '맞춤법 · 화를 불러오는 중…';
  db.bodies(need)
    .then(() => {
      if (spOn && wk === w) spPaint();
    })
    .catch(() => {
      if (spOn && wk === w) {
        spPaint();
        toast('일부 화를 받지 못해서 받은 화만 검사했어요.');
      }
    });
}
function spPaint() {
  if (!spOn) return;
  const L = spAll(),
    box = $('#spl'),
    top = box.scrollTop,
    by = new Map();
  L.forEach(o => (by.get(o.c) || by.set(o.c, []).get(o.c)).push(o));
  $('#spn').textContent = L.length ? '맞춤법 ' + L.length + '곳' : '맞춤법';
  let n = 0;
  box.innerHTML = L.length
    ? [...by]
        .map(
          ([c, a]) =>
            `<li class="gh"><span>${c.n}화 ${esc(c.t) || '제목 없음'}</span><span>${a.length}곳</span></li>` +
            a
              .map(o =>
                n++ < 200
                  ? `<li><button type="button" data-c="${c.id}" data-i="${o.m.i}" data-s="${o.m.s}" data-t="${esc(o.m.t)}"><b>${esc(o.m.t)} → ${esc(o.m.fix.trim())}</b><small>${esc(o.m.x)}</small></button></li>`
                  : ''
              )
              .join('')
        )
        .join('') + (L.length > 200 ? `<li class="none">…외 ${L.length - 200}곳</li>` : '')
    : `<li class="none">${OPT.sp ? '틀린 표현이 없어요.' : '맞춤법 검사가 꺼져 있어도 목록은 볼 수 있어요.'}</li>`;
  box.scrollTop = top;
  const ig = $('#spi');
  ig.hidden = !SPI.size;
  ig.textContent = '이대로 둔 표현 ' + SPI.size + '개 · 모두 되돌리기';
}
function spPanel(on, back) {
  if (on) {
    fontPanel(false);
    memoPanel(false);
    closeFind();
    xMenu(false);
  }
  spOn = on;
  $('#spp').hidden = !on;
  $('#spb').setAttribute('aria-expanded', on);
  if (on) {
    spPaint();
    spLoad();
    $('#spr').focus();
  } else if (back) ed.focus();
}
$('#spb').onclick = () => spPanel($('#spp').hidden);
$('#spx').onclick = () => spPanel(false, true);
$('#spr').onclick = () => {
  wk.chs.forEach(c => (c._spk = null));
  spPaint();
  spLoad();
};
$('#spi').onclick = () => {
  SPI.clear();
  db.pref('ign', []);
  scan();
  toast('이대로 둔 표현을 모두 되돌렸어요.');
};
$('#spp').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    spPanel(false, true);
  }
});
/* 목록에서 고르면 그 화를 열고 해당 위치를 선택해요 */
$('#spl').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  const c = chs.find(x => x.id == b.dataset.c);
  if (!c) return;
  if (c !== cur) openCh(c);
  scan();
  const i = +b.dataset.i,
    s = +b.dataset.s,
    t = b.dataset.t;
  let nd = null,
    off = 0;
  const line = ed.children[i];
  if (line) {
    const w = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    let pos = 0,
      n;
    while ((n = w.nextNode())) {
      if (s < pos + n.data.length) {
        nd = n;
        off = s - pos;
        break;
      }
      pos += n.data.length;
    }
  }
  if (!nd || nd.data.substr(off, t.length) !== t) {
    /* 줄이 어긋났으면 본문에서 처음 나오는 곳으로 */
    nd = null;
    const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const k = n.data.indexOf(t);
      if (k > -1) {
        nd = n;
        off = k;
        break;
      }
    }
  }
  if (!nd) {
    toast('그 표현은 이미 고쳐졌어요.');
    spPaint();
    return;
  }
  spSelect(nd, off, off + t.length);
  const h = sph.find(x => x.nd === nd && x.s === off);
  if (h) setTimeout(() => ltShow(h), 180);
};

/* 오른쪽 도구 패널: 맞춤법·찾기·메모가 한 패널의 탭이에요. 각 패널의 hidden 이 바뀌면 패널과 탭 표시를 맞춰요 */
const RPS = { sp: '#spp', fd: '#fb', mm: '#mp' };
function rpSync() {
  const on = Object.keys(RPS).find(k => !$(RPS[k]).hidden);
  $('#rp').hidden = !on;
  $('#rpt')
    .querySelectorAll('button')
    .forEach(b => b.setAttribute('aria-pressed', b.dataset.p === on));
}
const rpMo = new MutationObserver(rpSync);
Object.values(RPS).forEach(s =>
  rpMo.observe($(s), { attributes: true, attributeFilter: ['hidden'] })
);
$('#rpt').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  const p = b.dataset.p;
  if (p === 'sp') spPanel(true);
  else if (p === 'fd') findBar(true);
  else memoPanel(true);
};
$('#rpx').onclick = () => {
  spPanel(false);
  memoPanel(false);
  findBar(false);
};
/* 도구줄 ⋯ 메뉴(메모 · 글자 크기 · 집중 모드) */
function xMenu(on) {
  $('#xmn').hidden = !on;
  $('#xm').setAttribute('aria-expanded', on);
}
$('#xm').onclick = () => {
  const o = $('#xmn').hidden;
  if (o) fontPanel(false);
  xMenu(o);
};
$('#xmn').onclick = e => {
  const b = e.target.closest('button');
  if (b && b.id !== 'fm' && b.id !== 'fp') xMenu(false);
};
document.addEventListener('click', e => {
  if ($('#xmn').hidden) return;
  const p = e.composedPath();
  if (!p.includes($('#xmn')) && !p.includes($('#xm'))) xMenu(false);
});
/* 화 상태·목표 줄은 요약 한 줄로 접어 두고, 누르면 펼쳐요 */
$('#cmt').onclick = () => {
  const o = $('#cmx').hidden;
  $('#cmx').hidden = !o;
  $('#cmt').setAttribute('aria-expanded', o);
};
