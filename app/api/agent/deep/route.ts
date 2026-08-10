import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createServiceClient } from "@/lib/supabase";
import { generateDeepReportPdf } from "@/lib/pdf";
import { uploadPdfToDrive, appendResultToSheet } from "@/lib/google";
import { withStepLog, logStep } from "@/lib/logger";
import { notify } from "@/lib/notifications";
import { assertRequiredEnv } from "@/lib/env-check";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validate";
import { retryWithBackoff } from "@/lib/retry";
import { withTimeout, TimeoutError } from "@/lib/timeout";
import { openaiCircuitBreaker, CircuitOpenError } from "@/lib/circuit-breaker";
import { estimateCostUsd } from "@/lib/openai-cost";
import OpenAI from "openai";
import type { DeepAnalysisResult, RiskGrade, ScoreBreakdown, StarRatings } from "@/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_TIMEOUT_MS = 90_000;

/**
 * body: { applicationId, phoneNumber, step: 'request_consultation' }
 *
 * v10: 실제 SMS 인증 없이 "본인 인증 완료"처럼 보이면 안 되므로, 전화번호 입력을 인증이 아니라
 * "상담 신청 접수"로 명확히 처리한다 (A안). phone_verified는 실제 인증 수단이 생기기 전까지
 * 항상 false로 유지한다 — 관리자가 전화로 직접 확인하는 것을 전제로 한다.
 */
export async function POST(req: NextRequest) {
  try {
    assertRequiredEnv();
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const body = await req.json();
  const db = createServiceClient();

  if (!isValidUuid(body.applicationId)) {
    return NextResponse.json({ error: "applicationId 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (body.step === "request_consultation") {
    // 보안: 동일 IP/전화번호로 상담 신청 남용 방지 — 10분에 5회
    const ip = getClientIp(req);
    if (isRateLimited(`deep-req:${ip}`, 5, 10 * 60_000) || isRateLimited(`deep-req:${body.phoneNumber}`, 5, 10 * 60_000)) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }, { status: 429 });
    }
    if (typeof body.phoneNumber !== "string" || !/^01[0-9]-?\d{3,4}-?\d{4}$/.test(body.phoneNumber)) {
      return NextResponse.json({ error: "휴대폰 번호 형식이 올바르지 않습니다." }, { status: 400 });
    }

    // Idempotency: 이미 생성 중이거나 완료된 건이면 중복 실행하지 않는다.
    const { data: existingDeep } = await db
      .from("deep_reports")
      .select("status, pdf_url")
      .eq("application_id", body.applicationId)
      .maybeSingle();

    if (existingDeep?.status === "generating") {
      return NextResponse.json({ status: "generating" });
    }
    if (existingDeep?.status === "completed") {
      return NextResponse.json({ status: "completed", pdfUrl: existingDeep.pdf_url });
    }

    const { data: app } = await db
      .from("applications")
      .select("id, company_name, ceo_name")
      .eq("id", body.applicationId)
      .single();
    const { data: healthReport } = await db
      .from("health_reports")
      .select("*")
      .eq("application_id", body.applicationId)
      .single();

    if (!app || !healthReport) {
      return NextResponse.json({ error: "선행 데이터 없음" }, { status: 400 });
    }

    // phone_verified는 실제 인증을 구현하기 전까지 절대 true로 두지 않는다 — 여기 남기는 값은
    // "상담을 요청하며 남긴 연락처"이지 인증된 본인확인이 아니다. 관리자가 실제로 전화해서 확인한다.
    await db.from("deep_reports").upsert(
      {
        application_id: body.applicationId,
        phone_number: body.phoneNumber,
        phone_verified: false,
        status: "generating",
      },
      { onConflict: "application_id" }
    );

    // 성능: PDF 생성 + Drive 업로드 + Sheet 기록은 느릴 수 있으므로 응답을 기다리게 하지 않고
    // 백그라운드에서 진행한다. 진행 상태는 report 페이지가 deep_reports.status를 폴링해서 보여준다.
    // waitUntil()로 감싸 Vercel이 응답 직후 함수를 얼려도 이 작업이 끝까지 실행되게 한다.
    waitUntil(
      generateAndSaveDeepReport(app, healthReport, body.phoneNumber).catch((e) =>
        console.error("[deep] 백그라운드 생성 실패:", e instanceof Error ? e.message : e)
      )
    );

    return NextResponse.json({ status: "generating" });
  }

  return NextResponse.json({ error: "invalid step" }, { status: 400 });
}

