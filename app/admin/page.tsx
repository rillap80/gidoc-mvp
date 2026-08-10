"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { getAllVocEntries, updateVocStatus } from "@/lib/mock/storage";
import type { VocEntry, VocCategory, VocStatus } from "@/lib/mock/voc-classifier";
import { VOC_STATUS_LABEL } from "@/lib/mock/voc-classifier";
import { getTopIssuesMock, getAiWeeklySummaryMock } from "@/lib/mock/admin-summary";

interface Row {
  id: string;
  created_at: string;
  company_name: string;
  ceo_name: string;
  status: string;
  error_message?: string | null;
  retry_count?: number;
  health_score?: number | null;
  risk_grade?: string | null;
  cretop_duration_ms?: number | null;
  ai_duration_ms?: number | null;
  report_duration_ms?: number | null;
}

interface LogRow {
  step: string;
  status: string;
  message?: string | null;
  token_usage?: number | null;
  duration_ms?: number | null;
  cost_usd?: number | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  received: "접수",
  analyzing: "분석중",
  awaiting_cretop: "크레탑 조회중",
  ai_analysis: "AI 분석중",
  completed: "완료",
  deep_requested: "상담예약",
  deep_completed: "심층완료",
  error: "오류",
};

const STATUS_COLOR: Record<string, string> = {
  received: "bg-line text-ink-700",
  analyzing: "bg-amber-400/20 text-amber-500",
  awaiting_cretop: "bg-amber-400/20 text-amber-500",
  ai_analysis: "bg-amber-400/20 text-amber-500",
  completed: "bg-vital-200 text-vital-600",
  deep_requested: "bg-vital-200 text-vital-600",
  deep_completed: "bg-vital-500/20 text-vital-600",
  error: "bg-red-100 text-red-600",
};

const RISK_GRADE_COLOR: Record<string, string> = {
  A: "bg-vital-200 text-vital-600",
  B: "bg-vital-200 text-vital-600",
  C: "bg-amber-400/20 text-amber-500",
  D: "bg-amber-400/20 text-amber-500",
  E: "bg-red-100 text-red-600",
};

const LOG_STATUS_COLOR: Record<string, string> = {
  started: "text-ink-700/50",
  success: "text-vital-600",
  cache_hit: "text-vital-600",
  cache_miss: "text-ink-700/50",
  retry: "text-amber-500",
  error: "text-red-600",
};

