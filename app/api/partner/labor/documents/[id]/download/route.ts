import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { checkLaborPartnerAuth } from "@/lib/labor-partner-auth";
import { isValidUuid } from "@/lib/validate";
import { logStep } from "@/lib/logger";

const BUCKET = "labor-documents";
const SIGNED_URL_TTL_SECONDS = 120; // 짧게 만료시켜 URL이 새어나가도 금방 무효화되게 한다

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
  const { data: doc } = await db
    .from("labor_documents")
    .select("storage_path, file_name, application_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: signed, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, { download: doc.file_name });

  if (error || !signed) {
    console.error("[partner/labor/documents/download] 서명 URL 생성 실패:", error?.message);
    return NextResponse.json({ error: "다운로드 링크 생성 실패" }, { status: 500 });
  }

  await logStep({
    application_id: doc.application_id,
    step: "labor_document_download",
    status: "success",
    message: `partner ${auth.partnerId} downloaded ${doc.file_name}`,
  });

  return NextResponse.json({ url: signed.signedUrl });
}
