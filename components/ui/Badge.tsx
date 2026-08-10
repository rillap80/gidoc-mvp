import clsx from "clsx";
import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "vital" | "amber" | "red" | "ink";
  className?: string;
}

const TONE = {
  neutral: "bg-line text-ink-700",
  vital: "bg-vital-200 text-vital-600",
  amber: "bg-amber-400/20 text-amber-500",
  red: "bg-red-100 text-red-600",
  ink: "bg-ink-950 text-white",
};

export default function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span className={clsx("inline-block px-2.5 py-1 rounded-full text-xs font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}
