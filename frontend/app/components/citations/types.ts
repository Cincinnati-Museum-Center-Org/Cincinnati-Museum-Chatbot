// Re-export types from parent types file
export type { Citation, MediaSource, WebSource, RetrievedReference } from '../types';

// Feedback types
export type FeedbackType = 'up' | 'down' | null;

// Parsed citations result
export interface ParsedCitations {
  mediaSources: MediaSource[];
  webLinks: WebSource[];
  pdfSources: WebSource[];
}

// Import for use in this file
import type { MediaSource, WebSource } from '../types';
