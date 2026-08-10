# 기업닥터 AI — MVP

회사명 + 대표자명 입력만으로 3분 안에 기업 건강검진 결과를 생성하는 파이프라인.
**GitHub + Vercel 배포를 기준으로 구성되어 있습니다.**

## 배포 아키텍처 요약

```
GitHub 저장소
  ├─ (루트) Next.js 앱  ──▶  Vercel 배포 (자동 CI/CD)
  └─ worker/            ──▶  Railway/Render/VPS 등 별도 상시구동 호스트
```

메인 앱(Next.js)은 Vercel에 통째로 배포하면 됩니다. `worker/`는 Playwright 헤드리스 브라우저가
필요해서 서버리스에 올릴 수 없는 부분만 따로 뗀 것이고, **Vercel 배포와는 완전히 독립적**입니다
(크레탑을 공식 API로 연동한다면 `worker/`는 아예 필요 없습니다 — 아래 "크레탑 연동 방식" 참고).

## GitHub + Vercel 배포

### 1) GitHub에 올리기
```bash
git init
git add .
git commit -m "init: 기업닥터 AI MVP"
git branch -M main
git remote add origin https://github.com/<your-org>/<your-repo>.git
git push -u origin main
```
`worker/` 폴더도 같은 저장소에 포함되어 함께 올라갑니다 (Vercel은 루트만 빌드하므로 문제없음).

### 2) Vercel에 연결
1. https://vercel.com → "Add New" → "Project" → 방금 만든 GitHub 저장소 선택
2. Framework Preset: **Next.js** (자동 인식됨, Build/Output 설정 건드릴 필요 없음)
3. Root Directory: 비워둠(저장소 루트) — `worker/`는 Vercel이 알아서 무시합니다
   (`worker/`에는 별도 `package.json`이 있어 루트 빌드 대상에서 자연스럽게 제외됨)
4. Environment Variables에 `.env.example`의 값을 전부 등록 (Production/Preview/Development 각각)
5. Deploy

### 3) 배포 후 연결 마무리
1. 발급된 Vercel 도메인(예: `https://your-app.vercel.app`)을 `SITE_URL` 환경변수에 채워 재배포
2. Google Apps Script(`lib/google.ts` 상단 주석 예시 코드)의 `YOUR_DOMAIN`을 이 주소로 교체
3. 크레탑을 세션 자동화(로그인 방식)로 쓴다면 `worker/README.md`를 보고 워커를 별도 배포

### Vercel 특성상 반영해둔 것들
- **`waitUntil`**: `/api/webhook/google-form`, `/api/agent/run`, `/api/agent/deep`는 응답을 먼저
  반환하고 나머지 작업(AI 분석, PDF 생성 등)을 백그라운드에서 계속하는 구조인데, Vercel Functions는
  응답 직후 인스턴스를 바로 얼릴 수 있어 그냥 던져두면(fire-and-forget) 중간에 끊길 수 있습니다.
  `@vercel/functions`의 `waitUntil()`로 감싸서 백그라운드 작업이 끝날 때까지 함수가 살아있게 했습니다
  (Vercel이 아닌 환경에서도 안전하게 무시되고 정상 동작합니다).
- **`vercel.json`**: 위 라우트들의 `maxDuration`을 60초로 늘려뒀습니다 (Hobby 플랜 최대치). AI 분석이
  타임아웃/재시도를 반복하는 최악의 경우 60초를 넘길 수 있으므로, 트래픽이 커지면 Pro 플랜+더 높은
  `maxDuration`이나 Supabase Edge Function 큐/QStash 같은 별도 작업 큐로 옮기는 것을 권장합니다.
- **Playwright 분리**: 메인 앱의 `package.json`에는 Playwright가 전혀 없습니다 — `worker/`로 완전히
  분리해 Vercel 빌드가 무거워지거나 불필요한 Chromium 다운로드를 시도하지 않게 했습니다.

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # 아래 "필수 환경변수" 채우기
npm run dev
```

## 필수 환경변수 (.env.example 참고)

| 항목 | 없으면 발생하는 일 |
|---|---|
| Supabase 3종 | DB 저장 불가 — 전체 파이프라인 동작 불가. 최우선 설정 필요 |
| OPENAI_API_KEY | STEP6 분석/STEP10 심층의견 생성 불가 |
| GOOGLE_* (Sheets/Drive) | STEP1 웹훅은 시크릿 검증만 되면 동작. Sheet 기록·Drive 저장은 실패해도 파이프라인은 계속 진행되도록 처리해둠 |
| CRETOP_* | 미설정 시 크레탑 데이터 없이 공개자료만으로 분석 진행 (source: "unavailable") |
| SITE_URL | 미설정 시 관리자 알림 링크/워커 콜백이 `http://localhost:3000`으로 생성됨 — 배포 후 반드시 채울 것 |
| ADMIN_ACCESS_KEY | 관리자 페이지 접근용 임시 키. Supabase Auth 등으로 교체 권장 |