function fmtMs(ms?: number | null) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}초` : `${ms}ms`;
}

function fmtCost(cost?: number | null) {
  if (cost == null) return "—";
  return `$${cost.toFixed(4)}`;
}

// ── 로그 보기 모달 ─────────────────────────────────────────
function LogModal({
  applicationId,
  accessKey,
  onClose,
}: {
  applicationId: string;
  accessKey: string;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<LogRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/logs?applicationId=${applicationId}&key=${encodeURIComponent(accessKey)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setLogs(data.logs ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, accessKey]);

  return (
    <div className="fixed inset-0 bg-ink-950/40 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl2 shadow-card max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-lg">실행 로그</h2>
          <button onClick={onClose} className="text-ink-700/50 text-sm">
            닫기
          </button>
        </div>
        {logs == null ? (
          <p className="text-sm text-ink-700/50">불러오는 중…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-ink-700/50">로그가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, i) => (
              <div key={i} className="text-xs border-b border-line pb-2">
                <div className="flex justify-between font-mono">
                  <span>
                    <span className={clsx("font-semibold", LOG_STATUS_COLOR[log.status])}>
                      [{log.status}]
                    </span>{" "}
                    {log.step}
                  </span>
                  <span className="text-ink-700/40">
                    {new Date(log.created_at).toLocaleTimeString("ko-KR")}
                  </span>
                </div>
                {log.message && <p className="text-ink-700/70 mt-0.5">{log.message}</p>}
                <div className="text-ink-700/40 mt-0.5 flex gap-3">
                  <span>{fmtMs(log.duration_ms)}</span>
                  {log.token_usage != null && <span>{log.token_usage} tokens</span>}
                  {log.cost_usd != null && <span>{fmtCost(log.cost_usd)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [sortRecentErrors, setSortRecentErrors] = useState(true);
  const [logModalId, setLogModalId] = useState<string | null>(null);
  const [authFailedMsg, setAuthFailedMsg] = useState<string | null>(null);
  const [vocEntriesForSummary, setVocEntriesForSummary] = useState<VocEntry[]>([]);

  useEffect(() => {
    setVocEntriesForSummary(getAllVocEntries());
  }, []);

  async function load(accessKey: string, sort = sortRecentErrors) {
    setLoading(true);
    const sortParam = sort ? "&sort=recent_errors" : "";
    const res = await fetch(
      `/api/admin/applications?key=${encodeURIComponent(accessKey)}${sortParam}`
    );
    if (res.ok) {
      const data = await res.json();
      setRows(data.applications ?? []);
      setAuthed(true);
      setAuthFailedMsg(null);
    } else if (res.status === 429) {
      setAuthFailedMsg("요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
      setAuthed(false);
    } else {
      setAuthFailedMsg("인증에 실패했습니다.");
      setAuthed(false);
    }
    setLoading(false);
  }

  async function retryApplication(id: string) {
    setRetrying(id);
    try {
      await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id, key }),
      });
    } finally {
      setRetrying(null);
      load(key);
    }
  }

  useEffect(() => {
    if (authed) {
      const interval = setInterval(() => load(key), 10000);
      return () => clearInterval(interval);
    }
  }, [authed, key, sortRecentErrors]);

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-xs w-full space-y-4">
          <h1 className="font-display text-xl text-center mb-4">관리자 로그인</h1>
          <input
            type="password"
            placeholder="Access Key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-lg border border-line px-4 py-3 text-sm outline-none focus:border-vital-500"
          />
          <button
            onClick={() => load(key)}
            className="w-full rounded-full bg-ink-950 text-white py-3 text-sm font-medium"
          >
            {loading ? "확인 중…" : "입장"}
          </button>
          {authFailedMsg && <p className="text-xs text-red-500 text-center">{authFailedMsg}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl">기업닥터 AI · 신청 현황</h1>
          <label className="flex items-center gap-2 text-xs text-ink-700/60">
            <input
              type="checkbox"
              checked={sortRecentErrors}
              onChange={(e) => {
                setSortRecentErrors(e.target.checked);
                load(key, e.target.checked);
              }}
            />
            최근 오류 순으로 정렬
          </label>
        </div>

        <TodaySummaryPanel rows={rows} vocEntries={vocEntriesForSummary} />
        <AiSummaryPanel totalApplications={rows.length} />

        <div className="bg-white rounded-xl2 shadow-card overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-line text-left text-ink-700/60">
                <th className="px-4 py-3 font-medium">접수일시</th>
                <th className="px-4 py-3 font-medium">회사명</th>
                <th className="px-4 py-3 font-medium">대표자</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">AI점수</th>
                <th className="px-4 py-3 font-medium">리스크등급</th>
                <th className="px-4 py-3 font-medium">크레탑조회</th>
                <th className="px-4 py-3 font-medium">GPT응답</th>
                <th className="px-4 py-3 font-medium">보고서생성</th>
                <th className="px-4 py-3 font-medium">비고</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-ink-700/60">
                    {new Date(r.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">{r.company_name}</td>
                  <td className="px-4 py-3">{r.ceo_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "inline-block px-2.5 py-1 rounded-full text-xs font-medium",
                        STATUS_COLOR[r.status]
                      )}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{r.health_score ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.risk_grade ? (
                      <span
                        className={clsx(
                          "inline-block w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center",
                          RISK_GRADE_COLOR[r.risk_grade]
                        )}
                      >
                        {r.risk_grade}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-700/60 font-mono">{fmtMs(r.cretop_duration_ms)}</td>
                  <td className="px-4 py-3 text-xs text-ink-700/60 font-mono">{fmtMs(r.ai_duration_ms)}</td>
                  <td className="px-4 py-3 text-xs text-ink-700/60 font-mono">{fmtMs(r.report_duration_ms)}</td>
                  <td className="px-4 py-3 text-xs text-red-500 max-w-[220px] truncate" title={r.error_message ?? ""}>
                    {r.error_message}
                    {!!r.retry_count && (
                      <span className="text-ink-700/40"> (재시도 {r.retry_count}회)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    {r.status === "error" && (
                      <button
                        onClick={() => retryApplication(r.id)}
                        disabled={retrying === r.id}
                        className="text-xs px-3 py-1.5 rounded-full bg-ink-950 text-white disabled:opacity-40"
                      >
                        {retrying === r.id ? "재실행 중…" : "재실행"}
                      </button>
                    )}
                    <button
                      onClick={() => setLogModalId(r.id)}
                      className="text-xs px-3 py-1.5 rounded-full border border-line text-ink-700/70"
                    >
                      로그 보기
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-ink-700/40">
                    아직 신청이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* V6 섹션13/14: 커뮤니티 랭킹 & VOC — 지금은 이 브라우저의 localStorage만 집계하는 Mock.
            실서비스에서는 Supabase에 contribution_history/voc_entries 테이블을 두고
            서버에서 전체 회원 기준으로 집계해야 한다 (지금 구조는 그 테이블 스키마로 그대로 옮기기 쉽게
            lib/mock/contribution.ts / lib/mock/voc-classifier.ts 의 타입을 맞춰두었다). */}
        <CommunityVocPanel />
        <LaborPartnerPanel accessKey={key} />
      </div>

      {logModalId && (
        <LogModal applicationId={logModalId} accessKey={key} onClose={() => setLogModalId(null)} />
      )}
    </main>
  );
}

const VOC_CATEGORY_COLOR: Record<VocCategory, string> = {
  "버그": "bg-red-100 text-red-600",
  "기능추가": "bg-vital-200 text-vital-600",
  "UX": "bg-amber-400/20 text-amber-500",
  "정책": "bg-line text-ink-700",
  "신규아이디어": "bg-ink-950/10 text-ink-800",
};

interface TodaySummaryPanelProps {
  rows: Row[];
  vocEntries: VocEntry[];
}

// Final Release 섹션14: "오늘의 현황" — 실제 신청 데이터(rows)로 계산 가능한 항목은 실데이터,
// 아직 전역 집계 저장소가 없는 항목(공유/포인트/인기기능)은 "—"로 표시하고 주석으로 이유를 남긴다.
// 정직하게: 이 브라우저의 localStorage는 회사별로 나뉘어 있어 전체 공유/포인트 총합을 낼 수 없다 —
// Supabase에 전역 집계 테이블이 생기면 이 컴포넌트의 해당 칸만 실제 쿼리로 교체하면 된다.
function TodaySummaryPanel({ rows, vocEntries }: TodaySummaryPanelProps) {
  const todayStr = new Date().toDateString();
  const todayRows = rows.filter((r) => new Date(r.created_at).toDateString() === todayStr);
  const todayVoc = vocEntries.filter((v) => new Date(v.createdAt).toDateString() === todayStr);
  const todayCompleted = todayRows.filter((r) => r.status === "completed" || r.health_score != null).length;
  const conversionRate = todayRows.length > 0 ? Math.round((todayCompleted / todayRows.length) * 100) : 0;

  const stats: { label: string; value: string }[] = [
    { label: "오늘 신규기업", value: `${todayRows.length}` },
    { label: "오늘 진단완료", value: `${todayCompleted}` },
    { label: "오늘 상담", value: `${todayRows.filter((r) => r.status === "deep_requested" || r.status === "deep_completed").length}` },
    { label: "가입전환율", value: `${conversionRate}%` },
    { label: "오늘 계약", value: "—" },
    { label: "오늘 절감예상", value: "—" },
    { label: "오늘 공유", value: "—" },
    { label: "오늘 VOC", value: `${todayVoc.length}` },
  ];

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-base">오늘의 현황</p>
        <span className="text-[10px] px-2 py-1 rounded-full bg-line text-ink-700/60">
          "—" 항목은 전역 집계 저장소 필요 (Supabase 연동 후 표시)
        </span>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[11px] text-ink-700/50 mb-1">{s.label}</p>
            <p className="font-mono font-bold text-lg text-ink-950">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// V9 섹션6: 관리자 AI 요약 — TOP5 발견된 문제 + AI 요약 문구 (둘 다 Mock, 라벨로 명시)
function AiSummaryPanel({ totalApplications }: { totalApplications: number }) {
  const [issues] = useState(() => getTopIssuesMock("admin", totalApplications));
  const [summary] = useState(() => getAiWeeklySummaryMock("admin"));

  return (
    <div className="bg-white rounded-xl2 shadow-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-base">AI 요약</p>
        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-400/20 text-amber-500 font-medium">
          Mock · 실 데이터는 findings 집계 연동 필요
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-ink-700/50 mb-2">가장 많이 발견된 문제 TOP5</p>
          <div className="space-y-1.5">
            {issues.map((issue, i) => (
              <div key={issue.label} className="flex items-center justify-between text-sm">
                <span className="text-ink-700/70">
                  {i + 1}. {issue.label}
                </span>
                <span className="font-mono text-ink-950">{issue.count}건</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-700/50 mb-2">이번주 AI 요약</p>
          <ul className="space-y-1.5">
            {summary.map((s) => (
              <li key={s} className="text-sm text-ink-800">
                • {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CommunityVocPanel() {
  const [entries, setEntries] = useState<VocEntry[]>([]);

  useEffect(() => {
    setEntries(getAllVocEntries());
  }, []);

  const countByCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  function handleStatusChange(entryId: string, status: VocStatus) {
    updateVocStatus(entryId, status);
    setEntries(getAllVocEntries());
  }

  return (
    <div className="mt-8 bg-white rounded-xl2 shadow-card p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg">커뮤니티 VOC (Mock)</h2>
        <span className="text-[10px] px-2 py-1 rounded-full bg-amber-400/20 text-amber-500 font-medium">
          이 브라우저 기준 · 실서비스는 Supabase 집계 필요
        </span>
      </div>
      <p className="text-xs text-ink-700/40 mb-4">
        고객 대시보드에서 접수된 의견이 AI(현재는 키워드 기반 경량 분류)로 자동 분류됩니다. 승인된 항목만
        AI 학습데이터로 저장하는 것으로 간주합니다.
      </p>

      <div className="flex flex-wrap gap-2 mb-5">
        {Object.entries(countByCategory).map(([category, count]) => (
          <span
            key={category}
            className={clsx("text-xs px-2.5 py-1 rounded-full font-medium", VOC_CATEGORY_COLOR[category as VocCategory])}
          >
            {category} {count}
          </span>
        ))}
        {entries.length === 0 && <span className="text-xs text-ink-700/40">아직 접수된 의견이 없습니다.</span>}
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {entries.map((e) => (
          <div key={e.id} className="border-b border-line pb-3 last:border-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-medium", VOC_CATEGORY_COLOR[e.category])}>
                  {e.category}
                </span>
                {e.rating != null && <span className="text-[10px] text-amber-500">{"★".repeat(e.rating)}</span>}
              </div>
              <span className="text-[10px] text-ink-700/40">{new Date(e.createdAt).toLocaleString("ko-KR")}</span>
            </div>
            <p className="text-xs text-ink-800 mb-2">{e.text}</p>
            <div className="flex gap-1.5">
              {(Object.keys(VOC_STATUS_LABEL) as VocStatus[])
                .filter((s) => s !== "pending")
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(e.id, s)}
                    className={clsx(
                      "text-[10px] px-2 py-1 rounded-full border",
                      e.status === s ? "bg-ink-950 text-white border-ink-950" : "border-line text-ink-700/50"
                    )}
                  >
                    {VOC_STATUS_LABEL[s]}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LaborPartner {
  id: string;
  partner_name: string;
  access_code: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

// v11: 노무법인 담당자 코드 발급/조회 — 회원가입 없이 관리자가 코드만 찍어낸다.
function LaborPartnerPanel({ accessKey }: { accessKey: string }) {
  const [partners, setPartners] = useState<LaborPartner[]>([]);
  const [partnerName, setPartnerName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/labor-partners?key=${encodeURIComponent(accessKey)}`);
    if (res.ok) setPartners((await res.json()).partners ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setCreating(true);
    await fetch("/api/admin/labor-partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: accessKey, partnerName: partnerName || "노무법인" }),
    });
    setCreating(false);
    setPartnerName("");
    load();
  }

  return (
    <div className="mt-8 bg-white rounded-xl2 shadow-card p-6">
      <h2 className="font-display text-lg mb-4">노무법인 담당자 코드</h2>

      <div className="flex gap-2 mb-5">
        <input
          value={partnerName}
          onChange={(e) => setPartnerName(e.target.value)}
          placeholder="노무법인 내부 식별명 (예: A노무법인)"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-vital-500"
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          className="text-xs px-4 py-2 rounded-full bg-ink-950 text-white disabled:opacity-40"
        >
          {creating ? "발급 중…" : "코드 발급"}
        </button>
      </div>

      <div className="space-y-2">
        {partners.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm border-b border-line pb-2 last:border-0">
            <div>
              <span className="text-ink-800">{p.partner_name}</span>
              <span className="ml-2 font-mono text-xs text-vital-600">{p.access_code}</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.is_active ? "bg-vital-200 text-vital-600" : "bg-line text-ink-700/50"}`}>
              {p.is_active ? "활성" : "비활성"}
            </span>
          </div>
        ))}
        {partners.length === 0 && <p className="text-xs text-ink-700/40">발급된 코드가 없습니다.</p>}
      </div>
    </div>
  );
}
