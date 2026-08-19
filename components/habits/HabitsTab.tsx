import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { GreetingHeader } from '@/components/common/Greeting';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { formatDecimal, parseDecimal } from '@/lib/format';
import {
  areaMeta,
  areaProgress,
  coreDone,
  countedHabits,
  dailyScore,
  defaultSlot,
  HABIT_AREAS,
  HABIT_SLOTS,
  HABIT_TIERS,
  habitArea,
  habitLink,
  habitsBySlot,
  habitTier,
  newHabitId,
  saveHabits,
  slotMeta,
  tierMeta,
  type HabitArea,
  type HabitLink,
  type HabitSlot,
  type HabitTier,
  type ScheduledHabit,
} from '@/lib/habits';
import {
  bumpStreak,
  clearWeightTarget,
  idealWeightRange,
  saveWeightTarget,
  setHabitDone,
  setHabitNote,
  setHabitSkipped,
  type HabitDay,
  type HealthProfile,
  type Streak,
  type WeightTarget,
} from '@/lib/health';
import { SAVE_ERROR } from '@/lib/messages';

// Tab Habits: kebiasaan harian (sama tiap hari) dibagi 3 sesi
// Pagi/Siang/Malam — bisa ditambah, di-rename, diurutkan, & dihapus. Plus
// ring progress + streak 🔥, air minum 💧, dan target berat 🎯.
export function HabitsTab({
  habits,
  day,
  dayId,
  profile,
  target,
  streak,
}: {
  habits: ScheduledHabit[];
  day: HabitDay;
  dayId: string;
  profile: HealthProfile;
  target: WeightTarget | null;
  streak: Streak | null;
}) {
  const { user } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<HabitArea | null>(null);
  // Tab sesi aktif — default ke sesi sesuai jam sekarang (Pagi/Siang/Malam).
  const [activeSlot, setActiveSlot] = useState<HabitSlot>(() =>
    defaultSlot(countedHabits(habits, day.skipped), day.done, new Date()),
  );

  // Ganti hari (lewat tengah malam) → `dayId` dari induk berubah, dan tab sesi
  // dikembalikan ke default hari BARU yaitu Pagi. Tanpa ini tabnya nyangkut di
  // Malam kemarin walau ceklisnya sudah kosong lagi.
  // Sengaja HANYA bergantung pada dayId: kalau `habits`/`day.done` ikut jadi
  // dependency, tab akan lompat sendiri tiap kali satu kebiasaan dicentang.
  useEffect(() => {
    setActiveSlot(
      defaultSlot(countedHabits(habits, day.skipped), day.done, new Date()),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId]);

  // Modal tambah/edit kebiasaan.
  const [editing, setEditing] = useState<ScheduledHabit | 'new' | null>(null);
  const [editSlot, setEditSlot] = useState<HabitSlot>('morning');
  const [fLabel, setFLabel] = useState('');
  const [fArea, setFArea] = useState<HabitArea>('body');
  const [fTier, setFTier] = useState<HabitTier>('support');
  const [busy, setBusy] = useState(false);

  // Modal pasang/ubah target berat.
  const [targetOpen, setTargetOpen] = useState(false);
  const [fTarget, setFTarget] = useState('');
  const [targetError, setTargetError] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);

  const range = idealWeightRange(profile.heightCm);
  const grouped = habitsBySlot(habits);
  // Saringan area hidup (ketuk ikonnya di atas). null = tampilkan semua.
  // Berlaku BERSAMA tab sesi: yang tampil = area ini, di sesi yang sedang
  // dibuka. Sengaja tidak ikut kereset saat pindah sesi — supaya bisa menyusuri
  // satu area dari Pagi ke Malam tanpa memilih ulang.
  const activeList = areaFilter
    ? grouped[activeSlot].filter((h) => habitArea(h) === areaFilter)
    : grouped[activeSlot];

  // DUA daftar yang sengaja dibedakan:
  // • `grouped`  — daftar LENGKAP, yang ditampilkan di layar (baris yang
  //                dilewati tetap kelihatan, cuma bertanda ⏭️).
  // • `counted`  — yang BERLAKU hari ini, dasar semua angka. Kebiasaan yang
  //                ditandai ✗ dikeluarkan supaya tidak menahan skor.
  const counted = countedHabits(habits, day.skipped);
  const countedBySlot = habitsBySlot(counted);

  // Ukuran keberhasilan hari ini: skor 0–10 + 5 area hidup yang terjaga —
  // bukan lagi "berapa dari 39 tercentang".
  const score = dailyScore(counted, day.done);
  const areas = areaProgress(counted, day.done);
  const keptCount = areas.filter((a) => a.kept).length;
  const coreAllDone = coreDone(counted, day.done);

  // Rentetan 🔥 bisa jadi lengkap dari LUAR layar ini: olahraga dicentang di
  // fitur Fitness, lalu baris cerminnya di sini ikut tercentang tanpa ada
  // tombol yang ditekan di layar ini. Kalau rentetan cuma dinaikkan di dalam
  // handleToggle, hari yang ditutup oleh olahraga tidak pernah terhitung.
  // `bumpStreak` sendiri menolak menghitung dua kali sehari → aman berulang.
  useEffect(() => {
    if (!user || !coreAllDone || streak?.lastDayId === dayId) return;
    bumpStreak(user.uid, streak, dayId).catch(() => undefined);
    // `streak` utuh dipakai bumpStreak, tapi yang menentukan perlu-tidaknya
    // menulis cuma lastDayId — dependency sengaja dibatasi ke itu supaya
    // objek streak yang baru tiap snapshot tidak memicu tulis ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, coreAllDone, dayId, streak?.lastDayId]);

  // Progress target berat (rumus sama untuk turun / naik).
  let targetPercent = 0;
  let remaining = 0;
  let reached = false;
  if (target) {
    const totalDelta = target.targetWeightKg - target.startWeightKg;
    const doneDelta = profile.weightKg - target.startWeightKg;
    targetPercent =
      totalDelta === 0
        ? 100
        : Math.max(0, Math.min((doneDelta / totalDelta) * 100, 100));
    remaining = Math.abs(target.targetWeightKg - profile.weightKg);
    reached =
      totalDelta >= 0
        ? profile.weightKg >= target.targetWeightKg
        : profile.weightKg <= target.targetWeightKg;
  }

  // Simpan seluruh daftar kebiasaan (urut Pagi→Siang→Malam).
  async function saveList(next: ScheduledHabit[]) {
    if (!user) return;
    setError(null);
    try {
      await saveHabits(user.uid, next);
    } catch {
      setError('Gagal menyimpan kebiasaan. Coba lagi.');
    }
  }

  function reassemble(g: Record<HabitSlot, ScheduledHabit[]>): ScheduledHabit[] {
    return [...g.morning, ...g.daytime, ...g.night];
  }

  /**
   * Buka tempat kebiasaan ini dikerjakan: layar lain di dalam app, atau
   * aplikasi luar. Kalau aplikasinya belum terpasang, jatuh ke alamat webnya —
   * jangan sampai ketukannya terasa mati begitu saja.
   */
  function openHabitLink(link: HabitLink) {
    if (link.route) {
      router.push({ pathname: link.route.pathname, params: link.route.params });
      return;
    }
    if (!link.external) return;
    Linking.openURL(link.external.scheme).catch(() =>
      Linking.openURL(link.external!.web).catch(() => undefined),
    );
  }

  async function handleToggle(habit: ScheduledHabit) {
    if (!user) return;
    setError(null);
    const nextChecked = !day.done[habit.id];
    try {
      await setHabitDone(user.uid, dayId, habit.id, nextChecked);
      // Streak naik saat seluruh kebiasaan 🟢 INTI hari ini beres — bukan
      // menunggu ke-39 semuanya tercentang (itu praktis mustahil).
      if (nextChecked) {
        const nextDone = { ...day.done, [habit.id]: true };
        if (coreDone(counted, nextDone)) {
          await bumpStreak(user.uid, streak, dayId);
        }
      }
    } catch {
      setError('Gagal menyimpan centang. Coba lagi.');
    }
  }

  /**
   * Tandai ✗ = kebiasaan ini DILEWATI hari ini (atau batalkan lagi).
   * Bedanya dengan centang: ini bukan "selesai", tapi "hari ini tidak berlaku".
   * Efeknya ia keluar dari skor, area, badge tab, & kartu reminder Dashboard.
   */
  async function handleSkip(habit: ScheduledHabit) {
    if (!user) return;
    setError(null);
    const nextSkipped = !day.skipped[habit.id];
    try {
      await setHabitSkipped(user.uid, dayId, habit.id, nextSkipped);
      // Kalau yang dilewati ini kebiasaan 🟢 Inti terakhir yang menggantung,
      // sisa yang berlaku hari ini jadi beres semua → rentetan 🔥 ikut naik,
      // supaya skor 10/10 tidak pernah tampil tanpa streaknya.
      if (nextSkipped) {
        const rest = countedHabits(habits, {
          ...day.skipped,
          [habit.id]: true,
        });
        const nextDone = { ...day.done, [habit.id]: false };
        if (coreDone(rest, nextDone)) {
          await bumpStreak(user.uid, streak, dayId);
        }
      }
    } catch {
      setError('Gagal menyimpan tanda lewati. Coba lagi.');
    }
  }

  /** Simpan catatan singkat (refleksi / syukur / rhema) kebiasaan hari ini. */
  async function handleNote(habit: ScheduledHabit, text: string) {
    if (!user) return;
    try {
      await setHabitNote(user.uid, dayId, habit.id, text);
    } catch {
      setError('Gagal menyimpan catatan. Coba lagi.');
    }
  }

  function openAdd(slot: HabitSlot) {
    setEditing('new');
    setEditSlot(slot);
    setFLabel('');
    setFArea('body');
    setFTier('support');
  }

  function openEdit(habit: ScheduledHabit) {
    setEditing(habit);
    setEditSlot(habit.slot);
    setFLabel(habit.label);
    setFArea(habitArea(habit));
    setFTier(habitTier(habit));
  }

  async function handleSaveHabit() {
    if (!user || busy) return;
    // Saat MENGUBAH tidak ada lagi yang bisa disunting di sheet ini: nama,
    // tingkat, & area sudah final di kode, dan Naik/Turun menyimpan sendiri
    // begitu ditekan. Jadi "Simpan" cukup menutup — tanpa tulis Firestore.
    if (editing !== 'new') {
      setEditing(null);
      return;
    }
    const label = fLabel.trim();
    if (!label) return;
    setBusy(true);
    const g = habitsBySlot(habits);
    g[editSlot] = [
      ...g[editSlot],
      { id: newHabitId(), label, slot: editSlot, area: fArea, tier: fTier },
    ];
    await saveList(reassemble(g));
    setBusy(false);
    setEditing(null);
  }

  async function handleDeleteHabit() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    const g = habitsBySlot(habits);
    g[editing.slot] = g[editing.slot].filter((h) => h.id !== editing.id);
    await saveList(reassemble(g));
    setBusy(false);
    setEditing(null);
  }

  // Geser urutan kebiasaan dalam satu sesi (Naik/Turun).
  async function moveHabit(dir: -1 | 1) {
    if (!editing || editing === 'new') return;
    const g = habitsBySlot(habits);
    const list = g[editing.slot];
    const i = list.findIndex((h) => h.id === editing.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    g[editing.slot] = list;
    await saveList(reassemble(g));
  }

  function openTarget() {
    setFTarget(target ? String(target.targetWeightKg) : '');
    setTargetError(null);
    setTargetOpen(true);
  }

  async function handleSaveTarget() {
    if (!user || savingTarget) return;
    const value = parseDecimal(fTarget);
    if (value < 30 || value > 250) {
      setTargetError('Target berat tidak masuk akal — cek lagi.');
      return;
    }
    setSavingTarget(true);
    setTargetError(null);
    try {
      await saveWeightTarget(user.uid, {
        targetWeightKg: value,
        startWeightKg: target?.startWeightKg ?? profile.weightKg,
      });
      setTargetOpen(false);
    } catch {
      setTargetError(SAVE_ERROR);
    } finally {
      setSavingTarget(false);
    }
  }

  async function handleClearTarget() {
    if (!user || savingTarget) return;
    setSavingTarget(true);
    try {
      await clearWeightTarget(user.uid);
      setTargetOpen(false);
    } catch {
      setTargetError('Gagal menghapus target. Coba lagi.');
    } finally {
      setSavingTarget(false);
    }
  }

  // Posisi kebiasaan yang sedang diedit dalam sesinya (untuk Naik/Turun).
  const editIndex =
    editing && editing !== 'new'
      ? grouped[editing.slot].findIndex((h) => h.id === editing.id)
      : -1;
  const editCount =
    editing && editing !== 'new' ? grouped[editing.slot].length : 0;

  return (
    <View style={styles.flex}>
      {/* ===== Header TETAP — sapaan, ringkasan, & tab sesi tidak ikut
          ter-scroll; hanya daftar kebiasaan di bawahnya yang bergeser. ===== */}
      <View style={styles.fixedHeader}>
        {/* Sapaan + tanggal (komponen bersama). Streak 🔥 tampil sebagai
            tombol di pojok kanan atas header Health, bukan di sini. */}
        <GreetingHeader />

        {/* ===== Baris atas: Kebiasaan (ring) + Target berat =====
            Sengaja dibuat serendah mungkin: ring mengecil & rekap area
            digeser ke SAMPING ring, supaya daftar kebiasaan di bawah dapat
            ruang scroll yang lega. */}
        <View style={styles.statsRow}>
          {/* Skor 0–10 murni dari kebiasaan 🟢 Inti — Pendukung & Opsional
              tidak menambah angka ini (lihat `dailyScore`). */}
          <View style={styles.heroCard}>
            <DonutChart
              size={64}
              thickness={8}
              slices={[
                { value: score, color: Color.MAIN_LIGHT },
                { value: 10 - score, color: Color.MAIN },
              ]}>
              <VixText heading="title" additionalStyle={styles.heroRingText}>
                {score}
              </VixText>
              {/* 🟢 = penanda skor ini hanya naik dari kebiasaan Inti */}
              <VixText heading="label" additionalStyle={styles.heroRingSub}>
                🟢/10
              </VixText>
            </DonutChart>
            <View style={styles.heroSide}>
              <VixText heading="bold" additionalStyle={styles.heroSideValue}>
                {keptCount}/5
              </VixText>
              <VixText heading="label" additionalStyle={styles.heroRingSub}>
                area terjaga
              </VixText>
            </View>
          </View>

          {/* Seluruh kartu = tombol ubah/pasang target. Judul "🎯 Target" &
              tombol "Ubah" dihapus biar kartunya pendek. */}
          <PressableScale style={styles.targetCard} onPress={openTarget}>
            {target ? (
              <>
                <VixText heading="subheader" additionalStyle={styles.targetValue}>
                  {formatDecimal(profile.weightKg)}
                  <VixText heading="label">
                    {' '}
                    → {formatDecimal(target.targetWeightKg)} kg
                  </VixText>
                </VixText>
                <ProgressBar
                  value={targetPercent}
                  total={100}
                  height={8}
                  color={Color.MAIN}
                  track={Color.CONTRAST_CONTAINER}
                />
                <VixText heading="label" additionalStyle={styles.targetSub}>
                  🎯{' '}
                  {reached
                    ? 'Tercapai! 🎉'
                    : `sisa ${formatDecimal(remaining)} kg 💪`}
                </VixText>
              </>
            ) : (
              <VixText heading="label">
                🎯 Belum ada target. Sehat{' '}
                {formatDecimal(range.min)}–{formatDecimal(range.max)} kg.
              </VixText>
            )}
          </PressableScale>
        </View>

        {/* Lima area hidup hari ini — kelihatan mana yang masih bolong.
            Sekaligus SARINGAN: ketuk satu area → daftar di bawah hanya berisi
            area itu; ketuk lagi area yang sama → saringannya lepas. */}
        <View style={styles.areaRow}>
          {areas.map((a) => {
            const meta = areaMeta(a.area);
            const picked = areaFilter === a.area;
            return (
              <PressableScale
                key={a.area}
                style={[
                  styles.areaChip,
                  a.kept && styles.areaChipKept,
                  picked && styles.areaChipPicked,
                ]}
                onPress={() =>
                  setAreaFilter((prev) => (prev === a.area ? null : a.area))
                }>
                <VixText additionalStyle={styles.areaEmoji}>
                  {meta.emoji}
                </VixText>
                <VixText
                  heading="label"
                  additionalStyle={
                    picked
                      ? styles.areaTextPicked
                      : a.kept
                        ? styles.areaTextKept
                        : styles.areaText
                  }>
                  {a.total === 0 ? '—' : `${a.done}/${a.total}`}
                </VixText>
              </PressableScale>
            );
          })}
        </View>

        {/* ===== Kebiasaan: tab sesi Pagi/Siang/Malam (satu sesi tampil biar
            tak perlu scroll panjang; default ke sesi jam sekarang) ===== */}
        <SegmentTabs
          tabs={HABIT_SLOTS.map((s) => {
            // Hitungan sesi ikut memakai daftar yang BERLAKU: yang dilewati ✗
            // hilang dari pembilang maupun penyebut.
            const list = countedBySlot[s.key];
            const slotDone = list.filter((h) => day.done[h.id]).length;
            const complete = list.length > 0 && slotDone === list.length;
            const allSkipped = grouped[s.key].length > 0 && list.length === 0;
            return {
              key: s.key,
              label: `${s.emoji} ${s.label}`,
              sub: allSkipped
                ? '⏭️ dilewati'
                : complete
                  ? '✅ beres'
                  : `${slotDone}/${list.length}`,
            };
          })}
          value={activeSlot}
          onChange={setActiveSlot}
        />
      </View>

      {/* Kebiasaan sesi yang aktif — bagian yang bisa di-scroll */}
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        <View style={styles.slotBlock}>
          {activeList.map((habit, index) => {
            // ✗ menang atas centang: baris yang dilewati tidak pernah tampil
            // tercentang (tanda done-nya memang ikut dilepas saat di-skip).
            const skipped = !!day.skipped[habit.id];
            const checked = !skipped && !!day.done[habit.id];
            const tier = habitTier(habit);
            // Kebiasaan yang sebenarnya dikerjakan di layar/aplikasi lain →
            // dapat keterangan kecil + ketukan yang langsung ke sana.
            const link = habitLink(habit);
            // Baris cermin (olahraga): centangnya datang dari fitur Fitness,
            // jadi di sini ia cuma penunjuk keadaan + pintasan ke sana.
            const fromFitness = link?.mirror === true;
            return (
              // Berganti sesi (Pagi→Siang→Malam) = daftar baru masuk berurutan
              // dari bawah, bukan berkedip sekaligus. Jedanya dibatasi 8 baris
              // pertama supaya daftar panjang tidak terasa lambat.
              <Animated.View
                key={habit.id}
                entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(
                  260,
                )}>
                <View
                  style={[
                    styles.row,
                    checked && styles.rowDone,
                    skipped && styles.rowSkipped,
                    // Opsional diredupkan sedikit: bonus, bukan tuntutan.
                    tier === 'optional' && styles.rowOptional,
                  ]}>
                  {/* Getaran "berhasil" khusus saat MENCENTANG — melepas
                      centang cukup ketukan biasa. Yang sudah dilewati tidak
                      bisa dicentang: batalkan ✗ dulu. */}
                  <PressableScale
                    onPress={() =>
                      fromFitness ? openHabitLink(link!) : handleToggle(habit)
                    }
                    disabled={skipped && !fromFitness}
                    hitSlop={8}
                    haptic={checked || fromFitness ? 'light' : 'success'}>
                    <CheckCircle
                      checked={checked}
                      skipped={skipped}
                      locked={fromFitness}
                    />
                  </PressableScale>
                  {/* Nama kebiasaan tidak bisa ditekan — ubah/urutkan/hapus
                      lewat tombol ✏️. KECUALI yang punya pintasan: di situ
                      ketukan membawa ke tempat kebiasaannya dikerjakan. */}
                  <PressableScale
                    style={styles.rowMain}
                    onPress={() => link && openHabitLink(link)}
                    disabled={!link}>
                    <VixText
                      heading="paragraph"
                      additionalStyle={[
                        styles.habitText,
                        (checked || skipped) && styles.habitTextDone,
                      ]}>
                      {tierMeta(tier).emoji} {habit.label}
                    </VixText>
                    {link && (
                      <VixText
                        heading="label"
                        additionalStyle={[styles.linkHint, { color: link.color }]}>
                        {link.note}
                      </VixText>
                    )}
                  </PressableScale>
                  {/* Dua tombol kanan dirapatkan sendiri (gap lebih kecil dari
                      gap baris) supaya nama kebiasaan tidak kehilangan ruang. */}
                  <View style={styles.rowActions}>
                    {/* ✗ → lewati kebiasaan ini KHUSUS hari ini (tekan lagi =
                        batal). Bukan hapus: daftarnya tetap utuh besok.
                        Baris olahraga tidak punya tombol ini: melewati latihan
                        dilakukan di fitur Fitness, biar tandanya tidak bisa
                        beda antara dua layar. */}
                    {!fromFitness && (
                      <PressableScale
                        style={[styles.editButton, skipped && styles.skipButtonOn]}
                        onPress={() => handleSkip(habit)}
                        hitSlop={8}
                        haptic="warning">
                        <IconSymbol
                          name="xmark"
                          size={16}
                          color={skipped ? Color.DANGER : Color.TEXT_LABEL}
                        />
                      </PressableScale>
                    )}
                    {/* Tombol edit → buka modal ubah / urutkan / hapus */}
                    <PressableScale
                      style={styles.editButton}
                      onPress={() => openEdit(habit)}
                      hitSlop={8}>
                      <IconSymbol
                        name="pencil"
                        size={18}
                        color={Color.TEXT_LABEL}
                      />
                    </PressableScale>
                  </View>
                </View>
                {/* Kebiasaan yang minta catatan (refleksi, syukur, rhema).
                    Yang dilewati tidak perlu diisi. */}
                {habit.note && !skipped && (
                  <HabitNote
                    key={`${habit.id}-${dayId}`}
                    placeholder={habit.notePrompt ?? 'Tulis singkat saja…'}
                    value={day.notes[habit.id] ?? ''}
                    onSave={(t) => handleNote(habit, t)}
                  />
                )}
              </Animated.View>
            );
          })}

          {/* Sesi ini memang tidak punya kebiasaan dari area yang disaring —
              jelaskan, jangan cuma tampil kosong tanpa sebab. */}
          {areaFilter && activeList.length === 0 && (
            <PressableScale
              style={styles.emptyFilter}
              onPress={() => setAreaFilter(null)}>
              <VixText heading="label" additionalStyle={styles.emptyFilterText}>
                Tidak ada kebiasaan {areaMeta(areaFilter).emoji}{' '}
                {areaMeta(areaFilter).label} di sesi{' '}
                {slotMeta(activeSlot).label.toLowerCase()}
              </VixText>
            </PressableScale>
          )}

          {/* Tombol tambah disembunyikan saat menyaring: kebiasaan baru masuk
              ke sesi ini, bukan ke area yang sedang disaring — kalau muncul,
              hasilnya terasa "hilang" begitu ditambahkan. */}
          {!areaFilter && (
            <PressableScale
              style={styles.addRow}
              onPress={() => openAdd(activeSlot)}>
              <IconSymbol name="plus" size={16} color={Color.MAIN} />
              <VixText heading="label" additionalStyle={styles.addText}>
                Tambah kebiasaan {slotMeta(activeSlot).label.toLowerCase()}
              </VixText>
            </PressableScale>
          )}
        </View>

        <FormError message={error} gap="none" additionalStyle={styles.error} />
      </KeyboardAwareScrollView>

      {/* Sheet tambah / edit kebiasaan */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Kebiasaan' : 'Ubah Kebiasaan'}
        subtitle={
          editing
            ? `${HABIT_SLOTS.find((s) => s.key === editSlot)!.emoji} ${
                HABIT_SLOTS.find((s) => s.key === editSlot)!.label
              }`
            : undefined
        }
        onClose={() => setEditing(null)}>
        {/* Daftar kebiasaan sudah FINAL. Saat MENGUBAH, namanya cuma
            ditampilkan — ganti nama, tingkat, & area dilakukan langsung di
            kode. Isian lengkapnya tinggal untuk kebiasaan BARU. */}
        {editing === 'new' ? (
          <>
            <FormInput
              placeholder="Nama kebiasaan"
              value={fLabel}
              onChangeText={setFLabel}
              autoFocus
              editable={!busy}
            />

            {/* Tingkat menentukan streak & skor — inilah pengganti "39/39" */}
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Tingkat (yang 🟢 Inti menentukan streak 🔥)
            </VixText>
            <View style={styles.pickRow}>
              {HABIT_TIERS.map((t) => (
                <Chip
                  key={t.key}
                  label={`${t.emoji} ${t.label}`}
                  active={fTier === t.key}
                  onPress={() => setFTier(t.key)}
                  additionalStyle={styles.pickChip}
                />
              ))}
            </View>

            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Area hidup
            </VixText>
            <View style={styles.pickRow}>
              {HABIT_AREAS.map((a) => (
                <Chip
                  key={a.key}
                  label={`${a.emoji} ${a.label}`}
                  active={fArea === a.key}
                  onPress={() => setFArea(a.key)}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.fixedNameBox}>
            <VixText heading="bold" additionalStyle={styles.fixedNameText}>
              {fLabel}
            </VixText>
          </View>
        )}

        {/* Urutkan dalam sesi (Naik/Turun) — hanya saat mengedit */}
        {editing && editing !== 'new' && (
          <View style={styles.moveRow}>
            <PressableScale
              style={[styles.moveButton, editIndex <= 0 && styles.moveDisabled]}
              onPress={() => moveHabit(-1)}
              disabled={editIndex <= 0}>
              <IconSymbol name="chevron.up" size={18} color={Color.MAIN_DARK} />
              <VixText heading="label" additionalStyle={styles.moveText}>
                Naik
              </VixText>
            </PressableScale>
            <PressableScale
              style={[
                styles.moveButton,
                editIndex >= editCount - 1 && styles.moveDisabled,
              ]}
              onPress={() => moveHabit(1)}
              disabled={editIndex >= editCount - 1}>
              <IconSymbol
                name="chevron.down"
                size={18}
                color={Color.MAIN_DARK}
              />
              <VixText heading="label" additionalStyle={styles.moveText}>
                Turun
              </VixText>
            </PressableScale>
          </View>
        )}

        <EditDelete
          editing={editing}
          label="Hapus kebiasaan ini"
          busy={busy}
          onDelete={handleDeleteHabit}
        />

        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSaveHabit}
        />
      </SheetModal>

      {/* Modal pasang/ubah target berat */}
      <CenterDialog visible={targetOpen} onClose={() => setTargetOpen(false)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          Target Berat
        </VixText>
        <VixText heading="label" additionalStyle={styles.modalHint}>
          Rentang sehat (BMI 18,5–22,9) untuk {profile.heightCm} cm:{' '}
          {formatDecimal(range.min)}–{formatDecimal(range.max)} kg. Kalau fokus
          bangun otot, boleh di atas itu — jaga lingkar perut tetap &lt; 90 cm.
        </VixText>
        <FormInput
          placeholder="Target berat (kg)"
          keyboardType="decimal-pad"
          value={fTarget}
          onChangeText={setFTarget}
          autoFocus
          editable={!savingTarget}
        />
        <FormError
          message={targetError}
          gap="none"
          additionalStyle={styles.error}
        />
        {target && (
          <PressableScale onPress={handleClearTarget} disabled={savingTarget}>
            <VixText heading="bold" additionalStyle={styles.deleteText}>
              Hapus target
            </VixText>
          </PressableScale>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={savingTarget}
          onCancel={() => setTargetOpen(false)}
          onConfirm={handleSaveTarget}
        />
      </CenterDialog>
    </View>
  );
}

// Kolom catatan singkat di bawah kebiasaan yang memintanya. Disimpan saat
// selesai mengetik (onBlur) — bukan tiap huruf, biar hemat tulis Firestore.
function HabitNote({
  placeholder,
  value,
  onSave,
}: {
  placeholder: string;
  value: string;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(value);
  return (
    <FormInput
      style={styles.noteInput}
      placeholder={placeholder}
      value={text}
      onChangeText={setText}
      onBlur={() => {
        if (text.trim() !== value) onSave(text.trim());
      }}
      multiline
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Bagian atas yang menempel (sapaan + ringkasan + tab sesi).
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: Color.BACKGROUND,
  },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  // Ring + rekap area berdampingan (bukan bertumpuk) → kartunya jadi pendek.
  heroCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroRingText: { color: Color.TEXT_REVERSE },
  heroRingSub: { color: Color.TEXT_ON_DARK_MUTED },
  heroSide: { flex: 1 },
  heroSideValue: { color: Color.TEXT_REVERSE },
  // Lima area hidup — hijau muda kalau kebiasaan intinya sudah beres.
  areaRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  areaChip: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  areaChipKept: {
    borderColor: Color.MAIN,
    backgroundColor: Color.MAIN_TRANSPARENT,
  },
  // Area yang sedang dipakai menyaring — sengaja PEKAT, bukan pucat seperti
  // "terjaga", supaya "sedang menyaring" tidak tertukar dengan "sudah beres".
  areaChipPicked: {
    borderColor: Color.MAIN_DARK,
    backgroundColor: Color.MAIN_DARK,
  },
  areaEmoji: { fontSize: 16, lineHeight: 20 },
  areaText: { color: Color.TEXT_PLACEHOLDER },
  areaTextKept: { color: Color.MAIN_DARK },
  areaTextPicked: { color: Color.TEXT_REVERSE },
  // Kartu penataan sekali jalan (hilang sendiri setelah semua beres).
  targetCard: {
    flex: 1,
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 8,
  },
  targetSub: { color: Color.TEXT_LABEL },
  targetValue: { color: Color.TEXT_TITLE },
  // Blok sesi aktif
  slotBlock: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
  },
  rowDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  // ✕ Dilewati hari ini — merah samar, pasangan sejajar dari hijau samar milik
  // baris tercentang: sama-sama "sudah diputuskan", cuma hasilnya berlawanan.
  rowSkipped: {
    backgroundColor: Color.DANGER_TRANSPARENT,
    borderColor: Color.DANGER,
  },
  skipButtonOn: { backgroundColor: Color.FINANCE_EXPENSE },
  // ⚪ Opsional — bonus, jadi tampilannya sengaja lebih kalem.
  rowOptional: { opacity: 0.7 },
  // Catatan singkat di bawah kebiasaan refleksi/syukur/rhema.
  noteInput: {
    minHeight: 64,
    textAlignVertical: 'top',
    marginTop: -2,
    marginBottom: 8,
  },
  // Pilihan tingkat & area di modal ubah kebiasaan.
  fieldLabel: { marginTop: 14, marginBottom: 6 },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickChip: { flex: 1 },
  rowMain: { flex: 1 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.CONTRAST_CONTAINER,
  },
  habitText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  habitTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  // Nama kebiasaan di sheet Ubah — hanya dibaca, bukan diisi. Sengaja TIDAK
  // dibuat mirip kolom isian supaya tidak terkesan bisa diketik.
  fixedNameBox: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fixedNameText: { color: Color.TEXT_TITLE },
  // Keterangan baris olahraga: centangnya datang dari fitur Fitness.
  linkHint: { color: Color.FITNESS_DARK, marginTop: 1 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Color.MAIN_LIGHT,
  },
  addText: { color: Color.MAIN },
  // Keterangan saat saringan area tidak menyisakan apa pun di sesi ini.
  emptyFilter: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emptyFilterText: { color: Color.ACCENT_DARK },
  // Naik/Turun di sheet edit
  moveRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  moveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  moveDisabled: { opacity: 0.4 },
  moveText: { color: Color.MAIN_DARK },
  error: { marginBottom: 8, marginTop: 6 },
  modalTitle: { marginBottom: 4 },
  modalHint: { marginBottom: 10 },
  deleteText: { color: Color.DANGER, textAlign: 'center', marginTop: 12 },
});