## 크레탑 연동 방식 — 둘 중 하나

### A. 공식 API 계약이 있는 경우 (권장, worker/ 불필요)
`.env`에 `CRETOP_API_KEY` + `CRETOP_API_BASE_URL`만 채우면 됩니다. `lib/cretop.ts`의 `fetchViaApi()`
필드 매핑만 실제 API 응답 스펙에 맞게 수정하세요. **이 방식이면 `worker/` 폴더는 신경 쓸 필요가 없고,
Vercel 배포만으로 전체 파이프라인이 완결됩니다.**

### B. 공식 API가 없어 로그인 세션 자동화가 필요한 경우
`CRETOP_ID` + `CRETOP_PASSWORD`만 채우면(단, `CRETOP_API_KEY`는 비워둘 것) 자동으로 이 모드로
동작합니다. Playwright 헤드리스 브라우저가 필요해 Vercel Functions에서 직접 돌릴 수 없으므로,
`worker/` 폴더를 Railway/Render/VPS 등 별도 상시구동 호스트에 배포해야 합니다 — 자세한 절차는
`worker/README.md` 참고.

**구조**
```
Vercel (Next.js)                       worker/ (Railway/Render/VPS, 상시구동)
  agent.ts: 사업자번호 확보까지 진행         cretop-worker.ts
  → status='awaiting_cretop' 후 대기   → 30초마다 awaiting_cretop 건 폴링
                                        → cretop-automation.ts (Playwright)로
                                          실제 로그인 → 검색 → 재무제표 조회/다운로드
                                        → applications.cretop_cache 에 저장
                                        → POST /api/agent/continue 호출
  /api/agent/continue: STEP5~8 이어서 실행 ←──┘
```

**⚠️ 반드시 사전 확인**: CRETOP 이용약관에 자동화(스크래핑) 조회가 허용되는지, 동시조회·계정당
조회 한도가 있는지 계약 담당자에게 먼저 확인하세요. 약관 위반 시 계정 정지 리스크가 있습니다.
`lib/cretop-automation.ts`의 `SELECTORS` 값도 `npx playwright codegen https://www.cretop.com`으로
실제 사이트 구조를 확인해 교체해야 동작합니다 (지금은 자리표시자).

## 폴더 구조

```
app/
  page.tsx                     랜딩 (Google Form CTA)
  result/[id]/page.tsx         STEP8  1차 결과 화면 (+ 예상 경제효과/비슷한 기업 사례 Mock)
  deep/[id]/page.tsx           STEP9  휴대폰 인증 → 심층분석 트리거
  report/[id]/page.tsx         STEP10 PDF 다운로드
  admin/page.tsx               STEP12 관리자 대시보드
  dashboard/[id]/page.tsx      성장 대시보드 (기여도/체크리스트/바이럴 공유/6축 건강점수/알림센터 — Mock)
  rewards/[id]/page.tsx        바이럴 리워드 센터 전용 페이지 (Mock)
  cases/page.tsx                성공사례 페이지 (Mock)
  expert/feedback/page.tsx      전문가 피드백 입력 → AI Learning Queue
  invite/[code]/page.tsx       공유받은 방문자용 체험 진단 랜딩 (Mock)
  api/webhook/google-form/     STEP1  Form 응답 수신
  api/agent/run/               STEP2~8 파이프라인 실행/폴링
  api/agent/deep/              STEP9~11 심층분석·PDF·Drive·Sheet
  api/agent/continue/          worker 콜백 전용 (STEP5~8 이어서 실행)
  api/admin/applications/      관리자 목록 API
lib/
  supabase.ts                  DB 클라이언트 (서버 전용)
  cretop.ts                    STEP3~4 크레탑 연동 (API 모드만 — 세션자동화는 worker/ 참고)
  business-lookup.ts           STEP2 사업자번호 검색 (스텁)
  public-data.ts               STEP5 공개자료 수집+요약 (스텁)
  health-score.ts              STEP6~8 AI 분석·결정론적 점수화
  google.ts                    STEP1/11 Sheets·Drive 연동
  pdf.tsx                      STEP10 PDF 생성 (@react-pdf/renderer)
  agent.ts                     STEP2~8 오케스트레이터
  notifications/               관리자 알림 (Slack/Discord/Telegram/SMS/카카오 교체 가능)
  mock/                        대시보드/바이럴/기여도/6축점수/AI Learning Queue 등 Mock 데이터 + localStorage 상태
worker/                        크레탑 세션 자동화 워커 — Vercel과 별도 배포 (자체 package.json)
scripts/seed.ts                 테스트 데이터 시드 스크립트 (npm run seed)
supabase/schema.sql             DB 스키마
vercel.json                     Vercel 함수 설정 (maxDuration)
DEPLOY_CHECKLIST.md             배포 전/후 체크리스트
```

