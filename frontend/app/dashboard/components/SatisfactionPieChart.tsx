'use client';

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
  const hasData =
    feedbackSummary &&
    (feedbackSummary.summary.positive > 0 ||
      feedbackSummary.summary.negative > 0 ||
      feedbackSummary.summary.noFeedback > 0);

  const chartData = feedbackSummary
    ? [
        { name: 'Positive', value: feedbackSummary.summary.positive, color: '#10b981' },
        { name: 'No Feedback', value: feedbackSummary.summary.noFeedback, color: '#f59e0b' },
        { name: 'Negative', value: feedbackSummary.summary.negative, color: '#ef4444' },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">User Satisfaction</h3>
        <span className="text-sm text-slate-500">{periodLabel}</span>
      </div>
      <div className="h-72">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
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
                formatter={(value, name) => [value, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            No feedback data yet
          </div>
        )}
      </div>
    </div>
  );
}
