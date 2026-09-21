import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { journeyStepMeta, type JourneyStepKey } from '@/lib/journey';

// Potongan bersama ketujuh langkah Morning Journey 🌅 — satu kartu putih di
// atas latar ungu tua: eyebrow kecil (nama langkah), judul, lalu isinya.
// Tidak ada nomor langkah dan tidak ada centang: kartunya sendiri yang
// berganti, bukan daftar yang dicoret.

/** Kartu satu langkah. `key` di pemanggil = kunci langkahnya, supaya tiap
    ganti langkah kartunya lahir baru (dan animasi masuknya jalan). */
export function JourneyCard({
  step,
  children,
}: {
  step: JourneyStepKey;
  children: ReactNode;
}) {
  const meta = journeyStepMeta(step);
  return (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
      <VixText heading="label" additionalStyle={styles.eyebrow}>
        {meta.emoji}  {meta.label.toUpperCase()}
      </VixText>
      <VixText heading="subheader" additionalStyle={styles.title}>
        {meta.title}
      </VixText>
      {children}
    </Animated.View>
  );
}

/** Kalimat pengantar / pertanyaan reflektif di bawah judul. */
export function JourneyQuestion({ children }: { children: ReactNode }) {
  return (
    <VixText heading="paragraph" additionalStyle={styles.question}>
      {children}
    </VixText>
  );
}

/** Keterangan kolom kecil di atas isian (mis. "Judul Revive"). */
export function JourneyFieldLabel({ children }: { children: ReactNode }) {
  return (
    <VixText heading="label" additionalStyle={styles.fieldLabel}>
      {children}
    </VixText>
  );
}

/** Kotak bacaan berlatar ungu muda: ayat, Bapa Kami, pokok doa. */
export function JourneyBox({ children }: { children: ReactNode }) {
  return <View style={styles.box}>{children}</View>;
}

/** CTA utama langkah ini: jelas, tapi tidak agresif (ungu fitur, bukan hijau). */
export function JourneyNext({
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.next, disabled && styles.nextDisabled]}>
      <PrimaryButton
        label={label}
        onPress={disabled ? () => undefined : onPress}
        busy={busy}
        background={Color.SPIRITUAL_DARK}
      />
    </View>
  );
}

/** Tautan sekunder yang tenang di bawah CTA, mis. "Skip untuk sekarang". */
export function JourneyLink({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      style={[styles.link, disabled && styles.linkDisabled]}
      onPress={disabled ? () => undefined : onPress}
      hitSlop={8}>
      <VixText heading="label" additionalStyle={styles.linkText}>
        {label}
      </VixText>
    </PressableScale>
  );
}

export const journeyStyles = StyleSheet.create({
  // Isian panjang (rhema, refleksi, doa) — lega, cukup untuk beberapa kalimat.
  bigInput: { minHeight: 120, textAlignVertical: 'top' },
  // Isian satu-dua kalimat.
  mediumInput: { minHeight: 84, textAlignVertical: 'top' },
  // Jarak tegak antar-isian di dalam kartu.
  gap: { marginBottom: 12 },
  // Teks bacaan di dalam JourneyBox.
  boxText: { color: Color.TEXT_TITLE, lineHeight: 24 },
  // Sumber ayat — sewarna judul fitur Spiritual, rata kanan seperti kutipan.
  boxRef: { color: Color.SPIRITUAL_DARK, textAlign: 'right', marginTop: 8 },
  // Poin pokok doa — sedikit lebih rapat dari teks Bapa Kami.
  pointText: { color: Color.TEXT_TITLE, lineHeight: 22 },
  // Keterangan lembut (bukan peringatan) di dalam kartu.
  hint: { color: Color.TEXT_LABEL },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
    gap: 14,
  },
  eyebrow: { color: Color.SPIRITUAL_DARK, letterSpacing: 1.4 },
  // gap kartu 14 dipakai antar-blok; judul & kalimat di bawahnya lebih rapat.
  title: { color: Color.TEXT_TITLE, marginTop: -6 },
  question: { color: Color.TEXT_PARAGRAPH, lineHeight: 26, marginTop: -4 },
  fieldLabel: { marginBottom: 6 },
  box: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    padding: 16,
  },
  next: { marginTop: 4 },
  nextDisabled: { opacity: 0.5 },
  link: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  linkDisabled: { opacity: 0.5 },
  linkText: { color: Color.SPIRITUAL_DARK },
});
