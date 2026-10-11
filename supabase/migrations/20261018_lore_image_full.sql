-- 항목 이미지 원본(큰 JPEG, data URL) — 목록에는 싣지 않고 이미지를 눌렀을 때만 받아요.
-- 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전해요.
-- 순서: ① 이 SQL → ② Edge Function(meari-api) 다시 배포 → ③ 새 화면 올리기
alter table public.lore_items add column if not exists img_full text not null default '';
do $$ begin
  alter table public.lore_items add constraint lore_items_img_full_chk check (char_length(img_full) <= 1400000);
exception when duplicate_object then null; end $$;
