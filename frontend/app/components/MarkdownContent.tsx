'use client';

import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  if (!content) return null;
  
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        components={{
          // Style links
          a: ({ children, href }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[var(--primary-blue)] hover:underline"
            >
              {children}
            </a>
          ),
          // Style code blocks
          code: ({ children }) => (
            <code className="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          ),
          // Style lists - proper formatting
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="leading-relaxed mb-2 last:mb-0">{children}</p>
          ),
          // Style headings - use Montserrat
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold mb-2 font-[var(--font-heading)]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mb-2 font-[var(--font-heading)]">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[15px] font-semibold mb-1.5 font-[var(--font-heading)]">{children}</h3>
          ),
          // Style strong/bold
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          // Style emphasis/italic
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
