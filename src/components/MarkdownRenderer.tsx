import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/common';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const { highlightedHtml, displayLang } = useMemo(() => {
    const cleanLang = language.toLowerCase().trim();
    try {
      if (cleanLang && hljs.getLanguage(cleanLang)) {
        const res = hljs.highlight(code, { language: cleanLang, ignoreIllegals: true });
        return { highlightedHtml: res.value, displayLang: cleanLang };
      }
      const auto = hljs.highlightAuto(code);
      return {
        highlightedHtml: auto.value,
        displayLang: cleanLang || auto.language || 'code',
      };
    } catch {
      const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return { highlightedHtml: escaped, displayLang: cleanLang || 'code' };
    }
  }, [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy if clipboard permission blocked
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-[#18191c]">
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-100/80 px-4 py-2 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
        <span className="font-mono font-medium lowercase">{displayLang}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Code copied' : `Copy ${displayLang} code`}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white whitespace-nowrap shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        <pre className="m-0 font-mono text-[13px] leading-relaxed">
          <code
            className="hljs font-mono"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body text-[15px] leading-7 text-slate-800 dark:text-zinc-100 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3.5 last:mb-0 leading-7">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-950 dark:text-white">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-white first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-white first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-base font-semibold text-slate-900 dark:text-zinc-100 first:mt-0">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="mb-3.5 ml-5 list-disc space-y-1.5 marker:text-slate-400 dark:marker:text-zinc-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3.5 ml-5 list-decimal space-y-1.5 tabular-nums marker:text-slate-500 dark:marker:text-zinc-400">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3.5 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-5 border-slate-200 dark:border-zinc-800" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline decoration-blue-600/35 underline-offset-2 transition-colors hover:text-blue-700 hover:decoration-blue-700 dark:text-blue-400 dark:decoration-blue-400/40 dark:hover:text-blue-300"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
              <table className="w-full border-collapse text-left text-sm tabular-nums">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-200/80 dark:divide-zinc-800/80">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="transition-colors hover:bg-slate-50/80 dark:hover:bg-zinc-900/40">
              {children}
            </tr>
          ),
          th: ({ children }) => <th className="px-4 py-2.5 font-semibold">{children}</th>,
          td: ({ children }) => (
            <td className="px-4 py-2.5 align-top text-slate-700 dark:text-zinc-300">{children}</td>
          ),
          code: ({ className, children }) => {
            const rawCode = String(children).replace(/\n$/, '');
            const langMatch = /language-([\w-]+)/.exec(className || '');
            const isBlock = Boolean(langMatch) || rawCode.includes('\n');

            if (isBlock) {
              return <CodeBlock language={langMatch?.[1] || ''} code={rawCode} />;
            }

            return (
              <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800 dark:bg-zinc-800/90 dark:text-zinc-200">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
