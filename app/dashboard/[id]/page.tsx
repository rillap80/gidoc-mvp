"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import clsx from "clsx";
import {
  generateMockDashboardData,
  formatManwon,
  type ChecklistItem,
} from "@/lib/mock/dashboard-data";
import {
  getTodayOpportunities,
  getWeeklyChange,
  getWeeklyDiscoveries,
  getTodayCheckinQuestion,
} from "@/lib/mock/daily";
import {
  getImpactFunnel,
  getReferredCompanyTimeline,
  getRegionImpact,
  getMonthlyComparison,
} from "@/lib/mock/growth";
import { getContributionTier, CONTRIBUTION_LABEL, type ContributionAction } from "@/lib/mock/contribution";
import { getRecentUpdates } from "@/lib/mock/briefing";
import { getNotificationCenterItems } from "@/lib/mock/notification-center";
import Modal from "@/components/ui/Modal";
import { getHealthScoreBreakdown } from "@/lib/mock/health-axes";
import MiniLineChart from "@/components/ui/MiniLineChart";
import { classifyVoc } from "@/lib/mock/voc-classifier";
import { BADGE_DEFS } from "@/lib/mock/badges";
import { JOURNEY_STAGES, getJourneyStageIndex } from "@/lib/mock/journey";
import {
  getCompletedChecklist,
  setChecklistItemCompleted,
  getContributionScore,
  addContribution,
  getThisMonthContributionBreakdown,
  getContributionHistory,
  getIsFoundingMember,
  getHealthScoreBoost,
  addHealthScoreBoost,
  getOrCreateReferralCode,
  getShareCount,
  getCheckinAnswer,
  setCheckinAnswer,
  getNotificationLastSeenAt,
  markNotificationsSeenNow,
  addVocEntry,
  addLearningQueueEntry,
  hasAwardedOnce,
  markAwardedOnce,
  getReview,
  saveReview,
} from "@/lib/mock/storage";
import ShareSheet from "@/components/ShareSheet";

/**
 * Sprint 10 + V6 + Final Release - MVP Conversion & Viral & Retention Edition
 *
 * 실제 결과 화면(app/result/[id])의 라이브 폴링/실데이터 로직은 건드리지 않고,
 * "성장 대시보드"를 별도 페이지로 계속 확장한다. 여기 보이는 모든 금액/랭킹/추천/기여도
 * 통계는 Mock Data이며, 상태는 localStorage로만 유지한다 (실 백엔드 없음 — MVP 원칙).
 *
 * Final Release 원칙: 빠르다 / 쉽다 / 계속 방문한다 / 계속 공유한다.
 * 포인트(P)는 화면 표기 단위일 뿐 현금이 아니라 기여도를 의미한다.
 */

const MONEY_CARD_ICONS: Record<string, string> = {
  taxSaving: "💰",
  policyFund: "🏛️",
  insuranceSaving: "🛡️",
  govSupport: "📋",
};

const RANK_TABS = ["전체", "지역", "직군", "월간"] as const;

