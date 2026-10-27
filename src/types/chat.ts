export type ModelId = 'gemini-flash-latest' | 'gemini-3.1-flash-lite' | 'gemini-4-argon';

export type VoiceLang = 'en-IN' | 'hi-IN';

export type ThemeMode = 'light' | 'dark';

export type ErrorCode =
  | 'RATE_LIMIT'
  | 'BLOCKED'
  | 'AUTH_ERROR'
  | 'NETWORK_ERROR'
  | 'BACKEND_REQUIRED'
  | 'API_ERROR';

export interface ImageAttachment {
  id: string;
  name: string;
  mimeType: string;
  /** Raw base64 payload without data URL prefix */
  data: string;
  /** Full data URL for fast preview rendering */
  previewUrl: string;
}

export interface ChatError {
  code: ErrorCode;
  message: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: ImageAttachment[];
  createdAt: number;
  model?: ModelId;
  error?: ChatError;
}

export interface ChatSession {
  id: string;
  title: string;
  isCustomTitle?: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface AppSettings {
  model: ModelId;
  temperature: number;
  systemInstruction: string;
  voiceLang: VoiceLang;
  apiBaseUrl?: string;
}

export interface ModelOption {
  id: ModelId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface SuggestionChip {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
}
