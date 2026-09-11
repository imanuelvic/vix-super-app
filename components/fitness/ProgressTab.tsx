import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { type LoginStreak } from '@/lib/achievements';
import {
  fetchFitDays,
  fitPace,
  fitRunTotals,
  type FitDay,
} from '@/lib/fitness';
import { formatDecimal } from '@/lib/format';
import {
  bmiCategory,
  bmiValue,
  weekDayIds,
  type HealthProfile,
  type WeightTarget,
} from '@/lib/health';

// Tab Progress 📈 — streak sesi, rekap lari minggu ini, dan Data Tubuh
// (dibaca dari fitur Profile, bukan disimpan ulang di sini).
//
// Daftar "🎯 Target yang dikejar" DIBUANG: separuh isinya menjelaskan jadwal
// mingguan yang sudah tidak menentukan apa-apa lagi sejak sesinya jadi
// pilihanmu, dan separuh sisanya (protein, tidur, langkah) sudah punya
// rumahnya sendiri di Health & Habits.
export function ProgressTab({
  streak,
  profile,
  target,
}: {
  streak: LoginStreak | null;
  profile: HealthProfile | null;
  target: WeightTarget | null;
}) {
  const router = useRouter();
  const { user } = useAuth();

  // Hari-hari minggu berjalan, sekali baca saat tab ini dibuka — 7 dokumen
  // kecil, pola yang sama dengan deretan hari di tab Exercise. Dibaca di sini
  // (bukan di layar induknya) karena cuma tab ini yang memerlukannya.
  const [weekDays, setWeekDays] = useState<Record<string, FitDay>>({});
  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchFitDays(user.uid, weekDayIds(new Date()))
      .then((d) => {
        if (alive) setWeekDays(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  const lari = fitRunTotals(weekDays);
  const pace = fitPace(lari.km, lari.minutes);

  const count = streak?.count ?? 0;
  const best = streak?.best ?? 0;
  const total = streak?.total ?? 0;
  // 5 sesi = 1 minggu penuh; dipakai untuk menerjemahkan streak jadi "minggu".
  const weeks = Math.floor(count / 5);
  const bmi = profile ? bmiValue(profile.weightKg, profile.heightCm) : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <VixText additionalStyle={styles.heroEmoji}>🔥</VixText>
        <VixText heading="subheader" additionalStyle={styles.heroValue}>
          {count}{' '}
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            sesi streak
          </VixText>
        </VixText>
        <VixText heading="label" additionalStyle={styles.heroLabel}>
          {weeks > 0
            ? `≈ ${weeks} minggu tanpa bolos 💪`
            : 'Selesaikan semua gerakan untuk menyalakan streak'}
        </VixText>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <VixText heading="subheader" additionalStyle={styles.statValue}>
            {total}
          </VixText>
          <VixText heading="label">Total sesi</VixText>
        </View>
        <View style={styles.statCard}>
          <VixText heading="subheader" additionalStyle={styles.statValue}>
            {best}
          </VixText>
          <VixText heading="label">Rekor streak</VixText>
        </View>
      </View>

      {lari.sessions > 0 && (
        <View style={styles.runCard}>
          <VixText heading="label" additionalStyle={styles.runLabel}>
            🏃 Lari minggu ini
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.runValue}>
            {formatDecimal(lari.km)} km
          </VixText>
          <VixText heading="label" additionalStyle={styles.runSub}>
            {lari.sessions} sesi · {formatDecimal(lari.minutes)} menit
            {pace ? ` · ${pace}` : ''}
          </VixText>
        </View>
      )}

      {profile && (
        <PressableScale
          style={styles.bodyCard}
          onPress={() =>
            router.push({ pathname: '/profile', params: { tab: 'body' } })
          }>
          <View style={styles.bodyTop}>
            <VixText heading="bold" additionalStyle={styles.bodyTitle}>
              🧍 Data Tubuh
            </VixText>
            <VixText heading="label" additionalStyle={styles.bodyLink}>
              Ubah di Profile ›
            </VixText>
          </View>
          <View style={styles.bodyRow}>
            <View style={styles.bodyItem}>
              <VixText heading="bold" additionalStyle={styles.bodyValue}>
                {formatDecimal(profile.weightKg)} kg
              </VixText>
              <VixText heading="label">
                {target
                  ? `→ ${formatDecimal(target.targetWeightKg)} kg`
                  : 'Berat'}
              </VixText>
            </View>
            <View style={styles.bodyItem}>
              <VixText heading="bold" additionalStyle={styles.bodyValue}>
                {formatDecimal(bmi)}
              </VixText>
              <VixText heading="label" numberOfLines={1}>
                BMI · {bmiCategory(bmi).label}
              </VixText>
            </View>
            <View style={styles.bodyItem}>
              <VixText heading="bold" additionalStyle={styles.bodyValue}>
                {profile.waistCm ? `${formatDecimal(profile.waistCm)} cm` : '—'}
              </VixText>
              <VixText heading="label">Lingkar perut</VixText>
            </View>
          </View>
        </PressableScale>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Bentuknya sekeluarga dengan kartu streak di atasnya, cuma warnanya kalem:
  // ini catatan, bukan pencapaian yang perlu dirayakan.
  runCard: {
    ...CARD,
    borderLeftWidth: 3,
    borderLeftColor: Color.FITNESS_DARK,
    gap: 2,
    marginTop: 10,
  },
  runLabel: { color: Color.TEXT_LABEL },
  runValue: { color: Color.TEXT_TITLE },
  runSub: { color: Color.FITNESS_DARK },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  hero: {
    backgroundColor: Color.FITNESS_DARK,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 2,
    marginBottom: 10,
  },
  heroEmoji: { fontSize: 40, lineHeight: 50 },
  heroValue: { color: Color.TEXT_REVERSE },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingVertical: 14,
  },
  statValue: { color: Color.FITNESS_DARK },
  // Data Tubuh — cerminan data Health, bukan sumber terpisah.
  bodyCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginTop: 10,
    gap: 10,
  },
  bodyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  bodyTitle: { color: Color.TEXT_TITLE },
  bodyLink: { color: Color.FITNESS_DARK },
  bodyRow: { flexDirection: 'row', gap: 10 },
  bodyItem: { flex: 1, gap: 1 },
  bodyValue: { color: Color.TEXT_TITLE },
});
