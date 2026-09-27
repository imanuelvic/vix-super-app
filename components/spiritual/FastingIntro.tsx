import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { VixText } from '@/components/common/VixText';
import {
  FASTING_FOCUSES,
  FASTING_RULES,
  FASTING_WHY,
  type FastingFocus,
  type FastingRule,
} from '@/lib/fastingWhy';
import { openYouVersion } from '@/lib/spiritual';

// 🍽️ Perjalanan tiga langkah sebelum formulir Puasa Baru terbuka.
//
// Alasannya panjang dan ditulis di lib/fastingWhy.ts; singkatnya: puasa yang
// diisi dalam 30 detik gampang jadi rutinitas kosong, dan yang paling mungkin
// dilewati justru pertanyaan "kenapa aku melakukan ini?".
//
// Tiga langkah, dan TIDAK ada tombol lewati:
//   1. Kenapa  — satu ayat & tiga kalimat, dibaca dulu.
//   2. Fokus   — satu hal saja, dari enam pilihan yang tajam.
//   3. Lepas   — apa yang benar-benar dilepas selama puasa ini.
//
// Tombol lanjut di langkah 2 & 3 baru hidup setelah ada yang dipilih. Itu
// satu-satunya "pemaksaan"-nya, dan memang di situlah inti puasanya.
export function FastingIntro({
  onDone,
  onCancel,
}: {
  /** Selesai → formulirnya dibuka dengan pokok doa & peraturan sudah terisi. */
  onDone: (pilihan: { focus: FastingFocus; rule: FastingRule }) => void;
  /** Mundur dari langkah pertama = batal membuat puasa baru. */
  onCancel: () => void;
}) {
  const [langkah, setLangkah] = useState(0);
  const [focus, setFocus] = useState<FastingFocus | null>(null);
  const [rule, setRule] = useState<FastingRule | null>(null);

  const bisaLanjut =
    langkah === 0 ? true : langkah === 1 ? focus !== null : rule !== null;

  function lanjut() {
    if (!bisaLanjut) return;
    if (langkah < 2) {
      setLangkah((n) => n + 1);
      return;
    }
    if (focus && rule) onDone({ focus, rule });
  }

  return (
    <View style={styles.flex}>
      {/* Tiga langkah, dan nomornya terlihat: yang tahu perjalanannya sependek
          apa tidak akan tergoda menerobos. */}
      <View style={styles.progressWrap}>
        <VixText heading="label" additionalStyle={styles.progressText}>
          Langkah {langkah + 1} dari 3
        </VixText>
        <ProgressBar
          value={langkah + 1}
          total={3}
          color={Color.SPIRITUAL_DARK}
          track={Color.CONTRAST_CONTAINER}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {langkah === 0 && (
          <>
            <VixText heading="title" additionalStyle={styles.judul}>
              🕊️ Kenapa puasa?
            </VixText>
            <View style={styles.ayatCard}>
              <PressableScale
                onPress={() => void openYouVersion(FASTING_WHY.verseRef)}>
                <VixText heading="bold" additionalStyle={styles.ayatRef}>
                  📖 {FASTING_WHY.verseRef}
                </VixText>
              </PressableScale>
              <VixText heading="paragraph" additionalStyle={styles.ayatText}>
                “{FASTING_WHY.verseText}”
              </VixText>
            </View>
            {FASTING_WHY.lines.map((l) => (
              <VixText key={l} heading="paragraph" additionalStyle={styles.paragraf}>
                {l}
              </VixText>
            ))}
          </>
        )}

        {langkah === 1 && (
          <>
            <VixText heading="title" additionalStyle={styles.judul}>
              🎯 Fokusnya satu saja
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.paragraf}>
              Puasa yang mendoakan sepuluh hal sekaligus biasanya tidak
              mendoakan apa pun dengan sungguh-sungguh. Pilih yang paling
              mendesak sekarang.
            </VixText>
            {FASTING_FOCUSES.map((f) => {
              const dipilih = focus?.key === f.key;
              return (
                <PressableScale
                  key={f.key}
                  style={[styles.pilihan, dipilih && styles.pilihanOn]}
                  onPress={() => setFocus(f)}>
                  <VixText
                    heading="bold"
                    additionalStyle={dipilih ? styles.pilihanJudulOn : styles.pilihanJudul}>
                    {f.emoji} {f.label}
                  </VixText>
                  <VixText
                    heading="label"
                    additionalStyle={dipilih ? styles.pilihanTanyaOn : styles.pilihanTanya}>
                    {f.ask}
                  </VixText>
                </PressableScale>
              );
            })}
          </>
        )}

        {langkah === 2 && (
          <>
            <VixText heading="title" additionalStyle={styles.judul}>
              🔒 Apa yang kamu lepas?
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.paragraf}>
              Yang dilepas harus terasa. Yang tidak terasa tidak akan
              mengingatkanmu pada apa pun.
            </VixText>
            {FASTING_RULES.map((r) => {
              const dipilih = rule?.key === r.key;
              return (
                <PressableScale
                  key={r.key}
                  style={[styles.pilihan, dipilih && styles.pilihanOn]}
                  onPress={() => setRule(r)}>
                  <VixText
                    heading="bold"
                    additionalStyle={dipilih ? styles.pilihanJudulOn : styles.pilihanJudul}>
                    {r.emoji} {r.label}
                  </VixText>
                  <VixText
                    heading="label"
                    additionalStyle={dipilih ? styles.pilihanTanyaOn : styles.pilihanTanya}>
                    {r.text}
                  </VixText>
                </PressableScale>
              );
            })}
            {focus && (
              <View style={styles.ringkasCard}>
                <VixText heading="label" additionalStyle={styles.ringkasLabel}>
                  🙏 Pokok doa yang akan terisi
                </VixText>
                <VixText heading="paragraph" additionalStyle={styles.ringkasText}>
                  {focus.prayer}
                </VixText>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale
          style={styles.backButton}
          onPress={() => (langkah === 0 ? onCancel() : setLangkah((n) => n - 1))}>
          <VixText heading="label" additionalStyle={styles.backText}>
            {langkah === 0 ? 'Batal' : 'Kembali'}
          </VixText>
        </PressableScale>
        <PrimaryButton
          label={langkah === 2 ? 'Lanjut isi tanggalnya' : 'Lanjut'}
          disabled={!bisaLanjut}
          onPress={lanjut}
          background={Color.SPIRITUAL_DARK}
          additionalStyle={styles.nextButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Napas di bawah bar kemajuannya dipasang di sini, bukan di paddingTop isi:
  // seluruh app memakai paddingTop 4 untuk isi layar berpita (lihat
  // cek-jarak-kartu.js), dan satu layar yang menyimpang bikin irama jaraknya
  // pecah.
  progressWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, gap: 6 },
  progressText: { color: Color.SPIRITUAL_DARK },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 10 },
  judul: { color: Color.SPIRITUAL_DEEP },
  ayatCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  ayatRef: { color: Color.SPIRITUAL_DEEP, textDecorationLine: 'underline' },
  ayatText: { color: Color.SPIRITUAL_DEEP, fontStyle: 'italic' },
  paragraf: { color: Color.TEXT_PARAGRAPH },
  pilihan: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 4,
  },
  // Yang dipilih jadi ungu pekat — satu saja, jadi tidak pernah ada dua kartu
  // gelap yang bersaing.
  pilihanOn: { backgroundColor: Color.SPIRITUAL_DEEP, borderColor: Color.SPIRITUAL_DEEP },
  pilihanJudul: { color: Color.TEXT_TITLE },
  pilihanJudulOn: { color: Color.TEXT_REVERSE },
  pilihanTanya: { color: Color.TEXT_LABEL },
  pilihanTanyaOn: { color: Color.SPIRITUAL },
  ringkasCard: {
    backgroundColor: Color.CONTAINER,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  ringkasLabel: { color: Color.SPIRITUAL_DARK },
  ringkasText: { color: Color.TEXT_TITLE },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  backButton: { paddingHorizontal: 16, paddingVertical: 12 },
  backText: { color: Color.TEXT_LABEL },
  nextButton: { flex: 1 },
});
