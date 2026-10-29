import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { ArrowUp, ImagePlus, Mic, MicOff, Square, X } from 'lucide-react';
import type { ImageAttachment, VoiceLang } from '../types/chat';
import { processImageFile } from '../utils/imageUtils';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

interface ChatInputProps {
  value: string;
  onChange: (next: string) => void;
  attachments: ImageAttachment[];
  onAttachmentsChange: (next: ImageAttachment[]) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  voiceLang: VoiceLang;
  onVoiceLangChange: (lang: VoiceLang) => void;
}

export function ChatInput({
  value,
  onChange,
  attachments,
  onAttachmentsChange,
  onSend,
  onStop,
  isStreaming,
  voiceLang,
  onVoiceLangChange,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseTextBeforeSpeechRef = useRef<string>('');
  const latestValueRef = useRef<string>(value);
  latestValueRef.current = value;

  const [isListening, setIsListening] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [helperNotice, setHelperNotice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const showTransientNotice = (msg: string) => {
    setHelperNotice(msg);
    window.setTimeout(() => {
      setHelperNotice((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  const addFiles = async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      if (files.length > 0) {
        showTransientNotice('Please upload or paste a valid image (PNG, JPG, WebP, or GIF).');
      }
      return;
    }

    const remainingSlots = Math.max(0, 4 - attachments.length);
    if (remainingSlots === 0) {
      showTransientNotice('You can attach up to 4 images per message.');
      return;
    }

    try {
      const processed = await Promise.all(
        imageFiles.slice(0, remainingSlots).map((file) => processImageFile(file)),
      );
      onAttachmentsChange([...attachments, ...processed]);
    } catch {
      showTransientNotice('Could not read the selected image. Please try another file.');
    }
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await addFiles(imageFiles);
    }
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      await addFiles(files);
    }
  };

  const removeAttachment = (id: string) => {
    onAttachmentsChange(attachments.filter((a) => a.id !== id));
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      showTransientNotice(
        'Voice input (Web Speech API) is not supported in this browser. Try Chrome or Edge.',
      );
      return;
    }

    try {
      const recognition = new Ctor();
      recognition.lang = voiceLang;
      recognition.continuous = false;
      recognition.interimResults = true;

      const prefix = latestValueRef.current.trim();
      baseTextBeforeSpeechRef.current = prefix ? `${prefix} ` : '';

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript;
        }
        onChange(`${baseTextBeforeSpeechRef.current}${transcript}`);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          showTransientNotice(
            'Microphone access was denied. Allow microphone permissions in your browser settings.',
          );
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          showTransientNotice(`Voice input stopped (${event.error}). Please try again.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setHelperNotice(null);
      textareaRef.current?.focus();
    } catch {
      setIsListening(false);
      showTransientNotice('Unable to start microphone voice recognition.');
    }
  };

  const toggleVoiceLang = () => {
    const nextLang: VoiceLang = voiceLang === 'en-IN' ? 'hi-IN' : 'en-IN';
    onVoiceLangChange(nextLang);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  };

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
        }
        onSend();
      }
    }
  };

  const computedRows = Math.min(7, Math.max(1, value.split('\n').length));

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-3 pt-2 sm:px-6 sm:pb-5">
      {helperNotice && (
        <div
          role="status"
          className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <span>{helperNotice}</span>
          <button
            type="button"
            onClick={() => setHelperNotice(null)}
            aria-label="Dismiss notice"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-3xl border bg-[#f0f4f9] px-3.5 py-2.5 shadow-xs transition-colors dark:bg-[#1e1f22] ${
          isDragging
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : 'border-slate-200 focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-md dark:border-zinc-800 dark:focus-within:border-zinc-700 dark:focus-within:bg-[#232428]'
        }`}
      >
        {attachments.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2.5 pt-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              >
                <img
                  src={att.previewUrl}
                  alt={`Preview of ${att.name}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  aria-label={`Remove ${att.name}`}
                  className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-white transition-colors hover:bg-slate-950 focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label htmlFor="chat-prompt-input" className="sr-only">
          Message DEFAULTER AI
        </label>
        <textarea
          ref={textareaRef}
          id="chat-prompt-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={computedRows}
          placeholder={
            isListening
              ? voiceLang === 'hi-IN'
                ? 'सुन रहे हैं… बोलिए (Listening in Hindi)...'
                : 'Listening… speak now...'
              : 'Enter a prompt here, or paste an image'
          }
          className="max-h-44 w-full resize-none bg-transparent px-1.5 py-1.5 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />

        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                if (selected.length > 0) {
                  void addFiles(selected);
                }
                e.target.value = '';
              }}
              className="hidden"
              tabIndex={-1}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              aria-label="Upload image"
              title="Upload image (or paste from clipboard)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <ImagePlus className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isStreaming}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              title={
                isListening
                  ? 'Stop voice input'
                  : `Voice input (${voiceLang === 'hi-IN' ? 'Hindi hi-IN' : 'English en-IN'})`
              }
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 ${
                isListening
                  ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-400'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              }`}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={toggleVoiceLang}
              aria-label={`Switch voice recognition language (currently ${voiceLang})`}
              title="Toggle voice language between English (en-IN) and Hindi (hi-IN)"
              className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 whitespace-nowrap shrink-0"
            >
              {voiceLang === 'hi-IN' ? 'हिं · hi-IN' : 'EN · en-IN'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generating"
                className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-900 px-4 text-xs font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white whitespace-nowrap shrink-0"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stop generating</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (isListening) {
                    recognitionRef.current?.stop();
                    setIsListening(false);
                  }
                  onSend();
                }}
                disabled={!canSend}
                aria-label="Send message"
                title="Send message"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:bg-slate-200 disabled:text-slate-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 shrink-0"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-zinc-500">
        DEFAULTER AI may display inaccurate info, so double-check important responses.
      </p>
    </div>
  );
}
