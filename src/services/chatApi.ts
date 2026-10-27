import type { AppSettings, ChatError, ChatMessage } from '../types/chat';
import {
  buildApiHistoryPayload,
  classifyClientError,
  detectUserLanguage,
  parseSSEBuffer,
  resolveApiEndpoint,
} from '../utils/chatUtils';

export interface StreamCallbacks {
  onChunk: (textChunk: string) => void;
  onError: (error: ChatError) => void;
  onComplete: () => void;
}

export async function streamChatCompletion(
  history: ChatMessage[],
  settings: AppSettings,
  signal: AbortSignal,
  callbacks: StreamCallbacks,
): Promise<void> {
  const payloadMessages = buildApiHistoryPayload(history);
  const lastUserMessage = [...history].reverse().find((m) => m.role === 'user');
  const detectedLanguage = lastUserMessage
    ? detectUserLanguage(lastUserMessage.content)
    : 'en';

  const envBaseUrl =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof import.meta.env.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL
      : '';

  const endpoint = resolveApiEndpoint(
    '/api/chat/stream',
    settings.apiBaseUrl,
    envBaseUrl,
  );

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: payloadMessages,
        model: settings.model,
        temperature: settings.temperature,
        systemInstruction: settings.systemInstruction,
        detectedLanguage,
      }),
      signal,
    });
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      callbacks.onComplete();
      return;
    }
    callbacks.onError(classifyClientError(err));
    return;
  }

  if (!response.ok) {
    let errorData: Partial<ChatError> | null = null;
    try {
      errorData = (await response.json()) as Partial<ChatError>;
    } catch {
      // Fall back to status mapping
    }
    if (errorData?.message && errorData?.code) {
      callbacks.onError({
        code: errorData.code,
        message: errorData.message,
      });
    } else {
      callbacks.onError(
        classifyClientError(new Error(`Request failed (${response.status})`), response.status),
      );
    }
    return;
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('text/event-stream')) {
    callbacks.onError({
      code: 'BACKEND_REQUIRED',
      message: endpoint.startsWith('/')
        ? 'Backend server URL set nahi hai. Android APK mein chat chalane ke liye Settings khol kar apna deployed Backend Server URL (jaise https://your-app.onrender.com) save karein.'
        : 'Is Backend Server URL se valid chat stream nahi mili (HTML page mila). Kripya Settings mein apna public deployed Backend URL check karein.',
    });
    return;
  }

  if (!response.body) {
    callbacks.onError({
      code: 'API_ERROR',
      message: 'Streaming response body was unavailable. Click Retry to try again.',
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let terminatedWithError = false;
  let receivedAnyChunk = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
      } else {
        buffer += decoder.decode(value, { stream: true });
      }

      const { events, remaining } = parseSSEBuffer(buffer);
      buffer = remaining;

      for (const evt of events) {
        if (evt.type === 'chunk' && evt.text) {
          receivedAnyChunk = true;
          callbacks.onChunk(evt.text);
        } else if (evt.type === 'error') {
          terminatedWithError = true;
          callbacks.onError({
            code: evt.code || 'API_ERROR',
            message: evt.message || 'An error occurred while generating the response.',
          });
          return;
        } else if (evt.type === 'done') {
          callbacks.onComplete();
          return;
        }
      }

      if (done) {
        break;
      }
    }

    if (!terminatedWithError) {
      if (!receivedAnyChunk && !signal.aborted) {
        callbacks.onError({
          code: 'NETWORK_ERROR',
          message: 'The response stream closed before any text arrived. Click Retry to try again.',
        });
      } else {
        callbacks.onComplete();
      }
    }
  } catch (err) {
    if (signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      callbacks.onComplete();
      return;
    }
    callbacks.onError(classifyClientError(err));
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader already released
    }
  }
}
