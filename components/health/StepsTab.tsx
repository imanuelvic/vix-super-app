import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { GreetingHeader } from '@/components/common/Greeting';
import { PressableScale } from '@/components/common/PressableScale';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { formatDecimal, groupDigits, MONTH_NAMES } from '@/lib/format';
import {
  dayDocId,
  monthDayIds,
  recordStepDays,
  recordStepWeeks,
  WEEK_GYM_GOAL,
  WEEK_STEP_GOAL,
  weekStartId,
  type WeekStatsMap,
  runMilestoneOf,
  RUN_DAY_MILESTONES,
  RUN_MONTH_MILESTONES,
  RUN_WEEK_MILESTONES,
  stepsInDays,
  stepsToKm,
  strideMeters,
  STEP_TIERS,
  weekDayIds,
  type HealthProfile,
  type StepDaysMap,
} from '@/lib/health';
import {
  healthKitStatus,
  readRecentDailySteps,
  readTodaySummary,
  type DailyHealthSummary,
} from '@/lib/healthkit';

// Tab Steps 👣 — langkah hari ini dari Apple Health, plus akumulasi MINGGUAN
// (Senin–Minggu, reset sendiri tiap Senin karena hanya menjumlah 7 dayId
// minggu berjalan) dan BULANAN ala tantangan Strava. Jarak dipakai supaya
// pencapaiannya memakai patokan yang dikenal pelari (5K, Long Run, dst).
export function StepsTab({
  profile,
  stepDays,
  weeks,
}: {
  profile: HealthProfile;
  stepDays: StepDaysMap;
  weeks: WeekStatsMap;
}) {
  const { user } = useAuth();

  // Status tidak berubah selama app hidup, cukup dihitung sekali.
  const [hkStatus] = useState(() => healthKitStatus());
  const [hk, setHk] = useState<DailyHealthSummary | null>(null);
  const [hkBusy, setHkBusy] = useState(false);

  const loadHk = useCallback(async () => {
    setHkBusy(true);
    try {
      setHk(await readTodaySummary());
    } finally {
      setHkBusy(false);
    }
  }, []);

  useEffect(() => {
    // Kalau izin sudah pernah diberikan, data langsung tampil tanpa tombol.
    if (hkStatus === 'ok') loadHk();
  }, [hkStatus, loadHk]);

  // Isi riwayat langkah dari Apple Health — sekali per buka, 1 tulis (merge).
  // Tanpa ini akumulasi mingguan/bulanan cuma punya data hari ini.
  const backfilled = useRef(false);
  useEffect(() => {
    if (hkStatus !== 'ok' || !user || backfilled.current) return;
    backfilled.current = true;
    (async () => {
      const recent = await readRecentDailySteps(60);
      if (recent) await recordStepDays(user.uid, recent).catch(() => {});
    })();
  }, [hkStatus, user]);

  // Rekap MINGGUAN disimpan permanen — riwayat Apple Health cuma 60 hari,
  // jadi tanpa ini pencapaian minggu-minggu lama akan hilang sendiri.
  useEffect(() => {
    if (!user || Object.keys(stepDays).length === 0) return;
    recordStepWeeks(user.uid, stepDays, weeks).catch(() => {});
  }, [user, stepDays, weeks]);

  const now = new Date();
  const height = profile.heightCm;

  // Langkah hari ini: pakai angka live Apple Health kalau ada, kalau tidak
  // pakai yang sudah tercatat (biar akumulasi tetap masuk akal).
  const todaySteps = hk?.steps ?? 0;

  // Angka hari ini yang dipakai: yang paling besar antara data live Apple
  // Health dan yang sudah tersimpan (sinkron bisa tertinggal beberapa jam).
  const todayId = dayDocId(now);
  const todayDelta = Math.max(todaySteps, stepDays[todayId] ?? 0) - (stepDays[todayId] ?? 0);

  // Minggu berjalan (Senin–Minggu). Begitu ganti Senin, daftar dayId-nya ikut
  // bergeser → akumulasinya otomatis mulai dari 0 lagi.
  const weekTotal = stepsInDays(stepDays, weekDayIds(now)) + todayDelta;
  const weekKm = stepsToKm(weekTotal, height);

  const monthTotal = stepsInDays(stepDays, monthDayIds(now)) + todayDelta;
  const monthKm = stepsToKm(monthTotal, height);

  // Hari strength training minggu ini — dicatat dari fitur Fitness.
  const thisWeekGym = weeks[weekStartId(now)]?.gym ?? 0;

  const todayKm = stepsToKm(todaySteps, height);
  const dayHit = runMilestoneOf(todayKm, RUN_DAY_MILESTONES);
  const weekHit = runMilestoneOf(weekKm, RUN_WEEK_MILESTONES);
  const monthHit = runMilestoneOf(monthKm, RUN_MONTH_MILESTONES);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GreetingHeader />

      {/* ===== Hari ini ===== */}
      <SummaryCard style={styles.heroCard}>
        <VixText heading="label" additionalStyle={summaryText.label}>
          👣 Langkah hari ini
        </VixText>
        <VixText heading="header" additionalStyle={summaryText.value}>
          {groupDigits(String(todaySteps))}
        </VixText>
        <VixText heading="label" additionalStyle={summaryText.label}>
          ≈ {formatDecimal(todayKm)} km
          {dayHit ? `  ·  ${dayHit.emoji} ${dayHit.label}` : ''}
        </VixText>
      </SummaryCard>

      {/* ===== Minggu ini (Senin–Minggu, reset tiap Senin) ===== */}
      <MileageCard
        title="📅 Minggu Ini"
        sub="Senin–Minggu · mulai dari 0 lagi tiap Senin"
        km={weekKm}
        steps={weekTotal}
        hit={weekHit}
        milestones={RUN_WEEK_MILESTONES}
      />

      {/* Target kesehatan mingguan: aerobik + strength training 2 hari */}
      <View style={styles.card}>
        <VixText heading="title" additionalStyle={styles.cardTitle}>
          🎯 Target Sehat Mingguan
        </VixText>
        <VixText heading="label" additionalStyle={styles.subText}>
          Anjuran dewasa: ±150 menit aerobik sedang + strength training minimal
          2 hari per minggu.
        </VixText>
        <GoalRow
          label="🚶 Aktivitas aerobik"
          value={weekTotal}
          goal={WEEK_STEP_GOAL}
          unit="langkah"
        />
        <GoalRow
          label="🏋️ Strength training"
          value={thisWeekGym}
          goal={WEEK_GYM_GOAL}
          unit="hari"
        />
      </View>

      {/* ===== Bulan ini (tantangan ala Strava) ===== */}
      <MileageCard
        title={`🗓️ ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`}
        sub="Tantangan bulanan — akumulasi seluruh bulan"
        km={monthKm}
        steps={monthTotal}
        hit={monthHit}
        milestones={RUN_MONTH_MILESTONES}
      />

      {/* ===== Patokan jarak harian ala pelari ===== */}
      <View style={styles.card}>
        <VixText heading="title" additionalStyle={styles.cardTitle}>
          🏃 Patokan Jarak Harian
        </VixText>
        {RUN_DAY_MILESTONES.map((m) => {
          const reached = todayKm >= m.km;
          return (
            <View key={m.label} style={styles.msRow}>
              <VixText
                heading="bold"
                additionalStyle={reached ? styles.msLabelOn : styles.msLabel}>
                {m.emoji} {m.label}
              </VixText>
              <VixText
                heading="bold"
                additionalStyle={reached ? styles.msValueOn : styles.msValue}>
                {reached ? '✅' : `${formatDecimal(m.km)} km`}
              </VixText>
            </View>
          );
        })}
        <VixText heading="label" additionalStyle={styles.hint}>
          Jarak diperkirakan dari langkah × panjang langkah (±
          {formatDecimal(strideMeters(profile.heightCm) * 100)} cm untuk tinggi{' '}
          {profile.heightCm} cm).
        </VixText>
      </View>

      {/* ===== Apple Health ===== */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <VixText heading="title">🍎 Apple Health</VixText>
          {hkStatus === 'ok' && (
            <PressableScale onPress={loadHk} hitSlop={10} disabled={hkBusy}>
              <IconSymbol
                name="arrow.triangle.2.circlepath"
                size={20}
                color={hkBusy ? Color.TEXT_PLACEHOLDER : Color.MAIN}
              />
            </PressableScale>
          )}
        </View>

        {hkStatus === 'unsupported-platform' && (
          <VixText heading="label">
            Apple Health hanya tersedia di iPhone.
          </VixText>
        )}
        {hkStatus === 'needs-build' && (
          <VixText heading="label">
            Koneksi Apple Health aktif setelah app di-build lewat EAS (tidak
            tersedia di Expo Go).
          </VixText>
        )}
        {hkStatus === 'ok' && (
          <View style={styles.statRow}>
            <StatTile
              value={hk?.steps != null ? groupDigits(String(hk.steps)) : '–'}
              label="👣 Langkah"
            />
            <StatTile
              value={
                hk?.activeKcal != null ? groupDigits(String(hk.activeKcal)) : '–'
              }
              label="🔥 kkal Aktif"
            />
          </View>
        )}
        <VixText heading="label" additionalStyle={styles.hint}>
          Rekor harian ≥ {groupDigits(String(STEP_TIERS[0]))} langkah ada di
          tombol 👣 kanan atas.
        </VixText>
      </View>
    </ScrollView>
  );
}

