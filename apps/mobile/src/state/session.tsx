import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StorageKeys, getJson, removeItem, setJson } from '../lib/storage';
import {
  ApiError,
  authenticate,
  getConsent,
  getProfile,
  loadTokens,
  logout as apiLogout,
  saveTokens,
  setAuthLostHandler,
  updateProfile as apiUpdateProfile,
} from '../lib/api';
import { releasePushToken, registerForPushNotifications, ensureAndroidChannel } from '../lib/notifications';
import { stopBackgroundTracking } from '../lib/locationTask';
import type { AuthUser, TrustedContact } from '../types';

interface SessionValue {
  user: AuthUser | null;
  restoring: boolean;
  trustedContacts: TrustedContact[];
  demoMode: boolean;
  /** Null while unknown; false when consent for the current terms is missing. */
  consentCurrent: boolean | null;
  termsVersion: string;
  refreshConsent: () => Promise<void>;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  signUp: (payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    address: string;
    trustedContacts: TrustedContact[];
  }) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (changes: Partial<AuthUser>) => Promise<void>;
  setTrustedContacts: (contacts: TrustedContact[]) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [trustedContacts, setTrustedContacts] = useState<TrustedContact[]>([]);
  const [restoring, setRestoring] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [consentCurrent, setConsentCurrent] = useState<boolean | null>(null);
  const [termsVersion, setTermsVersion] = useState('');
  const signingOut = useRef(false);
  // Read during sign-out, after `user` state has already been cleared.
  const currentUserId = useRef<string | number | undefined>(undefined);
  currentUserId.current = user?.id;

  const refreshConsent = useCallback(async () => {
    const status = await getConsent().catch(() => null);
    if (!status) {
      // Unknown rather than "not consented": failing open here would re-prompt
      // on every network blip, and failing closed would lock the user out.
      setConsentCurrent(null);
      return;
    }
    setConsentCurrent(status.current);
    setTermsVersion(status.termsVersion);
  }, []);

  const clearLocalSession = useCallback(async () => {
    setUser(null);
    setTrustedContacts([]);
    setConsentCurrent(null);
    await removeItem(StorageKeys.session);
    await removeItem(StorageKeys.safety);
  }, []);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      // Detach this device before the token is discarded, and stop monitoring
      // so a signed-out phone is not still reporting its position.
      await releasePushToken().catch(() => undefined);
      await stopBackgroundTracking().catch(() => undefined);
      // The user ID lets the server pause monitoring, so a deliberately
      // signed-out phone is not escalated for going quiet.
      await apiLogout(currentUserId.current).catch(() => undefined);
      await clearLocalSession();
    } finally {
      signingOut.current = false;
    }
  }, [clearLocalSession]);

  // When a refresh fails the tokens are gone, so drop the UI session too
  // instead of leaving the app showing stale data it can no longer refresh.
  useEffect(() => {
    setAuthLostHandler(() => {
      void clearLocalSession();
    });
    return () => setAuthLostHandler(undefined);
  }, [clearLocalSession]);

  const afterAuthenticated = useCallback(async (nextUser: AuthUser, contacts: TrustedContact[], demo: boolean) => {
    setUser(nextUser);
    setTrustedContacts(contacts);
    setDemoMode(demo);
    await setJson(StorageKeys.session, nextUser);
    await ensureAndroidChannel().catch(() => undefined);
    // Best-effort: push is unavailable in Expo Go on Android and before
    // `eas init`, neither of which should block sign-in.
    void registerForPushNotifications().catch(() => undefined);
    await refreshConsent();
  }, [refreshConsent]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [storedUser, tokens] = await Promise.all([
          getJson<AuthUser>(StorageKeys.session),
          loadTokens(),
        ]);

        if (cancelled) return;

        // A cached user without tokens cannot talk to the API, so treat it as
        // signed out rather than showing a shell that 401s on every request.
        if (!storedUser || !tokens?.accessToken) {
          if (storedUser) await removeItem(StorageKeys.session);
          return;
        }

        setUser(storedUser);
        setTrustedContacts([]);

        // Revalidate against the server; token refresh happens transparently.
        const fresh = await getProfile().catch((error: unknown) => {
          const status = error instanceof ApiError ? error.status : 0;
          // 401/404 means the account is genuinely gone, not that the network
          // blipped. Keeping the cached user there would leave the app looking
          // signed in while every request failed.
          return status === 401 || status === 404 ? 'gone' : null;
        });

        if (cancelled) return;

        if (fresh === 'gone') {
          await saveTokens(null);
          await clearLocalSession();
          return;
        }

        if (fresh?.user) {
          setUser(fresh.user);
          await setJson(StorageKeys.session, fresh.user);
        }
        if (!cancelled) {
          await ensureAndroidChannel().catch(() => undefined);
          void registerForPushNotifications().catch(() => undefined);
          await refreshConsent();
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const result = await authenticate({ mode: 'login', email, password });
      await afterAuthenticated(result.user, result.trustedContacts ?? [], Boolean(result.demo));
    },
    [afterAuthenticated]
  );

  const signUp = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      phone: string;
      address: string;
      trustedContacts: TrustedContact[];
    }) => {
      const result = await authenticate({ mode: 'register', ...payload });
      await afterAuthenticated(result.user, result.trustedContacts ?? payload.trustedContacts, Boolean(result.demo));
    },
    [afterAuthenticated]
  );

  const updateUser = useCallback(async (changes: Partial<AuthUser>) => {
    const result = await apiUpdateProfile(changes);
    setUser(result.user);
    await setJson(StorageKeys.session, result.user);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      restoring,
      trustedContacts,
      demoMode,
      consentCurrent,
      termsVersion,
      refreshConsent,
      signIn,
      signUp,
      signOut,
      updateUser,
      setTrustedContacts,
    }),
    [
      user, restoring, trustedContacts, demoMode, consentCurrent, termsVersion,
      refreshConsent, signIn, signUp, signOut, updateUser,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside a SessionProvider.');
  return context;
}
