import { useCallback, useRef, useState } from 'react';

/**
 * Penjaga "tampilkan setelah SEMUANYA tiba".
 *
 * Masalahnya: Home memasang 20-an langganan Firestore sekaligus, dan tiap
 * langganan menjawab pada saat yang berbeda. Kalau badge digambar apa adanya,
 * angkanya muncul satu per satu selama beberapa detik — terlihat seperti app
 * yang tersendat, padahal sedang bekerja normal.
 *
 * Cara pakai:
 *   const { ready, mark } = useReadyGate(3);
 *   subscribeA(uid, mark('a', setA));
 *   subscribeB(uid, mark('b', setB));
 *   …
 *   {ready && <Badge/>}
 *
 * Sengaja TIDAK menahan seluruh layar: grid & sapaan tetap tampil seketika
 * (apalagi isinya sudah ada di cache disk lewat lib/liveDoc). Yang ditunggu
 * hanya badge-nya, supaya muncul serentak sebagai satu kelompok.
 *
 * Menghasilkan TEPAT satu render tambahan: penanda "sudah tiba" disimpan di
 * ref, dan state baru disentuh sekali saat yang terakhir masuk.
 */
export function useReadyGate(total: number): {
  ready: boolean;
  /** Bungkus penerima snapshot: menandai sumber `key` sudah tiba. */
  mark: <T>(key: string, set: (value: T) => void) => (value: T) => void;
} {
  const seen = useRef<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  const mark = useCallback(
    <T,>(key: string, set: (value: T) => void) =>
      (value: T) => {
        // Set dulu datanya — penjaga ini tidak boleh menunda apa pun.
        set(value);
        // Ref ditulis di dalam callback (bukan saat render), jadi aman untuk
        // React Compiler. Snapshot berikutnya dari dokumen yang sama tidak
        // dihitung lagi.
        const s = seen.current;
        if (s.has(key)) return;
        s.add(key);
        if (s.size >= total) setReady(true);
      },
    [total],
  );

  return { ready, mark };
}
