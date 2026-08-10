import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
import { createServiceClient } from "@/lib/supabase";
import { runHealthCheckPipeline } from "@/lib/agent";
import { assertRequiredEnv } from "@/lib/env-check";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";

/**
 * Google Apps Script onFormSubmit(e) 트리거에서 호출.
 * responseId를 함께 보내면 Idempotency Key로 사용되어, Apps Script가 네트워크 재시도 등으로
 * 동일 응답을 두 번 보내도 신청이 중복 생성되지 않는다 (applications.form_response_id UNIQUE).
 *
 * 예시 Apps Script:
 *
 * function onFormSubmit(e) {
 *   const row = e.namedValues;
 *   UrlFetchApp.fetch("https://YOUR_DOMAIN/api/webhook/google-form", {
 *     method: "post",
 *     contentType: "application/json",
 *     payload: JSON.stringify({
 *       secret: "GOOGLE_FORM_WEBHOOK_SECRET 값",
 *       companyName: row["회사명"][0],
 *       ceoName: row["대표자명"][0],
 *       responseId: e.response.getId(), // Idempotency Key
 *     }),
 *   });
 * }
 */

const POSTGRES_UNIQUE_VIOLATION = "23505";

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    assertRequiredEnv(["GOOGLE_FORM_WEBHOOK_SECRET"]);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // 보안: 초당 과도한 웹훅 호출 방지 (IP 기준 1분 30회)
  const ip = getClientIp(req);
  if (isRateLimited(`webhook:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
  }

  const body = await req.json();
  const secret = process.env.GOOGLE_FORM_WEBHOOK_SECRET!;

  if (typeof body.secret !== "string" || !timingSafeEqualStr(body.secret, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { companyName, ceoName, responseId } = body;
  if (
    typeof companyName !== "string" ||
    typeof ceoName !== "string" ||
    !companyName.trim() ||
    !ceoName.trim()
  ) {
    return NextResponse.json(
      { error: "companyName, ceoName은 필수입니다." },
      { status: 400 }
    );
  }
  // 과도하게 긴 입력값으로 인한 저장/렌더링 이슈 방지
  if (companyName.length > 200 || ceoName.length > 100) {
    return NextResponse.json({ error: "입력값이 너무 깁니다." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: app, error } = await db
    .from("applications")
    .insert({
      company_name: companyName.trim(),
      ceo_name: ceoName.trim(),
      raw_form_response: body,
      form_response_id: responseId ?? null,
    })
    .select()
    .single();

  if (error) {
    // Idempotency: 동일 responseId로 이미 접수된 건이면 새로 만들지 않고 기존 건을 반환
    if (error.code === POSTGRES_UNIQUE_VIOLATION && responseId) {
      const { data: existing } = await db
        .from("applications")
        .select("id")
        .eq("form_response_id", responseId)
        .single();
      if (existing) {
        return NextResponse.json({ applicationId: existing.id, resultUrl: `/result/${existing.id}`, deduped: true });
      }
    }
    console.error("[webhook] applications insert 실패:", error.message);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }

  // 3분 이내 완료 목표 — 응답은 즉시 반환하고 파이프라인은 비동기로 실행.
  // ⚠️ Vercel Functions는 응답을 보낸 직후 함수 인스턴스를 바로 얼릴 수 있어, 그냥
  // await 없이 던져두면(fire-and-forget) 파이프라인이 중간에 끊길 수 있다. waitUntil()로
  // 감싸면 응답은 즉시 나가면서도 이 Promise가 끝날 때까지 함수 인스턴스가 유지된다
  // (Vercel 외 환경에서는 안전하게 무시되고 그냥 백그라운드로 실행됨).
  // 트래픽이 커지면 Supabase Edge Function 큐나 QStash 같은 별도 작업 큐로 옮기는 것을 권장한다.
  waitUntil(
    runHealthCheckPipeline(app.id).catch((e) =>
      console.error("파이프라인 오류:", e instanceof Error ? e.message : e)
    )
  );

  // 관리자 알림 — 실패해도 절대 파이프라인/응답에 영향을 주지 않는다 (notify()는 예외를 던지지 않음).
  // 사업자번호/연락처는 이 시점(1차 정보 입력 직후)에는 아직 확보되지 않아 비어있을 수 있다 —
  // 폼에 연락처 필드를 추가했다면 body.phone으로 자동 반영된다.
  const adminUrl = new URL("/admin", req.url).origin + "/admin";
  const resultUrl = new URL(`/result/${app.id}`, req.url).toString();
  waitUntil(
    notify({
      event: "new_application",
      applicationId: app.id,
      companyName: app.company_name,
      ceoName: app.ceo_name,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      bizRegNo: app.biz_reg_no ?? undefined,
      receivedAt: app.created_at,
      links: [
        { label: "관리자 페이지 바로가기", url: adminUrl },
        { label: "결과 화면 보기", url: resultUrl },
      ],
    })
  );

  return NextResponse.json({ applicationId: app.id, resultUrl: `/result/${app.id}` });
}
