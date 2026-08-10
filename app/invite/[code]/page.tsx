"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { generateMockDashboardData, formatManwon } from "@/lib/mock/dashboard-data";

const GOOGLE_FORM_URL = "https://forms.gle/VZcMgd7BuvCaL3tU8";

/**
 * 섹션7: 공유 랜딩페이지 — 로그인 없이 즉시 체험 가능한 Mock 진단 플로우.
 * intro(추천 배너+CTA) → diagnosing(진행 애니메이션) → result(Mock 결과 + 2차 정밀진단 CTA)
 * 실제 신청은 기존 Google Form으로 연결해 진짜 전환이 일어나도록 한다.
 */
type Stage = "intro" | "diagnosing" | "result";

export default function InviteLandingPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const referralCode = String(code);

  const [stage, setStage] = useState<Stage>("intro");
  const [progress, setProgress] = useState(0);
  const data = generateMockDashboardData(`invite-${referralCode}`);

  useEffect(() => {
    if (stage !== "diagnosing") return;
    const start = Date.now();
    const DURATION_MS = 4000; // 실제 3분 진단을 체험용으로 압축
    const interval = setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - start) / DURATION_MS) * 100));
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => setStage("result"), 300);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [stage]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 sm:px-6 bg-paper">
      <div className="max-w-md w-full">
        {stage === "intro" && (
          <div className="text-center">
            <div className="inline-block bg-vital-50 text-vital-600 text-xs px-3 py-1.5 rounded-full mb-6">
              추천 코드 <span className="font-mono font-semibold">{referralCode}</span>로 접속하셨습니다
            </div>
            <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-4">
              데이터 기반 기업 건강검진
            </p>
            <h1 className="font-display text-3xl sm:text-4xl leading-tight text-ink-950 mb-4">
              우리 회사 건강점수,
              <br />
              <span className="italic text-ink-700">3분</span>이면 확인됩니다.
            </h1>
            <p className="text-sm text-ink-700/70 mb-8">
              회사명만 입력하면 재무·정부지원·절세 가능성을 AI가 즉시 진단합니다.
            </p>
            <button
              onClick={() => setStage("diagnosing")}
              className="w-full rounded-full bg-ink-950 text-white py-4 text-sm font-semibold hover:bg-ink-800 transition-colors"
            >
              무료 기업 건강검진 시작하기 (3분)
            </button>
            <p className="text-xs text-ink-700/40 mt-4">로그인 없이 바로 시작할 수 있습니다.</p>
          </div>
        )}

        {stage === "diagnosing" && (
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-6 rounded-full border-2 border-line border-t-vital-500 animate-spin" />
            <p className="font-display text-xl mb-2">AI가 기업 데이터를 분석하고 있습니다</p>
            <p className="text-sm text-ink-700/60 mb-6">재무·정부지원·절세 가능성을 대조하는 중입니다.</p>
            <div className="w-full h-2 rounded-full bg-line overflow-hidden">
              <div
                className="h-full bg-vital-500 transition-all duration-200 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {stage === "result" && (
          <div className="text-center">
            <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-4">진단 결과</p>
            <div className="bg-white rounded-xl2 shadow-card p-8 mb-6">
              <p className="text-sm text-ink-700/60 mb-2">기업 건강점수</p>
              <p className="font-mono font-bold text-5xl text-ink-950 mb-4">{data.healthScore}점</p>
              <div className="inline-block bg-vital-50 rounded-xl px-5 py-3">
                <p className="text-xs text-vital-600 mb-1">개선 가능한 예상효과</p>
                <p className="font-mono font-bold text-3xl text-vital-600">
                  {formatManwon(data.totalEffectManwon)}
                </p>
              </div>
            </div>
            <a
              href={GOOGLE_FORM_URL}
              className="block w-full rounded-full bg-ink-950 text-white py-4 text-sm font-semibold hover:bg-ink-800 transition-colors mb-3"
            >
              2차 정밀진단 신청하기
            </a>
            <button
              onClick={() => router.push(`/dashboard/preview-${referralCode}`)}
              className="text-xs text-ink-700/50 underline"
            >
              성장 대시보드 미리보기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
