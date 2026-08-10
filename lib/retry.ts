/**
 * 지수 백오프 재시도 헬퍼.
 * onAttemptFailed는 재시도 사이에 로그를 남기고 싶을 때 사용 (선택).
 *
 * 모든 실패 가능 단계(CRETOP 로그인/조회, OpenAI 호출 등)는 이 함수를 통해서만
 * 재시도한다 — 재시도 로직이 호출부마다 제각각 구현되는 것을 막기 위한 단일 창구.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    onAttemptFailed?: (attempt: number, err: unknown) => void | Promise<void>;
  } = {}
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 2000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (options.onAttemptFailed) await options.onAttemptFailed(attempt, err);
      if (attempt < attempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1); // 2s, 4s, 8s...
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
