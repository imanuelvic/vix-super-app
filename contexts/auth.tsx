import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { clearLiveCache } from '@/lib/liveDoc';

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

// Belum ada .env (mis. repo ini baru di-clone orang lain). Firebase Auth
// TIDAK boleh disentuh sama sekali dalam keadaan ini — lihat lib/firebase.ts.
class NotConfiguredError extends Error {
  code = 'auth/not-configured';
  constructor() {
    super('Firebase belum dikonfigurasi. Isi .env dengan proyek Firebase-mu sendiri.');
  }
}

/** Auth yang dijamin ada; melempar pesan jelas kalau .env belum diisi. */
function requireAuth() {
  if (!auth) throw new NotConfiguredError();
  return auth;
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
  // Tanpa konfigurasi tidak ada sesi apa pun yang bisa dipulihkan, jadi tidak
  // ada yang perlu ditunggu — layar Login langsung tampil beserta pesan
  // "belum dikonfigurasi". (Nilai awal, bukan setState di dalam efek.)
  const [initializing, setInitializing] = useState(isFirebaseConfigured);

  useEffect(() => {
    const a = auth;
    if (!a) return;
    // Dipanggil sekali saat start (dari sesi tersimpan), lalu tiap login/logout.
    const unsubscribe = onAuthStateChanged(a, async (nextUser) => {
      // Pertahanan: kalau sesi tersimpan ternyata bukan pemilik, paksa keluar.
      if (nextUser && !isOwner(nextUser)) {
        await signOut(a);
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
        const a = requireAuth();
        await signInWithEmailAndPassword(a, email.trim(), password);
        if (!isOwner(a.currentUser)) {
          await signOut(a);
          throw new NotOwnerError();
        }
      },
      signUp: async (email, password) => {
        const a = requireAuth();
        // Cegah pembuatan akun selain email pemilik.
        if (OWNER_EMAIL && email.trim().toLowerCase() !== OWNER_EMAIL) {
          throw new NotOwnerError();
        }
        await createUserWithEmailAndPassword(a, email.trim(), password);
      },
      logout: async () => {
        // Bersihkan simpanan dokumen di HP dulu — jangan sampai data akun lama
        // tertinggal di disk/memori setelah keluar.
        await clearLiveCache();
        if (auth) await signOut(auth);
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
