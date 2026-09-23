import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BLOCK_CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { todayHref } from '@/components/today/todayLink';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { TodayItem } from '@/lib/today';

/** Satu baris Today: emoji · judul (· keterangan) · ›. Dipakai semua daftar. */
export function TodayRow({ item, muted = false }: { item: TodayItem; muted?: boolean }) {
  const router = useRouter();
  return (
    <PressableScale style={styles.row} onPress={() => router.push(todayHref(item.href))}>
      <VixText additionalStyle={styles.rowEmoji}>{item.emoji}</VixText>
      <View style={styles.rowMain}>
        <VixText
          heading={muted ? 'paragraph' : 'bold'}
          numberOfLines={2}
          additionalStyle={[styles.rowTitle, muted && styles.rowMuted]}>
          {item.title}
        </VixText>
        {item.detail ? (
          <VixText heading="label" numberOfLines={2}>
            {item.detail}
          </VixText>
        ) : null}
      </View>
      <IconSymbol name="chevron.right" size={16} color={Color.TEXT_PLACEHOLDER} />
    </PressableScale>
  );
}

/**
 * Bagian CORE HARI INI · WORK HARI INI · LIFE HARI INI — hanya baris tingkat
 * "today" milik bagian itu. Kosong = satu baris kecil yang tenang, bukan
 * kartu; ini yang membedakan Today dari dashboard: yang tidak butuh perhatian
 * tidak ikut memenuhi layar.
 */
export function TodaySection({
  eyebrow,
  accent,
  items,
  quiet,
  openLabel,
  openHref,
}: {
  eyebrow: string;
  /** Warna gelap fitur (garis kecil di samping eyebrow). */
  accent: string;
  items: TodayItem[];
  /** Kalimat saat tidak ada apa-apa hari ini. */
  quiet: string;
  openLabel: string;
  openHref: Href;
}) {
  const router = useRouter();
  if (items.length === 0) {
    return (
      <PressableScale style={styles.quiet} onPress={() => router.push(openHref)} hitSlop={6}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <VixText heading="label" additionalStyle={styles.quietText}>
          {quiet}
        </VixText>
        <IconSymbol name="chevron.right" size={14} color={Color.TEXT_PLACEHOLDER} />
      </PressableScale>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <VixText heading="eyebrow" additionalStyle={{ color: accent }}>
          {eyebrow}
        </VixText>
      </View>
      {items.map((it) => (
        <TodayRow key={it.id} item={it} />
      ))}
      <PressableScale style={styles.open} onPress={() => router.push(openHref)} hitSlop={6}>
        <VixText heading="label" additionalStyle={{ color: accent }}>
          {openLabel} →
        </VixText>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...BLOCK_CARD },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  rowEmoji: { fontSize: 18, lineHeight: 24, width: 26, textAlign: 'center' },
  rowMain: { flex: 1, gap: 1 },
  rowTitle: { color: Color.TEXT_TITLE },
  rowMuted: { color: Color.TEXT_PARAGRAPH },
  open: { alignSelf: 'flex-end', marginTop: 4 },
  quiet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  quietText: { flex: 1 },
});
