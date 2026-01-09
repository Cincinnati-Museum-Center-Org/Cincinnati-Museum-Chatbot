'use client';

import { X, Clock, MessageSquare, FileText, Globe, Zap, Database, ThumbsUp, ThumbsDown, Calendar } from 'lucide-react';
import { formatInTimezone } from '../types';
import { MarkdownContent } from '../../components';

export interface ConversationDetail {
  conversationId: string;
  sessionId: string;
  timestamp: string;
  date: string;
  question: string;
  answer: string;
  citations: Array<{
    retrievedReferences?: Array<{
      content?: { text?: string };
      location?: { url?: string; type?: string };
      metadata?: Record<string, any>;
    }>;
  }>;
  citationCount: number;
  feedback: string | null;
  responseTimeMs: number;
  modelId: string;
  knowledgeBaseId?: string;
  language: string;
  questionLength?: number;
  answerLength?: number;
}

interface ConversationDetailModalProps {
  conversation: ConversationDetail | null;
  timezone: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ConversationDetailModal({
  conversation,
  timezone,
  isOpen,
  onClose,
}: ConversationDetailModalProps) {
  if (!isOpen || !conversation) return null;

  const formatFeedback = (feedback: string | null) => {
    if (feedback === 'pos') return { label: 'Positive', icon: ThumbsUp, color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (feedback === 'neg') return { label: 'Negative', icon: ThumbsDown, color: 'text-red-600', bg: 'bg-red-50' };
    return { label: 'No Feedback', icon: null, color: 'text-slate-500', bg: 'bg-slate-50' };
  };

  const feedbackInfo = formatFeedback(conversation.feedback);
  const FeedbackIcon = feedbackInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#4B7BF5]/10 rounded-lg">
              <MessageSquare className="w-6 h-6 text-[#4B7BF5]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Conversation Details</h2>
              <p className="text-sm text-slate-500">ID: {conversation.conversationId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Feedback Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm ${feedbackInfo.bg} border ${feedbackInfo.color === 'text-emerald-600' ? 'border-emerald-200' : feedbackInfo.color === 'text-red-600' ? 'border-red-200' : 'border-slate-200'}`}>
              {FeedbackIcon && <FeedbackIcon className={`w-4 h-4 ${feedbackInfo.color}`} />}
              <span className={feedbackInfo.color}>{feedbackInfo.label}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 uppercase">Timestamp</span>
              </div>
              <p className="text-sm text-slate-800">{formatInTimezone(conversation.timestamp, timezone)}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 uppercase">Session ID</span>
              </div>
              <p className="text-sm text-slate-800 font-mono break-all">{conversation.sessionId}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 uppercase">Response Time</span>
              </div>
              <p className="text-sm text-slate-800">{(conversation.responseTimeMs / 1000).toFixed(2)}s</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 uppercase">Language</span>
              </div>
              <p className="text-sm text-slate-800 uppercase">{conversation.language}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 uppercase">Model ID</span>
              </div>
              <p className="text-sm text-slate-800 font-mono break-all">{conversation.modelId}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-500 uppercase">Date</span>
              </div>
              <p className="text-sm text-slate-800">{conversation.date}</p>
            </div>
          </div>

          {/* Question */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-[#4B7BF5]" />
              <h3 className="text-lg font-semibold text-slate-800">Question</h3>
              {conversation.questionLength && (
                <span className="text-xs text-slate-500">({conversation.questionLength} characters)</span>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-slate-800 whitespace-pre-wrap">{conversation.question}</p>
            </div>
          </div>

          {/* Answer */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-slate-800">Answer</h3>
              {conversation.answerLength && (
                <span className="text-xs text-slate-500">({conversation.answerLength} characters)</span>
              )}
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
              <MarkdownContent content={conversation.answer} className="text-slate-800" />
            </div>
          </div>

          {/* Citations */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-slate-800">Citations</h3>
              <span className="text-xs text-slate-500">({conversation.citationCount} sources)</span>
            </div>
            {conversation.citations && conversation.citations.length > 0 ? (
              <div className="space-y-2">
                {conversation.citations.map((citation, index) => (
                  <div key={index} className="bg-purple-50 border border-purple-100 rounded-lg p-4">
                    {citation.retrievedReferences && citation.retrievedReferences.length > 0 ? (
                      citation.retrievedReferences.map((ref, refIndex) => (
                        <div key={refIndex} className="mb-3 last:mb-0 pb-3 last:pb-0 border-b border-purple-200 last:border-b-0">
                          {ref.content?.text && (
                            <div className="text-sm text-slate-700 mb-2">
                              <MarkdownContent content={ref.content.text} />
                            </div>
                          )}
                          {ref.location?.url && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-purple-600 uppercase">
                                {ref.location.type === 'S3' ? 'S3' : ref.location.type === 'WEB' ? 'Web' : 'Source'}:
                              </span>
                              <a
                                href={ref.location.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 font-mono break-all underline"
                              >
                                {ref.location.url}
                              </a>
                            </div>
                          )}
                          {ref.metadata && Object.keys(ref.metadata).length > 0 && (
                            <div className="mt-2 text-xs text-slate-500">
                              <details className="cursor-pointer">
                                <summary className="hover:text-slate-700">Metadata</summary>
                                <pre className="mt-1 p-2 bg-white rounded text-xs overflow-auto">
                                  {JSON.stringify(ref.metadata, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No references in this citation</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center text-slate-500 text-sm">
                No citations available
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#4B7BF5] text-white rounded-lg hover:bg-[#3D6AE0] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
