import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { type LoginStreak } from '@/lib/achievements';
import { FIT_PREP, FIT_TARGETS } from '@/lib/fitness';

// Tab Progres 📈 — rentetan sesi, target yang dikejar, dan daftar persiapan
// sebelum berangkat gym. Semua angka datang dari dokumen streak (1 read).
export function ProgressTab({ streak }: { streak: LoginStreak | null }) {
  const count = streak?.count ?? 0;
  const best = streak?.best ?? 0;
  const total = streak?.total ?? 0;
  // 5 sesi = 1 minggu penuh; dipakai untuk menerjemahkan streak jadi "minggu".
  const weeks = Math.floor(count / 5);

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

      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        🎯 Target yang dikejar
      </VixText>
      {FIT_TARGETS.map((t) => (
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

      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        🎒 Siapkan sebelum berangkat
      </VixText>
      {FIT_PREP.map((p) => (
        <View key={p} style={styles.prepRow}>
          <VixText heading="label" additionalStyle={styles.prepText}>
            {p}
          </VixText>
        </View>
      ))}

      <VixText heading="label" additionalStyle={styles.disclaimer}>
        ⚠️ Ini panduan latihan umum, bukan nasihat medis. Kalau ada keluhan
        sendi, jantung, atau bekas cedera — konsultasi ke dokter/pelatih dulu.
        Berhenti kalau nyeri tajam, bukan sekadar pegal.
      </VixText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 },
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
  prepRow: {
    backgroundColor: Color.FITNESS,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
  },
  prepText: { color: Color.FITNESS_DARK },
  disclaimer: { color: Color.TEXT_LABEL, marginTop: 10 },
});
