-- 메아리 Supabase 스키마 (이메일 없는 아이디 로그인 버전)
-- 대시보드 → SQL Editor 에 통째로 붙여 넣고 Run.
--
-- ⚠ 맨 위의 drop 은 이전 버전(auth.users 기반) 테이블을 지우는 줄이에요.
--    새 프로젝트이거나 이전 테이블에 지워도 되는 데이터만 있을 때만 실행하세요.
drop table if exists public.chapters, public.lore_items, public.memos,
  public.writing_log, public.user_settings cascade;

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
create table if not exists public.chapters (
  user_id    uuid   not null references public.meari_users(id) on delete cascade,
  id         bigint not null,
  n          int    not null,
  title      text   not null default '' check (char_length(title) <= 100),
  body       text   not null default '' check (char_length(body) <= 300000),
  pos        int    not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.lore_items (
  user_id uuid   not null references public.meari_users(id) on delete cascade,
  kind    text   not null check (kind in ('world','codex')),
  id      bigint not null,
  cat     text   not null default '' check (char_length(cat) <= 20),
  title   text   not null default '' check (char_length(title) <= 100),
  body    text   not null default '' check (char_length(body) <= 100000),
  pos     int    not null default 0,
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
  foreach t in array array['meari_users','meari_sessions','meari_attempts','chapters','lore_items','memos','writing_log','user_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence public.meari_attempts_id_seq from anon, authenticated;
