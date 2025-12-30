/**
 * CitationsDisplay - Modular component for displaying citations
 * 
 * This file re-exports from the modular citations directory.
 * For custom layouts, import individual components from './citations'.
 * 
 * @example
 * // Default usage
 * import { CitationsDisplay } from './components/CitationsDisplay';
 * 
 * // Custom layout with individual components
 * import { MediaCard, PdfPreviewCard, WebLinkBadge, parseCitations } from './components/citations';
 */

// Re-export everything from the modular citations directory
export * from './citations';

// Default export for backward compatibility
export { CitationsDisplay as default } from './citations';
