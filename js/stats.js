/* 집필 기록: 2주 막대 · 월 달력 · 연 히트맵, 그리고 요약(주간 목표·최고 기록·연속 기록) */
let rv = 'w',
  rmo = null,
  ry = null; /* rv: w(2주)·m(월)·y(연) / rmo: 보고 있는 달의 1일 / ry: 보고 있는 해 */
const WKD = ['월', '화', '수', '목', '금', '토', '일'],
  wdx = d => (d.getDay() + 6) % 7; /* 월요일 시작 */
const dv = d => wlog[dkey(d)] || 0;
const hl = v => {
  const g = GOALS[gi];
  return !v ? 0 : v < g * 0.25 ? 1 : v < g * 0.5 ? 2 : v < g ? 3 : 4;
}; /* 하루 목표 대비 농도 0~4 */
const mdk = d => d.getMonth() + 1 + '월 ' + d.getDate() + '일';
function sumR(a, b) {
  let s = 0,
    n = 0;
  for (const x = new Date(a); x <= b; x.setDate(x.getDate() + 1)) {
    const v = dv(x);
    s += v;
    if (v) n++;
  }
  return [s, n];
}
function bestStreak() {
  let b = 0,
    n = 0,
    p = null;
  for (const k of Object.keys(wlog)
    .filter(k => wlog[k] > 0)
    .sort()) {
    const t = new Date(k + 'T00:00:00');
    n = p && Math.round((t - p) / DAY) === 1 ? n + 1 : 1;
    if (n > b) b = n;
    p = t;
  }
  return b;
}
const ymd = k => {
  const [y, m, d] = k.split('-');
  return (+y === new Date().getFullYear() ? '' : y + '년 ') + +m + '월 ' + +d + '일';
};
function recSummary() {
  const t = day0(new Date()),
    mon = new Date(t);
  mon.setDate(t.getDate() - wdx(t));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const [ws, wn] = sumR(mon, sun),
    wg = GOALS[gi] * 7,
    [ms] = sumR(new Date(t.getFullYear(), t.getMonth(), 1), t),
    [ys] = sumR(new Date(t.getFullYear(), 0, 1), t);
  const days = Object.entries(wlog).filter(([, v]) => v > 0),
    top = days.reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0]),
    avg = days.length ? Math.round(days.reduce((s, [, v]) => s + v, 0) / days.length) : 0;
  const tile = (l, v, u, x = '') =>
    `<div class="rt"><small>${l}</small><b>${v}${u ? `<i>${u}</i>` : ''}</b>${x ? `<em>${x}</em>` : ''}</div>`;
  $('#rsum').innerHTML =
    `<div class="rt wide"><small>이번 주 <em>· 하루 목표 ${fmt(GOALS[gi])}자 × 7일</em></small><b>${fmt(ws)}<i> / ${fmt(wg)}자</i></b><span class="pg" role="img" aria-label="주간 목표 ${Math.round(Math.min(100, (ws / wg) * 100))}%"><i style="width:${Math.min(100, (ws / wg) * 100)}%"></i></span><em>${wn}일 썼어요${ws >= wg ? ' · 이번 주 목표를 채웠어요' : ''}</em></div>` +
    tile('가장 많이 쓴 날', fmt(top[1]), '자', top[0] ? ymd(top[0]) : '아직 기록이 없어요') +
    tile('최장 연속 집필', bestStreak(), '일', '지금 ' + streak() + '일째') +
    tile('이번 달', fmt(ms), '자') +
    tile('올해', fmt(ys), '자') +
    tile('쓴 날 평균', fmt(avg), '자', days.length + '일 기록');
}
const rnav = (label, prev, next, sub) =>
  `<div class="rnav"><button type="button" data-r="prev" aria-label="이전" ${prev ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><b>${label}</b><button type="button" data-r="next" aria-label="다음" ${next ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button><span>${sub}</span></div>`;
const legend =
  '<div class="rlg" aria-hidden="true"><span>적게</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>하루 목표 이상</span></div>';
