-- 원고(작품) 여러 개 기능 추가용 마이그레이션 — 기존 데이터는 그대로 두고 열만 더해요(drop 없음).
-- 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전해요.
-- 이미 쓰던 글(work_id 0)은 새 화면으로 처음 로그인할 때 자동으로 첫 원고에 담겨요.
create table if not exists public.works (
  user_id    uuid   not null references public.meari_users(id) on delete cascade,
  id         bigint not null,
  title      text   not null default '' check (char_length(title) <= 60),
  pos        int    not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.chapters   add column if not exists work_id bigint not null default 0;
alter table public.lore_items add column if not exists work_id bigint not null default 0;
create index if not exists chapters_work   on public.chapters(user_id, work_id, pos);
create index if not exists lore_items_work on public.lore_items(user_id, work_id, pos);
alter table public.works enable row level security;
revoke all on public.works from anon, authenticated;
