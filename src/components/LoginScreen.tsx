import { useState } from 'react';
import { api } from '../lib/api';
import type { Account } from '../lib/api';
import { IconBooks, IconSpinner } from './icons';

type Mode = 'login' | 'register';

interface LoginScreenProps {
  onSignedIn: (account: Account) => void;
}

/** The only screen an anonymous visitor can reach. No book data is fetched here. */
export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { user } =
        mode === 'login' ? await api.login(email, password) : await api.register(email, password);
      onSignedIn(user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登入失敗，請再試一次。');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-fg">
            <IconBooks className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-fg">藏書庫存管理</h1>
            <p className="mt-1 text-sm text-fg-muted">請先登入才能查看共用書單</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card"
        >
          <div className="flex rounded-lg border border-line bg-surface-muted p-0.5 text-sm">
            {(
              [
                { value: 'login' as const, label: '登入' },
                { value: 'register' as const, label: '註冊' },
              ] satisfies { value: Mode; label: string }[]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setMode(option.value);
                  setError('');
                }}
                className={`focus-ring flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                  mode === option.value
                    ? 'bg-surface text-fg shadow-sm'
                    : 'text-fg-subtle hover:text-fg'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-fg-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-fg-muted">
              密碼
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 10 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field"
              placeholder={mode === 'register' ? '至少 10 個字元' : ''}
            />
          </div>

          {error !== '' && (
            <p className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-fg">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy && <IconSpinner className="h-4 w-4" />}
            {mode === 'login' ? '登入' : '建立帳號'}
          </button>

          <p className="text-center text-xs text-fg-subtle">
            {mode === 'login'
              ? '第一次使用請先點「註冊」建立密碼。'
              : '只有在允許名單中的 Email 才能註冊。'}
          </p>
        </form>
      </div>
    </div>
  );
}
