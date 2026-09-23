import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { TodayRow } from '@/components/today/TodaySection';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { TodayItem } from '@/lib/today';

// ▸ UP NEXT · 3 hal — daftar terlipat di kaki Today. Tertutup secara bawaan:
// isinya memang belum untuk hari ini. Dibuka sekali click, barisnya digambar
// redup (bukan tagihan). Prinsip "attention is limited": yang tidak untuk
// hari ini boleh ada, asal tidak berebut perhatian.
export function FoldedList({
  label,
  items,
  footer,
}: {
  label: string;
  items: TodayItem[];
  /** Baris penutup, mis. tautan ke Semua Pengingat. */
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0 && !footer) return null;
  return (
    <View style={styles.wrap}>
      <PressableScale style={styles.head} onPress={() => setOpen((v) => !v)} hitSlop={6}>
        <IconSymbol
          name={open ? 'chevron.down' : 'chevron.right'}
          size={14}
          color={Color.TEXT_LABEL}
        />
        <VixText heading="eyebrow" additionalStyle={styles.label}>
          {label} · {items.length}
        </VixText>
      </PressableScale>
      {open && (
        <View style={styles.body}>
          {items.map((it) => (
            <TodayRow key={it.id} item={it} muted />
          ))}
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  label: { color: Color.TEXT_LABEL },
  body: { paddingLeft: 4 },
});
