import { Code2, Compass, Languages, Table2 } from 'lucide-react';
import { SUGGESTION_CHIPS } from '../constants/defaults';
import type { SuggestionChip } from '../types/chat';

interface EmptyStateProps {
  onSelectSuggestion: (prompt: string) => void;
}

function getChipIcon(id: string) {
  switch (id) {
    case 'explain-quantum':
      return <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    case 'hinglish-roadmap':
      return <Languages className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'write-code':
      return <Code2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />;
    default:
      return <Table2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  }
}

export function EmptyState({ onSelectSuggestion }: EmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-8 sm:mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-zinc-100 [text-wrap:balance]">
          Hello, how can I help you today?
        </h1>
        <p className="mt-2.5 text-base text-slate-500 dark:text-zinc-400">
          Ask anything in English, हिंदी, or Hinglish — attach images, write code, or explore ideas.
        </p>
      </div>

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Prompt suggestions"
      >
        {SUGGESTION_CHIPS.map((chip: SuggestionChip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelectSuggestion(chip.prompt)}
            className="group flex min-h-[120px] flex-col justify-between rounded-2xl border border-slate-200 bg-[#f0f4f9]/75 p-4 text-left transition-all duration-150 hover:border-slate-300 hover:bg-[#e8eef7] focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-800 dark:bg-[#1e1f22] dark:hover:border-zinc-700 dark:hover:bg-[#27282c]"
          >
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                {chip.title}
              </div>
              <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                {chip.subtitle}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end opacity-80 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:opacity-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-xs dark:bg-zinc-900">
                {getChipIcon(chip.id)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
