import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env.d';
import { resetEmailHtml, resetEmailText, sendResetEmail } from './mail';

const INPUT = {
  to: 'reader@example.com',
  link: 'https://books.example.com/?reset=abc&x=1',
  minutes: 60,
};

function env(overrides: Partial<Env> = {}): Env {
  return { ...(overrides as Env) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('reset email body', () => {
  it('carries the link and the deadline', () => {
    const text = resetEmailText(INPUT);
    expect(text).toContain(INPUT.link);
    expect(text).toContain('60 分鐘');
  });

  it('escapes the link when writing it into HTML', () => {
    const html = resetEmailHtml(INPUT);
    expect(html).toContain('reset=abc&amp;x=1');
    expect(html).not.toContain('reset=abc&x=1');
  });
});

describe('sendResetEmail', () => {
  it('logs the link and reports the gap when no API key is set', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(sendResetEmail(env(), INPUT)).resolves.toBe('not-configured');
    expect(log.mock.calls[0]?.[0]).toContain(INPUT.link);
  });

  it('posts to Resend with the configured sender', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendResetEmail(env({ RESEND_API_KEY: 'key', MAIL_FROM: '書單 <books@example.com>' }), INPUT),
    ).resolves.toBe('sent');

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key');
    const payload = JSON.parse(String(init.body)) as { from: string; to: string[]; text: string };
    expect(payload.from).toBe('書單 <books@example.com>');
    expect(payload.to).toEqual([INPUT.to]);
    expect(payload.text).toContain(INPUT.link);
  });

  it('throws when Resend rejects the send', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('domain not verified', { status: 403 })),
    );
    await expect(sendResetEmail(env({ RESEND_API_KEY: 'key' }), INPUT)).rejects.toThrow(/403/);
  });
});
