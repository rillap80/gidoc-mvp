"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { hasAwardedOnce, markAwardedOnce, addContribution } from "@/lib/mock/storage";

const TAX_FIRM_URL = process.env.NEXT_PUBLIC_TAX_FIRM_CONSULT_URL;

/**
 * 2차 정밀진단 선택 화면 (v11). 특정 업체명/제휴사명은 화면에 표시하지 않는다 —
 * "노무법인", "세무법인"이라는 일반 명칭만 사용한다.
 */
export default function DeepDiagnosisChoicePage() {
  const { id } = useParams<{ id: string }>();
  const applicationId = String(id);

  // Final Release 섹션7: "2차진단" 진입은 300P 기여도 지급 대상 — 최초 1회만
  useEffect(() => {
    if (!hasAwardedOnce(applicationId, "deep_diagnosis")) {
      markAwardedOnce(applicationId, "deep_diagnosis");
      addContribution(applicationId, "deep_diagnosis");
    }
  }, [applicationId]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-4 text-center">
          2차 정밀진단
        </p>
        <h1 className="font-display text-2xl text-center mb-10">
          어떤 분야를 더 자세히 진단받으시겠어요?
        </h1>

        <div className="space-y-4">
          <div className="bg-white rounded-xl2 shadow-card p-6">
            <h2 className="font-display text-lg mb-2">노무법인</h2>
            <p className="text-sm text-ink-700/60 mb-5 leading-relaxed">
              인사·노무, 4대보험 및 정부지원금 등에 대한 추가 정밀진단을 받을 수 있습니다.
            </p>
            <a
              href={`/deep/${applicationId}/labor`}
              className="block w-full text-center rounded-full bg-ink-950 text-white py-3.5 text-sm font-medium hover:bg-ink-800 transition-colors"
            >
              노무 정밀진단
            </a>
          </div>

          <div className="bg-white rounded-xl2 shadow-card p-6">
            <h2 className="font-display text-lg mb-2">세무법인</h2>
            <p className="text-sm text-ink-700/60 mb-5 leading-relaxed">
              세무·경정청구 등에 대해 전문적인 상담을 받을 수 있습니다.
            </p>
            {TAX_FIRM_URL ? (
              <a
                href={TAX_FIRM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center rounded-full bg-ink-950 text-white py-3.5 text-sm font-medium hover:bg-ink-800 transition-colors"
              >
                세무법인 정밀진단 받기
              </a>
            ) : (
              <button
                disabled
                className="block w-full text-center rounded-full bg-line text-ink-700/40 py-3.5 text-sm font-medium cursor-not-allowed"
              >
                준비중입니다
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