// Kartu akumulasi (mingguan / bulanan) + bar menuju patokan berikutnya.
function MileageCard({
  title,
  sub,
  km,
  steps,
  hit,
  milestones,
}: {
  title: string;
  sub: string;
  km: number;
  steps: number;
  hit: { km: number; emoji: string; label: string } | null;
  milestones: { km: number; emoji: string; label: string }[];
}) {
  // Patokan berikutnya yang belum tercapai (null = semua sudah lewat).
  const next = milestones.find((m) => km < m.km) ?? null;
  const pct = next ? Math.min((km / next.km) * 100, 100) : 100;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <VixText heading="title">{title}</VixText>
        <VixText heading="bold" additionalStyle={styles.kmText}>
          {formatDecimal(km)} km
        </VixText>
      </View>
      <VixText heading="label" additionalStyle={styles.subText}>
        {sub}
      </VixText>
      <VixText heading="label" additionalStyle={styles.subText}>
        👣 {groupDigits(String(steps))} langkah
        {hit ? `  ·  ${hit.emoji} ${hit.label} tercapai` : ''}
      </VixText>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <VixText heading="label" additionalStyle={styles.subText}>
        {next
          ? `Menuju ${next.emoji} ${next.label} — kurang ${formatDecimal(next.km - km)} km`
          : '🎉 Semua patokan periode ini sudah tembus!'}
      </VixText>
    </View>
  );
}

