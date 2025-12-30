'use client';

import { Filter, ThumbsDown, ChevronRight, Loader2, X, Calendar } from 'lucide-react';
import { Conversation, FeedbackSummary, formatInTimezone } from '../types';

interface ConversationsTabProps {
  conversations: Conversation[];
  feedbackSummary: FeedbackSummary | null;
  feedbackFilter: string;
  dateFilter: string | null;
  timezone: string;
  isLoading: boolean;
  hasMore: boolean;
  onFilterChange: (filter: string) => void;
  onDateFilterClear: () => void;
  onApplyFilter: () => void;
  onLoadMore: () => void;
}

export function ConversationsTab({
  conversations,
  feedbackSummary,
  feedbackFilter,
  dateFilter,
  timezone,
  isLoading,
  hasMore,
  onFilterChange,
  onDateFilterClear,
  onApplyFilter,
  onLoadMore,
}: ConversationsTabProps) {
  // Format date for display
  const formatDateDisplay = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Date Filter Banner */}
      {dateFilter && (
        <div className="bg-[#4B7BF5]/10 border border-[#4B7BF5]/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#4B7BF5]" />
            <div>
              <p className="text-sm font-medium text-[#4B7BF5]">
                Showing conversations from {formatDateDisplay(dateFilter)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Click the X to clear the date filter and see all conversations
              </p>
            </div>
          </div>
          <button
            onClick={onDateFilterClear}
            className="p-2 hover:bg-[#4B7BF5]/10 rounded-lg transition-colors"
            title="Clear date filter"
          >
            <X className="w-5 h-5 text-[#4B7BF5]" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-wrap items-center gap-4">
        <Filter className="w-5 h-5 text-slate-400" />
        <select
          value={feedbackFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#4B7BF5] focus:border-transparent outline-none"
        >
          <option value="">All Feedback</option>
          <option value="pos">Positive Only</option>
          <option value="neg">Negative Only</option>
          <option value="none">No Feedback</option>
        </select>
        <button
          onClick={onApplyFilter}
          className="px-4 py-2 bg-[#4B7BF5] text-white rounded-lg text-sm hover:bg-[#3D6AE0] transition-colors"
        >
          Apply
        </button>
        <span className="text-sm text-slate-500 ml-auto">
          Showing {conversations.length} conversations
        </span>
      </div>

      {/* Negative Feedback Alert Banner */}
      {feedbackFilter === 'neg' &&
        feedbackSummary &&
        feedbackSummary.recentNegative.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsDown className="w-5 h-5 text-orange-500" />
              <h4 className="font-semibold text-orange-800">
                {feedbackSummary.recentNegative.length} Negative Feedback Items
              </h4>
            </div>
            <p className="text-sm text-orange-700">
              Review these conversations to identify areas for improvement in the chatbot
              responses.
            </p>
          </div>
        )}

      {/* Conversations List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Question
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Feedback
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Response Time
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">
                  Citations
                </th>
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
                    <p className="text-sm text-slate-800 line-clamp-2 max-w-md">
                      {conv.question}
                    </p>
                    {conv.feedback === 'neg' && conv.answerPreview && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        Answer: {conv.answerPreview}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {formatInTimezone(conv.timestamp, timezone)}
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
                  <td className="px-4 py-3 text-sm text-slate-600">{conv.citationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {conversations.length === 0 && !isLoading && (
          <div className="p-8 text-center text-slate-500">No conversations found</div>
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
            onClick={onLoadMore}
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
  );
}
