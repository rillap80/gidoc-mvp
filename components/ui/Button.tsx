import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  full?: boolean;
}

const VARIANT = {
  primary: "bg-ink-950 text-white hover:bg-ink-800",
  secondary: "bg-vital-500 text-white hover:bg-vital-600",
  outline: "border border-line text-ink-800 hover:border-ink-950",
  ghost: "text-ink-700/60 hover:text-ink-950",
};

const SIZE = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-4 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  full,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "rounded-full font-medium transition-colors disabled:opacity-30",
        VARIANT[variant],
        SIZE[size],
        full && "w-full",
        className
      )}
      {...props}
    />
  );
}
