import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApiHistoryPayload,
  classifyClientError,
  detectUserLanguage,
  generateAutoTitle,
  parseSSEBuffer,
  prepareEditAndResendHistory,
  prepareRegenerateHistory,
} from './chatUtils';
import type { ChatMessage } from '../types/chat';

test('detectUserLanguage identifies English, Hindi (Devanagari), and Hinglish accurately', () => {
  assert.equal(detectUserLanguage('How do I optimize a PostgreSQL index?'), 'en');
  assert.equal(detectUserLanguage('मुझे पाइथन में लिस्ट कॉम्प्रिहेंशन समझाओ'), 'hi');
  assert.equal(
    detectUserLanguage('Mujhe React aur TypeScript seekhne ka roadmap batao'),
    'hinglish',
  );
  assert.equal(detectUserLanguage('Ye code kaise kaam karta hai bhai?'), 'hinglish');
});

test('generateAutoTitle strips markdown and truncates cleanly', () => {
  assert.equal(generateAutoTitle('  # **Explain Quantum Computing**  '), 'Explain Quantum Computing');
  assert.equal(generateAutoTitle('', true), 'Image analysis');
  assert.equal(generateAutoTitle('   ', false), 'New chat');

  const longTitle = generateAutoTitle(
    'Write a comprehensive production-ready guide to distributed systems consensus algorithms',
  );
  assert.ok(longTitle.endsWith('…'));
  assert.ok(longTitle.length <= 43);
});

test('buildApiHistoryPayload preserves multi-turn memory and drops empty failed assistant turns', () => {
  const messages: ChatMessage[] = [
    { id: '1', role: 'user', content: 'Hello there', createdAt: 100 },
    { id: '2', role: 'assistant', content: 'Hi! How can I help?', createdAt: 200 },
    {
      id: '3',
      role: 'user',
      content: 'Analyze this diagram',
      createdAt: 300,
      attachments: [
        {
          id: 'att1',
          name: 'diagram.png',
          mimeType: 'image/png',
          data: 'abc123base64',
          previewUrl: 'data:image/png;base64,abc123base64',
        },
      ],
    },
    {
      id: '4',
      role: 'assistant',
      content: '',
      createdAt: 400,
      error: { code: 'RATE_LIMIT', message: 'Rate limited' },
    },
  ];

  const payload = buildApiHistoryPayload(messages);
  assert.equal(payload.length, 3);
  assert.equal(payload[0].role, 'user');
  assert.equal(payload[1].role, 'assistant');
  assert.equal(payload[2].attachments?.[0].data, 'abc123base64');
});

test('prepareRegenerateHistory slices conversation back to preceding user prompt', () => {
  const messages: ChatMessage[] = [
    { id: 'u1', role: 'user', content: 'First question', createdAt: 1 },
    { id: 'a1', role: 'assistant', content: 'First answer', createdAt: 2 },
    { id: 'u2', role: 'user', content: 'Second question', createdAt: 3 },
    { id: 'a2', role: 'assistant', content: 'Second answer', createdAt: 4 },
  ];

  const sliced = prepareRegenerateHistory(messages, 'a2');
  assert.ok(sliced);
  assert.equal(sliced.length, 3);
  assert.equal(sliced[2].id, 'u2');
});

test('prepareEditAndResendHistory updates user message and truncates later turns', () => {
  const messages: ChatMessage[] = [
    { id: 'u1', role: 'user', content: 'Original prompt', createdAt: 1 },
    { id: 'a1', role: 'assistant', content: 'Original reply', createdAt: 2 },
    { id: 'u2', role: 'user', content: 'Follow up', createdAt: 3 },
  ];

  const updated = prepareEditAndResendHistory(messages, 'u1', 'Edited prompt');
  assert.ok(updated);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].content, 'Edited prompt');
});

test('parseSSEBuffer handles split TCP chunks without losing events', () => {
  const chunk1 = 'data: {"type":"chunk","text":"Namaste ';
  const res1 = parseSSEBuffer(chunk1);
  assert.equal(res1.events.length, 0);

  const chunk2 = `${res1.remaining}dost!"}\n\ndata: {"type":"done"}\n\n`;
  const res2 = parseSSEBuffer(chunk2);
  assert.equal(res2.events.length, 2);
  assert.equal(res2.events[0].text, 'Namaste dost!');
  assert.equal(res2.events[1].type, 'done');
  assert.equal(res2.remaining, '');
});

test('classifyClientError categorizes 429, network, and safety errors accurately', () => {
  assert.equal(classifyClientError(new Error('Quota exceeded'), 429).code, 'RATE_LIMIT');
  assert.equal(classifyClientError(new TypeError('Failed to fetch')).code, 'NETWORK_ERROR');
  assert.equal(classifyClientError(new Error('Blocked due to SAFETY')).code, 'BLOCKED');
});
