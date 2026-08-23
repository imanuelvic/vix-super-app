import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useHealthToday } from '@/hooks/useHealthToday';
import { dayIdToDate, formatShortDayDate, groupDigits } from '@/lib/format';
import {
  recordStepDays,
  stepAchievements,
  STEP_TIERS,
  stepTierOf,
  subscribeStepDays,
  type StepDaysMap,
} from '@/lib/health';
import { readRecentDailySteps } from '@/lib/healthkit';

// Label/rentang tiap tier langkah (selaras STEP_TIERS di lib/health).
const STEP_TIER_META: Record<
  number,
  { emoji: string; label: string; range: string }
> = {
  20000: { emoji: '👟', label: '20 ribuan', range: '> 20.000' },
  30000: { emoji: '🎖️', label: '30 ribuan', range: '> 30.000' },
  40000: { emoji: '🏅', label: '40 ribuan', range: '> 40.000' },
  50000: { emoji: '🥇', label: '50 ribuan+', range: '≥ 50.000' },
};

// Rekor Langkah Harian 🏆 — halaman sendiri (dibuka dari tombol 🏆 di header
// Health). Rekor terisi otomatis dari riwayat Apple Health (hari yang sudah
// selesai & tembus ≥ 20.000 langkah), tiap hari dihitung di tier tertingginya.
export default function StepsScreen() {
  const { user } = useAuth();

  // Langkah hari ini dari Apple Health — hook bersama dengan tab Steps 👣.
  // Galatnya didiamkan di dalam hook: HK opsional, rekor tetap tampil dari
  // data tersimpan.
  const { status: hkStatus, today: hk } = useHealthToday();
  const [stepDays, setStepDays] = useState<StepDaysMap>({});
  const [expandedTier, setExpandedTier] = useState<number | null>(null);

  // Dengarkan rekor langkah tersimpan (dokumen kecil, 1 listener).
  useEffect(() => {
    if (!user) return;
    return subscribeStepDays(user.uid, setStepDays);
  }, [user]);

  // Isi rekor dari riwayat Apple Health — hanya hari yang SUDAH SELESAI &
  // tembus tier terendah. Sekali per buka; 1 tulis (merge).
  const backfilledRef = useRef(false);
  useEffect(() => {
    if (hkStatus !== 'ok' || !user || backfilledRef.current) return;
    backfilledRef.current = true;
    (async () => {
      const recent = await readRecentDailySteps(30);
      if (!recent) return;
      const qualifying = recent.filter((d) => d.steps >= STEP_TIERS[0]);
      await recordStepDays(user.uid, qualifying).catch(() => {});
    })();
  }, [hkStatus, user]);

  const ach = stepAchievements(stepDays);
  const todayTier = hk?.steps != null ? stepTierOf(hk.steps) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Health"
        title="Langkah Kaki👣"
        subtitle="Pencapaian langkah harianmu"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Langkah hari ini (live dari Apple Health, belum resmi) */}
        {hkStatus === 'ok' && hk?.steps != null && (
          <View style={styles.todayCard}>
            <VixText heading="label" additionalStyle={styles.todayLabel}>
              👣 Hari ini
            </VixText>
            <VixText heading="header" additionalStyle={styles.todayValue}>
              {groupDigits(String(hk.steps))}
            </VixText>
            <VixText heading="label" additionalStyle={styles.todaySub}>
              {todayTier != null
                ? `Sudah lewat ${groupDigits(String(todayTier))} langkah`
                : 'Belum tembus 20.000'}{' '}
              · dihitung resmi di akhir hari
            </VixText>
          </View>
        )}

        {/* Rekor terbaik */}
        {ach.best && (
          <View style={styles.bestCard}>
            <VixText heading="subheader" additionalStyle={styles.bestValue}>
              🥇 {groupDigits(String(ach.best.steps))}
              <VixText heading="label"> langkah — rekor terbaik</VixText>
            </VixText>
            <VixText heading="label" additionalStyle={styles.bestDate}>
              {formatShortDayDate(dayIdToDate(ach.best.dayId))}
            </VixText>
          </View>
        )}

        {/* Per tier: berapa kali + tanggal-tanggalnya (tekan untuk buka) */}
        <View style={styles.card}>
          <VixText heading="title" additionalStyle={styles.cardTitle}>
            👣🏆 Pencapaian per Tier
          </VixText>
          {[...ach.tiers].reverse().map((t) => {
            const meta = STEP_TIER_META[t.tier];
            const open = expandedTier === t.tier;
            return (
              <View key={t.tier}>
                <PressableScale
                  style={styles.tierRow}
                  onPress={() =>
                    setExpandedTier((cur) => (cur === t.tier ? null : t.tier))
                  }>
                  <View style={styles.tierLeft}>
                    <VixText heading="bold" additionalStyle={styles.tierLabel}>
                      {meta ? `${meta.emoji} ${meta.label}` : String(t.tier)}
                    </VixText>
                    {meta ? (
                      <VixText heading="label" additionalStyle={styles.tierRange}>
                        {meta.range}
                      </VixText>
                    ) : null}
                  </View>
                  <VixText
                    heading="bold"
                    additionalStyle={t.count > 0 ? styles.tierCount : styles.tierZero}>
                    {t.count}×
                  </VixText>
                </PressableScale>
                {open && t.dayIds.length > 0 && (
                  <View style={styles.tierDates}>
                    {t.dayIds.map((d) => (
                      <VixText
                        key={d}
                        heading="label"
                        additionalStyle={styles.tierDate}>
                        📅 {formatShortDayDate(dayIdToDate(d))}
                      </VixText>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {ach.totalDays === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              {hkStatus === 'ok'
                ? 'Belum ada rekor. Jalan ≥ 20.000 langkah dalam sehari untuk membukanya 👟'
                : 'Rekor terisi otomatis dari Apple Health (aktif di build EAS, bukan Expo Go).'}
            </VixText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  todayCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 18,
    padding: 18,
    gap: 2,
    marginBottom: 14,
  },
  todayLabel: { color: Color.TEXT_ON_DARK_MUTED },
  todayValue: { color: Color.TEXT_REVERSE },
  todaySub: { color: Color.TEXT_ON_DARK_MUTED },
  bestCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    padding: 16,
    gap: 2,
    marginBottom: 14,
  },
  bestValue: { color: Color.ACCENT_DARK },
  bestDate: { color: Color.ACCENT_DARK },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
  },
  cardTitle: { marginBottom: 4 },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  tierLeft: { gap: 1 },
  tierLabel: { color: Color.TEXT_TITLE },
  tierRange: { color: Color.TEXT_PLACEHOLDER },
  tierCount: { color: Color.MAIN_DARK },
  tierZero: { color: Color.TEXT_PLACEHOLDER },
  tierDates: { paddingBottom: 10, paddingLeft: 4, gap: 3 },
  tierDate: { color: Color.TEXT_PARAGRAPH },
  empty: { marginTop: 10, color: Color.TEXT_LABEL },
});
