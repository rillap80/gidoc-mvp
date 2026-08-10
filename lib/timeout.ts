export class TimeoutError extends Error {
  constructor(message = "작업이 제한 시간을 초과했습니다.") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * fn이 timeoutMs 안에 끝나지 않으면 TimeoutError를 던진다.
 * fn 자체를 취소하지는 않는다(fetch AbortController가 아니므로) — OpenAI SDK 호출은
 * 별도로 AbortSignal을 지원하면 그쪽을 우선 사용하고, 이 래퍼는 안전망으로 둔다.
 */
export function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(`${label}이(가) ${timeoutMs}ms 안에 완료되지 않았습니다.`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
