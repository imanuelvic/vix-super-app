import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { isChainTopic, type IntercessionTopic } from '@/lib/intercession';

// Doa Bapa Kami (Matius 6:9–13).
const BAPA_KAMI = `Bapa kami yang di sorga,
Dikuduskanlah nama-Mu,
datanglah Kerajaan-Mu,
jadilah kehendak-Mu di bumi seperti di sorga.

Berikanlah kami pada hari ini makanan kami yang secukupnya, dan ampunilah kami akan kesalahan kami, seperti kami juga mengampuni orang yang bersalah kepada kami;

dan janganlah membawa kami ke dalam pencobaan, tetapi lepaskanlah kami dari pada yang jahat.

Karena Engkaulah yang empunya Kerajaan dan kuasa dan kemuliaan sampai selama-lamanya. Amin.`;

// Lock screen doa pagi — muncul sekali/hari (batas jam 4 pagi) DI MANA PUN
// posisi kamu di app. Tidak bisa dilewati; harus Revive + doa Bapa Kami, dan
// kalau hari ini jadwal Doa Rantai, follow up-nya jadi langkah ke-3.
export function MorningPrayerGate({
  streakCount,
  reviveDone,
  chainDue,
  chainLeft,
  topic,
  onConfirm,
  onOpenRevive,
  onOpenChain,
  onSkip,
}: {
  streakCount: number;
  // True kalau Revive hari ini sudah diisi → langkah Revive auto-centang.
  reviveDone: boolean;
  // True kalau HARI INI jadwal Doa Rantai (Sel/Kam/Sab) & ada CL-nya.
  chainDue: boolean;
  // Berapa CORE Leader yang belum di-follow up hari ini (0 = beres).
  chainLeft: number;
  // Pokok doa syafaat hari ini (Senin Keluarga·Kesehatan, dst).
  topic: IntercessionTopic;
  onConfirm: () => Promise<void>;
  onOpenRevive: () => void;
  onOpenChain: () => void;
  // Lewati doa pagi (keadaan mendesak): relakan streak hangus, langsung ke Home.
  onSkip: () => void;
}) {
  const [prayed, setPrayed] = useState(false);
  const [interceded, setInterceded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);
  // Langkah Revive & Doa Rantai HANYA tercentang otomatis dari datanya.
  const chainDone = !chainDue || chainLeft === 0;

  // Selasa & Kamis syafaatnya MEMANG Doa Rantai → tidak dibuat langkah
  // terpisah, cukup langkah Doa Rantai yang sudah ada (biar tidak dobel).
  // Kecuali kalau langkah itu tidak muncul (belum ada CL yang punya pokok doa
  // bulan ini) — supaya syafaat hari itu tidak hilang sama sekali.
  const chainIsToday = isChainTopic(topic);
  const showIntercession = !chainIsToday || !chainDue;

  // Nomor langkah dihitung dari langkah mana saja yang muncul hari ini.
  const nChain = 2;
  const nIntercession = chainDue ? 3 : 2;
  const stepCount =
    2 + (chainDue ? 1 : 0) + (showIntercession ? 1 : 0); // Revive + … + Bapa Kami
  const nPrayer = stepCount;

  const ready =
    prayed && reviveDone && chainDone && (!showIntercession || interceded);

  async function handleConfirm() {
    if (!ready || busy) return;
    setBusy(true);
    await onConfirm(); // gate hilang sendiri saat streak ter-update
    setBusy(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <VixText additionalStyle={styles.sun}>🌅</VixText>
          <VixText heading="header" additionalStyle={styles.title}>
            Selamat pagi!
          </VixText>
          <VixText heading="paragraph" additionalStyle={styles.subtitle}>
            Sebelum memulai hari, luangkan waktu bersama Bapa dulu 🙏
          </VixText>
          {streakCount > 0 && (
            <View style={styles.streakPill}>
              <VixText heading="bold" additionalStyle={styles.streakText}>
                🔥 {streakCount} hari berdoa
              </VixText>
            </View>
          )}
        </Animated.View>

        {/* Langkah 1: Revive */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(350)}
          style={styles.stepCard}>
          <VixText heading="title" additionalStyle={styles.stepTitle}>
            1. Revive
          </VixText>
          <VixText heading="label" additionalStyle={styles.stepHint}>
            Baca firman & tulis rhema hari ini di Revive.
          </VixText>
          <PressableScale style={styles.openRevive} onPress={onOpenRevive}>
            <VixText heading="bold" additionalStyle={styles.openReviveText}>
              📖 Buka Revive →
            </VixText>
          </PressableScale>
          {/* Centang otomatis — TIDAK bisa ditekan manual; tercentang sendiri
              begitu Revive hari ini tersimpan. */}
          <View style={styles.checkRow}>
            <CheckCircle checked={reviveDone} />
            <VixText heading="bold" additionalStyle={styles.checkText}>
              {reviveDone
                ? 'Sudah Revive hari ini'
                : 'Terisi otomatis setelah kamu isi Revive'}
            </VixText>
          </View>
        </Animated.View>

        {/* Langkah 2: Doa Rantai — hanya di hari jadwalnya (Sel/Kam/Sab) */}
        {chainDue && (
          <Animated.View
            entering={FadeInDown.delay(270).duration(350)}
            style={styles.stepCard}>
            <VixText heading="title" additionalStyle={styles.stepTitle}>
              {nChain}. Doa Rantai
              {chainIsToday ? ` — syafaat hari ini ${topic.emoji}` : ''}
            </VixText>
            <VixText heading="label" additionalStyle={styles.stepHint}>
              Hari ini jadwalnya: doakan & tanyakan perkembangan pergumulan
              CORE Leader giliran hari ini.
            </VixText>
            <PressableScale style={styles.openRevive} onPress={onOpenChain}>
              <VixText heading="bold" additionalStyle={styles.openReviveText}>
                🔗 Buka Doa Rantai →
              </VixText>
            </PressableScale>
            {/* Centang otomatis begitu semua CL giliran hari ini ditandai selesai. */}
            <View style={styles.checkRow}>
              <CheckCircle checked={chainLeft === 0} />
              <VixText heading="bold" additionalStyle={styles.checkText}>
                {chainLeft === 0
                  ? 'Semua CORE Leader hari ini sudah di-follow up'
                  : `Sisa ${chainLeft} CORE Leader untuk di-follow up`}
              </VixText>
            </View>
          </Animated.View>
        )}

        {/* Langkah Doa Syafaat — pokok doanya berganti tiap hari (Senin
            Keluarga·Kesehatan, Rabu Ekonomi, Sabtu Gereja, Minggu Negara).
            Selasa & Kamis dilewati karena sudah jadi langkah Doa Rantai. */}
        {showIntercession && (
          <Animated.View
            entering={FadeInDown.delay(290).duration(350)}
            style={styles.stepCard}>
            <VixText heading="title" additionalStyle={styles.stepTitle}>
              {nIntercession}. Doa Syafaat — {topic.emoji} {topic.label}
            </VixText>
            <View style={styles.prayerBox}>
              {topic.points.map((p) => (
                <VixText
                  key={p}
                  heading="paragraph"
                  additionalStyle={styles.pointText}>
                  • {p}
                </VixText>
              ))}
            </View>
            <PressableScale
              style={styles.checkRow}
              onPress={() => setInterceded((v) => !v)}>
              <CheckCircle checked={interceded} />
              <VixText heading="bold" additionalStyle={styles.checkText}>
                Sudah mendoakan syafaat hari ini
              </VixText>
            </PressableScale>
          </Animated.View>
        )}

        {/* Langkah terakhir: Bapa Kami */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(350)}
          style={styles.stepCard}>
          <VixText heading="title" additionalStyle={styles.stepTitle}>
            {nPrayer}. Doa Bapa Kami
          </VixText>
          <View style={styles.prayerBox}>
            <VixText heading="paragraph" additionalStyle={styles.prayerText}>
              {BAPA_KAMI}
            </VixText>
          </View>
          <PressableScale
            style={styles.checkRow}
            onPress={() => setPrayed((v) => !v)}>
            <CheckCircle checked={prayed} />
            <VixText heading="bold" additionalStyle={styles.checkText}>
              Sudah berdoa Bapa Kami
            </VixText>
          </PressableScale>
        </Animated.View>

        {/* Konfirmasi — aktif setelah semua langkah selesai */}
        <Animated.View entering={FadeInDown.delay(320).duration(350)}>
          {ready ? (
            <PrimaryButton
              label="✅ Konfirmasi & Mulai Hari"
              busy={busy}
              onPress={handleConfirm}
              additionalStyle={styles.confirm}
            />
          ) : (
            <View style={[styles.confirm, styles.confirmDisabled]}>
              <VixText
                heading="bold"
                additionalStyle={styles.confirmDisabledText}>
                Selesaikan {stepCount} langkah di atas 🙏
              </VixText>
            </View>
          )}
        </Animated.View>

        {/* Escape hatch: keadaan mendesak → relakan streak & langsung ke Home */}
        <PressableScale
          style={styles.skipButton}
          onPress={() => setSkipConfirm(true)}>
          <VixText heading="label" additionalStyle={styles.skipText}>
            Keadaan mendesak? Lewati doa pagi — streak 🔥 hangus
          </VixText>
        </PressableScale>
      </ScrollView>

      {/* Konfirmasi sebelum melewatkan (streak hilang) */}
      <ConfirmDialog
        visible={skipConfirm}
        title="Lewati doa pagi?"
        detail="Streak 🔥 kamu akan hangus jadi 0. Yakin mau lewati dan langsung ke Home?"
        confirmLabel="Ya, lewati"
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
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  header: { alignItems: 'center', gap: 6, marginBottom: 18 },
  sun: { fontSize: 56, lineHeight: 68 },
  title: { color: Color.TEXT_REVERSE },
  subtitle: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  streakPill: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 4,
  },
  streakText: { color: Color.SPIRITUAL_DARK },
  stepCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    marginBottom: 14,
  },
  stepTitle: { color: Color.TEXT_TITLE },
  stepHint: { color: Color.TEXT_LABEL },
  prayerBox: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 14,
    padding: 14,
  },
  prayerText: { color: Color.TEXT_TITLE, lineHeight: 24 },
  // Butir pokok doa syafaat — sedikit lebih rapat dari teks Bapa Kami.
  pointText: { color: Color.TEXT_TITLE, lineHeight: 22 },
  openRevive: {
    alignSelf: 'flex-start',
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  openReviveText: { color: Color.SPIRITUAL_DARK },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  checkText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  confirm: { marginTop: 4 },
  skipButton: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  skipText: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  confirmDisabled: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    opacity: 0.85,
  },
  confirmDisabledText: { color: Color.SPIRITUAL_DARK },
});
