const gate = $('#gate');
const login = (() => {
  const lg = $('#lg'),
    f = $('#gate form'),
    id = f.elements.username,
    pw = f.elements.pw,
    pw2 = f.elements.pw2,
    msg = $('#gm'),
    go1 = $('#go1'),
    go2 = $('#go2'),
    eye = $('#gate .eye'),
    big = $('#big'),
    pwe = $('#pwe'),
    left = $('#gate .left'),
    s1 = $('#gate .s1'),
    s2 = $('#gate .s2');
  const ph = w =>
    '<span class="ph">' + [...w].map((c, k) => `<i style="--i:${k}">${c}</i>`).join('') + '</span>';
  const validId = v => /^[A-Za-z0-9._-]{4,20}$/.test(v.trim());
  function tick() {
    const t = new Date();
    $('#gdt').textContent = t.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    $('#gtm').textContent = t.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 20000);
  const meas = document.createElement('span');
  meas.style.cssText =
    'position:absolute;left:-9999px;visibility:hidden;white-space:nowrap;font:800 100px/1 Archivo,sans-serif;letter-spacing:-.02em;text-transform:uppercase';
  document.body.appendChild(meas);
  function fit() {
    const K = 1.15;
    meas.textContent = big.textContent;
    let w = meas.offsetWidth || 1;
    if (pwe.textContent) {
      meas.textContent = pwe.textContent;
      w = Math.max(w, (meas.offsetWidth || 1) * K);
    }
    const size = Math.max(14, Math.min((big.clientWidth / w) * 98, 360, innerHeight * 0.4));
    big.style.fontSize = size + 'px';
    pwe.style.fontSize = size * K + 'px';
  }
  function echoId() {
    const v = id.value.trim().toUpperCase().slice(0, 40);
    big.innerHTML = v
      ? [...v].map((c, i) => (i === v.length - 1 ? '<i>' + esc(c) + '</i>' : esc(c))).join('')
      : ph(f.classList.contains('join') ? 'ECHO' : 'LIBRARY');
    fit();
  }
  function echoPw() {
    const n = Math.min(pw.value.length, 60);
    pwe.innerHTML = n ? '*'.repeat(n - 1) + '<i>*</i>' : '';
    fit();
  }
  addEventListener('resize', fit);
  if (document.fonts) document.fonts.ready.then(fit);
  echoId();
  const setStep = two => {
    f.classList.toggle('two', two);
    s1.inert = two;
    s2.inert = !two;
  };
  const showPw = show => {
    pw.type = pw2.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', show);
    eye.setAttribute('aria-label', show ? '암호 숨기기' : '암호 보기');
  };
  const clearInvalid = () => [id, pw, pw2].forEach(i => i.removeAttribute('aria-invalid'));
  function fail(el, text) {
    el.setAttribute('aria-invalid', 'true');
    msg.textContent = text;
    f.classList.remove('err');
    void f.offsetWidth;
    f.classList.add('err');
    el.focus();
  }
  function advance() {
    if (!validId(id.value))
      return fail(
        id,
        id.value ? '아이디는 영문, 숫자, . _ - 로 4~20자여야 해요.' : '아이디를 입력해 주세요.'
      );
    msg.textContent = '';
    $('#who2').textContent = id.value.trim();
    setStep(true);
    setTimeout(() => pw.focus(), 500);
  }
  function back() {
    setStep(false);
    pw.value = pw2.value = '';
    clearInvalid();
    msg.textContent = '';
    echoPw();
    setTimeout(() => id.focus(), 300);
  }
  function reset() {
    lg.classList.remove('ok');
    f.classList.remove('load', 'err');
    f.reset();
    setStep(false);
    clearInvalid();
    showPw(false);
    msg.textContent = '';
    go1.disabled = go2.disabled = false;
    setJoin(false);
  }
  function ripple(n, t0) {
    const b = big.getBoundingClientRect(),
      l = left.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const g = big.cloneNode(true);
      g.removeAttribute('id');
      g.className = 'big ghost';
      g.setAttribute('aria-hidden', 'true');
      g.style.cssText = `left:${b.left - l.left}px;top:${b.top - l.top}px;width:${b.width}px;height:${b.height}px;font-size:${big.style.fontSize};animation-delay:${t0 + i * 0.24}s`;
      left.appendChild(g);
      setTimeout(() => g.remove(), 2400);
    }
  }
  function setJoin(on, play) {
    f.classList.toggle('join', on);
    id.placeholder = on ? '사용할 아이디' : '아이디';
    pw.placeholder = on ? '암호 (6자 이상)' : '암호 입력';
    pw.autocomplete = on ? 'new-password' : 'current-password';
    setStep(false);
    pw.value = pw2.value = '';
    clearInvalid();
    msg.textContent = '';
    showPw(false);
    echoId();
    echoPw();
    if (play) {
      lg.classList.add('swap');
      setTimeout(() => lg.classList.remove('swap'), 1300);
      ripple(1, 0);
    }
  }
  const celebrate = () => {
    lg.classList.add('ok');
    ripple(3, 0.15);
  };
  function intro() {
    setTimeout(() => {
      if (!id.value) ripple(1, 0);
    }, 1100);
    setTimeout(() => lg.classList.remove('intro'), 3300);
  }
  f.addEventListener('input', e => {
    if (e.target.type === 'checkbox') return;
    e.target.removeAttribute('aria-invalid');
    msg.textContent = '';
    if (e.target === id) echoId();
    else if (e.target === pw) echoPw();
  });
  id.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      advance();
    }
  });
  $('#next').onclick = advance;
  pw.addEventListener('keydown', e => {
    if (e.key === 'Enter' && f.classList.contains('join')) {
      e.preventDefault();
      pw.value.length < 6
        ? fail(pw, pw.value ? '암호는 6자 이상이어야 해요.' : '암호를 입력해 주세요.')
        : pw2.focus();
    }
  });
  $('#tojoin').onclick = e => {
    e.preventDefault();
    setJoin(true, true);
    id.focus();
  };
  $('#tologin').onclick = e => {
    e.preventDefault();
    setJoin(false, true);
    id.focus();
  };
  $('#gate .chg').onclick = back;
  eye.onclick = () => showPw(pw.type === 'password');
  f.querySelectorAll('a:not([id])').forEach(
    a =>
      (a.onclick = e => {
        e.preventDefault();
        msg.textContent = a.textContent + ' 기능은 아직 지원하지 않아요.';
      })
  );
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (!f.classList.contains('two')) return advance();
    if (f.classList.contains('load')) return;
    if (pw.value.length < 6)
      return fail(pw, pw.value ? '암호는 6자 이상이어야 해요.' : '암호를 입력해 주세요.');
    const join = f.classList.contains('join');
    if (join && pw2.value !== pw.value) return fail(pw2, '암호가 서로 달라요.');
    const go = join ? go2 : go1,
      name = id.value.trim(),
      rm = f.elements.rm.checked;
    f.classList.add('load');
    go.disabled = true;
    go.setAttribute('aria-busy', 'true');
    const idle = () => {
      f.classList.remove('load');
      go.disabled = false;
      go.removeAttribute('aria-busy');
    };
    let user;
    try {
      user = await (join ? account.signUp : account.signIn)(name, pw.value, rm);
    } catch (er) {
      idle();
      if (er.k === 'taken') {
        setStep(false);
        pw.value = pw2.value = '';
        echoPw();
        return fail(id, er.t);
      }
      if (er.k === 'bad') {
        fail(pw, er.t);
        pw.select();
        return;
      }
      return fail(pw, er.t || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.');
    }
    try {
      hydrate(await db.load());
    } catch (er) {
      console.error('[meari] 데이터 불러오기 실패', er);
      idle();
      await account.signOut();
      return fail(pw, '내 원고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    idle();
    const shown = user.username;
    authStore.setItem(
      'meari-user',
      JSON.stringify(shown)
    ); /* 다음 방문 때 첫 화면 깜빡임을 줄이는 표시용 */
    arrive(shown);
  });
  return { intro, celebrate, reset, focus: () => id.focus({ preventScroll: true }) };
})();
function arrive(user) {
  setUser(user);
  setTheme(true);
  login.celebrate();
  setTimeout(() => {
    app.classList.add('arrive');
    gate.classList.add('away');
    setTimeout(() => {
      app.inert = false;
      gate.classList.add('fade');
    }, 950);
    setTimeout(() => {
      gate.hidden = true;
    }, 1450);
    settle();
  }, 1250);
}
/* 로그인 화면으로 돌아가기(나가기 버튼, 세션 만료 공통) */
function showGate() {
  app.inert = true;
  gate.hidden = false;
  login.reset();
  gate.classList.remove('fade');
  void gate.offsetWidth;
  gate.classList.remove('away');
  setTimeout(() => {
    setTheme(false);
    resetState();
    view('home');
    app.classList.remove('arrive');
    login.focus();
  }, 1000);
}
let leaving = false;
async function leave() {
  if (leaving) return;
  leaving = true;
  try {
    if (cur) {
      clearTimeout(timer);
      save();
    }
    try {
      await db.flush();
    } catch (e) {
      if (
        !confirm('아직 서버에 저장되지 못한 글이 있어요. 그래도 나갈까요? 나가면 이 글은 사라져요.')
      )
        return;
    }
    if (db.problem() || (cur && (cur._over || cur._cf))) {
      if (
        !confirm('저장하지 못한 글이 있어요. 그래도 나갈까요? (글은 이 브라우저에 백업돼 있어요)')
      )
        return;
    }
    await account.signOut();
    showGate();
  } finally {
    leaving = false;
  }
}
$('#out').onclick = leave;
db.on(s => {
  /* 저장하려는데 로그인이 만료됐을 때(60일 지남, 다른 곳에서 로그아웃 등) */
  if (s === 'expired' && !leaving && !app.inert) {
    authStore.removeItem('meari-token');
    authStore.removeItem('meari-user');
    showGate();
    toast('로그인이 풀렸어요. 다시 로그인해 주세요.');
  }
});
