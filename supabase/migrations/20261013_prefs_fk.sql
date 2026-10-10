-- 보강 마이그레이션 — 열·데이터는 건드리지 않아요. 여러 번 실행해도 안전해요.
--  ① 설정을 바뀐 키만 합치는 함수(두 기기에서 설정이 서로 덮어써지지 않게)
--  ② 화 번호·제목·순서만 고치는 함수(지운 화를 되살리지 않게)
--  ③ 화·설정집의 원고 외래키(고아 행 방지)
-- 순서: ① 이 SQL → ② Edge Function(meari-api) 다시 배포 → ③ 새 화면 올리기
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
-- (참고) 이미 생긴 고아 행 찾기: select id, work_id from public.chapters c where work_id <> 0 and not exists (select 1 from public.works w where w.user_id = c.user_id and w.id = c.work_id);
