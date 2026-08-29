import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { AchievementButton } from '@/components/common/AchievementButton';
import { BibleRefField } from '@/components/common/BibleRefField';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SkipButton, SkipNotice } from '@/components/common/SkipToday';
import { VixText } from '@/components/common/VixText';
import { SpiritualIntro } from '@/components/spiritual/SpiritualIntro';
import { useAuth } from '@/contexts/auth';
import { useDraft } from '@/hooks/useDraft';
import { useNow } from '@/hooks/useNow';
import { BIBLE_CATEGORY } from '@/lib/achievements';
import { formatFullDate, formatMinutesLeft } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { unsubscribeAll } from '@/lib/liveDoc';
import { SAVE_ERROR } from '@/lib/messages';
import {
  BIBLE_SKIPPED,
  BIBLE_VERSION_DEFAULT,
  bibleDayComplete,
  bibleMinutesLeft,
  bibleRefWithVersion,
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
  type BibleReadingVersions,
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

  const [today, setToday] = useState<BibleReadingSessions | null>(null);
  const [versions, setVersions] = useState<BibleReadingVersions | null>(null);
  const [streaks, setStreaks] = useState<BibleStreaks>(EMPTY_BIBLE_STREAKS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayId = dayDocId(new Date());

  useEffect(() => {
    if (!user) return;
    return unsubscribeAll([
      subscribeBibleReadingToday(user.uid, dayId, (sessions, versi) => {
        setToday(sessions);
        setVersions(versi);
      }),
      subscribeBibleStreaks(user.uid, setStreaks),
    ]);
  }, [user, dayId]);

  // Sudah pernah diisi hari ini → tampilkan lagi supaya bisa ditambah/dibetulkan.
  // Hari yang dilewati tidak punya acuan, jadi kolomnya dibiarkan kosong.
  const existing = today?.[session] ?? '';
  const skipped = isBibleSkipped(existing);

  // Beberapa acuan sekaligus — kalau hari itu baca lebih dari satu kitab.
  // Isinya ikut catatan tersimpan SELAMA belum diketik (hook bersama useDraft),
  // jadi begitu datanya sampai kolomnya langsung terisi — tanpa efek yang
  // menimpa ketikan yang sedang berjalan.
  const [refs, setRefs] = useDraft<string[]>(
    existing && !skipped ? existing.split(',').map((s) => s.trim()) : [''],
  );

  // Terjemahan yang dibaca ("TB", "BIS", "NIV", …). Bebas diketik: daftar
  // terjemahan di YouVersion terlalu panjang untuk dijadikan pilihan, dan
  // yang kamu pakai sehari-hari cuma segelintir. Kosong = TB.
  const [version, setVersion] = useDraft<string>(
    versions?.[session] ?? BIBLE_VERSION_DEFAULT,
  );

  const filled = refs.map((r) => r.trim()).filter(Boolean);
  const versiTerpakai = version.trim() || BIBLE_VERSION_DEFAULT;

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
      await saveBibleReading(
        user.uid,
        dayId,
        session,
        filled.join(', '),
        versiTerpakai,
      );
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
        // Mazmur 1:2 / Yosua 1:8 — merenungkan firman-Nya siang & malam.
        // Layar ini punya tiga sesi (pagi, siang, malam), jadi kalimatnya
        // sekaligus menjelaskan kenapa bacanya dibagi tiga.
        subtitle="Merenungkan firman-Nya pagi, siang & malam"
        // Layar ini SATU sesi saja, jadi modal yang dibuka pun sesi itu:
        // pagi 🌅 / siang 🌤️ / malam 🌙 — bukan daftar semua kategori.
        right={<AchievementButton category={BIBLE_CATEGORY[session]} />}>
        {/* Tanggalnya, sama seperti layar rohani lain (Tulis Revive, Catatan
            Khotbah): catatan bacaan itu melekat pada HARI tertentu, jadi
            harinya harus kelihatan tanpa perlu diingat-ingat. */}
        <VixText heading="label" additionalStyle={styles.dateLine}>
          📅 {formatFullDate(now)}
        </VixText>
      </ScreenHeader>

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

        {/* Reminder hari ini + pintasan ke YouVersion — bentuknya sama dengan
            Tulis Revive, tapi tujuan tombolnya beda: di sini yang dibuka
            ALKITABNYA (YouVersion), bukan renungan NDC. Undiannya diberi garam
            berbeda per sesi, jadi pagi, malam, & Revive tidak menampilkan
            kalimat yang sama persis. */}
        {/* Begitu bacaannya diisi, tombolnya tidak lagi cuma "buka app": ia
            membuka PASAL ITU. Acuan pertama yang dipakai — kalau ada beberapa
            kitab, sisanya tinggal di-click dari riwayatnya. */}
        <SpiritualIntro
          reminder={dailyReminder(dayId, `baca-${session}`)}
          app="youversion"
          passage={filled[0]}
          version={versiTerpakai}
        />

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

        {/* Terjemahan yang dibaca. Satu untuk seluruh bacaan hari itu —
            praktisnya memang begitu: satu app dibuka, satu terjemahan dipilih,
            lalu semua pasalnya dibaca di situ. */}
        <View style={styles.versionRow}>
          <VixText heading="label" additionalStyle={styles.versionLabel}>
            Terjemahan
          </VixText>
          <FormInput
            placeholder={BIBLE_VERSION_DEFAULT}
            value={version}
            onChangeText={setVersion}
            editable={!busy}
            autoCapitalize="characters"
            maxLength={12}
            style={styles.versionInput}
          />
        </View>

        {filled.length > 0 && (
          <View style={styles.summaryCard}>
            <VixText heading="label" additionalStyle={styles.summaryLabel}>
              Tersimpan sebagai
            </VixText>
            <VixText heading="bold" additionalStyle={styles.summaryText}>
              {bibleRefWithVersion(filled.join(', '), versiTerpakai)}
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

        {/* OPSIONAL — bacaan hari ini jadi Story Instagram 9:16 bertanda
            `vixtory.archive`, sekeluarga dengan Feed refleksi harian.
            Acuannya dioper apa adanya lewat parameter (pendek), jadi Story
            bisa dibuat walau bacaannya belum ditekan "Sudah baca". Baru
            muncul setelah ada isinya — tanpa acuan tak ada yang bisa
            dipajang. */}
        {filled.length > 0 && (
          <>
            <View style={styles.storyDivider} />
            <PressableScale
              style={styles.storyRow}
              onPress={() =>
                router.push({
                  pathname: '/bible-story',
                  params: { session, refs: filled.join(', ') },
                })
              }>
              <VixText heading="bold" additionalStyle={styles.storyText}>
                📖 Bagikan ayatnya ke Instagram Story
              </VixText>
            </PressableScale>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  dateLine: { marginTop: 2 },
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
  // Pemisah tipis: yang di bawahnya bonus, bukan bagian dari mencatat bacaan.
  storyDivider: {
    height: 1,
    backgroundColor: Color.BORDER,
    marginTop: 22,
    marginBottom: 14,
  },
  storyRow: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2,
  },
  storyText: { color: Color.SPIRITUAL_DARK },
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
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  versionLabel: { color: Color.TEXT_LABEL },
  // Sempit: isinya cuma singkatan 2–4 huruf (TB, BIS, NIV, TSI).
  versionInput: { flex: 1, maxWidth: 140 },
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
