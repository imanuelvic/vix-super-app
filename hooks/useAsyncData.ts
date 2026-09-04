import { useCallback, useEffect, useState } from 'react';

/**
 * Data yang diambil SEKALI JALAN dari luar (harga emas, berita, Apple Health)
 * — beda dengan langganan Firestore yang mengalir terus.
 *
 * `loading` & `error` DITURUNKAN saat render, dibaca dari jawaban permintaan
 * yang sedang berlaku. Jadi tak ada setState di badan efek — yang dilarang
 * React Compiler (`react-hooks/set-state-in-effect`).
 *
 *   const { data, loading, error, reload } = useAsyncData(loadGold, GOLD_ERROR);
 *
 * `load` boleh berganti (ikut sumber yang dipilih) → dihitung permintaan baru.
 * `load = null` = jangan ambil apa-apa dulu; `loading` ikut false.
 */
export function useAsyncData<T>(
  load: ((force: boolean) => Promise<T>) | null,
  errorText: string,
  /**
   * Saat gagal: true = isi lama dipertahankan (grafik pasar tetap terbaca,
   * pesan galatnya muncul kecil di atasnya), false = ikut dikosongkan.
   */
  keepStaleOnError = true,
): {
  /** null = belum ada isi untuk ditampilkan. */
  data: T | null;
  loading: boolean;
  error: string | null;
  /** `force` diteruskan ke `load` — dipakai tombol 🔄 untuk melewati cache. */
  reload: (force?: boolean) => void;
} {
  const [data, setData] = useState<T | null>(null);
  // Permintaan yang sedang berlaku. `n` naik tiap kali muat ulang ditekan.
  const [req, setReq] = useState({ n: 0, force: false });
  // Jawaban yang sudah sampai — dicatat BERSAMA fungsi pengambil & nomor
  // permintaannya, supaya ketahuan kalau sudah basi.
  const [settled, setSettled] = useState<{
    load: unknown;
    n: number;
    error: string | null;
  } | null>(null);

  const fresh =
    settled !== null && settled.load === load && settled.n === req.n
      ? settled
      : null;
  const loading = load !== null && fresh === null;
  const error = fresh?.error ?? null;

  useEffect(() => {
    if (!load) return;
    // Jawaban yang datang terlambat (sumbernya sudah diganti / sudah ditekan
    // muat ulang lagi) dibuang, biar tidak menimpa yang baru.
    let alive = true;
    load(req.force).then(
      (value) => {
        if (!alive) return;
        setData(value);
        setSettled({ load, n: req.n, error: null });
      },
      () => {
        if (!alive) return;
        if (!keepStaleOnError) setData(null);
        setSettled({ load, n: req.n, error: errorText });
      },
    );
    return () => {
      alive = false;
    };
  }, [load, errorText, keepStaleOnError, req]);

  const reload = useCallback(
    (force = false) => setReq((r) => ({ n: r.n + 1, force })),
    [],
  );

  return { data, loading, error, reload };
}
