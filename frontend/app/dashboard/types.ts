// Dashboard Types and Interfaces

export interface DashboardStats {
  totalConversations: number;
  conversationsToday: number;
  totalFeedback: number;
  positiveFeedback: number;
  negativeFeedback: number;
  noFeedback: number;
  satisfactionRate: number;
  avgResponseTimeMs: number;
  conversationsByDay: Array<{ date: string; count: number; dayName: string }>;
  period?: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

export interface Conversation {
  conversationId: string;
  sessionId: string;
  timestamp: string;
  date: string;
  question: string;
  answerPreview: string;
  feedback: string | null;
  responseTimeMs: number;
  citationCount: number;
  language: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  supportQuestion: string;
  createdAt: string;
}

export interface FeedbackSummary {
  summary: {
    positive: number;
    negative: number;
    noFeedback: number;
    total: number;
    satisfactionRate: number;
  };
  recentNegative: Array<{
    conversationId: string;
    timestamp: string;
    question: string;
    answerPreview: string;
  }>;
}

export interface TimePeriod {
  label: string;
  days: number;
  id: string;
}

export interface TimezoneOption {
  value: string;
  label: string;
  short: string;
}

// Constants
export const TIME_PERIODS: TimePeriod[] = [
  { label: 'Last Week', days: 7, id: 'week' },
  { label: 'Last Month', days: 30, id: 'month' },
  { label: 'Last 3 Months', days: 90, id: '3months' },
  { label: 'Custom', days: 0, id: 'custom' },
];

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'America/New_York', label: 'Eastern (ET)', short: 'ET' },
  { value: 'America/Chicago', label: 'Central (CT)', short: 'CT' },
  { value: 'America/Denver', label: 'Mountain (MT)', short: 'MT' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)', short: 'PT' },
  { value: 'UTC', label: 'UTC', short: 'UTC' },
];

// Helper function
export const formatInTimezone = (dateString: string, tz: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
};
