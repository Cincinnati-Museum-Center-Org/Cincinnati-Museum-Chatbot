'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { getApiConfig } from '../../config/i18n';
import type { FeedbackType } from './types';

interface FeedbackButtonsProps {
  conversationId?: string;
}

export function FeedbackButtons({ conversationId }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [showCheck, setShowCheck] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const handleFeedback = async (type: 'up' | 'down') => {
    if (feedback) return;

    setFeedback(type);

    // Show checkmark after brief delay
    setTimeout(() => {
      setShowCheck(true);
    }, 200);

    // Start fading after 2 seconds
    setTimeout(() => {
      setIsFading(true);
    }, 2000);

    // Fully hide after fade completes (2s + 1s fade)
    setTimeout(() => {
      setIsHidden(true);
    }, 3000);

    // Send feedback to API if conversationId is available
    if (conversationId) {
      try {
        const apiConfig = getApiConfig();
        if (apiConfig.feedbackEndpoint) {
          await fetch(apiConfig.feedbackEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              conversationId: conversationId,
              feedback: type === 'up' ? 'pos' : 'neg',
            }),
          });
          console.log(`Feedback submitted: ${type} for conversation ${conversationId}`);
        }
      } catch (error) {
        console.error('Error submitting feedback:', error);
        // Don't show error to user - feedback is non-critical
      }
    }
  };

  if (isHidden) return null;

  return (
    <div
      className={`flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 transition-opacity duration-1000 ease-out ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <span className="text-sm text-slate-500">Was this helpful?</span>

      {/* Thumbs Up */}
      <button
        onClick={() => handleFeedback('up')}
        disabled={!!feedback}
        className={`relative p-2 rounded-full transition-all duration-500 ease-out ${
          feedback === 'up'
            ? 'bg-emerald-100'
            : feedback === 'down'
              ? 'opacity-0 scale-75'
              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
        }`}
        aria-label="Yes, helpful"
      >
        <ThumbsUp
          size={18}
          strokeWidth={2}
          className={`transition-all duration-500 ease-out ${
            feedback === 'up' && showCheck
              ? 'opacity-0 scale-0'
              : feedback === 'up'
                ? 'text-emerald-600'
                : ''
          }`}
        />
        {feedback === 'up' && (
          <Check
            size={18}
            strokeWidth={2.5}
            className={`absolute inset-0 m-auto text-emerald-600 transition-all duration-500 ease-out ${
              showCheck ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
            }`}
          />
        )}
      </button>

      {/* Thumbs Down */}
      <button
        onClick={() => handleFeedback('down')}
        disabled={!!feedback}
        className={`relative p-2 rounded-full transition-all duration-500 ease-out ${
          feedback === 'down'
            ? 'bg-red-100'
            : feedback === 'up'
              ? 'opacity-0 scale-75'
              : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
        }`}
        aria-label="No, not helpful"
      >
        <ThumbsDown
          size={18}
          strokeWidth={2}
          className={`transition-all duration-500 ease-out ${
            feedback === 'down' && showCheck
              ? 'opacity-0 scale-0'
              : feedback === 'down'
                ? 'text-red-500'
                : ''
          }`}
        />
        {feedback === 'down' && (
          <Check
            size={18}
            strokeWidth={2.5}
            className={`absolute inset-0 m-auto text-red-500 transition-all duration-500 ease-out ${
              showCheck ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
            }`}
          />
        )}
      </button>
    </div>
  );
}
