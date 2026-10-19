import React from "react";

interface BadgeProps {
  variant?: "success" | "error" | "warning" | "info" | "neutral" | "orange";
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = "neutral", children, className = "" }) => {
  const styles = {
    success: "bg-emerald-950/60 text-emerald-400 border-emerald-800/60",
    error: "bg-rose-950/60 text-rose-400 border-rose-800/60",
    warning: "bg-amber-950/60 text-amber-400 border-amber-800/60",
    info: "bg-sky-950/60 text-sky-400 border-sky-800/60",
    neutral: "bg-zinc-900 text-zinc-300 border-zinc-800",
    orange: "bg-orange-950/60 text-orange-400 border-orange-800/60",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
