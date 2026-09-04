import { useCallback, useState } from 'react';

/**
 * Kolom isian yang isi awalnya MENYUSUL — datanya baru sampai dari Firestore
 * beberapa saat sesudah layarnya terbuka.
 *
 * Yang disimpan HANYA ketikannya: selama belum diketik yang tampil `source`,
 * jadi kolomnya terisi di render yang sama saat datanya sampai (tanpa kedipan
 * & tanpa setState di badan efek). Sekali diketik, ketikan itu menang
 * seterusnya — snapshot berikutnya tidak menimpanya.
 *
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
