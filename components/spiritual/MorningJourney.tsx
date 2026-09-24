import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ACTION_GAP } from '@/assets/style/space';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { JourneyTrail } from '@/components/spiritual/journey/JourneyTrail';
import {
  ArriveStep,
  CloseStep,
  PrayStep,
  ReceiveStep,
  ReflectStep,
  RespondStep,
  WorshipStep,
  type ChainLeader,
  type SaveJourney,
} from '@/components/spiritual/journey/JourneySteps';
import { type IntercessionTopic } from '@/lib/intercession';
import {
  nextJourneyStep,
  reflectPromptOfDay,
  worshipSongOfDay,
  type JourneyStepKey,
} from '@/lib/journey';
import {
  dailyReminder,
  worshipPassageOfDay,
  type ReviveEntry,
} from '@/lib/spiritual';

export type { ChainLeader } from '@/components/spiritual/journey/JourneySteps';

// Morning Journey 🌅 — layar PENUH pagi hari (di luar tab, tidak bisa
// di-swipe balik), sekali sehari sampai jam 09.00. Yang mengarahkan ke sini
// <MorningJourneyGate/> di app/_layout.tsx, jadi berlaku dari layar mana pun.
//
// Dulu ini "gerbang doa pagi": daftar 4–5 langkah bernomor dengan centang, dan
// tombol konfirmasi yang baru hidup setelah semuanya dicentang. Sekarang satu
// langkah pada satu waktu, tanpa centang, tanpa hitungan; kuncinya tetap
// (streak 🙏 dicatat saat "Mulai Hariku"), tapi kata-katanya tidak lagi
// menagih. Ke mana tiap isian tersimpan: lib/journey.ts.
export function MorningJourney({
  todayId,
  entry,
  reviveReady,
  journal,
  chainDue,
  chainLeft,
  chainLeaders,
  topic,
  minutesLeft,
  onSaveRevive,
  onSaveReflect,
  onPrayLeader,
  onConfirm,
  onSkip,
  onLater,
}: {
  todayId: string;
  /** Revive hari ini (null = belum ada dokumennya). */
  entry: ReviveEntry | null;
  /** Revive hari ini sudah terbaca dari Firestore. */
  reviveReady: boolean;
  /** 📓 Daily Reflection Journal hari ini; null = daftar kebiasaan belum terbaca. */
  journal: { text: string; available: boolean } | null;
  // Doa Rantai CL (Selasa & Kamis) — sumber hitungannya sama dengan Dashboard.
  chainDue: boolean;
  chainLeft: number;
  chainLeaders: ChainLeader[];
  /** Pokok doa syafaat hari ini (Senin Keluarga·Kesehatan, dst). */
  topic: IntercessionTopic;
  /** Sisa menit sampai jendela pagi tutup (jam 09.00). */
  minutesLeft: number;
  onSaveRevive: SaveJourney;
  onSaveReflect: (text: string) => Promise<void>;
  onPrayLeader: (leader: ChainLeader) => void;
  /** "Mulai Hariku": catat streak, lalu ke Home. */
  onConfirm: () => Promise<void>;
  /** Lewati pagi ini (streak mulai dari awal), langsung ke Home. */
  onSkip: () => void;
  /** "Nanti dulu": tutup undangan tanpa hukuman (gerbang lunak, 22 Sep 2026). */
  onLater: () => void;
}) {
  const [step, setStep] = useState<JourneyStepKey>('arrive');
  const [busy, setBusy] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);

  // Dibekukan sekali seumur layar: kalau dihitung ulang tiap render, lagu &
  // pertanyaannya bisa berganti persis tengah malam, di tengah kamu menulis.
  const [song] = useState(() => worshipSongOfDay(todayId));
  const [prompt] = useState(() => reflectPromptOfDay(todayId));
  const [passage] = useState(() => worshipPassageOfDay(todayId));
  const [reminder] = useState(() => dailyReminder(todayId));

  // Satu jam sebelum 09.00 diberi tahu pelan, tanpa nada peringatan. Lewat
  // 09.00 journey tetap bisa dijalani (gerbang lunak); yang disebut cuma
  // kenyataannya: jendela pagi sudah lewat.
  const closingSoon = minutesLeft > 0 && minutesLeft <= 60;
  const stillOpen = minutesLeft > 0;

  // Langkah 🙏 Pray tetap SATU blok syafaat, hari apa pun: saat Doa Rantai CL
  // memang giliran hari ini, dialah syafaat paginya, jadi topik mingguan tidak
  // ikut digambar (topik itu tetap didoakan malamnya di Night Prayer).
  // Dulu penentunya jadwal topik mingguan; sekarang cukup Doa Rantainya
  // sendiri, jadi jadwal syafaat bebas berubah tanpa mengubah bentuk gerbang.
  const showIntercession = !chainDue;

  function next() {
    const n = nextJourneyStep(step);
    if (n) setStep(n);
  }

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    await onConfirm(); // layar hilang sendiri saat streak ter-update
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <JourneyTrail current={step} onJump={setStep} />

          {/* key = langkah → kartunya lahir baru tiap berpindah, jadi isian
              draf langkah sebelumnya tidak menempel & animasi masuknya jalan. */}
          <View key={step}>
            {step === 'arrive' ? (
              <ArriveStep onNext={next} />
            ) : step === 'receive' ? (
              <ReceiveStep
                entry={entry}
                ready={reviveReady}
                reminder={reminder}
                onSave={onSaveRevive}
                onNext={next}
              />
            ) : step === 'reflect' ? (
              <ReflectStep
                prompt={prompt}
                journal={journal}
                onSave={onSaveReflect}
                onNext={next}
              />
            ) : step === 'respond' ? (
              <RespondStep
                entry={entry}
                ready={reviveReady}
                onSave={onSaveRevive}
                onNext={next}
              />
            ) : step === 'worship' ? (
              <WorshipStep song={song} passage={passage} onNext={next} />
            ) : step === 'pray' ? (
              <PrayStep
                entry={entry}
                ready={reviveReady}
                topic={topic}
                showIntercession={showIntercession}
                chainDue={chainDue}
                chainLeft={chainLeft}
                chainLeaders={chainLeaders}
                onPrayLeader={onPrayLeader}
                onSave={onSaveRevive}
                onNext={next}
              />
            ) : (
              <CloseStep onConfirm={handleConfirm} busy={busy} />
            )}
          </View>

          {/* Keterangan waktu yang tenang (bukan kartu peringatan) + dua pintu
              keluar: "Nanti dulu" (tanpa hukuman; Today terus mengundang) dan
              "Lewati untuk hari ini" (menutup tagihannya, streak mulai lagi).
              Lewat 09.00 yang tersisa cuma "Nanti dulu". */}
          <View style={styles.footer}>
            {closingSoon && (
              <VixText heading="label" additionalStyle={styles.footerText}>
                Jendela pagi ini tersisa {minutesLeft} menit.
              </VixText>
            )}
            {!stillOpen && (
              <VixText heading="label" additionalStyle={styles.footerText}>
                Jendela pagi sudah lewat. Tidak apa-apa, jalani sekarang.
              </VixText>
            )}
            <PressableScale style={styles.skipButton} onPress={onLater}>
              <VixText heading="label" additionalStyle={styles.laterText}>
                Nanti dulu
              </VixText>
            </PressableScale>
            {stillOpen && (
              <PressableScale
                style={styles.skipButton}
                onPress={() => setSkipConfirm(true)}>
                <VixText heading="label" additionalStyle={styles.footerText}>
                  Pagi ini tidak memungkinkan? Lewati untuk hari ini
                </VixText>
              </PressableScale>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Konfirmasi tenang (bukan merah) sebelum melewatkan: streak memang
          mulai dari awal, tapi itu disebut sebagai keterangan, bukan ancaman. */}
      <ConfirmDialog
        visible={skipConfirm}
        title="Lewati Morning Journey hari ini?"
        detail="Tidak apa-apa. Streak 🙏 akan mulai lagi dari awal, dan besok pagi journey-nya menunggumu lagi."
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
  safe: { flex: 1, backgroundColor: Color.SPIRITUAL_DARK },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  footer: { alignItems: 'center', gap: 2, marginTop: ACTION_GAP },
  skipButton: { paddingVertical: 12, paddingHorizontal: 12 },
  footerText: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  laterText: { color: Color.TEXT_REVERSE, textAlign: 'center', textDecorationLine: 'underline' },
});
