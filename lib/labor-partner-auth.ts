import { createServiceClient } from "@/lib/supabase";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

export interface LaborPartnerAuthResult {
  ok: boolean;
  partnerId?: string;
  reason?: "rate_limited" | "invalid_code" | "inactive" | "expired" | "missing_code";
}

/**
 * 노무법인 담당자 코드 검증. 프론트엔드는 이 코드를 sessionStorage에 들고 있다가
 * 매 API 호출마다 함께 보내고, 서버는 "매번" 다시 이 함수로 검증한다 —
 * 프론트에서 버튼만 숨기는 방식으로 권한을 처리하지 않는다는 요구사항을 지키기 위함이다.
 */
export async function checkLaborPartnerAuth(
  req: Request,
  accessCode: string | null
): Promise<LaborPartnerAuthResult> {
  const ip = getClientIp(req);
  if (isRateLimited(`labor-partner-auth:${ip}`, 30, 60_000)) {
    return { ok: false, reason: "rate_limited" };
  }
  if (!accessCode) {
    return { ok: false, reason: "missing_code" };
  }

  const db = createServiceClient();
  const { data } = await db
    .from("labor_partner_users")
    .select("partner_id, is_active, expires_at")
    .eq("access_code", accessCode)
    .maybeSingle();

  if (!data) return { ok: false, reason: "invalid_code" };
  if (!data.is_active) return { ok: false, reason: "inactive" };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, partnerId: data.partner_id };
}
