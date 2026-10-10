/* 메아리 ↔ 서버(Supabase Edge Function `meari-api`) 통신 계층.
   화면 코드는 메모리 상태(chs, LORE, memos …)를 그대로 쓰고, 바뀔 때마다 db.* 로 알려 서버에 반영해요.
   저장은 순서대로 한 건씩 보내고, 실패하면 간격을 늘려 가며(2→30초) 성공할 때까지 다시 시도해요(큐가 남아 있는 동안 창을 닫으려 하면 경고).
   화 본문은 로그인 때 받지 않고 열 때 받아요(db.bodies). 본문을 받기 전의 화는 c._lz 가 true 이고 저장하지 않아요. */

/* ── 로그인 토큰 저장소: '기억하기'를 켰으면 localStorage, 아니면 이 탭(sessionStorage)에만 ── */
const authStore = (() => {
  const g = (s, k) => {
    try {
      return s.getItem(k);
    } catch (e) {
      return null;
    }
  };
  const rm = () => g(localStorage, 'meari-rm') === '1';
  return {
    getItem: k => g(sessionStorage, k) ?? g(localStorage, k),
    setItem: (k, v) => {
      try {
        (rm() ? localStorage : sessionStorage).setItem(k, v);
      } catch (e) {}
    },
    removeItem: k => {
      try {
        localStorage.removeItem(k);
      } catch (e) {}
      try {
        sessionStorage.removeItem(k);
      } catch (e) {}
    },
  };
})();

const API =
  typeof SB_URL === 'string' && /^https?:\/\//.test(SB_URL) && !/YOUR/i.test(SB_URL)
    ? SB_URL.replace(/\/+$/, '') + '/functions/v1/meari-api'
    : null;
if (!API) console.warn('[meari] 서버 주소가 비어 있어요. js/config.js 의 SB_URL 을 채워 주세요.');
const ERR = {
  bad: '아이디 또는 암호가 일치하지 않아요. 다시 확인해 주세요.',
  taken: '이미 사용 중인 아이디예요.',
  rate: '시도가 너무 많아요. 잠시 후 다시 시도해 주세요.',
  invalid: '아이디 또는 암호 형식이 올바르지 않아요.',
  unauth: '로그인이 풀렸어요. 다시 로그인해 주세요.',
  big: '내용이 너무 커서 처리할 수 없어요.',
  net: '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
  cfg: '서버 설정이 필요해요. js/config.js 를 확인해 주세요.',
  server: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
};
/* 서버 호출. 실패하면 {k:코드, t:화면용 문장, status} 를 던져요 */
let KA = false; /* 탭을 닫거나 숨기는 중이면 true — 이때 보내는 저장 요청은 keepalive 로 보내서 페이지가 사라져도 끝까지 가요 */
async function api(op, body) {
  if (!API) throw { k: 'cfg', t: ERR.cfg, status: 0 };
  let r;
  const payload = JSON.stringify({
    op,
    token: authStore.getItem('meari-token') || undefined,
    ...body,
  });
  const ka =
    KA &&
    new TextEncoder().encode(payload).length <
      60000; /* keepalive 요청은 본문 64KB 까지만 허용돼요 */
  try {
    r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: ka,
    });
  } catch (e) {
    throw { k: 'net', t: ERR.net, status: 0 };
  }
  let j = null;
  try {
    j = await r.json();
  } catch (e) {}
  if (r.ok && j && j.ok) return j;
  const k = (j && j.code) || 'server';
  throw { k, t: ERR[k] || ERR.server, status: r.status, data: j };
}

/* ── 계정: 아이디 + 암호. 이메일은 쓰지 않아요 ── */
const account = {
  async signIn(name, pw, rm) {
    return enter(await api('login', { username: name, password: pw }), rm);
  },
  async signUp(name, pw, rm) {
    return enter(await api('signup', { username: name, password: pw }), rm);
  },
  async signOut() {
    try {
      await api('logout');
    } catch (e) {}
    authStore.removeItem('meari-token');
    authStore.removeItem('meari-user');
    try {
      localStorage.removeItem('meari-rm');
    } catch (e) {}
  },
};
function enter(j, rm) {
  try {
    localStorage.setItem('meari-rm', rm ? '1' : '0');
  } catch (e) {}
  authStore.removeItem('meari-token');
  authStore.setItem('meari-token', j.token);
  return j.user;
}

