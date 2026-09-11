import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { attentionBorder, AttentionMark } from '@/components/common/Badge';
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InfoChip } from '@/components/common/InfoChip';
import { MiniButton } from '@/components/common/MiniButton';
import { PressableScale } from '@/components/common/PressableScale';
import { SectionRow } from '@/components/common/SectionRow';
import { SheetModal } from '@/components/common/SheetModal';
import { SkipButton, SkipNotice } from '@/components/common/SkipToday';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { useAuth } from '@/contexts/auth';
import { useDueJump } from '@/hooks/useDueJump';
import { useScrollTop } from '@/hooks/useScrollTop';
import { type LoginStreak } from '@/lib/achievements';
import {
  applyFitPicks,
  breakFitStreak,
  EMPTY_FIT_DAY,
  fetchFitDays,
  FIT_DAY_SHORT,
  FIT_MENU,
  FIT_MENU_GROUPS,
  FIT_RECOVERY,
  FIT_TIME_LABEL,
  fitDayComplete,
  fitExercisesOf,
  fitMenuLabel,
  fitPace,
  fitPickedMinutes,
  fitPicksOf,
  fitQuote,
  fitSessionFor,
  fitSessionsOf,
  saveFitWeight,
  setFitDaySkipped,
  setFitExerciseDone,
  setFitRun,
  syncFitnessHabit,
  syncFitnessHabitSkipped,
  weightOf,
  type Exercise,
  type FitDay,
  type FitSession,
  type FitWeights,
} from '@/lib/fitness';
import { dayIdToDate, formatDecimal, parseDecimal } from '@/lib/format';
import { weekDayIds } from '@/lib/health';
import { openExternalUrl } from '@/lib/linking';

