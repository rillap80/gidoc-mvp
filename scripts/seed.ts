/**
 * 로컬/스테이징 Supabase에 테스트용 신청 건을 채워 넣는 Seed Script.
 * 실행: npx tsx scripts/seed.ts  (루트에서, .env.local의 SUPABASE 값이 필요)
 *
 * 주의: OpenAI/크레탑을 실제로 호출하지 않는다 — health_reports/logs까지 전부
 * 이 스크립트 안에서 그럴듯한 값으로 직접 채워 넣는 "완전 Mock 시드"다.
 * 실제 파이프라인 동작을 테스트하려면 /api/webhook/google-form을 직접 호출할 것.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const SAMPLE_COMPANIES = [
  { company_name: "대한정밀", ceo_name: "김대표" },
  { company_name: "한빛물류", ceo_name: "이대표" },
  { company_name: "서진테크", ceo_name: "박대표" },
  { company_name: "미래바이오", ceo_name: "최대표" },
  { company_name: "동탄식품", ceo_name: "정대표" },
];

const RISK_GRADES = ["A", "B", "C", "D", "E"] as const;

async function seed() {
  console.log("[seed] 테스트 데이터 생성 시작...");

  for (const company of SAMPLE_COMPANIES) {
    const { data: app, error } = await db
      .from("applications")
      .insert({
        company_name: company.company_name,
        ceo_name: company.ceo_name,
        status: "completed",
        source: "seed_script",
      })
      .select()
      .single();

    if (error || !app) {
      console.error(`[seed] ${company.company_name} 생성 실패:`, error?.message);
      continue;
    }

    const healthScore = 55 + Math.floor(Math.random() * 40);
    const riskGrade = RISK_GRADES[Math.floor(Math.random() * RISK_GRADES.length)];

    await db.from("health_reports").insert({
      application_id: app.id,
      health_score: healthScore,
      risk_grade: riskGrade,
      score_breakdown: {
        revenue_growth_rate: null,
        operating_margin: null,
        debt_ratio: null,
        current_ratio: null,
        roe: null,
        roa: null,
        cashflow_positive: null,
        sub_scores: {},
        weights_used: {},
        data_completeness: 0,
        notes: "seed script — 실제 재무 원자료 없음",
      },
      star_ratings: { finance: 3, growth: 3, stability: 3, tax: 3, gov_support: 3, patent: 3, labor: 3 },
      findings: ["시드 데이터 — 실제 분석 아님"],
    });

    await db.from("logs").insert({
      application_id: app.id,
      step: "seed",
      status: "success",
      message: "seed script로 생성된 테스트 데이터",
    });

    console.log(`[seed] ${company.company_name} 생성 완료 (건강점수 ${healthScore}, 등급 ${riskGrade})`);
  }

  console.log("[seed] 완료.");
}

seed().catch((e) => {
  console.error("[seed] 실패:", e);
  process.exit(1);
});
