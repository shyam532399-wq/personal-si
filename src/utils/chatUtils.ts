import type { ChatError, ChatMessage, ErrorCode } from '../types/chat';

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

const HINGLISH_MARKERS = new Set([
  'kya',
  'kaise',
  'kaisa',
  'kaisi',
  'hai',
  'hain',
  'nahi',
  'nhi',
  'aur',
  'mein',
  'main',
  'mujhe',
  'mujhko',
  'mera',
  'meri',
  'mere',
  'aap',
  'tum',
  'karo',
  'karein',
  'karna',
  'batao',
  'bataiye',
  'samjhao',
  'likho',
  'bana',
  'banao',
  'chahiye',
  'kyun',
  'kyu',
  'kab',
  'kahan',
  'kaun',
  'yeh',
  'ye',
  'woh',
  'wo',
  'acha',
  'accha',
  'bahut',
  'bohot',
  'seekhne',
  'seekhna',
  'padhai',
  'ke',
  'ki',
  'ka',
  'ko',
  'se',
  'par',
  'liye',
  'ek',
  'doosra',
  'bhai',
  'yaar',
  'namaste',
  'shukriya',
  'dhanyavad',
]);

/**
 * Detects whether the user wrote in Hindi (Devanagari), Hinglish (Romanized Hindi/English mix), or English.
 */
export function detectUserLanguage(text: string): 'hi' | 'hinglish' | 'en' {
  const trimmed = text.trim();
  if (!trimmed) {
    return 'en';
  }

  if (DEVANAGARI_REGEX.test(trimmed)) {
    return 'hi';
  }

  const tokens = trimmed
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return 'en';
  }

  let hinglishHits = 0;
  for (const token of tokens) {
    if (HINGLISH_MARKERS.has(token)) {
      hinglishHits += 1;
    }
  }

  // Require at least 2 Hinglish markers, or 1 unambiguous marker in short messages
  const strongSingleMarkers = new Set([
    'kya',
    'kaise',
    'mujhe',
    'batao',
    'samjhao',
    'namaste',
    'karo',
    'chahiye',
    'nahi',
  ]);

  if (hinglishHits >= 2) {
    return 'hinglish';
  }
  if (
    hinglishHits === 1 &&
    tokens.length <= 6 &&
    tokens.some((t) => strongSingleMarkers.has(t))
  ) {
    return 'hinglish';
  }

  return 'en';
}

/**
 * Generates a clean, concise sidebar title from the first user message.
 */
export function generateAutoTitle(firstMessage: string, hasImage = false): string {
  const cleaned = firstMessage
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return hasImage ? 'Image analysis' : 'New chat';
  }

  const maxLength = 42;
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const sliced = cleaned.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace > 18) {
    return `${sliced.slice(0, lastSpace)}…`;
  }
  return `${sliced}…`;
}

/**
 * Converts UI ChatMessage history into a clean API request history array,
 * omitting incomplete/errored empty assistant placeholders.
 */
export function buildApiHistoryPayload(messages: ChatMessage[]) {
  return messages
    .filter((msg) => {
      if (msg.role === 'assistant' && !msg.content.trim()) {
        return false;
      }
      return Boolean(msg.content.trim() || (msg.attachments && msg.attachments.length > 0));
    })
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
      attachments: msg.attachments?.map((att) => ({
        mimeType: att.mimeType,
        data: att.data,
      })),
    }));
}

/**
 * Slices conversation history up to and including the user prompt preceding an assistant message
 * so Regenerate sends the exact multi-turn history up to that point.
 */
export function prepareRegenerateHistory(
  messages: ChatMessage[],
  assistantMessageId: string,
): ChatMessage[] | null {
  const idx = messages.findIndex((m) => m.id === assistantMessageId);
  if (idx <= 0) {
    return null;
  }

  // Find the nearest preceding user message
  let userIdx = idx - 1;
  while (userIdx >= 0 && messages[userIdx].role !== 'user') {
    userIdx -= 1;
  }

  if (userIdx < 0) {
    return null;
  }

  return messages.slice(0, userIdx + 1);
}

/**
 * Updates a user message with edited content and truncates all subsequent turns
 * so the conversation branches cleanly from the edited message.
 */
export function prepareEditAndResendHistory(
  messages: ChatMessage[],
  userMessageId: string,
  updatedContent: string,
): ChatMessage[] | null {
  const idx = messages.findIndex((m) => m.id === userMessageId && m.role === 'user');
  if (idx === -1) {
    return null;
  }

  const target = messages[idx];
  const trimmed = updatedContent.trim();
  if (!trimmed && (!target.attachments || target.attachments.length === 0)) {
    return null;
  }

  const updatedUserMsg: ChatMessage = {
    ...target,
    content: trimmed,
    error: undefined,
  };

  return [...messages.slice(0, idx), updatedUserMsg];
}

/**
 * Maps client/network/HTTP failures into user-friendly ChatError objects.
 */
export function classifyClientError(
  err: unknown,
  httpStatus?: number,
): ChatError {
  if (httpStatus === 429) {
    return {
      code: 'RATE_LIMIT',
      message:
        'Too many requests (429). Please wait a moment and click Retry, or switch models in the header.',
    };
  }

  if (httpStatus === 403 || httpStatus === 401) {
    return {
      code: 'AUTH_ERROR',
      message:
        'Permission denied or API key issue. Check your Gemini API key in Settings > Secrets.',
    };
  }

  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('offline')
  ) {
    return {
      code: 'NETWORK_ERROR',
      message:
        'Network connection failed. Please check your internet connection and click Retry.',
    };
  }

  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return {
      code: 'RATE_LIMIT',
      message: 'Rate limit reached (429). Please wait a few seconds and click Retry.',
    };
  }

  if (lower.includes('safety') || lower.includes('blocked')) {
    return {
      code: 'BLOCKED',
      message:
        'This response was blocked by safety filters. Try rephrasing your prompt and retry.',
    };
  }

  return {
    code: 'API_ERROR',
    message: raw && raw.length < 220 ? raw : 'Unable to complete response. Click Retry to try again.',
  };
}

export interface ParsedSSEEvent {
  type: 'chunk' | 'done' | 'error';
  text?: string;
  code?: ErrorCode;
  message?: string;
}

/**
 * Pure incremental Server-Sent Events parser that safely handles arbitrary chunk splits.
 */
export function parseSSEBuffer(buffer: string): {
  events: ParsedSSEEvent[];
  remaining: string;
} {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const remaining = blocks.pop() ?? '';
  const events: ParsedSSEEvent[] = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const jsonPart = line.slice(5).trim();
        if (!jsonPart) continue;
        try {
          const parsed = JSON.parse(jsonPart) as ParsedSSEEvent;
          if (parsed && typeof parsed.type === 'string') {
            events.push(parsed);
          }
        } catch {
          // Ignore malformed partial frame
        }
      }
    }
  }

  return { events, remaining };
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
