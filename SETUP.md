# 메아리 × Supabase 설정 (아이디 + 암호 로그인, 이메일 없음)

로그인과 저장은 Supabase **Edge Function `meari-api` 하나**가 처리해요. 브라우저는 DB에 직접 접근하지 못해요.
그래서 이메일, Confirm email 설정, anon 키, 가짜 도메인이 모두 필요 없어요.

## 1. 테이블 만들기
Supabase 대시보드 → **SQL Editor** 에 `supabase/schema.sql` 전체를 붙여 넣고 Run.
(맨 위 `drop table` 줄은 이전 버전 테이블을 지워요. 새 프로젝트면 그대로 실행해도 돼요.)

## 2. Edge Function 올리기
`supabase/functions/meari-api/index.ts` 가 함수 코드예요.

**대시보드로 (쉬운 방법)**
1. 왼쪽 메뉴 **Edge Functions** → 새 함수 만들기(Via Editor)
2. 이름을 정확히 `meari-api` 로 하고, 기본 코드를 지운 뒤 `index.ts` 내용을 통째로 붙여 넣고 Deploy
3. 함수 설정에서 **JWT 검증(Verify / Enforce JWT)을 끄기**  ← 중요. 켜져 있으면 요청이 401로 막혀요

**CLI로**
```
supabase link --project-ref <프로젝트 ref>
supabase functions deploy meari-api --no-verify-jwt
```
(`supabase/config.toml` 에 `verify_jwt = false` 가 이미 들어 있어요.)

(선택) 내 사이트 주소에서만 호출되게 하려면 함수 Secrets 에 `MEARI_ORIGIN=https://내사이트주소` 를 추가해요. 없으면 어디서나 호출할 수 있어요.

## 3. js/config.js 채우기
`SB_URL` 에 **Project URL** 하나만 넣어요. 예: `'https://abcdxyz.supabase.co'`
(Connect 버튼이나 Project Settings → Data API 에서 볼 수 있어요. 키는 필요 없어요.)

## 4. 실행
정적 파일이라 아무 웹 서버나 돼요. 예: `npx serve .` / `python3 -m http.server`, 또는 Netlify·Vercel·Cloudflare Pages·GitHub Pages에 폴더째 올리기.

## 동작 메모
- 아이디 규칙(영문·숫자·`. _ -` 4~20자)은 원래 그대로예요. 대소문자는 구분하지 않아요(`Harin` = `harin`).
- 암호는 PBKDF2 해시로만 저장돼요(원문은 저장하지 않아요). 로그인 토큰도 서버에는 해시만 있어요.
- 틀린 암호를 반복하면 잠시 잠겨요(아이디당 15분에 8회, IP당 40회). 가입은 IP당 1시간에 10회까지예요.
- 로그인은 60일 유지돼요(앱을 열 때마다 연장). "기억하기"를 끄면 그 탭을 닫을 때까지만 유지돼요.
- 브라우저에 있던 기존 원고(localStorage)는 서버로 올리지 않아요. 새 계정은 빈 "새 원고" 1화로 시작해요(샘플 없음).
- 저장된 글이 아직 서버로 가지 못했으면 창을 닫을 때 경고가 떠요. 연결이 끊기면 자동으로 다시 시도해요.
- 같은 계정을 두 기기에서 동시에 편집하면 나중에 저장한 쪽이 이겨요(실시간 동기화는 아직 없음).
- "암호 찾기"는 이메일이 없어서 아직 지원하지 않아요. 암호를 잊으면 대시보드의 Table Editor에서 `meari_users` 계정을 지우고 새로 가입해야 해요(그 계정의 원고도 함께 지워져요).
- **내 원고 화면의 작품 카드**: 오른쪽 위 휴지통을 누르면 "정말 삭제"로 바뀌고(3초), 한 번 더 누르면 삭제돼요. 6초 안에는 "되돌리기"가 가능해요.
  샘플 카드(파도가 지나간 자리 등)는 목록에서만 사라지고, 실제 원고를 지우면 모든 화·세계관·설정집이 삭제되고 빈 "새 원고"로 다시 시작해요. 연필 버튼으로 제목을 바꿀 수 있어요.

