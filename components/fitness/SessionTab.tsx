import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { useAuth } from '@/contexts/auth';
import { formatDecimal, parseDecimal } from '@/lib/format';
import {
  bumpFitStreak,
  fitBlockOf,
  fitQuote,
  fitSessionMinutes,
  fitSessionOfWeekday,
  FIT_DAY_SHORT,
  FIT_HOUR_LABEL,
  FIT_RECOVERY,
  saveFitWeight,
  setFitExerciseDone,
  weightOf,
  type Exercise,
  type FitDayDone,
  type FitWeights,
} from '@/lib/fitness';
import { type LoginStreak } from '@/lib/achievements';

// Tab Latihan 💪 — deretan hari (ala BetterMe) + sesi hari yang dipilih.
// Hanya sesi HARI INI yang bisa dicentang; hari lain tampil sebagai pratinjau
// biar kamu tahu besok latihan apa dan bisa siap-siap.
export function SessionTab({
  weights,
  done,
  dayId,
  streak,
}: {
  weights: FitWeights;
  done: FitDayDone;
  dayId: string;
  streak: LoginStreak | null;
}) {
  const { user } = useAuth();
  const today = new Date();
  const todayWeekday = today.getDay();
  const block = fitBlockOf(today);

  const [weekday, setWeekday] = useState(todayWeekday);
  const [busy, setBusy] = useState(false);

  // Modal ubah beban satu gerakan.
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [fWeight, setFWeight] = useState('');

  const session = fitSessionOfWeekday(weekday, block);
  const isToday = weekday === todayWeekday;
  const doneCount = session
    ? session.exercises.filter((e) => done[e.id]).length
    : 0;
  const total = session?.exercises.length ?? 0;
  const allDone = total > 0 && doneCount === total;

  async function toggle(ex: Exercise) {
    if (!user || !isToday || !session || busy) return;
    setBusy(true);
    const next = !done[ex.id];
    try {
      await setFitExerciseDone(user.uid, dayId, ex.id, next);
      // Centang terakhir yang melengkapi sesi → streak naik 🔥
      if (next) {
        const after = { ...done, [ex.id]: true };
        if (session.exercises.every((e) => after[e.id])) {
          await bumpFitStreak(user.uid, streak, today);
        }
      }
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

  return (
    <View style={styles.flex}>
      {/* Deretan hari — Senin di kiri, hari istirahat ditandai 😴 */}
      <View style={styles.dayStripWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayStrip}>
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const s = fitSessionOfWeekday(wd, block);
            const active = wd === weekday;
            return (
              <PressableScale
                key={wd}
                style={[styles.dayPill, active && styles.dayPillActive]}
                onPress={() => setWeekday(wd)}>
                <VixText
                  additionalStyle={[
                    styles.dayEmoji,
                    !s && styles.dayEmojiRest,
                  ]}>
                  {s ? s.emoji : '😴'}
                </VixText>
                <VixText
                  heading="bold"
                  additionalStyle={[
                    styles.dayLabel,
                    active && styles.dayLabelActive,
                  ]}>
                  {FIT_DAY_SHORT[wd]}
                </VixText>
                {wd === todayWeekday && <View style={styles.todayDot} />}
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {session ? (
          <>
            {/* Hero sesi — warna oranye Fitness sesuai grid Home */}
            <View style={styles.hero}>
              <View style={styles.heroMain}>
                <VixText heading="label" additionalStyle={styles.heroSub}>
                  Blok {block} · ±{fitSessionMinutes(session)} menit ·{' '}
                  {FIT_HOUR_LABEL}
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

            {isToday ? (
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
              const checked = isToday && !!done[ex.id];
              const kg = weightOf(ex, weights);
              return (
                <View
                  key={ex.id}
                  style={[styles.exCard, checked && styles.exCardDone]}>
                  <PressableScale
                    onPress={() => toggle(ex)}
                    disabled={!isToday}
                    hitSlop={8}>
                    <CheckCircle checked={checked} />
                  </PressableScale>

                  <View style={styles.exMain}>
                    <VixText
                      heading="bold"
                      additionalStyle={[
                        styles.exName,
                        checked && styles.exNameDone,
                      ]}>
                      {ex.emoji} {ex.name}
                    </VixText>
                    <VixText heading="label">
                      {ex.sets} set × {ex.reps}
                      {ex.core ? '  ·  🔥 perut' : ''}
                    </VixText>

                    <View style={styles.exActions}>
                      {/* Chip beban — ketuk untuk ubah, tersimpan buat sesi berikutnya */}
                      <PressableScale
                        style={styles.weightChip}
                        onPress={() => openWeight(ex)}
                        hitSlop={6}>
                        <VixText heading="label" additionalStyle={styles.weightText}>
                          {kg == null || kg === 0
                            ? '🏋️ Berat badan'
                            : `🏋️ ${formatDecimal(kg)} kg`}
                        </VixText>
                      </PressableScale>
                      {ex.video ? (
                        <PressableScale
                          style={styles.videoChip}
                          onPress={() => Linking.openURL(ex.video!)}
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
          </>
        ) : (
          // Rabu & Minggu — hari istirahat.
          <>
            <View style={styles.hero}>
              <View style={styles.heroMain}>
                <VixText heading="label" additionalStyle={styles.heroSub}>
                  {FIT_DAY_SHORT[weekday]} · tidak ada latihan
                </VixText>
                <VixText heading="subheader" additionalStyle={styles.heroTitle}>
                  😴 Rest Day
                </VixText>
                <VixText heading="label" additionalStyle={styles.heroSub}>
                  Istirahat itu bagian dari program, bukan bolos
                </VixText>
              </View>
            </View>
            {FIT_RECOVERY.map((tip) => (
              <View key={tip} style={styles.tipRow}>
                <VixText heading="label" additionalStyle={styles.tipText}>
                  {tip}
                </VixText>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Modal ubah beban */}
      <CenterDialog visible={!!editing} onClose={() => setEditing(null)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          🏋️ Beban {editing?.name}
        </VixText>
        <VixText heading="label" additionalStyle={styles.modalHint}>
          Isi beban yang benar-benar kamu pakai. Tersimpan sebagai patokan sesi
          berikutnya. Isi 0 kalau pakai berat badan.
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dayStripWrap: { paddingBottom: 6 },
  dayStrip: { paddingHorizontal: 20, gap: 8 },
  dayPill: {
    alignItems: 'center',
    gap: 2,
    width: 58,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  dayPillActive: {
    borderColor: Color.FITNESS_DARK,
    backgroundColor: Color.FITNESS,
  },
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
  modalHint: { marginBottom: 10 },
});
