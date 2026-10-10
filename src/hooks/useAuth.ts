import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';

function describeAuthError(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return 'Anonymous sign-in is turned off. In the Firebase console, open Authentication > Sign-in method and enable Anonymous.';
  }
  if (code === 'auth/invalid-api-key' || code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
    return 'The Firebase API key in your .env file is not valid.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Could not reach Firebase. Check your internet connection.';
  }
  return err instanceof Error ? err.message : 'Sign-in failed.';
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (cancelled) return;
      setUser(u);
      if (u) setLoading(false);
    });

    // Wait until any saved session is restored, then sign in only if needed.
    auth
      .authStateReady()
      .then(() => (auth.currentUser ? undefined : signInAnonymously(auth)))
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((err: unknown) => {
        console.error('Auth error:', err);
        if (!cancelled) {
          setError(describeAuthError(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { user, loading, error };
}
