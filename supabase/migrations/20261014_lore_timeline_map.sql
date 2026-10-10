-- 타임라인(날짜)과 지도(위치) 기능용 마이그레이션 — 열만 더하고 기존 데이터는 그대로 둬요.
-- 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전해요.
-- 순서: ① 이 SQL → ② Edge Function(meari-api) 다시 배포 → ③ 새 화면 올리기
alter table public.lore_items add column if not exists ev_date text not null default '';
alter table public.lore_items add column if not exists map_x real;
alter table public.lore_items add column if not exists map_y real;
do $$ begin
  alter table public.lore_items add constraint lore_items_evdate_chk check (char_length(ev_date) <= 30);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.lore_items add constraint lore_items_map_chk check ((map_x is null and map_y is null) or (map_x between 0 and 100 and map_y between 0 and 100));
exception when duplicate_object then null; end $$;
