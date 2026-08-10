import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validate";
import { logStep } from "@/lib/logger";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "hwp", "jpg", "jpeg", "png"];
const BUCKET = "labor-documents";

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * multipart/form-data: applicationId, diagnosisId, file
 * 파일은 업로드 전용 목적으로만 존재 — 공개 URL을 발급하지 않는다(private 버킷).
 * 다운로드는 노무법인 담당자 인증을 거친 /api/partner/labor/... 경로에서만 가능하다.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`labor-upload:${ip}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
  }

  const formData = await req.formData();
  const applicationId = formData.get("applicationId");
  const diagnosisId = formData.get("diagnosisId");
  const file = formData.get("file");

  if (typeof applicationId !== "string" || !isValidUuid(applicationId)) {
    return NextResponse.json({ error: "applicationId 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (typeof diagnosisId !== "string" || !isValidUuid(diagnosisId)) {
    return NextResponse.json({ error: "diagnosisId 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "파일 용량은 15MB 이하만 가능합니다." }, { status: 400 });
  }
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 });
  }

  const db = createServiceClient();

  // diagnosisId가 실제로 이 applicationId 소유인지 확인 — 다른 회사 진단건에 파일을 붙이는 것 방지
  const { data: diagnosis } = await db
    .from("labor_diagnosis")
    .select("id")
    .eq("id", diagnosisId)
    .eq("application_id", applicationId)
    .maybeSingle();
  if (!diagnosis) {
    return NextResponse.json({ error: "진단 신청 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  const storagePath = `${applicationId}/${diagnosisId}/${Date.now()}-${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await db.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    console.error("[labor/upload] Storage 업로드 실패:", uploadError.message);
    return NextResponse.json({ error: "파일 업로드 실패" }, { status: 500 });
  }

  const { error: dbError } = await db.from("labor_documents").insert({
    diagnosis_id: diagnosisId,
    application_id: applicationId,
    file_name: file.name,
    storage_path: storagePath,
    file_type: file.type || ext,
    file_size: file.size,
  });

  if (dbError) {
    console.error("[labor/upload] DB 기록 실패:", dbError.message);
    return NextResponse.json({ error: "파일 정보 저장 실패" }, { status: 500 });
  }

  await logStep({ application_id: applicationId, step: "labor_document_upload", status: "success", message: file.name });

  return NextResponse.json({ ok: true });
}
