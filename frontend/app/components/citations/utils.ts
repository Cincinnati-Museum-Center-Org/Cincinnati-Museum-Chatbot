import type { Citation, MediaSource, WebSource, ParsedCitations } from './types';

/**
 * Parse citations and extract media sources, web links, and PDF sources.
 * Handles deduplication and title extraction.
 */
export function parseCitations(citations: Citation[]): ParsedCitations {
  const mediaSources: MediaSource[] = [];
  const webLinks: WebSource[] = [];
  const pdfSources: WebSource[] = [];

  console.log('📊 parseCitations called with', citations.length, 'citation groups');

  citations.forEach((citation, citationIndex) => {
    const refCount = citation.retrievedReferences?.length || 0;
    console.log(`📊 Citation ${citationIndex}: ${refCount} references`);
    
    if (!citation.retrievedReferences) {
      console.log(`  ⚠️ No retrievedReferences array!`);
      return;
    }
    
    citation.retrievedReferences.forEach((ref, refIndex) => {
      const location = ref.location;
      const metadata = ref.metadata || {};

      // Log full URL for debugging
      console.log(`  📍 Ref ${refIndex}:`);
      console.log(`     Type: ${location?.type || 'NO TYPE'}`);
      console.log(`     URL: ${location?.url || 'NO URL'}`);
      console.log(`     URI: ${location?.uri || 'none'}`);

      if (!location) {
        console.log(`     ❌ No location object!`);
        return;
      }

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
          console.log(`     ✅ S3 PDF: ${title}`);
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
          console.log(`     ✅ S3 ${mediaType}: ${title}`);
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
        } else {
          console.log(`     ⏭️ S3 document (extension not image/video/pdf), skipping`);
        }
      } else if (location.type === 'S3' && !location.url) {
        console.log(`     ❌ S3 type but NO URL! URI:`, location.uri);
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

          console.log(`     ✅ WEB PDF: ${pdfTitle}`);
          pdfSources.push({ url: location.url, title: pdfTitle });
        } else {
          const title = metadataTitle || ref.content?.text?.substring(0, 50) || 'Source';
          console.log(`     ✅ WEB link: ${title.substring(0, 40)}...`);
          webLinks.push({ url: location.url, title });
        }
      } else if (location.type === 'WEB' && !location.url) {
        console.log(`     ❌ WEB type but NO URL!`);
      }

      // Log if neither S3 nor WEB
      if (location.type !== 'S3' && location.type !== 'WEB') {
        console.log(`     ❓ Unknown location type: ${location.type}`);
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

  const dupeMedia = mediaSources.length - uniqueMedia.length;
  const dupeWeb = webLinks.length - uniqueWebLinks.length;
  const dupePdf = pdfSources.length - uniquePdfSources.length;
  
  console.log(`📊 Before dedup - Media: ${mediaSources.length}, PDFs: ${pdfSources.length}, WebLinks: ${webLinks.length}`);
  console.log(`📊 Duplicates removed - Media: ${dupeMedia}, PDFs: ${dupePdf}, WebLinks: ${dupeWeb}`);
  console.log(`📊 Final counts - Media: ${uniqueMedia.length}, PDFs: ${uniquePdfSources.length}, WebLinks: ${uniqueWebLinks.length}`);

  return {
    mediaSources: uniqueMedia,
    webLinks: uniqueWebLinks,
    pdfSources: uniquePdfSources
  };
}