## v11 — 2차 정밀진단 (노무법인 / 세무법인)

`/result/[id]` → "2차 정밀진단" → `/deep/[id]`(선택 화면) → 노무 또는 세무로 분기.

- **노무법인**: `/deep/[id]/labor`에서 6개 기본질문 + 서류 업로드(선택) 후 신청 완료. 파일은
  Supabase Storage의 **private 버킷**(`labor-documents`)에 저장되고, 공개 URL은 절대 발급되지 않는다.
- **세무법인**: 프로젝트 안에 실제로 설정된 URL이 없었기 때문에 임의로 만들지 않았다.
  `NEXT_PUBLIC_TAX_FIRM_CONSULT_URL`을 채우면 그 주소로 연결되고, 비워두면 "준비중"으로 표시된다.
- **노무법인 담당자 포털** (`/partner/labor`): 회원가입 없이 관리자가 발급한 `LABOR-XXXX` 코드로
  로그인. 코드는 매 API 요청마다(`x-partner-code` 헤더) 서버에서 다시 검증한다 — 프론트에서
  버튼만 숨기는 방식이 아니다. 서류 다운로드는 120초짜리 서명된 URL(signed URL)만 발급한다.
- 관리자 페이지 하단에 노무법인 코드 발급 패널 추가.
- 새 테이블: `labor_partner_users`, `labor_diagnosis`, `labor_documents` (schema.sql에 포함,
  기존 `applications`를 회사 식별자로 재사용해 별도 companies 테이블을 만들지 않았다).

## 아직 스텁(TODO)으로 남긴 부분

1. **사업자번호 검색** (`lib/business-lookup.ts`): 실제 계약한 검색 API 스펙 반영
2. **공개자료 수집** (`lib/public-data.ts`): 뉴스/특허(KIPRIS)/정부자료 API 연동
3. **휴대폰 OTP** (`app/api/agent/deep/route.ts`): 실제 SMS 프로바이더 연동 + OTP를 만료시간 포함해 별도 저장소(Redis 등)에 저장하도록 교체 (현재는 검증 로직이 형태만 있음)
4. **Google Form 트리거**: 리포지토리에 포함하지 않은 Apps Script를 Form 연결 스프레드시트에 직접 추가해야 합니다 (`lib/google.ts` 상단 주석의 예시 코드 참고)
5. **`/dashboard`, `/invite` 하위의 기여도/랭킹/VOC**: 전부 localStorage 기반 Mock — 실서비스로 가려면 Supabase에 `contribution_history`/`voc_entries` 등 전역 집계 테이블이 필요합니다 (`lib/mock/` 안의 타입을 그대로 스키마로 옮길 수 있게 맞춰둠)

## Supabase 설정

1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행 (기존에 실행한 적이 있다면 파일 하단 "마이그레이션" 섹션 주석도 해제해서 함께 실행)
3. 클라이언트(브라우저)가 Supabase에 직접 접근하는 지점은 없습니다 — 모든 페이지가 Next.js API
   라우트를 경유하도록 통일되어 있어(`lib/supabase.ts`의 `createServiceClient` 참고), RLS 정책을
   테이블마다 따로 신경 쓰지 않아도 됩니다.

## Progress UI 근거

백엔드 상태값(5단계: received/analyzing/awaiting_cretop/ai_analysis/completed)보다 Result 화면에
보여줄 단계(STEP1~6)가 하나 더 많습니다. `ai_analysis` 상태 동안 STEP4(AI 재무분석)와 STEP5(맞춤
컨설팅 생성)를 함께 "진행중"으로 표시하고, `completed`가 되는 순간 STEP4~6이 한 번에 완료 처리됩니다.
