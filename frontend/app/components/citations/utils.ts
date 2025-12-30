import type { Citation, MediaSource, WebSource, ParsedCitations } from './types';

/**
 * Parse citations and extract media sources, web links, and PDF sources.
 * Handles deduplication and title extraction.
 */
export function parseCitations(citations: Citation[]): ParsedCitations {
  const mediaSources: MediaSource[] = [];
  const webLinks: WebSource[] = [];
  const pdfSources: WebSource[] = [];

  citations.forEach(citation => {
    citation.retrievedReferences.forEach(ref => {
      const location = ref.location;
      const metadata = ref.metadata || {};

      // S3 sources - backend already filtered to public/ and converted to HTTPS URLs
      if (location.type === 'S3' && location.url) {
        const url = location.url.toLowerCase();
        let mediaType: 'image' | 'video' | 'document' = 'document';

        if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          mediaType = 'image';
        } else if (url.match(/\.(mp4|webm|mov|avi)$/i)) {
          mediaType = 'video';
        } else if (url.match(/\.pdf$/i)) {
          // Handle PDF files
          const title = metadata['title'] || metadata['name'] || 'PDF Document';
          pdfSources.push({
            url: location.url,
            title
          });
          return; // Don't add to mediaSources
        }

        if (mediaType === 'image' || mediaType === 'video') {
          const title = metadata['title'] || metadata['name'] || 'Media';
          const collection = metadata['collection'];
          const dates = metadata['dates'];
          const subjects = metadata['subjects'];
          const description = metadata['x-amz-bedrock-kb-description'];
          const source = metadata['source'];
          const contentType = metadata['content_type'] || metadata['media_type'] || 'Collection Item';
          mediaSources.push({
            title,
            collection,
            dates,
            subjects,
            description,
            source,
            contentType,
            mediaUrl: location.url,
            mediaType
          });
        }
      }

      // Web sources (from web crawler) - separate PDFs from regular web links
      if (location.type === 'WEB' && location.url) {
        const url = location.url.toLowerCase();
        const metadataTitle = metadata['title'];
        const description = metadata['x-amz-bedrock-kb-description'] || '';

        if (url.endsWith('.pdf')) {
          // Try to extract a meaningful title from:
          // 1. metadata title
          // 2. First heading in description (# Title)
          // 3. URL filename
          let pdfTitle = metadataTitle;

          if (!pdfTitle && description) {
            // Try to extract title from markdown heading in description
            const headingMatch = description.match(/^#\s*(.+?)(?:\n|$)/m) ||
              description.match(/Title:\s*(.+?)(?:\n|$)/i);
            if (headingMatch) {
              pdfTitle = headingMatch[1].trim();
            }
          }

          if (!pdfTitle) {
            // Fall back to filename from URL
            const filename = location.url.split('/').pop() || 'PDF Document';
            pdfTitle = filename.replace('.pdf', '').replace(/[_-]/g, ' ');
          }

          pdfSources.push({ url: location.url, title: pdfTitle });
        } else {
          const title = metadataTitle || ref.content.text?.substring(0, 50) || 'Source';
          webLinks.push({ url: location.url, title });
        }
      }
    });
  });

  // Remove duplicates based on URL
  const uniqueMedia = mediaSources.filter((source, index, self) =>
    index === self.findIndex(s => s.mediaUrl === source.mediaUrl)
  );
  const uniqueWebLinks = webLinks.filter((link, index, self) =>
    index === self.findIndex(l => l.url === link.url)
  );
  const uniquePdfSources = pdfSources.filter((pdf, index, self) =>
    index === self.findIndex(p => p.url === pdf.url)
  );

  return {
    mediaSources: uniqueMedia,
    webLinks: uniqueWebLinks,
    pdfSources: uniquePdfSources
  };
}
