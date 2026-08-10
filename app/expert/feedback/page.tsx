"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { addLearningQueueEntry } from "@/lib/mock/storage";
import type { LearningCategory } from "@/lib/mock/learning-queue";

const CATEGORIES: LearningCategory[] = ["노무", "세무", "보험", "법무", "정책자금"];

/**
 * V9 섹션5: 전문가 피드백 시스템. 인증 없이 이름만 입력받는 경량 MVP —
 * 실제 전문가 계정 시스템이 생기면 author를 로그인 세션 값으로 교체하면 된다.
 * 제출 내용은 lib/mock/learning-queue.ts를 통해 관리자 AI Learning Queue(섹션8)에 합류한다.
 */
export default function ExpertFeedbackPage() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<LearningCategory>("노무");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState(3);
  const [adopted, setAdopted] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!name.trim() || !content.trim()) return;
    addLearningQueueEntry({
      id: `expert-${Date.now()}`,
      author: name.trim(),
      role: "전문가",
      category,
      content: content.trim(),
      importance: importance as 1 | 2 | 3 | 4 | 5,
      adopted,
      status: adopted ? "학습대상" : "대기",
      createdAt: new Date().toISOString(),
    });
    setContent("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <main className="min-h-screen bg-paper px-4 sm:px-6 py-12">
      <div className="max-w-md mx-auto space-y-5">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-vital-600 uppercase mb-2">전문가 의견</p>
          <h1 className="font-display text-2xl">전문가 피드백 남기기</h1>
        </div>

        <Card>
          <label className="block text-xs text-ink-700/60 mb-1.5">이름</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동 노무사"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-vital-500 mb-4"
          />

          <label className="block text-xs text-ink-700/60 mb-1.5">카테고리</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                  category === c ? "bg-ink-950 text-white" : "bg-paper text-ink-700/60"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <label className="block text-xs text-ink-700/60 mb-1.5">의견</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="현장에서 자주 보이는 이슈나 개선 의견을 남겨주세요."
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-vital-500 resize-none mb-4"
          />

          <label className="block text-xs text-ink-700/60 mb-1.5">중요도</label>
          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setImportance(n)} className="text-2xl leading-none">
                <span className={n <= importance ? "text-amber-400" : "text-line"}>★</span>
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-ink-700/70 mb-5">
            <input type="checkbox" checked={adopted} onChange={(e) => setAdopted(e.target.checked)} />
            AI 학습 후보로 표시
          </label>

          <Button full onClick={handleSubmit} disabled={!name.trim() || !content.trim()}>
            의견 제출
          </Button>

          {submitted && (
            <p className="text-center mt-3">
              <Badge tone="vital">제출되었습니다</Badge>
            </p>
          )}
        </Card>
      </div>
    </main>
  );
}
