import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT } from '@/assets/style/layout';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { WeekBars } from '@/components/fitness/WeekBars';
import { PriceChart } from '@/components/investment/PriceChart';
import { useAuth } from '@/contexts/auth';
import { type LoginStreak } from '@/lib/reward';
import {
  fetchFitDays,
  fitDayComplete,
  fitDistanceTotals,
  fitKindMeta,
  fitLogsOfDays,
  fitRouteLogs,
  fitWeightProgress,
  type FitDay,
  type FitWeightLog,
  type FitWeights,
} from '@/lib/fitness';
import {
  dayIdToDate,
  formatClock,
  formatDecimal,
  formatShortDayDate,
  monthShort,
} from '@/lib/format';
import {
  bmiCategory,
  bmiValue,
  dayDocId,
  WEEK_GYM_GOAL,
  WEEK_STEP_GOAL,
  weekDayIds,
  weekStartId,
  weightSeries,
  type HealthProfile,
  type WeekStatsMap,
  type WeightPoint,
  type WeightTarget,
} from '@/lib/health';

// Tab Progress 📈 — ringkasan minggu ini, konsistensi 8 minggu, kemajuan
// beban, riwayat lari & jalan, dan Data Tubuh beserta grafik beratnya.
//
// 3 Okt 2026 (review Fitness): tab ini dulu cuma tiga angka (total sesi, rekor
// streak, lari minggu ini). Sekarang ia menjawab pertanyaan yang memang
// ditanyakan saat membukanya: minggu ini sudah berapa, konsisten tidak
// beberapa minggu terakhir, bebannya naik tidak, beratnya ke mana.
//
// Semua angkanya dari dokumen yang SUDAH ada atau sudah dilanggan layar
// induknya (rekap mingguan, riwayat beban, riwayat berat), kecuali tujuh
// dokumen hari minggu berjalan yang dibaca sekali saat tab ini dibuka.
//
// Daftar "🎯 Target yang dikejar" DIBUANG: separuh isinya menjelaskan jadwal
// mingguan yang sudah tidak menentukan apa-apa lagi sejak sesinya jadi
// pilihanmu, dan separuh sisanya (protein, tidur, langkah) sudah punya
// rumahnya sendiri di Health & Habits.

/** Berapa minggu ke belakang grafik konsistensinya. */
const WEEKS_SHOWN = 8;
/** Grafik berat: 12 minggu terakhir. */
const WEIGHT_DAYS = 84;

