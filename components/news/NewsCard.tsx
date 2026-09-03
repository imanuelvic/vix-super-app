import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { newsAge } from '@/lib/news';

// Satu baris berita — dipakai daftar berita 📰 MAUPUN daftar tersimpan 🔖.
//
// Keduanya menggambar hal yang sama (judul, penerbit, umur berita, tombol
// penanda), jadi bentuknya tinggal di satu tempat. Bedanya cuma dua, dan
// keduanya jadi prop: daftar tersimpan menambahkan baris "kapan disimpan", dan
// di sana lambangnya selalu terisi karena semua isinya memang sudah tersimpan.
//
// Tombol penandanya BERSAUDARA dengan area klik kartunya, bukan anaknya —
// Pressable bersarang di iOS bikin tombol di dalam ikut memicu pembungkusnya,
// jadi menyimpan berita malah membuka browser.
export function NewsCard({
  title,
  source,
  publishedAt,
  now,
  footer,
  saved,
  onOpen,
  onToggleSave,
}: {
  title: string;
  source: string;
  /** Kapan beritanya terbit; null = feed-nya tidak menyebutkan. */
  publishedAt: Date | null;
  now: Date;
  /** Baris kecil tambahan di bawah keterangan (mis. "🔖 disimpan …"). */
  footer?: string;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  return (
    <View style={styles.card}>
      <PressableScale style={styles.main} onPress={onOpen}>
        <VixText heading="bold" additionalStyle={styles.title}>
          {title}
        </VixText>
        <View style={styles.metaRow}>
          <VixText heading="label" additionalStyle={styles.source}>
            📰 {source}
          </VixText>
          {publishedAt && (
            <VixText heading="label">{newsAge(publishedAt, now)}</VixText>
          )}
        </View>
        {footer ? (
          <VixText heading="label" additionalStyle={styles.footer}>
            {footer}
          </VixText>
        ) : null}
      </PressableScale>
      <PressableScale style={styles.mark} onPress={onToggleSave} hitSlop={8}>
        <IconSymbol
          name={saved ? 'bookmark.fill' : 'bookmark'}
          size={20}
          color={saved ? Color.NEWS_DARK : Color.TEXT_PLACEHOLDER}
        />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 12,
    marginBottom: 8,
  },
  // Judul + keterangan mengisi sisa lebar; tombol 🔖 duduk di kanannya.
  main: { flex: 1, gap: 6 },
  title: { color: Color.TEXT_TITLE },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  source: { color: Color.NEWS_DARK, flexShrink: 1 },
  footer: { color: Color.TEXT_PLACEHOLDER },
  mark: { paddingHorizontal: 6, paddingVertical: 2 },
});
