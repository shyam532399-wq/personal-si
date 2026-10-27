import { useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Pencil,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import type { ChatMessage, ErrorCode, ModelId } from '../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageItemProps {
  message: ChatMessage;
  isStreamingThisMessage: boolean;
  isAnyStreaming: boolean;
  onRegenerate: (assistantMessageId: string) => void;
  onEditAndResend: (userMessageId: string, newContent: string) => void;
  onRetryError: (assistantMessageId: string, overrideModel?: ModelId) => void;
}

function getErrorIcon(code: ErrorCode) {
  switch (code) {
    case 'NETWORK_ERROR':
      return <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />;
    case 'BLOCKED':
      return <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />;
    default:
      return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />;
  }
}

function getErrorHeading(code: ErrorCode): string {
  switch (code) {
    case 'RATE_LIMIT':
      return 'Rate limit reached (429)';
    case 'BLOCKED':
      return 'Response filtered';
    case 'NETWORK_ERROR':
      return 'Network connection error';
    case 'AUTH_ERROR':
      return 'API access issue';
    default:
      return 'Unable to generate response';
  }
}

export function MessageItem({
  message,
  isStreamingThisMessage,
  isAnyStreaming,
  onRegenerate,
  onEditAndResend,
  onRetryError,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = message.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartEdit = () => {
    setEditDraft(message.content);
    setIsEditing(true);
  };

  const handleSubmitEdit = () => {
    const trimmed = editDraft.trim();
    if (!trimmed && (!message.attachments || message.attachments.length === 0)) {
      return;
    }
    setIsEditing(false);
    onEditAndResend(message.id, trimmed);
  };

  if (message.role === 'user') {
    return (
      <div className="group flex w-full flex-col items-end">
        {isEditing ? (
          <div className="w-full max-w-2xl rounded-2xl border border-blue-500/50 bg-slate-50 p-3.5 shadow-xs dark:border-blue-400/40 dark:bg-[#1e1f22]">
            <label htmlFor={`edit-${message.id}`} className="sr-only">
              Edit message
            </label>
            <textarea
              id={`edit-${message.id}`}
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={Math.min(8, Math.max(2, editDraft.split('\n').length))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmitEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                }
              }}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-slate-900 focus:outline-none dark:text-zinc-100"
              autoFocus
            />
            <div className="mt-2.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitEdit}
                disabled={
                  isAnyStreaming ||
                  (!editDraft.trim() && (!message.attachments || message.attachments.length === 0))
                }
                className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 whitespace-nowrap shrink-0"
              >
                Update &amp; resend
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-[88%] sm:max-w-[78%] rounded-3xl bg-slate-100 px-5 py-3.5 text-slate-900 dark:bg-[#282a2e] dark:text-zinc-100">
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {message.attachments.map((att) => (
                    <img
                      key={att.id}
                      src={att.previewUrl || `data:${att.mimeType};base64,${att.data}`}
                      alt={att.name || 'Attached image'}
                      referrerPolicy="no-referrer"
                      className="max-h-56 max-w-full rounded-xl border border-slate-200/80 object-contain dark:border-zinc-700"
                    />
                  ))}
                </div>
              )}
              {message.content && (
                <div className="whitespace-pre-wrap text-[15px] leading-relaxed break-words">
                  {message.content}
                </div>
              )}
            </div>

            <div className="mt-1 flex items-center gap-1 pr-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
              {message.content && (
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label={copied ? 'Message copied' : 'Copy user message'}
                  title="Copy message"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleStartEdit}
                disabled={isAnyStreaming}
                aria-label="Edit and resend message"
                title="Edit and resend"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Assistant Message
  const showTypingIndicator = isStreamingThisMessage && !message.content && !message.error;

  return (
    <div className="group flex w-full items-start gap-3.5 sm:gap-4">
      <div
        aria-hidden="true"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
      >
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        {showTypingIndicator && (
          <div
            role="status"
            aria-label="Gemini is generating a response"
            className="inline-flex items-center gap-1.5 py-2.5"
          >
            <span className="typing-dot-1 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span className="typing-dot-2 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span className="typing-dot-3 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span className="ml-1.5 text-xs text-slate-500 dark:text-zinc-400">Thinking…</span>
          </div>
        )}

        {message.content && <MarkdownRenderer content={message.content} />}

        {message.error && (
          <div
            role="alert"
            className={`mt-2 rounded-2xl border p-4 ${
              message.error.code === 'BLOCKED'
                ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30'
                : 'border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getErrorIcon(message.error.code)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {getErrorHeading(message.error.code)}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
                  {message.error.message}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRetryError(message.id)}
                    disabled={isAnyStreaming}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Retry</span>
                  </button>

                  {message.model === 'gemini-4-argon' &&
                    (message.error.code === 'RATE_LIMIT' ||
                      message.error.code === 'AUTH_ERROR') && (
                      <button
                        type="button"
                        onClick={() => onRetryError(message.id, 'gemini-flash-latest')}
                        disabled={isAnyStreaming}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
                      >
                        <span>Switch to Flash &amp; retry</span>
                      </button>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isStreamingThisMessage && (message.content || message.error) && (
          <div className="mt-2 flex items-center gap-1">
            {message.content && message.content !== '_Generation stopped._' && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'Response copied' : 'Copy assistant response'}
                title="Copy response"
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onRegenerate(message.id)}
              disabled={isAnyStreaming}
              aria-label="Regenerate response"
              title="Regenerate response"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Regenerate</span>
            </button>

            {message.model && (
              <span className="ml-1 text-xs text-slate-400 dark:text-zinc-500">
                <span aria-hidden="true">· </span>
                {message.model === 'gemini-4-argon'
                  ? 'Gemini Pro'
                  : message.model === 'gemini-3.1-flash-lite'
                    ? 'Gemini Flash Lite'
                    : 'Gemini Flash'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
