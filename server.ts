import 'dotenv/config';
import http from 'http';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import type { Content, GenerateContentResponse, Part } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_MODELS = new Set([
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-4-argon',
]);

const DEFAULT_MODEL = 'gemini-flash-latest';

const DEFAULT_SYSTEM_INSTRUCTION =
  "You are DEFAULTER AI, a helpful, honest and friendly AI assistant. Answer clearly and concisely in the user's language. If the user writes in Hinglish, reply in Hinglish. Use markdown for formatting and code.";

interface IncomingAttachment {
  mimeType: string;
  data: string;
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: IncomingAttachment[];
}

interface StreamChatBody {
  messages?: IncomingMessage[];
  model?: string;
  temperature?: number;
  systemInstruction?: string;
  detectedLanguage?: 'hi' | 'hinglish' | 'en';
}

function getGeminiClient(maxAttempts = 1): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('API_KEY_MISSING: Gemini API key is not configured in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      retryOptions: {
        attempts: maxAttempts,
        initialDelay: 0.4,
        maxDelay: 1.5,
      },
    },
  });
}

function mapErrorDetails(err: unknown, requestedModel: string): {
  status: number;
  code: 'RATE_LIMIT' | 'BLOCKED' | 'AUTH_ERROR' | 'NETWORK_ERROR' | 'API_ERROR';
  message: string;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const upper = raw.toUpperCase();

  if (
    upper.includes('429') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('QUOTA') ||
    upper.includes('TOO MANY REQUESTS')
  ) {
    const isPro = requestedModel === 'gemini-4-argon';
    return {
      status: 429,
      code: 'RATE_LIMIT',
      message: isPro
        ? 'Rate limit or quota reached for Gemini Pro. Upgrading to a billing-enabled API key in Settings > Secrets increases quota, or you can switch to Gemini Flash.'
        : 'You have hit the Gemini API rate limit (429). Please wait a few seconds and click Retry.',
    };
  }

  if (
    upper.includes('SAFETY') ||
    upper.includes('BLOCKED') ||
    upper.includes('PROHIBITED_CONTENT') ||
    upper.includes('BLOCKLIST') ||
    upper.includes('RECITATION')
  ) {
    return {
      status: 400,
      code: 'BLOCKED',
      message:
        'This response was blocked by safety filters. Try rephrasing your prompt and sending again.',
    };
  }

  if (
    upper.includes('API_KEY_MISSING') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('403') ||
    upper.includes('UNAUTHENTICATED')
  ) {
    const isPro = requestedModel === 'gemini-4-argon';
    return {
      status: 403,
      code: 'AUTH_ERROR',
      message: isPro
        ? 'Gemini Pro requires a billing-enabled API key in the Settings > Secrets panel, or switch to Gemini Flash.'
        : 'API key error or permission denied. Please verify your Gemini API key in the Settings > Secrets panel.',
    };
  }

  if (
    upper.includes('FETCH FAILED') ||
    upper.includes('ECONNRESET') ||
    upper.includes('ETIMEDOUT') ||
    upper.includes('ENOTFOUND') ||
    upper.includes('NETWORK')
  ) {
    return {
      status: 503,
      code: 'NETWORK_ERROR',
      message: 'Network error while reaching Gemini. Check your connection and click Retry.',
    };
  }

  if (
    upper.includes('503') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED')
  ) {
    return {
      status: 503,
      code: 'API_ERROR',
      message:
        'This Gemini model is temporarily experiencing high demand (503). Please click Retry in a moment.',
    };
  }

  return {
    status: 500,
    code: 'API_ERROR',
    message: 'Something went wrong while generating a response. Please try again.',
  };
}

function isTransientOverloadError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  const upper = raw.toUpperCase();
  return (
    upper.includes('503') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED') ||
    upper.includes('429') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('404') ||
    upper.includes('NOT_FOUND')
  );
}

function buildCandidateModels(requestedModel: string): string[] {
  if (requestedModel === 'gemini-flash-latest' || requestedModel === 'gemini-3.8-flash') {
    return [
      requestedModel,
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.6-flash',
    ];
  }
  if (requestedModel === 'gemini-3.1-flash-lite') {
    return [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3-flash-preview',
      'gemini-3.6-flash',
    ];
  }
  return [requestedModel];
}

function buildEffectiveSystemInstruction(
  baseInstruction: string | undefined,
  detectedLanguage: 'hi' | 'hinglish' | 'en' | undefined,
): string {
  const trimmed = baseInstruction?.trim() || DEFAULT_SYSTEM_INSTRUCTION;
  if (detectedLanguage === 'hi') {
    return `${trimmed}\n\n[Language context: The user's latest message is in Hindi (Devanagari). Reply naturally in Hindi unless they explicitly ask for another language.]`;
  }
  if (detectedLanguage === 'hinglish') {
    return `${trimmed}\n\n[Language context: The user's latest message is in Hinglish (conversational Hindi-English mix in Roman script). Reply naturally in Hinglish using Roman script unless they explicitly ask for another language.]`;
  }
  return trimmed;
}

