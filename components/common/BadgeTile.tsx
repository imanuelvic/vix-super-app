import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Satu petak LENCANA dalam grid tiga kolom — bentuk papan Awards ala Duolingo.
//
// Dipakai dua layar dengan arti yang berbeda tapi bentuk yang sama persis:
//   • Achievement 🏆   → satu petak = satu KATEGORI (angkanya "3/9").
//   • Rincian kategori → satu petak = satu LENCANA (angkanya target tingkatnya).
// Karena itu ia tidak tahu apa-apa soal achievement; ia cuma tahu lambang,
// angka kecil di kaki lencana, judul, dan sudah-terbuka atau belum.
//
// Yang BELUM terbuka tetap digambar, cuma dipudarkan — tidak disembunyikan.
// Tangganya harus terlihat utuh: yang membuat orang mengejar tingkat
// berikutnya justru melihat tingkat itu ada.
export function BadgeTile({
  icon,
  tag,
  title,
  unlocked,
  onPress,
  children,
}: {
  icon: string;
  /** Angka kecil yang menempel di kaki lencana, mis. "30" atau "3/9". */
  tag: string;
  title: string;
  unlocked: boolean;
  onPress: () => void;
  /** Baris di bawah judul — teks kemajuan, batang, apa pun milik layarnya. */
  children?: ReactNode;
}) {
  return (
    <PressableScale style={styles.tile} onPress={onPress}>
      <View style={[styles.badge, !unlocked && styles.badgeLocked]}>
        <VixText additionalStyle={styles.badgeIcon}>{icon}</VixText>
        <View style={[styles.badgeTag, !unlocked && styles.badgeTagLocked]}>
          <VixText heading="label" additionalStyle={styles.badgeTagText}>
            {tag}
          </VixText>
        </View>
      </View>
      <VixText
        heading="bold"
        numberOfLines={2}
        additionalStyle={[styles.title, !unlocked && styles.titleLocked]}>
        {title}
      </VixText>
      {children}
    </PressableScale>
  );
}

/**
 * Wadah gridnya — dipakai bersama petak di atas.
 *
 * Ikut di berkas ini supaya lebar petak (33.33%) dan pembungkusnya tidak pernah
 * berpisah: keduanya satu perjanjian, dan yang paling mudah meleset saat
 * disalin ke layar lain justru pasangan itu.
 */
export const badgeGrid = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: 14,
  },
});

const styles = StyleSheet.create({
  // Tiga kolom: cukup lega untuk lambang besar + judul dua baris, dan pas untuk
  // tangga 7–10 tingkat tanpa perlu digulung.
  tile: { width: '33.33%', alignItems: 'center', paddingHorizontal: 4, gap: 4 },
  badge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderWidth: 2,
    borderColor: Color.MAIN,
  },
  badgeLocked: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderColor: Color.BORDER,
    opacity: 0.65,
  },
  badgeIcon: { fontSize: 28, lineHeight: 34 },
  // Angkanya menempel di KAKI lencana, persis cara Duolingo menandai tiap
  // tingkat — jadi "ini yang ke berapa" terbaca tanpa membaca judulnya.
  badgeTag: {
    position: 'absolute',
    bottom: -6,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    backgroundColor: Color.MAIN,
  },
  badgeTagLocked: { backgroundColor: Color.TEXT_PLACEHOLDER },
  badgeTagText: { color: Color.TEXT_REVERSE },
  title: { textAlign: 'center', color: Color.TEXT_TITLE },
  titleLocked: { color: Color.TEXT_LABEL },
});
