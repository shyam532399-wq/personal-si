import type { AppSettings, ModelOption, SuggestionChip } from '../types/chat';

export const DEFAULT_SYSTEM_INSTRUCTION =
  "You are a helpful, honest and friendly AI assistant. Answer clearly and concisely in the user's language. If the user writes in Hinglish, reply in Hinglish. Use markdown for formatting and code.";

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-flash-latest',
    label: 'Gemini Flash',
    shortLabel: 'Flash',
    description: 'Fast, responsive multimodal model for everyday tasks',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini Flash Lite',
    shortLabel: 'Flash Lite',
    description: 'Ultra-low latency model with high availability',
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini Pro',
    shortLabel: 'Pro',
    description: 'Deep reasoning, coding, and complex STEM problem solving',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  model: 'gemini-flash-latest',
  temperature: 0.7,
  systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
  voiceLang: 'en-IN',
};

export const SUGGESTION_CHIPS: SuggestionChip[] = [
  {
    id: 'explain-quantum',
    title: 'Explain a complex topic',
    subtitle: 'How transformers work in plain terms',
    prompt:
      'Explain how modern Transformer neural networks work in clear, intuitive terms with a quick summary table of key components.',
  },
  {
    id: 'hinglish-roadmap',
    title: 'Plan in Hinglish',
    subtitle: 'Full-stack web dev 4-week study plan',
    prompt:
      'Mujhe React, TypeScript aur Node.js master karne ke liye ek practical 4-week daily roadmap bana kar do.',
  },
  {
    id: 'write-code',
    title: 'Write clean TypeScript',
    subtitle: 'Debounced search hook with abort support',
    prompt:
      'Write a clean, reusable TypeScript React hook `useDebouncedSearch` that cancels stale fetch requests with AbortController and handles loading and error states.',
  },
  {
    id: 'compare-table',
    title: 'Compare technologies',
    subtitle: 'PostgreSQL vs MongoDB architecture table',
    prompt:
      'Compare PostgreSQL and MongoDB in a detailed Markdown table covering data model, ACID transactions, indexing, scaling, and ideal use cases.',
  },
];
