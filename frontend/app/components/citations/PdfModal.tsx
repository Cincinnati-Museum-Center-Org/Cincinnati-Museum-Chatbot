'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X, FileText } from 'lucide-react';
import type { WebSource } from './types';

interface PdfModalProps {
  pdf: WebSource;
  onClose: () => void;
}

/**
 * Full-screen modal for viewing PDF documents.
 * Includes header with title and "Open in new tab" button.
 */
export function PdfModal({ pdf, onClose }: PdfModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent scroll when modal is open
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  // Don't render on server
  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <FileText size={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 line-clamp-1">
                {pdf.title}
              </h2>
              <p className="text-xs text-slate-500">PDF Document</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={pdf.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <ExternalLink size={16} />
              Open in new tab
            </a>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 relative bg-slate-100">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-slate-300 border-t-red-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Loading PDF...</p>
              </div>
            </div>
          )}
          <iframe
            src={`${pdf.url}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-full"
            title={pdf.title}
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
