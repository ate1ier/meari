-- 화별 상태(초고·퇴고·완료)와 화별 목표 글자 수 추가용 마이그레이션 — 열만 더하고 기존 데이터는 그대로 둬요.
-- 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전해요.
-- 순서: ① 이 SQL → ② Edge Function(meari-api) 다시 배포 → ③ 새 화면 올리기
alter table public.chapters add column if not exists status text not null default 'draft';
alter table public.chapters add column if not exists goal   int  not null default 0;
do $$ begin
  alter table public.chapters add constraint chapters_status_chk check (status in ('draft','revise','done'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.chapters add constraint chapters_goal_chk check (goal between 0 and 100000);
exception when duplicate_object then null; end $$;
