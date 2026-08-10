"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  STEP_DEFS,
  getStepStates,
  STATUS_TITLE,
  STATUS_DESCRIPTION,
  type StepState,
} from "@/lib/pipeline-status";
import type { ApplicationStatus, RiskGrade, StarRatings } from "@/types";
import { generateMockDashboardData, formatManwon } from "@/lib/mock/dashboard-data";
import { getSimilarCompanyStats } from "@/lib/mock/similar-companies";

interface HealthReport {
  health_score: number;
  risk_grade: RiskGrade;
  star_ratings: StarRatings;
  findings: string[];
}

const STAR_LABELS: Record<keyof StarRatings, string> = {
  finance: "재무",
  growth: "성장성",
  stability: "안정성",
  tax: "절세",
  gov_support: "정부지원",
  patent: "특허",
  labor: "노무",
};

const RISK_GRADE_COLOR: Record<RiskGrade, string> = {
  A: "bg-vital-200 text-vital-600",
  B: "bg-vital-200 text-vital-600",
  C: "bg-amber-400/20 text-amber-500",
  D: "bg-amber-400/20 text-amber-500",
  E: "bg-red-100 text-red-600",
};

function Stars({ value }: { value: number }) {
  return (
    <span className="font-mono text-vital-600 tracking-tighter">
      {"★".repeat(value)}
      <span className="text-line">{"★".repeat(5 - value)}</span>
    </span>
  );
}

// ── STEP1~6 단계형 Progress UI ───────────────────────────────
function StepIcon({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="w-6 h-6 rounded-full bg-vital-500 text-white flex items-center justify-center text-xs shrink-0">
        ✓
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="w-6 h-6 rounded-full border-2 border-vital-500 border-t-transparent animate-spin shrink-0" />
    );
  }
  if (state === "error") {
    return (
      <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shrink-0">
        !
      </span>
    );
  }
  return <span className="w-6 h-6 rounded-full bg-line shrink-0" />;
}

