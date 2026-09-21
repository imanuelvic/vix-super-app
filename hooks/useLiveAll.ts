import { useEffect, type DependencyList } from 'react';

import { useAuth } from '@/contexts/auth';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';

/**
 * BEBERAPA langganan Firestore sekaligus untuk user yang sedang masuk —
 * pasangan `useLive` (satu langganan) untuk layar yang mendengarkan banyak
 * dokumen. Pengganti blok yang sama persis di 30-an layar (21 Sep 2026):
 *
 *     useEffect(() => {
 *       if (!user) return;
 *       const fail = () => setError(LOAD_ERROR);
 *       return unsubscribeAll([
 *         subscribeVisitations(user.uid, setVisitations, fail),
 *         subscribeCoreLeaders(user.uid, setLeaders, fail),
 *       ]);
 *     }, [user]);
 * →
 *     useLiveAll((uid, fail) => [
 *       subscribeVisitations(uid, setVisitations, fail),
 *       subscribeCoreLeaders(uid, setLeaders, fail),
 *     ], { onError: setError });
 *
 * `fail` melapor LOAD_ERROR ke `onError` (kosongkan kalau layar tidak
 * menampilkan galat muat; `fail` lalu diam saja). Langganan yang ikut
 * nilai lain (tanggal, minggu, id) → sebutkan di `deps`, persis seperti
 * dependency useEffect; `when` = false menunda memasangnya (mis. sheet yang
 * baru berlangganan sesudah pertama kali dibuka).
 *
 * `subscribe` boleh panah yang lahir tiap render: ia sengaja BUKAN dependency
 * efeknya (hanya `user`, `when`, `onError`, dan `deps`), jadi tidak ada
 * langganan yang dipasang ulang tiap render.
 */
export function useLiveAll(
  subscribe: (uid: string, fail: () => void) => (() => void)[],
  opsi: {
    onError?: (message: string) => void;
    deps?: DependencyList;
    when?: boolean;
  } = {},
): void {
  const { user } = useAuth();
  const { onError, deps = [], when = true } = opsi;

  useEffect(() => {
    if (!user || !when) return;
    return unsubscribeAll(subscribe(user.uid, () => onError?.(LOAD_ERROR)));
    // `subscribe` sengaja bukan dependency (lihat catatan di atas); nilai yang
    // ia pakai disebutkan pemanggil lewat `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, when, onError, ...deps]);
}
