/**
 * 필수 환경변수가 비어있으면 API가 알 수 없는 방식으로 실패하는 대신
 * 명확한 500 응답을 주기 위한 검사기.
 *
 * "필수"는 이 변수가 없으면 해당 라우트가 원천적으로 동작할 수 없는 것만 포함한다.
 * (예: CRETOP_* 는 미설정이어도 unavailable로 우아하게 처리되므로 필수에서 제외)
 */
const CORE_REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
] as const;

export function getMissingEnvVars(extra: readonly string[] = []): string[] {
  return [...CORE_REQUIRED, ...extra].filter((key) => !process.env[key]);
}

/**
 * 라우트 핸들러 맨 앞에서 호출. 문제가 있으면 사람이 읽을 수 있는 에러 메시지를 던진다.
 * (Next.js route handler에서 catch해서 500으로 응답하는 패턴과 함께 사용)
 */
export function assertRequiredEnv(extra: readonly string[] = []) {
  const missing = getMissingEnvVars(extra);
  if (missing.length > 0) {
    throw new Error(`서버 설정 오류: 다음 환경변수가 설정되지 않았습니다 — ${missing.join(", ")}`);
  }
}
