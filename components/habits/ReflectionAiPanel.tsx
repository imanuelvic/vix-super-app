import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormError } from '@/components/common/FormError';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SoftPill } from '@/components/common/SoftPill';
import { VixText } from '@/components/common/VixText';
import {
  generateReflection,
  loadReflectionAiDay,
  reflectionAiErrorMessage,
  reflectionAttemptsLeft,
  reflectionReady,
  saveReflectionAiDay,
  REFLECTION_DAILY_CAP,
  type ReflectionAiDay,
} from '@/lib/reflectionAi';
import { designOf } from '@/lib/shareImage';

// ✨ AI Reflection di dalam sheet 📓 Daily Reflection Journal.
//
// Duduk DI BAWAH kolom tulisannya, sebagai pelengkap: jurnalnya tetap milik
// penulis, AI cuma membantu merapikan dan menemukan renungannya. Alurnya:
//
//   [✨ Generate with AI]  → hidup begitu tulisannya cukup (aturan centang)
//          ↓ "AI is reflecting…"
//   ┌ AI REFLECTION ✨ ─────────────┐   lembar "sage" vixtory.archive, supaya
//   │ hasil                        │   jelas ini bukan tulisan aslinya
//   │ [Use This Reflection]        │   → mengganti isi kolom; bisa dikembalikan
//   │  Try Again · Dismiss         │   → minta lagi / sembunyikan (hasil tetap)
//   └──────────────────────────────┘
//
// Jatah SEKALI sehari untuk tombol utamanya; "Try Again" sampai total
// REFLECTION_DAILY_CAP. Hasil & hitungannya disimpan per hari (AsyncStorage),
// jadi membuka sheet lagi menampilkan hasil yang sama tanpa memanggil AI.
// Gagal (offline, kuota 429, dsb.) cuma menampilkan pesan; tidak ada
// percobaan ulang otomatis, dan jurnalnya tetap bisa disimpan seperti biasa.
const SAGE = designOf('sage');

export function ReflectionAiPanel({
  dayId,
  text,
  onUse,
}: {
  dayId: string;
  /** Tulisan yang sedang ada di kolom (draf, belum tentu tersimpan). */
  text: string;
  /** Ganti isi kolom dengan teks ini (Use / Kembalikan). */
  onUse: (text: string) => void;
}) {
  // null = jatah hari ini belum terbaca dari penyimpanan (sekejap).
  const [day, setDay] = useState<ReflectionAiDay | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dismiss menyembunyikan lembarnya, hasilnya tetap ada.
  const [shown, setShown] = useState(true);
  // Tulisan sebelum "Use", supaya bisa dikembalikan tanpa dialog.
  const [sebelum, setSebelum] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    loadReflectionAiDay(dayId).then((d) => {
      if (hidup) setDay(d);
    });
    return () => {
      hidup = false;
    };
  }, [dayId]);

  async function minta() {
    if (busy || !day) return;
    const attempt = day.attempts + 1;
    if (attempt > REFLECTION_DAILY_CAP) return;
    setBusy(true);
    setError(null);
    try {
      const hasil = await generateReflection(text, dayId, attempt);
      const baru = { attempts: attempt, result: hasil };
      setDay(baru);
      setShown(true);
      setSebelum(null);
      await saveReflectionAiDay(dayId, baru);
    } catch (e) {
      setError(reflectionAiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function pakai() {
    if (!day?.result) return;
    setSebelum(text);
    onUse(day.result);
  }

  function kembalikan() {
    if (sebelum === null) return;
    onUse(sebelum);
    setSebelum(null);
  }

  if (!day) return null;

  const sisa = reflectionAttemptsLeft(day);
  const siap = reflectionReady(text);

  return (
    <View style={styles.wrap}>
      {busy ? (
        <SoftPill label="AI is reflecting…" busy onPress={minta} />
      ) : day.result && !shown ? (
        <SoftPill label="✨ Lihat refleksi AI" onPress={() => setShown(true)} />
      ) : !day.result ? (
        <SoftPill
          label="✨ Generate with AI"
          onPress={minta}
          disabled={!siap}
          additionalStyle={!siap && styles.pillOff}
        />
      ) : null}

      <FormError message={error} gap="none" />

      {day.result && shown ? (
        <View style={styles.card}>
          <VixText heading="label" additionalStyle={styles.eyebrow}>
            AI REFLECTION ✨
          </VixText>
          <VixText heading="paragraph" additionalStyle={styles.body}>
            {day.result}
          </VixText>

          {sebelum === null ? (
            <PrimaryButton
              label="Use This Reflection"
              onPress={pakai}
              background={SAGE.ink}
            />
          ) : (
            <View style={styles.usedRow}>
              <VixText heading="label" additionalStyle={styles.usedText}>
                ✓ Dipakai di jurnalmu
              </VixText>
              <PressableScale onPress={kembalikan} hitSlop={8}>
                <VixText heading="label" additionalStyle={styles.link}>
                  Kembalikan tulisan asli
                </VixText>
              </PressableScale>
            </View>
          )}

          <View style={styles.actions}>
            <PressableScale onPress={minta} disabled={sisa === 0} hitSlop={8}>
              <VixText
                heading="label"
                additionalStyle={[styles.link, sisa === 0 && styles.linkOff]}>
                {sisa === 0 ? 'Try Again (jatah hari ini habis)' : `Try Again · ${sisa} lagi`}
              </VixText>
            </PressableScale>
            <VixText heading="label" additionalStyle={styles.dot}>
              ·
            </VixText>
            <PressableScale onPress={() => setShown(false)} hitSlop={8}>
              <VixText heading="label" additionalStyle={styles.link}>
                Dismiss
              </VixText>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 4 },
  // Belum boleh (tulisannya belum cukup) → pudar.
  pillOff: { opacity: 0.45 },
  // Lembar "sage" vixtory.archive: kertas hijau pucat, tinta hijau tua.
  card: {
    backgroundColor: SAGE.paper,
    borderWidth: 1,
    borderColor: SAGE.rule,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  // Kop yang sama dengan kartu Feed ("DAILY REFLECTION"): kecil, renggang.
  eyebrow: { color: SAGE.muted, letterSpacing: 2 },
  body: { color: SAGE.ink },
  usedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usedText: { color: SAGE.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { color: SAGE.muted, textDecorationLine: 'underline' },
  linkOff: { opacity: 0.5, textDecorationLine: 'none' },
  dot: { color: SAGE.muted },
});
