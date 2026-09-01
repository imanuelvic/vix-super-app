import { StyleSheet } from 'react-native';

import { Chip } from '@/components/common/Chip';
import { ChipRow } from '@/components/common/ChipRow';

// Baris chip filter yang bisa digeser: "ALL" + satu chip per pilihan,
// masing-masing boleh menampilkan angka. Menekan chip yang sedang aktif akan
// melepas filternya. Dipakai Reminder Prioritas (kategori) dan Riwayat
// Pertemuan (jenis pertemuan) — satu bentuk, satu tempat mengubahnya.
export type FilterOption<T extends string> = {
  key: T;
  label: string;
  count?: number; // ditempel dalam kurung di belakang label kalau > 0
};

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel = 'ALL',
  onRepress,
}: {
  options: FilterOption<T>[];
  value: T | null; // null = tanpa filter
  onChange: (key: T | null) => void;
  allLabel?: string;
  /**
   * Dipanggil saat chip yang SEDANG aktif ditekan lagi (tekanan kedua) —
   * dipakai untuk menggulung daftarnya balik ke paling atas. Filternya sendiri
   * tetap berperilaku seperti biasa (tekanan kedua = lepas filter).
   */
  onRepress?: () => void;
}) {
  return (
    // "ALL" itu chip ke-0, sisanya menyusul — jadi indeks aktifnya bergeser
    // satu. Tanpa ini, filter yang sedang menyala bisa tinggal terlihat
    // separuh di tepi kiri (persis yang terjadi di Reminder Prioritas &
    // Riwayat Visitasi).
    <ChipRow
      activeIndex={
        value === null ? 0 : options.findIndex((o) => o.key === value) + 1
      }
      additionalStyle={styles.scroll}
      contentStyle={styles.row}>
      <Chip
        label={allLabel}
        active={value === null}
        onPress={() => {
          if (value === null) onRepress?.();
          onChange(null);
        }}
      />
      {options.map((o) => (
        <Chip
          key={o.key}
          label={o.count ? `${o.label} (${o.count})` : o.label}
          active={value === o.key}
          onPress={() => {
            if (value === o.key) onRepress?.();
            onChange(value === o.key ? null : o.key);
          }}
        />
      ))}
    </ChipRow>
  );
}

const styles = StyleSheet.create({
  // Barisnya MENEMBUS padding layarnya (ketujuh pemakainya sama-sama memberi
  // 20pt) lalu memasang 20pt-nya sendiri di dalam.
  //
  // Hasilnya sama persis dengan baris kategori di Reminder: chip pertama tetap
  // sejajar kartu di bawahnya, tapi geserannya sampai ke TEPI LAYAR. Sebelum
  // ini barisnya terkurung di dalam kotak 20pt — chip-nya terpotong 20pt
  // sebelum tepi layar, dan potongan yang menggantung di tengah-tengah itu
  // terbaca seperti kesalahan, bukan seperti "masih ada lagi di sebelah".
  scroll: { marginHorizontal: -20 },
  row: { paddingHorizontal: 20, paddingBottom: 12 },
});
