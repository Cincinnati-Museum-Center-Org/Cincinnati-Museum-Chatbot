'use client';

import { useState } from 'react';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { FeedbackSummary } from '../types';

interface SatisfactionPieChartProps {
  feedbackSummary: FeedbackSummary | null;
  periodLabel: string;
}

export function SatisfactionPieChart({ feedbackSummary, periodLabel }: SatisfactionPieChartProps) {
  const [showNoFeedback, setShowNoFeedback] = useState(false);

  const hasData =
    feedbackSummary &&
    (feedbackSummary.summary.positive > 0 ||
      feedbackSummary.summary.negative > 0 ||
      feedbackSummary.summary.noFeedback > 0);

  const hasFeedbackData =
    feedbackSummary &&
    (feedbackSummary.summary.positive > 0 || feedbackSummary.summary.negative > 0);

  const allData = feedbackSummary
    ? [
        { name: 'Positive', value: feedbackSummary.summary.positive, color: '#10b981' },
        { name: 'No Feedback', value: feedbackSummary.summary.noFeedback, color: '#f59e0b' },
        { name: 'Negative', value: feedbackSummary.summary.negative, color: '#ef4444' },
      ]
    : [];

  const chartData = allData
    .filter((d) => d.value > 0)
    .filter((d) => showNoFeedback || d.name !== 'No Feedback');

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-slate-800">User Satisfaction</h3>
        <span className="text-sm text-slate-500">{periodLabel}</span>
      </div>
      
      {/* Toggle for No Feedback */}
      {hasData && (
        <div className="flex items-center justify-between mb-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showNoFeedback}
              onChange={(e) => setShowNoFeedback(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
            />
            Include &quot;No Feedback&quot;
          </label>
          {feedbackSummary && (
            <span className="text-xs text-slate-400">
              {feedbackSummary.summary.noFeedback.toLocaleString()} without feedback
            </span>
          )}
        </div>
      )}

      <div className="h-64">
        {hasData && (hasFeedbackData || showNoFeedback) ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${((percent || 0) * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value, name) => [Number(value).toLocaleString(), name]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : hasData && !hasFeedbackData ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <p>No feedback submitted yet</p>
            <p className="text-xs mt-1">
              {feedbackSummary?.summary.noFeedback.toLocaleString()} conversations without feedback
            </p>
            <button
              onClick={() => setShowNoFeedback(true)}
              className="mt-3 text-xs text-blue-500 hover:text-blue-600 underline"
            >
              Show all conversations
            </button>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            No data yet
          </div>
        )}
      </div>

      {/* Summary stats below chart */}
      {hasFeedbackData && (
        <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
            <span className="text-slate-600">{feedbackSummary?.summary.positive ?? 0} positive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            <span className="text-slate-600">{feedbackSummary?.summary.negative ?? 0} negative</span>
          </div>
        </div>
      )}
    </div>
  );
}
