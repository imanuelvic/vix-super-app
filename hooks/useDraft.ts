import { useCallback, useState } from 'react';

/**
 * Kolom isian yang isi awalnya MENYUSUL — datanya baru sampai dari Firestore
 * beberapa saat sesudah layarnya terbuka.
 *
 * Dulu tiap layar begini menulis pola yang sama: satu bendera `loaded`, lalu
 * satu efek besar yang mengisi semua kolom SEKALI saja supaya ketikan yang
 * sedang berjalan tidak tertimpa snapshot berikutnya:
 *
 *     const [loaded, setLoaded] = useState(false);
 *     useEffect(() => {
 *       if (!plan || loaded) return;
 *       setTitle(plan.title);
 *       setPrayer(plan.prayer);
 *       …
 *       setLoaded(true);
 *     }, [plan, loaded]);
 *
 * Tiga masalahnya:
 *
 *   1. setState dijalankan LANGSUNG di badan efek → render bertingkat, dan
 *      React Compiler (menyala di app ini) melarangnya
 *      (`react-hooks/set-state-in-effect`).
 *   2. Ada satu render di mana datanya SUDAH sampai tapi kolomnya masih
 *      kosong — kedipan kecil yang tak perlu.
 *   3. Ditulis ulang di tiap layar, lengkap dengan bendera yang gampang lupa
 *      disetel.
 *
 * Di sini yang disimpan HANYA ketikannya. Selama belum diketik, yang tampil
 * `source` — jadi begitu datanya sampai, kolomnya terisi di render yang sama
 * juga. Sekali diketik, ketikan itu yang menang seterusnya (snapshot
 * berikutnya tidak menimpanya), persis seperti bendera `loaded` dulu.
 *
 * Cara pakai — sama seperti useState:
 *   const [title, setTitle] = useDraft(plan?.title ?? '');
 */
export function useDraft<T>(
  source: T,
): [T, (next: T | ((current: T) => T)) => void] {
  // Dibungkus objek, bukan disimpan telanjang: dengan begitu `null` benar-benar
  // berarti "belum pernah diketik" walau T sendiri boleh bernilai null.
  const [edited, setEdited] = useState<{ value: T } | null>(null);
  const current = edited === null ? source : edited.value;

  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      setEdited((held) => {
        const now = held === null ? source : held.value;
        return {
          value:
            typeof next === 'function' ? (next as (c: T) => T)(now) : next,
        };
      });
    },
    [source],
  );

  return [current, set];
}
