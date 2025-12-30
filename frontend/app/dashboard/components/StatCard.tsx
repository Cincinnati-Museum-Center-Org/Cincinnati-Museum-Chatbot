'use client';

import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle: string;
  trend?: string;
  trendUp?: boolean;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  trendUp,
  onClick,
}: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-xl p-5 border border-slate-200 ${onClick ? 'cursor-pointer hover:border-[#4B7BF5] transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">{subtitle}</span>
        {trend && (
          <span
            className={`text-xs font-medium ${trendUp ? 'text-emerald-600' : 'text-orange-600'}`}
          >
            {trend}
          </span>
        )}
      </div>
      {onClick && (
        <p className="text-xs text-[#4B7BF5] mt-2">Click to view details →</p>
      )}
    </div>
  );
}