function StepProgress({ status }: { status: ApplicationStatus }) {
  const states = getStepStates(status);
  return (
    <div className="space-y-3">
      {STEP_DEFS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-3">
          <StepIcon state={states[i]} />
          <span
            className={clsx(
              "text-sm",
              states[i] === "active" && "text-ink-950 font-medium",
              states[i] === "done" && "text-ink-700/60",
              states[i] === "pending" && "text-ink-700/30",
              states[i] === "error" && "text-red-600 font-medium"
            )}
          >
            STEP{i + 1} {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-700/50 mb-1.5">
        <span>진행률</span>
        <span className="font-mono num">{percent}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-line overflow-hidden">
        <div
          className="h-full bg-vital-500 transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// 남은 시간 추정 — 전체 파이프라인 목표치(약 150초) 대비 현재 퍼센트로 대략치를 보여준다.
// 정확한 예측이 아니라 "대기 중임을 체감하게 하는" 용도이므로 범위로 표현한다.
const ESTIMATED_TOTAL_SECONDS = 150;
function estimateRemainingLabel(percent: number): string {
  if (percent >= 100) return "";
  const remaining = Math.max(10, Math.round((ESTIMATED_TOTAL_SECONDS * (100 - percent)) / 100));
  if (remaining < 60) return `약 ${remaining}초 남았습니다`;
  return `약 ${Math.ceil(remaining / 60)}분 남았습니다`;
}

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>("received");
  const [percent, setPercent] = useState(10);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 새로고침/재접속해도 이 polling이 서버의 현재 상태를 그대로 이어받는다 —
  // 분석 자체는 서버(백엔드 파이프라인)에서 계속 진행되므로 페이지를 닫아도 유실되지 않는다.
  // 성능 최적화: 폴링 간격을 2초→8초로 점차 늘리고(서버 부하 감소), 탭이 백그라운드에
  // 있는 동안은 폴링을 잠시 멈춘다(불필요한 네트워크 요청 절약).
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let intervalMs = 2000;
    const MAX_INTERVAL_MS = 8000;

    async function poll() {
      if (document.visibilityState === "hidden") {
        setTimeout(poll, intervalMs);
        return;
      }

      attempts += 1;
      let data: {
        application?: { status?: ApplicationStatus; error_message?: string };
        report?: HealthReport;
        progressPercent?: number;
      };
      try {
        const res = await fetch(`/api/agent/run?applicationId=${id}`);
        data = await res.json();
      } catch {
        // 네트워크 일시 오류 — 다음 폴링에서 재시도 (별도 에러 처리 없이 넘어감)
        if (attempts < 90) setTimeout(poll, intervalMs);
        return;
      }
      if (cancelled) return;

      const currentStatus = (data.application?.status ?? "received") as ApplicationStatus;
      setStatus(currentStatus);
      setPercent(data.progressPercent ?? 10);

      if (currentStatus === "error") {
        setErrorMsg(data.application?.error_message ?? "분석 중 오류가 발생했습니다.");
        return;
      }
      if (data.report) {
        setReport(data.report);
        return; // 완료 — 폴링 중단
      }
      // 3분 내 목표 — 점진적으로 폴링 간격을 늘려가며 최대 90회(약 6~7분) 시도
      intervalMs = Math.min(MAX_INTERVAL_MS, intervalMs + 1000);
      if (attempts < 90) setTimeout(poll, intervalMs);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (errorMsg) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-2xl">
            !
          </div>
          <p className="font-display text-2xl mb-3">분석을 완료하지 못했습니다</p>
          <p className="text-ink-700/70 text-sm mb-4">{errorMsg}</p>
          <div className="bg-white rounded-xl2 shadow-card p-5 text-left">
            <p className="text-sm text-ink-800 mb-1">걱정하지 않으셔도 됩니다.</p>
            <p className="text-xs text-ink-700/60 leading-relaxed">
              담당자가 확인 후 분석을 다시 진행해 드립니다. 신청하신 내용은 안전하게 저장되어 있으니
              다시 신청하실 필요는 없습니다.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!report) {
    const title = STATUS_TITLE[status] ?? "기업 데이터를 분석하고 있습니다";
    const description =
      STATUS_DESCRIPTION[status] ??
      "재무·성장성·정부지원·특허·노무 데이터를 대조하는 중입니다. 잠시만 기다려주세요.";
    const remainingLabel = estimateRemainingLabel(percent);

    return (
      <main className="min-h-screen flex items-center justify-center px-4 sm:px-6">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-xl2 shadow-card p-6 sm:p-8 text-center mb-6 sm:mb-8">
            <p className="font-display text-lg sm:text-xl mb-2">{title}</p>
            <p className="text-ink-700/60 text-sm whitespace-pre-line mb-2">{description}</p>
            {remainingLabel && (
              <p className="text-vital-600 text-xs font-medium mb-6">{remainingLabel}</p>
            )}
            {!remainingLabel && <div className="mb-6" />}
            <ProgressBar percent={percent} />
          </div>

          <div className="bg-white rounded-xl2 shadow-card p-5 sm:p-6 mb-6">
            <StepProgress status={status} />
          </div>

          <p className="text-center text-xs text-ink-700/40 leading-relaxed">
            고객님의 분석은 서버에서 계속 진행됩니다.
            <br />
            페이지를 닫아도 결과는 저장됩니다.
          </p>
        </div>
      </main>
    );
  }

  const { health_score, risk_grade, star_ratings, findings } = report;

  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 pb-28 sm:pb-16">
        <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-4 text-center">
          기업 건강검진 결과
        </p>

        {/* 시그니처 요소: 진단 차트 스타일의 점수 게이지 */}
        <div className="bg-white rounded-xl2 shadow-card p-10 text-center mb-10">
          <div className="relative inline-flex items-center justify-center w-40 h-40 mb-4">
            <svg viewBox="0 0 120 120" className="w-40 h-40 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#E4E7ED" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#2FAE6B"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 52}
                strokeDashoffset={2 * Math.PI * 52 * (1 - health_score / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-4xl font-semibold num">{health_score}</span>
              <span className="text-xs text-ink-700/50">/ 100점</span>
            </div>
          </div>
          <span
            className={clsx(
              "inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3",
              RISK_GRADE_COLOR[risk_grade]
            )}
          >
            재무위험등급 {risk_grade}
          </span>
          <p className="text-ink-700/70 text-sm">
            {health_score >= 80
              ? "전반적으로 건강한 상태입니다. 몇 가지 보완점이 있습니다."
              : health_score >= 60
              ? "양호하지만 개선이 필요한 영역이 있습니다."
              : "다수의 영역에서 개선이 시급합니다."}
          </p>
        </div>

        {/* 2. 가장 중요한 문제 3개 */}
        <div className="mb-6">
          <h2 className="font-display text-xl mb-4">가장 중요한 문제 3가지</h2>
          <ol className="space-y-3">
            {findings.slice(0, 3).map((f, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="font-mono text-vital-600 shrink-0">{`0${i + 1}`}</span>
                <span className="text-ink-800">{f}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* 3. 지금 해야 할 일 */}
        <div className="bg-white rounded-xl2 shadow-card p-6 mb-6">
          <h2 className="font-display text-lg mb-3">지금 해야 할 일</h2>
          <ul className="space-y-2 text-sm text-ink-800">
            <li>① 위 문제 3가지부터 우선 점검하세요.</li>
            <li>② 2차 정밀진단으로 구체적인 실행 방안을 확인하세요.</li>
            <li>③ 전문가 상담을 통해 실제 해결을 시작하세요.</li>
          </ul>
        </div>

        {/* 4. 2차 정밀진단 CTA */}
        <div className="relative rounded-xl2 border border-line bg-white/60 p-8 text-center overflow-hidden mb-10">
          <div className="absolute inset-0 backdrop-blur-sm bg-white/40" />
          <div className="relative">
            <p className="text-sm text-ink-700/70 mb-1">
              AI가 추가 분석 <span className="font-mono font-semibold">27건</span>을 발견했습니다.
            </p>
            <p className="text-xs text-ink-700/50 mb-6">심층보고서는 잠겨있습니다.</p>
            <a
              href={`/deep/${id}`}
              className="inline-flex items-center justify-center rounded-full bg-ink-950 text-white px-8 py-3.5 text-sm font-medium hover:bg-ink-800 transition-colors"
            >
              2차 정밀진단 · 전문가 상담 신청
            </a>
          </div>
        </div>

        {/* 아래는 참고용 상세 정보 (Mock 데이터 명시) */}
        <MoneyEffectBreakdown seedKey={String(id)} />

        <div className="bg-white rounded-xl2 shadow-card p-8 mb-10">
          <div className="grid grid-cols-2 gap-y-4">
            {(Object.keys(STAR_LABELS) as (keyof StarRatings)[]).map((key) => (
              <div key={key} className="flex items-center justify-between pr-4">
                <span className="text-sm text-ink-700/70">{STAR_LABELS[key]}</span>
                <Stars value={star_ratings[key]} />
              </div>
            ))}
          </div>
        </div>

        <SimilarCompanies seedKey={String(id)} />

        {/* 성장 대시보드(예상효과/체크리스트/추천현황) 진입 링크 — 별도 페이지, Mock 데이터 */}
        <button
          onClick={() => router.push(`/dashboard/${id}`)}
          className="w-full text-center text-xs text-ink-700/50 underline py-2"
        >
          이번달 예상 효과 & 추천 현황 보기
        </button>
      </div>
    </main>
  );
}

function MoneyEffectBreakdown({ seedKey }: { seedKey: string }) {
  const data = generateMockDashboardData(seedKey);
  const rows = [
    { label: "정부지원", amount: data.govSupport.amountManwon },
    { label: "보험절감", amount: data.insuranceSaving.amountManwon },
    { label: "세무절감", amount: data.taxSaving.amountManwon },
    { label: "노무절감", amount: data.laborSaving.amountManwon },
    { label: "기타절감", amount: data.otherSaving.amountManwon },
  ];

  return (
    <div className="bg-white rounded-xl2 shadow-card p-6 sm:p-8 mb-10">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-lg">예상 경제효과</h2>
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-500 font-medium">
          AI 예상치
        </span>
      </div>
      <div className="space-y-3 mb-5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-sm text-ink-700/60">{r.label}</span>
            <span className="font-mono font-semibold text-lg text-ink-950">{formatManwon(r.amount)}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-ink-950 text-white px-5 py-4 flex items-center justify-between mb-3">
        <span className="text-sm text-white/70">총 예상 효과</span>
        <span className="font-mono font-bold text-3xl sm:text-4xl">{formatManwon(data.totalEffectManwon)}</span>
      </div>
      <p className="text-[11px] text-ink-700/40 text-center">
        AI가 자동 분석한 추정치이며, 실제 금액은 전문가 검토 후 확정됩니다.
      </p>
    </div>
  );
}

function SimilarCompanies({ seedKey }: { seedKey: string }) {
  const stats = getSimilarCompanyStats(seedKey);
  const items = [
    { label: "정부지원", pct: stats.govSupportPct },
    { label: "보험 개선", pct: stats.insuranceImprovedPct },
    { label: "경정청구", pct: stats.taxRefundPct },
    { label: "특허", pct: stats.patentPct },
  ];

  return (
    <div className="bg-white rounded-xl2 shadow-card p-6 sm:p-8 mb-8">
      <h2 className="font-display text-lg mb-1">우리 회사와 비슷한 기업</h2>
      <p className="text-xs text-ink-700/50 mb-5">
        {stats.industry} · {stats.size} · {stats.region} — 비슷한 기업{" "}
        <span className="font-mono font-semibold text-ink-800">{stats.similarCount}개</span> 기준 (익명 통계)
      </p>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-xs text-ink-700/60 mb-1">
              <span>{item.label}</span>
              <span className="font-mono font-semibold text-ink-950">{item.pct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-line overflow-hidden">
              <div className="h-full bg-vital-500" style={{ width: `${item.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
