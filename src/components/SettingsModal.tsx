import { useEffect, useState } from 'react';
import { ChevronDown, RotateCcw, X } from 'lucide-react';
import { AVAILABLE_MODELS, DEFAULT_SYSTEM_INSTRUCTION } from '../constants/defaults';
import type { AppSettings, ModelId, VoiceLang } from '../types/chat';
import { normalizeApiBaseUrl } from '../utils/chatUtils';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (next: AppSettings) => void;
}

export function SettingsModal({ isOpen, settings, onClose, onSave }: SettingsModalProps) {
  const [draft, setDraft] = useState<AppSettings>(settings);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
    }
  }, [isOpen, settings]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    const cleanedInstruction = draft.systemInstruction.trim() || DEFAULT_SYSTEM_INSTRUCTION;
    const cleanedApiBaseUrl = normalizeApiBaseUrl(draft.apiBaseUrl);
    onSave({
      ...draft,
      systemInstruction: cleanedInstruction,
      apiBaseUrl: cleanedApiBaseUrl,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#1e1f22]">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 dark:border-zinc-800">
          <h2
            id="settings-modal-title"
            className="text-base font-semibold text-slate-900 dark:text-zinc-100"
          >
            Chat settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto px-6 py-5">
          {/* Model Choice */}
          <div>
            <label
              htmlFor="settings-model"
              className="block text-sm font-medium text-slate-800 dark:text-zinc-200"
            >
              AI model
            </label>
            <div className="relative mt-2">
              <select
                id="settings-model"
                value={draft.model}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, model: e.target.value as ModelId }))
                }
                className="w-full cursor-pointer appearance-none truncate rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-10 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.description}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
              />
            </div>
            {draft.model === 'gemini-4-argon' && (
              <p className="mt-1.5 text-xs text-slate-500 dark:text-zinc-400">
                Note: Gemini Pro requires a billing-enabled API key in Settings &gt; Secrets.
              </p>
            )}
          </div>

          {/* Backend Server URL (for Android APK) */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="settings-api-base-url"
                className="text-sm font-medium text-slate-800 dark:text-zinc-200"
              >
                Backend server URL (Android APK)
              </label>
              {(draft.apiBaseUrl || '').trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, apiBaseUrl: '' }))}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
            <input
              id="settings-api-base-url"
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={draft.apiBaseUrl || ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, apiBaseUrl: e.target.value }))
              }
              placeholder="https://your-app.onrender.com (leave blank on web)"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
              Leave blank in a browser. Inside the Android APK, enter your deployed server URL so chat streams connect cleanly.
            </p>
          </div>

          {/* Temperature Slider */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="settings-temperature"
                className="text-sm font-medium text-slate-800 dark:text-zinc-200"
              >
                Temperature
              </label>
              <span className="font-mono text-sm font-medium tabular-nums text-blue-600 dark:text-blue-400">
                {draft.temperature.toFixed(1)}
              </span>
            </div>
            <input
              id="settings-temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={draft.temperature}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
              }
              className="mt-2.5 w-full accent-blue-600 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-400 dark:text-zinc-500 tabular-nums">
              <span>0.0 · Precise</span>
              <span>0.7 · Balanced</span>
              <span>2.0 · Creative</span>
            </div>
          </div>

          {/* Voice Input Language */}
          <div>
            <label
              htmlFor="settings-voice-lang"
              className="block text-sm font-medium text-slate-800 dark:text-zinc-200"
            >
              Voice input language (Web Speech API)
            </label>
            <div className="relative mt-2">
              <select
                id="settings-voice-lang"
                value={draft.voiceLang}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, voiceLang: e.target.value as VoiceLang }))
                }
                className="w-full cursor-pointer appearance-none truncate rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-10 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="en-IN">English (India) — en-IN (supports Hinglish)</option>
                <option value="hi-IN">हिन्दी (भारत) — hi-IN</option>
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
              />
            </div>
          </div>

          {/* System Instruction */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="settings-system-instruction"
                className="text-sm font-medium text-slate-800 dark:text-zinc-200"
              >
                System instruction
              </label>
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
                  }))
                }
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset to default</span>
              </button>
            </div>
            <textarea
              id="settings-system-instruction"
              rows={4}
              value={draft.systemInstruction}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, systemInstruction: e.target.value }))
              }
              placeholder={DEFAULT_SYSTEM_INSTRUCTION}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200/80 bg-slate-50/70 px-6 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full bg-blue-600 px-5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-blue-500 dark:hover:bg-blue-400 whitespace-nowrap shrink-0"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
