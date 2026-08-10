import { NextRequest, NextResponse } from "next/server";
import { checkLaborPartnerAuth } from "@/lib/labor-partner-auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await checkLaborPartnerAuth(req, typeof body.accessCode === "string" ? body.accessCode : null);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.reason === "rate_limited" ? 429 : 401 });
  }

  return NextResponse.json({ ok: true });
}
