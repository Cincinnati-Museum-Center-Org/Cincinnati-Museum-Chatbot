'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  X,
  Calendar,
  Building2,
  MapPin,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { MediaSource } from './types';

interface MediaModalProps {
  media: MediaSource;
  onClose: () => void;
}

/**
 * Full-screen modal for viewing media (images/videos) with metadata.
 * Side-by-side layout on larger screens.
 */
export function MediaModal({ media, onClose }: MediaModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent ALL scroll when modal is open - including inner scrollable elements
  useEffect(() => {
    // Store original styles
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    // Lock scroll on body and html
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Prevent scroll events from propagating to background elements
    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      // Allow scroll inside the modal content
      const modalContent = document.querySelector('[data-modal-content]');
      if (modalContent && modalContent.contains(target)) {
        return;
      }
      e.preventDefault();
    };

    // Prevent wheel and touch scroll on the backdrop
    document.addEventListener('wheel', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  // Don't render on server
  if (typeof window === 'undefined') return null;

  // Use portal to render modal at document body level
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      {/* Modal container - larger with side-by-side layout */}
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - floating in top right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 hover:bg-white text-slate-500 hover:text-slate-700 rounded-full flex items-center justify-center transition-all shadow-lg backdrop-blur-sm"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Main content - side by side on larger screens */}
        <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
          {/* Left side - Image */}
          <div className="lg:w-1/2 bg-black flex items-center justify-center p-4 lg:p-6 min-h-[250px] lg:min-h-0">
            {!imageLoaded && media.mediaType === 'image' && (
              <div className="flex items-center justify-center">
                <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}

            {media.mediaType === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.mediaUrl}
                alt={media.title}
                className={`max-w-full max-h-[40vh] lg:max-h-[80vh] object-contain rounded-lg transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImageLoaded(true)}
              />
            ) : media.mediaType === 'video' ? (
              <video
                src={media.mediaUrl}
                className="max-w-full max-h-[40vh] lg:max-h-[80vh] rounded-lg"
                controls
                autoPlay
              />
            ) : null}
          </div>

          {/* Right side - Info */}
          <div className="lg:w-1/2 flex flex-col overflow-hidden" data-modal-content>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 className="text-xl lg:text-2xl font-bold text-slate-900 pr-10">
                {media.title}
              </h2>

              {/* Metadata badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {media.dates && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-full">
                    <Calendar size={14} />
                    {media.dates}
                  </span>
                )}
                {media.collection && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-blue-light)] text-[var(--primary-blue)] text-sm font-medium rounded-full">
                    <Building2 size={14} />
                    {media.collection}
                  </span>
                )}
                {media.source && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full">
                    <MapPin size={14} />
                    {media.source}
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Subject */}
              {media.subjects && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    <Tag size={14} />
                    Subject
                  </div>
                  <p className="text-base text-slate-700">{media.subjects}</p>
                </div>
              )}

              {/* AI Description */}
              {media.description && (
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-5 border border-purple-100/50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    <span className="text-sm font-semibold text-purple-700">
                      AI Description
                    </span>
                  </div>
                  <p className="text-base text-slate-700 leading-relaxed">
                    {media.description}
                  </p>
                  <p className="text-xs text-purple-400 mt-4">
                    Auto-generated · May contain inaccuracies
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
              <p className="text-sm text-slate-500 text-center">
                Cincinnati Museum Center Collection
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
