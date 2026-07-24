import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Tata letak tombol angka — '' = ruang kosong, 'del' = hapus satu digit.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

// Gerbang PIN: keypad angka sendiri (bukan keyboard HP) supaya rapi & cepat.
// Begitu digit terakhir diisi, PIN langsung dicek — tidak perlu tombol OK.
//
// CATATAN: ini kunci privasi dari orang iseng yang pegang HP-mu, BUKAN
// pengamanan data. PIN-nya ikut terbundel di aplikasi, jadi jangan dianggap
// pengaman rahasia. Data tetap dijaga oleh login Firebase + Security Rules.
export function PinLock({
  pin,
  title,
  subtitle,
  onUnlock,
  onCancel,
}: {
  pin: string;
  title: string;
  subtitle?: string;
  onUnlock: () => void;
  onCancel?: () => void;
}) {
  const [entry, setEntry] = useState('');
  const [wrong, setWrong] = useState(false);

  function press(key: string) {
    if (key === '') return;
    if (key === 'del') {
      setWrong(false);
      setEntry((e) => e.slice(0, -1));
      return;
    }
    if (entry.length >= pin.length) return;

    const next = entry + key;
    setWrong(false);
    setEntry(next);

    if (next.length === pin.length) {
      if (next === pin) {
        onUnlock();
      } else {
        // Beri jeda sebentar supaya titik terakhir sempat terlihat dulu.
        setWrong(true);
        setTimeout(() => setEntry(''), 250);
      }
    }
  }

  return (
    <View style={styles.wrap}>
      <VixText additionalStyle={styles.lockEmoji}>🔒</VixText>
      <VixText heading="subheader" additionalStyle={styles.title}>
        {title}
      </VixText>
      {subtitle ? (
        <VixText heading="label" additionalStyle={styles.subtitle}>
          {subtitle}
        </VixText>
      ) : null}

      {/* Titik penanda berapa digit yang sudah diisi */}
      <View style={styles.dots}>
        {Array.from({ length: pin.length }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < entry.length && styles.dotFilled,
              wrong && styles.dotWrong,
            ]}
          />
        ))}
      </View>

      {wrong && (
        <Animated.View entering={FadeIn.duration(150)}>
          <VixText heading="label" additionalStyle={styles.errorText}>
            PIN salah — coba lagi
          </VixText>
        </Animated.View>
      )}

      {/* Keypad angka */}
      <View style={styles.keypad}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={i} style={styles.keySpacer} />
          ) : (
            <PressableScale
              key={i}
              style={styles.key}
              onPress={() => press(key)}>
              <VixText heading="subheader" additionalStyle={styles.keyText}>
                {key === 'del' ? '⌫' : key}
              </VixText>
            </PressableScale>
          ),
        )}
      </View>

      {onCancel && (
        <PressableScale style={styles.cancel} onPress={onCancel}>
          <VixText heading="bold" additionalStyle={styles.cancelText}>
            Kembali
          </VixText>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 4,
  },
  lockEmoji: { fontSize: 46, lineHeight: 58 },
  title: { color: Color.TEXT_TITLE, textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 14, marginTop: 18, marginBottom: 6 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Color.MAIN_LIGHT,
  },
  dotFilled: { backgroundColor: Color.MAIN },
  dotWrong: { borderColor: Color.DANGER },
  errorText: { color: Color.DANGER, marginTop: 2 },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    maxWidth: 280,
    marginTop: 18,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  keySpacer: { width: 72, height: 72 },
  keyText: { color: Color.TEXT_TITLE },
  cancel: { marginTop: 22, paddingHorizontal: 20, paddingVertical: 8 },
  cancelText: { color: Color.TEXT_LABEL },
});
