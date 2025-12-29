'use client';

import { useState, useRef, useEffect, FormEvent, useMemo } from 'react';
import { useLanguage } from './context/LanguageContext';
import { getApiConfig } from './config/i18n';

// Types for citations and references
interface RetrievedReference {
  content: {
    text?: string;
  };
  location: {
    type: string;
    uri?: string;
    url?: string;
  };
  metadata?: Record<string, string>;
}

interface Citation {
  retrievedReferences: RetrievedReference[];
}

// Types for chat messages
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  citations?: Citation[];
}

// Icons as components
const LocationIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="10" r="3" />
    <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z" />
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TicketIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" />
    <path d="M13 17v2" />
    <path d="M13 11v2" />
  </svg>
);

const BookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

const GroupIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const HeartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// Simple markdown parser for chat messages
function parseMarkdown(text: string): string {
  if (!text) return '';
  
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Code: `code`
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br />');
  
  // Handle numbered lists (1. item)
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
  const hasOrderedList = html.includes('<li>');
  if (hasOrderedList) {
    // Wrap consecutive <li> items in <ol>
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ol>$1</ol>');
  }
  
  // Handle bullet lists (- item or * item)
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  
  return html;
}

// Component to render markdown content
function MarkdownContent({ content, className = '' }: { content: string; className?: string }) {
  const html = useMemo(() => parseMarkdown(content), [content]);
  return (
    <div 
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Component to display citations with images
function CitationsDisplay({ citations }: { citations: Citation[] }) {
  // Extract all unique images from citations
  const images: { url: string; title?: string }[] = [];
  const webLinks: { url: string; title?: string }[] = [];
  
  citations.forEach(citation => {
    citation.retrievedReferences.forEach(ref => {
      const location = ref.location;
      const metadata = ref.metadata || {};
      
      // Check if it's an S3 image
      if (location.type === 'S3' && location.uri) {
        // Check if it's an image file
        const uri = location.uri.toLowerCase();
        if (uri.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          // For S3 images, we'd need a presigned URL - for now, show metadata
          const title = metadata['title'] || metadata['name'] || 'Image';
          images.push({ url: location.uri, title });
        }
      }
      
      // Check if it's a web link
      if (location.type === 'WEB' && location.url) {
        const title = metadata['title'] || ref.content.text?.substring(0, 50) || 'Source';
        webLinks.push({ url: location.url, title });
      }
    });
  });
  
  // Remove duplicates
  const uniqueWebLinks = webLinks.filter((link, index, self) => 
    index === self.findIndex(l => l.url === link.url)
  );
  
  if (uniqueWebLinks.length === 0 && images.length === 0) {
    return null;
  }
  
  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-light)]">
      {/* Web source links */}
      {uniqueWebLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {uniqueWebLinks.slice(0, 3).map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[var(--background)] text-[var(--text-secondary)] rounded-full hover:bg-[var(--primary-blue-light)] hover:text-[var(--primary-blue)] transition-colors"
            >
              <LinkIcon />
              <span className="max-w-[150px] truncate">{link.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { language, setLanguage, t, getQuickActionPrompt } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Get API config
  const apiConfig = useMemo(() => getApiConfig(), []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate unique ID for messages
  const generateId = () => Math.random().toString(36).substring(2, 15);

  // Handle sending a message
  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    
    if (!apiConfig.chatEndpoint) {
      console.error('Chat API endpoint not configured. Please set NEXT_PUBLIC_CHAT_API_URL in .env.local');
      return;
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: messageText.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Create assistant message placeholder
    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      citations: [],
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch(apiConfig.chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: messageText.trim(),
          sessionId: sessionId,
          numberOfResults: 5,
          language: language, // Send current language to backend
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Handle SSE streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let accumulatedCitations: Citation[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              // Event type line - we handle data in the next iteration
              continue;
            }
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.sessionId) {
                  setSessionId(parsed.sessionId);
                }
                
                if (parsed.text) {
                  accumulatedText += parsed.text;
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedText }
                        : msg
                    )
                  );
                }
                
                // Handle citations
                if (parsed.citations) {
                  accumulatedCitations = parsed.citations;
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, citations: accumulatedCitations }
                        : msg
                    )
                  );
                }
                
                if (parsed.status === 'complete') {
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, isStreaming: false }
                        : msg
                    )
                  );
                }
                
                if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: t.errorMessage, isStreaming: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Handle form submission
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // Handle quick action click
  const handleQuickAction = (actionKey: string) => {
    const prompt = getQuickActionPrompt(actionKey);
    if (prompt) {
      sendMessage(prompt);
    }
  };

  // Quick action buttons config
  const quickActions = [
    { key: 'planYourVisit', icon: <LocationIcon />, primary: true },
    { key: 'currentExhibits', icon: <ClockIcon />, primary: true },
    { key: 'ticketsMembership', icon: <TicketIcon />, primary: true },
    { key: 'collections', icon: <BookIcon />, primary: false },
    { key: 'groupVisits', icon: <GroupIcon />, primary: false },
    { key: 'supportMuseum', icon: <HeartIcon />, primary: false },
  ];

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      {/* Header - Fixed at top */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 bg-[var(--primary-blue)] text-white">
        <div className="flex items-center gap-3">
          {/* CMC Logo */}
          <div className="flex items-center justify-center w-12 h-12 bg-black rounded-lg text-white font-bold text-sm">
            CMC
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t.brandName}</h1>
            <p className="text-sm text-white/80">{t.brandTagline}</p>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="flex items-center gap-1 bg-white/20 rounded-full p-1">
          <button
            onClick={() => setLanguage('en')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              language === 'en'
                ? 'bg-white text-[var(--text-primary)] shadow-sm'
                : 'text-white hover:bg-white/10'
            }`}
          >
            {t.english}
          </button>
          <button
            onClick={() => setLanguage('es')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              language === 'es'
                ? 'bg-white text-[var(--text-primary)] shadow-sm'
                : 'text-white hover:bg-white/10'
            }`}
          >
            {t.spanish}
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Welcome Card - shown when no messages */}
          {!hasMessages && (
            <div className="animate-fade-in">
              {/* Welcome Message Card */}
              <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 mb-6">
                <div className="flex flex-col items-center text-center">
                  {/* CMC Logo */}
                  <div className="flex items-center justify-center w-14 h-14 bg-black rounded-xl text-white font-bold text-lg mb-4">
                    CMC
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
                    {t.welcomeTitle}
                  </h2>
                  <p className="text-[var(--text-secondary)] leading-relaxed max-w-xl text-[15px]">
                    {t.welcomeMessage}
                  </p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mb-4">
                <h3 className="text-center text-lg font-semibold text-[var(--text-primary)] mb-4">
                  {t.quickActionsTitle}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {quickActions.map(action => (
                    <button
                      key={action.key}
                      onClick={() => handleQuickAction(action.key)}
                      className={`quick-action-btn flex items-center gap-3 px-4 py-3 rounded-lg border-2 font-medium text-left ${
                        action.primary
                          ? 'bg-[var(--primary-blue)] text-white border-[var(--primary-blue)] hover:bg-[var(--primary-blue-hover)]'
                          : 'bg-white text-[var(--text-primary)] border-[var(--border-light)] hover:border-[var(--primary-blue)]'
                      }`}
                    >
                      <span className={action.primary ? 'text-white' : 'text-[var(--text-secondary)]'}>
                        {action.icon}
                      </span>
                      <span>{t[action.key as keyof typeof t]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {hasMessages && (
            <div className="space-y-4" role="log" aria-label={t.chatHistory}>
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`message-bubble flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-[var(--primary-blue)] text-white rounded-br-md'
                        : 'bg-white text-[var(--text-primary)] shadow-[var(--shadow-sm)] rounded-bl-md'
                    }`}
                  >
                    {message.role === 'assistant' && message.isStreaming && !message.content && (
                      <div className="flex items-center gap-1">
                        <span className="typing-dot w-2 h-2 bg-[var(--text-muted)] rounded-full"></span>
                        <span className="typing-dot w-2 h-2 bg-[var(--text-muted)] rounded-full"></span>
                        <span className="typing-dot w-2 h-2 bg-[var(--text-muted)] rounded-full"></span>
                      </div>
                    )}
                    {message.role === 'user' ? (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                      <>
                        <MarkdownContent 
                          content={message.content} 
                          className="chat-content"
                        />
                        {message.citations && message.citations.length > 0 && !message.isStreaming && (
                          <CitationsDisplay citations={message.citations} />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </main>

      {/* Input Bar - Fixed at bottom */}
      <div className="shrink-0 border-t border-[var(--border-light)] bg-white px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={t.inputPlaceholder}
              disabled={isLoading}
              className="chat-input flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--border-light)] rounded-full text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--primary-blue)] transition-colors disabled:opacity-50"
              aria-label={t.newMessage}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="flex items-center justify-center w-12 h-12 bg-[var(--primary-blue)] text-white rounded-full hover:bg-[var(--primary-blue-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t.sendMessage}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
