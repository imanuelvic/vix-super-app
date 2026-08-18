import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/common/Chip';

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
}: {
  options: FilterOption<T>[];
  value: T | null; // null = tanpa filter
  onChange: (key: T | null) => void;
  allLabel?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      <Chip
        label={allLabel}
        active={value === null}
        onPress={() => onChange(null)}
      />
      {options.map((o) => (
        <Chip
          key={o.key}
          label={o.count ? `${o.label} (${o.count})` : o.label}
          active={value === o.key}
          onPress={() => onChange(value === o.key ? null : o.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 4, paddingBottom: 12 },
});
