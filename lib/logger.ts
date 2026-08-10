import { createServiceClient } from "@/lib/supabase";
import type { LogEntry } from "@/types";

/**
 * 로그 메시지에 실수로 자격증명/개인정보가 남지 않도록 흔한 패턴을 마스킹한다.
 * 완벽한 탐지는 아니며, 애초에 호출부에서 민감정보를 message에 넣지 않는 것이 원칙이다.
 */
function scrub(message?: string | null): string | undefined {
  if (!message) return undefined;
  return message
    .replace(/\b\d{6}\b/g, "******") // OTP 등 6자리 숫자
    .replace(/(password|pw|pwd)\s*[:=]\s*\S+/gi, "$1=***")
    .replace(/(api[_-]?key)\s*[:=]\s*\S+/gi, "$1=***");
}

/**
 * 파이프라인의 각 단계 실행을 logs 테이블에 기록한다.
 * 로깅 실패가 본 파이프라인을 막으면 안 되므로 내부에서 예외를 삼킨다.
 */
export async function logStep(entry: LogEntry) {
  try {
    const db = createServiceClient();
    await db.from("logs").insert({
      application_id: entry.application_id,
      step: entry.step,
      status: entry.status,
      message: scrub(entry.message) ?? null,
      token_usage: entry.token_usage ?? null,
      duration_ms: entry.duration_ms ?? null,
      cost_usd: entry.cost_usd ?? null,
      retry_count: entry.retry_count ?? null,
    });
  } catch (e) {
    console.error("[logger] logs 테이블 기록 실패:", e);
  }
}

/**
 * 실행 시간(ms)을 자동으로 재서 success/error 로그를 남기는 래퍼.
 * 사용 예:
 *   const cretop = await withStepLog(applicationId, "cretop", () => getCretopData(...));
 */
export async function withStepLog<T>(
  applicationId: string,
  step: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  await logStep({ application_id: applicationId, step, status: "started" });

  try {
    const result = await fn();
    await logStep({
      application_id: applicationId,
      step,
      status: "success",
      duration_ms: Date.now() - start,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    await logStep({
      application_id: applicationId,
      step,
      status: "error",
      message,
      duration_ms: Date.now() - start,
    });
    throw err;
  }
}
