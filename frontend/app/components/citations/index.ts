// Citations module - modular components for displaying citations
// Main entry point for the citations display system

export { CitationsDisplay } from './CitationsDisplay';

// Individual components (for custom layouts)
export { MediaCard } from './MediaCard';
export { PdfPreviewCard } from './PdfPreviewCard';
export { WebLinkBadge } from './WebLinkBadge';
export { MediaModal } from './MediaModal';
export { PdfModal } from './PdfModal';
export { FeedbackButtons } from './FeedbackButtons';

// Utilities
export { parseCitations } from './utils';

// Types
export type { Citation, MediaSource, WebSource, FeedbackType, ParsedCitations } from './types';
