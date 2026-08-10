"use client";

import { useState } from "react";
import { incrementShareCount } from "@/lib/mock/storage";

interface ShareSheetProps {
  applicationId: string;
  referralCode: string;
  companyName: string;
  onClose: () => void;
  onShared?: (newCount: number) => void;
}

export default function ShareSheet({
  applicationId,
  referralCode,
  companyName,
  onClose,
  onShared,
}: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/invite/${referralCode}`;
  const shareText = `${companyName} 대표님이 무료 기업 건강검진을 추천했습니다. 3분이면 우리 회사 건강점수를 확인할 수 있어요.`;

  function recordShare() {
    const next = incrementShareCount(applicationId);
    onShared?.(next);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      recordShare();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없는 환경 — 조용히 무시 (URL은 화면에 이미 보여지고 있음)
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "기업닥터 AI 무료 건강검진", text: shareText, url: shareUrl });
        recordShare();
      } catch {
        // 사용자가 공유를 취소한 경우 — 조용히 무시
      }
    } else {
      // 네이티브 공유 시트가 없는 환경(데스크톱 등) — 링크 복사로 대체
      handleCopy();
    }
  }

  function handleSmsShare() {
    window.location.href = `sms:?body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    recordShare();
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="fixed inset-0 bg-ink-950/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-xl2 sm:rounded-xl2 shadow-card max-w-md w-full p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-display text-lg">친구 기업에게 공유하기</h2>
          <button onClick={onClose} className="text-ink-700/50 text-sm">
            닫기
          </button>
        </div>

        <div className="flex justify-center mb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="공유 QR 코드" width={140} height={140} className="rounded-lg border border-line" />
        </div>

        <div className="flex items-center gap-2 bg-paper rounded-lg px-3 py-2.5 mb-5">
          <span className="text-xs text-ink-700/60 truncate flex-1 font-mono">{shareUrl}</span>
          <button
            onClick={handleCopy}
            className="text-xs font-medium text-vital-600 shrink-0"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleNativeShare}
            className="rounded-full bg-[#FEE500] text-ink-950 py-3 text-sm font-medium"
          >
            카카오 공유
          </button>
          <button
            onClick={handleSmsShare}
            className="rounded-full bg-ink-950 text-white py-3 text-sm font-medium"
          >
            문자 공유
          </button>
        </div>

        <p className="text-center text-xs text-ink-700/40 mt-5">
          내 추천코드 <span className="font-mono font-semibold text-ink-700/60">{referralCode}</span>가 자동으로 포함됩니다.
        </p>
      </div>
    </div>
  );
}
