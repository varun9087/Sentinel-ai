import React from "react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
}) => {
  return (
    <div className="bg-[#12141c] border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700 transition-all duration-200 shadow-sm relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{title}</p>
        <div className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-orange-400 group-hover:scale-105 transition-transform">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
        {trend && (
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              trendUp ? "bg-emerald-950/60 text-emerald-400" : "bg-rose-950/60 text-rose-400"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>}
    </div>
  );
};
