import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { type LoginStreak } from '@/lib/achievements';
import { fitTargets } from '@/lib/fitness';
import { formatDecimal } from '@/lib/format';
import {
  bmiCategory,
  bmiValue,
  type HealthProfile,
  type WeightTarget,
} from '@/lib/health';

// Tab Progress 📈 — streak sesi, Data Tubuh (dibaca dari fitur Profile),
// target yang dikejar, dan daftar persiapan sebelum berangkat gym.
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
            sesi beruntun
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
          <VixText heading="label">Rekor beruntun</VixText>
        </View>
      </View>
      
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

      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        🎯 Target yang dikejar
      </VixText>
      {(profile ? fitTargets(profile, target) : []).map((t) => (
        <View key={t.label} style={styles.card}>
          <VixText additionalStyle={styles.cardIcon}>{t.icon}</VixText>
          <View style={styles.cardMain}>
            <VixText heading="bold" additionalStyle={styles.cardTitle}>
              {t.label}
            </VixText>
            <VixText heading="label">{t.desc}</VixText>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  sectionTitle: { marginTop: 16, marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  cardIcon: { fontSize: 24, lineHeight: 30 },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: Color.TEXT_TITLE },
});
