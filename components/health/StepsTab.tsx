import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { GreetingHeader } from '@/components/common/Greeting';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { WeekTargetCard } from '@/components/health/WeekTargetCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useHealthToday } from '@/hooks/useHealthToday';
import { formatDecimal, groupDigits, MONTH_NAMES } from '@/lib/format';
import {
  dayDocId,
  manualInDays,
  monthDayIds,
  recordStepDays,
  recordStepWeeks,
  setManualSteps,
  STEP_MANUAL_MAX,
  subscribeManualSteps,
  type StepManualMap,
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
  weekDayIds,
  type HealthProfile,
  type StepDaysMap,
} from '@/lib/health';
import { readRecentDailySteps } from '@/lib/healthkit';
import { SAVE_ERROR } from '@/lib/messages';

// Tab Steps 👣 — langkah hari ini dari Apple Health, plus akumulasi MINGGUAN
// (Senin–Minggu) dan BULANAN ala tantangan Strava. Jarak dipakai supaya
// pencapaiannya memakai patokan yang dikenal pelari (5K, Long Run, dst).
//
// ── Kapan angkanya mulai dari nol lagi ────────────────────────────────────
// Tiap kartu di layar ini punya periodenya sendiri, dan dulu itu cuma
// tersirat dari judulnya — "Minggu Ini" tidak memberi tahu apakah minggunya
// mulai Senin atau Minggu, dan "hari ini" tidak memberi tahu jam berapa ia
// berganti. Sekarang tiap kartu menuliskannya sendiri.
//
// Resetnya sendiri tidak butuh tugas latar apa pun: yang dijumlah cuma dayId
// yang termasuk periode berjalan, jadi begitu tanggalnya bergeser, hitungannya
// otomatis mulai dari nol. Tidak ada yang bisa lupa berjalan.
const RESET_HARIAN = '🔄 Mulai lagi tiap hari, jam 00.00';
const RESET_MINGGUAN = '🔄 Mulai lagi tiap Senin';
const RESET_BULANAN = '🔄 Mulai lagi tiap tanggal 1';
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

  // Langkah hari ini dari Apple Health — hook bersama dengan layar Rekor
  // Langkah 🏆. Kalau izin sudah pernah diberikan, datanya langsung diambil
  // tanpa perlu menekan tombol.
  const {
    status: hkStatus,
    today: hk,
    busy: hkBusy,
    reload: loadHk,
  } = useHealthToday();

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

  // Langkah yang dicatat sendiri (jalan tanpa HP — jam tangan Huawei tidak
  // tersambung ke Apple Health). Dokumennya SAMA dengan langganan langkah di
  // atas, jadi liveDoc menggabungkannya jadi satu listener: nol baca tambahan.
  const [manual, setManual] = useState<StepManualMap>({});
  useEffect(() => {
    if (!user) return;
    return subscribeManualSteps(user.uid, setManual);
  }, [user]);

  // `bukaKe` naik tiap modal tambah-manual dibuka, dan dipakai sebagai `key`
  // modalnya — jadi tiap dibuka isinya segar lagi. Sengaja TIDAK ikut berubah
  // saat ditutup, supaya animasi turunnya tidak terpotong oleh remount.
  const [tambahBuka, setTambahBuka] = useState(false);
  const [bukaKe, setBukaKe] = useState(0);

  const now = new Date();
  const height = profile.heightCm;
  const todayId = dayDocId(now);
  const manualToday = manual[todayId] ?? 0;

  // Langkah hari ini: angka live Apple Health, DITAMBAH yang kamu catat
  // sendiri. Keduanya dijumlah, tidak saling menimpa.
  const todaySteps = (hk?.steps ?? 0) + manualToday;

  // Angka hari ini yang dipakai: yang paling besar antara data live Apple
  // Health dan yang sudah tersimpan (sinkron bisa tertinggal beberapa jam).
  const todayDelta =
    Math.max(hk?.steps ?? 0, stepDays[todayId] ?? 0) - (stepDays[todayId] ?? 0);

  // Minggu berjalan (Senin–Minggu). Begitu ganti Senin, daftar dayId-nya ikut
  // bergeser → akumulasinya otomatis mulai dari 0 lagi.
  const hariMinggu = weekDayIds(now);
  const hariBulan = monthDayIds(now);
  const weekTotal =
    stepsInDays(stepDays, hariMinggu) + manualInDays(manual, hariMinggu) + todayDelta;
  const weekKm = stepsToKm(weekTotal, height);

  const monthTotal =
    stepsInDays(stepDays, hariBulan) + manualInDays(manual, hariBulan) + todayDelta;
  const monthKm = stepsToKm(monthTotal, height);

  // Hari strength training minggu ini — dicatat dari fitur Fitness.
  const thisWeekGym = weeks[weekStartId(now)]?.gym ?? 0;

  const todayKm = stepsToKm(todaySteps, height);
  // Patokan harian yang BELUM tembus — itu yang masih berguna dilihat.
  const belumTembus = RUN_DAY_MILESTONES.filter((m) => todayKm < m.km);
  const dayHit = runMilestoneOf(todayKm, RUN_DAY_MILESTONES);
  const weekHit = runMilestoneOf(weekKm, RUN_WEEK_MILESTONES);
  const monthHit = runMilestoneOf(monthKm, RUN_MONTH_MILESTONES);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <GreetingHeader />

      {/* ===== Hari ini =====
          Angkanya memang datang dari Apple Health, jadi tombol muat-ulangnya
          menempel di sini — kartu Apple Health tersendiri tidak ada lagi. */}
      <SummaryCard style={styles.heroCard}>
        <View style={styles.heroTop}>
          <VixText heading="label" additionalStyle={summaryText.label}>
            👣 Langkah hari ini
          </VixText>
          <View style={styles.heroActions}>
            {/* Tambah sendiri — untuk jalan yang tidak terbawa HP. Selalu ada,
                tidak bergantung izin Apple Health: justru saat Apple Health
                tidak mencatat apa-apa inilah tombol ini paling dibutuhkan. */}
            <PressableScale
              onPress={() => {
                setBukaKe((n) => n + 1);
                setTambahBuka(true);
              }}
              hitSlop={10}>
              <IconSymbol name="plus" size={20} color={Color.MAIN} />
            </PressableScale>
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
        </View>
        <VixText heading="header" additionalStyle={summaryText.value}>
          {groupDigits(String(todaySteps))}
        </VixText>
        <VixText heading="label" additionalStyle={summaryText.label}>
          ≈ {formatDecimal(todayKm)} km
          {dayHit ? `  ·  ${dayHit.emoji} ${dayHit.label}` : ''}
        </VixText>
        {/* Bagian yang kamu catat sendiri disebut terpisah — angka gabungan
            yang tidak bisa diurai lagi asal-usulnya cuma jadi angka yang tak
            berani kamu percaya. */}
        {manualToday > 0 && (
          <VixText heading="label" additionalStyle={summaryText.label}>
            ✍️ termasuk {groupDigits(String(manualToday))} langkah dicatat sendiri
          </VixText>
        )}
        <VixText heading="label" additionalStyle={summaryText.label}>
          {RESET_HARIAN}
        </VixText>
      </SummaryCard>

      <ManualStepsModal
        key={bukaKe}
        visible={tambahBuka}
        current={manualToday}
        onClose={() => setTambahBuka(false)}
        onSave={(jumlah) =>
          user
            ? setManualSteps(user.uid, todayId, jumlah)
            : Promise.reject(new Error('belum masuk'))
        }
      />

      {/* ===== Target MINGGUAN milikmu sendiri =====
          Ditaruh paling atas sesudah angka hari ini: inilah yang dikejar,
          jadi ia yang harus pertama terlihat. Mulai dari nol lagi tiap Senin
          jam 00.00, sama seperti akumulasi mingguannya. */}
      <WeekTargetCard km={weekKm} />

      {/* ===== Minggu ini (Senin–Minggu) ===== */}
      <MileageCard
        title="📅 Minggu Ini"
        reset={RESET_MINGGUAN}
        km={weekKm}
        steps={weekTotal}
        hit={weekHit}
        milestones={RUN_WEEK_MILESTONES}
      />

      {/* Anjuran kesehatan umum — BUKAN target pribadi (itu kartu di atas).
          Periodenya sama dengan kartu Minggu Ini, jadi keterangan resetnya
          cukup satu baris di sini juga. */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <VixText heading="title">🩺 Anjuran Kesehatan</VixText>
          <VixText heading="label" additionalStyle={styles.resetText}>
            {RESET_MINGGUAN}
          </VixText>
        </View>
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
        reset={RESET_BULANAN}
        km={monthKm}
        steps={monthTotal}
        hit={monthHit}
        milestones={RUN_MONTH_MILESTONES}
      />

      {/* ===== Patokan jarak harian ala pelari =====
          Yang SUDAH tembus hari ini tidak ditampilkan lagi — daftarnya jadi
          "sisa yang bisa dikejar", bukan tujuh baris tetap yang setengahnya
          cuma centang. Kalau semuanya tembus, barulah satu baris perayaan. */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <VixText heading="title">🏃 Patokan Jarak Harian</VixText>
          <VixText heading="label" additionalStyle={styles.resetText}>
            {RESET_HARIAN}
          </VixText>
        </View>
        {belumTembus.length === 0 ? (
          <VixText heading="bold" additionalStyle={styles.msValueOn}>
            🎉 Semua patokan hari ini sudah tembus!
          </VixText>
        ) : (
          belumTembus.map((m) => (
            <View key={m.label} style={styles.msRow}>
              <VixText heading="bold" additionalStyle={styles.msLabel}>
                {m.emoji} {m.label}
              </VixText>
              <VixText heading="bold" additionalStyle={styles.msValue}>
                kurang {formatDecimal(m.km - todayKm)} km
              </VixText>
            </View>
          ))
        )}
        <VixText heading="label" additionalStyle={styles.hint}>
          Jarak diperkirakan dari langkah × panjang langkah (±
          {formatDecimal(strideMeters(profile.heightCm) * 100)} cm untuk tinggi{' '}
          {profile.heightCm} cm).
        </VixText>
      </View>

    </ScrollView>
  );
}

