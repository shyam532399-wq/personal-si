import { useState } from 'react';
import {
  Check,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Pencil,
  Plus,
  Settings,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import type { ChatSession, ThemeMode } from '../types/chat';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isOpenDesktop: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onToggleDesktop: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export function Sidebar({
  sessions,
  activeSessionId,
  isOpenDesktop,
  isOpenMobile,
  onCloseMobile,
  onToggleDesktop,
  onNewChat,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onOpenSettings,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const startRename = (session: ChatSession) => {
    setRenamingId(session.id);
    setRenameDraft(session.title);
  };

  const commitRename = (id: string) => {
    const trimmed = renameDraft.trim();
    if (trimmed) {
      onRenameSession(id, trimmed);
    }
    setRenamingId(null);
  };

  const sidebarContent = (
    <div className="flex h-full w-[272px] flex-col border-r border-slate-200/80 bg-slate-50 text-slate-800 dark:border-zinc-800 dark:bg-[#18191c] dark:text-zinc-200">
      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onCloseMobile();
          }}
          className="inline-flex flex-1 items-center gap-2.5 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-xs ring-1 ring-slate-200/90 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:bg-[#232529] dark:text-zinc-100 dark:ring-zinc-700/80 dark:hover:bg-[#2b2d32] whitespace-nowrap"
        >
          <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>New chat</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isOpenMobile) {
              onCloseMobile();
            } else {
              onToggleDesktop();
            }
          }}
          aria-label="Close sidebar"
          title="Collapse sidebar"
          className="ml-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pt-3 pb-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400">
        Recent chats
      </div>

      <nav
        aria-label="Chat history"
        className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-1"
      >
        {sessions.length === 0 ? (
          <div className="px-3 py-6 text-xs leading-relaxed text-slate-400 dark:text-zinc-500">
            Your conversations will appear here automatically.
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isRenaming = renamingId === session.id;

            if (isRenaming) {
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-1 rounded-xl bg-white px-2.5 py-1.5 ring-1 ring-blue-500 dark:bg-zinc-900"
                >
                  <label htmlFor={`rename-${session.id}`} className="sr-only">
                    Rename chat
                  </label>
                  <input
                    id={`rename-${session.id}`}
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitRename(session.id);
                      } else if (e.key === 'Escape') {
                        setRenamingId(null);
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent text-xs font-medium text-slate-900 focus:outline-none dark:text-zinc-100"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => commitRename(session.id)}
                    aria-label="Save chat title"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 hover:bg-slate-100 dark:text-emerald-400 dark:hover:bg-zinc-800"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    aria-label="Cancel rename"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={session.id}
                className={`group flex items-center justify-between rounded-xl px-2.5 py-2 transition-colors ${
                  isActive
                    ? 'bg-blue-50/90 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200'
                    : 'text-slate-700 hover:bg-slate-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(session.id);
                    onCloseMobile();
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate text-sm font-medium">{session.title}</span>
                </button>

                <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => startRename(session)}
                    aria-label={`Rename chat '${session.title}'`}
                    title="Rename chat"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-300/60 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSession(session.id)}
                    aria-label={`Delete chat '${session.title}'`}
                    title="Delete chat"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-red-950/60 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </nav>

      <div className="border-t border-slate-200/80 p-2.5 space-y-1 dark:border-zinc-800">
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/60 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-4 w-4 text-amber-400 shrink-0" />
              <span>Light theme</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-slate-600 shrink-0" />
              <span>Dark theme</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onOpenSettings();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200/60 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-300 dark:hover:bg-zinc-800 whitespace-nowrap"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop collapsible sidebar */}
      {isOpenDesktop && <aside className="hidden md:flex shrink-0">{sidebarContent}</aside>}

      {/* Mobile slide-over drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true" aria-label="Chat history navigation">
          <div
            onClick={onCloseMobile}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-[1px] transition-opacity"
          />
          <div className="relative z-10 flex h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
