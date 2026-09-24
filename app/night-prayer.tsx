import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BLOCK_CARD, CARD, CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CONTENT_COLUMN } from '@/assets/style/layout';
import { CheckCircle } from '@/components/common/CheckCircle';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { StreakPill } from '@/components/common/StreakPill';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useNow } from '@/hooks/useNow';
import { formatFullDate } from '@/lib/format';
import { subscribeHabitDay, type HabitDay } from '@/lib/health';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  nightAllDone,
  nightDoneCount,
  nightPlan,
  nightPoints,
  nightSectionDone,
  nightStreakAlive,
  NIGHT_SECTIONS,
  bumpNightStreak,
  setNightSectionDone,
  subscribeNightStreak,
  type NightKey,
  type NightStreak,
} from '@/lib/nightPrayer';

// 🌙 Night Prayer — doa sebelum tidur, empat bagian.
//
// Isinya BUKAN daftar utuh. Tiap malam dibawa sepotong yang berputar
// (lib/nightPrayer.ts): 3 syukur, 2 pengakuan, 4 permohonan, plus syafaat
// jadwal hari itu. Jadi yang terbuka di layar ini memang sanggup didoakan
// sekali duduk, dan dalam empat sampai tujuh malam seluruh daftarnya kebagian.
//
// Centangnya menumpang di dokumen harian kebiasaan yang sudah dilanggan layar
// lain, jadi layar ini cuma menambah SATU langganan: streaknya sendiri.
export default function NightPrayerScreen() {
  const { user } = useAuth();
  const { now, todayId } = useNow();

  const [day, setDay] = useState<HabitDay | null>(null);
  const [streak, setStreak] = useState<NightStreak | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<NightKey | null>(null);

  useLiveAll(
    (uid, fail) => [
      subscribeHabitDay(uid, todayId, setDay, fail),
      subscribeNightStreak(uid, setStreak, fail),
    ],
    { onError: () => setError(LOAD_ERROR) },
  );

  const plan = nightPlan(todayId, now);
  const selesai = nightDoneCount(day);
  const lengkap = nightAllDone(day);

  async function ubah(key: NightKey) {
    if (!user || busy) return;
    setBusy(key);
    try {
      const jadi = !nightSectionDone(day, key);
      await setNightSectionDone(user.uid, todayId, key, jadi);
      // Bagian KEEMPAT baru saja dicentang → malam ini dihitung.
      if (jadi && selesai + 1 === NIGHT_SECTIONS.length) {
        await bumpNightStreak(user.uid, streak ?? null, todayId);
      }
      setError(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Kembali"
        title="Night Prayer 🌙"
        subtitle={formatFullDate(now)}
        right={<StreakPill streak={nightStreakAlive(streak ?? null, todayId)} />}
      />
      {streak === undefined ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.inner}>
            <ScreenError message={error} />
            {/* Ringkasan malam ini: berapa yang sudah didoakan, bukan nasihat. */}
            <View style={[styles.hero, lengkap && styles.heroDone]}>
              <VixText heading="bold" additionalStyle={styles.heroTitle}>
                {lengkap
                  ? 'Amin, malam ini lengkap 🙏'
                  : `${selesai} dari ${NIGHT_SECTIONS.length} bagian`}
              </VixText>
              <VixText heading="label">
                {lengkap
                  ? 'Selamat istirahat. Besok potongannya berganti sendiri.'
                  : 'Doakan pelan-pelan, satu bagian satu centang.'}
              </VixText>
            </View>

            {NIGHT_SECTIONS.map((s) => {
              const isi = nightPoints(plan, s.key);
              const sudah = nightSectionDone(day, s.key);
              return (
                <View key={s.key} style={styles.card}>
                  <PressableScale
                    style={styles.head}
                    onPress={() => ubah(s.key)}
                    hitSlop={6}>
                    <View style={styles.headText}>
                      <VixText heading="bold" additionalStyle={styles.cardTitle}>
                        {s.emoji} {s.label}
                      </VixText>
                      <VixText heading="label">
                        {s.key === 'syafaat'
                          ? `${plan.syafaat.emoji} ${plan.syafaat.label}`
                          : s.hint}
                      </VixText>
                    </View>
                    <CheckCircle checked={sudah} />
                  </PressableScale>

                  <View style={styles.points}>
                    {isi.map((p, i) => (
                      <VixText
                        key={p}
                        heading="paragraph"
                        additionalStyle={[styles.point, sudah && styles.pointDone]}>
                        {i + 1}. {p}
                      </VixText>
                    ))}
                  </View>
                </View>
              );
            })}

            <VixText heading="label" additionalStyle={styles.note}>
              Daftar lengkapnya tetap utuh: 12 pokok syukur, 7 pengakuan & 16 permohonan.
              Tiap malam dibawa sepotong bergantian supaya muat sebelum tidur, dan dalam
              empat sampai tujuh malam semuanya kebagian.
            </VixText>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingTop: 4, paddingBottom: 32, alignItems: 'center' },
  inner: { ...CONTENT_COLUMN, paddingHorizontal: 20, gap: CARD_GAP },
  hero: { ...BLOCK_CARD, gap: 4 },
  heroDone: { backgroundColor: Color.MAIN_LIGHT },
  heroTitle: { color: Color.MAIN_DARK },
  card: { ...CARD, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, gap: 2 },
  cardTitle: { color: Color.TEXT_TITLE },
  points: { gap: 4 },
  point: { color: Color.TEXT_PARAGRAPH },
  // Sudah didoakan → barisnya diredupkan, bukan dicoret: ini doa, bukan tugas.
  pointDone: { opacity: 0.5 },
  note: { marginTop: 2 },
});
