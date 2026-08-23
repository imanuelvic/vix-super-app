import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BibleRefField } from '@/components/common/BibleRefField';
import { FormError } from '@/components/common/FormError';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SkipButton, SkipNotice } from '@/components/common/SkipToday';
import { VixText } from '@/components/common/VixText';
import { SpiritualIntro } from '@/components/spiritual/SpiritualIntro';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import { formatMinutesLeft } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { SAVE_ERROR } from '@/lib/messages';
import {
  BIBLE_SKIPPED,
  bibleDayComplete,
  bibleMinutesLeft,
  bibleSessionMeta,
  bibleSessionOf,
  bumpBibleStreaks,
  dailyReminder,
  EMPTY_BIBLE_STREAKS,
  isBibleSkipped,
  saveBibleReading,
  subscribeBibleReadingToday,
  subscribeBibleStreaks,
  type BibleReadingSessions,
  type BibleStreaks,
} from '@/lib/spiritual';

// Layar catat bacaan Alkitab 📖 — dibuka dari kartu Morning/Night Bible
// Reading di HOME (di bawah kartu sapaan). Dibuat halaman penuh (bukan modal)
// karena pemilih kitab sendiri sudah memakai modal; modal di atas modal tidak
// andal di iOS.
export default function BibleReadingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { session: sessionParam } = useLocalSearchParams<{ session?: string }>();
  const session = bibleSessionOf(sessionParam);
  const meta = bibleSessionMeta(session);

  // Jam BERJALAN (di-segarkan tiap menit) — untuk hitung mundur jendela baca.
  const { now } = useNow();

  // Beberapa acuan sekaligus — kalau hari itu baca lebih dari satu kitab.
  const [refs, setRefs] = useState<string[]>(['']);
  const [today, setToday] = useState<BibleReadingSessions | null>(null);
  const [streaks, setStreaks] = useState<BibleStreaks>(EMPTY_BIBLE_STREAKS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayId = dayDocId(new Date());

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeBibleReadingToday(user.uid, dayId, setToday),
      subscribeBibleStreaks(user.uid, setStreaks),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

  // Sudah pernah diisi hari ini → tampilkan lagi supaya bisa ditambah/dibetulkan.
  // Hari yang dilewati tidak punya acuan, jadi kolomnya dibiarkan kosong.
  const existing = today?.[session] ?? '';
  const skipped = isBibleSkipped(existing);
  useEffect(() => {
    if (existing && !isBibleSkipped(existing)) {
      setRefs(existing.split(',').map((s) => s.trim()));
    }
  }, [existing]);

  const filled = refs.map((r) => r.trim()).filter(Boolean);

  // Sisa waktu jendela sesi ini. ≤ 0 = sudah lewat; ≤ 30 menit = aba-aba merah.
  const minutesLeft = bibleMinutesLeft(session, now);
  const closingSoon = minutesLeft <= 30;

  function setRefAt(index: number, ref: string) {
    setRefs((list) => list.map((r, i) => (i === index ? ref : r)));
  }

  function removeRefAt(index: number) {
    setRefs((list) => list.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!user || !today || filled.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveBibleReading(user.uid, dayId, session, filled.join(', '));
      // "Lengkap" = KETIGA sesi hari ini terisi setelah simpan ini.
      await bumpBibleStreaks(
        user.uid,
        streaks,
        dayId,
        session,
        bibleDayComplete(today, session),
      );
      router.back();
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Lewati sesi hari ini. Kartu reminder di Home berhenti menagih, tapi
   * streak 🔥 SENGAJA tidak dinaikkan — supaya angkanya tetap jujur.
   * Menekannya lagi (saat sudah dilewati) membatalkan status itu.
   */
  async function handleSkip() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveBibleReading(
        user.uid,
        dayId,
        session,
        skipped ? '' : BIBLE_SKIPPED,
      );
      if (!skipped) router.back();
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title={`${meta.title} ${meta.emoji}`}
        subtitle="Pilih kitab, lalu isi pasal & ayatnya"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hitung mundur jendela baca — supaya jelas "sampai jam berapa ini
            masih terhitung tepat waktu", bukan menebak-nebak. Hanya muncul
            selagi sesi ini belum diisi & belum dilewati (kalau sudah, kotak
            ringkasan / pemberitahuan "dilewati" yang bicara). Merah di 30
            menit terakhir — aba-aba yang sama seperti gerbang doa pagi. */}
        {!existing && (
          <View
            style={[styles.countdown, closingSoon && styles.countdownSoon]}>
            <VixText
              heading="bold"
              additionalStyle={
                closingSoon ? styles.countdownSoonText : styles.countdownText
              }>
              {minutesLeft > 0
                ? `⏳ Tinggal ${formatMinutesLeft(minutesLeft)}`
                : `⌛ Jendela ${meta.label.toLowerCase()} sudah lewat`}
            </VixText>
            <VixText heading="label" additionalStyle={styles.countdownSub}>
              {minutesLeft > 0
                ? `Jendela ${meta.emoji} ${meta.label} tutup jam ${meta.toHour}.00. Lewat itu kartunya hilang dari Home & hari ini terlewat.`
                : `Jam ${meta.fromHour}.00–${meta.toHour}.00 sudah habis. Masih boleh dicatat sekarang — yang hilang cuma kartunya di Home.`}
            </VixText>
          </View>
        )}

        {/* Reminder hari ini + pintasan NDC Ministry — bentuk & isinya sama
            dengan Tulis Revive. Undiannya diberi garam berbeda per sesi, jadi
            pagi, malam, & Revive tidak menampilkan kalimat yang sama persis. */}
        <SpiritualIntro reminder={dailyReminder(dayId, `baca-${session}`)} />

        {refs.map((ref, i) => (
          <View key={i} style={styles.refCard}>
            <View style={styles.refTop}>
              <VixText heading="bold" additionalStyle={styles.refTitle}>
                Bacaan {i + 1}
              </VixText>
              {refs.length > 1 && (
                <PressableScale onPress={() => removeRefAt(i)} hitSlop={10}>
                  <VixText heading="label" additionalStyle={styles.removeText}>
                    Hapus
                  </VixText>
                </PressableScale>
              )}
            </View>
            <BibleRefField
              value={ref}
              onChange={(next) => setRefAt(i, next)}
              editable={!busy}
            />
          </View>
        ))}

        {/* Baca lebih dari satu kitab hari ini? Tambah baris baru. */}
        <PressableScale
          style={styles.addButton}
          onPress={() => setRefs((list) => [...list, ''])}>
          <VixText heading="bold" additionalStyle={styles.addText}>
            ➕ Tambah kitab lain
          </VixText>
        </PressableScale>

        {filled.length > 0 && (
          <View style={styles.summaryCard}>
            <VixText heading="label" additionalStyle={styles.summaryLabel}>
              Tersimpan sebagai
            </VixText>
            <VixText heading="bold" additionalStyle={styles.summaryText}>
              {filled.join(', ')}
            </VixText>
          </View>
        )}

        <FormError message={error} />

        {/* Sedang berstatus dilewati → beri tahu, dan tombolnya jadi pembatal */}
        {skipped && (
          <SkipNotice
            title="⏭️ Dilewati hari ini"
            detail={
              '🔥 Streak tidak bertambah'
            }
            additionalStyle={styles.skippedGap}
          />
        )}

        {/* Aktif setelah minimal satu bacaan terisi (handleSave juga menjaga). */}
        <PrimaryButton
          label="✅ Sudah baca"
          busy={busy}
          onPress={handleSave}
          additionalStyle={[
            styles.save,
            filled.length === 0 && styles.saveDisabled,
          ]}
        />

        {/* Jujur lebih baik daripada mengarang bacaan demi streak. */}
        <SkipButton
          skipped={skipped}
          label="⏭️ Lewati baca hari ini"
          busy={busy}
          onPress={handleSkip}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  // Hitung mundur jendela baca. Tenang (krem) selama masih longgar, merah
  // samar di 30 menit terakhir — dua keadaan, bukan warna yang berkedip.
  countdown: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    marginBottom: 10,
  },
  countdownSoon: { backgroundColor: Color.DANGER_TRANSPARENT },
  countdownText: { color: Color.ACCENT_DARK },
  countdownSoonText: { color: Color.DANGER },
  countdownSub: { color: Color.TEXT_LABEL },
  refCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  refTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  refTitle: { color: Color.SPIRITUAL_DARK },
  removeText: { color: Color.DANGER },
  addButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Color.SPIRITUAL_DARK,
    marginBottom: 12,
  },
  addText: { color: Color.SPIRITUAL_DARK },
  summaryCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    marginBottom: 12,
  },
  summaryLabel: { color: Color.TEXT_LABEL },
  summaryText: { color: Color.TEXT_TITLE },
  save: { marginBottom: 10 },
  saveDisabled: { opacity: 0.45 },
  // Bentuk kartunya ada di components/common/SkipToday.tsx — di sini cukup
  // jaraknya saja, karena tiap layar menaruhnya di posisi berbeda.
  skippedGap: { marginBottom: 12 },
});