function weeksView() {
  const t = new Date(),
    ds = [];
  for (let i = 13; i >= 0; i--) {
    const x = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i);
    ds.push({ x, v: dv(x) });
  }
  const mx = Math.max(GOALS[gi], ...ds.map(o => o.v));
  return (
    '<ul class="act">' +
    ds
      .map((o, i) => {
        const l = mdk(o.x),
          c = (i === 13 ? 'now ' : '') + (o.v ? '' : 'z');
        return `<li class="${c.trim()}" style="--i:${i}" title="${l} · ${fmt(o.v)}자"><span class="sr">${l} ${fmt(o.v)}자</span><span class="trk" aria-hidden="true"><i style="height:${o.v ? Math.max(4, (o.v / mx) * 100) : 0}%"></i></span><small aria-hidden="true">${o.x.getDate()}</small></li>`;
      })
      .join('') +
    '</ul>'
  );
}
function monthView() {
  const now = new Date(),
    m = rmo,
    y = m.getFullYear(),
    mo = m.getMonth(),
    first = new Date(y, mo, 1),
    n = new Date(y, mo + 1, 0).getDate(),
    [s, dn] = sumR(first, new Date(y, mo, n));
  let h =
    WKD.map(w => `<li class="wh" aria-hidden="true">${w}</li>`).join('') +
    '<li class="e" aria-hidden="true"></li>'.repeat(wdx(first));
  for (let d = 1; d <= n; d++) {
    const x = new Date(y, mo, d),
      v = dv(x),
      fut = x > now,
      l = `${mdk(x)} · ${fmt(v)}자`;
    h += `<li class="c l${hl(v)}${fut ? ' f' : ''}${dkey(x) === dkey(now) ? ' now' : ''}" title="${l}" aria-label="${l}"><span>${d}</span>${v ? `<small>${fmt(v)}</small>` : ''}</li>`;
  }
  return (
    rnav(
      y + '년 ' + (mo + 1) + '월',
      true,
      y < now.getFullYear() || mo < now.getMonth(),
      `합계 ${fmt(s)}자 · ${dn}일`
    ) +
    `<ul class="cal">${h}</ul>` +
    legend
  );
}
function yearView() {
  const now = new Date(),
    y = ry,
    jan1 = new Date(y, 0, 1),
    st = new Date(jan1);
  st.setDate(1 - wdx(jan1));
  const wk = Math.ceil(((new Date(y, 11, 31) - st) / DAY + 1) / 7),
    [s, dn] = sumR(jan1, new Date(y, 11, 31));
  let cells = '',
    mh = '',
    mt = Array(12).fill(0);
  for (let w = 0; w < wk; w++) {
    let lab = '';
    for (let r = 0; r < 7; r++) {
      const x = new Date(st);
      x.setDate(st.getDate() + w * 7 + r);
      if (x.getFullYear() !== y) {
        cells += '<li class="e" aria-hidden="true"></li>';
        continue;
      }
      const v = dv(x),
        fut = x > now,
        l = `${y}년 ${mdk(x)} · ${fmt(v)}자`;
      mt[x.getMonth()] += v;
      if (x.getDate() === 1) lab = x.getMonth() + 1 + '월';
      cells += `<li class="c l${hl(v)}${fut ? ' f' : ''}${dkey(x) === dkey(now) ? ' now' : ''}" title="${l}" aria-label="${l}"></li>`;
    }
    mh += `<span>${lab}</span>`;
  }
  const mx = Math.max(1, ...mt);
  const bars =
    '<ul class="ymo">' +
    mt
      .map(
        (v, i) =>
          `<li title="${y}년 ${i + 1}월 · ${fmt(v)}자"><span class="trk" aria-hidden="true"><i style="height:${v ? Math.max(4, (v / mx) * 100) : 0}%"></i></span><small>${i + 1}월</small><span class="sr">${y}년 ${i + 1}월 ${fmt(v)}자</span></li>`
      )
      .join('') +
    '</ul>';
  return (
    rnav(y + '년', true, y < now.getFullYear(), `합계 ${fmt(s)}자 · ${dn}일`) +
    `<div class="yh"><div class="ym" style="grid-template-columns:repeat(${wk},1fr)">${mh}</div><ul class="yg" style="grid-template-columns:repeat(${wk},1fr)">${cells}</ul></div>` +
    legend +
    '<h4 class="rh">월별 합계</h4>' +
    bars
  );
}
function activity() {
  const t = new Date();
  if (!rmo) rmo = new Date(t.getFullYear(), t.getMonth(), 1);
  if (ry === null) ry = t.getFullYear();
  $('#rtab')
    .querySelectorAll('button')
    .forEach(b => b.setAttribute('aria-pressed', b.dataset.rv === rv));
  recSummary();
  $('#rbody').innerHTML = rv === 'm' ? monthView() : rv === 'y' ? yearView() : weeksView();
  const s = streak();
  $('#stk').textContent = s ? s + '일 연속 집필' : '연속 기록이 없어요';
}
$('#rec').addEventListener('click', e => {
  const tb = e.target.closest('[data-rv]');
  if (tb) {
    rv = tb.dataset.rv;
    activity();
    return;
  }
  const b = e.target.closest('[data-r]');
  if (!b || b.disabled) return;
  const d = b.dataset.r === 'next' ? 1 : -1;
  if (rv === 'm') rmo = new Date(rmo.getFullYear(), rmo.getMonth() + d, 1);
  else ry += d;
  activity();
  const nb =
    $('#rbody [data-r="' + b.dataset.r + '"]:not(:disabled)') ||
    $('#rbody [data-r]:not(:disabled)');
  nb && nb.focus();
});
