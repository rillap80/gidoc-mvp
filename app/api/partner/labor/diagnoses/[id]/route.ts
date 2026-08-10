import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { checkLaborPartnerAuth } from "@/lib/labor-partner-auth";
import { isValidUuid } from "@/lib/validate";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const accessCode = req.headers.get("x-partner-code");
  const auth = await checkLaborPartnerAuth(req, accessCode);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "rate_limited" ? 429 : 401 });
  }

  if (!isValidUuid(params.id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const db = createServiceClient();

  const { data: diagnosis, error } = await db
    .from("labor_diagnosis")
    .select(
      "id, application_id, employee_count, insurance_status, hiring_last_year, leaving_last_year, subsidy_status, main_question, status, created_at, applications(company_name, ceo_name)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!diagnosis) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });

  // 연락처: 노무 6문항에는 없고, 별도 상담 신청(deep_reports)에 남겼다면 best-effort로 함께 보여준다
  const { data: contact } = await db
    .from("deep_reports")
    .select("phone_number")
    .eq("application_id", diagnosis.application_id)
    .maybeSingle();

  const { data: documents } = await db
    .from("labor_documents")
    .select("id, file_name, file_type, file_size, uploaded_at")
    .eq("diagnosis_id", params.id)
    .order("uploaded_at", { ascending: false });

  return NextResponse.json({
    diagnosis,
    phone: contact?.phone_number ?? null,
    documents: documents ?? [],
  });
}
