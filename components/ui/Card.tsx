import clsx from "clsx";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  dark?: boolean;
}

const PADDING = { sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" };

export default function Card({ children, className, padding = "md", dark }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl2 shadow-card",
        dark ? "bg-ink-950 text-white" : "bg-white",
        PADDING[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
