import { useCallback, useEffect, useState } from 'react';

/**
 * Data yang diambil SEKALI JALAN dari luar (fetch HTTP, Apple Health) — beda
 * dengan langganan Firestore yang mengalir terus. Contoh: harga emas/Bitcoin/
 * IHSG/kurs, judul berita, ringkasan langkah hari ini.
 *
 * Dulu tiap pemakainya menulis pola yang sama persis:
 *
 *     const load = useCallback(async () => {
 *       setLoading(true);          // ← ini yang dilarang saat dipanggil efek
 *       setError(null);
 *       try { setData(await ambil()); } catch { setError(PESAN); }
 *       finally { setLoading(false); }
 *     }, []);
 *     useEffect(() => { load(); }, [load]);
 *
 * Dua masalahnya:
 *
 *   1. `setLoading(true)` jalan LANGSUNG di dalam efek → render bertingkat, dan
 *      React Compiler (menyala di app ini) melarangnya
 *      (`react-hooks/set-state-in-effect`).
 *   2. Ditulis ulang di tiap layar → gampang beda-beda sendiri.
 *
 * Di sini `loading` & `error` DITURUNKAN saat render: keduanya dibaca dari
 * jawaban permintaan yang sedang berlaku. Begitu ada permintaan baru (ditekan
 * muat ulang, atau `load` berganti karena sumbernya diganti), jawaban lama
 * tidak cocok lagi → `loading` true & `error` bersih di render yang sama juga.
 * Jadi tak ada satu pun setState yang dijalankan langsung di badan efek — yang
 * menulis state cuma jawaban promise (callback) dan tombol (event).
 *
 * Cara pakai:
 *   const { data, loading, error, reload } = useAsyncData(loadGold, GOLD_ERROR);
 *
 * `load` boleh berganti-ganti (mis. ikut sumber berita yang dipilih): begitu
 * fungsinya berbeda, itu dihitung permintaan baru. `load = null` artinya
 * "jangan ambil apa-apa dulu" (mis. izin Apple Health belum ada) — `loading`
 * ikut false, tak ada permintaan yang dikirim.
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
