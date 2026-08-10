"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { generateMockDashboardData, formatManwon } from "@/lib/mock/dashboard-data";
import { getImpactFunnel } from "@/lib/mock/growth";
import { getOrCreateReferralCode, getShareCount } from "@/lib/mock/storage";
import ShareSheet from "@/components/ShareSheet";

/**
 * V9 섹션3: 바이럴 리워드 센터 — 공유 전용 페이지.
 * app/dashboard/[id]에 있던 추천 영향력 카드와 같은 Mock 데이터 소스를 재사용하되,
 * "공유"라는 단일 목적에 집중한 화면으로 따로 뺐다 (기존 대시보드 섹션은 그대로 유지).
 */
export default function RewardsCenterPage() {
  const { id } = useParams<{ id: string }>();
  const applicationId = String(id);

  const [data] = useState(() => generateMockDashboardData(applicationId));
  const [funnel] = useState(() => getImpactFunnel(applicationId));
  const [referralCode, setReferralCode] = useState("");
  const [shareCount, setShareCount] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setReferralCode(getOrCreateReferralCode(applicationId));
    setShareCount(getShareCount(applicationId));
  }, [applicationId]);

  return (
    <main className="min-h-screen bg-paper px-4 sm:px-6 py-12">
      <div className="max-w-md mx-auto space-y-5">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-2">바이럴 리워드 센터</p>
          <h1 className="font-display text-2xl">내 추천코드 {referralCode}</h1>
        </div>

        <Card padding="lg" dark className="text-center">
          <p className="text-xs text-white/60 mb-1">예상 절감금액</p>
          <p className="font-mono font-bold text-4xl mb-4">{formatManwon(data.totalEffectManwon)}</p>
          <p className="text-xs text-white/60 mb-1">예상 지원금 확보액</p>
          <p className="font-mono font-bold text-3xl text-vital-400">{formatManwon(data.policyFund.amountManwon)}</p>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card padding="sm" className="text-center">
            <p className="font-mono font-bold text-xl">{shareCount}</p>
            <p className="text-[11px] text-ink-700/50 mt-0.5">공유횟수</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="font-mono font-bold text-xl">{funnel.invited}</p>
            <p className="text-[11px] text-ink-700/50 mt-0.5">가입기업</p>
          </Card>
          <Card padding="sm" className="text-center">
            <p className="font-mono font-bold text-xl">{funnel.diagnosed}</p>
            <p className="text-[11px] text-ink-700/50 mt-0.5">진단완료</p>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-700/60">전국랭킹</span>
            <span className="font-mono font-bold text-lg">{funnel.invited + 3}위</span>
          </div>
        </Card>

        <Button full size="lg" onClick={() => setShareOpen(true)}>
          친구 기업도 무료 건강검진 받기
        </Button>
      </div>

      {shareOpen && (
        <ShareSheet
          applicationId={applicationId}
          referralCode={referralCode}
          companyName="우리 회사"
          onClose={() => setShareOpen(false)}
          onShared={(count) => setShareCount(count)}
        />
      )}
    </main>
  );
}
