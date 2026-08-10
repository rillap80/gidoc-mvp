"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getSuccessCases, type CaseCategory } from "@/lib/mock/success-cases";
import { formatManwon } from "@/lib/mock/dashboard-data";

const FILTERS: CaseCategory[] = ["정책자금", "세무", "노무", "보험", "법무"];

export default function SuccessCasesPage() {
  const [filter, setFilter] = useState<CaseCategory | null>(null);
  const cases = getSuccessCases(filter ?? undefined);

  return (
    <main className="min-h-screen bg-paper px-4 sm:px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-2">성공사례</p>
        <h1 className="font-display text-2xl mb-6">비슷한 기업들의 실제 사례</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter(null)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${
              filter === null ? "bg-ink-950 text-white" : "bg-white text-ink-700/60 border border-line"
            }`}
          >
            전체
          </button>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                filter === f ? "bg-ink-950 text-white" : "bg-white text-ink-700/60 border border-line"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {cases.map((c) => (
            <Card key={c.id}>
              <div className="flex items-center justify-between mb-2">
                <Badge tone="neutral">{c.industry}</Badge>
                <Badge tone="vital">{c.category}</Badge>
              </div>
              <p className="text-sm font-medium text-ink-900 mb-1">{c.companyLabel}</p>
              <p className="text-xs text-ink-700/60 mb-3">{c.summary}</p>
              {c.amountManwon > 0 && (
                <p className="font-mono font-bold text-xl text-vital-600 mb-3">
                  {c.isSaving ? "절감 " : "확보 "}
                  {formatManwon(c.amountManwon)}
                </p>
              )}
              <p className="text-xs text-ink-700/50 border-t border-line pt-3">&ldquo;{c.review}&rdquo;</p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
