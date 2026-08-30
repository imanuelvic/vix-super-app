import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DualButtons } from '@/components/common/DualButtons';
import { EditButton } from '@/components/common/EditButton';
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
import { useScrollTop } from '@/hooks/useScrollTop';
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
  filledNoteLines,
  habitLink,
  habitNoteDone,
  habitNoteLines,
  habitsBySlot,
  habitTier,
  isFixedHabit,
  isNoteDrivenHabit,
  joinNoteLines,
  newHabitId,
  splitNoteLines,
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
import { openExternalUrl } from '@/lib/linking';
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
  focusRhema = false,
  onFocusDone,
}: {
  habits: ScheduledHabit[];
  day: HabitDay;
  dayId: string;
  profile: HealthProfile;
  target: WeightTarget | null;
  streak: Streak | null;
  /**
   * Datang dari kartu "✍️ Rhema Pagi Ini" di Home: buka sesi tempat baris
   * Rhema berada lalu gulung tepat ke barisnya, supaya tulisan paginya bisa
   * langsung dibaca ulang tanpa mencari sendiri di daftar yang panjang.
   */
  focusRhema?: boolean;
  /** Dipanggil setelah lompatannya jalan — induk membersihkan param dari URL. */
  onFocusDone?: () => void;
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

  // Loncat ke baris pertama yang belum dicentang saat tab sesi ditekan LAGI.
  // Posisi tiap baris dicatat lewat onLayout (relatif ke blok daftarnya), jadi
  // tidak perlu mengukur ulang apa pun saat tombolnya ditekan.
  // Ref yang sama juga dipakai tab Habits di bawah: menekan tab-nya lagi saat
  // halaman ini sedang dibuka → balik ke paling atas (lihat hooks/useScrollTop).
  const { ref: scrollRef } = useScrollTop();
  const rowY = useRef<Record<string, number>>({});
  const blockY = useRef(0);

  // ===== Lompatan dari kartu "✍️ Rhema Pagi Ini" di Home =====
  // Baris Rhema dikenali dari sifatnya (centangnya ditentukan tulisan), bukan
  // dari id yang ditulis tangan — jadi tetap ketemu walau namanya diganti.
  const rhema = habits.find(isNoteDrivenHabit);
  // Dipisah jadi nilai primitif: `habits` datang dari Firestore dan objeknya
  // baru tiap snapshot, jadi memakai objeknya sebagai dependency akan memicu
  // efek di bawah berulang kali.
  const rhemaId = rhema?.id ?? null;
  const rhemaSlot = rhema?.slot ?? null;

  // Sudah pernah melompat sejak layar ini dibuka? Satu penanda untuk DUA
  // lompatan sekaligus (baris Rhema dari Home, dan baris pertama yang masih
  // menunggu saat layar dibuka biasa) — sesudah salah satunya jalan, posisimu
  // milikmu sendiri: jangan ditarik-tarik tiap satu baris dicentang.
  const bukaanJumped = useRef(false);

  // Pindah dulu ke sesi tempat baris Rhema berada (biasanya Pagi). Saringan
  // areanya ikut dilepas — kalau tidak, barisnya bisa saja sedang tersembunyi.
  useEffect(() => {
    if (!focusRhema || !rhemaSlot) return;
    setActiveSlot(rhemaSlot);
    setAreaFilter(null);
    bukaanJumped.current = false;
  }, [focusRhema, rhemaSlot]);

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
  // Saringan area hidup (click ikonnya di atas). null = tampilkan semua.
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

  // Baris pertama yang masih menunggu di sesi yang sedang dibuka.
  const firstPendingId =
    activeList.find((h) => !day.done[h.id] && !day.skipped[h.id])?.id ?? null;

  // Baru menggulung SESUDAH daftarnya benar-benar tergambar — ukuran isi
  // ScrollView adalah tanda paling andal untuk itu (pola yang sama dipakai
  // hooks/useDueJump.ts).
  //
  // Dua lompatan berbagi satu pintu ini, dan urutannya penting: kalau layar
  // dibuka DARI kartu Refleksi di Home (?focus=rhema), yang dituju barisnya —
  // bukan baris pertama yang belum dicentang.
  // Sengaja TANPA useCallback: `firstPendingId` diturunkan dari daftar yang
  // sedang tampil, dan React Compiler (menyala di app ini) tidak bisa
  // membuktikan daftar dependency yang ditulis tangan masih benar untuk nilai
  // seperti itu — ia menolak dengan `preserve-manual-memoization`. Dibiarkan
  // fungsi biasa, compiler-nya yang menghafalkan sendiri.
  function handleContentSize() {
    // Sudah pernah melompat sejak layar ini dibuka → jangan ditarik-tarik lagi.
    if (bukaanJumped.current) return;
    // Dari kartu Refleksi di Home? Barisnya yang dituju. Kalau tidak, baris
    // pertama yang masih menunggu di sesi jam sekarang.
    const targetId = focusRhema ? rhemaId : firstPendingId;
    if (!targetId) return;
    const y = rowY.current[targetId];
    if (y === undefined) return;
    bukaanJumped.current = true;
    scrollRef.current?.scrollTo({
      y: Math.max(0, blockY.current + y - 8),
      animated: true,
    });
    if (focusRhema) onFocusDone?.();
  }

  // Ukuran keberhasilan hari ini: skor 0–10 + 5 area hidup yang terjaga —
  // bukan lagi "berapa dari 39 tercentang".
  const score = dailyScore(counted, day.done);
  const areas = areaProgress(counted, day.done);
  const keptCount = areas.filter((a) => a.kept).length;
  const coreAllDone = coreDone(counted, day.done);

  // Streak 🔥 bisa jadi lengkap dari LUAR layar ini: olahraga dicentang di
  // fitur Fitness, lalu baris cerminnya di sini ikut tercentang tanpa ada
  // tombol yang ditekan di layar ini. Kalau streak cuma dinaikkan di dalam
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
   * jangan sampai click-nya terasa mati begitu saja.
   */
  function openHabitLink(link: HabitLink, habit?: ScheduledHabit) {
    // `doneOnOpen` (mis. "Reading the News"): click-nya berarti "sekarang saya
    // kerjakan", jadi barisnya dicentang saat itu juga lalu layarnya dibuka.
    // Dicentang DULU supaya centangnya sudah terpasang begitu kembali dari
    // sana; kalau gagal menulis, pesannya muncul & layarnya tetap dibuka —
    // menahan perpindahannya cuma bikin click-nya terasa mati.
    if (link.doneOnOpen && habit && !day.done[habit.id] && !day.skipped[habit.id]) {
      void handleToggle(habit);
    }
    if (link.route) {
      router.push({ pathname: link.route.pathname, params: link.route.params });
      return;
    }
    if (!link.external) return;
    openExternalUrl(link.external.scheme, { fallback: link.external.web });
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
      // sisa yang berlaku hari ini jadi beres semua → streak 🔥 ikut naik,
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

  /**
   * Simpan catatan singkat (refleksi / syukur / rhema) kebiasaan hari ini.
   *
   * Untuk kebiasaan yang centangnya ditentukan catatan (Rhema), centangnya
   * ikut disetel di sini: terisi begitu tulisannya cukup panjang, dan lepas
   * lagi kalau dikosongkan. `day.done` tetap satu-satunya sumber angka, jadi
   * hitungan sesi & area tidak mungkin berbeda dari tampilannya.
   */
  async function handleNote(habit: ScheduledHabit, text: string) {
    if (!user) return;
    try {
      await setHabitNote(user.uid, dayId, habit.id, text);
      if (isNoteDrivenHabit(habit)) {
        const selesai = habitNoteDone(text);
        if (selesai !== !!day.done[habit.id]) {
          await setHabitDone(user.uid, dayId, habit.id, selesai);
          if (selesai && coreDone(counted, { ...day.done, [habit.id]: true })) {
            await bumpStreak(user.uid, streak, dayId);
          }
        }
      }
    } catch {
      setError('Gagal menyimpan catatan. Coba lagi.');
    }
  }

  /**
   * Tab sesi ditekan. Menekan sesi LAIN cuma berpindah seperti biasa; menekan
   * sesi yang SUDAH aktif (jadi tekanan kedua) melompat ke baris pertama yang
   * belum dicentang & belum dilewati — tak perlu menggulung sendiri mencari
   * sisa pekerjaan di daftar yang panjang.
   */
  function handleSlotPress(next: HabitSlot) {
    if (next !== activeSlot) {
      setActiveSlot(next);
      return;
    }
    const target = activeList.find(
      (h) => !day.done[h.id] && !day.skipped[h.id],
    );
    const y = target ? rowY.current[target.id] : undefined;
    // Semua beres (atau posisinya belum sempat terukur) → kembali ke atas saja.
    scrollRef.current?.scrollTo({
      y: y === undefined ? 0 : Math.max(0, blockY.current + y - 8),
      animated: true,
    });
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
            Sekaligus SARINGAN: click satu area → daftar di bawah hanya berisi
            area itu; click lagi area yang sama → saringannya lepas. */}
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
            // Ada yang dilewati ✗ di sesi ini? Yang dilewati memang keluar
            // dari hitungan, jadi sesinya bisa terbaca "✅ beres" padahal ada
            // yang TIDAK dikerjakan — dan itu memuji diri sendiri terlalu
            // cepat. Sesi begitu ditandai ❌ merah, bukan ✅.
            const adaDilewati = grouped[s.key].some((h) => day.skipped[h.id]);
            const tuntas = complete && !adaDilewati;
            return {
              key: s.key,
              label: `${s.emoji} ${s.label}`,
              sub: allSkipped
                ? '⏭️ dilewati'
                : tuntas
                  ? '✅ beres'
                  : complete
                    ? '❌ tak tuntas'
                    : `${slotDone}/${list.length}`,
              subColor:
                complete && !tuntas ? Color.DANGER : undefined,
              // SELURUH tabnya ikut memerah, bukan cuma tulisan kecilnya —
              // "❌ tak tuntas" di bawah label mudah terlewat waktu mata cuma
              // menyapu deretan tab.
              danger: complete && !tuntas,
            };
          })}
          value={activeSlot}
          onChange={handleSlotPress}
        />
      </View>

      {/* Kebiasaan sesi yang aktif — bagian yang bisa di-scroll */}
      <KeyboardAwareScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onContentSizeChange={handleContentSize}>
        <View
          style={styles.slotBlock}
          onLayout={(e) => {
            blockY.current = e.nativeEvent.layout.y;
          }}>
          {activeList.map((habit, index) => {
            // ✗ menang atas centang: baris yang dilewati tidak pernah tampil
            // tercentang (tanda done-nya memang ikut dilepas saat di-skip).
            const skipped = !!day.skipped[habit.id];
            const checked = !skipped && !!day.done[habit.id];
            const tier = habitTier(habit);
            // Kebiasaan yang sebenarnya dikerjakan di layar/aplikasi lain →
            // dapat keterangan kecil + click yang langsung ke sana.
            const rawLink = habitLink(habit);
            // Pintasan bertanda `whenDone` (📓 Jurnal → Instagram Feed) baru
            // muncul sesudah barisnya tercentang: feed-nya dibuat DARI tulisan
            // refleksinya, jadi sebelum ditulis pintunya memang belum ada
            // gunanya. Sesudah itu ia menetap sepanjang hari — beda dengan
            // kartu di Home yang hilang begitu feed-nya jadi.
            const link = rawLink?.whenDone && !checked ? null : rawLink;
            // Baris cermin (olahraga, Top 3 Priorities, Baca Alkitab):
            // centangnya datang dari layar tempat pekerjaannya benar-benar
            // dilakukan, jadi di sini ia cuma penunjuk keadaan + pintasan.
            const mirrored = link?.mirrorOf !== undefined;
            // Baris bercatatan (Rhema): centangnya ditentukan tulisannya, jadi
            // lingkarannya dikunci — mencentang tanpa menulis itu bohong.
            const fromNote = isNoteDrivenHabit(habit);
            return (
              // Berganti sesi (Pagi→Siang→Malam) = daftar baru masuk berurutan
              // dari bawah, bukan berkedip sekaligus. Jedanya dibatasi 8 baris
              // pertama supaya daftar panjang tidak terasa lambat.
              <Animated.View
                key={habit.id}
                onLayout={(e) => {
                  rowY.current[habit.id] = e.nativeEvent.layout.y;
                }}
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
                      centang cukup click biasa. Yang sudah dilewati tidak
                      bisa dicentang: batalkan ✗ dulu. */}
                  {/* Baris cermin yang perkaranya SUDAH SELESAI — tercentang
                      (mis. Bible Reading-nya sudah diisi) atau ✗ karena jendela
                      jamnya habis — lingkarannya mati total, tidak lagi bisa
                      diklik. Dulu ia masih membuka layar asalnya, dan itu
                      menyesatkan: yang sudah lewat waktunya memang tak bisa
                      diapa-apakan lagi dari sini. Nama kebiasaannya tetap bisa
                      diklik kalau mau melihat catatannya. */}
                  <PressableScale
                    onPress={() =>
                      mirrored ? openHabitLink(link!) : handleToggle(habit)
                    }
                    disabled={fromNote || skipped || (mirrored && checked)}
                    hitSlop={8}
                    haptic={checked || mirrored ? 'light' : 'success'}>
                    <CheckCircle
                      checked={checked}
                      skipped={skipped}
                      locked={mirrored || fromNote}
                    />
                  </PressableScale>
                  {/* Nama kebiasaan tidak bisa ditekan — ubah/urutkan/hapus
                      lewat tombol ✏️. KECUALI yang punya pintasan: di situ
                      click membawa ke tempat kebiasaannya dikerjakan. */}
                  <PressableScale
                    style={styles.rowMain}
                    onPress={() => link && openHabitLink(link, habit)}
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
                        Baris cermin tidak punya tombol ini: melewatinya
                        dilakukan di layar asalnya (Fitness / Baca Alkitab),
                        biar tandanya tidak bisa beda antara dua layar. */}
                    {!mirrored && (
                      <PressableScale
                        style={[styles.skipButton, skipped && styles.skipButtonOn]}
                        onPress={() => handleSkip(habit)}
                        hitSlop={8}
                        haptic="warning">
                        <IconSymbol
                          name="xmark"
                          size={19}
                          color={skipped ? Color.DANGER : Color.TEXT_LABEL}
                        />
                      </PressableScale>
                    )}
                    {/* Tombol edit → buka modal ubah / urutkan / hapus.
                        Rupanya sama dengan tombol ✏️ di seluruh app. */}
                    <EditButton onPress={() => openEdit(habit)} />
                  </View>
                </View>
                {/* Kebiasaan yang minta catatan (refleksi, syukur, rhema).
                    Yang dilewati tidak perlu diisi. */}
                {habit.note && !skipped && (
                  <HabitNote
                    key={`${habit.id}-${dayId}`}
                    placeholder={habit.notePrompt ?? 'Tulis singkat saja…'}
                    value={day.notes[habit.id] ?? ''}
                    // "🙏 Bersyukur 3 Hal" minta TIGA butir, bukan satu
                    // paragraf — lihat habitNoteLines di lib/habits.ts.
                    lines={habitNoteLines(habit)}
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

        {/* Kebiasaan berpintasan (Fitness, Diet, Baca Alkitab) itu WAJIB —
            tidak ada tombol hapusnya, cuma bisa diurutkan naik/turun. Kalau
            dihapus, daftarnya berhenti cocok dengan isi app. */}
        {editing !== 'new' && editing && isFixedHabit(editing) ? (
          <VixText heading="label" additionalStyle={styles.fixedNote}>
            🔒 Kebiasaan yang wajib
          </VixText>
        ) : (
          <EditDelete
            editing={editing}
            label="Hapus kebiasaan ini"
            busy={busy}
            onDelete={handleDeleteHabit}
          />
        )}

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
        {/* Keterangan sekaligus PINTU. Rentang sehat ini dihitung dari TINGGI
            BADAN-mu, dan tinggi badan cuma bisa diubah di satu tempat: Profile
            → 🧍 Data Tubuh. Dulu angkanya muncul begitu saja tanpa memberi
            tahu dari mana asalnya — kalau tingginya keliru, tidak ada petunjuk
            ke mana harus membetulkannya. */}
        <PressableScale
          style={styles.targetHint}
          onPress={() => {
            setTargetOpen(false);
            router.push({ pathname: '/profile', params: { tab: 'body' } });
          }}>
          <VixText heading="label" additionalStyle={styles.targetHintText}>
            🧍 Sehat {formatDecimal(range.min)}–{formatDecimal(range.max)} kg
            untuk {formatDecimal(profile.heightCm)} cm · ubah di Profile ›
          </VixText>
        </PressableScale>
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

// Catatan di bawah kebiasaan yang memintanya (refleksi, syukur, rhema).
//
// Dulu kolom isian LANGSUNG di dalam daftar, dan itu tidak enak dipakai:
// barisnya ada di tengah daftar yang panjang, sedangkan bagian atas (sapaan +
// ringkasan + tab sesi) menempel di atas dan tab bawah menempel di bawah —
// begitu keyboard iOS naik, sisa ruang untuk mengetik tinggal beberapa baris
// dan tulisannya sendiri sering ketutupan.
//
// Sekarang barisnya cuma PRATINJAU yang bisa di-click; menulisnya di dalam
// SheetModal, yang sudah punya penghindar keyboard sendiri dan bisa dibuat
// selega yang dibutuhkan. Cara menyimpannya tidak berubah: sekali saat
// selesai (tekan Simpan), bukan tiap huruf.
// `lines` > 0 → catatannya BUKAN satu paragraf, melainkan daftar berbutir
// sebanyak itu (mis. "🙏 Bersyukur 3 Hal" → 3 kotak kecil bernomor). Satu
// kotak besar untuk tiga hal terbukti jadi satu kalimat panjang; tiga kotak
// bernomor menagih tiga hal dengan sendirinya, tanpa perlu aturan apa pun.
//
// Yang tersimpan tetap SATU teks dipisah baris — tidak ada bentuk data baru
// dan tidak ada migrasi (lihat splitNoteLines/joinNoteLines di lib/habits.ts).
function HabitNote({
  placeholder,
  value,
  lines = 0,
  onSave,
}: {
  placeholder: string;
  value: string;
  lines?: number;
  onSave: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [butir, setButir] = useState<string[]>(() =>
    splitNoteLines(value, Math.max(lines, 1)),
  );

  const berbutir = lines > 0;
  // Pratinjau baris: butirannya dirangkai jadi satu baris pendek supaya kartu
  // kebiasaannya tidak memanjang tiga kali lipat.
  const pratinjau = berbutir
    ? filledNoteLines(value).join(' · ')
    : value;

  function simpan() {
    const isi = berbutir ? joinNoteLines(butir) : text.trim();
    if (isi !== value) onSave(isi);
    setOpen(false);
  }

  return (
    <>
      <PressableScale
        style={styles.noteBox}
        onPress={() => {
          // selalu mulai dari yang tersimpan
          setText(value);
          setButir(splitNoteLines(value, Math.max(lines, 1)));
          setOpen(true);
        }}>
        <VixText
          heading="paragraph"
          additionalStyle={value ? styles.noteFilled : styles.notePlaceholder}>
          {pratinjau || placeholder}
        </VixText>
        <VixText heading="label" additionalStyle={styles.noteHint}>
          ✍️
        </VixText>
      </PressableScale>

      <SheetModal
        visible={open}
        title="📓 Catatan Hari Ini"
        subtitle={placeholder}
        onClose={() => setOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            onCancel={() => setOpen(false)}
            onConfirm={simpan}
          />
        }>
        {berbutir ? (
          butir.map((isi, i) => (
            <View key={i} style={styles.noteLineBox}>
              <VixText heading="label" additionalStyle={styles.noteLineLabel}>
                {i + 1}.
              </VixText>
              <FormInput
                style={styles.noteLineInput}
                placeholder={`Hal ke-${i + 1}`}
                value={isi}
                onChangeText={(t) =>
                  setButir((lama) => lama.map((v, j) => (j === i ? t : v)))
                }
                autoFocus={i === 0}
              />
            </View>
          ))
        ) : (
          <FormInput
            style={styles.noteSheetInput}
            placeholder={placeholder}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
          />
        )}
      </SheetModal>
    </>
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
  skipButtonOn: {
    backgroundColor: Color.FINANCE_EXPENSE,
    borderColor: Color.DANGER,
  },
  // ⚪ Opsional — bonus, jadi tampilannya sengaja lebih kalem.
  rowOptional: { opacity: 0.7 },
  // Catatan singkat di bawah kebiasaan refleksi/syukur/rhema.
  // Pratinjau catatan di daftar — bentuknya sama persis dengan kolom isian
  // yang dulu ada di sini (tinggi minimum, jarak, garis tepi), jadi daftarnya
  // tidak bergeser sama sekali; bedanya sekarang ia tombol, bukan kolom.
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    minHeight: 64,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: -2,
    marginBottom: 8,
  },
  noteFilled: { flex: 1, color: Color.TEXT_TITLE },
  notePlaceholder: { flex: 1, color: Color.TEXT_PLACEHOLDER },
  noteHint: { color: Color.TEXT_LABEL },
  // Kolom isian DI DALAM modal — dibuat lega, karena di sinilah menulisnya.
  noteSheetInput: { minHeight: 180, textAlignVertical: 'top' },
  // Tiga kotak kecil bernomor — bentuk untuk catatan yang isinya butiran.
  noteLineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  noteLineLabel: { color: Color.TEXT_LABEL, width: 16 },
  noteLineInput: { flex: 1 },
  // Pilihan tingkat & area di modal ubah kebiasaan.
  fieldLabel: { marginTop: 14, marginBottom: 6 },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickChip: { flex: 1 },
  rowMain: { flex: 1 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // ✗ lewati hari ini — ukuran & bentuknya disamakan persis dengan tombol ✏️
  // di sebelahnya (EmojiButton 42×42), jadi pasangannya tidak timpang.
  skipButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: Color.ACCENT,
    backgroundColor: Color.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Keterangan pengganti tombol hapus untuk kebiasaan wajib.
  fixedNote: { color: Color.TEXT_LABEL, marginTop: 14 },
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
  // Keterangan rentang sehat di modal Target Berat — sekaligus pintu ke
  // Profile › 🧍 Data Tubuh, jadi rupanya sengaja seperti baris yang bisa
  // ditekan (latar samar + tulisan sewarna aksi), bukan teks mati.
  targetHint: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  targetHintText: { color: Color.MAIN_DARK },
  deleteText: { color: Color.DANGER, textAlign: 'center', marginTop: 12 },
});
