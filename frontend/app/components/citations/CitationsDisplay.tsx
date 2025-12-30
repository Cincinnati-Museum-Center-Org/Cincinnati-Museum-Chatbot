'use client';

import { useState } from 'react';
import type { Citation, MediaSource, WebSource } from './types';
import { parseCitations } from './utils';
import { MediaCard } from './MediaCard';
import { PdfPreviewCard } from './PdfPreviewCard';
import { WebLinkBadge } from './WebLinkBadge';
import { MediaModal } from './MediaModal';
import { PdfModal } from './PdfModal';
import { FeedbackButtons } from './FeedbackButtons';

interface CitationsDisplayProps {
  citations: Citation[];
  conversationId?: string; // For feedback tracking
}

/**
 * Main component to display citations with media (images, videos), PDFs, and web links.
 * Composes modular sub-components for each citation type.
 * 
 * Note: Backend filters citations to only include public S3 content and converts URIs to HTTPS URLs
 */
export function CitationsDisplay({ citations, conversationId }: CitationsDisplayProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaSource | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<WebSource | null>(null);

  // Parse and deduplicate citations
  const { mediaSources, webLinks, pdfSources } = parseCitations(citations);

  // Don't render if no sources
  if (webLinks.length === 0 && mediaSources.length === 0 && pdfSources.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      {/* Large card grid for media sources */}
      {mediaSources.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mediaSources.slice(0, 6).map((source, index) => (
            <MediaCard
              key={`media-${index}`}
              source={source}
              onClick={() => setSelectedMedia(source)}
            />
          ))}
        </div>
      )}

      {/* Sources section - PDFs and Web links */}
      {(webLinks.length > 0 || pdfSources.length > 0) && (
        <div className={`${mediaSources.length > 0 ? 'mt-4' : ''}`}>
          <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wide">Sources</p>

          {/* PDF preview cards */}
          {pdfSources.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {pdfSources.slice(0, 3).map((pdf, index) => (
                <PdfPreviewCard
                  key={`pdf-${index}`}
                  pdf={pdf}
                  onClick={() => setSelectedPdf(pdf)}
                />
              ))}
            </div>
          )}

          {/* Web links - separate row */}
          {webLinks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {webLinks.slice(0, 4).map((link, index) => (
                <WebLinkBadge key={`web-${index}`} link={link} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback buttons */}
      <FeedbackButtons conversationId={conversationId} />

      {/* Full-screen media modal */}
      {selectedMedia && (
        <MediaModal
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
        />
      )}

      {/* PDF viewer modal */}
      {selectedPdf && (
        <PdfModal
          pdf={selectedPdf}
          onClose={() => setSelectedPdf(null)}
        />
      )}
    </div>
  );
}
