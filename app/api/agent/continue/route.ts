import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { continuePipelineAfterCretop } from "@/lib/agent";
import { assertRequiredEnv } from "@/lib/env-check";
import { isValidUuid } from "@/lib/validate";

/**
 * worker/cretop-worker.ts 전용 콜백.
 * body: { applicationId, secret }
 * secret은 GOOGLE_FORM_WEBHOOK_SECRET을 재사용해도 되고, 별도 WORKER_CALLBACK_SECRET을 둬도 된다.
 */

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

  const { applicationId, secret } = await req.json();
  const expected = process.env.GOOGLE_FORM_WEBHOOK_SECRET!;

  if (typeof secret !== "string" || !timingSafeEqualStr(secret, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isValidUuid(applicationId)) {
    return NextResponse.json({ error: "applicationId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const result = await continuePipelineAfterCretop(applicationId);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
