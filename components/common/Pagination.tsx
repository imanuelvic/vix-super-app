import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Pagination modern & ringkas: tombol ‹ ›, nomor halaman dengan "…" saat
// halaman banyak (selalu tampilkan halaman 1, terakhir, dan sekitar aktif).
// Reusable untuk semua daftar panjang. Sembunyi otomatis kalau cuma 1 halaman.

type Item = { type: 'page'; value: number } | { type: 'gap'; key: string };

function buildItems(page: number, pageCount: number): Item[] {
  const wanted = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const nums = [...wanted]
    .filter((n) => n >= 1 && n <= pageCount)
    .sort((a, b) => a - b);
  const items: Item[] = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) items.push({ type: 'gap', key: `gap-${prev}-${n}` });
    items.push({ type: 'page', value: n });
    prev = n;
  }
  return items;
}

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number; // 1-based
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  const go = (p: number) => onChange(Math.min(pageCount, Math.max(1, p)));
  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  return (
    <View style={styles.row}>
      <PressableScale
        style={[styles.cell, atStart && styles.cellDisabled]}
        onPress={() => go(page - 1)}
        disabled={atStart}
        hitSlop={4}>
        <IconSymbol
          name="chevron.left"
          size={18}
          color={atStart ? Color.TEXT_PLACEHOLDER : Color.MAIN_DARK}
        />
      </PressableScale>

      {buildItems(page, pageCount).map((it) =>
        it.type === 'gap' ? (
          <View key={it.key} style={styles.gap}>
            <VixText heading="label" additionalStyle={styles.gapText}>
              …
            </VixText>
          </View>
        ) : (
          <PressableScale
            key={it.value}
            style={[styles.cell, it.value === page && styles.cellActive]}
            onPress={() => go(it.value)}>
            <VixText
              heading="bold"
              additionalStyle={
                it.value === page ? styles.cellActiveText : styles.cellText
              }>
              {it.value}
            </VixText>
          </PressableScale>
        ),
      )}

      <PressableScale
        style={[styles.cell, atEnd && styles.cellDisabled]}
        onPress={() => go(page + 1)}
        disabled={atEnd}
        hitSlop={4}>
        <IconSymbol
          name="chevron.right"
          size={18}
          color={atEnd ? Color.TEXT_PLACEHOLDER : Color.MAIN_DARK}
        />
      </PressableScale>
    </View>
  );
}

const CELL = 38;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  cell: {
    minWidth: CELL,
    height: CELL,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { backgroundColor: Color.MAIN, borderColor: Color.MAIN },
  cellText: { color: Color.TEXT_TITLE },
  cellActiveText: { color: Color.TEXT_REVERSE },
  cellDisabled: { opacity: 0.45 },
  gap: {
    minWidth: 20,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gapText: { color: Color.TEXT_PLACEHOLDER },
});
