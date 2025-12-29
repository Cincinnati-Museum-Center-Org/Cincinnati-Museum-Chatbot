'use client';

import { useMemo } from 'react';

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

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const html = useMemo(() => parseMarkdown(content), [content]);
  return (
    <div 
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
