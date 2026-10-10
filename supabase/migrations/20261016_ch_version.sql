-- 여러 탭·기기에서 같은 화를 동시에 고칠 때 한쪽이 다른 쪽을 조용히 덮어쓰지 않게 하는 마이그레이션 — 함수만 더하고 데이터는 건드리지 않아요.
-- 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전해요.
-- 순서: ① 이 SQL → ② Edge Function(meari-api) 다시 배포 → ③ 새 화면 올리기
-- 화 본문을 '내가 마지막으로 본 수정 시각(p_base)'이 서버와 같을 때만 저장하는 함수(Edge Function 이 호출해요).
--  · p_base 가 null 이면 검사 없이 저장(새 화·되돌리기·충돌에서 '내 글로 저장')
--  · 서버에서 그 사이 바뀌었으면 저장하지 않고 {ok:false, at, title, body, n} 을 돌려줘요
--  · p_base 는 있는데 화가 없으면(다른 곳에서 지움) {ok:false, gone:true}
--  · 저장하면 {ok:true, at:새 수정 시각}
create or replace function public.meari_ch_save(p_uid uuid, p_row jsonb, p_base text) returns jsonb
language plpgsql as $$
declare
  v_id  bigint := (p_row->>'id')::bigint;
  v_at  timestamptz;
  v_new timestamptz := clock_timestamp();
begin
  select updated_at into v_at from public.chapters where user_id = p_uid and id = v_id for update;
  if found then
    if p_base is not null and v_at <> p_base::timestamptz then
      return (select jsonb_build_object('ok', false, 'at', c.updated_at, 'title', c.title, 'body', c.body, 'n', c.n)
                from public.chapters c where c.user_id = p_uid and c.id = v_id);
    end if;
    update public.chapters
       set work_id = (p_row->>'work_id')::bigint, n = (p_row->>'n')::int, title = p_row->>'title', body = p_row->>'body',
           pos = (p_row->>'pos')::int, status = p_row->>'status', goal = (p_row->>'goal')::int, updated_at = v_new
     where user_id = p_uid and id = v_id;
  else
    if p_base is not null then return jsonb_build_object('ok', false, 'gone', true); end if;
    insert into public.chapters(user_id, id, work_id, n, title, body, pos, status, goal, updated_at)
    values (p_uid, v_id, (p_row->>'work_id')::bigint, (p_row->>'n')::int, p_row->>'title', p_row->>'body',
            (p_row->>'pos')::int, p_row->>'status', (p_row->>'goal')::int, v_new);
  end if;
  return jsonb_build_object('ok', true, 'at', v_new);
end $$;
revoke all on function public.meari_ch_save(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.meari_ch_save(uuid, jsonb, text) to service_role;
