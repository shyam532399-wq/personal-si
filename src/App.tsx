import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatInput } from './components/ChatInput';
import { EmptyState } from './components/EmptyState';
import { Header } from './components/Header';
import { MessageItem } from './components/MessageItem';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { streamChatCompletion } from './services/chatApi';
import type {
  AppSettings,
  ChatMessage,
  ChatSession,
  ImageAttachment,
  ModelId,
  ThemeMode,
} from './types/chat';
import {
  createId,
  generateAutoTitle,
  prepareEditAndResendHistory,
  prepareRegenerateHistory,
} from './utils/chatUtils';
import {
  loadActiveSessionId,
  loadSessions,
  loadSettings,
  loadTheme,
  saveActiveSessionId,
  saveSessions,
  saveSettings,
  saveTheme,
} from './utils/storage';

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadSessions());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const savedSessions = loadSessions();
    const savedActive = loadActiveSessionId();
    if (savedActive && savedSessions.some((s) => s.id === savedActive)) {
      return savedActive;
    }
    return null;
  });

  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());

  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const [isSidebarOpenDesktop, setIsSidebarOpenDesktop] = useState(true);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync theme with root <html> class and localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  // Persist sessions, active ID, and settings in localStorage
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    saveActiveSessionId(activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  // Smooth auto-scroll on new messages and streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeSession?.messages, streamingMessageId]);

  const runAssistantStream = useCallback(
    async (
      sessionId: string,
      historyUpToUserTurn: ChatMessage[],
      effectiveSettings: AppSettings,
    ) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const assistantMsgId = createId();
      const assistantPlaceholder: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        model: effectiveSettings.model,
      };

      setStreamingMessageId(assistantMsgId);

      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                updatedAt: Date.now(),
                messages: [...historyUpToUserTurn, assistantPlaceholder],
              }
            : session,
        ),
      );

      await streamChatCompletion(
        historyUpToUserTurn,
        effectiveSettings,
        controller.signal,
        {
          onChunk: (chunkText) => {
            setSessions((prev) =>
              prev.map((session) => {
                if (session.id !== sessionId) return session;
                return {
                  ...session,
                  updatedAt: Date.now(),
                  messages: session.messages.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + chunkText }
                      : m,
                  ),
                };
              }),
            );
          },
          onError: (chatError) => {
            setSessions((prev) =>
              prev.map((session) => {
                if (session.id !== sessionId) return session;
                return {
                  ...session,
                  updatedAt: Date.now(),
                  messages: session.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, error: chatError } : m,
                  ),
                };
              }),
            );
            setStreamingMessageId((curr) => (curr === assistantMsgId ? null : curr));
          },
          onComplete: () => {
            setSessions((prev) =>
              prev.map((session) => {
                if (session.id !== sessionId) return session;
                return {
                  ...session,
                  messages: session.messages.map((m) => {
                    if (m.id !== assistantMsgId) return m;
                    if (!m.content && !m.error && controller.signal.aborted) {
                      return { ...m, content: '_Generation stopped._' };
                    }
                    return m;
                  }),
                };
              }),
            );
            setStreamingMessageId((curr) => (curr === assistantMsgId ? null : curr));
          },
        },
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (overridePrompt?: string) => {
      const textToSend = (overridePrompt !== undefined ? overridePrompt : inputText).trim();
      const currentAttachments = overridePrompt !== undefined ? [] : attachments;

      if ((!textToSend && currentAttachments.length === 0) || streamingMessageId) {
        return;
      }

      if (overridePrompt === undefined) {
        setInputText('');
        setAttachments([]);
      }

      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: textToSend,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
        createdAt: Date.now(),
      };

      let targetSessionId = activeSessionId;
      let nextHistory: ChatMessage[] = [];

      if (!targetSessionId || !sessions.some((s) => s.id === targetSessionId)) {
        const newSessionId = createId();
        const autoTitle = generateAutoTitle(textToSend, currentAttachments.length > 0);
        const newSession: ChatSession = {
          id: newSessionId,
          title: autoTitle,
          isCustomTitle: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [userMessage],
        };
        targetSessionId = newSessionId;
        nextHistory = [userMessage];
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSessionId);
      } else {
        const existing = sessions.find((s) => s.id === targetSessionId)!;
        nextHistory = [...existing.messages, userMessage];
        const shouldAutoTitle =
          !existing.isCustomTitle &&
          (existing.messages.length === 0 || existing.title === 'New chat');
        const nextTitle = shouldAutoTitle
          ? generateAutoTitle(textToSend, currentAttachments.length > 0)
          : existing.title;

        setSessions((prev) => {
          const updatedSession: ChatSession = {
            ...existing,
            title: nextTitle,
            updatedAt: Date.now(),
            messages: nextHistory,
          };
          const others = prev.filter((s) => s.id !== targetSessionId);
          return [updatedSession, ...others];
        });
      }

      await runAssistantStream(targetSessionId, nextHistory, settings);
    },
    [activeSessionId, attachments, inputText, runAssistantStream, sessions, settings, streamingMessageId],
  );

  const handleStopGenerating = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleNewChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setStreamingMessageId(null);
    setActiveSessionId(null);
    setInputText('');
    setAttachments([]);
  }, []);

  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, title: newTitle, isCustomTitle: true } : s,
      ),
    );
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      if (id === activeSessionId) {
        abortControllerRef.current?.abort();
        setStreamingMessageId(null);
        setActiveSessionId(null);
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [activeSessionId],
  );

  const handleRegenerate = useCallback(
    async (assistantMessageId: string) => {
      if (!activeSession || streamingMessageId) return;
      const historyUpToUser = prepareRegenerateHistory(
        activeSession.messages,
        assistantMessageId,
      );
      if (!historyUpToUser) return;
      await runAssistantStream(activeSession.id, historyUpToUser, settings);
    },
    [activeSession, runAssistantStream, settings, streamingMessageId],
  );

  const handleRetryError = useCallback(
    async (assistantMessageId: string, overrideModel?: ModelId) => {
      if (!activeSession || streamingMessageId) return;
      const historyUpToUser = prepareRegenerateHistory(
        activeSession.messages,
        assistantMessageId,
      );
      if (!historyUpToUser) return;

      let effectiveSettings = settings;
      if (overrideModel && overrideModel !== settings.model) {
        effectiveSettings = { ...settings, model: overrideModel };
        setSettings(effectiveSettings);
      }
      await runAssistantStream(activeSession.id, historyUpToUser, effectiveSettings);
    },
    [activeSession, runAssistantStream, settings, streamingMessageId],
  );

  const handleEditAndResend = useCallback(
    async (userMessageId: string, newContent: string) => {
      if (!activeSession || streamingMessageId) return;
      const branchedHistory = prepareEditAndResendHistory(
        activeSession.messages,
        userMessageId,
        newContent,
      );
      if (!branchedHistory) return;

      // Update auto-title if the first message was edited and title wasn't manually customized
      if (
        !activeSession.isCustomTitle &&
        branchedHistory.length === 1 &&
        branchedHistory[0].id === userMessageId
      ) {
        const nextTitle = generateAutoTitle(
          newContent,
          Boolean(branchedHistory[0].attachments?.length),
        );
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSession.id ? { ...s, title: nextTitle } : s)),
        );
      }

      await runAssistantStream(activeSession.id, branchedHistory, settings);
    },
    [activeSession, runAssistantStream, settings, streamingMessageId],
  );

  const handleToggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpenMobile((prev) => !prev);
    } else {
      setIsSidebarOpenDesktop((prev) => !prev);
    }
  }, []);

  const isStreaming = Boolean(streamingMessageId);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white text-slate-900 dark:bg-[#131314] dark:text-zinc-100">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isOpenDesktop={isSidebarOpenDesktop}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={() => setIsSidebarOpenMobile(false)}
        onToggleDesktop={() => setIsSidebarOpenDesktop((prev) => !prev)}
        onNewChat={handleNewChat}
        onSelectSession={(id) => {
          if (id !== activeSessionId) {
            abortControllerRef.current?.abort();
            setStreamingMessageId(null);
            setActiveSessionId(id);
          }
        }}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          selectedModel={settings.model}
          onSelectModel={(model) => setSettings((prev) => ({ ...prev, model }))}
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpenDesktop={isSidebarOpenDesktop}
          onNewChat={handleNewChat}
          theme={theme}
          onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {!activeSession || activeSession.messages.length === 0 ? (
            <EmptyState onSelectSuggestion={(prompt) => void sendMessage(prompt)} />
          ) : (
            <div className="mx-auto w-full max-w-3xl flex-1 space-y-7 px-4 py-6 sm:px-6 sm:py-8">
              {activeSession.messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  isStreamingThisMessage={streamingMessageId === msg.id}
                  isAnyStreaming={isStreaming}
                  onRegenerate={(id) => void handleRegenerate(id)}
                  onEditAndResend={(id, updated) => void handleEditAndResend(id, updated)}
                  onRetryError={(id, overrideModel) =>
                    void handleRetryError(id, overrideModel)
                  }
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              ))}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </main>

        <ChatInput
          value={inputText}
          onChange={setInputText}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onSend={() => void sendMessage()}
          onStop={handleStopGenerating}
          isStreaming={isStreaming}
          voiceLang={settings.voiceLang}
          onVoiceLangChange={(voiceLang) =>
            setSettings((prev) => ({ ...prev, voiceLang }))
          }
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setSettings}
      />
    </div>
  );
}
