-- ① 로그인 때 화 본문을 전부 받지 않도록: 화 목록용 요약 열(글자 수·본문 앞부분)을 더해요.
-- ② 서버 쓰기를 한 번에, 한 트랜잭션으로: 여러 화 저장 · 원고 삭제 · 원고 옮겨 담기 함수를 더해요.
-- 열·함수만 더하고 기존 글은 지우지 않아요. 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전해요.
-- 순서: ① 이 SQL → ② Edge Function(meari-api) 다시 배포 → ③ 새 화면 올리기
--   (SQL 을 먼저 실행하면 예전 함수·예전 화면도 그대로 동작해요. 함수를 먼저 올리면 로그인은 되지만 화 저장·원고 삭제가 실패해요.)

-- 화 목록 요약: chars = 줄바꿈 뺀 글자 수 · chars_s = 공백 뺀 글자 수 · head = 본문 앞 200자(원고 카드의 첫 줄 미리보기)
alter table public.chapters add column if not exists chars   int  not null default 0;
alter table public.chapters add column if not exists chars_s int  not null default 0;
alter table public.chapters add column if not exists head    text not null default '';
do $$ begin
  alter table public.chapters add constraint chapters_chars_chk check (chars >= 0 and chars_s >= 0 and char_length(head) <= 200);
exception when duplicate_object then null; end $$;

-- 이미 있는 화 채우기(요약이 아직 비어 있는 행만)
update public.chapters
   set chars   = char_length(replace(body, E'\n', '')),
       chars_s = char_length(regexp_replace(body, '\s', '', 'g')),
       head    = left(body, 200)
 where body <> '' and head = '' and chars = 0;

-- 화 본문 저장(한 건): 요약 열도 함께 고쳐요. 예전 함수와 같은 규칙이에요.
create or replace function public.meari_ch_save(p_uid uuid, p_row jsonb, p_base text) returns jsonb
language plpgsql as $$
declare
  v_id  bigint := (p_row->>'id')::bigint;
  v_at  timestamptz;
  v_new timestamptz := clock_timestamp();
  v_body text := p_row->>'body';
begin
  select updated_at into v_at from public.chapters where user_id = p_uid and id = v_id for update;
  if found then
    if p_base is not null and v_at <> p_base::timestamptz then
      return (select jsonb_build_object('ok', false, 'at', c.updated_at, 'title', c.title, 'body', c.body, 'n', c.n)
                from public.chapters c where c.user_id = p_uid and c.id = v_id);
    end if;
    update public.chapters
       set work_id = (p_row->>'work_id')::bigint, n = (p_row->>'n')::int, title = p_row->>'title', body = v_body,
           pos = (p_row->>'pos')::int, status = p_row->>'status', goal = (p_row->>'goal')::int, updated_at = v_new,
           chars = char_length(replace(v_body, E'\n', '')), chars_s = char_length(regexp_replace(v_body, '\s', '', 'g')), head = left(v_body, 200)
     where user_id = p_uid and id = v_id;
  else
    if p_base is not null then return jsonb_build_object('ok', false, 'gone', true); end if;
    insert into public.chapters(user_id, id, work_id, n, title, body, pos, status, goal, chars, chars_s, head, updated_at)
    values (p_uid, v_id, (p_row->>'work_id')::bigint, (p_row->>'n')::int, p_row->>'title', v_body,
            (p_row->>'pos')::int, p_row->>'status', (p_row->>'goal')::int,
            char_length(replace(v_body, E'\n', '')), char_length(regexp_replace(v_body, '\s', '', 'g')), left(v_body, 200), v_new);
  end if;
  return jsonb_build_object('ok', true, 'at', v_new);
end $$;

