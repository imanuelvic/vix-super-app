import { useCallback, useState } from 'react';

/**
 * Data langganan yang HARUS kosong lagi tiap kuncinya berganti — ganti tahun
 * di Timeline, kuartal di Wheel, bulan di Finance, dompet di Saku. Selagi
 * kosong, layarnya menampilkan loading.
 *
 * Kuncinya disimpan BERSAMA datanya, lalu "kosong atau tidak" DITURUNKAN saat
 * render — bukan lewat efek. Jadi tak ada jeda satu render yang menampilkan
 * angka tahun lalu di bawah judul tahun ini, dan tak ada setState di badan
 * efek (`react-hooks/set-state-in-effect`).
 */
export function useKeyedData<K, T>(key: K): {
  /** null = belum ada data UNTUK kunci ini (tampilkan loading). */
  data: T | null;
  /** Penerima snapshot — dioper apa adanya ke fungsi subscribe. */
  set: (value: T) => void;
} {
  const [held, setHeld] = useState<{ key: K; value: T } | null>(null);

  // `key` ikut disimpan dari closure saat set dibuat. Kalau langganan LAMA
  // sempat menjawab sekali lagi sesudah kunci berganti, hasilnya tercatat
  // dengan kunci lama → tidak lolos perbandingan di bawah, jadi data basi
  // tidak pernah tampil sebagai data baru.
  const set = useCallback((value: T) => setHeld({ key, value }), [key]);

  const data = held !== null && held.key === key ? held.value : null;
  return { data, set };
}