export default function GrowthDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const applicationId = String(id);

  const [data] = useState(() => generateMockDashboardData(applicationId));
  const [updates] = useState(() => getRecentUpdates(applicationId));
  const [axisBreakdown] = useState(() => getHealthScoreBreakdown(applicationId));
  const [opportunities] = useState(() => getTodayOpportunities(applicationId));
  const [discoveries] = useState(() => getWeeklyDiscoveries(applicationId));
  const [checkinQ] = useState(() => getTodayCheckinQuestion(applicationId));
  const [funnel] = useState(() => getImpactFunnel(applicationId));
  const [timeline] = useState(() => getReferredCompanyTimeline(applicationId));
  const [regions] = useState(() => getRegionImpact(applicationId));
  const [rankTab, setRankTab] = useState<(typeof RANK_TABS)[number]>("전체");

  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [contribution, setContribution] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [isFounding, setIsFounding] = useState(false);
  const [monthBreakdown, setMonthBreakdown] = useState<Partial<Record<ContributionAction, number>>>({});
  const [scoreBoost, setScoreBoost] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [referralCode, setReferralCode] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [checkinAnswer, setCheckinAnswerState] = useState<"yes" | "no" | null>(null);
  const [showMonthly, setShowMonthly] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSentCategory, setFeedbackSentCategory] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [journeyIndex, setJourneyIndex] = useState(-1);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLastSeenAt, setNotifLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    setCompleted(getCompletedChecklist(applicationId));
    setIsFounding(getIsFoundingMember(applicationId));
    setMonthBreakdown(getThisMonthContributionBreakdown(applicationId));
    setFeedbackCount(getContributionHistory(applicationId).filter((h) => h.action === "feedback").length);
    setScoreBoost(getHealthScoreBoost(applicationId));
    setShareCount(getShareCount(applicationId));
    setReferralCode(getOrCreateReferralCode(applicationId));
    setCheckinAnswerState(getCheckinAnswer(applicationId, checkinQ.id));
    setNotifLastSeenAt(getNotificationLastSeenAt(applicationId));
    const existingReview = getReview(applicationId);
    if (existingReview) {
      setReviewRating(existingReview.rating);
      setReviewSaved(true);
    }

    // 건강검진 결과를 대시보드에서 확인 = "건강검진" 기여도 최초 1회 지급
    let score = getContributionScore(applicationId);
    if (!hasAwardedOnce(applicationId, "checkup")) {
      markAwardedOnce(applicationId, "checkup");
      score = addContribution(applicationId, "checkup");
    }
    setContribution(score);
    setJourneyIndex(getJourneyStageIndex(applicationId));
  }, [applicationId, checkinQ.id]);

  const displayedScore = Math.min(100, data.healthScore + scoreBoost);
  const notifItems = getNotificationCenterItems(applicationId, displayedScore);
  const unreadCount = notifLastSeenAt ? 0 : notifItems.length;

  function handleOpenNotifications() {
    setNotifOpen(true);
    markNotificationsSeenNow(applicationId);
    setNotifLastSeenAt(new Date().toISOString());
  }
  const weekly = getWeeklyChange(applicationId, displayedScore);
  const monthly = getMonthlyComparison(applicationId, displayedScore, data.totalEffectManwon);
  const tier = getContributionTier(contribution, isFounding);
  const completionRate = Math.round(
    (Object.values(completed).filter(Boolean).length / data.checklist.length) * 100
  );

  function handleToggleChecklist(item: ChecklistItem) {
    const nowCompleted = !completed[item.id];
    setChecklistItemCompleted(applicationId, item.id, nowCompleted);
    setCompleted((prev) => ({ ...prev, [item.id]: nowCompleted }));

    if (nowCompleted) {
      // Final Release 섹션3: 완료는 건강점수만 올린다 (포인트 테이블에 별도 to-do 항목 없음)
      setScoreBoost(addHealthScoreBoost(applicationId, 1));
      setJustCompleted(item.id);
      setTimeout(() => setJustCompleted(null), 1200);
    }
  }

  function handleCheckin(answer: "yes" | "no") {
    setCheckinAnswer(applicationId, checkinQ.id, answer);
    setCheckinAnswerState(answer);
    setContribution(addContribution(applicationId, "feedback"));
    setFeedbackCount((c) => c + 1);
  }

  function handleShareRecorded(count: number) {
    setShareCount(count);
    setContribution(addContribution(applicationId, "referral_signup"));
  }

  function handleSubmitFeedback() {
    const text = feedbackText.trim();
    if (!text) return;
    const category = classifyVoc(text);
    const id = `${applicationId}-${Date.now()}`;
    addVocEntry({
      id,
      text,
      category,
      status: "pending",
      rating: reviewRating || undefined,
      createdAt: new Date().toISOString(),
    });
    // V9 섹션8: 고객 피드백도 AI Learning Queue에 함께 적재
    addLearningQueueEntry({
      id,
      author: "고객(대시보드)",
      role: "고객",
      category: "기타",
      content: text,
      importance: reviewRating ? (reviewRating as 1 | 2 | 3 | 4 | 5) : 3,
      adopted: false,
      status: "대기",
      createdAt: new Date().toISOString(),
    });
    setContribution(addContribution(applicationId, "feedback"));
    setFeedbackCount((c) => c + 1);
    setFeedbackText("");
    setFeedbackSentCategory(category);
    setTimeout(() => setFeedbackSentCategory(null), 3000);
  }

  function handleSaveReview() {
    if (reviewRating === 0) return;
    saveReview(applicationId, { rating: reviewRating, text: feedbackText.trim(), at: new Date().toISOString() });
    if (!hasAwardedOnce(applicationId, "review")) {
      markAwardedOnce(applicationId, "review");
      setContribution(addContribution(applicationId, "review"));
    }
    setReviewSaved(true);
    setJourneyIndex(getJourneyStageIndex(applicationId));
  }

  const badgeContext = {
    shareCount,
    invitedCompanies: funnel.invited,
    feedbackCount,
    isFoundingMember: isFounding,
    todoCompletionRate: completionRate / 100,
  };

  return (
    <main className="min-h-screen bg-paper pb-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* V9 섹션7: 알림센터 진입점 */}
        <div className="flex justify-end">
          <button onClick={handleOpenNotifications} className="relative text-xl leading-none">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* AI 주치의 메시지 — 항상 최상단 */}
        <div className="rounded-xl2 bg-ink-950 text-white p-5 flex gap-3 items-start">
          <span className="text-2xl leading-none">🩺</span>
          <div>
            <p className="text-[11px] tracking-widest text-vital-400 uppercase mb-1">AI 주치의</p>
            <p className="text-sm leading-relaxed text-white/90">{data.aiMessage}</p>
          </div>
        </div>

        {/* V9 섹션1: 지난 방문 이후 브리핑 */}
        <div className="rounded-xl2 bg-white shadow-card p-5">
          <p className="text-sm text-ink-800 mb-3">
            안녕하세요. 지난 방문 이후 오늘 확인해야 할 항목이 있습니다.
          </p>
          <div className="space-y-1.5">
            {updates.map((u, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {u.isNew && <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold text-[9px]">NEW</span>}
                <span className="text-ink-700/70">{u.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 오늘 AI가 발견한 기회 — 매일 접속 동기 */}
        <div className="rounded-xl2 bg-white shadow-card p-5">
          <p className="font-display text-base mb-3">오늘 AI가 발견한 기회</p>
          <div className="flex flex-wrap gap-2">
            {opportunities.map((op) => (
              <span key={op} className="text-xs bg-vital-50 text-vital-600 px-3 py-1.5 rounded-full">
                ✔ {op}
              </span>
            ))}
          </div>
        </div>

        {/* 대표 심리 자극 히어로 카드 */}
        <div className="rounded-xl2 bg-white shadow-card p-6 sm:p-8 text-center">
          <p className="text-amber-500 text-lg tracking-widest mb-3">★★★★★</p>
          <p className="text-base sm:text-lg text-ink-800 mb-1">
            대표님, 현재 기업은 건강점수{" "}
            <span className="font-mono font-bold text-2xl sm:text-3xl text-ink-950">{displayedScore}점</span>
            입니다.
          </p>
          <p className="text-sm text-ink-700/60 mb-4">
            동종업계 평균은 <span className="font-mono font-semibold">{data.industryAvgScore}점</span>입니다.
          </p>
          <div className="inline-block bg-vital-50 rounded-xl px-5 py-3">
            <p className="text-xs text-vital-600 mb-1">지금 개선 가능한 예상효과</p>
            <p className="font-mono font-bold text-3xl sm:text-4xl text-vital-600">
              {formatManwon(data.totalEffectManwon)}
            </p>
          </div>
        </div>

        {/* V9 섹션2: 6축 건강점수 (재무/노무/세무/보험/정책자금/법무) */}
        <div className="rounded-xl2 bg-white shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-base">건강점수 상세</p>
            <span className="font-mono text-sm text-ink-700/50">최근 6개월 추이</span>
          </div>
          <MiniLineChart values={axisBreakdown.history} />
          <div className="grid grid-cols-2 gap-3 mt-4">
            {axisBreakdown.axes.map((a) => (
              <div key={a.axis} className="flex items-center justify-between text-xs">
                <span className="text-ink-700/60">{a.axis}</span>
                <span className="font-mono">
                  <span className="font-semibold text-ink-950">{a.score}</span>
                  <span className="text-ink-700/40">/{a.max}</span>{" "}
                  <span className={a.changeFromLastMonth >= 0 ? "text-vital-600" : "text-red-500"}>
                    ({a.changeFromLastMonth >= 0 ? "+" : ""}
                    {a.changeFromLastMonth})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 주간 기업 건강리포트: 점수변화 + 이번주 새롭게 발견 */}
        <div className="rounded-xl2 bg-white shadow-card p-5">
          <p className="font-display text-base mb-3">이번주 기업 건강리포트</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono text-lg text-ink-700/40">{weekly.lastWeekScore}점</span>
            <span className="text-ink-700/30">→</span>
            <span className="font-mono text-2xl font-bold text-vital-600">{weekly.thisWeekScore}점</span>
            <span className="text-xs text-vital-600 font-medium">
              (+{weekly.thisWeekScore - weekly.lastWeekScore})
            </span>
          </div>
          <p className="text-xs text-ink-700/60 mb-3">{weekly.reason}</p>
          <div className="border-t border-line pt-3">
            <p className="text-xs text-ink-700/50 mb-2">이번주 새롭게 발견</p>
            <div className="flex flex-wrap gap-2">
              {discoveries.map((d) => (
                <span key={d} className="text-xs bg-paper text-ink-700/70 px-2.5 py-1 rounded-full">
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* AI 체크인 (하루 1문항) */}
        <div className="rounded-xl2 bg-white shadow-card p-5">
          <p className="text-[11px] tracking-widest text-ink-700/40 uppercase mb-2">AI 체크인</p>
          <p className="text-sm text-ink-800 mb-4">{checkinQ.question}</p>
          {checkinAnswer ? (
            <p className="text-xs text-vital-600">
              답변 완료 ({checkinAnswer === "yes" ? "YES" : "NO"}) — 2차 진단 데이터에 반영됩니다.
            </p>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => handleCheckin("yes")}
                className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium hover:border-vital-500 hover:text-vital-600"
              >
                YES
              </button>
              <button
                onClick={() => handleCheckin("no")}
                className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium hover:border-ink-950"
              >
                NO
              </button>
            </div>
          )}
        </div>

        {/* 돈이 먼저 보이는 KPI 카드 */}
        <div>
          <p className="text-xs text-ink-700/50 mb-2 px-1">이번달 AI 예상 효과</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "taxSaving", item: data.taxSaving },
              { key: "policyFund", item: data.policyFund },
              { key: "insuranceSaving", item: data.insuranceSaving },
              { key: "govSupport", item: data.govSupport },
            ].map(({ key, item }) => (
              <div key={key} className="rounded-xl2 bg-white shadow-card p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{MONEY_CARD_ICONS[key]}</span>
                  {item.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-500 font-medium">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-700/60 mb-1">{item.label}</p>
                <p className="font-mono font-bold text-2xl sm:text-3xl text-ink-950 num">
                  {formatManwon(item.amountManwon)}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl2 bg-ink-950 text-white p-5 sm:p-6 mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60 mb-1">총 예상 효과</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-vital-500/30 text-vital-400 font-medium">
                예상금액 · AI 예상치
              </span>
            </div>
            <p className="font-mono font-bold text-3xl sm:text-4xl num">{formatManwon(data.totalEffectManwon)}</p>
          </div>
        </div>

        {/* 월간 건강검진 비교 */}
        <div className="rounded-xl2 bg-white shadow-card p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="font-display text-base">월간 건강검진</p>
            <button onClick={() => setShowMonthly((v) => !v)} className="text-xs text-vital-600 font-medium">
              {showMonthly ? "접기" : "지난달 대비 비교"}
            </button>
          </div>
          {showMonthly && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-xs text-ink-700/50 mb-1">건강점수</p>
                <p className="font-mono text-sm text-ink-700/40">
                  지난달 {monthly.lastMonthScore}점 → <span className="text-ink-950 font-bold">{monthly.thisMonthScore}점</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-700/50 mb-1">예상 효과</p>
                <p className="font-mono text-sm text-ink-700/40">
                  지난달 {formatManwon(monthly.lastMonthEffectManwon)} →{" "}
                  <span className="text-vital-600 font-bold">{formatManwon(monthly.thisMonthEffectManwon)}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* To-do 시스템: 5개 항목 + 완료율 도트 */}
        <div className="rounded-xl2 bg-white shadow-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="font-display text-base">이번주 해야 할 일</p>
            <span className="text-xs font-mono text-ink-700/50">기여도 {contribution}P</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-ink-700/60 shrink-0">기업 건강관리 {completionRate}%</span>
            <div className="flex gap-1">
              {data.checklist.map((item) => (
                <span
                  key={item.id}
                  className={clsx(
                    "w-3 h-3 rounded-sm",
                    completed[item.id] ? "bg-vital-500" : "bg-line"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {data.checklist.map((item) => {
              const isDone = !!completed[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => handleToggleChecklist(item)}
                  className={clsx(
                    "w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                    isDone ? "border-vital-200 bg-vital-50" : "border-line bg-white hover:border-ink-950/20"
                  )}
                >
                  <span
                    className={clsx(
                      "w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                      isDone ? "bg-vital-500 border-vital-500 text-white scale-110" : "border-line text-transparent"
                    )}
                  >
                    ✓
                  </span>
                  <div className="flex-1">
                    <p className={clsx("text-sm font-medium", isDone && "line-through text-ink-700/40")}>
                      {item.label}
                    </p>
                    <div className="flex gap-3 text-xs text-ink-700/50 mt-0.5">
                      <span>예상효과 {item.impactLabel}</span>
                      <span>· 소요시간 {item.minutes}분</span>
                    </div>
                  </div>
                  {justCompleted === item.id && (
                    <span className="text-xs font-semibold text-vital-600 animate-pulse">완료!</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 기업 성장 타임라인 */}
        <div className="rounded-xl2 bg-white shadow-card p-5 sm:p-6">
          <p className="font-display text-base mb-4">기업 성장 타임라인</p>
          <div className="flex items-center">
            {JOURNEY_STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <span
                    className={clsx(
                      "w-3 h-3 rounded-full",
                      i <= journeyIndex ? "bg-vital-500" : "bg-line"
                    )}
                  />
                  <span
                    className={clsx(
                      "text-[10px] mt-1.5 text-center whitespace-nowrap",
                      i <= journeyIndex ? "text-ink-800 font-medium" : "text-ink-700/30"
                    )}
                  >
                    {stage}
                  </span>
                </div>
                {i < JOURNEY_STAGES.length - 1 && (
                  <div className={clsx("flex-1 h-0.5 mx-1 mb-4", i < journeyIndex ? "bg-vital-500" : "bg-line")} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 마이페이지 — 기여도 & 배지 & 훈장 */}
        <div className="rounded-xl2 bg-white shadow-card p-5 sm:p-6">
          <p className="text-amber-500 text-sm tracking-widest mb-2">★★★★★</p>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-ink-700/70">
              기여도 <span className="font-mono font-bold text-ink-950">{contribution}P</span>
            </p>
            <span className="inline-flex items-center gap-1 text-xs bg-paper px-3 py-1.5 rounded-full font-medium">
              <span>{tier.emoji}</span>
              <span>{tier.title}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {BADGE_DEFS.map((b) => {
              const unlocked = b.isUnlocked(badgeContext);
              return (
                <span
                  key={b.id}
                  className={clsx(
                    "text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1",
                    unlocked ? "bg-vital-50 text-vital-600" : "bg-paper text-ink-700/30"
                  )}
                  title={unlocked ? "획득" : "미획득"}
                >
                  <span>{b.emoji}</span>
                  <span>{b.title}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* 랭킹 */}
        <div className="rounded-xl2 bg-white shadow-card p-5 sm:p-6">
          <p className="font-display text-base mb-3">랭킹</p>
          <div className="flex gap-2 mb-4">
            {RANK_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setRankTab(tab)}
                className={clsx(
                  "text-xs px-3 py-1.5 rounded-full font-medium",
                  rankTab === tab ? "bg-ink-950 text-white" : "bg-paper text-ink-700/60"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <p className="font-mono font-bold text-3xl text-ink-950">
            {funnel.invited + rankTab.length}위
          </p>
          <p className="text-xs text-ink-700/40 mt-1">{rankTab} 기준</p>
        </div>

        {/* 추천 영향력 대시보드 (SNS 공유 가능) */}
        <div className="rounded-xl2 bg-white shadow-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="font-display text-base">추천 영향력</p>
            <button onClick={() => setShareOpen(true)} className="text-xs text-vital-600 font-medium">
              공유하기
            </button>
          </div>
          <div className="flex items-center justify-between text-center">
            <FunnelStep label="내 추천 기업" value={`${funnel.invited}개`} />
            <span className="text-ink-700/20">→</span>
            <FunnelStep label="진단 완료" value={`${funnel.diagnosed}개`} />
            <span className="text-ink-700/20">→</span>
            <FunnelStep label="전문가 연결" value={`${funnel.expertConnected}개`} />
          </div>
          <div className="mt-4 rounded-xl bg-vital-50 px-4 py-3 text-center">
            <p className="text-xs text-vital-600 mb-1">예상 개선 효과</p>
            <p className="font-mono font-bold text-2xl text-vital-600">{formatManwon(funnel.expectedEffectManwon)}</p>
          </div>
          <p className="text-center text-xs text-ink-700/40 mt-3">이번달 공유 {shareCount}회</p>
        </div>

        {/* 추천기업 진행현황 타임라인 */}
        <div className="rounded-xl2 bg-white shadow-card p-5 sm:p-6">
          <p className="font-display text-base mb-4">추천기업 진행현황</p>
          <div className="space-y-2">
            {timeline.map((row, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5">
                <span className="text-ink-800">{row.name}</span>
                <StageBadge stage={row.stage} />
              </div>
            ))}
          </div>
        </div>

        {/* 기여 히스토리 */}
        <div className="rounded-xl2 bg-white shadow-card p-5 sm:p-6">
          <p className="font-display text-base mb-4">이번달 기여 히스토리</p>
          {Object.keys(monthBreakdown).length === 0 ? (
            <p className="text-xs text-ink-700/40">이번달 활동이 아직 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(monthBreakdown) as [ContributionAction, number][]).map(([action, count]) => (
                <div key={action} className="flex justify-between text-sm">
                  <span className="text-ink-700/60">{CONTRIBUTION_LABEL[action]}</span>
                  <span className="font-mono font-semibold text-vital-600">+{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 지역 영향력 */}
        <div className="rounded-xl2 bg-white shadow-card p-5 sm:p-6">
          <p className="font-display text-base mb-4">지역 영향력</p>
          <div className="space-y-2">
            {regions.map((r) => (
              <div key={r.region} className="flex items-center gap-3">
                <span className="text-xs w-10 text-ink-700/60">{r.region}</span>
                <div className="flex-1 h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full bg-vital-500"
                    style={{ width: `${Math.min(100, (r.count / regions[0].count) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-ink-700/60 w-10 text-right">{r.count}개</span>
              </div>
            ))}
          </div>
        </div>

        {/* 공유 버튼 */}
        <button
          onClick={() => setShareOpen(true)}
          className="w-full rounded-full bg-ink-950 text-white py-4 text-sm font-semibold shadow-card hover:bg-ink-800 transition-colors"
        >
          친구 기업도 무료 건강검진 받기
        </button>

        {/* V9 섹션3/4: 전용 페이지 링크 (리워드 센터 / 성공사례) */}
        <div className="flex gap-3 text-center">
          <a href={`/rewards/${applicationId}`} className="flex-1 text-xs text-vital-600 underline py-2">
            바이럴 리워드 센터
          </a>
          <a href="/cases" className="flex-1 text-xs text-ink-700/50 underline py-2">
            비슷한 기업 성공사례
          </a>
        </div>

        {/* VOC: 별점 + 30초 의견 */}
        <div className="rounded-xl2 bg-white shadow-card p-5 sm:p-6">
          <p className="font-display text-base mb-3">의견 남기기 (30초)</p>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setReviewRating(n)} className="text-2xl leading-none">
                <span className={n <= reviewRating ? "text-amber-400" : "text-line"}>★</span>
              </button>
            ))}
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="좋았던 점, 불편한 점, 추가 기능 제안을 자유롭게 남겨주세요."
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-vital-500 resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-ink-700/40">
              {feedbackSentCategory
                ? `"${feedbackSentCategory}"로 분류되어 전달되었습니다.`
                : reviewSaved
                ? "후기가 저장되었습니다."
                : "\u00A0"}
            </p>
            <div className="flex gap-2">
              {reviewRating > 0 && !reviewSaved && (
                <button
                  onClick={handleSaveReview}
                  className="rounded-full border border-line px-4 py-2 text-xs font-medium"
                >
                  후기로 저장
                </button>
              )}
              <button
                onClick={handleSubmitFeedback}
                disabled={!feedbackText.trim()}
                className="rounded-full bg-ink-950 text-white px-5 py-2 text-xs font-medium disabled:opacity-30"
              >
                의견 보내기
              </button>
            </div>
          </div>
        </div>
      </div>

      {shareOpen && (
        <ShareSheet
          applicationId={applicationId}
          referralCode={referralCode}
          companyName="우리 회사"
          onClose={() => setShareOpen(false)}
          onShared={handleShareRecorded}
        />
      )}

      {notifOpen && (
        <Modal onClose={() => setNotifOpen(false)}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg">알림센터</h2>
            <button onClick={() => setNotifOpen(false)} className="text-ink-700/50 text-sm">
              닫기
            </button>
          </div>
          <div className="space-y-3">
            {notifItems.map((item) => (
              <div key={item.id} className="border-b border-line pb-2 last:border-0">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-paper text-ink-700/60 mr-2">
                  {item.category}
                </span>
                <span className="text-sm text-ink-800">{item.label}</span>
              </div>
            ))}
            {notifItems.length === 0 && <p className="text-xs text-ink-700/40">새로운 알림이 없습니다.</p>}
          </div>
        </Modal>
      )}
    </main>
  );
}

function FunnelStep({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono font-bold text-lg text-ink-950">{value}</p>
      <p className="text-[11px] text-ink-700/50 mt-0.5">{label}</p>
    </div>
  );
}

const STAGE_COLOR: Record<string, string> = {
  "진단완료": "bg-line text-ink-700",
  "전문가 상담": "bg-amber-400/20 text-amber-500",
  "계약 진행": "bg-vital-200 text-vital-600",
  "성과 완료": "bg-vital-500/20 text-vital-600",
};

function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={clsx("text-[11px] px-2.5 py-1 rounded-full font-medium", STAGE_COLOR[stage])}>{stage}</span>
  );
}
