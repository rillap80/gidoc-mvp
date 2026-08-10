"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type DeepStatus = "pending" | "verifying" | "generating" | "completed" | "error";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<DeepStatus>("generating");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      attempts += 1;
      const res = await fetch(`/api/agent/deep-status?applicationId=${id}`);
      const data = await res.json();
      if (cancelled) return;

      const deepReport = data.deepReport;
      if (!deepReport) {
        if (attempts < 60) setTimeout(poll, 3000);
        return;
      }

      setStatus(deepReport.status);
      if (deepReport.status === "completed") {
        setPdfUrl(deepReport.pdf_url);
        return; // 폴링 종료
      }
      if (deepReport.status === "error") {
        setErrorMessage(deepReport.error_message ?? "보고서 생성 중 오류가 발생했습니다.");
        return; // 폴링 종료
      }
      // 생성 중 — 계속 폴링 (최대 3분)
      if (attempts < 60) setTimeout(poll, 3000);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-4">
          심층 건강검진
        </p>

        {status === "error" ? (
          <>
            <h1 className="font-display text-2xl mb-3">보고서 생성에 실패했습니다</h1>
            <p className="text-sm text-ink-700/60 mb-4">{errorMessage}</p>
            <p className="text-xs text-ink-700/40">담당자가 확인 후 다시 안내드리겠습니다.</p>
          </>
        ) : pdfUrl ? (
          <>
            <h1 className="font-display text-2xl mb-6">보고서가 준비되었습니다</h1>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-ink-950 text-white px-8 py-3.5 text-sm font-medium hover:bg-ink-800 transition-colors"
            >
              PDF 다운로드
            </a>
          </>
        ) : (
          <>
            <div className="w-10 h-10 mx-auto mb-6 rounded-full border-2 border-line border-t-vital-500 animate-spin" />
            <h1 className="font-display text-xl mb-2">심층 보고서를 생성하고 있습니다</h1>
            <p className="text-sm text-ink-700/60">
              재무 분석부터 실행전략까지 정리하는 중입니다. 잠시만 기다려주세요.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
