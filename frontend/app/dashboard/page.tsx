'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../context/AdminAuthContext';
import Image from 'next/image';
import { 
  MessageSquare, 
  ThumbsUp, 
  Clock, 
  AlertCircle,
  LogOut,
  RefreshCw,
  Loader2,
  Filter,
  ChevronRight,
  Calendar,
  ThumbsDown,
  User,
  ChevronDown,
} from 'lucide-react';
import {
  dashboardConfig,
  getSatisfactionStatus,
  getResponseTimeStatus,
  getNegativeFeedbackStatus,
} from '../config/dashboardConfig';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

// Get API config
const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || '';

interface DashboardStats {
  totalConversations: number;
  conversationsToday: number;
  totalFeedback: number;
  positiveFeedback: number;
  negativeFeedback: number;
  noFeedback: number;
  satisfactionRate: number;
  avgResponseTimeMs: number;
  conversationsByDay: Array<{ date: string; count: number; dayName: string }>;
}

interface Conversation {
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

interface FeedbackSummary {
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

// Time period options
const TIME_PERIODS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, signOut } = useAdminAuth();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations'>('overview');
  const [feedbackFilter, setFeedbackFilter] = useState<string>('');
  
  // Time period state
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);

  // User dropdown state
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/admin');
    }
  }, [isAuthenticated, authLoading, router]);

  const fetchStats = useCallback(async (days: number = selectedPeriod) => {
    if (!user?.idToken) return;
    
    const headers = {
      'Authorization': user.idToken,
      'Content-Type': 'application/json',
    };

    const [statsRes, feedbackRes] = await Promise.all([
      fetch(`${ADMIN_API_URL}/stats?days=${days}`, { headers }),
      fetch(`${ADMIN_API_URL}/feedback-summary?days=${days}`, { headers }),
    ]);

    if (!statsRes.ok || !feedbackRes.ok) {
      throw new Error('Failed to fetch dashboard data');
    }

    const [statsData, feedbackData] = await Promise.all([
      statsRes.json(),
      feedbackRes.json(),
    ]);

    setStats(statsData);
    setFeedbackSummary(feedbackData);
  }, [user?.idToken, selectedPeriod]);

  const fetchConversations = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!user?.idToken) return;
    
    const headers = {
      'Authorization': user.idToken,
      'Content-Type': 'application/json',
    };

    const limit = dashboardConfig.pagination.pageSize;
    const offset = (page - 1) * limit;
    
    const conversationsRes = await fetch(
      `${ADMIN_API_URL}/conversations?limit=${limit}&offset=${offset}${feedbackFilter ? `&feedback=${feedbackFilter}` : ''}`, 
      { headers }
    );

    if (!conversationsRes.ok) {
      throw new Error('Failed to fetch conversations');
    }

    const conversationsData = await conversationsRes.json();
    
    if (append) {
      setConversations(prev => [...prev, ...(conversationsData.conversations || [])]);
    } else {
      setConversations(conversationsData.conversations || []);
    }
    
    setHasMore(conversationsData.hasMore || false);
    setTotalLoaded(append ? totalLoaded + (conversationsData.conversations?.length || 0) : conversationsData.conversations?.length || 0);
  }, [user?.idToken, feedbackFilter, totalLoaded]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      await Promise.all([
        fetchStats(selectedPeriod),
        fetchConversations(1, false),
      ]);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchStats, fetchConversations, selectedPeriod]);

  useEffect(() => {
    if (isAuthenticated && user?.idToken) {
      fetchData();
    }
  }, [isAuthenticated, user?.idToken, fetchData]);

  const handlePeriodChange = async (days: number) => {
    setSelectedPeriod(days);
    setIsLoading(true);
    try {
      await fetchStats(days);
    } catch (err) {
      console.error('Error changing period:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    try {
      await fetchConversations(nextPage, true);
    } catch (err) {
      console.error('Error loading more conversations:', err);
    }
  };

  const handleFilterChange = async () => {
    setCurrentPage(1);
    setIsLoading(true);
    try {
      await fetchConversations(1, false);
    } catch (err) {
      console.error('Error filtering conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    router.push('/admin');
  };

  // Quick filter to show negative feedback in conversations tab
  const showNegativeFeedback = () => {
    setFeedbackFilter('neg');
    setActiveTab('conversations');
    setTimeout(() => handleFilterChange(), 100);
  };

  if (authLoading || (!isAuthenticated && !authLoading)) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#4B7BF5]" />
      </div>
    );
  }

  // Get threshold-based statuses
  const satisfactionStatus = getSatisfactionStatus(stats?.satisfactionRate || 0);
  const responseTimeStatus = getResponseTimeStatus(stats?.avgResponseTimeMs || 0);
  const negativeFeedbackStatus = getNegativeFeedbackStatus(stats?.negativeFeedback || 0);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-[#4B7BF5] text-white px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title - Left aligned */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-black rounded-lg overflow-hidden">
              <Image 
                src="/CMC_LOGO.svg" 
                alt="Logo" 
                width={40} 
                height={40}
                className="invert"
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Admin Dashboard</h1>
              <p className="text-sm text-white/80">Cincinnati Museum Center</p>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 h-10 px-4 bg-white text-[#4B7BF5] font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-70"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* User Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 h-10 px-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#4B7BF5] rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {user?.username}
                        </p>
                        <p className="text-xs text-slate-500">Administrator</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleSignOut();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {(['overview', 'conversations'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-[#4B7BF5] text-[#4B7BF5]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Conversations"
                value={stats?.totalConversations || 0}
                icon={<MessageSquare className="w-6 h-6 text-[#4B7BF5]" />}
                subtitle={`${stats?.conversationsToday || 0} today`}
                trend={stats?.conversationsToday ? `+${stats.conversationsToday} today` : undefined}
                trendUp={true}
              />
              <StatCard
                title="Satisfaction Rate"
                value={`${stats?.satisfactionRate || 0}%`}
                icon={<ThumbsUp className="w-6 h-6 text-emerald-500" />}
                subtitle={`${stats?.totalFeedback || 0} responses`}
                trend={satisfactionStatus.label}
                trendUp={satisfactionStatus.isGood}
              />
              <StatCard
                title="Avg. Response Time"
                value={`${((stats?.avgResponseTimeMs || 0) / 1000).toFixed(1)}s`}
                icon={<Clock className="w-6 h-6 text-blue-500" />}
                subtitle={`Last ${selectedPeriod} days`}
                trend={responseTimeStatus.label}
                trendUp={responseTimeStatus.isGood}
              />
              <StatCard
                title="Negative Feedback"
                value={stats?.negativeFeedback || 0}
                icon={<AlertCircle className="w-6 h-6 text-orange-500" />}
                subtitle="Requires attention"
                trend={negativeFeedbackStatus.label}
                trendUp={negativeFeedbackStatus.isGood}
                onClick={stats?.negativeFeedback ? showNegativeFeedback : undefined}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Conversations Chart with Period Selector */}
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">Conversations</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <select
                      value={selectedPeriod}
                      onChange={(e) => handlePeriodChange(Number(e.target.value))}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#4B7BF5] focus:border-transparent outline-none"
                    >
                      {TIME_PERIODS.map((period) => (
                        <option key={period.days} value={period.days}>
                          {period.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="h-72">
                  {stats?.conversationsByDay && stats.conversationsByDay.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.conversationsByDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4B7BF5" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#4B7BF5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="dayName" 
                          tick={{ fontSize: 12, fill: '#64748b' }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={false}
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
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                          formatter={(value) => [value, 'Conversations']}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#4B7BF5" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorConversations)" 
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

              {/* Satisfaction Pie */}
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">User Satisfaction</h3>
                <div className="h-72">
                  {feedbackSummary && (feedbackSummary.summary.positive > 0 || feedbackSummary.summary.negative > 0 || feedbackSummary.summary.noFeedback > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Positive', value: feedbackSummary.summary.positive, color: '#10b981' },
                            { name: 'No Feedback', value: feedbackSummary.summary.noFeedback, color: '#f59e0b' },
                            { name: 'Negative', value: feedbackSummary.summary.negative, color: '#ef4444' },
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                        >
                          {[
                            { name: 'Positive', value: feedbackSummary.summary.positive, color: '#10b981' },
                            { name: 'No Feedback', value: feedbackSummary.summary.noFeedback, color: '#f59e0b' },
                            { name: 'Negative', value: feedbackSummary.summary.negative, color: '#ef4444' },
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
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
            </div>
          </div>
        )}

        {activeTab === 'conversations' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-wrap items-center gap-4">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={feedbackFilter}
                onChange={(e) => setFeedbackFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#4B7BF5] focus:border-transparent outline-none"
              >
                <option value="">All Feedback</option>
                <option value="pos">Positive Only</option>
                <option value="neg">Negative Only</option>
                <option value="none">No Feedback</option>
              </select>
              <button
                onClick={handleFilterChange}
                className="px-4 py-2 bg-[#4B7BF5] text-white rounded-lg text-sm hover:bg-[#3D6AE0] transition-colors"
              >
                Apply
              </button>
              <span className="text-sm text-slate-500 ml-auto">
                Showing {conversations.length} conversations
              </span>
            </div>

            {/* Negative Feedback Alert Banner */}
            {feedbackFilter === 'neg' && feedbackSummary && feedbackSummary.recentNegative.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ThumbsDown className="w-5 h-5 text-orange-500" />
                  <h4 className="font-semibold text-orange-800">
                    {feedbackSummary.recentNegative.length} Negative Feedback Items
                  </h4>
                </div>
                <p className="text-sm text-orange-700">
                  Review these conversations to identify areas for improvement in the chatbot responses.
                </p>
              </div>
            )}

            {/* Conversations List */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Question</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Date</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Feedback</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Response Time</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Citations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversations.map((conv) => (
                      <tr 
                        key={conv.conversationId} 
                        className={`border-b border-slate-100 hover:bg-slate-50 ${
                          conv.feedback === 'neg' ? 'bg-orange-50/50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-800 line-clamp-2 max-w-md">{conv.question}</p>
                          {conv.feedback === 'neg' && conv.answerPreview && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                              Answer: {conv.answerPreview}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {new Date(conv.timestamp).toLocaleDateString()}
                          <span className="block text-xs text-slate-400">
                            {new Date(conv.timestamp).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {conv.feedback === 'pos' && (
                            <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                              Positive
                            </span>
                          )}
                          {conv.feedback === 'neg' && (
                            <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                              Negative
                            </span>
                          )}
                          {!conv.feedback && (
                            <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">
                              None
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {(conv.responseTimeMs / 1000).toFixed(1)}s
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {conv.citationCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {conversations.length === 0 && !isLoading && (
                <div className="p-8 text-center text-slate-500">
                  No conversations found
                </div>
              )}
              {isLoading && (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#4B7BF5] mx-auto" />
                </div>
              )}
            </div>

            {/* Pagination */}
            {hasMore && (
              <div className="flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  icon, 
  subtitle, 
  trend, 
  trendUp,
  onClick,
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  subtitle: string;
  trend?: string;
  trendUp?: boolean;
  onClick?: () => void;
}) {
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
        <div className="p-2 bg-slate-50 rounded-lg">
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">{subtitle}</span>
        {trend && (
          <span className={`text-xs font-medium ${trendUp ? 'text-emerald-600' : 'text-orange-600'}`}>
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
