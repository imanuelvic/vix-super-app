import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';

// Doa Bapa Kami (Matius 6:9–13).
const BAPA_KAMI = `Bapa kami yang di sorga,
Dikuduskanlah nama-Mu,
datanglah Kerajaan-Mu,
jadilah kehendak-Mu di bumi seperti di sorga.

Berikanlah kami pada hari ini makanan kami yang secukupnya, dan ampunilah kami akan kesalahan kami, seperti kami juga mengampuni orang yang bersalah kepada kami;

dan janganlah membawa kami ke dalam pencobaan, tetapi lepaskanlah kami dari pada yang jahat.

Karena Engkaulah yang empunya Kerajaan dan kuasa dan kemuliaan sampai selama-lamanya. Amin.`;

// Lock screen doa pagi — muncul sekali/hari (batas jam 4 pagi) di Home.
// Tidak bisa dilewati; harus doa Bapa Kami + Revive lalu konfirmasi.
export function MorningPrayerGate({
  streakCount,
  onConfirm,
  onOpenRevive,
}: {
  streakCount: number;
  onConfirm: () => Promise<void>;
  onOpenRevive: () => void;
}) {
  const [prayed, setPrayed] = useState(false);
  const [revived, setRevived] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = prayed && revived;

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

        {/* Langkah 1: Bapa Kami */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(350)}
          style={styles.stepCard}>
          <VixText heading="title" additionalStyle={styles.stepTitle}>
            1. Doa Bapa Kami
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

        {/* Langkah 2: Revive */}
        <Animated.View
          entering={FadeInDown.delay(220).duration(350)}
          style={styles.stepCard}>
          <VixText heading="title" additionalStyle={styles.stepTitle}>
            2. Revive
          </VixText>
          <VixText heading="label" additionalStyle={styles.stepHint}>
            Baca firman & tulis rhema hari ini di jurnal Revive.
          </VixText>
          <PressableScale style={styles.openRevive} onPress={onOpenRevive}>
            <VixText heading="bold" additionalStyle={styles.openReviveText}>
              📖 Buka Revive →
            </VixText>
          </PressableScale>
          <PressableScale
            style={styles.checkRow}
            onPress={() => setRevived((v) => !v)}>
            <CheckCircle checked={revived} />
            <VixText heading="bold" additionalStyle={styles.checkText}>
              Sudah Revive hari ini
            </VixText>
          </PressableScale>
        </Animated.View>

        {/* Konfirmasi — aktif setelah kedua langkah selesai */}
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
                Selesaikan kedua langkah di atas 🙏
              </VixText>
            </View>
          )}
        </Animated.View>
      </ScrollView>
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
  confirmDisabled: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    opacity: 0.85,
  },
  confirmDisabledText: { color: Color.SPIRITUAL_DARK },
});
