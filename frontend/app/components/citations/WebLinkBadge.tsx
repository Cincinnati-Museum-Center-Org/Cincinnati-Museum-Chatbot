'use client';

import { ExternalLink, Globe } from 'lucide-react';
import type { WebSource } from './types';

interface WebLinkBadgeProps {
  link: WebSource;
}

/**
 * Compact badge for displaying web links.
 * Opens in new tab when clicked.
 */
export function WebLinkBadge({ link }: WebLinkBadgeProps) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors border border-blue-100"
    >
      <Globe size={14} className="shrink-0" />
      <span className="max-w-[180px] truncate">{link.title}</span>
      <ExternalLink size={12} className="shrink-0 opacity-60" />
    </a>
  );
}
