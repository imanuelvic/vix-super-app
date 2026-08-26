import { useState } from 'react';

/**
 * Mode cari sebuah daftar: bendera buka/tutup + kata kuncinya.
 *
 * Empat daftar panjang memakai pola yang sama (Fund 🏦, Finance → Transaksi 💸,
 * CORE → Notulen 📝, CORE → Visitasi 🏠): tombol 🔍 di kanan bawah membuka
 * kolom cari, dan menutupnya MENGOSONGKAN kata kuncinya lagi supaya daftarnya
 * kembali utuh.
 *
 * Kata kuncinya dikosongkan tiap kali tombolnya ditekan, bukan cuma saat
 * ditutup — hasilnya sama persis karena kolom carinya hanya dirender selama
 * mode cari menyala, jadi saat DIBUKA kata kuncinya memang selalu sudah kosong.
 *
 * @param onClose   dijalankan saat mode cari DITUTUP — untuk mengembalikan
 *                  urutan daftar ke bawaannya.
 * @param onToggle  dijalankan tiap kali tombolnya ditekan (buka maupun tutup)
 *                  — dipakai daftar ber-`FlatList` untuk lompat ke paling atas.
 */
export function useSearchMode({
  onClose,
  onToggle,
}: { onClose?: () => void; onToggle?: () => void } = {}): {
  searchMode: boolean;
  query: string;
  setQuery: (q: string) => void;
  toggleSearch: () => void;
} {
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');

  function toggleSearch() {
    const next = !searchMode;
    setSearchMode(next);
    setQuery('');
    if (!next) onClose?.();
    onToggle?.();
  }

  return { searchMode, query, setQuery, toggleSearch };
}
