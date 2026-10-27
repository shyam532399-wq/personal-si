import { DEFAULT_SETTINGS } from '../constants/defaults';
import type { AppSettings, ChatSession, ThemeMode } from '../types/chat';

const SESSIONS_KEY = 'gemini_chat_sessions_v1';
const ACTIVE_SESSION_KEY = 'gemini_chat_active_id_v1';
const SETTINGS_KEY = 'gemini_chat_settings_v1';
const THEME_KEY = 'gemini_chat_theme_v1';

export function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ChatSession =>
        item &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        Array.isArray(item.messages),
    );
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // If localStorage quota is exceeded due to many high-res image attachments,
    // keep text & recent attachments while trimming older base64 payloads.
    try {
      const trimmedSessions = sessions.map((session, sIdx) => ({
        ...session,
        messages: session.messages.map((msg, mIdx) => {
          const isRecent = sIdx < 2 && mIdx >= session.messages.length - 6;
          if (isRecent || !msg.attachments?.length) {
            return msg;
          }
          return {
            ...msg,
            attachments: undefined,
          };
        }),
      }));
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmedSessions));
    } catch {
      // Ignore storage error if browser blocks storage completely
    }
  }
}

export function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveActiveSessionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_SESSION_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  } catch {
    // Ignore storage error
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const model =
      parsed.model === 'gemini-4-argon' ||
      parsed.model === 'gemini-3.1-flash-lite' ||
      parsed.model === 'gemini-flash-latest'
        ? parsed.model
        : DEFAULT_SETTINGS.model;
    const temperature =
      typeof parsed.temperature === 'number' && !Number.isNaN(parsed.temperature)
        ? Math.min(2, Math.max(0, parsed.temperature))
        : DEFAULT_SETTINGS.temperature;
    const systemInstruction =
      typeof parsed.systemInstruction === 'string' && parsed.systemInstruction.trim().length > 0
        ? parsed.systemInstruction
        : DEFAULT_SETTINGS.systemInstruction;
    const voiceLang =
      parsed.voiceLang === 'hi-IN' || parsed.voiceLang === 'en-IN'
        ? parsed.voiceLang
        : DEFAULT_SETTINGS.voiceLang;

    return {
      model,
      temperature,
      systemInstruction,
      voiceLang,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage error
  }
}

export function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage error
  }
}
