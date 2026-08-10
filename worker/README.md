# 크레탑 자동화 워커

Playwright 헤드리스 브라우저로 CRETOP에 로그인해 재무데이터를 조회하는 상시구동 워커입니다.
**메인 Next.js 앱(Vercel)과 별도로 배포**합니다 — 이유는 루트 `README.md`의
"크레탑 자동화 배포" 섹션 참고 (Vercel Functions는 헤드리스 브라우저를 안정적으로 못 돌립니다).

## 로컬 실행

```bash
cd worker
npm install
npm run playwright:install   # Chromium 바이너리 설치 (최초 1회)
cp .env.example .env         # 값 채우기
npm start                    # 1회 폴링
npm run start:loop           # 30초 간격 상시 폴링
```

## 배포 (Railway / Render / VPS 등 — 상시구동 가능한 곳이면 어디든)

1. 이 `worker/` 폴더만 별도 서비스로 배포 (Railway "Root Directory"를 `worker`로 지정하는 식)
2. 빌드 커맨드: `npm install && npm run playwright:install`
3. 시작 커맨드: `npm run start:loop`
4. `.env.example`의 모든 값을 환경변수로 등록 (`SITE_URL`은 Vercel에 배포된 메인 앱 주소)

## 왜 메인 앱의 lib/를 그대로 참조하나

`cretop-worker.ts`는 `../lib/retry`, `../lib/logger`, `../lib/secret-mask`를 상대경로로 그대로 가져다 씁니다 —
로직을 중복 구현하지 않기 위해서입니다. 이 폴더의 `package.json`은 Playwright 등 워커 전용 의존성만
담고 있고, 메인 앱의 `package.json`에는 Playwright가 전혀 포함되지 않습니다 (Vercel 빌드가 무거워지거나
불필요한 브라우저 다운로드를 시도하는 것을 방지).
