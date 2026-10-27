import { ChevronDown, Menu, Moon, Plus, Settings, Sun } from 'lucide-react';
import { AVAILABLE_MODELS } from '../constants/defaults';
import type { ModelId, ThemeMode } from '../types/chat';

interface HeaderProps {
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  onToggleSidebar: () => void;
  isSidebarOpenDesktop: boolean;
  onNewChat: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export function Header({
  selectedModel,
  onSelectModel,
  onToggleSidebar,
  isSidebarOpenDesktop,
  onNewChat,
  theme,
  onToggleTheme,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200/70 bg-white/95 px-3 backdrop-blur-sm sm:px-5 dark:border-zinc-800/80 dark:bg-[#131314]/95">
      {/* Zone 1: Menu + Brand + Model Switcher */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle chat history sidebar"
          title="Toggle sidebar"
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white ${
            isSidebarOpenDesktop ? 'md:hidden' : ''
          }`}
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100 whitespace-nowrap shrink-0">
          Gemini Chat
        </span>

        <div className="relative flex items-center">
          <label htmlFor="header-model-select" className="sr-only">
            Select Gemini model
          </label>
          <select
            id="header-model-select"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value as ModelId)}
            aria-label="Select Gemini model"
            className="h-9 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-[#f0f4f9] pl-3 pr-8 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-200/70 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-800 dark:bg-[#1e1f22] dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-[#27282c]"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-500 dark:text-zinc-400"
          />
        </div>
      </div>

      {/* Zone 3: Quick Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        {!isSidebarOpenDesktop && (
          <button
            type="button"
            onClick={onNewChat}
            aria-label="New chat"
            title="New chat"
            className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New chat</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
