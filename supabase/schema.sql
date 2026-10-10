-- 메아리 Supabase 스키마 (이메일 없는 아이디 로그인 버전)
-- 대시보드 → SQL Editor 에 통째로 붙여 넣고 Run.
-- 데이터를 지우는 줄은 없어요. 여러 번 실행해도 안전해요(create ... if not exists).
-- 이전 버전(auth.users 기반) 테이블을 지우고 처음부터 다시 만들고 싶을 때만 schema_reset.sql 을 먼저 실행하세요.

-- 계정: 아이디 + 암호 해시(PBKDF2). 암호 원문은 어디에도 저장되지 않아요.
create table if not exists public.meari_users (
  id           uuid primary key default gen_random_uuid(),
  username     text not null check (username ~ '^[A-Za-z0-9._-]{4,20}$'),  -- 화면에 보이는 이름
  username_key text not null unique,                                       -- 소문자(중복 확인용)
  pw_hash      text not null,
  created_at   timestamptz not null default now()
);

-- 로그인 세션: 토큰 원문은 브라우저에만 있고, 서버에는 해시만 저장해요.
create table if not exists public.meari_sessions (
  token_hash text primary key,
  user_id    uuid not null references public.meari_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists meari_sessions_user on public.meari_sessions(user_id);

-- 로그인 시도 기록(무차별 대입 방지용)
create table if not exists public.meari_attempts (
  id  bigserial primary key,
  key text not null,
  at  timestamptz not null default now()
);
create index if not exists meari_attempts_key_at on public.meari_attempts(key, at);

-- 원고·설정 데이터
-- 원고(작품): 각 원고가 자기 화·세계관·설정집을 가져요
create table if not exists public.works (
  user_id    uuid   not null references public.meari_users(id) on delete cascade,
  id         bigint not null,
  title      text   not null default '' check (char_length(title) <= 60),
  pos        int    not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.chapters (
  user_id    uuid   not null references public.meari_users(id) on delete cascade,
  id         bigint not null,
  work_id    bigint not null default 0,
  n          int    not null,
  title      text   not null default '' check (char_length(title) <= 100),
  body       text   not null default '' check (char_length(body) <= 300000),
  pos        int    not null default 0,
  status     text   not null default 'draft' check (status in ('draft','revise','done')), -- 초고·퇴고·완료
  goal       int    not null default 0 check (goal between 0 and 100000),                  -- 이 화의 목표 글자 수(0 = 원고 기본값)
  chars      int    not null default 0 check (chars >= 0),    -- 줄바꿈 뺀 글자 수(목록용 요약)
  chars_s    int    not null default 0 check (chars_s >= 0),  -- 공백 뺀 글자 수(목록용 요약)
  head       text   not null default '' check (char_length(head) <= 200),  -- 본문 앞 200자(원고 카드 미리보기)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.lore_items (
  user_id uuid   not null references public.meari_users(id) on delete cascade,
  kind    text   not null check (kind in ('world','codex')),
  id      bigint not null,
  work_id bigint not null default 0,
  cat     text   not null default '' check (char_length(cat) <= 20),
  title   text   not null default '' check (char_length(title) <= 100),
  body    text   not null default '' check (char_length(body) <= 100000),
  pos     int    not null default 0,
  links   jsonb  not null default '[]'::jsonb check (jsonb_typeof(links) = 'array' and pg_column_size(links) <= 8000),  -- 연결: [{k,id,r}]
  ev_date text   not null default '' check (char_length(ev_date) <= 30),  -- 타임라인 날짜(자유 입력)
  img     text   not null default '' check (char_length(img) <= 60000),  -- 항목 이미지(data URL)
  map_x   real,  map_y real,  -- 지도 위치(0~100 %), 둘 다 비면 미배치
  check ((map_x is null and map_y is null) or (map_x between 0 and 100 and map_y between 0 and 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);
create table if not exists public.memos (
  user_id uuid   not null references public.meari_users(id) on delete cascade,
  id      bigint not null,
  t       text   not null check (char_length(t) <= 200),
  at      timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.writing_log (
  user_id uuid not null references public.meari_users(id) on delete cascade,
  day     date not null,
  chars   int  not null check (chars >= 0),
  primary key (user_id, day)
);
create table if not exists public.user_settings (
  user_id uuid primary key references public.meari_users(id) on delete cascade,
  data    jsonb not null default '{}' check (pg_column_size(data) <= 20000),
  updated_at timestamptz not null default now()
);

-- 브라우저(anon/authenticated)는 테이블에 직접 접근할 수 없게 잠가요.
-- 모든 접근은 Edge Function(meari-api)이 service_role 로만 해요.
do $$
declare t text;
begin
  foreach t in array array['meari_users','meari_sessions','meari_attempts','works','chapters','lore_items','memos','writing_log','user_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence public.meari_attempts_id_seq from anon, authenticated;

create index if not exists chapters_work on public.chapters(user_id, work_id, pos);
create index if not exists lore_items_work on public.lore_items(user_id, work_id, pos);

-- 화·설정집 항목은 같은 사용자의 원고(works)를 가리켜야 해요. 원고를 지우면 딸린 행도 함께 지워져요.
-- NOT VALID: 원고 기능 이전에 쓴 글(work_id 0)은 그대로 두고, 새로 쓰거나 고치는 행부터 검사해요.
do $$ begin
  alter table public.chapters add constraint chapters_work_fk
    foreign key (user_id, work_id) references public.works(user_id, id) on delete cascade not valid;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.lore_items add constraint lore_items_work_fk
    foreign key (user_id, work_id) references public.works(user_id, id) on delete cascade not valid;
exception when duplicate_object then null; end $$;

-- 설정 합치기 · 화 메타 고치기 함수(Edge Function 이 호출해요)
create or replace function public.meari_prefs_merge(p_uid uuid, p_patch jsonb) returns void
language sql as $$
  insert into public.user_settings(user_id, data, updated_at) values (p_uid, p_patch, now())
  on conflict (user_id) do update set data = public.user_settings.data || excluded.data, updated_at = now();
$$;
create or replace function public.meari_ch_meta(p_uid uuid, p_rows jsonb) returns void
language sql as $$
  update public.chapters c
     set work_id = r.work_id, n = r.n, title = r.title, pos = r.pos, status = r.status, goal = r.goal
    from jsonb_to_recordset(p_rows) as r(id bigint, work_id bigint, n int, title text, pos int, status text, goal int)
   where c.user_id = p_uid and c.id = r.id;
$$;
revoke all on function public.meari_prefs_merge(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.meari_ch_meta(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.meari_prefs_merge(uuid, jsonb) to service_role;
grant execute on function public.meari_ch_meta(uuid, jsonb) to service_role;

-- (아래는 migrations/20261017_ch_lazy.sql 과 같아요. 이미 쓰던 프로젝트에 다시 실행해도 안전해요)
-- 화 목록 요약: chars = 줄바꿈 뺀 글자 수 · chars_s = 공백 뺀 글자 수 · head = 본문 앞 200자(원고 카드의 첫 줄 미리보기)
alter table public.chapters add column if not exists chars   int  not null default 0;
alter table public.chapters add column if not exists chars_s int  not null default 0;
alter table public.chapters add column if not exists head    text not null default '';
do $$ begin
  alter table public.chapters add constraint chapters_chars_chk check (chars >= 0 and chars_s >= 0 and char_length(head) <= 200);
exception when duplicate_object then null; end $$;

-- 이미 있는 화 채우기(요약이 아직 비어 있는 행만)
update public.chapters
   set chars   = char_length(replace(body, E'\n', '')),
       chars_s = char_length(regexp_replace(body, '\s', '', 'g')),
       head    = left(body, 200)
 where body <> '' and head = '' and chars = 0;

-- 화 본문 저장(한 건): 요약 열도 함께 고쳐요. 예전 함수와 같은 규칙이에요.
create or replace function public.meari_ch_save(p_uid uuid, p_row jsonb, p_base text) returns jsonb
language plpgsql as $$
declare
  v_id  bigint := (p_row->>'id')::bigint;
  v_at  timestamptz;
  v_new timestamptz := clock_timestamp();
  v_body text := p_row->>'body';
begin
  select updated_at into v_at from public.chapters where user_id = p_uid and id = v_id for update;
  if found then
    if p_base is not null and v_at <> p_base::timestamptz then
      return (select jsonb_build_object('ok', false, 'at', c.updated_at, 'title', c.title, 'body', c.body, 'n', c.n)
                from public.chapters c where c.user_id = p_uid and c.id = v_id);
    end if;
    update public.chapters
       set work_id = (p_row->>'work_id')::bigint, n = (p_row->>'n')::int, title = p_row->>'title', body = v_body,
           pos = (p_row->>'pos')::int, status = p_row->>'status', goal = (p_row->>'goal')::int, updated_at = v_new,
           chars = char_length(replace(v_body, E'\n', '')), chars_s = char_length(regexp_replace(v_body, '\s', '', 'g')), head = left(v_body, 200)
     where user_id = p_uid and id = v_id;
  else
    if p_base is not null then return jsonb_build_object('ok', false, 'gone', true); end if;
    insert into public.chapters(user_id, id, work_id, n, title, body, pos, status, goal, chars, chars_s, head, updated_at)
    values (p_uid, v_id, (p_row->>'work_id')::bigint, (p_row->>'n')::int, p_row->>'title', v_body,
            (p_row->>'pos')::int, p_row->>'status', (p_row->>'goal')::int,
            char_length(replace(v_body, E'\n', '')), char_length(regexp_replace(v_body, '\s', '', 'g')), left(v_body, 200), v_new);
  end if;
  return jsonb_build_object('ok', true, 'at', v_new);
end $$;

-- 화 여러 건을 한 번에, 전부 아니면 아무것도 아니게(한 트랜잭션).
--  · 각 행은 {id, work_id, n, title, body, pos, status, goal, chars?, chars_s?, base?}
--  · 먼저 모든 행의 base(내가 마지막으로 본 수정 시각)를 검사해요. 하나라도 어긋나면 아무것도 쓰지 않고
--    {ok:false, i:몇 번째, at, title, body, n} 을 돌려줘요(그 화가 없으면 {ok:false, i, gone:true})
--  · 모두 통과하면 쓰고 {ok:true, ats:[새 수정 시각 …]} 을 돌려줘요
create or replace function public.meari_ch_save_many(p_uid uuid, p_rows jsonb) returns jsonb
language plpgsql as $$
declare
  r      jsonb;
  v_id   bigint;
  v_at   timestamptz;
  v_new  timestamptz;
  v_i    int := 0;
  v_ats  jsonb := '[]'::jsonb;
  v_body text;
begin
  for r in select value from jsonb_array_elements(p_rows) loop
    v_id := (r->>'id')::bigint;
    select updated_at into v_at from public.chapters where user_id = p_uid and id = v_id for update;
    if r->>'base' is not null then
      if not found then return jsonb_build_object('ok', false, 'i', v_i, 'gone', true); end if;
      if v_at <> (r->>'base')::timestamptz then
        return (select jsonb_build_object('ok', false, 'i', v_i, 'at', c.updated_at, 'title', c.title, 'body', c.body, 'n', c.n)
                  from public.chapters c where c.user_id = p_uid and c.id = v_id);
      end if;
    end if;
    v_i := v_i + 1;
  end loop;
  for r in select value from jsonb_array_elements(p_rows) loop
    v_body := r->>'body';
    v_new  := clock_timestamp();
    insert into public.chapters(user_id, id, work_id, n, title, body, pos, status, goal, chars, chars_s, head, updated_at)
    values (p_uid, (r->>'id')::bigint, (r->>'work_id')::bigint, (r->>'n')::int, r->>'title', v_body,
            (r->>'pos')::int, r->>'status', (r->>'goal')::int,
            coalesce((r->>'chars')::int,   char_length(replace(v_body, E'\n', ''))),
            coalesce((r->>'chars_s')::int, char_length(regexp_replace(v_body, '\s', '', 'g'))),
            left(v_body, 200), v_new)
    on conflict (user_id, id) do update
       set work_id = excluded.work_id, n = excluded.n, title = excluded.title, body = excluded.body, pos = excluded.pos,
           status = excluded.status, goal = excluded.goal, chars = excluded.chars, chars_s = excluded.chars_s,
           head = excluded.head, updated_at = excluded.updated_at;
    v_ats := v_ats || to_jsonb(v_new);
  end loop;
  return jsonb_build_object('ok', true, 'ats', v_ats);
end $$;

-- 원고를 지우면 그 원고의 화·세계관·설정집도 함께(한 트랜잭션: 중간에 실패해도 반쪽만 지워지지 않아요)
create or replace function public.meari_wk_del(p_uid uuid, p_id bigint) returns void
language plpgsql as $$
begin
  delete from public.chapters   where user_id = p_uid and work_id = p_id;
  delete from public.lore_items where user_id = p_uid and work_id = p_id;
  delete from public.works      where user_id = p_uid and id = p_id;
end $$;

-- 원고 기능 이전(work_id 0)에 쓴 글을 한 원고로 옮겨 담기(한 트랜잭션)
create or replace function public.meari_wk_adopt(p_uid uuid, p_id bigint) returns void
language plpgsql as $$
begin
  update public.chapters   set work_id = p_id where user_id = p_uid and work_id = 0;
  update public.lore_items set work_id = p_id where user_id = p_uid and work_id = 0;
end $$;

revoke all on function public.meari_ch_save(uuid, jsonb, text)  from public, anon, authenticated;
revoke all on function public.meari_ch_save_many(uuid, jsonb)   from public, anon, authenticated;
revoke all on function public.meari_wk_del(uuid, bigint)        from public, anon, authenticated;
revoke all on function public.meari_wk_adopt(uuid, bigint)      from public, anon, authenticated;
grant execute on function public.meari_ch_save(uuid, jsonb, text) to service_role;
grant execute on function public.meari_ch_save_many(uuid, jsonb)  to service_role;
grant execute on function public.meari_wk_del(uuid, bigint)       to service_role;
grant execute on function public.meari_wk_adopt(uuid, bigint)     to service_role;
