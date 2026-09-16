import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { useAuth } from '@/contexts/auth';
import { LOAD_ERROR } from '@/lib/messages';

/**
 * Bentuk semua `subscribeX` di lib/: (uid, onChange, onError) → fungsi lepas.
 * `onError`-nya boleh menerima FirestoreError atau tanpa argumen, boleh juga
 * tidak ada sama sekali (subscribeX yang tak pernah melapor galat).
 */
type Subscribe<T> = (
  uid: string,
  onChange: (next: T) => void,
  onError: () => void,
) => () => void;

/**
 * Langganan Firestore milik user yang sedang masuk — pengganti blok yang
 * sama persis di 20-an layar (16 Sep 2026):
 *
 *     const [list, setList] = useState<Promise[] | null>(null);
 *     useEffect(() => {
 *       if (!user) return;
 *       return subscribePromises(user.uid, setList, () => setError(LOAD_ERROR));
 *     }, [user]);
 * →
 *     const [list, setList] = useLive(subscribePromises, { onError: setError });
 *
 * `data` mulai `null` (= masih memuat) kecuali `initial` diberi (mis. `{}`
 * atau `[]` untuk layar yang tidak membedakan "memuat" dari "kosong").
 * `onError` menerima pesan LOAD_ERROR saat langganannya gagal; kosongkan kalau
 * layar memang tidak menampilkan galat muat.
 *
 * ⚠️ Berikan `subscribe` & `onError` yang STABIL (fungsi modul & `setError`
 * dari useState), bukan panah yang dibuat tiap render: keduanya dependency
 * efeknya, panah baru = berlangganan ulang tiap render.
 */
export function useLive<T>(
  subscribe: Subscribe<T>,
  opsi: { onError?: (message: string) => void; initial: T },
): [T, Dispatch<SetStateAction<T>>];
export function useLive<T>(
  subscribe: Subscribe<T>,
  opsi?: { onError?: (message: string) => void },
): [T | null, Dispatch<SetStateAction<T | null>>];
export function useLive<T>(
  subscribe: Subscribe<T>,
  opsi: { onError?: (message: string) => void; initial?: T } = {},
) {
  const { user } = useAuth();
  const { onError, initial } = opsi;
  const [data, setData] = useState<T | null>(initial ?? null);

  useEffect(() => {
    if (!user) return;
    return subscribe(user.uid, setData, () => onError?.(LOAD_ERROR));
  }, [user, subscribe, onError]);

  return [data, setData];
}
