import { useSession } from './hooks/useSession';
import { LoginScreen } from './components/LoginScreen';
import { Library } from './components/Library';
import { IconSpinner } from './components/icons';

export default function App() {
  const { state, signedIn, signOut, expire } = useSession();

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-fg-subtle">
        <IconSpinner className="h-6 w-6" />
      </div>
    );
  }

  if (state.status === 'signedOut') {
    return <LoginScreen onSignedIn={signedIn} />;
  }

  return <Library account={state.account} onSignOut={signOut} onExpire={expire} />;
}
