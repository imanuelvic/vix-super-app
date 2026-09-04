import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Judul bagian yang bisa DIBUKA-TUTUP, dengan tombol aksi opsional di kanan.
//
// Bentuknya sengaja sama persis dengan judul bagian biasa (heading "title" +
// jarak yang sama), jadi bagian yang bisa ditutup dan yang tidak tetap terbaca
// satu keluarga — yang membedakan hanya panah di sebelah judulnya. Panahnya
// naik-turun, bukan kanan-bawah: isinya memang muncul & hilang di BAWAH judul
// ini. Panah ke kanan itu bahasa "pindah ke halaman lain".
//
// Tombol `right` (mis. "+ Tambah") berdiri DI LUAR area yang bisa diklik untuk
// membuka-tutup: menambah anggota lalu bagiannya ikut menutup sendiri adalah
// persis kejutan yang tidak diinginkan.
//
// ===== Kenapa ia TIDAK memuat isinya =====
// Dulu ia menerima `children` dan merendernya sendiri saat terbuka. Rapi, tapi
// menutup satu kemungkinan: judul ini biasanya ingin DIPATOK di atas
// (`stickyHeaderIndices`) supaya tombol tutupnya tetap terjangkau setelah
// menggulung jauh ke bawah. Patokan itu menghitung ANAK LANGSUNG ScrollView —
// jadi judulnya harus jadi anak tersendiri, terpisah dari isinya. Selama isinya
// ikut di dalam sini, keduanya satu anak dan yang ikut terpatok justru seluruh
// daftarnya.
//
// Karena itu pemakainya menulis isinya sendiri, tepat di bawah judul ini:
//   <SectionToggle title={…} open={buka} onToggle={…} right={…} />
//   <View>{buka && <Isinya />}</View>
export function SectionToggle({
  title,
  sub,
  open,
  onToggle,
  right,
}: {
  title: string;
  /**
   * Baris kecil di bawah judul, mis. "4 area · kurang 12 poin lagi".
   *
   * Ikut masuk area buka-tutup, bukan berdiri sendiri di bawahnya: ia
   * MERINGKAS isi yang sedang disembunyikan, jadi justru saat bagiannya
   * tertutup itulah ia paling berguna.
   */
  sub?: string;
  open: boolean;
  onToggle: () => void;
  /** Tombol kecil di ujung kanan — tidak ikut membuka/menutup. */
  right?: ReactNode;
}) {
  return (
    // Latar PEKAT, bukan tembus pandang: saat dipatok, daftar di bawahnya
    // lewat persis di belakang judul ini.
    <View style={styles.head}>
      {/* Barisnya dipegang View DI DALAM — dan itu bukan sekadar selera.
          ScrollView memindahkan style anak sticky-nya ke pembungkus buatannya
          sendiri lalu memberi anaknya `{ flex: 1 }` polos (lihat
          ScrollViewStickyHeader.js — "We transfer the child style to the
          wrapper"). Jadi `flexDirection: 'row'` di style terluar TIDAK akan
          sampai ke sini, dan judul & tombolnya jatuh atas-bawah. */}
      <View style={styles.row}>
        <PressableScale
          style={styles.main}
          onPress={onToggle}
          hitSlop={8}
          haptic="light">
          <View style={styles.titleBox}>
            <VixText heading="title" numberOfLines={1}>
              {title}
            </VixText>
            {sub ? (
              <VixText heading="label" numberOfLines={1}>
                {sub}
              </VixText>
            ) : null}
          </View>
          <IconSymbol
            name={open ? 'chevron.up' : 'chevron.down'}
            size={18}
            color={Color.TEXT_LABEL}
          />
        </PressableScale>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Jarak atas-bawahnya SAMA PERSIS dengan judul bagian biasa (SECTION_SPACE)
  // — dipakai sebagai padding, bukan margin, karena margin tidak ikut
  // mewarnai latar dan latar yang bolong membuat daftar di belakangnya tembus
  // saat judul ini dipatok.
  head: {
    paddingTop: SECTION_SPACE.marginTop,
    paddingBottom: SECTION_SPACE.marginBottom,
    backgroundColor: Color.BACKGROUND,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  // Judul + panah memakan sisa lebar, jadi seluruh baris judulnya bisa diklik
  // — bukan cuma panah kecil di ujungnya.
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Kotak judulnya MENGALAH (flexShrink), BUKAN flex: 1 — dengan flex: 1
  // panahnya terlempar ke ujung kanan sampai menempel tombol aksinya, dan
  // judul pendek jadi terpisah jauh dari panah miliknya sendiri.
  titleBox: { flexShrink: 1 },
});
