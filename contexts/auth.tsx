import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { auth } from '@/lib/firebase';

// Hanya email pemilik yang boleh masuk. Kalau env kosong, gate dimatikan
// (Security Rules Firestore tetap jadi lapisan pertahanan utama).
const OWNER_EMAIL = (process.env.EXPO_PUBLIC_OWNER_EMAIL ?? '').trim().toLowerCase();

function isOwner(user: User | null): boolean {
  if (!OWNER_EMAIL) return true;
  return !!user && (user.email ?? '').trim().toLowerCase() === OWNER_EMAIL;
}

class NotOwnerError extends Error {
  code = 'auth/not-owner';
  constructor() {
    super('Akun ini tidak diizinkan mengakses aplikasi.');
  }
}

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Dipanggil sekali saat start (dari sesi tersimpan), lalu tiap login/logout.
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      // Pertahanan: kalau sesi tersimpan ternyata bukan pemilik, paksa keluar.
      if (nextUser && !isOwner(nextUser)) {
        await signOut(auth);
        setUser(null);
        setInitializing(false);
        return;
      }
      setUser(nextUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        if (!isOwner(auth.currentUser)) {
          await signOut(auth);
          throw new NotOwnerError();
        }
      },
      signUp: async (email, password) => {
        // Cegah pembuatan akun selain email pemilik.
        if (OWNER_EMAIL && email.trim().toLowerCase() !== OWNER_EMAIL) {
          throw new NotOwnerError();
        }
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      },
      logout: async () => {
        await signOut(auth);
      },
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  }
  return context;
}
