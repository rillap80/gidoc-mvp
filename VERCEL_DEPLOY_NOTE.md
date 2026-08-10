# 기닥 AI MVP — Vercel 배포용

이 압축파일은 Vercel에서 바로 Import할 수 있도록 프로젝트 루트 기준으로 정리한 버전입니다.

## 배포
1. GitHub 저장소를 새로 만들고 이 압축파일의 **내용물 전체**를 업로드합니다. ZIP 파일 자체만 올리지 마세요.
2. Vercel에서 GitHub 저장소를 Import합니다.
3. Framework Preset은 Next.js를 사용합니다.
4. 환경변수는 `.env.example`을 참고해 Vercel Project Settings → Environment Variables에 입력합니다.
5. Supabase를 사용하는 기능은 Supabase 프로젝트/환경변수가 준비되어야 정상 동작합니다.

## 주의
- 실제 비밀키가 들어 있는 `.env` 파일은 포함하지 않습니다.
- 현재 MVP의 일부 외부 연동/Mock 기능은 별도 설정이 필요합니다.
