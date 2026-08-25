import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  passwordProblem,
  verifyPassword,
} from './auth';

describe('password hashing', () => {
  it('round-trips a password and rejects the wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(stored.startsWith('pbkdf2$')).toBe(true);
    await expect(verifyPassword('correct horse battery', stored)).resolves.toBe(true);
    await expect(verifyPassword('correct horse batter', stored)).resolves.toBe(false);
  });

  it('salts every hash, so two identical passwords differ on disk', async () => {
    const first = await hashPassword('same password here');
    const second = await hashPassword('same password here');
    expect(first).not.toBe(second);
  });

  it('rejects a stored value it cannot read', async () => {
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('anything', '')).resolves.toBe(false);
  });

  it('records the iteration count, so it can be raised without lock-outs', async () => {
    const stored = await hashPassword('another password');
    const [, iterations] = stored.split('$');
    expect(Number(iterations)).toBeGreaterThanOrEqual(25_000);
  });
});

describe('email handling', () => {
  it('normalizes case and spacing', () => {
    expect(normalizeEmail('  Reader@Example.COM ')).toBe('reader@example.com');
  });

  it('accepts real addresses and rejects nonsense', () => {
    expect(isValidEmail('reader@example.com')).toBe(true);
    expect(isValidEmail('reader@example')).toBe(false);
    expect(isValidEmail('not an email')).toBe(false);
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false);
  });
});

describe('passwordProblem', () => {
  it('requires a length people cannot guess', () => {
    expect(passwordProblem('short')).toMatch(/10/);
    expect(passwordProblem('long enough password')).toBeNull();
  });
});
