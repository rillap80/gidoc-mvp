import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase";
import type { CretopData, DeepAnalysisResult } from "@/types";

const CACHE_TTL_DAYS = 30;

/**
 * 회사명 + 재무데이터(크레탑 원자료)를 해시로 묶어 캐시 키를 만든다.
 * 재무데이터가 조금이라도 바뀌면(결산 갱신 등) 해시가 달라져 자동으로 캐시 미스가 되고
 * GPT를 다시 호출한다 — "재무데이터가 변경되지 않았다면" 요구사항을 해시 비교로 충족.
 */
function buildCacheKey(companyName: string, cretop: CretopData): string {
  const financialFingerprint = JSON.stringify({
    revenue: cretop.revenue,
    revenue_prev_year: cretop.revenue_prev_year,
    operating_profit: cretop.operating_profit,
    net_income: cretop.net_income,
    assets: cretop.assets,
    current_assets: cretop.current_assets,
    liabilities: cretop.liabilities,
    current_liabilities: cretop.current_liabilities,
    equity: cretop.equity,
    operating_cashflow: cretop.operating_cashflow,
    credit_grade: cretop.credit_grade,
  });
  return crypto
    .createHash("sha256")
    .update(`${companyName}::${financialFingerprint}`)
    .digest("hex");
}

export async function getCachedAnalysis(
  companyName: string,
  cretop: CretopData
): Promise<DeepAnalysisResult | null> {
  const db = createServiceClient();
  const cacheKey = buildCacheKey(companyName, cretop);

  const { data } = await db
    .from("gpt_cache")
    .select("result, created_at")
    .eq("cache_key", cacheKey)
    .single();

  if (!data) return null;

  const ageMs = Date.now() - new Date(data.created_at).getTime();
  const isExpired = ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  if (isExpired) return null;

  return data.result as DeepAnalysisResult;
}

export async function setCachedAnalysis(
  companyName: string,
  cretop: CretopData,
  result: DeepAnalysisResult
) {
  const db = createServiceClient();
  const cacheKey = buildCacheKey(companyName, cretop);

  await db.from("gpt_cache").upsert(
    {
      cache_key: cacheKey,
      company_name: companyName,
      result,
      created_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" }
  );
}