// Tab Exercise 💪 — deretan hari + olahraga hari yang dipilih.
//
// ===== Yang berubah, dan kenapa =====
// Dulu sesi hari ini DITENTUKAN oleh hari apa sekarang: Selasa berarti lari
// santai, titik. Programnya bagus di atas kertas, tapi hidupnya tidak begitu —
// ada hari kamu lari 5K bareng teman di GBK, ada minggu yang tutupnya race,
// dan tak satu pun dari itu muat di kotak "Selasa = lari santai". Akibatnya
// olahraga yang BENAR-BENAR dikerjakan tidak pernah tercatat, sedangkan yang
// tercatat justru yang tidak dikerjakan.
//
// Sekarang kebalikannya: kamu yang memilih, programnya cuma menyarankan.
// Pilihannya tersimpan di dokumen harian (`picks`), jadi hari yang sudah lewat
// tetap ingat kamu latihan apa — bukan dihitung ulang dari tanggalnya.
//
// Boleh memilih LEBIH DARI SATU sehari: lari pagi + bisep sore itu satu hari
// yang sama, dan daftar gerakannya digabung jadi satu ceklis.
export function ExerciseTab({
  weights,
  day,
  dayId,
  streak,
  bodyWeightKg,
}: {
  weights: FitWeights;
  day: FitDay;
  dayId: string;
  streak: LoginStreak | null;
  /** Berat badan dari fitur Health — satu-satunya sumber, tak bisa diubah di sini. */
  bodyWeightKg: number | null;
}) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const today = new Date();
  const todayWeekday = today.getDay();

  const [weekday, setWeekday] = useState(todayWeekday);
  const [busy, setBusy] = useState(false);

  // Status tiap hari MINGGU INI (Senin→Minggu) — supaya hari yang sesinya sudah
  // beres tetap bertanda ✓ di deretan hari, tidak hilang lewat tengah malam.
  // Yang "kereset" cuma pergantian minggu: begitu Senin baru, deret tanggalnya
  // ikut berganti sehingga tandanya mulai kosong lagi dengan sendirinya.
  const weekIds = weekDayIds(today); // Senin di indeks 0 … Minggu di indeks 6
  const weekIdOf = (wd: number) => weekIds[(wd + 6) % 7];
  const [weekDays, setWeekDays] = useState<Record<string, FitDay>>({});

  useEffect(() => {
    if (!user) return;
    let alive = true;
    // Hari depan mustahil sudah beres → tidak ikut dibaca (hemat baca
    // Firestore: paling banyak 7 dokumen kecil, sekali saat tab dibuka).
    const sudahLewat = weekDayIds(new Date()).filter((id) => id <= dayId);
    fetchFitDays(user.uid, sudahLewat)
      .then((d) => {
        if (alive) setWeekDays(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, dayId]);

  // Click pil hari yang sedang dibuka LAGI → isi sesinya balik ke paling atas.
  const { ref: scrollRef, toTop } = useScrollTop();

  // Modal ubah beban satu gerakan.
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [fWeight, setFWeight] = useState('');
  // Modal konfirmasi "lewati hari ini" — sengaja pakai konfirmasi karena
  // streak 🔥 yang hilang tidak bisa dikembalikan.
  const [confirmSkip, setConfirmSkip] = useState(false);
  // Sheet pilih kategori. `draf` = pilihan yang sedang disusun; baru ditulis ke
  // Firestore saat Simpan, jadi memilih 3 kategori = satu tulis, bukan tiga.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draf, setDraf] = useState<string[]>([]);
  // Modal isian hasil lari — dikunci id PAKETNYA (satu paket lari = sekali lari).
  const [runOf, setRunOf] = useState<FitSession | null>(null);
  const [fKm, setFKm] = useState('');
  const [fMinutes, setFMinutes] = useState('');

  const { skipped } = day;
  const isToday = weekday === todayWeekday;
  const viewDayId = isToday ? dayId : weekIdOf(weekday);
  const viewDate = dayIdToDate(viewDayId);

  // Catatan hari YANG SEDANG DILIHAT: hari ini dari `day` yang live, hari lain
  // dari ambilan minggu berjalan. Dengan ini hari yang sudah beres tampil
  // lengkap dengan centangnya — bukan terlihat kosong seolah catatannya hilang.
  const viewDay: FitDay = isToday
    ? day
    : (weekDays[viewDayId] ?? EMPTY_FIT_DAY);
  const done = viewDay.done;
  // Hari yang dilewati ❌ dianggap tidak ada centangnya sama sekali.
  const daySkipped = viewDay.skipped;

  // Paket & gerakan hari yang sedang dilihat — dari PILIHANNYA, bukan dari
  // tanggalnya. Hari lama yang belum punya pilihan jatuh balik ke program
  // (lihat fitPicksOf di lib/fitness.ts), jadi riwayatnya tetap terbaca.
  const picks = fitPicksOf(viewDay, viewDate);
  const sesiHari = fitSessionsOf(viewDay, viewDate);
  const latihan = fitExercisesOf(viewDay, viewDate);
  const belumPilih = latihan.length === 0;

  const doneCount = daySkipped ? 0 : latihan.filter((e) => done[e.id]).length;
  const total = latihan.length;
  const allDone = total > 0 && doneCount === total;
  // Hari yang sudah LEWAT (termasuk hari ini) — catatannya ada & terkunci.
  // Hari depan belum ada catatannya sama sekali.
  const sudahLewat = isToday || viewDayId <= dayId;
  // Tombol lewati hanya untuk HARI INI, dan hanya selama sesinya belum beres —
  // sesi yang sudah selesai tidak bisa "dilewati" (kalau bisa, streak yang
  // baru saja naik malah ikut hangus).
  const canSkip = isToday && (skipped || !allDone);

  // Saran program untuk HARI INI. Ia tidak lagi menentukan apa pun — cuma
  // tawaran, dan cuma ditawarkan kalau belum kamu ambil.
  const saran = fitSessionFor(today);
  const saranBelumDiambil = isToday && !picks.includes(saran.id);

  // Buka sub-tab ini → daftar gerakan langsung datang ke gerakan HARI INI yang
  // belum dicentang, yaitu isi badge merahnya. Hari lain tidak pernah punya
  // tujuan lompatan: ia memang tidak ikut ke badge-nya.
  const { setRowY, onContentSizeChange } = useDueJump(
    isToday && !daySkipped
      ? (latihan.find((e) => !done[e.id])?.id ?? null)
      : null,
    scrollRef,
  );

  // ===================== Memilih olahraga =====================

  function bukaPicker() {
    setDraf(picks);
    setPickerOpen(true);
  }

  function toggleDraf(id: string) {
    setDraf((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  /** Simpan daftar pilihan — cermin Habits ikut, lihat applyFitPicks. */
  async function simpanPicks(next: string[]) {
    if (!user || busy) return;
    setBusy(true);
    try {
      await applyFitPicks(user.uid, dayId, day, today, next);
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    } finally {
      setPickerOpen(false);
      setBusy(false);
    }
  }

  const buangPick = (id: string) => simpanPicks(picks.filter((x) => x !== id));
  const ambilSaran = () => simpanPicks([...picks, saran.id]);

  // ===================== Mencentang gerakan =====================

  async function toggle(ex: Exercise) {
    if (!user || !isToday || busy || skipped) return;
    setBusy(true);
    const next = !done[ex.id];
    try {
      await setFitExerciseDone(user.uid, dayId, ex.id, next);
      // Baris "🏋️ Morning Exercise" di Habits ikut hasil sesi ini — jadi
      // olahraga cukup dicentang di sini saja, tidak dua kali.
      const after = { ...done, [ex.id]: next };
      await syncFitnessHabit(user.uid, dayId, latihan.every((e) => after[e.id]));
      // 🔥 Streak & rekap mingguan SENGAJA tidak disentuh di sini. Keduanya
      // baru dihitung setelah harinya habis (lewat jam 00.00) oleh
      // `settleFitDays` di app/fitness.tsx — sepanjang hari centangnya masih
      // boleh dilepas lagi, jadi "beres" jam 3 sore belum tentu benar jam 11
      // malam.
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    } finally {
      setBusy(false);
    }
  }

  /**
   * Lewati olahraga HARI INI. Semua gerakan langsung bertanda ❌, badge
   * Exercise & kartu reminder Dashboard ikut hilang, dan streak 🔥 diputus.
   *
   * Tidak ada lagi pengecualian "hari jalan pagi tidak memutus streak": app ini
   * tak lagi tahu hari mana yang seharusnya ringan — kamu yang menentukannya.
   * Hari yang ingin santai tinggal diisi paket 🚶 Jalan Pagi, bukan dilewati.
   */
  async function handleSkip() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await setFitDaySkipped(user.uid, dayId, true);
      // Baris di Habits ikut bertanda ❌ — keluar dari score harian, bukan
      // menggantung sebagai kebiasaan yang belum dikerjakan.
      await syncFitnessHabitSkipped(user.uid, dayId, true);
      await breakFitStreak(user.uid, streak, today);
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    } finally {
      setConfirmSkip(false);
      setBusy(false);
    }
  }

  /**
   * Batalkan tanda lewati — centangnya bisa dipakai lagi. Streak 🔥 yang
   * sudah telanjur hilang TIDAK ikut kembali; sesi hari ini dihitung sebagai
   * streak ke-1 lagi.
   */
  async function handleUnskip() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await setFitDaySkipped(user.uid, dayId, false);
      // Tanda ❌ di Habits ikut dicabut; centangnya kembali mengikuti
      // gerakan yang sudah/belum beres hari ini.
      await syncFitnessHabitSkipped(user.uid, dayId, false);
      await syncFitnessHabit(
        user.uid,
        dayId,
        total > 0 && latihan.every((e) => done[e.id]),
      );
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    } finally {
      setBusy(false);
    }
  }

  function openWeight(ex: Exercise) {
    const current = weightOf(ex, weights);
    setFWeight(current == null ? '' : String(current));
    setEditing(ex);
  }

  async function saveWeight() {
    if (!user || !editing) return;
    const kg = parseDecimal(fWeight);
    try {
      await saveFitWeight(user.uid, editing.id, kg);
    } catch {
      // Diamkan — snapshot akan mengoreksi tampilan otomatis.
    } finally {
      setEditing(null);
    }
  }

  function openRun(s: FitSession) {
    const ada = viewDay.runs[s.id];
    setFKm(ada && ada.km > 0 ? String(ada.km) : '');
    setFMinutes(ada && ada.minutes > 0 ? String(ada.minutes) : '');
    setRunOf(s);
  }

  async function saveRun() {
    if (!user || !runOf) return;
    try {
      await setFitRun(user.uid, dayId, runOf.id, {
        km: parseDecimal(fKm),
        minutes: parseDecimal(fMinutes),
      });
    } catch {
      // Diamkan — snapshot akan mengoreksi tampilan otomatis.
    } finally {
      setRunOf(null);
    }
  }

  // ===================== Deretan hari =====================

  // Layar cukup lebar (iPad) → 7 hari dibagi rata memenuhi satu baris penuh.
  // Layar sempit (iPhone) → tetap pil selebar tetap yang bisa digeser samping.
  const oneRow = width - 40 >= DAY_PILL_WIDTH * 7 + DAY_GAP * 6;

  // Ambilan seminggu sudah sampai? Sebelum itu semua hari terlihat kosong —
  // dan hari kosong yang sudah lewat itu warnanya MERAH. Tanpa penjaga ini,
  // tiap kali sub-tab dibuka deretan harinya berkedip merah dulu sekejap.
  const weekLoaded = Object.keys(weekDays).length > 0;

  const dayPills = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const active = wd === weekday;
    const id = weekIdOf(wd);
    // Catatan hari itu: hari ini dibaca LANGSUNG dari `day` yang live, hari
    // lain dari hasil ambilan seminggu — jadi centang terakhir hari ini
    // langsung memunculkan ✅-nya tanpa menunggu apa pun.
    const catatan = wd === todayWeekday ? day : weekDays[id];
    const tanggal = dayIdToDate(id);
    const sesi = fitSessionsOf(catatan, tanggal);
    const selesai = fitDayComplete(catatan, tanggal);
    // Hari yang catatannya sudah TUTUP BUKU — kemarin & sebelumnya. Hari ini
    // sengaja tidak ikut: sesinya masih berjalan, jadi belum pantas dinilai
    // (jam 7 pagi belum tercentang apa-apa itu wajar, bukan gagal).
    const lampau = weekLoaded && id < dayId;
    const gerakan = fitExercisesOf(catatan, tanggal);
    const tercentang = catatan
      ? gerakan.filter((e) => catatan.done[e.id]).length
      : 0;
    // ❌ MERAH — hari itu tidak ada olahraganya sama sekali: sengaja dilewati,
    // atau harinya sudah tutup buku tanpa satu gerakan pun tercentang.
    const kosong = (catatan?.skipped ?? false) || (lampau && tercentang === 0);
    // ⬜ ABU-ABU — sesinya jalan tapi tidak tuntas: ada yang terlewat / lupa.
    const bolong = !kosong && lampau && !selesai;
    // Lambang hari: kalau sudah memilih, lambang paket pertamanya. Kalau
    // belum, lambang SARAN program hari itu — diredupkan, karena ia baru
    // tawaran, bukan sesuatu yang sudah kamu putuskan.
    const emoji = sesi[0]?.emoji ?? fitSessionFor(tanggal).emoji;
    return (
      <PressableScale
        key={wd}
        style={[
          styles.dayPill,
          oneRow && styles.dayPillFill,
          active && styles.dayPillActive,
          selesai && !active && styles.dayPillDone,
          bolong && !active && styles.dayPillMissed,
          kosong && !active && styles.dayPillSkipped,
        ]}
        // Click kedua (hari yang sedang dibuka) = balik ke paling atas.
        onPress={() => (active ? toTop() : setWeekday(wd))}>
        <VixText
          additionalStyle={[
            styles.dayEmoji,
            sesi.length === 0 && styles.dayEmojiRest,
          ]}>
          {emoji}
        </VixText>
        <VixText
          heading="bold"
          additionalStyle={[styles.dayLabel, active && styles.dayLabelActive]}>
          {FIT_DAY_SHORT[wd]}
        </VixText>
        {wd === todayWeekday && <View style={styles.todayDot} />}
        {/* Tanda sesi hari itu sudah beres — bertahan sampai Senin berikutnya,
            karena yang dibaca memang hari-hari minggu berjalan. */}
        {selesai && (
          <View style={styles.dayDoneBadge}>
            <VixText additionalStyle={styles.dayDoneMark}>✓</VixText>
          </View>
        )}
      </PressableScale>
    );
  });

  // Paket lari hari ini — masing-masing punya kartu isian jarak & waktunya.
  const sesiLari = sesiHari.filter((s) => s.kind === 'run');
  // Semua yang dipilih cuma jalan? Tutup dengan pengingat pemulihan.
  const hanyaJalan =
    sesiHari.length > 0 && sesiHari.every((s) => s.kind === 'walk');

  return (
    <View style={styles.flex}>
      {/* Deretan hari — Senin di kiri. Hari yang belum ada pilihannya memakai
          lambang saran program, diredupkan. */}
      <View style={styles.dayStripWrap}>
        {oneRow ? (
          <View style={styles.dayStrip}>{dayPills}</View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStrip}>
            {dayPills}
          </ScrollView>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        onContentSizeChange={onContentSizeChange}
        contentContainerStyle={styles.content}>
        {/* Hero — apa yang kamu kerjakan hari ini, bukan apa kata jadwal */}
        <View style={styles.hero}>
          <View style={styles.heroMain}>
            <VixText heading="label" additionalStyle={styles.heroSub}>
              {belumPilih
                ? FIT_TIME_LABEL
                : `${sesiHari.length} kategori · ±${fitPickedMinutes(viewDay, viewDate)} menit · ${FIT_TIME_LABEL}`}
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.heroTitle}>
              {belumPilih
                ? '🤔 Belum dipilih'
                : sesiHari.map((s) => `${s.emoji} ${s.title}`).join(' + ')}
            </VixText>
            <VixText heading="label" additionalStyle={styles.heroSub}>
              {belumPilih
                ? isToday
                  ? 'Pilih olahraganya di bawah — kamu yang tahu badanmu hari ini.'
                  : 'Tidak ada olahraga tercatat di hari ini.'
                : sesiHari.map((s) => s.focus).join(' · ')}
            </VixText>
          </View>
          {sudahLewat && !belumPilih && (
            <DonutChart
              size={72}
              thickness={10}
              slices={[
                { value: doneCount, color: Color.FITNESS },
                { value: total - doneCount, color: Color.FITNESS_DARK },
              ]}>
              <VixText heading="bold" additionalStyle={styles.heroRing}>
                {doneCount}/{total}
              </VixText>
            </DonutChart>
          )}
        </View>

        {/* ===== Kategori yang dipilih ===== */}
        {/* Cuma HARI INI yang bisa diubah. Hari lain tetap memperlihatkan
            pilihannya — itu catatan yang nyata, cuma sudah terkunci. */}
        <View>
          {isToday && !skipped ? (
            <>
              <SectionRow
                title="🎯 Olahraga hari ini"
                right={
                  <MiniButton
                    label={belumPilih ? '+ Pilih' : '+ Ubah'}
                    onPress={bukaPicker}
                  />
                }
              />
              {belumPilih ? (
                <VixText heading="label" additionalStyle={styles.emptyPick}>
                  Belum ada yang dipilih. Ambil saran program di bawah, atau
                  susun sendiri lewat “+ Pilih”.
                </VixText>
              ) : (
                <View style={styles.pickRow}>
                  {sesiHari.map((s) => (
                    <PressableScale
                      key={s.id}
                      style={styles.pickChip}
                      onPress={() => buangPick(s.id)}
                      disabled={busy}
                      hitSlop={4}>
                      <VixText heading="label" additionalStyle={styles.pickText}>
                        {s.emoji} {fitMenuLabel(s)}  ✕
                      </VixText>
                    </PressableScale>
                  ))}
                </View>
              )}
            </>
          ) : !belumPilih ? (
            <View style={styles.pickRow}>
              {sesiHari.map((s) => (
                <InfoChip key={s.id} label={`${s.emoji} ${fitMenuLabel(s)}`} />
              ))}
            </View>
          ) : null}
        </View>

        {/* ===== Saran program 💡 =====
            Program mingguannya masih hidup — turun pangkat jadi tawaran. Ia
            cuma muncul kalau belum kamu ambil, jadi hari yang sudah kamu
            susun sendiri tidak ditawari apa-apa lagi. */}
        <View>
          {isToday && !skipped && saranBelumDiambil && (
            <PressableScale
              style={styles.saranCard}
              onPress={ambilSaran}
              disabled={busy}>
              <View style={styles.saranMain}>
                <VixText heading="label" additionalStyle={styles.saranLabel}>
                  💡 Program menyarankan hari ini
                </VixText>
                <VixText heading="bold" additionalStyle={styles.saranTitle}>
                  {saran.emoji} {fitMenuLabel(saran)}
                </VixText>
                <VixText heading="label" additionalStyle={styles.saranSub}>
                  {saran.focus} · ±{saran.minutes} menit
                </VixText>
              </View>
              <View style={styles.saranTake}>
                <VixText heading="bold" additionalStyle={styles.saranTakeText}>
                  Ambil
                </VixText>
              </View>
            </PressableScale>
          )}
        </View>

        {isToday && skipped ? (
          <SkipNotice
            title="❌ Olahraga hari ini dilewati"
            detail="Streak kembali ke awal"
          />
        ) : isToday ? (
          <View style={styles.quoteCard}>
            <VixText heading="label" additionalStyle={styles.quoteText}>
              {allDone
                ? '🎉 Sesi hari ini BERES. Istirahat, makan protein, tidur cukup!'
                : fitQuote(dayId)}
            </VixText>
          </View>
        ) : (
          <View style={styles.previewCard}>
            <VixText heading="label" additionalStyle={styles.previewText}>
              {/* Hari yang sudah lewat BUKAN pratinjau — catatannya nyata,
                  cuma sudah terkunci. Deretan harinya ikut berganti sendiri
                  tiap Senin, jadi tandanya mulai kosong lagi tiap pekan. */}
              {!sudahLewat
                ? '👀 Hari depan — pilihannya dibuat pada hari-H'
                : daySkipped
                  ? '❌ Hari dilewati'
                  : '🔒 Sudah berlalu'}
            </VixText>
          </View>
        )}

        {latihan.map((ex) => {
          // ❌ menang atas centang: hari yang dilewati tidak pernah tampil
          // tercentang, walau centangnya tersimpan sebelum ditandai lewati.
          const exSkipped = daySkipped;
          const checked = !exSkipped && !!done[ex.id];
          const kg = weightOf(ex, weights);
          return (
            <View
              key={ex.id}
              style={[
                styles.exCard,
                checked && styles.exCardDone,
                exSkipped && styles.exCardSkipped,
                attentionBorder(isToday && !exSkipped && !checked),
              ]}
              onLayout={(e) => setRowY(ex.id, e.nativeEvent.layout.y)}>
              {/* Gerakan HARI INI yang belum dicentang = yang dihitung badge
                  merah tile Fitness & sub-tab Exercise (fitPendingToday). Hari
                  lain tidak ditandai — ia tidak pernah ikut ke badge-nya. */}
              {isToday && !exSkipped && !checked && <AttentionMark corner />}
              <PressableScale
                onPress={() => toggle(ex)}
                disabled={!isToday || exSkipped}
                hitSlop={8}>
                {/* Hari lain cuma catatan — centangnya mati, jadi cincinnya
                    abu-abu biar tidak terlihat bisa di-click. */}
                <CheckCircle
                  checked={checked}
                  skipped={exSkipped}
                  locked={!isToday}
                />
              </PressableScale>

              <View style={styles.exMain}>
                <VixText
                  heading="bold"
                  additionalStyle={[
                    styles.exName,
                    (checked || exSkipped) && styles.exNameDone,
                  ]}>
                  {ex.emoji} {ex.name}
                </VixText>
                <VixText heading="label">
                  {ex.sets} set × {ex.reps}
                  {ex.core ? '  ·  🔥 perut' : ''}
                </VixText>

                <View style={styles.exActions}>
                  {/* Lari & jalan tidak punya beban sama sekali → chip kg
                      disembunyikan; durasinya sudah tertulis di baris atas.
                      Gerakan berat badan → angkanya IKUT fitur Health dan
                      tidak bisa diubah di sini. Gerakan berbeban → click untuk
                      ubah bebannya. */}
                  {ex.cardio ? null : ex.weight === null ? (
                    <View style={styles.weightChip}>
                      <VixText heading="label" additionalStyle={styles.weightText}>
                        🏋️ Berat badan
                        {bodyWeightKg ? ` ${formatDecimal(bodyWeightKg)} kg` : ''}
                      </VixText>
                    </View>
                  ) : (
                    <PressableScale
                      style={styles.weightChip}
                      onPress={() => openWeight(ex)}
                      hitSlop={6}>
                      <VixText heading="label" additionalStyle={styles.weightText}>
                        {kg ? `🏋️ ${formatDecimal(kg)} kg` : '🏋️ Tanpa beban'}
                      </VixText>
                    </PressableScale>
                  )}
                  {ex.video ? (
                    <PressableScale
                      style={styles.videoChip}
                      onPress={() => openExternalUrl(ex.video!)}
                      hitSlop={6}>
                      <VixText heading="label" additionalStyle={styles.videoText}>
                        ▶️ Cara gerakan
                      </VixText>
                    </PressableScale>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}

        {/* ===== Hasil lari 🏃 =====
            Centang cuma bilang "sudah lari". Yang kamu butuhkan menuju race
            adalah ANGKANYA — 5 km dalam 32 menit itu kabar, "selesai" bukan.
            Satu kartu per paket lari, karena satu paket = sekali lari. */}
        {sesiLari.map((s) => {
          const run = viewDay.runs[s.id];
          const ada = run && (run.km > 0 || run.minutes > 0);
          const pace = ada ? fitPace(run.km, run.minutes) : '';
          return (
            <PressableScale
              key={`run-${s.id}`}
              style={styles.runCard}
              onPress={() => openRun(s)}
              disabled={!isToday || daySkipped}>
              <View style={styles.exMain}>
                <VixText heading="bold" additionalStyle={styles.runTitle}>
                  🏃 Hasil {s.title}
                </VixText>
                <VixText heading="label" additionalStyle={styles.runValue}>
                  {ada
                    ? `${formatDecimal(run.km)} km · ${formatDecimal(run.minutes)} menit${pace ? ` · ${pace}` : ''}`
                    : isToday
                      ? 'Belum diisi — click untuk mencatat jarak & waktunya'
                      : 'Jaraknya tidak dicatat'}
                </VixText>
              </View>
            </PressableScale>
          );
        })}

        {/* ⏭️ Lewati olahraga hari ini — jujur mencatat "hari ini tidak
            olahraga", bukan menyembunyikannya. Click lagi untuk membatalkan
            tandanya (streak 🔥 tetap tidak kembali). */}
        {canSkip && (
          <SkipButton
            skipped={skipped}
            label="⏭️ Lewati olahraga hari ini"
            busy={busy}
            onPress={skipped ? handleUnskip : () => setConfirmSkip(true)}
            additionalStyle={styles.skipGap}
          />
        )}

        {/* Hari yang isinya cuma jalan ditutup pengingat pemulihan. */}
        {hanyaJalan &&
          FIT_RECOVERY.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <VixText heading="label" additionalStyle={styles.tipText}>
                {tip}
              </VixText>
            </View>
          ))}
      </ScrollView>

      {/* ===== Sheet pilih kategori ===== */}
      <SheetModal
        visible={pickerOpen}
        title="Pilih Olahraga"
        subtitle="Boleh lebih dari satu — daftar gerakannya digabung"
        onClose={() => setPickerOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={busy}
            onCancel={() => setPickerOpen(false)}
            onConfirm={() => simpanPicks(draf)}
          />
        }>
        {FIT_MENU_GROUPS.map((g) => (
          <View key={g.kind}>
            <VixText heading="label" additionalStyle={styles.groupLabel}>
              {g.emoji} {g.label}
            </VixText>
            {FIT_MENU.filter((s) => s.kind === g.kind).map((s) => {
              const dipilih = draf.includes(s.id);
              return (
                <PressableScale
                  key={s.id}
                  style={[styles.menuRow, dipilih && styles.menuRowOn]}
                  onPress={() => toggleDraf(s.id)}
                  hitSlop={4}>
                  <CheckCircle checked={dipilih} />
                  <View style={styles.exMain}>
                    <VixText heading="bold" additionalStyle={styles.menuName}>
                      {s.emoji} {fitMenuLabel(s)}
                    </VixText>
                    <VixText heading="label">
                      {s.focus} · ±{s.minutes} menit
                    </VixText>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </SheetModal>

      {/* Modal ubah beban */}
      <CenterDialog visible={!!editing} onClose={() => setEditing(null)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          🏋️ Beban {editing?.name}
        </VixText>
        <FormInput
          placeholder="Beban (kg)"
          keyboardType="decimal-pad"
          value={fWeight}
          onChangeText={setFWeight}
          autoFocus
        />
        <DualButtons
          confirmLabel="Simpan"
          onCancel={() => setEditing(null)}
          onConfirm={saveWeight}
        />
      </CenterDialog>

      {/* Modal hasil lari */}
      <CenterDialog visible={!!runOf} onClose={() => setRunOf(null)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          🏃 Hasil {runOf?.title}
        </VixText>
        <FormInput
          placeholder="Jarak (km) — mis. 5"
          keyboardType="decimal-pad"
          value={fKm}
          onChangeText={setFKm}
          autoFocus
        />
        <FormInput
          style={styles.formGap}
          placeholder="Waktu (menit) — mis. 32"
          keyboardType="decimal-pad"
          value={fMinutes}
          onChangeText={setFMinutes}
        />
        <DualButtons
          confirmLabel="Simpan"
          onCancel={() => setRunOf(null)}
          onConfirm={saveRun}
        />
      </CenterDialog>

      {/* Konfirmasi lewati — streak yang hilang tidak bisa dikembalikan,
          jadi wajib ditanya dulu. */}
      <ConfirmDialog
        visible={confirmSkip}
        title="Lewati olahraga hari ini?"
        detail="Streak 🔥 kembali ke awal"
        confirmLabel="Ya, Lewati"
        busy={busy}
        onCancel={() => setConfirmSkip(false)}
        onConfirm={handleSkip}
      />
    </View>
  );
}

// Ukuran pil hari — dipakai juga untuk menghitung apakah 7 hari muat satu baris.
const DAY_PILL_WIDTH = 58;
const DAY_GAP = 8;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dayStripWrap: { paddingBottom: 6 },
  dayStrip: { flexDirection: 'row', paddingHorizontal: 20, gap: DAY_GAP },
  dayPill: {
    alignItems: 'center',
    gap: 2,
    width: DAY_PILL_WIDTH,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  // Mode satu baris penuh (iPad): lebar tetap dilepas, tiap hari bagi rata.
  dayPillFill: { flex: 1, width: 'auto' },
  dayPillActive: {
    borderColor: Color.FITNESS_DARK,
    backgroundColor: Color.FITNESS,
  },
  // Hari yang sesinya sudah beres — garis tepi hijau tipis + centang di pojok.
  // Sengaja lebih kalem daripada hari yang sedang dibuka (dayPillActive), jadi
  // yang paling menonjol tetap hari yang sedang kamu lihat.
  dayPillDone: { borderColor: Color.SUCCESS },
  // Hari lampau yang tidak tuntas — ada gerakan yang terlewat atau lupa
  // dicentang. Abu-abu, bukan merah: olahraganya tetap jalan, cuma tak penuh.
  dayPillMissed: {
    borderColor: Color.DISABLED_DARK,
    backgroundColor: Color.DISABLED,
  },
  // Tidak ada olahraganya sama sekali. Pasangan warna merahnya sama dengan
  // tab bertanda bahaya (components/common/SegmentTabs) — satu bahasa warna.
  dayPillSkipped: {
    borderColor: Color.DANGER,
    backgroundColor: Color.DANGER_TRANSPARENT,
  },
  // Ditaruh DI DALAM batas pil (bukan menggantung keluar): pil-nya ada di dalam
  // ScrollView mendatar yang bisa memotong apa pun yang melewati tepinya.
  dayDoneBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Color.SUCCESS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDoneMark: { color: Color.TEXT_REVERSE, fontSize: 10, lineHeight: 14 },
  dayEmoji: { fontSize: 20, lineHeight: 26 },
  dayEmojiRest: { opacity: 0.5 },
  dayLabel: { color: Color.TEXT_LABEL },
  dayLabelActive: { color: Color.FITNESS_DARK },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Color.FITNESS_DARK,
  },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 28, gap: 10 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Color.FITNESS_DARK,
    borderRadius: 20,
    padding: 18,
  },
  heroMain: { flex: 1, gap: 2 },
  heroTitle: { color: Color.TEXT_REVERSE },
  heroSub: { color: Color.TEXT_ON_DARK_MUTED },
  heroRing: { color: Color.TEXT_REVERSE },
  // ---- Kategori pilihan ----
  emptyPick: { color: Color.TEXT_LABEL },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Chip yang BISA di-click untuk dibuang — karena itu ia bukan <InfoChip/>,
  // yang memang tidak pernah bisa di-click. Tanda ✕-nya ikut di dalam teks
  // supaya seluruh chip jadi satu sasaran click yang lega.
  pickChip: {
    backgroundColor: Color.FITNESS,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.FITNESS_DARK,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pickText: { color: Color.FITNESS_DARK },
  // ---- Saran program ----
  saranCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saranMain: { flex: 1, minWidth: 0, gap: 2 },
  saranLabel: { color: Color.TEXT_PLACEHOLDER },
  saranTitle: { color: Color.TEXT_TITLE },
  saranSub: { color: Color.TEXT_LABEL },
  saranTake: {
    backgroundColor: Color.FITNESS_DARK,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saranTakeText: { color: Color.TEXT_REVERSE },
  quoteCard: {
    backgroundColor: Color.FITNESS,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.FITNESS_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quoteText: { color: Color.FITNESS_DARK },
  previewCard: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  previewText: { color: Color.TEXT_LABEL },
  // Kartu status & tombolnya ada di components/common/SkipToday.tsx.
  skipGap: { marginTop: 2 },
  exCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exCardDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  // Dilewati ❌ — warnanya sama dengan baris kebiasaan yang dilewati di Habits.
  exCardSkipped: {
    backgroundColor: Color.DANGER_TRANSPARENT,
    borderColor: Color.DANGER,
  },
  exMain: { flex: 1, gap: 3 },
  exName: { color: Color.TEXT_TITLE },
  exNameDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  exActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  weightChip: {
    backgroundColor: Color.FITNESS,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  weightText: { color: Color.FITNESS_DARK },
  videoChip: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  videoText: { color: Color.TEXT_LABEL },
  // ---- Hasil lari ----
  runCard: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderLeftColor: Color.FITNESS_DARK,
  },
  runTitle: { color: Color.TEXT_TITLE },
  runValue: { color: Color.FITNESS_DARK },
  // ---- Daftar pilihan di sheet ----
  groupLabel: { color: Color.TEXT_PLACEHOLDER, marginTop: 10, marginBottom: 6 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  menuRowOn: { backgroundColor: Color.FITNESS, borderColor: Color.FITNESS_DARK },
  menuName: { color: Color.TEXT_TITLE },
  tipRow: CARD,
  tipText: { color: Color.TEXT_TITLE },
  modalTitle: { color: Color.TEXT_TITLE, marginBottom: 4 },
  formGap: { marginTop: 10 },
});
