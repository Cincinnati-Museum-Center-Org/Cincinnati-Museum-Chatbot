'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ExternalLink, 
  X, 
  Calendar,
  Building2,
  MapPin,
  Sparkles,
  Tag,
  ThumbsUp,
  ThumbsDown,
  Check,
} from 'lucide-react';
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
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [showCheck, setShowCheck] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const handleFeedback = (type: 'up' | 'down') => {
    if (feedback) return;
    
    setFeedback(type);
    
    // Show checkmark after brief delay
    setTimeout(() => {
      setShowCheck(true);
    }, 200);
    
    // Start fading after 2 seconds
    setTimeout(() => {
      setIsFading(true);
    }, 2000);
    
    // Fully hide after fade completes (2s + 1s fade)
    setTimeout(() => {
      setIsHidden(true);
    }, 3000);
  };
  
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
    <div className="mt-6">
      {/* Large card grid for media sources */}
      {uniqueMedia.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {uniqueMedia.slice(0, 6).map((source, index) => (
            <LargeMediaCard 
              key={`media-${index}`}
              source={source}
              onClick={() => setSelectedMedia(source)}
            />
          ))}
        </div>
      )}
      
      {/* Web links section - if any */}
      {uniqueWebLinks.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${uniqueMedia.length > 0 ? 'mt-4' : ''}`}>
          {uniqueWebLinks.slice(0, 4).map((link, index) => (
            <WebLinkBadge key={`web-${index}`} link={link} />
          ))}
        </div>
      )}
      
      {/* Was this helpful? feedback */}
      {!isHidden && (
        <div 
          className={`flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 transition-opacity duration-1000 ease-out ${
            isFading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span className="text-sm text-slate-500">Was this helpful?</span>
          
          {/* Thumbs Up */}
          <button
            onClick={() => handleFeedback('up')}
            disabled={!!feedback}
            className={`relative p-2 rounded-full transition-all duration-500 ease-out ${
              feedback === 'up' 
                ? 'bg-emerald-100' 
                : feedback === 'down'
                  ? 'opacity-0 scale-75'
                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            aria-label="Yes, helpful"
          >
            {/* Thumbs icon */}
            <ThumbsUp 
              size={18} 
              strokeWidth={2}
              className={`transition-all duration-500 ease-out ${
                feedback === 'up' && showCheck
                  ? 'opacity-0 scale-0' 
                  : feedback === 'up'
                    ? 'text-emerald-600'
                    : ''
              }`}
            />
            {/* Checkmark */}
            {feedback === 'up' && (
              <Check 
                size={18} 
                strokeWidth={2.5}
                className={`absolute inset-0 m-auto text-emerald-600 transition-all duration-500 ease-out ${
                  showCheck ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                }`}
              />
            )}
          </button>

          {/* Thumbs Down */}
          <button
            onClick={() => handleFeedback('down')}
            disabled={!!feedback}
            className={`relative p-2 rounded-full transition-all duration-500 ease-out ${
              feedback === 'down' 
                ? 'bg-red-100' 
                : feedback === 'up'
                  ? 'opacity-0 scale-75'
                  : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
            }`}
            aria-label="No, not helpful"
          >
            {/* Thumbs icon */}
            <ThumbsDown 
              size={18} 
              strokeWidth={2}
              className={`transition-all duration-500 ease-out ${
                feedback === 'down' && showCheck
                  ? 'opacity-0 scale-0' 
                  : feedback === 'down'
                    ? 'text-red-500'
                    : ''
              }`}
            />
            {/* Checkmark */}
            {feedback === 'down' && (
              <Check 
                size={18} 
                strokeWidth={2.5}
                className={`absolute inset-0 m-auto text-red-500 transition-all duration-500 ease-out ${
                  showCheck ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                }`}
              />
            )}
          </button>
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

// Sub-component: Large Media Card (like the screenshot design)
interface LargeMediaCardProps {
  source: MediaSource;
  onClick: () => void;
}

function LargeMediaCard({ source, onClick }: LargeMediaCardProps) {
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
      <ExternalLink size={12} />
      <span className="max-w-[120px] truncate">{link.title}</span>
    </a>
  );
}

// Sub-component: Media Modal - Centered on screen
interface MediaModalProps {
  media: MediaSource;
  onClose: () => void;
}

function MediaModal({ media, onClose }: MediaModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent ALL scroll when modal is open - including inner scrollable elements
  useEffect(() => {
    // Store original styles
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    
    // Lock scroll on body and html
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // Prevent scroll events from propagating to background elements
    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      // Allow scroll inside the modal content
      const modalContent = document.querySelector('[data-modal-content]');
      if (modalContent && modalContent.contains(target)) {
        return;
      }
      e.preventDefault();
    };
    
    // Prevent wheel and touch scroll on the backdrop
    document.addEventListener('wheel', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventScroll, { passive: false });
    
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  // Don't render on server
  if (typeof window === 'undefined') return null;

  // Use portal to render modal at document body level
  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      {/* Modal container - larger with side-by-side layout */}
      <div 
        className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button - floating in top right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 hover:bg-white text-slate-500 hover:text-slate-700 rounded-full flex items-center justify-center transition-all shadow-lg backdrop-blur-sm"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Main content - side by side on larger screens */}
        <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
          {/* Left side - Image */}
          <div className="lg:w-1/2 bg-black flex items-center justify-center p-4 lg:p-6 min-h-[250px] lg:min-h-0">
            {!imageLoaded && media.mediaType === 'image' && (
              <div className="flex items-center justify-center">
                <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            
            {media.mediaType === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.mediaUrl}
                alt={media.title}
                className={`max-w-full max-h-[40vh] lg:max-h-[80vh] object-contain rounded-lg transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImageLoaded(true)}
              />
            ) : media.mediaType === 'video' ? (
              <video
                src={media.mediaUrl}
                className="max-w-full max-h-[40vh] lg:max-h-[80vh] rounded-lg"
                controls
                autoPlay
              />
            ) : null}
          </div>
          
          {/* Right side - Info */}
          <div className="lg:w-1/2 flex flex-col overflow-hidden" data-modal-content>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100">
              <h2 className="text-xl lg:text-2xl font-bold text-slate-900 pr-10">
                {media.title}
              </h2>
              
              {/* Metadata badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {media.dates && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-full">
                    <Calendar size={14} />
                    {media.dates}
                  </span>
                )}
                {media.collection && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-blue-light)] text-[var(--primary-blue)] text-sm font-medium rounded-full">
                    <Building2 size={14} />
                    {media.collection}
                  </span>
                )}
                {media.source && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-full">
                    <MapPin size={14} />
                    {media.source}
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Subject */}
              {media.subjects && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    <Tag size={14} />
                    Subject
                  </div>
                  <p className="text-base text-slate-700">{media.subjects}</p>
                </div>
              )}
              
              {/* AI Description */}
              {media.description && (
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-5 border border-purple-100/50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    <span className="text-sm font-semibold text-purple-700">
                      AI Description
                    </span>
                  </div>
                  <p className="text-base text-slate-700 leading-relaxed">
                    {media.description}
                  </p>
                  <p className="text-xs text-purple-400 mt-4">
                    Auto-generated · May contain inaccuracies
                  </p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0">
              <p className="text-sm text-slate-500 text-center">
                Cincinnati Museum Center Collection
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
