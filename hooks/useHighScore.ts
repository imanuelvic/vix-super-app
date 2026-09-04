import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Rekor score satu permainan 🏅 — dibaca & disimpan di HP saja (AsyncStorage),
 * bukan Firestore: gratis, instan, dan memang tidak perlu ikut antar-perangkat.
 *
 * Dulu blok ini disalin UTUH di SnakeTab & TetrisTab — sama persis baris per
 * baris, cuma beda nama kuncinya. Menambah satu permainan lagi berarti menyalin
 * ketiga kalinya.
 *
 * Kenapa tidak ada `setBest` yang dipanggil langsung di dalam efek:
 *
 *   Dulu begini —
 *     useEffect(() => {
 *       if (status !== 'over' || score <= best) return;
 *       setBest(score);                            // ← memicu render bertingkat
 *       AsyncStorage.setItem(KEY, String(score));
 *     }, [status, score, best]);
 *
 *   Mengubah state LANGSUNG di badan efek memicu render bertingkat dan dilarang
 *   React Compiler (menyala di app ini) — inilah pelanggaran
 *   `react-hooks/set-state-in-effect`.
 *
 * Sekarang angka yang TAMPIL diturunkan saat render: begitu permainannya
 * selesai, score yang barusan ikut dihitung sebagai calon rekor. Jadi angkanya
 * berubah SEKETIKA, bahkan tidak menunggu tulisan ke disk selesai. Nilai
 * simpanannya menyusul di belakang layar.
 */
export function useHighScore(
  storageKey: string,
  score: number,
  /** Permainannya sudah selesai? Hanya saat itu skornya dihitung jadi rekor. */
  over: boolean,
): number {
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((v) => {
      if (v != null) setSaved(Number(v) || 0);
    });
  }, [storageKey]);

  useEffect(() => {
    if (!over || score <= saved) return;
    // `.catch` dulu BARU `.then`: angkanya tetap naik walau tulisan ke disk
    // gagal — persis seperti perilaku lama, yang juga cuma mengabaikan error
    // tulisnya. Yang hilang cuma keawetannya sampai buka app berikutnya.
    AsyncStorage.setItem(storageKey, String(score))
      .catch(() => {})
      .then(() => setSaved(score));
  }, [storageKey, over, score, saved]);

  return over ? Math.max(saved, score) : saved;
}