/**
 * Tambah langkah yang tidak tercatat Apple Health — jalan tanpa HP, langkah
 * dari jam tangan yang tidak tersambung ke sini.
 *
 * Yang diisi TOTAL tambahan hari ini, bukan selisihnya. Bedanya besar: kolom
 * "tambah lagi" membuat menekan simpan dua kali menghitung dua kali, dan salah
 * ketik tidak bisa diperbaiki kecuali dengan menghitung mundur sendiri. Dengan
 * total, isian selalu memperlihatkan keadaan sekarang dan bisa dibetulkan
 * kapan saja — termasuk dikembalikan ke 0.
 *
 * Angka ini ikut ke rekap mingguan, bulanan, dan pencapaianmu. Itu sebabnya
 * validasinya ketat: yang salah ketik di sini tidak cuma salah hari ini, tapi
 * ikut terbawa ke semua angka yang kamu pakai untuk menilai dirimu sendiri.
 */
function ManualStepsModal({
  visible,
  current,
  onClose,
  onSave,
}: {
  visible: boolean;
  /** Tambahan yang sudah tercatat hari ini (0 = belum ada). */
  current: number;
  onClose: () => void;
  onSave: (steps: number) => Promise<void>;
}) {
  // Kolomnya berisi keadaan SEKARANG, bukan kolom kosong yang menyesatkan.
  // Diisi lewat nilai awal, bukan efek penyelaras: pemanggilnya memasang
  // `key` yang berganti tiap modal ini DIBUKA, jadi tiap pembukaan memang
  // mulai dari mount yang baru. Menyelaraskannya dengan useEffect akan
  // memaksa satu render tambahan tiap kali — dan itulah yang dilarang aturan
  // `set-state-in-effect`.
  const [teks, setTeks] = useState(current > 0 ? String(current) : '');
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function simpan() {
    const bersih = teks.trim();
    // Kosong = hapus tambahan hari ini. Disamakan dengan 0 supaya tidak perlu
    // tombol hapus tersendiri untuk satu angka.
    if (bersih === '') {
      await kirim(0);
      return;
    }
    // Hanya angka bulat. `Number()` menerima "1e5", " 12 ", dan "0x10" —
    // ketiganya bukan yang kamu maksud saat mengetik jumlah langkah.
    if (!/^\d+$/.test(bersih)) {
      setGalat('Isi angka saja, tanpa titik atau huruf. Contoh: 3500');
      return;
    }
    const jumlah = Number(bersih);
    if (jumlah > STEP_MANUAL_MAX) {
      setGalat(
        `Maksimal ${groupDigits(String(STEP_MANUAL_MAX))} langkah sekali catat. Kalau memang sebanyak itu, bagi per hari ya.`,
      );
      return;
    }
    await kirim(jumlah);
  }

  async function kirim(jumlah: number) {
    setSibuk(true);
    setGalat(null);
    try {
      await onSave(jumlah);
      onClose();
    } catch {
      setGalat(SAVE_ERROR);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <SheetModal
      visible={visible}
      title="✍️ Catat Langkah Sendiri"
      subtitle="Untuk jalan yang tidak terbawa HP"
      onClose={onClose}>
      <VixText heading="label" additionalStyle={styles.modalHint}>
        Isi TOTAL langkah tambahan hari ini — angka yang kamu lihat di jam
        tanganmu, dikurangi yang sudah masuk sendiri ke Apple Health. Angka ini
        ikut ke rekap mingguan, bulanan & pencapaianmu, jadi isi apa adanya.
      </VixText>
      <FormInput
        placeholder="mis. 3500"
        value={teks}
        onChangeText={(v) => {
          setTeks(v);
          setGalat(null);
        }}
        keyboardType="number-pad"
        editable={!sibuk}
      />
      {current > 0 && (
        <VixText heading="label" additionalStyle={styles.modalHint}>
          Sekarang tercatat {groupDigits(String(current))} langkah. Kosongkan
          kolomnya untuk menghapus tambahan hari ini.
        </VixText>
      )}
      <FormError message={galat} gap="top" />
      <DualButtons
        confirmLabel="Simpan"
        busy={sibuk}
        onCancel={onClose}
        onConfirm={simpan}
      />
    </SheetModal>
  );
}

// Kartu akumulasi (mingguan / bulanan) + bar menuju patokan berikutnya.
//
// Isinya sengaja tinggal TIGA hal: berapa jauh, berapa langkah, dan tinggal
// berapa lagi menuju patokan berikutnya. Baris "sudah tercapai" digabung ke
// baris langkahnya — dulu ia berdiri sendiri, dan kartunya jadi empat baris
// tulisan yang sebagian mengulang hal yang sama.
function MileageCard({
  title,
  reset,
  km,
  steps,
  hit,
  milestones,
}: {
  title: string;
  /** Kapan angkanya mulai dari nol lagi — mis. "🔄 Mulai lagi tiap Senin". */
  reset: string;
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
      <VixText heading="label" additionalStyle={styles.resetText}>
        {reset}
      </VixText>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <VixText heading="label" additionalStyle={styles.subText}>
        👣 {groupDigits(String(steps))} langkah
        {hit ? `  ·  ${hit.emoji} ${hit.label}` : ''}
      </VixText>
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  // Bentuk & warna kartunya dari <SummaryCard>; di sini cuma selisihnya.
  heroCard: { gap: 2, marginBottom: 14 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modalHint: { color: Color.TEXT_LABEL, marginBottom: 10 },
  // Judul kartu + tombol muat-ulang Apple Health di ujung kanannya.
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 14,
  },
  // `flexWrap` di baris judul kartu BUKAN hiasan: judul & keterangan di
  // sampingnya sama-sama tulisan yang panjangnya berubah-ubah (nama bulan,
  // "🔄 Mulai lagi tiap hari, jam 00.00", angka km yang makin besar). Tanpa
  // wrap, yang kedua tidak menyusut & tidak turun — ia menerobos keluar kartu
  // lalu terpotong di tepi layar. Dengan wrap ia turun ke baris berikutnya, dan
  // selama masih muat sebaris tampilannya sama persis seperti sebelumnya.
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 6,
  },
  kmText: { color: Color.MAIN_DARK },
  // Keterangan periode reset — sengaja sewarna & seukuran keterangan lain,
  // supaya ia terbaca sebagai catatan kecil, bukan bagian dari angkanya.
  resetText: { color: Color.TEXT_LABEL },
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  goalLabel: { color: Color.TEXT_TITLE },
  goalValue: { color: Color.TEXT_LABEL },
  goalDone: { color: Color.SUCCESS },
  msRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  msLabel: { color: Color.TEXT_PLACEHOLDER },
  msValue: { color: Color.TEXT_PLACEHOLDER },
  msValueOn: { color: Color.SUCCESS },
  hint: { marginTop: 8 },
});
