import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase";
import { checkAdminAuth } from "@/lib/admin-auth";

function generateAccessCode(): string {
  return `LABOR-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  const authFailure = checkAdminAuth(req, req.nextUrl.searchParams.get("key"));
  if (authFailure === "rate_limited") {
    return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
  }
  if (authFailure) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("labor_partner_users")
    .select("id, partner_name, access_code, is_active, expires_at, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partners: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authFailure = checkAdminAuth(req, body.key ?? null);
  if (authFailure === "rate_limited") {
    return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
  }
  if (authFailure) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const partnerName = typeof body.partnerName === "string" ? body.partnerName.slice(0, 100) : "노무법인";
  const accessCode = generateAccessCode();

  const db = createServiceClient();
  const { data, error } = await db
    .from("labor_partner_users")
    .insert({
      partner_id: crypto.randomUUID(),
      partner_name: partnerName,
      access_code: accessCode,
      is_active: true,
    })
    .select("id, partner_name, access_code")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner: data });
}
