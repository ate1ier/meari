-- 항목(인물 카드)별 이미지 1장 — 작게 줄인 JPEG 를 data URL 문자열로 저장해요(저장소 설정 불필요).
-- 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전해요.
-- 순서: ① 이 SQL → ② Edge Function(meari-api) 다시 배포 → ③ 새 화면 올리기
alter table public.lore_items add column if not exists img text not null default '';
do $$ begin
  alter table public.lore_items add constraint lore_items_img_chk check (char_length(img) <= 60000);
exception when duplicate_object then null; end $$;