// Baris target mingguan: bar progres + "x / y" dan ✅ kalau sudah tercapai.
function GoalRow({
  label,
  value,
  goal,
  unit,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
}) {
  const pct = Math.min((value / goal) * 100, 100);
  const done = value >= goal;
  return (
    <View style={styles.goalRow}>
      <View style={styles.goalTop}>
        <VixText heading="bold" additionalStyle={styles.goalLabel}>
          {label}
        </VixText>
        <VixText
          heading="bold"
          additionalStyle={done ? styles.goalDone : styles.goalValue}>
          {done ? '✅ ' : ''}
          {groupDigits(String(value))}/{groupDigits(String(goal))} {unit}
        </VixText>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%` },
            done && styles.barFillDone,
          ]}
        />
      </View>
    </View>
  );
}

// Kotak kecil satu angka statistik Apple Health.
function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <VixText heading="bold" additionalStyle={styles.statValue}>
        {value}
      </VixText>
      <VixText heading="label">{label}</VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  // Bentuk & warna kartunya dari <SummaryCard>; di sini cuma selisihnya.
  heroCard: { gap: 2, marginBottom: 14 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: { marginBottom: 4 },
  kmText: { color: Color.MAIN_DARK },
  subText: { color: Color.TEXT_LABEL, marginBottom: 2 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
    marginVertical: 8,
  },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: Color.MAIN },
  barFillDone: { backgroundColor: Color.SUCCESS },
  goalRow: { marginTop: 10 },
  goalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  goalLabel: { color: Color.TEXT_TITLE },
  goalValue: { color: Color.TEXT_LABEL },
  goalDone: { color: Color.SUCCESS },
  msRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  msLabel: { color: Color.TEXT_PLACEHOLDER },
  msLabelOn: { color: Color.TEXT_TITLE },
  msValue: { color: Color.TEXT_PLACEHOLDER },
  msValueOn: { color: Color.SUCCESS },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statTile: {
    flex: 1,
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: Color.TEXT_TITLE },
  hint: { marginTop: 8 },
});
