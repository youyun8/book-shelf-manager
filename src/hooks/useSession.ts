import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Account } from '../lib/api';

export type SessionState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; account: Account };

/** Tracks who is signed in. The cookie itself is HttpOnly and never read here. */
export function useSession() {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    api
      .session()
      .then(({ user }) => {
        if (cancelled) return;
        setState(user ? { status: 'signedIn', account: user } : { status: 'signedOut' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'signedOut' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signedIn = useCallback((account: Account) => {
    setState({ status: 'signedIn', account });
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setState({ status: 'signedOut' });
  }, []);

  /** Called when any request comes back 401, so the app returns to the login screen. */
  const expire = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      setState({ status: 'signedOut' });
      return true;
    }
    return false;
  }, []);

  return { state, signedIn, signOut, expire };
}