export function ProgressTab({
  streak,
  profile,
  target,
  bodyLog,
  weights,
  weightLog,
  weekStats,
}: {
  streak: LoginStreak | null;
  profile: HealthProfile | null;
  target: WeightTarget | null;
  /** Riwayat timbang ⚖️ (Health). */
  bodyLog: WeightPoint[];
  /** Beban tersimpan tiap gerakan & riwayat perubahannya 🏋️. */
  weights: FitWeights;
  weightLog: FitWeightLog;
  /** Rekap mingguan Health: langkah & hari angkat beban. */
  weekStats: WeekStatsMap;
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

  // Lebar bidang grafik — diukur dari kartunya sendiri, jadi pas di iPhone
  // maupun iPad tanpa menebak lebar layar.
  const [chartW, setChartW] = useState(0);

  const now = new Date();

  // ===== 📅 Minggu ini =====
  const hariLatihan = Object.entries(weekDays).filter(([id, d]) =>
    fitDayComplete(d, dayIdToDate(id)),
  ).length;
  const jarak = fitDistanceTotals(weekDays);
  const streakNow = streak?.count ?? 0;
  const best = streak?.best ?? 0;
  const total = streak?.total ?? 0;

  // ===== 📊 Konsistensi — delapan Senin terakhir, minggu ini paling kanan =====
  const senin = Array.from({ length: WEEKS_SHOWN }, (_, i) =>
    weekStartId(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WEEKS_SHOWN - 1 - i) * 7),
    ),
  );
  const labelMinggu = (id: string, i: number) => {
    if (i === WEEKS_SHOWN - 1) return 'Minggu ini';
    const d = dayIdToDate(id);
    return `${d.getDate()} ${monthShort(d)}`;
  };
  const gymData = senin.map((id, i) => ({
    label: labelMinggu(id, i),
    value: weekStats[id]?.gym ?? 0,
  }));
  const stepData = senin.map((id, i) => ({
    label: labelMinggu(id, i),
    value: weekStats[id]?.steps ?? 0,
  }));

  // ===== 🏋️ Kemajuan beban =====
  const beban = fitWeightProgress(weightLog, weights).slice(0, 5);

  // ===== 🏃 Riwayat lari & jalan =====
  // Lima terakhir saja di kartu — sisanya di layar Workout History. Hanya
  // yang BERJARAK (lari & jalan); sesi beban & renang tercatat utuh di sana.
  const rekaman = fitRouteLogs(fitLogsOfDays(weekDays)).slice(0, 5);

  // ===== 🧍 Data tubuh & ⚖️ grafik berat =====
  const bmi = profile ? bmiValue(profile.weightKg, profile.heightCm) : 0;
  const sejak = dayDocId(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - WEIGHT_DAYS),
  );
  const berat = weightSeries(bodyLog, profile, sejak);
  const beratAwal = berat[0];
  const beratAkhir = berat[berat.length - 1];
  const selisih = berat.length >= 2 ? beratAkhir.kg - beratAwal.kg : 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* ===== 📅 Minggu ini — tiga angka, satu kartu ===== */}
      <View style={styles.card}>
        <VixText heading="bold" additionalStyle={styles.cardTitle}>
          📅 Minggu Ini
        </VixText>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <VixText heading="subheader" additionalStyle={styles.statValue}>
              {hariLatihan}
            </VixText>
            <VixText heading="label">💪 hari latihan</VixText>
          </View>
          <View style={styles.statItem}>
            <VixText heading="subheader" additionalStyle={styles.statValue}>
              {formatDecimal(jarak.km)}
            </VixText>
            <VixText heading="label">🏃 km lari & jalan</VixText>
          </View>
          <View style={styles.statItem}>
            <VixText heading="subheader" additionalStyle={styles.statValue}>
              {streakNow}
            </VixText>
            <VixText heading="label">🔥 streak</VixText>
          </View>
        </View>
        <VixText heading="label" additionalStyle={styles.muted}>
          Total {total} sesi · rekor streak {best}
        </VixText>
      </View>

      {/* ===== 📊 Konsistensi 8 minggu =====
          Dua grafik kecil BERTUMPUK, bukan satu grafik berskala ganda: hari
          angkat beban & langkah satuannya beda, dan dua sumbu di satu grafik
          gampang dibaca salah. Garis patokannya anjuran umum orang dewasa
          (2 hari angkat beban, ±70.000 langkah) — dulu kartu tersendiri di
          Health › Steps. */}
      <View
        style={styles.card}
        onLayout={(e) => setChartW(e.nativeEvent.layout.width - CARD_PAD * 2)}>
        <VixText heading="bold" additionalStyle={styles.cardTitle}>
          📊 Konsistensi {WEEKS_SHOWN} Minggu
        </VixText>
        <VixText heading="label" additionalStyle={styles.chartLabel}>
          🏋️ Hari angkat beban
        </VixText>
        <WeekBars
          data={gymData}
          width={chartW}
          color={Color.FITNESS_DARK}
          format={(n) => `${n} hari`}
          goal={WEEK_GYM_GOAL}
          goalLabel={`anjuran ${WEEK_GYM_GOAL} hari`}
        />
        <VixText heading="label" additionalStyle={styles.chartLabel}>
          👣 Langkah
        </VixText>
        <WeekBars
          data={stepData}
          width={chartW}
          color={Color.FITNESS_DARK}
          format={(n) => `${Math.round(n / 1000)}rb`}
          goal={WEEK_STEP_GOAL}
          goalLabel={`anjuran ${Math.round(WEEK_STEP_GOAL / 1000)}rb`}
        />
      </View>

      {/* ===== 🏋️ Kemajuan beban =====
          Dari riwayat beban yang dicatat tiap kali kg sebuah gerakan diubah
          di Exercise (mulai 3 Okt 2026). Yang paling baru diubah di atas. */}
      <View style={styles.card}>
        <VixText heading="bold" additionalStyle={styles.cardTitle}>
          🏋️ Kemajuan Beban
        </VixText>
        {beban.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.muted}>
            Ubah beban satu gerakan di Exercise, kemajuannya tercatat di sini.
          </VixText>
        ) : (
          beban.map((b) => {
            const beda = b.to - b.from;
            return (
              <View key={b.id} style={styles.liftRow}>
                <VixText
                  heading="label"
                  numberOfLines={1}
                  additionalStyle={styles.liftName}>
                  {b.emoji} {b.name}
                </VixText>
                <View style={styles.liftRight}>
                  <VixText heading="bold" additionalStyle={styles.liftValue}>
                    {formatDecimal(b.from)} → {formatDecimal(b.to)} kg
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.muted}>
                    {beda > 0
                      ? `naik ${formatDecimal(beda)} kg`
                      : beda < 0
                        ? `turun ${formatDecimal(-beda)} kg`
                        : 'belum berubah'}
                    {b.best > b.to ? ` · 🏆 rekor ${formatDecimal(b.best)} kg` : ''}
                  </VixText>
                </View>
              </View>
            );
          })
        )}
      </View>

      <PressableScale
        style={styles.card}
        onPress={() => router.push('/fitness-history')}>
        <View style={styles.cardTop}>
          <VixText heading="bold" additionalStyle={styles.cardTitle}>
            🏃 Riwayat Lari & Jalan
          </VixText>
          <VixText heading="label" additionalStyle={styles.cardLink}>
            Lihat semua ›
          </VixText>
        </View>
        {rekaman.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.muted}>
            Belum ada lari atau jalan yang tercatat minggu ini.
          </VixText>
        ) : (
          rekaman.map((l, i) => {
            const m = fitKindMeta(l.kind);
            return (
              <View key={`${l.dayId}-${l.at}-${i}`} style={styles.logRow}>
                <VixText heading="label" additionalStyle={styles.muted}>
                  {formatShortDayDate(dayIdToDate(l.dayId))}
                </VixText>
                <VixText heading="bold" additionalStyle={styles.logMain}>
                  {m.emoji}{' '}
                  {[
                    l.seconds > 0 ? formatClock(l.seconds) : '',
                    l.km > 0 ? `${formatDecimal(l.km)} km` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </VixText>
                {l.place ? (
                  <VixText heading="label" numberOfLines={1} additionalStyle={styles.logPlace}>
                    📍 {l.place}
                  </VixText>
                ) : null}
              </View>
            );
          })
        )}
      </PressableScale>

      {profile && (
        <PressableScale
          style={styles.card}
          onPress={() =>
            router.push({ pathname: '/profile', params: { tab: 'body' } })
          }>
          <View style={styles.cardTop}>
            <VixText heading="bold" additionalStyle={styles.cardTitle}>
              🧍 Data Tubuh
            </VixText>
            <VixText heading="label" additionalStyle={styles.cardLink}>
              Ubah di Profile ›
            </VixText>
          </View>

          {/* ⚖️ Grafik berat 12 minggu — titiknya dari tiap kali Data Tubuh
              disimpan (mulai 3 Okt 2026), plus berat terakhir sebelum itu.
              Garis 🎯 = target berat dari Habits. */}
          {berat.length >= 2 ? (
            <>
              <PriceChart
                series={berat.map((p) => ({ date: p.dayId, price: p.kg }))}
                width={chartW}
                height={WEIGHT_CHART_H}
                color={Color.FITNESS_DARK}
                format={(n) => `${formatDecimal(n)} kg`}
                reference={
                  target
                    ? {
                        value: target.targetWeightKg,
                        label: `🎯 ${formatDecimal(target.targetWeightKg)} kg`,
                      }
                    : undefined
                }
              />
              <VixText heading="label" additionalStyle={styles.muted}>
                {selisih === 0
                  ? 'Berat tetap'
                  : `${selisih > 0 ? 'Naik' : 'Turun'} ${formatDecimal(Math.abs(selisih))} kg`}{' '}
                sejak {formatShortDayDate(dayIdToDate(beratAwal.dayId))}
              </VixText>
            </>
          ) : (
            <VixText heading="label" additionalStyle={styles.muted}>
              📈 Grafik berat muncul sesudah 2 kali timbang. Simpan beratmu tiap
              Minggu di Profile.
            </VixText>
          )}

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
                {profile.waistCm ? `${formatDecimal(profile.waistCm)} cm` : '-'}
              </VixText>
              <VixText heading="label">Lingkar perut</VixText>
            </View>
          </View>
        </PressableScale>
      )}
    </ScrollView>
  );
}