/* ── 데이터 ── */
const db = (() => {
  let on = false,
    q = [],
    busy = false,
    fails = 0,
    retryT = null,
    retryAt = 0,
    subs = [],
    prefs = {},
    dirty = new Set() /* 아직 서버에 못 보낸 설정 키 */,
    rej = new Map(); /* 저장하지 못해 남은 항목(키 → 'rejected'|'conflict') */
  const emit = s => subs.slice().forEach(f => f(s));
  const iso = t => new Date(t || Date.now()).toISOString();
  const chunk = (a, n) => {
    const r = [];
    for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n));
    return r;
  };
  /* 한 번에 50건·약 1.5MB 까지만 보내요(서버 한도는 50건·3MB). 많거나 큰 본문은 나눠서 순서대로 보내요 */
  const pack = (a, max = 50) => {
    const out = [];
    let c = [],
      n = 0;
    for (const o of a) {
      const s = JSON.stringify(o).length;
      if (c.length && (c.length >= max || n + s > 1.5e6)) {
        out.push(c);
        c = [];
        n = 0;
      }
      c.push(o);
      n += s;
    }
    if (c.length) out.push(c);
    return out;
  };
  const w = ops =>
    ops.length
      ? pack(ops).reduce((p, c) => p.then(() => api('write', { ops: c })), Promise.resolve())
      : null;
  const wkOf = id => WORKS.find(x => x.id === id);

  /* 재시도: 실패하면 2·4·8·15·30초(±20%) 간격으로, 30초 간격을 유지하며 성공할 때까지 계속 다시 보내요.
     기다리는 동안 새 저장이 들어와도 대기열에 합치기만 하고(바로 보내지 않아요) 타이머가 보내요 → 입력할 때마다 서버를 두드리거나 오류 알림이 반복되지 않아요.
     연결이 끊겨 있으면(navigator.onLine === false) 타이머 없이 online 이벤트를 기다려요. 'error' 알림은 연속 3번째 실패에서 한 번만 보내요 */
  const BACKOFF = [2000, 4000, 8000, 15000, 30000];
  const waitMs = n =>
    Math.round(BACKOFF[Math.min(n - 1, BACKOFF.length - 1)] * (0.8 + Math.random() * 0.4));
  const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
  const stopRetry = () => {
    clearTimeout(retryT);
    retryT = null;
    retryAt = 0;
  };
  function run() {
    if (busy || !q.length || !on || retryT) return;
    if (fails && offline()) return; /* 연결이 돌아오면 online 이벤트가 이어서 보내요 */
    busy = true;
    emit('saving');
    const it = q[0];
    Promise.resolve()
      .then(it.fn)
      .then(() => {
        rej.delete(it.key);
        q.shift();
        fails = 0;
        busy = false;
        q.length ? run() : emit('saved');
      })
      .catch(e => {
        busy = false;
        if (e && e.status === 401) {
          q = [];
          on = false;
          stopRetry();
          fails = 0;
          emit('expired');
          return;
        } /* 로그인이 풀림 */
        if (e && e.status === 409 && e.data && e.data.srv) {
          /* 다른 곳에서 먼저 바뀜: 덮어쓰지 않고 사용자가 고르게 해요 */
          q.shift();
          rej.set(it.key, 'conflict');
          try {
            it.meta && it.meta.onConflict && it.meta.onConflict(e.data.srv);
          } catch (x) {
            console.error(x);
          }
          emit('conflict');
          q.length ? run() : emit('saved');
          return;
        }
        if (e && e.local) {
          /* 이 기기 코드의 문제(예: 본문을 아직 받지 않은 화): 다시 보내도 소용없어요 */
          console.error('[meari] 저장 항목을 건너뛰어요', e);
          q.shift();
          q.length ? run() : emit('saved');
          return;
        }
        if (e && (e.status === 400 || e.status === 413)) {
          /* 다시 보내도 소용없는 내용은 대기열에서 빼되, 저장 못 한 항목으로 계속 표시해요 */
          console.error('[meari] 저장할 수 없는 내용', e);
          q.shift();
          rej.set(it.key, 'rejected');
          try {
            it.meta && it.meta.onReject && it.meta.onReject();
          } catch (x) {
            console.error(x);
          }
          emit('rejected');
          q.length ? run() : emit('saved');
          return;
        }
        console.error('[meari] 저장 실패', e);
        fails++;
        if (fails === 3) emit('error'); /* 알림은 한 번만. 이후에도 계속 다시 시도해요 */
        if (offline()) {
          emit('offline');
          return;
        } /* 타이머 대신 online 이벤트를 기다려요 */
        const ms = waitMs(fails);
        retryAt = Date.now() + ms;
        retryT = setTimeout(() => {
          retryT = null;
          retryAt = 0;
          run();
        }, ms);
        emit('retry');
      });
  }
  /* 기다리지 않고 지금 바로 다시 보내요(버튼 · 온라인 복귀 · 탭을 닫거나 숨길 때) */
  function retryNow() {
    stopRetry();
    run();
  }
  /* fn 은 실행 시점의 최신 상태를 읽어요. 같은 키가 대기열 끝에 있으면 한 번만 보내면 돼서 합쳐요 */
  function enqueue(key, fn, meta) {
    if (!on) return;
    const t = q[q.length - 1];
    if (!(t && t.key === key && !(busy && q.length === 1))) q.push({ key, fn, meta });
    run(); /* 실패 후 기다리는 중이면 run 이 알아서 돌아가요(타이머가 보내요) */
  }
  addEventListener('online', () => {
    fails = 0;
    retryNow();
  });
  addEventListener('offline', () => {
    if (q.length || busy) emit('offline');
  });
  /* 창을 닫거나 앱이 내려갈 때: 쉬고 있는 큐를 바로 보내요(keepalive). 다시 보이면 평소대로 */
  const urgent = () => {
    KA = true;
    if (on && !busy && q.length) retryNow();
  };
  addEventListener('pagehide', urgent);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) urgent();
    else KA = false;
  });

  const rowWk = W => ({ id: W.id, title: W.t, pos: W.pos });
  /* base: 이 화를 마지막으로 읽거나 저장했을 때 서버가 알려 준 수정 시각(c._v). 서버에서 그 사이 바뀌었으면 덮어쓰지 않고 충돌로 돌려줘요. fresh 면 검사 없이 저장 */
  /* 본문을 아직 받지 않은 화(_lz)는 절대 보내지 않아요: 빈 본문으로 서버 글을 덮어쓰게 되니까요. chars·chars_s 는 목록에 보여 줄 글자 수(서버가 그대로 저장해요) */
  const rowCh = (c, i, fresh) => {
    if (c._lz) throw { local: true, t: '본문을 아직 받지 않은 화예요.' };
    return {
      id: c.id,
      n: c.n,
      title: c.t,
      body: c.c,
      pos: i,
      work_id: c.w,
      status: c.s || 'draft',
      goal: c.g || 0,
      chars: raw(c.c),
      chars_s: nsp(c.c),
      base: fresh ? null : c._v || null,
    };
  };
  /* 같은 브라우저의 다른 탭에 방금 저장한 화를 알려요(다른 탭에서 쓰던 글이 옛 버전으로 남지 않게) */
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('meari-sync') : null,
    syncSubs = [];
  if (bc) bc.onmessage = e => syncSubs.forEach(f => f(e.data));
  const tell = c => {
    try {
      if (bc && c._v) bc.postMessage({ u: uname, id: c.id, at: c._v, t: c.t, c: c.c });
    } catch (e) {}
  };
  const rowLo = (k, x) => ({
    kind: k,
    id: x.id,
    cat: x.c,
    title: x.t,
    body: x.b,
    pos: x.p || 0,
    work_id: x.w,
    links: x.l || [],
    ev_date: x.d || '',
    img: x.i || '',
    map_x: x.mx ?? null,
    map_y: x.my ?? null,
  });

  /* 처음 가입한 계정에 넣어 줄 기본 내용: 빈 1화 하나가 든 '새 원고' */
  async function seed() {
    const id = Date.now(),
      W = {
        id,
        t: '새 원고',
        pos: 0,
        at: Date.now(),
        chs: SEED_CHS.map((c, i) => ({ ...c, id: id + 1 + i, w: id, _sig: c.t + '\0' + c.c })),
        world: [],
        codex: [],
      },
      memos0 = SEED_MEMOS.map((m, i) => ({ id: i + 1, t: m, at: Date.now() - 864e5 }));
    await api('write', {
      ops: [
        { t: 'wk', rows: [rowWk(W)] },
        { t: 'ch', rows: W.chs.map((c, i) => rowCh(c, i, 1)) },
        ...(memos0.length
          ? [{ t: 'me', rows: memos0.map(m => ({ id: m.id, t: m.t, at: iso(m.at) })) }]
          : []),
        { t: 'prefs-merge', data: { cur: id } } /* 마지막에 넣어서 "준비 끝" 표시로 씀 */,
      ],
    });
    return { works: [W], memos: memos0, wlog: {}, prefs: { cur: id }, lastEdit: 0 };
  }

  return {
    on: f => {
      subs.push(f);
    },
    pending: () => q.length > 0 || busy,
    problem: () =>
      rej.size
        ? [...rej.values()].includes('conflict')
          ? 'conflict'
          : 'rejected'
        : '' /* 저장하지 못해 남은 항목이 있으면 이유를 돌려줘요 */,
    clear(key) {
      rej.delete(key);
      emit(q.length || busy ? 'saving' : 'saved');
    },
    onSync: f => {
      syncSubs.push(f);
    },
    /* 로그인 직후 한 번: 내 데이터를 전부 읽어 와요. 처음이면 기본 내용을 채워요. 로그인 토큰이 없거나 만료면 던져요 */
    async load() {
      q = [];
      busy = false;
      fails = 0;
      stopRetry();
      const j = await api('load');
      on = true;
      /* 정말 빈 계정(설정도, 원고·화·설정집도 없음)일 때만 기본 내용을 채워요. 가입 직후 seed 가 중간에 끊겼거나 설정 행만 없는 경우엔 있는 글을 그대로 쓰고, 빠진 것은 아래에서 채워요 */
      const empty = !j.settings && !(j.works || []).length && !j.chapters.length && !j.lore.length;
      if (empty) {
        const d = await seed();
        prefs = d.prefs;
        return { ...d, user: j.user };
      }
      prefs = (j.settings && j.settings.data) || {};
      const wlog = {};
      j.log.forEach(r => {
        wlog[r.day] = r.chars;
      });
      const ws = (j.works || []).map(r => ({
        id: r.id,
        t: r.title,
        pos: r.pos,
        at: new Date(r.updated_at).getTime() || 0,
        chs: [],
        world: [],
        codex: [],
      }));
      /* 원고 여러 개 기능이 생기기 전에 쓴 글(work_id 0)은 첫 원고로 옮겨 담아요 */
      if (j.chapters.some(r => !r.work_id) || j.lore.some(r => !r.work_id)) {
        let W = ws[0];
        if (!W) {
          W = {
            id: Date.now(),
            t: typeof prefs.title === 'string' && prefs.title ? prefs.title : '새 원고',
            pos: 0,
            at: 0,
            chs: [],
            world: [],
            codex: [],
          };
          ws.push(W);
        }
        await api('write', {
          ops: [
            { t: 'wk', rows: [rowWk(W)] },
            { t: 'wk-adopt', id: W.id },
          ],
        });
        j.chapters.forEach(r => {
          if (!r.work_id) r.work_id = W.id;
        });
        j.lore.forEach(r => {
          if (!r.work_id) r.work_id = W.id;
        });
      }
      const by = new Map(ws.map(W => [W.id, W]));
      /* 화는 목록·요약만 와요(본문은 열 때 db.bodies 로 받아요). 그동안 c.c 는 빈 글이고 글자 수는 서버가 센 값(_rv·_sv)을 써요.
         예전 서버(본문까지 보내는 쪽)와 함께 써도 되게, body 가 같이 오면 그대로 읽어 온 화로 다뤄요 */
      j.chapters.forEach(r => {
        const W = by.get(r.work_id);
        if (!W) return;
        const full = typeof r.body === 'string',
          c = {
            id: r.id,
            n: r.n,
            t: r.title,
            c: full ? r.body : '',
            s: r.status || 'draft',
            g: r.goal || 0,
            w: W.id,
            _sig: full ? r.title + '\0' + r.body : null,
            _v: r.updated_at,
          };
        if (!full) {
          c._lz = true;
          c._h = r.head || '';
          c._rk = '';
          c._rv = r.chars | 0;
          c._sk = '';
          c._sv = r.chars_s | 0;
        }
        W.chs.push(c);
        W.at = Math.max(W.at, new Date(r.updated_at).getTime() || 0);
      });
      j.lore.forEach(r => {
        const W = by.get(r.work_id);
        if (W)
          W[r.kind].push({
            id: r.id,
            c: r.cat,
            t: r.title,
            b: r.body,
            p: r.pos,
            w: W.id,
            l: Array.isArray(r.links) ? r.links : [],
            d: r.ev_date || '',
            i: r.img || '',
            mx: r.map_x ?? null,
            my: r.map_y ?? null,
          });
      });
      if (!ws.length) {
        const W = { id: Date.now(), t: '새 원고', pos: 0, at: 0, chs: [], world: [], codex: [] };
        ws.push(W);
        await api('write', { ops: [{ t: 'wk', rows: [rowWk(W)] }] });
      }
      for (const W of ws) {
        W.world.sort((a, b) => a.p - b.p);
        W.codex.sort((a, b) => a.p - b.p);
        if (!W.chs.length) {
          const c = {
            id: Date.now() + Math.floor(Math.random() * 1e3),
            n: 1,
            t: '',
            c: '',
            w: W.id,
            _sig: '\0',
          };
          W.chs.push(c);
          await api('write', { ops: [{ t: 'ch', rows: [rowCh(c, 0)] }] });
        } /* 화가 하나도 없는 원고는 빈 1화를 만들어 둠 */
        if (!W.at) W.at = Date.now();
      }
      ws.sort((a, b) => a.pos - b.pos);
      return {
        user: j.user,
        works: ws,
        memos: j.memos.map(r => ({ id: r.id, t: r.t, at: new Date(r.at).getTime() })),
        wlog,
        prefs,
        lastEdit: ws.reduce((m, W) => Math.max(m, W.at), 0),
      };
    },
    /* 로그아웃 때: 대기 중인 저장이 모두 끝날 때까지 기다려요(실패하면 reject) */
    flush() {
      return new Promise((res, rej) => {
        if (!q.length && !busy) return res();
        const f = s => {
          if (s === 'saved' || s === 'error' || s === 'expired' || s === 'offline') {
            subs = subs.filter(x => x !== f);
            s === 'saved' ? res() : rej(new Error('save'));
          }
        };
        subs.push(f);
        fails = 0;
        retryNow();
      });
    },
    reset() {
      on = false;
      q = [];
      busy = false;
      fails = 0;
      stopRetry();
      prefs = {};
      dirty.clear();
      rej.clear();
    },
    /* 저장 상태: fails 연속 실패 수 · next 다음 재시도 시각(ms, 없으면 0) · offline 연결이 끊겨 기다리는 중 · queued 보낼 항목 수 */
    state: () => ({
      fails,
      next: retryAt,
      offline: fails > 0 && offline(),
      queued: q.length + (busy ? 1 : 0),
    }),
    retryNow,
    /* 본문을 아직 받지 않은 화들의 본문을 받아 채워요(10개씩). 이미 받는 중이면 그 요청을 기다려요. 못 받으면 던져요 */
    bodies(cs) {
      const need = cs.filter(c => c._lz),
        fresh = need.filter(c => !c._lp);
      for (let i = 0; i < fresh.length; i += 10) {
        const part = fresh.slice(i, i + 10);
        const p = api('body', { ids: part.map(c => c.id) })
          .then(j => {
            const by = new Map((j.chapters || []).map(r => [r.id, r]));
            for (const c of part) {
              const r = by.get(c.id);
              if (!r || !c._lz) continue; /* 이미 다른 경로로 채워졌으면 그대로 둬요 */
              c.c = r.body;
              c._sig = r.title + '\0' + r.body;
              c._v = r.updated_at;
              c._lz = false;
              c._rk = null;
              c._sk = null;
            }
            if (part.some(c => c._lz))
              throw {
                k: 'gone',
                t: '서버에서 이 화를 찾지 못했어요. 다른 곳에서 지웠을 수 있어요.',
                status: 404,
              };
          })
          .finally(() =>
            part.forEach(c => {
              c._lp = null;
            })
          );
        part.forEach(c => {
          c._lp = p;
        });
      }
      return Promise.all(need.map(c => c._lp));
    },

    /* 원고(작품) — 만들기·제목 바꾸기, 통째로 삭제(화·세계관·설정집 포함)와 되돌리기 */
    work(W) {
      enqueue('wk:' + W.id, () => (WORKS.includes(W) ? w([{ t: 'wk', rows: [rowWk(W)] }]) : null));
    },
    delWork(id) {
      enqueue('delwk:' + id + ':' + Date.now(), () => w([{ t: 'wk-del', id }]));
    },
    restoreWork(W) {
      enqueue('restore:' + W.id + ':' + Date.now(), () =>
        w([
          { t: 'wk', rows: [rowWk(W)] },
          ...pack(
            W.chs.map((c, i) => {
              c._v = null;
              return rowCh(c, i, 1);
            })
          ).map(rows => ({ t: 'ch', rows })),
          ...pack([
            ...W.world.map(x => rowLo('world', x)),
            ...W.codex.map(x => rowLo('codex', x)),
          ]).map(rows => ({ t: 'lo', rows })),
        ])
      );
    },

    /* 화 본문 저장. 성공하면 서버가 준 새 수정 시각을 기억하고, 같은 브라우저의 다른 탭에도 알려요 */
    chapter(c) {
      if (c._cf || c._lz)
        return; /* 충돌을 해결하기 전 · 본문을 아직 받지 않은 화는 보내지 않아요 */
      enqueue(
        'ch:' + c.id,
        () => {
          const W = wkOf(c.w);
          if (!(W && W.chs.includes(c))) return null;
          return w([{ t: 'ch', rows: [rowCh(c, W.chs.indexOf(c))] }]).then(j => {
            const at = j && j.res && j.res[0] && j.res[0][0];
            if (at) {
              c._v = at;
              tell(c);
            }
            if (c._bak) {
              c._bak = 0;
              try {
                localStorage.removeItem('meari-bak:' + c.id);
              } catch (e) {}
            }
          });
        },
        { onConflict: srv => chConflict(c, srv), onReject: () => chRejected(c) }
      );
    },
    chapters(W) {
      enqueue('chs:' + W.id, () =>
        WORKS.includes(W)
          ? w(
              chunk(
                W.chs.map((c, i) => ({
                  id: c.id,
                  n: c.n,
                  title: c.t,
                  pos: i,
                  work_id: W.id,
                  status: c.s || 'draft',
                  goal: c.g || 0,
                })),
                200
              ).map(rows => ({ t: 'ch-meta', rows }))
            )
          : null
      );
    } /* 번호·제목·순서(본문 제외) */,
    delChapter(id) {
      enqueue('delch:' + id, () => w([{ t: 'ch-del', id }]));
    },

    lore(k, x) {
      enqueue('lo:' + k + ':' + x.id, () => {
        const W = wkOf(x.w);
        return W && W[k].includes(x) ? w([{ t: 'lo', rows: [rowLo(k, x)] }]) : null;
      });
    },
    delLore(k, id) {
      enqueue('dello:' + k + ':' + id, () => w([{ t: 'lo-del', kind: k, id }]));
    },

    memoAdd(m) {
      enqueue('me:' + m.id, () => w([{ t: 'me', rows: [{ id: m.id, t: m.t, at: iso(m.at) }] }]));
    },
    memoDel(id) {
      enqueue('delme:' + id, () => w([{ t: 'me-del', id }]));
    },

    log(d) {
      enqueue('log:' + d, () => w([{ t: 'log', day: d, chars: wlog[d] || 0 }]));
    },

    /* 설정은 바뀐 키만 보내요. 서버가 기존 설정에 합치므로 다른 기기에서 바꾼 다른 키는 지워지지 않아요 */
    pref(k, v) {
      prefs[k] = v;
      dirty.add(k);
      enqueue('prefs', () => {
        const ks = [...dirty],
          patch = {};
        ks.forEach(x => (patch[x] = prefs[x]));
        return w([{ t: 'prefs-merge', data: patch }]).then(() => ks.forEach(x => dirty.delete(x)));
      });
    },
  };
})();
