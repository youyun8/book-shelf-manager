import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Account } from '../lib/api';
import { IconBooks, IconSpinner } from './icons';

type Mode = 'login' | 'register' | 'forgot';

interface LoginScreenProps {
  onSignedIn: (account: Account) => void;
}

/** Reads the token out of the reset link and takes it out of the address bar. */
function useResetToken(): [string, () => void] {
  const [token, setToken] = useState(
    () => new URLSearchParams(window.location.search).get('reset') ?? '',
  );
  const clear = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setToken('');
  };
  return [token, clear];
}

/** The only screen an anonymous visitor can reach. No book data is fetched here. */
export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [resetToken, clearResetToken] = useResetToken();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const title = useMemo(() => {
    if (resetToken !== '') return '設定新密碼';
    if (mode === 'forgot') return '忘記密碼';
    return '請先登入才能查看共用書單';
  }, [mode, resetToken]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (resetToken !== '') {
        if (password !== confirmation) {
          setError('兩次輸入的密碼不一樣。');
          return;
        }
        await api.resetPassword(resetToken, password);
        clearResetToken();
        setPassword('');
        setConfirmation('');
        setMode('login');
        setNotice('密碼已更新，請用新密碼登入。');
        return;
      }

      if (mode === 'forgot') {
        const { message } = await api.forgotPassword(email);
        setNotice(message);
        return;
      }

      const { user } =
        mode === 'login' ? await api.login(email, password) : await api.register(email, password);
      onSignedIn(user);
      return;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失敗，請再試一次。');
    } finally {
      setBusy(false);
    }
  };

  const submitLabel =
    resetToken !== ''
      ? '更新密碼'
      : mode === 'forgot'
        ? '寄出重設連結'
        : mode === 'login'
          ? '登入'
          : '建立帳號';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-fg">
            <IconBooks className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-fg">藏書庫存管理</h1>
            <p className="mt-1 text-sm text-fg-muted">{title}</p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card"
        >
          {resetToken === '' && mode !== 'forgot' && (
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
                  onClick={() => switchMode(option.value)}
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
          )}

          {resetToken === '' && (
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
          )}

          {mode !== 'forgot' && (
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium text-fg-muted">
                {resetToken === '' ? '密碼' : '新密碼'}
              </label>
              <input
                id="password"
                type="password"
                autoComplete={
                  mode === 'login' && resetToken === '' ? 'current-password' : 'new-password'
                }
                required
                minLength={mode === 'login' && resetToken === '' ? undefined : 10}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field"
                placeholder={mode === 'login' && resetToken === '' ? '' : '至少 10 個字元'}
              />
            </div>
          )}

          {resetToken !== '' && (
            <div>
              <label
                htmlFor="confirmation"
                className="mb-1 block text-xs font-medium text-fg-muted"
              >
                再輸入一次新密碼
              </label>
              <input
                id="confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="field"
              />
            </div>
          )}

          {notice !== '' && (
            <p className="rounded-lg border border-line bg-accent-soft px-3 py-2 text-xs text-accent">
              {notice}
            </p>
          )}
          {error !== '' && (
            <p className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs text-fg">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy && <IconSpinner className="h-4 w-4" />}
            {submitLabel}
          </button>

          {resetToken !== '' ? (
            <button
              type="button"
              onClick={() => {
                clearResetToken();
                switchMode('login');
              }}
              className="focus-ring w-full rounded text-center text-xs text-fg-subtle hover:text-accent"
            >
              返回登入
            </button>
          ) : mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="focus-ring w-full rounded text-center text-xs text-fg-subtle hover:text-accent"
            >
              返回登入
            </button>
          ) : (
            <div className="space-y-2 text-center text-xs">
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="focus-ring rounded text-fg-subtle hover:text-accent"
                >
                  忘記密碼？
                </button>
              )}
              <p className="text-fg-subtle">
                {mode === 'login'
                  ? '第一次使用請先點「註冊」建立密碼。'
                  : '只有在允許名單中的 Email 才能註冊。'}
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
