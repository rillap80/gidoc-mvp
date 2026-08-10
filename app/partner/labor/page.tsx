"use client";

import { useEffect, useState } from "react";

const INSURANCE_LABEL: Record<string, string> = {
  all: "모두 가입",
  partial: "일부 가입",
  none: "미가입",
  unknown: "잘 모르겠음",
};
const SUBSIDY_LABEL: Record<string, string> = {
  current: "현재 받고 있음",
  past: "과거 받은 적 있음",
  none: "받은 적 없음",
  unknown: "잘 모르겠음",
};
const STATUS_LABEL: Record<string, string> = {
  submitted: "접수",
  in_review: "검토중",
  contacted: "연락완료",
  closed: "종료",
};

interface DiagnosisListItem {
  id: string;
  employee_count: number;
  insurance_status: string;
  status: string;
  created_at: string;
  application_id: string;
  applications: { company_name: string; ceo_name: string } | null;
}

interface DiagnosisDetail {
  id: string;
  application_id: string;
  employee_count: number;
  insurance_status: string;
  hiring_last_year: boolean;
  leaving_last_year: boolean;
  subsidy_status: string;
  main_question: string;
  status: string;
  created_at: string;
  applications: { company_name: string; ceo_name: string } | null;
}

interface DocumentItem {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
}

// 세션(탭)이 열려있는 동안만 코드를 들고 있는다 — localStorage보다 노출 범위가 좁다.
const SESSION_KEY = "gidoc:labor-partner-code";

export default function LaborPartnerPortal() {
  const [code, setCode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ diagnosis: DiagnosisDetail; phone: string | null; documents: DocumentItem[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      setCode(saved);
      loadDiagnoses(saved);
    }
  }, []);

  async function handleLogin() {
    setAuthError(null);
    setLoading(true);
    const res = await fetch("/api/partner/labor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-partner-code": code },
      body: JSON.stringify({ accessCode: code }),
    });
    setLoading(false);
    if (!res.ok) {
      setAuthError("담당자 코드를 확인해주세요.");
      return;
    }
    sessionStorage.setItem(SESSION_KEY, code);
    loadDiagnoses(code);
  }

  async function loadDiagnoses(accessCode: string) {
    setLoading(true);
    const res = await fetch("/api/partner/labor/diagnoses", { headers: { "x-partner-code": accessCode } });
    setLoading(false);
    if (!res.ok) {
      sessionStorage.removeItem(SESSION_KEY);
      setAuthed(false);
      return;
    }
    const data = await res.json();
    setDiagnoses(data.diagnoses ?? []);
    setAuthed(true);
  }

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    const res = await fetch(`/api/partner/labor/diagnoses/${id}`, { headers: { "x-partner-code": code } });
    if (res.ok) setDetail(await res.json());
  }

  async function handleDownload(documentId: string) {
    const res = await fetch(`/api/partner/labor/documents/${documentId}/download`, {
      headers: { "x-partner-code": code },
    });
    if (!res.ok) return;
    const { url } = await res.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-xs w-full">
          <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-2 text-center">
            노무법인 담당자
          </p>
          <h1 className="font-display text-xl text-center mb-8">담당자 코드 입력</h1>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="담당자 코드를 입력해주세요"
            className="w-full rounded-lg border border-line px-4 py-3 text-sm outline-none focus:border-vital-500 mb-4"
          />
          <button
            onClick={handleLogin}
            disabled={!code || loading}
            className="w-full rounded-full bg-ink-950 text-white py-3 text-sm font-medium disabled:opacity-40"
          >
            {loading ? "확인 중…" : "로그인"}
          </button>
          {authError && <p className="text-amber-500 text-xs text-center mt-4">{authError}</p>}
        </div>
      </main>
    );
  }

  if (selectedId && detail) {
    const d = detail.diagnosis;
    return (
      <main className="min-h-screen px-6 py-12 bg-paper">
        <div className="max-w-xl mx-auto">
          <button onClick={() => setSelectedId(null)} className="text-xs text-ink-700/50 mb-6">
            ← 목록으로
          </button>
          <h1 className="font-display text-2xl mb-1">{d.applications?.company_name}</h1>
          <p className="text-sm text-ink-700/50 mb-8">대표: {d.applications?.ceo_name}</p>

          <div className="bg-white rounded-xl2 shadow-card p-6 mb-6">
            <h2 className="font-display text-base mb-4">기업 기본정보</h2>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <InfoRow label="연락처" value={detail.phone ?? "-"} />
              <InfoRow label="신청일" value={new Date(d.created_at).toLocaleDateString("ko-KR")} />
              <InfoRow label="직원 수" value={`${d.employee_count}명`} />
              <InfoRow label="4대보험" value={INSURANCE_LABEL[d.insurance_status] ?? "-"} />
              <InfoRow label="최근 채용" value={d.hiring_last_year ? "있음" : "없음"} />
              <InfoRow label="최근 퇴사" value={d.leaving_last_year ? "있음" : "없음"} />
              <InfoRow label="정부지원금" value={SUBSIDY_LABEL[d.subsidy_status] ?? "-"} />
            </div>
            {d.main_question && (
              <div className="mt-4 pt-4 border-t border-line">
                <p className="text-xs text-ink-700/50 mb-1">현재 가장 궁금한 노무 문제</p>
                <p className="text-sm text-ink-800">{d.main_question}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl2 shadow-card p-6">
            <h2 className="font-display text-base mb-4">제출 서류</h2>
            {detail.documents.length === 0 ? (
              <p className="text-xs text-ink-700/40">제출된 서류가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {detail.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between text-sm border-b border-line pb-2 last:border-0">
                    <div>
                      <p className="text-ink-800">{doc.file_name}</p>
                      <p className="text-[11px] text-ink-700/40">
                        {new Date(doc.uploaded_at).toLocaleDateString("ko-KR")}
                        {doc.file_type ? ` · ${doc.file_type}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownload(doc.id)}
                      className="text-xs px-3 py-1.5 rounded-full bg-ink-950 text-white shrink-0"
                    >
                      다운로드
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 bg-paper">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-2xl mb-8">정밀진단 기업 목록</h1>
        <div className="space-y-3">
          {diagnoses.map((item) => (
            <button
              key={item.id}
              onClick={() => openDetail(item.id)}
              className="w-full text-left bg-white rounded-xl2 shadow-card p-5 hover:border-ink-950/20 border border-transparent transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-ink-900">{item.applications?.company_name ?? "-"}</span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-line text-ink-700">
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-ink-700/50">
                <span>대표 {item.applications?.ceo_name ?? "-"}</span>
                <span>직원 {item.employee_count}명</span>
                <span>{INSURANCE_LABEL[item.insurance_status] ?? "-"}</span>
                <span>{new Date(item.created_at).toLocaleDateString("ko-KR")}</span>
              </div>
            </button>
          ))}
          {diagnoses.length === 0 && (
            <p className="text-center text-sm text-ink-700/40 py-10">아직 접수된 정밀진단이 없습니다.</p>
          )}
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-700/50">{label}</p>
      <p className="text-ink-900">{value}</p>
    </div>
  );
}
