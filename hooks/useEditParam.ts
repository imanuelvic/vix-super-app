import { useEffect, useRef } from 'react';

// Buka modal edit OTOMATIS saat sebuah sub-tab dibuka dari kartu reminder
// (`?edit=<id>` di URL). Dipakai tiga tempat yang sama-sama bisa dituju dari
// Dashboard/Home: Career → Fulltime & Freelance, dan CORE → Visitation.
//
// Dua penjagaan yang mudah terlewat kalau disalin tangan:
//  • `onConsumed` — minta induk membersihkan param dari URL, kalau tidak
//    modalnya terbuka LAGI tiap balik ke sub-tab itu (kontennya memang
//    di-mount ulang oleh `key={scrollKey}`).
//  • `consumedRef` — penjaga kedua supaya tidak dobel dalam satu mount, untuk
//    jeda singkat sebelum param yang dibersihkan kembali sebagai prop baru.
//
// Datanya baru datang belakangan (langganan Firestore), jadi id yang belum
// ketemu sengaja DIBIARKAN menggantung — efeknya jalan lagi begitu daftarnya
// masuk, bukan menyerah di percobaan pertama.
export function useEditParam<T extends { id: string }>(
  items: T[],
  openEdit: (item: T) => void,
  editId?: string,
  onConsumed?: () => void,
) {
  const consumedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!editId || consumedRef.current === editId) return;
    const item = items.find((x) => x.id === editId);
    if (item) {
      consumedRef.current = editId;
      openEdit(item);
      onConsumed?.();
    }
  }, [editId, items, openEdit, onConsumed]);
}
