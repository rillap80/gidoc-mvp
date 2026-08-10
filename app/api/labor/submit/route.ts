import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validate";
import { logStep } from "@/lib/logger";

const INSURANCE_VALUES = ["all", "partial", "none", "unknown"] as const;
const SUBSIDY_VALUES = ["current", "past", "none", "unknown"] as const;

/**
 * 노무 정밀진단 6개 기본질문 제출. 자유 입력(main_question)은 500자로 제한한다
 * (과도한 텍스트로 인한 저장/렌더링 문제 방지 — 세부 상담은 노무법인에서 진행하므로
 * 여기서는 짧은 요약만 받으면 된다).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`labor-submit:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
  }

  const body = await req.json();
  const { applicationId, employeeCount, insuranceStatus, hiringLastYear, leavingLastYear, subsidyStatus, mainQuestion } = body;

  if (!isValidUuid(applicationId)) {
    return NextResponse.json({ error: "applicationId 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (typeof employeeCount !== "number" || employeeCount < 0 || employeeCount > 100000) {
    return NextResponse.json({ error: "직원 수를 확인해주세요." }, { status: 400 });
  }
  if (!INSURANCE_VALUES.includes(insuranceStatus)) {
    return NextResponse.json({ error: "4대보험 가입 여부를 확인해주세요." }, { status: 400 });
  }
  if (typeof hiringLastYear !== "boolean" || typeof leavingLastYear !== "boolean") {
    return NextResponse.json({ error: "채용/퇴사 여부를 확인해주세요." }, { status: 400 });
  }
  if (!SUBSIDY_VALUES.includes(subsidyStatus)) {
    return NextResponse.json({ error: "정부지원금 수령 여부를 확인해주세요." }, { status: 400 });
  }
  if (typeof mainQuestion !== "string" || mainQuestion.length > 500) {
    return NextResponse.json({ error: "궁금한 점은 500자 이내로 입력해주세요." }, { status: 400 });
  }

  const db = createServiceClient();

  // 회사(=applications 레코드)가 실제 존재하는지 확인 — 임의 UUID로 신청이 만들어지는 것 방지
  const { data: app } = await db.from("applications").select("id").eq("id", applicationId).maybeSingle();
  if (!app) {
    return NextResponse.json({ error: "신청 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: diagnosis, error } = await db
    .from("labor_diagnosis")
    .upsert(
      {
        application_id: applicationId,
        employee_count: employeeCount,
        insurance_status: insuranceStatus,
        hiring_last_year: hiringLastYear,
        leaving_last_year: leavingLastYear,
        subsidy_status: subsidyStatus,
        main_question: mainQuestion.slice(0, 500),
        status: "submitted",
      },
      { onConflict: "application_id" }
    )
    .select("id")
    .single();

  if (error || !diagnosis) {
    console.error("[labor/submit] 저장 실패:", error?.message);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }

  await logStep({ application_id: applicationId, step: "labor_diagnosis_submit", status: "success" });

  return NextResponse.json({ diagnosisId: diagnosis.id });
}
