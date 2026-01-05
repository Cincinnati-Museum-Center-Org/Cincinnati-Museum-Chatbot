'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../context/AdminAuthContext';
import { MessageSquare, ThumbsUp, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format, differenceInDays } from 'date-fns';
import {
  dashboardConfig,
  getSatisfactionStatus,
  getResponseTimeStatus,
  getNegativeFeedbackStatus,
} from '../config/dashboardConfig';

// Types
import {
  DashboardStats,
  Conversation,
  FeedbackSummary,
  User,
  TIME_PERIODS,
} from './types';

// Components
import {
  StatCard,
  DashboardHeader,
  DateRangeSelector,
  ConversationsChart,
  SatisfactionPieChart,
  ConversationsTab,
  UsersTab,
} from './components';

// Get API config
const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || '';

// Session expired error constant
const SESSION_EXPIRED_ERROR = 'SESSION_EXPIRED';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, signOut } = useAdminAuth();
  
  // Data state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<FeedbackSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'users'>('overview');
  const [feedbackFilter, setFeedbackFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  
  // Time period state
  const [selectedPeriod, setSelectedPeriod] = useState(7);
  const [selectedPeriodId, setSelectedPeriodId] = useState('week');
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Timezone state
  const [timezone, setTimezone] = useState('America/New_York');
  
  // Pagination state (conversations)
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);

  // Users pagination state
  const [usersPage, setUsersPage] = useState(1);
  const USERS_PAGE_SIZE = 20;

  // Helper to handle session expiry errors
  const handleSessionExpiry = useCallback((err: unknown) => {
    if (err instanceof Error && err.message === SESSION_EXPIRED_ERROR) {
      setError('Your session has expired. Redirecting to sign in...');
      setTimeout(() => {
        signOut();
        router.push('/admin');
      }, 2000);
      return true;
    }
    return false;
  }, [signOut, router]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/admin');
    }
  }, [isAuthenticated, authLoading, router]);

  // Fetch stats
  const fetchStats = useCallback(
    async (days: number = selectedPeriod, startDate?: string, endDate?: string) => {
    if (!user?.idToken) return;
    
    const headers = {
        Authorization: user.idToken,
      'Content-Type': 'application/json',
    };

      // Build query params - use explicit dates if provided, otherwise use days
      let queryParams = '';
      if (startDate && endDate) {
        queryParams = `startDate=${startDate}&endDate=${endDate}`;
      } else {
        queryParams = `days=${days}`;
      }

    const [statsRes, feedbackRes] = await Promise.all([
        fetch(`${ADMIN_API_URL}/stats?${queryParams}`, { headers }),
        fetch(`${ADMIN_API_URL}/feedback-summary?${queryParams}`, { headers }),
    ]);

    // Check for authentication errors (401/403)
    if (statsRes.status === 401 || statsRes.status === 403 || 
        feedbackRes.status === 401 || feedbackRes.status === 403) {
      throw new Error(SESSION_EXPIRED_ERROR);
    }

    if (!statsRes.ok || !feedbackRes.ok) {
      throw new Error('Failed to fetch dashboard data');
    }

    const [statsData, feedbackData] = await Promise.all([
      statsRes.json(),
      feedbackRes.json(),
    ]);

    setStats(statsData);
    setFeedbackSummary(feedbackData);
    },
    [user?.idToken, selectedPeriod]
  );

  // Fetch conversations with optional date filter
  const fetchConversations = useCallback(
    async (page: number = 1, append: boolean = false, filterDate?: string | null) => {
    if (!user?.idToken) return;
    
    const headers = {
        Authorization: user.idToken,
      'Content-Type': 'application/json',
    };

    const limit = dashboardConfig.pagination.pageSize;
    const offset = (page - 1) * limit;

      // Build query params
      let queryParams = `limit=${limit}&offset=${offset}`;
      if (feedbackFilter) {
        queryParams += `&feedback=${feedbackFilter}`;
      }
      // Use filterDate param if provided, otherwise use state
      const effectiveDateFilter = filterDate !== undefined ? filterDate : dateFilter;
      if (effectiveDateFilter) {
        queryParams += `&startDate=${effectiveDateFilter}&endDate=${effectiveDateFilter}`;
      }
    
    const conversationsRes = await fetch(
        `${ADMIN_API_URL}/conversations?${queryParams}`,
      { headers }
    );

    // Check for authentication errors (401/403)
    if (conversationsRes.status === 401 || conversationsRes.status === 403) {
      throw new Error(SESSION_EXPIRED_ERROR);
    }

    if (!conversationsRes.ok) {
      throw new Error('Failed to fetch conversations');
    }

    const conversationsData = await conversationsRes.json();
    
    if (append) {
        setConversations((prev) => [...prev, ...(conversationsData.conversations || [])]);
        // Use functional update to avoid stale closure
        setTotalLoaded((prev) => prev + (conversationsData.conversations?.length || 0));
    } else {
      setConversations(conversationsData.conversations || []);
      setTotalLoaded(conversationsData.conversations?.length || 0);
    }
    
    setHasMore(conversationsData.hasMore || false);
    },
    [user?.idToken, feedbackFilter, dateFilter, selectedPeriod]
  );

  // Fetch users with pagination
  const fetchUsers = useCallback(
    async (page: number = 1) => {
      if (!user?.idToken) return;

      const headers = {
        Authorization: user.idToken,
        'Content-Type': 'application/json',
      };

      const offset = (page - 1) * USERS_PAGE_SIZE;
      const queryParams = `limit=${USERS_PAGE_SIZE}&offset=${offset}`;

      const usersRes = await fetch(
        `${ADMIN_API_URL}/users?${queryParams}`,
        { headers }
      );

      // Check for authentication errors (401/403)
      if (usersRes.status === 401 || usersRes.status === 403) {
        throw new Error(SESSION_EXPIRED_ERROR);
      }

      if (!usersRes.ok) {
        throw new Error('Failed to fetch users');
      }

      const usersData = await usersRes.json();
      setUsers(usersData.users || []);
      setTotalUsers(usersData.total || 0);
    },
    [user?.idToken]
  );

  // Delete user
  const deleteUser = useCallback(
    async (userId: string, createdAt: string) => {
      if (!user?.idToken) {
        throw new Error('Not authenticated');
      }

      if (!createdAt) {
        throw new Error('Missing createdAt timestamp');
      }

      const headers = {
        Authorization: user.idToken,
        'Content-Type': 'application/json',
      };

      const res = await fetch(`${ADMIN_API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ createdAt }),
      });

      if (res.status === 401 || res.status === 403) {
        throw new Error(SESSION_EXPIRED_ERROR);
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete user');
      }

      // Remove user from local state immediately
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotalUsers(prev => prev - 1);
    },
    [user?.idToken]
  );

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      await Promise.all([
        fetchStats(selectedPeriod), 
        fetchConversations(1, false),
        fetchUsers(1),
      ]);
      setCurrentPage(1);
      setUsersPage(1);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      if (!handleSessionExpiry(err)) {
        setError('Failed to load dashboard data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchStats, fetchConversations, fetchUsers, selectedPeriod, handleSessionExpiry]);

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated && user?.idToken) {
      fetchData();
    }
  }, [isAuthenticated, user?.idToken, fetchData]);

  // Period change handler
  const handlePeriodChange = async (periodId: string) => {
    const period = TIME_PERIODS.find((p) => p.id === periodId);
    if (!period) return;

    setSelectedPeriodId(periodId);
    
    if (periodId === 'custom') {
      setShowCustomDatePicker(true);
      return;
    }

    setShowCustomDatePicker(false);
    setDateRange(undefined);
    setSelectedPeriod(period.days);
    setIsLoading(true);
    try {
      await fetchStats(period.days);
    } catch (err) {
      console.error('Error changing period:', err);
      handleSessionExpiry(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply custom date range
  const handleApplyCustomRange = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    
    if (days <= 0) {
      setError('End date must be after start date');
      return;
    }

    // Format dates for API
    const startDate = format(dateRange.from, 'yyyy-MM-dd');
    const endDate = format(dateRange.to, 'yyyy-MM-dd');

    setSelectedPeriod(days);
    setShowCustomDatePicker(false);
    setIsLoading(true);
    try {
      await fetchStats(days, startDate, endDate);
    } catch (err) {
      console.error('Error applying custom date range:', err);
      handleSessionExpiry(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel custom date range
  const handleCancelCustomRange = () => {
    setShowCustomDatePicker(false);
    setDateRange(undefined);
    if (!dateRange?.from || !dateRange?.to) {
      setSelectedPeriodId('week');
    }
  };

  // Get display label for current period - use API response data when available
  const getPeriodLabel = () => {
    // If we have stats with period info from API, use that (most accurate)
    if (stats?.period?.startDate && stats?.period?.endDate) {
      const start = new Date(stats.period.startDate + 'T00:00:00');
      const end = new Date(stats.period.endDate + 'T00:00:00');
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    // Fallback to frontend state for custom ranges
    if (selectedPeriodId === 'custom' && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`;
    }
    return TIME_PERIODS.find((p) => p.id === selectedPeriodId)?.label || 'Last Week';
  };

  // Load more conversations
  const handleLoadMore = async () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    try {
      await fetchConversations(nextPage, true);
    } catch (err) {
      console.error('Error loading more conversations:', err);
      handleSessionExpiry(err);
    }
  };

  // Handle users page change
  const handleUsersPageChange = async (page: number) => {
    setUsersPage(page);
    setIsLoading(true);
    try {
      await fetchUsers(page);
    } catch (err) {
      console.error('Error changing users page:', err);
      handleSessionExpiry(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filter
  const handleFilterChange = async () => {
    setCurrentPage(1);
    setIsLoading(true);
    try {
      await fetchConversations(1, false);
    } catch (err) {
      console.error('Error filtering conversations:', err);
      handleSessionExpiry(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle chart date click - navigate to conversations tab with date filter
  const handleChartDateClick = async (date: string, count: number) => {
    if (count === 0) return;
    
    setDateFilter(date);
    setFeedbackFilter(''); // Clear feedback filter when clicking chart
    setActiveTab('conversations');
    setCurrentPage(1);
    setIsLoading(true);
    
    try {
      await fetchConversations(1, false, date);
    } catch (err) {
      console.error('Error fetching conversations for date:', err);
      handleSessionExpiry(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear date filter
  const handleDateFilterClear = async () => {
    setDateFilter(null);
    setCurrentPage(1);
    setIsLoading(true);
    
    try {
      await fetchConversations(1, false, null);
    } catch (err) {
      console.error('Error clearing date filter:', err);
      handleSessionExpiry(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const handleSignOut = () => {
    signOut();
    router.push('/admin');
  };

  // Quick filter to show negative feedback
  const showNegativeFeedback = () => {
    setFeedbackFilter('neg');
    setDateFilter(null); // Clear date filter
    setActiveTab('conversations');
    setTimeout(() => handleFilterChange(), 100);
  };

  // Loading state
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
      <DashboardHeader
        username={user?.username}
        isLoading={isLoading}
        onRefresh={fetchData}
        onSignOut={handleSignOut}
      />

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {(['overview', 'conversations', 'users'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-[#4B7BF5] text-[#4B7BF5]'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'users' ? 'Support' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
                trend={
                  stats?.conversationsToday ? `+${stats.conversationsToday} today` : undefined
                }
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
                subtitle={getPeriodLabel()}
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

            {/* Date Range Selector */}
            <DateRangeSelector
              selectedPeriodId={selectedPeriodId}
              timezone={timezone}
              dateRange={dateRange}
              showCustomDatePicker={showCustomDatePicker}
              onPeriodChange={handlePeriodChange}
              onTimezoneChange={setTimezone}
              onDateRangeSelect={setDateRange}
              onApplyCustomRange={handleApplyCustomRange}
              onCancelCustomRange={handleCancelCustomRange}
              onShowCustomDatePicker={setShowCustomDatePicker}
            />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConversationsChart
                data={stats?.conversationsByDay || []}
                periodLabel={getPeriodLabel()}
                onDateClick={handleChartDateClick}
              />
              <SatisfactionPieChart
                feedbackSummary={feedbackSummary}
                periodLabel={getPeriodLabel()}
              />
            </div>
          </div>
        )}

        {activeTab === 'conversations' && (
          <ConversationsTab
            conversations={conversations}
            feedbackSummary={feedbackSummary}
            feedbackFilter={feedbackFilter}
            dateFilter={dateFilter}
            timezone={timezone}
            isLoading={isLoading}
            hasMore={hasMore}
            onFilterChange={setFeedbackFilter}
            onDateFilterClear={handleDateFilterClear}
            onApplyFilter={handleFilterChange}
            onLoadMore={handleLoadMore}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab
            users={users}
            isLoading={isLoading}
            currentPage={usersPage}
            totalUsers={totalUsers}
            pageSize={USERS_PAGE_SIZE}
            timezone={timezone}
            onPageChange={handleUsersPageChange}
            onDeleteUser={deleteUser}
          />
        )}
      </main>
    </div>
  );
}
