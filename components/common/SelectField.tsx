import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Pemilih satu nilai — bentuknya sama seperti DateField: satu baris rapi,
// daftar pilihannya baru MUNCUL saat ditekan. Dipakai menggantikan deretan
// chip panjang di dalam modal (jenis pertemuan, nama CORE, MBTI, dll) supaya
// modal tidak langsung penuh oleh semua pilihan.
//
// Daftarnya dibuka INLINE (bukan modal baru) — modal di atas modal tidak
// andal di iOS, dan ini sudah dipakai di dalam SheetModal.
export type SelectOption<T extends string> = {
  key: T;
  label: string;
  sub?: string; // keterangan kecil di bawah label
};

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Pilih…',
  disabled = false,
  clearable = false,
}: {
  value: T | null;
  options: SelectOption<T>[];
  onChange: (key: T | null) => void;
  placeholder?: string;
  disabled?: boolean;
  /** true → menekan pilihan yang sedang aktif akan mengosongkannya. */
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value) ?? null;

  // Panah berputar 180° (bukan berganti ikon) → terasa seperti satu benda yang
  // membalik, dan daftarnya membentang turun dari balik kolom.
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: 200 });
  }, [open, turn]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 180}deg` }],
  }));

  return (
    <>
      <PressableScale
        style={styles.field}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}>
        <VixText
          heading="paragraph"
          numberOfLines={1}
          additionalStyle={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </VixText>
        <Animated.View style={chevronStyle}>
          <IconSymbol name="chevron.down" size={18} color={Color.TEXT_LABEL} />
        </Animated.View>
      </PressableScale>

      {open && (
        <Animated.View entering={FadeInUp.duration(180)} style={styles.list}>
          <ScrollView
            style={styles.listScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled">
            {options.map((o) => {
              const active = o.key === value;
              return (
                <PressableScale
                  key={o.key}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onChange(clearable && active ? null : o.key);
                    setOpen(false);
                  }}>
                  <View style={styles.optionMain}>
                    <VixText
                      heading="bold"
                      additionalStyle={active ? styles.optionOn : styles.optionText}>
                      {o.label}
                    </VixText>
                    {o.sub ? (
                      <VixText heading="label" additionalStyle={styles.optionSub}>
                        {o.sub}
                      </VixText>
                    ) : null}
                  </View>
                  {active && (
                    <IconSymbol name="checkmark" size={18} color={Color.MAIN} />
                  )}
                </PressableScale>
              );
            })}
          </ScrollView>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  value: { color: Color.TEXT_TITLE, flexShrink: 1 },
  placeholder: { color: Color.TEXT_PLACEHOLDER, flexShrink: 1 },
  list: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
    overflow: 'hidden',
  },
  // Dibatasi tingginya supaya daftar panjang (mis. 16 MBTI) tetap ringkas.
  listScroll: { maxHeight: 240 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Color.BORDER,
  },
  optionActive: { backgroundColor: Color.MAIN_TRANSPARENT },
  optionMain: { flex: 1, gap: 1 },
  optionText: { color: Color.TEXT_TITLE },
  optionOn: { color: Color.MAIN_DARK },
  optionSub: { color: Color.TEXT_LABEL },
});
