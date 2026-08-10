import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { checkLaborPartnerAuth } from "@/lib/labor-partner-auth";

export async function GET(req: NextRequest) {
  const accessCode = req.headers.get("x-partner-code");
  const auth = await checkLaborPartnerAuth(req, accessCode);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "rate_limited" ? 429 : 401 });
  }

  const db = createServiceClient();

  // MVP: partner_id로 필터링하지 않고 활성 노무법인 담당자 전원이 전체 노무 신청 건을 본다
  // (labor_diagnosis.partner_id 컬럼은 다음 버전에서 담당자별 배정을 붙일 자리로 남겨둠)
  const { data, error } = await db
    .from("labor_diagnosis")
    .select(
      "id, employee_count, insurance_status, status, created_at, application_id, applications(company_name, ceo_name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ diagnoses: data ?? [] });
}
