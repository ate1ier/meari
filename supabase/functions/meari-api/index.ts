// @ts-nocheck
/* 메아리 API — Supabase Edge Function.  함수 이름: meari-api   (JWT 확인은 꺼야 해요: --no-verify-jwt)
   아이디+암호 로그인, 세션, 원고/설정 읽기·쓰기를 모두 여기서 처리해요. 이메일은 쓰지 않아요.
   브라우저는 DB에 직접 접근하지 못하고, 이 함수만 service_role 로 접근해요. */

const SESSION_DAYS = 60,
  ITER = 120000;
const USER_RE = /^[A-Za-z0-9._-]{4,20}$/,
  DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DUMMY = 'pbkdf2$' + ITER + '$00112233445566778899aabbccddeeff$' + '0'.repeat(64); // 없는 아이디도 같은 시간이 걸리게

class Http extends Error {
  constructor(status, code, extra = undefined) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => Uint8Array.from(h.match(/../g) || [], x => parseInt(x, 16));
const sha256 = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const same = (a, b) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};
async function pbkdf2(pw, salt, iter) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
      k,
      256
    )
  );
}
async function hashPw(pw) {
  const s = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${hex(s)}$${await pbkdf2(pw, s, ITER)}`;
}
async function checkPw(pw, stored) {
  const [, it, s, h] = stored.split('$');
  return same(await pbkdf2(pw, unhex(s), +it), h);
}

const E = r => {
  if (r.error) throw r.error;
  return r;
};
const now = () => new Date().toISOString();
const isInt = v => Number.isSafeInteger(v) && Math.abs(v) <= 9e15;
const isStr = (v, max) => typeof v === 'string' && v.length <= max;
const ST = ['draft', 'revise', 'done'];
const okMeta = (r: any) =>
  ST.includes(r.status) && isInt(r.goal) && r.goal >= 0 && r.goal <= 100000; /* 화 상태·개별 목표 */
/* 설정 항목 연결: [{k:'world'|'codex'|'ch', id, r:관계 이름(12자)}] 최대 30개 */
const okLinks = (a: any) =>
  Array.isArray(a) &&
  a.length <= 30 &&
  a.every(
    o =>
      o &&
      typeof o === 'object' &&
      ['world', 'codex', 'ch'].includes(o.k) &&
      isInt(o.id) &&
      isStr(o.r, 12)
  );
const okPt = (v: any) =>
  v === undefined || v === null || (typeof v === 'number' && v >= 0 && v <= 100);
const isTime = v => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const bad = () => {
  throw new Http(400, 'invalid');
};
const rowsOf = (o, max = 500) => {
  if (!Array.isArray(o.rows) || o.rows.length > max) bad();
  return o.rows;
};

/* 서버 한도(보통 1000행)를 넘는 목록도 끝까지 읽어요 */
async function pages(make) {
  const out = [];
  for (let i = 0; i < 20; i++) {
    const r = E(await make().range(i * 1000, i * 1000 + 999));
    out.push(...r.data);
    if (r.data.length < 1000) break;
  }
  return out;
}
async function tooMany(sb, key, max, mins) {
  const since = new Date(Date.now() - mins * 60000).toISOString();
  const r = E(
    await sb.from('meari_attempts').select('id').eq('key', key).gte('at', since).limit(max)
  );
  return r.data.length >= max;
}
const note = async (sb, key) => E(await sb.from('meari_attempts').insert({ key }));

async function newSession(sb, uid) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  E(
    await sb.from('meari_sessions').insert({
      token_hash: await sha256(token),
      user_id: uid,
      expires_at: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString(),
    })
  );
  return token;
}
async function authed(sb, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw new Http(401, 'unauth');
  const h = await sha256(token);
  const r = E(
    await sb.from('meari_sessions').select('user_id,expires_at').eq('token_hash', h).maybeSingle()
  );
  if (!r.data || new Date(r.data.expires_at).getTime() < Date.now()) throw new Http(401, 'unauth');
  return { uid: r.data.user_id, h };
}

/* 쓰기 한 건을 '검사 → 실행 함수'로 나눠요. 모든 행에 user_id 는 서버가 직접 채워요(클라이언트 값은 믿지 않음).
   · write 요청은 항목을 전부 먼저 검사해요(하나라도 잘못이면 아무것도 실행하지 않아요). 그다음 순서대로 실행해요.
   · 각 항목은 DB 에 한 번의 문장 또는 함수(= 한 트랜잭션)로 닿아서, 한 항목이 중간에 반쪽으로 남지 않아요(화 여러 건 · 원고 삭제 · 옮겨 담기는 DB 함수).
   · 항목 사이는 서로 다른 트랜잭션이에요. 중간에 DB 오류가 나면 앞 항목은 반영된 채 요청이 실패하지만, 모든 항목이 덮어쓰기·삭제라서 클라이언트가 같은 요청을 다시 보내면 끝까지 맞춰져요 */
function plan(sb, uid, o) {
  if (!o || typeof o !== 'object') bad();
  switch (o.t) {
    case 'wk': {
      /* 원고(작품): 만들기·제목·순서 */
      const rows = rowsOf(o, 50).map(r => {
        if (!(isInt(r.id) && r.id > 0 && isStr(r.title, 60) && isInt(r.pos))) bad();
        return { user_id: uid, id: r.id, title: r.title, pos: r.pos, updated_at: now() };
      });
      return async () => {
        if (rows.length) E(await sb.from('works').upsert(rows, { onConflict: 'user_id,id' }));
      };
    }
    case 'wk-del' /* 원고를 지우면 그 원고의 화·세계관·설정집도 함께 지워요(DB 함수 meari_wk_del: 한 트랜잭션) */:
      if (!(isInt(o.id) && o.id > 0)) bad();
      return async () => {
        E(await sb.rpc('meari_wk_del', { p_uid: uid, p_id: o.id }));
      };
    case 'wk-adopt' /* 원고 기능이 생기기 전(work_id 0)에 쓴 글을 이 원고로 옮겨 담아요(DB 함수 meari_wk_adopt: 한 트랜잭션) */:
      if (!(isInt(o.id) && o.id > 0)) bad();
      return async () => {
        E(await sb.rpc('meari_wk_adopt', { p_uid: uid, p_id: o.id }));
      };
    case 'ch': {
      /* 화 본문 저장. 행마다 base(내가 마지막으로 본 수정 시각)를 검사하고, 하나라도 서버 값과 다르면 아무것도 쓰지 않고 409 로 현재 서버 글을 돌려줘요.
                  전부 통과하면 한 트랜잭션으로 저장하고 새 수정 시각 목록을 돌려줘요(DB 함수 meari_ch_save_many) */
      const rows = rowsOf(o, 50).map(r => {
        if (
          !(
            isInt(r.id) &&
            r.id > 0 &&
            isInt(r.n) &&
            isStr(r.title, 100) &&
            isStr(r.body, 300000) &&
            isInt(r.pos) &&
            isInt(r.work_id) &&
            r.work_id > 0 &&
            okMeta(r)
          )
        )
          bad();
        const base =
          r.base === undefined || r.base === null
            ? null
            : isStr(r.base, 40) && !Number.isNaN(Date.parse(r.base))
              ? r.base
              : bad();
        const cnt = v =>
          v === undefined || v === null
            ? null
            : isInt(v) && v >= 0 && v <= r.body.length
              ? v
              : bad(); /* 목록에 보여 줄 글자 수(클라이언트가 센 값, 없으면 DB 가 세요) */
        return {
          id: r.id,
          work_id: r.work_id,
          n: r.n,
          title: r.title,
          body: r.body,
          pos: r.pos,
          status: r.status,
          goal: r.goal,
          chars: cnt(r.chars),
          chars_s: cnt(r.chars_s),
          base,
        };
      });
      return async () => {
        if (!rows.length) return [];
        const res = E(await sb.rpc('meari_ch_save_many', { p_uid: uid, p_rows: rows })).data;
        if (!res || res.ok !== true) {
          if (res && res.ok === false) throw new Http(409, 'conflict', { srv: res });
          throw new Error('meari_ch_save_many');
        }
        return res.ats;
      };
    }
    case 'ch-meta': {
      /* 번호·제목·순서만(본문은 건드리지 않음) */
      const rows = rowsOf(o).map(r => {
        if (
          !(
            isInt(r.id) &&
            r.id > 0 &&
            isInt(r.n) &&
            isStr(r.title, 100) &&
            isInt(r.pos) &&
            isInt(r.work_id) &&
            r.work_id > 0 &&
            okMeta(r)
          )
        )
          bad();
        return {
          user_id: uid,
          id: r.id,
          work_id: r.work_id,
          n: r.n,
          title: r.title,
          pos: r.pos,
          status: r.status,
          goal: r.goal,
        };
      });
      /* 이미 있는 화만 고쳐요(지운 화를 빈 본문으로 되살리지 않아요) — DB 함수 meari_ch_meta */
      return async () => {
        if (rows.length)
          E(
            await sb.rpc('meari_ch_meta', {
              p_uid: uid,
              p_rows: rows.map(({ user_id, ...r }) => r),
            })
          );
      };
    }
    case 'ch-del':
      if (!isInt(o.id)) bad();
      return async () => {
        E(await sb.from('chapters').delete().eq('user_id', uid).eq('id', o.id));
      };
    case 'lo': {
      /* 설정집·세계관 항목: 검사를 모두 마치고 한 번의 upsert 로 저장해요 */
      const byKey = new Map();
      for (const r of rowsOf(o, 50)) {
        if (
          !(
            ['world', 'codex'].includes(r.kind) &&
            isInt(r.id) &&
            r.id > 0 &&
            isStr(r.cat, 20) &&
            isStr(r.title, 100) &&
            isStr(r.body, 100000) &&
            isInt(r.pos) &&
            isInt(r.work_id) &&
            r.work_id > 0
          )
        )
          bad();
        const links = r.links === undefined ? [] : r.links;
        if (!okLinks(links)) bad();
        const evd = r.ev_date === undefined ? '' : r.ev_date,
          mx = r.map_x ?? null,
          my = r.map_y ?? null;
        const img = r.img === undefined ? '' : r.img;
        if (
          !isStr(img, 60000) ||
          (img !== '' && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(img))
        )
          bad();
        if (!isStr(evd, 30) || !okPt(mx) || !okPt(my) || (mx === null) !== (my === null)) bad();
        byKey.set(r.kind + ':' + r.id, {
          user_id: uid,
          kind: r.kind,
          id: r.id,
          work_id: r.work_id,
          cat: r.cat,
          title: r.title,
          body: r.body,
          pos: r.pos,
          links,
          ev_date: evd,
          img,
          map_x: mx,
          map_y: my,
          updated_at: now(),
        }); /* 같은 항목이 두 번 오면 마지막 것만(한 upsert 에서 같은 행을 두 번 고칠 수 없어요) */
      }
      const rows = [...byKey.values()];
      return async () => {
        if (rows.length)
          E(await sb.from('lore_items').upsert(rows, { onConflict: 'user_id,kind,id' }));
      };
    }
    case 'lo-del':
      if (!(['world', 'codex'].includes(o.kind) && isInt(o.id))) bad();
      return async () => {
        E(
          await sb.from('lore_items').delete().eq('user_id', uid).eq('kind', o.kind).eq('id', o.id)
        );
      };
    case 'me': {
      const rows = rowsOf(o, 100).map(r => {
        if (!(isInt(r.id) && r.id > 0 && isStr(r.t, 200) && isTime(r.at))) bad();
        return { user_id: uid, id: r.id, t: r.t, at: new Date(r.at).toISOString() };
      });
      return async () => {
        if (rows.length) E(await sb.from('memos').upsert(rows, { onConflict: 'user_id,id' }));
      };
    }
    case 'me-del':
      if (!isInt(o.id)) bad();
      return async () => {
        E(await sb.from('memos').delete().eq('user_id', uid).eq('id', o.id));
      };
    case 'log':
      if (!(typeof o.day === 'string' && DAY_RE.test(o.day) && isInt(o.chars) && o.chars >= 0))
        bad();
      return async () => {
        if (o.chars > 0)
          E(
            await sb
              .from('writing_log')
              .upsert({ user_id: uid, day: o.day, chars: o.chars }, { onConflict: 'user_id,day' })
          );
        else E(await sb.from('writing_log').delete().eq('user_id', uid).eq('day', o.day));
      };
    case 'prefs-merge' /* 바뀐 키만 기존 설정에 합쳐요(DB 함수 meari_prefs_merge) */:
      if (
        !o.data ||
        typeof o.data !== 'object' ||
        Array.isArray(o.data) ||
        JSON.stringify(o.data).length > 15000
      )
        bad();
      return async () => {
        E(await sb.rpc('meari_prefs_merge', { p_uid: uid, p_patch: o.data }));
      };
    default:
      bad();
  }
}

export function makeHandler(sb, cfg = {}) {
  const headers = {
    'Access-Control-Allow-Origin': cfg.origin || '*',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  const send = (status, obj) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });

  return async req => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return send(405, { ok: false, code: 'method' });
    try {
      const text = await req.text();
      if (text.length > 3000000) throw new Http(413, 'big');
      let b;
      try {
        b = JSON.parse(text);
      } catch {
        bad();
      }
      if (!b || typeof b !== 'object') bad();
      const ip = ((req.headers.get('x-forwarded-for') || '').split(',')[0] || '?')
        .trim()
        .slice(0, 64);

      if (b.op === 'signup') {
        if (
          !(
            typeof b.username === 'string' &&
            USER_RE.test(b.username) &&
            typeof b.password === 'string' &&
            b.password.length >= 6 &&
            b.password.length <= 200
          )
        )
          bad();
        if (await tooMany(sb, 'su:' + ip, 10, 60)) throw new Http(429, 'rate');
        await note(sb, 'su:' + ip);
        const r = await sb
          .from('meari_users')
          .insert({
            username: b.username,
            username_key: b.username.toLowerCase(),
            pw_hash: await hashPw(b.password),
          })
          .select('id')
          .single();
        if (r.error) {
          if (r.error.code === '23505') throw new Http(409, 'taken');
          throw r.error;
        }
        return send(200, {
          ok: true,
          token: await newSession(sb, r.data.id),
          user: { id: r.data.id, username: b.username },
        });
      }

      if (b.op === 'login') {
        if (
          !(
            typeof b.username === 'string' &&
            b.username.length <= 40 &&
            typeof b.password === 'string' &&
            b.password.length <= 200
          )
        )
          bad();
        const key = b.username.trim().toLowerCase();
        if ((await tooMany(sb, 'li:' + key, 8, 15)) || (await tooMany(sb, 'ip:' + ip, 40, 15)))
          throw new Http(429, 'rate');
        const u = E(
          await sb
            .from('meari_users')
            .select('id,username,pw_hash')
            .eq('username_key', key)
            .maybeSingle()
        ).data;
        const ok = await checkPw(b.password, u ? u.pw_hash : DUMMY);
        if (!u || !ok) {
          await note(sb, 'li:' + key);
          await note(sb, 'ip:' + ip);
          throw new Http(401, 'bad');
        }
        await sb
          .from('meari_attempts')
          .delete()
          .eq('key', 'li:' + key);
        await sb
          .from('meari_attempts')
          .delete()
          .lt('at', new Date(Date.now() - 864e5).toISOString());
        await sb.from('meari_sessions').delete().lt('expires_at', now());
        return send(200, {
          ok: true,
          token: await newSession(sb, u.id),
          user: { id: u.id, username: u.username },
        });
      }

      const { uid, h } = await authed(sb, b.token);

      if (b.op === 'logout') {
        E(await sb.from('meari_sessions').delete().eq('token_hash', h));
        return send(200, { ok: true });
      }

      /* 화 본문 읽기: 목록에서 고른 화만(한 번에 10개까지). 본문은 열 때 받아요 */
      if (b.op === 'body') {
        if (!Array.isArray(b.ids) || !b.ids.length || b.ids.length > 10 || !b.ids.every(isInt))
          bad();
        const r = E(
          await sb
            .from('chapters')
            .select('id,title,body,updated_at')
            .eq('user_id', uid)
            .in('id', b.ids)
        );
        return send(200, { ok: true, chapters: r.data });
      }

      if (b.op === 'load') {
        /* 화는 목록·요약만 받아요(본문 제외). 요약 열이 아직 없는 DB(마이그레이션 전)면 예전처럼 본문까지 받아요 */
        const chapters = async () => {
          const q = cols =>
            pages(() =>
              sb
                .from('chapters')
                .select(cols)
                .eq('user_id', uid)
                .order('work_id')
                .order('pos')
                .order('id')
            );
          try {
            return await q('id,work_id,n,title,pos,status,goal,updated_at,chars,chars_s,head');
          } catch (e) {
            if (e && e.code === '42703')
              return await q('id,work_id,n,title,body,pos,status,goal,updated_at');
            throw e;
          }
        };
        const [us, ch, lo, wk, me, lg, st] = await Promise.all([
          sb.from('meari_users').select('id,username').eq('id', uid).maybeSingle(),
          chapters(),
          pages(() =>
            sb
              .from('lore_items')
              .select('kind,id,work_id,cat,title,body,pos,links,ev_date,img,map_x,map_y')
              .eq('user_id', uid)
              .order('work_id')
              .order('pos')
              .order('id')
          ),
          sb
            .from('works')
            .select('id,title,pos,updated_at')
            .eq('user_id', uid)
            .order('pos')
            .limit(100),
          sb
            .from('memos')
            .select('id,t,at')
            .eq('user_id', uid)
            .order('at', { ascending: false })
            .limit(30),
          pages(() =>
            sb
              .from('writing_log')
              .select('day,chars')
              .eq('user_id', uid)
              .order('day', { ascending: false })
          ) /* 연간 통계용 · 1000행씩 끝까지 */,
          sb.from('user_settings').select('data').eq('user_id', uid).maybeSingle(),
        ]);
        for (const r of [us, wk, me, st]) E(r);
        if (!us.data) throw new Http(401, 'unauth');
        await sb
          .from('meari_sessions')
          .update({ expires_at: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString() })
          .eq('token_hash', h); // 열 때마다 연장
        return send(200, {
          ok: true,
          user: us.data,
          works: wk.data,
          chapters: ch,
          lore: lo,
          memos: me.data,
          log: lg,
          settings: st.data || null,
        });
      }

      if (b.op === 'write') {
        if (!Array.isArray(b.ops) || b.ops.length > 50) bad();
        const steps = b.ops.map(o => plan(sb, uid, o)); /* 전부 검사한 뒤에 */
        const res = [];
        for (const run of steps) res.push(await run()); /* 순서대로 실행 */
        return send(200, { ok: true, res });
      }
      bad();
    } catch (e) {
      if (e instanceof Http) return send(e.status, { ...(e.extra || {}), ok: false, code: e.code });
      if (e && (e.code === '23503' || e.code === '23514'))
        return send(400, {
          ok: false,
          code: 'invalid',
        }); /* 없는 원고를 가리키거나 DB 제약을 넘음 — 다시 보내도 소용없어요 */
      console.error('[meari-api]', e);
      return send(500, { ok: false, code: 'server' });
    }
  };
}

/* Supabase Edge Runtime(Deno)에서만 실행되는 부분 */
if (typeof Deno !== 'undefined' && Deno.serve) {
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  Deno.serve(makeHandler(sb, { origin: Deno.env.get('MEARI_ORIGIN') || '*' }));
}
