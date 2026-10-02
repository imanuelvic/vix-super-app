import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color, DAYPART_SHADE } from '@/assets/style/color';
import { SCREEN_CONTENT } from '@/assets/style/layout';
import { ACTION_GAP } from '@/assets/style/space';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { BibleRefTone } from '@/components/spiritual/BibleRefList';
import { JourneyToneProvider } from '@/components/spiritual/journey/JourneyCard';
import { JourneyTrail } from '@/components/spiritual/journey/JourneyTrail';
import {
  CloseStep,
  OpenStep,
  ReadStep,
  ReceiveStep,
  VerseStep,
  type SaveBibleJourney,
} from '@/components/spiritual/journey/BibleSteps';
import { useDraft } from '@/hooks/useDraft';
import {
  bibleJourneySteps,
  nextBibleStep,
  type BibleStepKey,
} from '@/lib/bibleJourney';
import { formatFullDate } from '@/lib/format';
import {
  bibleSessionMeta,
  type BibleReadingNote,
  type BibleSession,
} from '@/lib/spiritual';

// Bible Journey 📖 — layar baca Alkitab sebagai PERJALANAN, satu langkah pada
// satu waktu (2 Okt 2026). Bentuknya mengikuti Morning Journey 🌅: jejak
// langkah di atas, satu kartu putih di tengah, dan kaki layar yang tenang.
//
// Dulu ini SATU halaman berisi hitung mundur, kartu reminder, daftar acuan,
// kotak ringkasan, lalu tiga tombol bertumpuk. Semuanya terlihat sekaligus,
// jadi yang terasa "sudah terisi belum", bukan "aku baru saja membaca".
// Yang hilang cuma kesesakannya: jendela jamnya, rekomendasi pasal, tanda
// dilewati, Story, dan streak-nya semua masih ada, masing-masing di langkah
// tempat ia memang berarti.
//
// WARNANYA IKUT SESI, bukan ikut fitur. Latar ungu Spiritual menjawab
// pertanyaan yang salah di sini: yang ingin terasa "ini pagi" atau "ini
// malam". Paletnya `DAYPART_SHADE` di assets/style/color.ts.
//
// Layar ini cuma mengurus TAMPILAN & urutan langkah; langganan dan penyimpanan
// datanya ada di app/bible-reading.tsx, sama seperti pasangan
// MorningJourney.tsx & app/morning-journey.tsx.
export function BibleJourney({
  session,
  reminder,
  minutesLeft,
  streak,
  initialRefs,
  initialVersion,
  note,
  hint,
  ready,
  skipped,
  canSkip,
  busy,
  error,
  onOpenBible,
  onSaveRead,
  onSaveJourney,
  onShare,
  onDone,
  onSkip,
  onOpenReward,
  onBack,
}: {
  session: BibleSession;
  /** Kalimat reminder yang diundi per hari. */
  reminder: string;
  /** Sisa menit sampai jendela sesi ini tutup; ≤ 0 = sudah lewat. */
  minutesLeft: number;
  /** Streak 🔥 sesi ini yang MASIH hidup hari ini. */
  streak: number;
  /** Acuan awal: catatan hari ini kalau sudah ada, kalau belum saran pasalnya. */
  initialRefs: string[];
  initialVersion: string;
  /** Isian ✨ Receive & 💛 Verse yang sudah tersimpan hari ini. */
  note: BibleReadingNote;
  /** Baris saran "💡 Lanjutan dari Amsal 26"; null = belum ada riwayatnya. */
  hint: string | null;
  /**
   * Dokumen bacaan hari ini sudah terbaca dari Firestore. Sebelum itu "✅
   * Sudah baca" dimatikan: streak "lengkap" dihitung dari isi hari ini, dan
   * menghitungnya dari data yang belum sampai akan menebak.
   */
  ready: boolean;
  /** Sesi ini sedang berstatus dilewati. */
  skipped: boolean;
  /** Tombol lewati masih ada gunanya (lihat app/bible-reading.tsx). */
  canSkip: boolean;
  busy: boolean;
  error: string | null;
  onOpenBible: (passage: string, version: string) => void;
  /** Simpan acuan & terjemahannya (langkah 📖 Read) — belum menaikkan streak. */
  onSaveRead: (passage: string, version: string) => Promise<void>;
  onSaveJourney: SaveBibleJourney;
  onShare: (passage: string, version: string) => void;
  /** "✅ Sudah baca": simpan, naikkan streak 🔥, lalu ke arsipnya. */
  onDone: (passage: string, version: string) => Promise<void>;
  onSkip: () => void;
  onOpenReward: () => void;
  onBack: () => void;
}) {
  const shade = DAYPART_SHADE[session];
  const meta = bibleSessionMeta(session);
  const steps = useMemo(() => bibleJourneySteps(session), [session]);
  const [step, setStep] = useState<BibleStepKey>('open');
  const [skipConfirm, setSkipConfirm] = useState(false);

  // Acuan & terjemahannya dipegang DI SINI, bukan di langkah 📖 Read: langkah
  // 🕊️ Close ikut membacanya untuk ringkasan & untuk Story. Keduanya tetap
  // ikut data yang menyusul dari Firestore selama belum diketik (useDraft).
  const [refs, setRefs] = useDraft<string[]>(initialRefs);
  const [version, setVersion] = useDraft(initialVersion);

  const filled = refs.map((r) => r.trim()).filter(Boolean);
  const passage = filled.join(', ');

  // Warna isi kartu (nama langkah, tombol, kotak) & warna kartu acuan.
  const tone = useMemo(
    () => ({ accent: shade.accent, soft: shade.soft }),
    [shade],
  );
  const refTone: BibleRefTone = useMemo(
    () => ({ soft: shade.soft, accent: shade.accent, hint: shade.accent }),
    [shade],
  );

  function next() {
    const n = nextBibleStep(step);
    if (n) setStep(n);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: shade.paper }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* Kepala layar yang sangat ringan: jalan pulang, judul sesi, dan
              angka streak-nya. SENGAJA bukan <ScreenHeader/> — pita header itu
              selalu sewarna FITUR (ungu Spiritual), dan di layar yang warnanya
              justru ikut jam, pita ungu itu satu-satunya benda yang tidak ikut
              sesi mana pun. */}
          <View style={styles.topRow}>
            <PressableScale style={styles.backRow} onPress={onBack} hitSlop={8}>
              <IconSymbol name="chevron.left" size={22} color={shade.ink} />
              <VixText heading="bold" additionalStyle={{ color: shade.ink }}>
                Home
              </VixText>
            </PressableScale>

            {/* 🔥 Pencapaiannya, bukan sekadar pintu ke Reward: angkanya
                terbaca langsung, dan di-click membuka kategori sesi ini. */}
            <PressableScale
              style={[styles.streakPill, { backgroundColor: shade.accent }]}
              onPress={onOpenReward}
              hitSlop={8}>
              <VixText heading="bold" additionalStyle={styles.streakText}>
                🔥 {streak}
              </VixText>
            </PressableScale>
          </View>

          <VixText heading="header" additionalStyle={{ color: shade.ink }}>
            {meta.title} {meta.emoji}
          </VixText>
          {/* Mazmur 1:2 / Yosua 1:8 — merenungkan firman-Nya siang & malam.
              Layar ini punya tiga sesi, jadi kalimatnya sekaligus menjelaskan
              kenapa bacanya dibagi tiga. */}
          <VixText heading="label" additionalStyle={{ color: shade.muted }}>
            Merenungkan firman-Nya pagi, siang & malam
          </VixText>
          <VixText heading="label" additionalStyle={[styles.date, { color: shade.muted }]}>
            📅 {formatFullDate(new Date())}
          </VixText>

          <JourneyTrail
            steps={steps}
            current={step}
            onJump={setStep}
            dotColor={shade.ink}
          />

          {/* key = langkah → kartunya lahir baru tiap berpindah, jadi isian
              draf langkah sebelumnya tidak menempel & animasi masuknya jalan. */}
          <JourneyToneProvider tone={tone}>
            <View key={step}>
              {step === 'open' ? (
                <OpenStep
                  session={session}
                  reminder={reminder}
                  minutesLeft={minutesLeft}
                  onNext={next}
                />
              ) : step === 'read' ? (
                <ReadStep
                  session={session}
                  refs={refs}
                  onRefs={setRefs}
                  version={version}
                  onVersion={setVersion}
                  hint={hint}
                  refTone={refTone}
                  onOpenBible={() => onOpenBible(filled[0] ?? '', version)}
                  onSave={onSaveRead}
                  onNext={next}
                />
              ) : step === 'receive' ? (
                <ReceiveStep
                  session={session}
                  note={note}
                  onSave={onSaveJourney}
                  onNext={next}
                />
              ) : step === 'verse' ? (
                <VerseStep
                  session={session}
                  note={note}
                  onSave={onSaveJourney}
                  onNext={next}
                />
              ) : (
                <CloseStep
                  session={session}
                  passage={passage}
                  version={version}
                  verse={note.verse}
                  canShare={filled.length > 0}
                  onShare={() => onShare(passage, version)}
                  onDone={() => void onDone(passage, version)}
                  ready={ready}
                  busy={busy}
                  error={error}
                />
              )}
            </View>
          </JourneyToneProvider>

          {/* Kaki layar: jujur lebih baik daripada mengarang bacaan demi
              streak. Tombolnya HILANG begitu jendelanya habis tanpa sesi ini
              terisi — saat itu Habits sudah menandainya ✗ sendiri, jadi ia tak
              lagi menawarkan apa pun. */}
          {canSkip && (
            <View style={styles.footer}>
              {skipped && (
                <VixText
                  heading="label"
                  additionalStyle={[styles.footerText, { color: shade.muted }]}>
                  ⏭️ Hari ini ditandai dilewati. Streak 🔥 tidak bertambah.
                </VixText>
              )}
              <PressableScale
                style={styles.skipButton}
                onPress={skipped ? onSkip : () => setSkipConfirm(true)}>
                <VixText
                  heading="label"
                  additionalStyle={[styles.footerText, { color: shade.muted }]}>
                  {skipped
                    ? '↩️ Batalkan lewati'
                    : `${meta.label} ini tidak memungkinkan? Lewati untuk hari ini`}
                </VixText>
              </PressableScale>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Konfirmasi tenang (bukan merah), sama seperti Morning Journey:
          streak-nya memang tidak naik, tapi itu disebut sebagai keterangan. */}
      <ConfirmDialog
        visible={skipConfirm}
        title={`Lewati baca ${meta.label.toLowerCase()} hari ini?`}
        detail="Tidak apa-apa. Streak 🔥 sengaja tidak dinaikkan supaya angkanya tetap jujur, dan besok sesi ini menunggumu lagi."
        confirmLabel="Lewati"
        danger={false}
        onCancel={() => setSkipConfirm(false)}
        onConfirm={() => {
          setSkipConfirm(false);
          onSkip();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { ...SCREEN_CONTENT, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  // Tanpa paddingLeft: chevron-nya sendiri sudah memberi tepi optis.
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  streakPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  streakText: { color: Color.TEXT_REVERSE },
  date: { marginTop: 2 },
  footer: { alignItems: 'center', gap: 2, marginTop: ACTION_GAP },
  skipButton: { paddingVertical: 12, paddingHorizontal: 12 },
  footerText: { textAlign: 'center' },
});