// Napas kiri-kanan kartu — dipakai juga untuk menghitung lebar grafiknya.
const CARD_PAD = 14;
// Grafik berat di kartu: lebih pendek dari grafik pasar (224), cukup untuk
// melihat arah naik-turunnya.
const WEIGHT_CHART_H = 170;

const styles = StyleSheet.create({
  content: { ...SCREEN_CONTENT, paddingBottom: 28, gap: 10 },
  card: { ...PANEL, padding: CARD_PAD, gap: 8 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { color: Color.TEXT_TITLE },
  cardLink: { color: Color.FITNESS_DARK },
  muted: { color: Color.TEXT_LABEL },
  // ---- Minggu ini ----
  statRow: { flexDirection: 'row', gap: 10 },
  statItem: { flex: 1, alignItems: 'center', gap: 1 },
  statValue: { color: Color.FITNESS_DARK },
  // ---- Konsistensi ----
  chartLabel: { color: Color.TEXT_LABEL, marginTop: 4 },
  // ---- Kemajuan beban ----
  liftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  liftName: { flex: 1, color: Color.TEXT_TITLE },
  liftRight: { alignItems: 'flex-end', gap: 1 },
  liftValue: { color: Color.FITNESS_DARK },
  // ---- Riwayat ----
  logRow: { gap: 1 },
  logMain: { color: Color.TEXT_TITLE },
  logPlace: { color: Color.FITNESS_DARK },
  // ---- Data tubuh ----
  bodyRow: { flexDirection: 'row', gap: 10 },
  bodyItem: { flex: 1, gap: 1 },
  bodyValue: { color: Color.TEXT_TITLE },
});
