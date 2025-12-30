'use client';

import { useState, useRef, useEffect, FormEvent, useMemo } from 'react';
import { useLanguage } from './context/LanguageContext';
import { getApiConfig } from './config/i18n';
import Image from 'next/image';
import { MapPin, Clock, Ticket, BookOpen, Users, Heart, Send } from 'lucide-react';

// Import modular components
import {
  MarkdownContent,
  CitationsDisplay,
  type Message,
  type Citation,
} from './components';
import { ConfirmModal } from './components/ConfirmModal';

export default function Home() {
  const { language, setLanguage, t, getQuickActionPrompt } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [pendingLanguage, setPendingLanguage] = useState<'en' | 'es' | null>(null);
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

  // Handle language change with confirmation
  const handleLanguageChange = (newLanguage: 'en' | 'es') => {
    if (newLanguage === language) return;
    
    // If there are messages, show confirmation modal
    if (messages.length > 0) {
      setPendingLanguage(newLanguage);
      setShowLanguageModal(true);
    } else {
      setLanguage(newLanguage);
    }
  };

  // Confirm language change
  const confirmLanguageChange = () => {
    if (pendingLanguage) {
      setMessages([]);
      setSessionId(null);
      setLanguage(pendingLanguage);
      setPendingLanguage(null);
    }
  };

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
      console.log('🔵 Sending request with sessionId:', sessionId || '(new session)');
      const response = await fetch(apiConfig.chatEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: messageText.trim(),
          sessionId: sessionId || undefined,
          numberOfResults: 5,
          language: language,
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
      let conversationId: string | undefined;
      let buffer = ''; // Buffer for incomplete SSE data

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process complete lines from buffer
          const lines = buffer.split('\n');
          // Keep the last potentially incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              continue;
            }
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (!data.trim()) continue; // Skip empty data lines
              
              try {
                const parsed = JSON.parse(data);
                
                // Capture conversationId for feedback tracking
                if (parsed.conversationId) {
                  conversationId = parsed.conversationId;
                  setMessages(prev =>
                    prev.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, conversationId: conversationId }
                        : msg
                    )
                  );
                }
                
                if (parsed.sessionId) {
                  console.log('🟢 Received sessionId from backend:', parsed.sessionId);
                  setSessionId(parsed.sessionId);
                }
                
                // Handle session expired - clear session so next request starts fresh
                if (parsed.message && parsed.message.includes('Session expired')) {
                  console.log('🟡 Session expired, will use new session from response');
                  setSessionId(null);
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
                
                if (parsed.citations) {
                  console.log('🟣 Received citations:', parsed.citations.length, 'citation groups');
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
              } catch (parseError) {
                // Log JSON parse errors (could indicate split data)
                console.warn('JSON parse error:', parseError, 'Data:', data.substring(0, 100));
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

  // Quick action buttons config with Lucide icons
  const quickActions = [
    { key: 'planYourVisit', icon: <MapPin size={20} />, primary: true },
    { key: 'currentExhibits', icon: <Clock size={20} />, primary: true },
    { key: 'ticketsMembership', icon: <Ticket size={20} />, primary: true },
    { key: 'collections', icon: <BookOpen size={20} />, primary: false },
    { key: 'groupVisits', icon: <Users size={20} />, primary: false },
    { key: 'supportMuseum', icon: <Heart size={20} />, primary: false },
  ];

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 bg-[var(--primary-blue)] text-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 bg-black rounded-lg overflow-hidden">
            <Image 
              src="/CMC_LOGO.svg" 
              alt="Cincinnati Museum Center Logo" 
              width={40} 
              height={40}
              className="invert"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t.brandName}</h1>
            <p className="text-sm text-white/80">{t.brandTagline}</p>
          </div>
        </div>

        {/* Language Toggle */}
        <div className="flex items-center gap-1 bg-white/20 rounded-full p-1">
          <button
            onClick={() => handleLanguageChange('en')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              language === 'en'
                ? 'bg-white text-[var(--text-primary)] shadow-sm'
                : 'text-white hover:bg-white/10'
            }`}
          >
            {t.english}
          </button>
          <button
            onClick={() => handleLanguageChange('es')}
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
        <div className="max-w-4xl mx-auto">
          {/* Welcome Card */}
          {!hasMessages && (
            <div className="animate-fade-in">
              <div className="bg-white rounded-2xl shadow-[var(--shadow-md)] p-6 mb-6">
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center justify-center w-14 h-14 bg-black rounded-xl overflow-hidden mb-4">
                    <Image 
                      src="/CMC_LOGO.svg" 
                      alt="Cincinnati Museum Center Logo" 
                      width={48} 
                      height={48}
                      className="invert"
                    />
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
                          <CitationsDisplay 
                            citations={message.citations} 
                            conversationId={message.conversationId}
                          />
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

      {/* Input Bar */}
      <div className="shrink-0 border-t border-[var(--border-light)] bg-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={isLoading ? t.inputPlaceholder : t.inputPlaceholder}
              className="chat-input flex-1 px-4 py-3 bg-[var(--background)] border border-[var(--border-light)] rounded-full text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--primary-blue)] transition-colors"
              aria-label={t.newMessage}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="flex items-center justify-center w-12 h-12 bg-[var(--primary-blue)] text-white rounded-full hover:bg-[var(--primary-blue-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t.sendMessage}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>

      {/* Language Change Confirmation Modal */}
      <ConfirmModal
        isOpen={showLanguageModal}
        onClose={() => {
          setShowLanguageModal(false);
          setPendingLanguage(null);
        }}
        onConfirm={confirmLanguageChange}
        title={language === 'en' ? 'Change Language?' : '¿Cambiar idioma?'}
        message={
          language === 'en'
            ? 'Switching languages will clear your current conversation history. This action cannot be undone.'
            : 'Cambiar de idioma borrará tu historial de conversación actual. Esta acción no se puede deshacer.'
        }
        confirmText={language === 'en' ? 'Continue' : 'Continuar'}
        cancelText={language === 'en' ? 'Cancel' : 'Cancelar'}
      />
    </div>
  );
}
