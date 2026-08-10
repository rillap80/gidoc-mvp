"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

type InsuranceStatus = "all" | "partial" | "none" | "unknown";
type SubsidyStatus = "current" | "past" | "none" | "unknown";

const INSURANCE_OPTIONS: { value: InsuranceStatus; label: string }[] = [
  { value: "all", label: "모두 가입" },
  { value: "partial", label: "일부 가입" },
  { value: "none", label: "미가입" },
  { value: "unknown", label: "잘 모르겠음" },
];

const SUBSIDY_OPTIONS: { value: SubsidyStatus; label: string }[] = [
  { value: "current", label: "현재 받고 있음" },
  { value: "past", label: "과거 받은 적 있음" },
  { value: "none", label: "받은 적 없음" },
  { value: "unknown", label: "잘 모르겠음" },
];

const MAX_FILES = 10;

export default function LaborDiagnosisFormPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const applicationId = String(id);

  const [employeeCount, setEmployeeCount] = useState("");
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus | "">("");
  const [hiringLastYear, setHiringLastYear] = useState<boolean | null>(null);
  const [leavingLastYear, setLeavingLastYear] = useState<boolean | null>(null);
  const [subsidyStatus, setSubsidyStatus] = useState<SubsidyStatus | "">("");
  const [mainQuestion, setMainQuestion] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isValid =
    employeeCount !== "" &&
    Number(employeeCount) >= 0 &&
    insuranceStatus !== "" &&
    hiringLastYear !== null &&
    leavingLastYear !== null &&
    subsidyStatus !== "";

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...selected].slice(0, MAX_FILES));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);

    try {
      const submitRes = await fetch("/api/labor/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          employeeCount: Number(employeeCount),
          insuranceStatus,
          hiringLastYear,
          leavingLastYear,
          subsidyStatus,
          mainQuestion,
        }),
      });
      if (!submitRes.ok) throw new Error("submit failed");
      const { diagnosisId } = await submitRes.json();

      // 자료가 없어도 신청은 가능하므로, 파일이 있을 때만 순차 업로드한다.
      for (const file of files) {
        const formData = new FormData();
        formData.append("applicationId", applicationId);
        formData.append("diagnosisId", diagnosisId);
        formData.append("file", file);
        const uploadRes = await fetch("/api/labor/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          console.error(`파일 업로드 실패: ${file.name}`);
          // 파일 하나가 실패해도 신청 자체는 이미 접수됐으므로 계속 진행한다.
        }
      }

      setDone(true);
    } catch {
      setError("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-vital-50 text-vital-600 flex items-center justify-center text-2xl">
            ✓
          </div>
          <h1 className="font-display text-2xl mb-3">신청이 완료되었습니다.</h1>
          <p className="text-sm text-ink-700/60 mb-8 leading-relaxed">
            제출하신 기본정보와 자료가 노무 정밀진단을 위해 전달되었습니다.
          </p>
          <button
            onClick={() => router.push(`/result/${applicationId}`)}
            className="w-full rounded-full bg-ink-950 text-white py-3.5 text-sm font-medium hover:bg-ink-800 transition-colors"
          >
            내 기업 건강검진 보기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 bg-paper">
      <div className="max-w-md mx-auto">
        <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-4 text-center">
          노무 정밀진단
        </p>
        <h1 className="font-display text-2xl text-center mb-2">기본 정보만 남겨주세요</h1>
        <p className="text-xs text-ink-700/50 text-center mb-8">
          세부 상담은 노무법인에서 별도로 진행됩니다.
        </p>

        <div className="bg-white rounded-xl2 shadow-card p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">① 현재 직원 수</label>
            <input
              type="number"
              min={0}
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              placeholder="예: 12"
              className="w-full rounded-lg border border-line px-4 py-2.5 text-sm outline-none focus:border-vital-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">② 4대보험 가입 여부</label>
            <div className="grid grid-cols-2 gap-2">
              {INSURANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setInsuranceStatus(opt.value)}
                  className={`text-xs px-3 py-2.5 rounded-lg border ${
                    insuranceStatus === opt.value ? "bg-ink-950 text-white border-ink-950" : "border-line text-ink-700/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">③ 최근 1년 내 직원 채용 여부</label>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setHiringLastYear(v)}
                  className={`text-xs px-3 py-2.5 rounded-lg border ${
                    hiringLastYear === v ? "bg-ink-950 text-white border-ink-950" : "border-line text-ink-700/70"
                  }`}
                >
                  {v ? "있음" : "없음"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">④ 최근 1년 내 직원 퇴사 여부</label>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => setLeavingLastYear(v)}
                  className={`text-xs px-3 py-2.5 rounded-lg border ${
                    leavingLastYear === v ? "bg-ink-950 text-white border-ink-950" : "border-line text-ink-700/70"
                  }`}
                >
                  {v ? "있음" : "없음"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">⑤ 정부지원금·고용지원금 수령 여부</label>
            <div className="grid grid-cols-2 gap-2">
              {SUBSIDY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSubsidyStatus(opt.value)}
                  className={`text-xs px-3 py-2.5 rounded-lg border ${
                    subsidyStatus === opt.value ? "bg-ink-950 text-white border-ink-950" : "border-line text-ink-700/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">⑥ 현재 가장 궁금한 노무 문제</label>
            <textarea
              value={mainQuestion}
              onChange={(e) => setMainQuestion(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="자유롭게 입력해주세요"
              className="w-full rounded-lg border border-line px-4 py-2.5 text-sm outline-none focus:border-vital-500 resize-none"
            />
          </div>

          <div className="border-t border-line pt-5">
            <label className="block text-sm font-medium mb-1">관련 서류 업로드</label>
            <p className="text-xs text-ink-700/50 mb-3 leading-relaxed">
              보유하고 있는 관련 서류가 있다면 업로드해주세요.
              <br />
              자료가 없어도 정밀진단 신청은 가능합니다.
              <br />
              예: 급여대장, 근로계약서, 4대보험 관련 자료, 정부지원금 관련 자료, 기타 노무 관련 자료
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="text-xs w-full"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.hwp,.jpg,.jpeg,.png"
            />
            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-xs bg-paper rounded-lg px-3 py-2">
                    <span className="truncate">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-ink-700/40 ml-2 shrink-0">
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full rounded-full bg-ink-950 text-white py-3.5 text-sm font-medium disabled:opacity-30"
          >
            {submitting ? "제출 중…" : "신청 완료"}
          </button>

          {error && <p className="text-amber-500 text-xs text-center">{error}</p>}
        </div>
      </div>
    </main>
  );
}
