'use client';

import type { MediaSource } from './types';

interface MediaCardProps {
  source: MediaSource;
  onClick: () => void;
}

/**
 * Large media card for displaying images and videos in a grid.
 * Shows thumbnail, category badge, title, and description preview.
 */
export function MediaCard({ source, onClick }: MediaCardProps) {
  // Get a category label from content type or collection
  const categoryLabel = source.contentType || source.collection || 'Collection';

  // Truncate description for card preview
  const shortDescription = source.description
    ? source.description.length > 100
      ? source.description.substring(0, 100) + '...'
      : source.description
    : '';

  return (
    <div
      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group border border-slate-200"
      onClick={onClick}
    >
      {/* Large image */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {source.mediaType === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source.mediaUrl}
            alt={source.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : source.mediaType === 'video' ? (
          <video
            src={source.mediaUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        ) : null}
      </div>

      {/* Card content */}
      <div className="p-4">
        {/* Category badge */}
        <span className="inline-block px-3 py-1 text-xs font-medium bg-[var(--primary-blue)] text-white rounded-full mb-2">
          {categoryLabel}
        </span>

        {/* Title */}
        <h3 className="text-base font-semibold text-slate-900 mb-1 line-clamp-2 group-hover:text-[var(--primary-blue)] transition-colors">
          {source.title}
        </h3>

        {/* Short description */}
        {shortDescription && (
          <p className="text-sm text-slate-600 line-clamp-2">
            {shortDescription}
          </p>
        )}
      </div>
    </div>
  );
}
