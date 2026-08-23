import { useCallback, useState } from 'react';

/**
 * Data langganan yang HARUS kosong lagi setiap kuncinya berganti — ganti tahun
 * di Timeline, ganti kuartal di Wheel, ganti bulan di Finance, ganti dompet di
 * Saku. Selagi kosong, layarnya menampilkan loading.
 *
 * Dulu tiap layar menulisnya begini:
 *
 *     useEffect(() => {
 *       setItems(null);            // ← kosongkan dulu biar loading muncul
 *       return subscribeX(uid, tahun, setItems);
 *     }, [uid, tahun]);
 *
 * Dua masalahnya:
 *
 *   1. Mengubah state LANGSUNG di dalam efek memicu render bertingkat, dan
 *      React Compiler (menyala di app ini) melarangnya — inilah pelanggaran
 *      `react-hooks/set-state-in-effect`.
 *   2. Ada jeda satu render di mana kunci sudah berganti tapi datanya MASIH
 *      punya kunci lama. Sekejap layar menampilkan angka tahun lalu di bawah
 *      judul tahun ini.
 *
 * Di sini kuncinya disimpan BERSAMA datanya, lalu "kosong atau tidak"
 * DITURUNKAN saat render — bukan diatur lewat efek. Begitu kuncinya berganti,
 * `data` otomatis null di render yang sama juga. Tidak ada jeda, tidak ada
 * setState di efek.
 *
 * Cara pakai:
 *   const { data: items, set } = useKeyedData<number, Item[]>(year);
 *   useEffect(() => subscribeTimelineYear(uid, year, set, onError), [uid, year, set]);
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