function resolvePort(): number {
  const portFlagIdx = process.argv.indexOf('--port');
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const cliPort = Number(process.argv[portFlagIdx + 1]);
    if (!Number.isNaN(cliPort) && cliPort > 0) {
      return cliPort;
    }
  }
  return Number(process.env.PORT) || 3000;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = resolvePort();

  app.use('/api', (req: Request, res: Response, next) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/chat/stream', async (req: Request, res: Response) => {
    const body = (req.body || {}) as StreamChatBody;
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const model =
      typeof body.model === 'string' && ALLOWED_MODELS.has(body.model)
        ? body.model
        : DEFAULT_MODEL;
    const temperature =
      typeof body.temperature === 'number' && !Number.isNaN(body.temperature)
        ? Math.min(2, Math.max(0, body.temperature))
        : 0.7;

    if (rawMessages.length === 0) {
      res.status(400).json({
        code: 'API_ERROR',
        message: 'Conversation history cannot be empty.',
      });
      return;
    }

    const contents: Content[] = [];
    for (const msg of rawMessages) {
      const parts: Part[] = [];
      if (Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          if (att?.data && att?.mimeType) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data,
              },
            });
          }
        }
      }
      if (typeof msg.content === 'string' && msg.content.trim().length > 0) {
        parts.push({ text: msg.content });
      } else if (parts.length > 0 && msg.role === 'user') {
        parts.push({ text: 'Please analyze this image.' });
      }

      if (parts.length > 0) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        });
      }
    }

    if (contents.length === 0) {
      res.status(400).json({
        code: 'API_ERROR',
        message: 'Please enter a message or attach an image.',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const clientAbortController = new AbortController();
    let clientDisconnected = false;
    const markDisconnected = () => {
      if (!res.writableEnded && !clientDisconnected) {
        clientDisconnected = true;
        clientAbortController.abort();
      }
    };
    res.on('close', markDisconnected);
    res.on('error', markDisconnected);

    const writeSSE = (payload: Record<string, unknown>) => {
      if (!clientDisconnected && !res.writableEnded) {
        try {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch {
          markDisconnected();
        }
      }
    };

    try {
      const systemInstruction = buildEffectiveSystemInstruction(
        body.systemInstruction,
        body.detectedLanguage,
      );

      const candidateModels = buildCandidateModels(model);

      let emittedAnyText = false;
      let blockedReason: string | undefined;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
        if (clientDisconnected) {
          break;
        }

        const targetModel = candidateModels[attempt];
        const hasFallback = attempt < candidateModels.length - 1;
        const ai = getGeminiClient(hasFallback ? 1 : 2);
        lastError = null;
        blockedReason = undefined;

        const attemptAbort = new AbortController();
        const onClientAbort = () => attemptAbort.abort();
        clientAbortController.signal.addEventListener('abort', onClientAbort, { once: true });

        let timedOutWaitingForFirstToken = false;
        const firstTokenTimer = hasFallback
          ? setTimeout(() => {
              if (!emittedAnyText) {
                timedOutWaitingForFirstToken = true;
                attemptAbort.abort();
              }
            }, 3200)
          : null;

        try {
          const stream = await ai.models.generateContentStream({
            model: targetModel,
            contents,
            config: {
              systemInstruction,
              temperature,
              abortSignal: attemptAbort.signal,
            },
          });

          for await (const rawChunk of stream) {
            if (clientDisconnected) {
              break;
            }
            const chunk = rawChunk as GenerateContentResponse;

            const promptBlock = chunk.promptFeedback?.blockReason;
            const finishReason = chunk.candidates?.[0]?.finishReason;

            if (promptBlock) {
              blockedReason = String(promptBlock);
              break;
            }

            if (
              finishReason &&
              ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION'].includes(
                String(finishReason),
              )
            ) {
              blockedReason = String(finishReason);
              break;
            }

            const textPiece = chunk.text;
            if (textPiece) {
              if (firstTokenTimer) {
                clearTimeout(firstTokenTimer);
              }
              emittedAnyText = true;
              writeSSE({ type: 'chunk', text: textPiece });
            }
          }

          if (firstTokenTimer) {
            clearTimeout(firstTokenTimer);
          }
          clientAbortController.signal.removeEventListener('abort', onClientAbort);
          break;
        } catch (streamErr) {
          if (firstTokenTimer) {
            clearTimeout(firstTokenTimer);
          }
          clientAbortController.signal.removeEventListener('abort', onClientAbort);

          if (clientDisconnected) {
            break;
          }

          lastError = streamErr;
          const canFallback =
            !emittedAnyText &&
            hasFallback &&
            (timedOutWaitingForFirstToken || isTransientOverloadError(streamErr));
          if (canFallback) {
            continue;
          }
          throw streamErr;
        }
      }

      if (lastError && !clientDisconnected) {
        throw lastError;
      }

      if (clientDisconnected) {
        if (!res.writableEnded) {
          res.end();
        }
        return;
      }

      if (blockedReason) {
        writeSSE({
          type: 'error',
          code: 'BLOCKED',
          message:
            'This response was stopped by safety filters. Please try rephrasing your message.',
        });
      } else if (!emittedAnyText) {
        writeSSE({
          type: 'error',
          code: 'BLOCKED',
          message:
            'No response could be generated for this prompt (it may have been filtered). Please rephrase and retry.',
        });
      } else {
        writeSSE({ type: 'done' });
      }

      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      const mapped = mapErrorDetails(err, model);
      writeSSE({
        type: 'error',
        code: mapped.code,
        message: mapped.message,
      });
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
