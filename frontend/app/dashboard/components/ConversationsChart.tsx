'use client';

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface ChartDataPoint {
  date: string;
  endDate?: string;  // For aggregated periods (week/month end date)
  count: number;
  dayName: string;
  label?: string;  // Display label for X-axis
}

interface ConversationsChartProps {
  data: ChartDataPoint[];
  periodLabel: string;
  onDateClick?: (date: string, count: number) => void;
}

// Custom dot component that handles clicks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomDot = (props: any) => {
  const { cx, cy, payload, onDateClick } = props;
  
  if (!cx || !cy) return null;
  
  const handleClick = () => {
    console.log('Dot clicked:', payload);
    if (onDateClick && payload) {
      onDateClick(payload.date, payload.count);
    }
  };
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="#4B7BF5"
      stroke="#fff"
      strokeWidth={2}
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
    />
  );
};

// Custom active dot component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomActiveDot = (props: any) => {
  const { cx, cy, payload, onDateClick } = props;
  
  if (!cx || !cy) return null;
  
  const handleClick = () => {
    console.log('Active dot clicked:', payload);
    if (onDateClick && payload) {
      onDateClick(payload.date, payload.count);
    }
  };
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={8}
      fill="#4B7BF5"
      stroke="#fff"
      strokeWidth={3}
      style={{ cursor: 'pointer' }}
      onClick={handleClick}
    />
  );
};

export function ConversationsChart({ data, periodLabel, onDateClick }: ConversationsChartProps) {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Conversations Over Time</h3>
          {onDateClick && (
            <p className="text-xs text-slate-400 mt-0.5">Click on a data point to view conversations</p>
          )}
        </div>
        <span className="text-sm text-slate-500">{periodLabel}</span>
      </div>
      <div className="h-80">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4B7BF5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4B7BF5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                interval={0}
                angle={data.length > 15 ? -45 : 0}
                textAnchor={data.length > 15 ? 'end' : 'middle'}
                height={data.length > 15 ? 60 : 30}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value) => [value, 'Conversations']}
                labelFormatter={(_label, payload) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const item = payload?.[0]?.payload as any;
                  if (item?.dayName) {
                    // For aggregated data, dayName contains the full range description
                    return item.dayName;
                  }
                  return String(_label);
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#4B7BF5"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorConversations)"
                dot={<CustomDot onDateClick={onDateClick} />}
                activeDot={<CustomActiveDot onDateClick={onDateClick} />}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}