-- 화 여러 건을 한 번에, 전부 아니면 아무것도 아니게(한 트랜잭션).
--  · 각 행은 {id, work_id, n, title, body, pos, status, goal, chars?, chars_s?, base?}
--  · 먼저 모든 행의 base(내가 마지막으로 본 수정 시각)를 검사해요. 하나라도 어긋나면 아무것도 쓰지 않고
--    {ok:false, i:몇 번째, at, title, body, n} 을 돌려줘요(그 화가 없으면 {ok:false, i, gone:true})
--  · 모두 통과하면 쓰고 {ok:true, ats:[새 수정 시각 …]} 을 돌려줘요
create or replace function public.meari_ch_save_many(p_uid uuid, p_rows jsonb) returns jsonb
language plpgsql as $$
declare
  r      jsonb;
  v_id   bigint;
  v_at   timestamptz;
  v_new  timestamptz;
  v_i    int := 0;
  v_ats  jsonb := '[]'::jsonb;
  v_body text;
begin
  for r in select value from jsonb_array_elements(p_rows) loop
    v_id := (r->>'id')::bigint;
    select updated_at into v_at from public.chapters where user_id = p_uid and id = v_id for update;
    if r->>'base' is not null then
      if not found then return jsonb_build_object('ok', false, 'i', v_i, 'gone', true); end if;
      if v_at <> (r->>'base')::timestamptz then
        return (select jsonb_build_object('ok', false, 'i', v_i, 'at', c.updated_at, 'title', c.title, 'body', c.body, 'n', c.n)
                  from public.chapters c where c.user_id = p_uid and c.id = v_id);
      end if;
    end if;
    v_i := v_i + 1;
  end loop;
  for r in select value from jsonb_array_elements(p_rows) loop
    v_body := r->>'body';
    v_new  := clock_timestamp();
    insert into public.chapters(user_id, id, work_id, n, title, body, pos, status, goal, chars, chars_s, head, updated_at)
    values (p_uid, (r->>'id')::bigint, (r->>'work_id')::bigint, (r->>'n')::int, r->>'title', v_body,
            (r->>'pos')::int, r->>'status', (r->>'goal')::int,
            coalesce((r->>'chars')::int,   char_length(replace(v_body, E'\n', ''))),
            coalesce((r->>'chars_s')::int, char_length(regexp_replace(v_body, '\s', '', 'g'))),
            left(v_body, 200), v_new)
    on conflict (user_id, id) do update
       set work_id = excluded.work_id, n = excluded.n, title = excluded.title, body = excluded.body, pos = excluded.pos,
           status = excluded.status, goal = excluded.goal, chars = excluded.chars, chars_s = excluded.chars_s,
           head = excluded.head, updated_at = excluded.updated_at;
    v_ats := v_ats || to_jsonb(v_new);
  end loop;
  return jsonb_build_object('ok', true, 'ats', v_ats);
end $$;

-- 원고를 지우면 그 원고의 화·세계관·설정집도 함께(한 트랜잭션: 중간에 실패해도 반쪽만 지워지지 않아요)
create or replace function public.meari_wk_del(p_uid uuid, p_id bigint) returns void
language plpgsql as $$
begin
  delete from public.chapters   where user_id = p_uid and work_id = p_id;
  delete from public.lore_items where user_id = p_uid and work_id = p_id;
  delete from public.works      where user_id = p_uid and id = p_id;
end $$;

-- 원고 기능 이전(work_id 0)에 쓴 글을 한 원고로 옮겨 담기(한 트랜잭션)
create or replace function public.meari_wk_adopt(p_uid uuid, p_id bigint) returns void
language plpgsql as $$
begin
  update public.chapters   set work_id = p_id where user_id = p_uid and work_id = 0;
  update public.lore_items set work_id = p_id where user_id = p_uid and work_id = 0;
end $$;

revoke all on function public.meari_ch_save(uuid, jsonb, text)  from public, anon, authenticated;
revoke all on function public.meari_ch_save_many(uuid, jsonb)   from public, anon, authenticated;
revoke all on function public.meari_wk_del(uuid, bigint)        from public, anon, authenticated;
revoke all on function public.meari_wk_adopt(uuid, bigint)      from public, anon, authenticated;
grant execute on function public.meari_ch_save(uuid, jsonb, text) to service_role;
grant execute on function public.meari_ch_save_many(uuid, jsonb)  to service_role;
grant execute on function public.meari_wk_del(uuid, bigint)       to service_role;
grant execute on function public.meari_wk_adopt(uuid, bigint)     to service_role;
