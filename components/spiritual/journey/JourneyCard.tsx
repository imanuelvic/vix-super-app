import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Potongan bersama tiap langkah journey — satu kartu putih di atas latar
// pekat: eyebrow kecil (nama langkah), judul, lalu isinya. Tidak ada nomor
// langkah dan tidak ada centang: kartunya sendiri yang berganti, bukan daftar
// yang dicoret.
//
// Dipakai DUA perjalanan yang memang harus terasa sama:
//   • Morning Journey 🌅  (components/spiritual/MorningJourney.tsx)
//   • Bible Journey 📖    (components/spiritual/BibleJourney.tsx)
//
// 2 Okt 2026, saat Bible Journey lahir, dua hal di sini dilepas dari Morning
// Journey supaya bisa dipakai berdua, dan TIDAK ADA yang berubah rupanya:
//   1. Daftar langkahnya tidak lagi dicari sendiri lewat `journeyStepMeta`.
//      Yang memanggil mengoper metanya langsung, karena kedua perjalanan
//      punya daftar langkah yang berbeda.
//   2. Warnanya datang dari `JourneyToneProvider`. Tanpa provider warnanya
//      ungu Spiritual seperti sebelumnya, jadi Morning Journey tak tersentuh.

/**
 * Satu langkah, sebatas yang dibutuhkan untuk menggambarnya. Sengaja
 * struktural (bukan union kunci milik salah satu perjalanan), supaya
 * `JOURNEY_STEPS` maupun `bibleJourneySteps()` sama-sama muat.
 */
export type JourneyStepMeta = {
  key: string;
  emoji: string;
  label: string;
  title: string;
};

/**
 * Warna satu perjalanan. Cuma dua, dan keduanya dipakai DI ATAS kartu putih:
 * `accent` untuk nama langkah, tombol utama, & tautan; `soft` untuk kotak
 * bacaan di dalam kartu. Latar layarnya sendiri bukan urusan kartu ini.
 */
export type JourneyTone = {
  accent: string;
  soft: string;
};

/** Ungu Spiritual — nada bawaan, yaitu Morning Journey 🌅. */
export const SPIRITUAL_TONE: JourneyTone = {
  accent: Color.SPIRITUAL_DARK,
  soft: Color.SPIRITUAL,
};

const ToneContext = createContext<JourneyTone>(SPIRITUAL_TONE);

export function useJourneyTone(): JourneyTone {
  return useContext(ToneContext);
}

/** Bungkus seluruh langkah supaya warnanya ikut sesi yang sedang dibuka. */
export function JourneyToneProvider({
  tone,
  children,
}: {
  tone: JourneyTone;
  children: ReactNode;
}) {
  return <ToneContext.Provider value={tone}>{children}</ToneContext.Provider>;
}

/** Kartu satu langkah. `key` di pemanggil = kunci langkahnya, supaya tiap
    ganti langkah kartunya lahir baru (dan animasi masuknya jalan). */
export function JourneyCard({
  step,
  children,
}: {
  step: JourneyStepMeta;
  children: ReactNode;
}) {
  const tone = useJourneyTone();
  return (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
      <VixText heading="label" additionalStyle={[styles.eyebrow, { color: tone.accent }]}>
        {step.emoji}  {step.label.toUpperCase()}
      </VixText>
      <VixText heading="subheader" additionalStyle={styles.title}>
        {step.title}
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

/** Kotak bacaan berlatar lembut: ayat, Bapa Kami, pokok doa, ringkasan. */
export function JourneyBox({ children }: { children: ReactNode }) {
  const tone = useJourneyTone();
  return <View style={[styles.box, { backgroundColor: tone.soft }]}>{children}</View>;
}

/** CTA utama langkah ini: jelas, tapi tidak agresif (warna sesi, bukan hijau). */
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
  const tone = useJourneyTone();
  return (
    <View style={[styles.next, disabled && styles.nextDisabled]}>
      <PrimaryButton
        label={label}
        onPress={disabled ? () => undefined : onPress}
        busy={busy}
        background={tone.accent}
      />
    </View>
  );
}

/**
 * Tombol SEKUNDER di dalam kartu: membuka app luar (YouVersion) atau membuat
 * Story. Sengaja bergaris, bukan terisi, supaya tidak pernah tertukar dengan
 * CTA langkahnya. Dua yang terisi berdampingan membuat kartunya terbaca
 * seperti formulir dengan dua tombol kirim.
 */
export function JourneyAction({
  label,
  detail,
  onPress,
  busy = false,
}: {
  label: string;
  /** Baris kecil di bawah label, mis. tujuan tombolnya. */
  detail?: string;
  onPress: () => void;
  busy?: boolean;
}) {
  const tone = useJourneyTone();
  return (
    <PressableScale
      style={[styles.action, { borderColor: tone.accent }, busy && styles.linkDisabled]}
      onPress={busy ? () => undefined : onPress}>
      <View style={styles.actionMain}>
        <VixText heading="bold" additionalStyle={{ color: tone.accent }}>
          {label}
        </VixText>
        {detail ? (
          <VixText heading="label" additionalStyle={styles.actionDetail}>
            {detail}
          </VixText>
        ) : null}
      </View>
      <IconSymbol name="chevron.right" size={18} color={tone.accent} />
    </PressableScale>
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
  const tone = useJourneyTone();
  return (
    <PressableScale
      style={[styles.link, disabled && styles.linkDisabled]}
      onPress={disabled ? () => undefined : onPress}
      hitSlop={8}>
      <VixText heading="label" additionalStyle={{ color: tone.accent }}>
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
  // Warna nama langkah datang dari nada perjalanannya (JourneyToneProvider).
  eyebrow: { letterSpacing: 1.4 },
  // gap kartu 14 dipakai antar-blok; judul & kalimat di bawahnya lebih rapat.
  title: { color: Color.TEXT_TITLE, marginTop: -6 },
  question: { color: Color.TEXT_PARAGRAPH, lineHeight: 26, marginTop: -4 },
  fieldLabel: { marginBottom: 6 },
  // Latarnya juga dari nada perjalanannya.
  box: { borderRadius: 16, padding: 16 },
  next: { marginTop: 4 },
  nextDisabled: { opacity: 0.5 },
  link: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  linkDisabled: { opacity: 0.5 },
  // Tombol sekunder bergaris; warna garis & tulisannya dari nada perjalanan.
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionMain: { flex: 1, gap: 1 },
  actionDetail: { color: Color.TEXT_LABEL },
});