async function generateAndSaveDeepReport(
  app: { id: string; company_name: string; ceo_name: string },
  healthReport: {
    analysis: unknown;
    risk_grade: string;
    score_breakdown: unknown;
    star_ratings: unknown;
    health_score: number;
  },
  phoneNumber: string
) {
  const db = createServiceClient();
  const applicationId = app.id;
  const analysis = healthReport.analysis as DeepAnalysisResult;
  const riskGrade = healthReport.risk_grade as RiskGrade;
  const breakdown = healthReport.score_breakdown as ScoreBreakdown;
  const starRatings = healthReport.star_ratings as StarRatings;

  try {
    // STEP10: 심층 종합의견 + 우선순위 + 실행전략 생성 (90초 타임아웃 + 3회 재시도 + Circuit Breaker)
    const deep = await withStepLog(applicationId, "deep_analysis", async () => {
      if (!openaiCircuitBreaker.canAttempt()) throw new CircuitOpenError();

      const start = Date.now();
      try {
        const completion = await retryWithBackoff(
          () =>
            withTimeout(
              () =>
                openai.chat.completions.create({
                  model: "gpt-4o",
                  response_format: { type: "json_object" },
                  messages: [
                    {
                      role: "system",
                      content:
                        '너는 기업 경영 컨설턴트다. 아래 스키마의 JSON만 응답하라: {"comprehensive_opinion": "...", "priorities": ["...","..."], "action_plan": ["...","..."]}. 보험/상품 판매 유도 표현 금지.',
                    },
                    {
                      role: "user",
                      content: `회사: ${app.company_name}\n재무위험등급: ${riskGrade}\n분석결과: ${JSON.stringify(
                        analysis
                      )}`,
                    },
                  ],
                }),
              OPENAI_TIMEOUT_MS,
              "심층 종합의견 호출"
            ),
          {
            attempts: 3,
            baseDelayMs: 3000,
            onAttemptFailed: (attempt, err) => {
              const message = err instanceof Error ? err.message : String(err);
              return logStep({
                application_id: applicationId,
                step: "deep_analysis",
                status: "retry",
                message: `${attempt}회차 시도 실패(${err instanceof TimeoutError ? "timeout" : "error"}): ${message}`,
              });
            },
          }
        );

        let parsed: { comprehensive_opinion?: string; priorities?: string[]; action_plan?: string[] };
        try {
          parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
        } catch {
          throw new Error("OpenAI 응답이 유효한 JSON이 아닙니다.");
        }

        openaiCircuitBreaker.recordSuccess();
        await logStep({
          application_id: applicationId,
          step: "deep_analysis",
          status: "success",
          token_usage: completion.usage?.total_tokens,
          duration_ms: Date.now() - start,
          cost_usd: estimateCostUsd("gpt-4o", completion.usage?.total_tokens),
        });
        return parsed;
      } catch (err) {
        openaiCircuitBreaker.recordFailure();
        throw err;
      }
    });

    const pdfBuffer = await withStepLog(applicationId, "report_pdf", () =>
      generateDeepReportPdf({
        companyName: app.company_name,
        ceoName: app.ceo_name,
        healthScore: healthReport.health_score,
        riskGrade,
        scoreBreakdown: breakdown,
        starRatings,
        oneLineAdvice: analysis.one_line_advice,
        sections: [
          { title: "현금흐름", body: analysis.cashflow.detail ?? analysis.cashflow.summary },
          { title: "부채위험", body: analysis.debt_risk.detail ?? analysis.debt_risk.summary },
          { title: "성장성", body: analysis.growth.detail ?? analysis.growth.summary },
          { title: "수익성", body: analysis.profitability.detail ?? analysis.profitability.summary },
          { title: "정부지원", body: analysis.gov_support.detail ?? analysis.gov_support.summary },
          { title: "절세", body: analysis.tax_saving.detail ?? analysis.tax_saving.summary },
          { title: "노무 리스크", body: analysis.labor_risk.detail ?? analysis.labor_risk.summary },
          { title: "보험 리스크", body: analysis.insurance_risk.detail ?? analysis.insurance_risk.summary },
          { title: "특허/IP 전략", body: analysis.patent_ip.detail ?? analysis.patent_ip.summary },
          { title: "정책자금 가능성", body: analysis.policy_fund.detail ?? analysis.policy_fund.summary },
          { title: "벤처기업 인증 가능성", body: analysis.venture_cert.detail ?? analysis.venture_cert.summary },
          { title: "AI 종합의견", body: deep.comprehensive_opinion ?? "" },
        ],
        priorities: deep.priorities ?? [],
        actionPlan: deep.action_plan ?? [],
      })
    );

    // STEP11: Drive 저장
    let pdfUrl = "";
    try {
      pdfUrl = await uploadPdfToDrive(`${app.company_name}_심층건강검진.pdf`, pdfBuffer);
    } catch (e) {
      console.error("Drive 업로드 실패, PDF URL 없이 진행:", e instanceof Error ? e.message : e);
    }

    await db
      .from("deep_reports")
      .update({ deep_analysis: deep, pdf_url: pdfUrl || null, status: "completed" })
      .eq("application_id", applicationId);

    await db.from("applications").update({ status: "deep_completed" }).eq("id", applicationId);

    // 관리자 알림 — 실패해도 절대 파이프라인을 막지 않는다.
    // (Vercel: 이 함수를 감싼 바깥쪽 waitUntil이 끝까지 살아있으려면 여기서도 await 필요)
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

    await notify({
      event: "deep_report_completed",
      applicationId,
      companyName: app.company_name,
      ceoName: app.ceo_name,
      phone: phoneNumber,
      healthScore: healthReport.health_score,
      riskGrade,
      receivedAt: new Date().toISOString(),
      links: [
        ...(pdfUrl ? [{ label: "PDF 보기", url: pdfUrl }] : []),
        { label: "관리자 열기", url: `${siteUrl}/admin` },
        { label: "상담 시작", url: `${siteUrl}/admin?focus=${applicationId}` },
      ],
    });

    // STEP11: Sheet/CRM 기록 (Sheet 실패해도 파이프라인은 성공 처리)
    try {
      await appendResultToSheet([
        app.company_name,
        app.ceo_name,
        healthReport.health_score,
        riskGrade,
        pdfUrl,
        new Date().toISOString(),
      ]);
    } catch (e) {
      console.error("Sheet 기록 실패:", e instanceof Error ? e.message : e);
    }
    // TODO: 별도 CRM(예: HubSpot, 자체 CRM) 연동 시 여기서 호출
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error(`[deep] 생성 실패 (${applicationId}):`, message);
    await db
      .from("deep_reports")
      .update({ status: "error", error_message: message })
      .eq("application_id", applicationId);
  }
}
