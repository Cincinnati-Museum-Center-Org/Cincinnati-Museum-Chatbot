'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { WebSource } from './types';

interface PdfPreviewCardProps {
  pdf: WebSource;
  onClick: () => void;
}

/**
 * Compact PDF preview card with thumbnail preview using iframe.
 * Designed to align with web link badges in a flex layout.
 */
export function PdfPreviewCard({ pdf, onClick }: PdfPreviewCardProps) {
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  return (
    <div
      className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group border border-slate-200 w-48 flex-shrink-0"
      onClick={onClick}
    >
      {/* PDF Preview thumbnail - compact */}
      <div className="relative h-28 bg-gradient-to-br from-red-50 to-orange-50 overflow-hidden">
        {!previewError ? (
          <>
            {/* Loading state */}
            {!previewLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
                <div className="text-center">
                  <FileText size={24} className="mx-auto text-red-400 mb-1" />
                  <div className="w-4 h-4 border-2 border-red-300 border-t-red-500 rounded-full animate-spin mx-auto" />
                </div>
              </div>
            )}
            {/* PDF iframe preview - first page only */}
            <iframe
              src={`${pdf.url}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
              className={`w-full h-full pointer-events-none transition-opacity duration-300 scale-100 ${previewLoaded ? 'opacity-100' : 'opacity-0'}`}
              title={pdf.title}
              onLoad={() => setPreviewLoaded(true)}
              onError={() => setPreviewError(true)}
              loading="lazy"
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
          </>
        ) : (
          /* Fallback when preview fails */
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText size={32} className="text-red-400" />
          </div>
        )}
      </div>

      {/* Card content - compact */}
      <div className="p-2.5">
        <div className="flex items-start gap-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600 rounded shrink-0">
            <FileText size={10} />
            PDF
          </span>
          <h3 className="text-xs font-medium text-slate-700 line-clamp-2 leading-tight group-hover:text-red-600 transition-colors">
            {pdf.title}
          </h3>
        </div>
      </div>
    </div>
  );
}
