'use client';

import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CodeBlockProps {
  code: string;
  language: string;
  theme?: 'dark' | 'light';
  showLineNumbers?: boolean;
  showCopyButton?: boolean;
  className?: string;
}

export function CodeBlock({
  code,
  language,
  theme = 'dark',
  showLineNumbers = true,
  showCopyButton = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  // Normalize language names
  const normalizeLanguage = (lang: string): string => {
    const normalized = lang.toLowerCase().trim();

    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'sh': 'bash',
      'c++': 'cpp',
      'c#': 'csharp',
      'cs': 'csharp',
      'rs': 'rust',
      'yml': 'yaml',
      'md': 'markdown',
      'ps1': 'powershell',
    };

    return languageMap[normalized] || normalized;
  };

  const normalizedLang = normalizeLanguage(language);
  const selectedTheme = theme === 'dark' ? vscDarkPlus : vs;

  return (
    <div className={cn("relative group h-full rounded-lg overflow-hidden", className)}>
      {/* Header with language tag and copy button */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <span className="text-xs font-mono text-slate-400 bg-slate-800/90 px-2 py-1 rounded backdrop-blur-sm">
          {language}
        </span>
        {showCopyButton && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/90 hover:bg-slate-700/90 px-2 py-1 rounded backdrop-blur-sm transition-colors"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Syntax highlighted code */}
      <SyntaxHighlighter
        language={normalizedLang}
        style={selectedTheme}
        showLineNumbers={showLineNumbers}
        wrapLines={true}
        customStyle={{
          margin: 0,
          padding: '1rem',
          paddingTop: '2.5rem', // Space for header
          height: '100%',
          overflow: 'auto',
          fontSize: '0.875rem',
          borderRadius: '0.5rem',
        }}
        codeTagProps={{
          style: {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

/**
 * Simple code display without syntax highlighting (fallback)
 */
export function PlainCodeBlock({
  code,
  language,
  className,
}: {
  code: string;
  language: string;
  className?: string;
}) {
  return (
    <div className={cn("relative h-full", className)}>
      <div className="absolute top-2 right-2 z-10">
        <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm">
          {language}
        </span>
      </div>
      <pre className="text-sm text-slate-100 bg-slate-900 p-4 rounded-lg overflow-auto h-full leading-relaxed pt-12">
        <code>{code}</code>
      </pre>
    </div>
  );
}
