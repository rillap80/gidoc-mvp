# 배포 체크리스트

## 배포 전 (로컬)
- [ ] `npm install && npm run typecheck` 통과 확인 (이 환경은 네트워크가 막혀 있어 직접 못 돌려봤음 — 반드시 로컬에서 확인)
- [ ] `npm run build` 로컬에서 성공 확인
- [ ] `supabase/schema.sql` 실행 (신규 설치) 또는 마이그레이션 섹션 실행 (기존 설치)
- [ ] `npm run seed`로 테스트 데이터 생성 후 `/admin`에서 확인 (선택)

## 환경변수 (Vercel)
- [ ] Supabase 3종 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] `OPENAI_API_KEY`
- [ ] `GOOGLE_FORM_WEBHOOK_SECRET`, `ADMIN_ACCESS_KEY`
- [ ] `SITE_URL` — Vercel 배포 주소로 채우기 (첫 배포 후 값을 알 수 있으므로 2차 배포에서 채워도 됨)
- [ ] 크레탑: API 모드면 `CRETOP_API_KEY`+`CRETOP_API_BASE_URL`, 세션 자동화면 `CRETOP_ID`+`CRETOP_PASSWORD`
- [ ] 알림 Provider: `NOTIFICATION_PROVIDER` + 해당 채널 값 (선택 — 비워두면 알림 없이 정상 동작)

## 배포 후
- [ ] Google Apps Script의 웹훅 URL을 실제 Vercel 도메인으로 교체
- [ ] `/admin`에 `ADMIN_ACCESS_KEY`로 접속되는지 확인
- [ ] Google Form → 실제 신청 1건 접수해서 `/result/[id]`까지 3분 내 완료되는지 확인
- [ ] (세션 자동화 모드라면) `worker/`를 별도 호스트에 배포하고 `awaiting_cretop` 상태가 정상적으로 넘어가는지 확인
- [ ] Slack/Discord/Telegram 알림이 설정했다면 실제로 오는지 확인

## 알려진 한계 (정직하게)
- Vercel Hobby 플랜은 함수 실행시간 상한이 낮아, AI 분석이 재시도를 반복하는 최악의 경우 `vercel.json`의
  `maxDuration: 60`을 넘길 수 있다. 트래픽이 생기면 Pro 플랜 + 더 높은 `maxDuration` 또는 별도 작업 큐를 고려할 것.
- `/dashboard`, `/rewards`, `/cases`, `/expert/feedback`의 기여도·랭킹·VOC·Learning Queue는 전부
  브라우저 localStorage 기반 Mock이다. 여러 사용자 간 실제 집계가 필요해지면 Supabase 테이블로 옮겨야 한다
  (`lib/mock/` 안의 타입 정의를 그대로 스키마로 옮길 수 있게 맞춰둠).
- `lib/business-lookup.ts`, `lib/public-data.ts`는 아직 실제 외부 API 연동 전 스텁 상태다.
