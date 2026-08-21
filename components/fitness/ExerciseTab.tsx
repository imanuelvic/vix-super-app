import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SkipButton, SkipNotice } from '@/components/common/SkipToday';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { useAuth } from '@/contexts/auth';
import { useScrollTop } from '@/hooks/useScrollTop';
import { formatDecimal, parseDecimal } from '@/lib/format';
import { bumpWeekGym, weekDayIds } from '@/lib/health';
import {
  breakFitStreak,
  bumpFitStreak,
  fetchFitDays,
  fitBlockOf,
  fitDayComplete,
  fitQuote,
  fitSessionMinutes,
  fitSessionOfWeekday,
  FIT_DAY_SHORT,
  FIT_RECOVERY,
  FIT_TIME_LABEL,
  saveFitWeight,
  setFitDaySkipped,
  setFitExerciseDone,
  syncFitnessHabit,
  syncFitnessHabitSkipped,
  weightOf,
  type Exercise,
  type FitDay,
  type FitWeights,
} from '@/lib/fitness';
import { type LoginStreak } from '@/lib/achievements';
import { openExternalUrl } from '@/lib/linking';

// Tab Exercise 💪 — deretan hari (ala BetterMe) + sesi hari yang dipilih.
// Hanya sesi HARI INI yang bisa dicentang; hari lain tampil sebagai pratinjau
// biar kamu tahu besok latihan apa dan bisa siap-siap.
//
// Tiap hari SELALU ada sesinya: beban, lari, atau jalan pagi. Yang membedakan
// hari jalan pagi cuma perlakuan rentetan 🔥 — lihat `isWalkDay` di bawah.
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
  const block = fitBlockOf(today);

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

  // Tekan pil hari yang sedang dibuka LAGI → isi sesinya balik ke paling atas.
  const { ref: scrollRef, toTop } = useScrollTop();

  // Modal ubah beban satu gerakan.
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [fWeight, setFWeight] = useState('');
  // Modal konfirmasi "lewati hari ini" — sengaja pakai konfirmasi karena
  // rentetan 🔥 yang hilang tidak bisa dikembalikan.
  const [confirmSkip, setConfirmSkip] = useState(false);

  const { done, skipped } = day;
  const session = fitSessionOfWeekday(weekday, block);
  const isToday = weekday === todayWeekday;
  // Hari jalan pagi = pemulihan: boleh dicentang sebagai bonus, tapi tidak
  // pernah menaikkan maupun memutus rentetan 🔥.
  const isWalkDay = session.kind === 'walk';
  // Hari yang dilewati ✕ dianggap tidak ada centangnya sama sekali.
  const doneCount =
    isToday && skipped
      ? 0
      : session.exercises.filter((e) => done[e.id]).length;
  const total = session.exercises.length;
  const allDone = total > 0 && doneCount === total;
  // Tombol lewati hanya untuk HARI INI, dan hanya selama sesinya belum beres —
  // sesi yang sudah selesai tidak bisa "dilewati" (kalau bisa, rentetan yang
  // baru saja naik malah ikut hangus).
  const canSkip = isToday && (skipped || !allDone);

  async function toggle(ex: Exercise) {
    if (!user || !isToday || busy || skipped) return;
    setBusy(true);
    const next = !done[ex.id];
    try {
      await setFitExerciseDone(user.uid, dayId, ex.id, next);
      // Baris "🏋️ Morning Exercise" di Habits ikut hasil sesi ini — jadi
      // olahraga cukup dicentang di sini saja, tidak dua kali.
      const after = { ...done, [ex.id]: next };
      await syncFitnessHabit(
        user.uid,
        dayId,
        session.exercises.every((e) => after[e.id]),
      );
      // Centang terakhir yang melengkapi sesi → streak naik 🔥. Hari jalan pagi
      // dikecualikan: itu pemulihan, bukan sesi latihan.
      if (next && !isWalkDay) {
        if (session.exercises.every((e) => after[e.id])) {
          await bumpFitStreak(user.uid, streak, today);
          // Rekap mingguan Health hanya menghitung hari ANGKAT BEBAN (target
          // anjuran: strength training minimal 2 hari/minggu) — hari lari tidak
          // ikut, supaya angkanya tetap jujur.
          if (session.kind === 'strength') {
            await bumpWeekGym(user.uid, today);
          }
        }
      }
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    } finally {
      setBusy(false);
    }
  }

  /**
   * Lewati latihan HARI INI. Semua gerakan langsung bertanda ✕, badge Exercise
   * & kartu reminder Dashboard ikut hilang, dan rentetan 🔥 diputus ke 0.
   */
  async function handleSkip() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await setFitDaySkipped(user.uid, dayId, true);
      // Baris di Habits ikut bertanda ✕ — keluar dari skor harian, bukan
      // menggantung sebagai kebiasaan yang belum dikerjakan.
      await syncFitnessHabitSkipped(user.uid, dayId, true);
      // Jalan pagi tidak pernah menyentuh rentetan — melewatinya pun tidak.
      if (!isWalkDay) await breakFitStreak(user.uid, streak);
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    } finally {
      setConfirmSkip(false);
      setBusy(false);
    }
  }

  /**
   * Batalkan tanda lewati — centangnya bisa dipakai lagi. Rentetan 🔥 yang
   * sudah telanjur hilang TIDAK ikut kembali; sesi hari ini dihitung sebagai
   * rentetan ke-1 lagi.
   */
  async function handleUnskip() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await setFitDaySkipped(user.uid, dayId, false);
      // Tanda ✕ di Habits ikut dicabut; centangnya kembali mengikuti
      // gerakan yang sudah/belum beres hari ini.
      await syncFitnessHabitSkipped(user.uid, dayId, false);
      await syncFitnessHabit(
        user.uid,
        dayId,
        session.exercises.every((e) => done[e.id]),
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

  // Layar cukup lebar (iPad) → 7 hari dibagi rata memenuhi satu baris penuh.
  // Layar sempit (iPhone) → tetap pil selebar tetap yang bisa digeser samping.
  const oneRow = width - 40 >= DAY_PILL_WIDTH * 7 + DAY_GAP * 6;

  const dayPills = [1, 2, 3, 4, 5, 6, 0].map((wd) => {
    const s = fitSessionOfWeekday(wd, block);
    const active = wd === weekday;
    // Sudah beres hari itu? Hari ini dibaca LANGSUNG dari `day` yang live, hari
    // lain dari hasil ambilan seminggu — jadi centang terakhir hari ini
    // langsung memunculkan ✅-nya tanpa menunggu apa pun.
    const selesai =
      wd === todayWeekday
        ? fitDayComplete(day, wd, block)
        : fitDayComplete(weekDays[weekIdOf(wd)], wd, block);
    return (
      <PressableScale
        key={wd}
        style={[
          styles.dayPill,
          oneRow && styles.dayPillFill,
          active && styles.dayPillActive,
          selesai && !active && styles.dayPillDone,
        ]}
        // Tekanan kedua (hari yang sedang dibuka) = balik ke paling atas.
        onPress={() => (active ? toTop() : setWeekday(wd))}>
        {/* Hari jalan pagi diredupkan — tetap ada isinya, tapi bukan hari inti */}
        <VixText
          additionalStyle={[
            styles.dayEmoji,
            s.kind === 'walk' && styles.dayEmojiRest,
          ]}>
          {s.emoji}
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

  return (
    <View style={styles.flex}>
      {/* Deretan hari — Senin di kiri, hari jalan pagi 🚶 tampil lebih redup */}
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

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {/* Hero sesi — warna oranye Fitness sesuai grid Home */}
        <View style={styles.hero}>
              <View style={styles.heroMain}>
                <VixText heading="label" additionalStyle={styles.heroSub}>
                  Blok {block} · ±{fitSessionMinutes(session)} menit ·{' '}
                  {FIT_TIME_LABEL}
                </VixText>
                <VixText heading="subheader" additionalStyle={styles.heroTitle}>
                  {session.emoji} {session.title}
                </VixText>
                <VixText heading="label" additionalStyle={styles.heroSub}>
                  {session.focus}
                </VixText>
              </View>
              {isToday && (
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

            {isToday && skipped ? (
              <SkipNotice
                title={
                  isWalkDay
                    ? '✕ Jalan pagi hari ini dilewati'
                    : '✕ Latihan hari ini dilewati'
                }
                detail={
                  isWalkDay
                    ? 'Hari jalan pagi memang bonus — rentetan 🔥 tidak terpengaruh sama sekali.'
                    : 'Rentetan 🔥 sudah kembali ke 0. Besok mulai lagi dari ' +
                      'satu — yang penting jangan dua kali berturut-turut.'
                }
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
                  👀 Pratinjau — yang bisa dicentang hanya latihan hari ini.
                </VixText>
              </View>
            )}

            {session.exercises.map((ex) => {
              // ✕ menang atas centang: hari yang dilewati tidak pernah tampil
              // tercentang, walau centangnya tersimpan sebelum ditandai lewati.
              const exSkipped = isToday && skipped;
              const checked = isToday && !exSkipped && !!done[ex.id];
              const kg = weightOf(ex, weights);
              return (
                <View
                  key={ex.id}
                  style={[
                    styles.exCard,
                    checked && styles.exCardDone,
                    exSkipped && styles.exCardSkipped,
                  ]}>
                  <PressableScale
                    onPress={() => toggle(ex)}
                    disabled={!isToday || exSkipped}
                    hitSlop={8}>
                    {/* Hari lain cuma PRATINJAU — centangnya mati, jadi
                        cincinnya abu-abu biar tidak terlihat bisa ditekan. */}
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
                          tidak bisa diubah di sini (berat badan cuma berubah
                          lewat pengingat timbang tiap Minggu di Health).
                          Gerakan berbeban → ketuk untuk ubah bebannya. */}
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

            {/* ⏭️ Lewati latihan hari ini — jujur mencatat "hari ini tidak
                latihan", bukan menyembunyikannya. Tekan lagi untuk membatalkan
                tandanya (rentetan 🔥 tetap tidak kembali). */}
        {canSkip && (
          <SkipButton
            skipped={skipped}
            label={
              isWalkDay ? '⏭️ Lewati jalan hari ini' : '⏭️ Lewati latihan hari ini'
            }
            busy={busy}
            onPress={skipped ? handleUnskip : () => setConfirmSkip(true)}
            additionalStyle={styles.skipGap}
          />
        )}

        {/* Hari jalan pagi ditutup pengingat pemulihan — dulu ini isi layar
            "Rest Day"; sekarang menempel di bawah sesi jalannya. */}
        {isWalkDay &&
          FIT_RECOVERY.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <VixText heading="label" additionalStyle={styles.tipText}>
                {tip}
              </VixText>
            </View>
          ))}
      </ScrollView>

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

      {/* Konfirmasi lewati — rentetan yang hilang tidak bisa dikembalikan,
          jadi wajib ditanya dulu. */}
      <ConfirmDialog
        visible={confirmSkip}
        title={isWalkDay ? 'Lewati jalan pagi hari ini?' : 'Lewati latihan hari ini?'}
        detail={
          isWalkDay
            ? `${session.emoji} ${session.title} ditandai ✕.\n\n🔥 Rentetan tidak terpengaruh — hari jalan pagi memang tidak pernah dihitung sebagai sesi latihan.`
            : `${session.emoji} ${session.title} ditandai ✕ — semua gerakan dianggap tidak dikerjakan.\n\n🔥 Rentetan kembali ke 0 dan TIDAK bisa dikembalikan. Rekor terbaik & total sesimu tetap aman.`
        }
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
  // Dilewati ✕ — warnanya sama dengan baris kebiasaan yang dilewati di Habits.
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
  tipRow: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tipText: { color: Color.TEXT_TITLE },
  modalTitle: { color: Color.TEXT_TITLE, marginBottom: 4 },
});
