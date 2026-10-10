-- 설정집·세계관 항목끼리(그리고 화와) 연결하는 기능용 마이그레이션 — 열만 더하고 기존 데이터는 그대로 둬요.
-- 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전해요.
-- 순서: ① 이 SQL → ② Edge Function(meari-api) 다시 배포 → ③ 새 화면 올리기
alter table public.lore_items add column if not exists links jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.lore_items add constraint lore_items_links_chk check (jsonb_typeof(links) = 'array' and pg_column_size(links) <= 8000);
exception when duplicate_object then null; end $$;
