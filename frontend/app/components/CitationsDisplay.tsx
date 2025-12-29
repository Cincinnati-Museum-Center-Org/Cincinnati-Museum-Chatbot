'use client';

import { useState } from 'react';
import { LinkIcon, CloseIcon, ExpandIcon } from './Icons';
import type { Citation, MediaSource, WebSource } from './types';

interface CitationsDisplayProps {
  citations: Citation[];
}

/**
 * Component to display citations with media (images, videos) and web links
 * Note: Backend filters citations to only include public S3 content and converts URIs to HTTPS URLs
 */
export function CitationsDisplay({ citations }: CitationsDisplayProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaSource | null>(null);
  
  // Extract all unique sources from citations
  const mediaSources: MediaSource[] = [];
  const webLinks: WebSource[] = [];
  
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
        }
        
        if (mediaType === 'image' || mediaType === 'video') {
          const title = metadata['title'] || metadata['name'] || 'Media';
          const collection = metadata['collection'];
          const dates = metadata['dates'];
          const subjects = metadata['subjects'];
          const description = metadata['x-amz-bedrock-kb-description'];
          const source = metadata['source'];
          mediaSources.push({ 
            title, 
            collection, 
            dates,
            subjects,
            description,
            source,
            mediaUrl: location.url,
            mediaType
          });
        }
      }
      
      // Web sources (from web crawler)
      if (location.type === 'WEB' && location.url) {
        const title = metadata['title'] || ref.content.text?.substring(0, 50) || 'Source';
        webLinks.push({ url: location.url, title });
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
  
  if (uniqueWebLinks.length === 0 && uniqueMedia.length === 0) {
    return null;
  }
  
  return (
    <div className="mt-4">
      {/* Media sources from museum collection */}
      {uniqueMedia.length > 0 && (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sources ({uniqueMedia.length})
            </span>
          </div>
          
          {/* Horizontal scrollable media container */}
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent -mx-1 px-1">
            <div className="flex gap-3 pb-1">
              {uniqueMedia.slice(0, 6).map((source, index) => (
                <MediaCard 
                  key={`media-${index}`}
                  source={source}
                  onClick={() => setSelectedMedia(source)}
                />
              ))}
            </div>
          </div>
          
          {/* Web links section - if any */}
          {uniqueWebLinks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <div className="flex flex-wrap gap-2">
                {uniqueWebLinks.slice(0, 3).map((link, index) => (
                  <WebLinkBadge key={`web-${index}`} link={link} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Only web links (no media) */}
      {uniqueMedia.length === 0 && uniqueWebLinks.length > 0 && (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            Sources
          </span>
          <div className="flex flex-wrap gap-2">
            {uniqueWebLinks.slice(0, 4).map((link, index) => (
              <WebLinkBadge key={`web-${index}`} link={link} />
            ))}
          </div>
        </div>
      )}
      
      {/* Full-screen media modal */}
      {selectedMedia && (
        <MediaModal 
          media={selectedMedia} 
          onClose={() => setSelectedMedia(null)} 
        />
      )}
    </div>
  );
}

// Sub-component: Media Card
interface MediaCardProps {
  source: MediaSource;
  onClick: () => void;
}

function MediaCard({ source, onClick }: MediaCardProps) {
  return (
    <div
      className="flex-shrink-0 w-44 bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group border border-slate-200 hover:border-slate-300"
      onClick={onClick}
    >
      {/* Image container with fixed aspect ratio */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        {source.mediaType === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={source.mediaUrl}
            alt={source.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-700 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
            <ExpandIcon /> View
          </span>
        </div>
      </div>
      
      {/* Card content */}
      <div className="p-2.5">
        <h4 className="text-sm font-medium text-slate-800 line-clamp-1 leading-tight">
          {source.title}
        </h4>
        <div className="flex items-center gap-1.5 mt-1">
          {source.dates && (
            <span className="text-xs text-slate-500">{source.dates}</span>
          )}
          {source.dates && source.collection && (
            <span className="text-slate-300">•</span>
          )}
          {source.collection && (
            <span className="text-xs text-slate-400 truncate">{source.collection}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-component: Web Link Badge
interface WebLinkBadgeProps {
  link: WebSource;
}

function WebLinkBadge({ link }: WebLinkBadgeProps) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-slate-600 rounded-full border border-slate-200 hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)] transition-colors"
    >
      <LinkIcon />
      <span className="max-w-[120px] truncate">{link.title}</span>
    </a>
  );
}

// Sub-component: Media Modal
interface MediaModalProps {
  media: MediaSource;
  onClose: () => void;
}

function MediaModal({ media, onClose }: MediaModalProps) {
  return (
    <div 
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-5xl mx-4 bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
        >
          <CloseIcon />
        </button>
        
        {/* Media display */}
        <div className="relative bg-slate-900 flex-shrink-0">
          {media.mediaType === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.mediaUrl}
              alt={media.title}
              className="w-full max-h-[55vh] object-contain"
            />
          ) : media.mediaType === 'video' ? (
            <video
              src={media.mediaUrl}
              className="w-full max-h-[55vh]"
              controls
              autoPlay
            />
          ) : null}
        </div>
        
        {/* Metadata panel */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          <h3 className="text-xl font-bold text-slate-900 mb-1">
            {media.title}
          </h3>
          
          {/* Quick info badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {media.dates && (
              <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                📅 {media.dates}
              </span>
            )}
            {media.collection && (
              <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                🏛️ {media.collection}
              </span>
            )}
            {media.source && (
              <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                📍 {media.source}
              </span>
            )}
          </div>
          
          {/* Subject */}
          {media.subjects && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Subject</h4>
              <p className="text-sm text-slate-600">{media.subjects}</p>
            </div>
          )}
          
          {/* Full description */}
          {media.description && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Description</h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                {media.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
