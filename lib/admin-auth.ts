import crypto from "crypto";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

/**
 * 문자열 길이/내용에 따라 비교 시간이 달라지는 `===` 대신 타이밍 공격에 안전한 비교를 사용한다.
 * 두 값의 길이가 다르면 즉시 false (timingSafeEqual은 같은 길이의 버퍼만 비교 가능).
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * 관리자 API 공통 인증. 성공 시 null, 실패 시 사유 문자열을 반환한다.
 * 브루트포스 방지를 위해 IP당 1분에 20회로 제한한다.
 */
export function checkAdminAuth(req: Request, providedKey: string | null): string | null {
  const ip = getClientIp(req);
  if (isRateLimited(`admin-auth:${ip}`, 20, 60_000)) {
    return "rate_limited";
  }

  const expected = process.env.ADMIN_ACCESS_KEY;
  if (!expected) return "server_misconfigured";
  if (!providedKey) return "unauthorized";
  if (!timingSafeEqual(providedKey, expected)) return "unauthorized";

  return null;
}
