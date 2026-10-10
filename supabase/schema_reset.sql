-- ⚠⚠ 위험: 메아리의 원고·설정집·메모·집필 기록·화면 설정을 모두 지워요(되돌릴 수 없어요).
-- 계정(meari_users)은 남지만 글은 전부 사라져요.
-- 이전 버전 테이블을 정리하고 처음부터 다시 만들 때만 실행한 다음, 바로 schema.sql 을 실행하세요.
drop table if exists public.works, public.chapters, public.lore_items, public.memos,
  public.writing_log, public.user_settings cascade;
