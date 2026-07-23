import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { formatDecimal, formatFullDate, parseDecimal } from '@/lib/format';
import {
  activeStreak,
  bumpStreak,
  clearWeightTarget,
  idealWeightRange,
  MOODS,
  newHabitId,
  saveHabits,
  saveWeightTarget,
  setHabitDone,
  setMood,
  setWater,
  WATER_GOAL,
  type Habit,
  type HabitDay,
  type HealthProfile,
  type Streak,
  type WeightTarget,
} from '@/lib/health';

// Tab To-do: pusat rutinitas harian — ring progress kebiasaan + streak 🔥,
// air minum 💧, mood 🙂, target berat 🎯, dan ceklis kebiasaan.
// Semua data harian otomatis reset tiap ganti hari (satu dokumen per tanggal).
export function TodoTab({
  habits,
  day,
  dayId,
  profile,
  target,
  streak,
}: {
  habits: Habit[];
  day: HabitDay;
  dayId: string;
  profile: HealthProfile;
  target: WeightTarget | null;
  streak: Streak | null;
}) {
  const { user } = useAuth();

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Habit | null>(null);
  const [busy, setBusy] = useState(false);

  // Modal pasang/ubah target berat.
  const [targetOpen, setTargetOpen] = useState(false);
  const [fTarget, setFTarget] = useState('');
  const [targetError, setTargetError] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);

  const doneCount = habits.filter((h) => day.done[h.id]).length;
  const streakDays = activeStreak(streak, dayId);
  const range = idealWeightRange(profile.heightCm);

  // Progress target: dari berat awal (saat target dipasang) menuju target.
  // Rumus sama untuk program turun maupun naik (bulking otot).
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

  async function handleToggle(habit: Habit) {
    if (!user) return;
    setError(null);
    const nextChecked = !day.done[habit.id];
    try {
      await setHabitDone(user.uid, dayId, habit.id, nextChecked);
      // Kalau centang ini melengkapi SEMUA kebiasaan → streak naik 🔥
      if (nextChecked) {
        const nextDone = { ...day.done, [habit.id]: true };
        const allDone =
          habits.length > 0 && habits.every((h) => nextDone[h.id]);
        if (allDone) await bumpStreak(user.uid, streak, dayId);
      }
    } catch {
      setError('Gagal menyimpan centang. Coba lagi.');
    }
  }

  async function handleWater(delta: number) {
    if (!user) return;
    setError(null);
    try {
      await setWater(user.uid, dayId, day.water + delta);
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
    }
  }

  async function handleMood(mood: string) {
    if (!user) return;
    setError(null);
    try {
      await setMood(user.uid, dayId, mood);
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
    }
  }

  async function handleAdd() {
    const label = text.trim();
    if (!label || !user) return;
    setText('');
    setError(null);
    try {
      await saveHabits(user.uid, [...habits, { id: newHabitId(), label }]);
    } catch {
      setText(label); // kembalikan teks kalau gagal
      setError('Gagal menambah kebiasaan. Coba lagi.');
    }
  }

  async function handleRemove() {
    if (!user || !removing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveHabits(user.uid, habits.filter((h) => h.id !== removing.id));
    } catch {
      setError('Gagal menghapus kebiasaan. Coba lagi.');
    } finally {
      setRemoving(null);
      setBusy(false);
    }
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
        // Titik mulai dikunci saat target pertama dipasang; ubah angka
        // target tidak menggeser titik mulai.
        startWeightKg: target?.startWeightKg ?? profile.weightKg,
      });
      setTargetOpen(false);
    } catch {
      setTargetError('Gagal menyimpan. Cek koneksi internet.');
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

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Tanggal + streak */}
        <View style={styles.topRow}>
          <VixText heading="label">📆 {formatFullDate(new Date())}</VixText>
          <View style={styles.streakChip}>
            <VixText heading="bold" additionalStyle={styles.streakText}>
              🔥 {streakDays} hari
            </VixText>
          </View>
        </View>

        {/* ===== Hero: ring progress kebiasaan ===== */}
        <View style={styles.heroCard}>
          <DonutChart
            size={96}
            thickness={12}
            slices={[
              { value: doneCount, color: Color.MAIN_LIGHT },
              { value: habits.length - doneCount, color: Color.MAIN },
            ]}>
            <VixText heading="title" additionalStyle={styles.heroRingText}>
              {doneCount}/{habits.length}
            </VixText>
          </DonutChart>
          <View style={styles.heroRight}>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              Kebiasaan hari ini
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.heroValue}>
              {doneCount === habits.length && habits.length > 0
                ? 'Beres semua! 🎉'
                : `${habits.length - doneCount} lagi 💪`}
            </VixText>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              {streakDays > 0
                ? `Streak ${streakDays} hari — jangan putus!`
                : 'Selesaikan semua untuk mulai streak 🔥'}
            </VixText>
          </View>
        </View>

        {/* ===== Air minum ===== */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <VixText heading="title">
              💧 Air Putih{' '}
              <VixText heading="label">
                {day.water}/{WATER_GOAL} gelas
              </VixText>
            </VixText>
            <View style={styles.waterControls}>
              <Pressable
                style={styles.waterMinus}
                onPress={() => handleWater(-1)}
                hitSlop={6}>
                <VixText heading="bold" additionalStyle={styles.waterMinusText}>
                  −
                </VixText>
              </Pressable>
              <Pressable
                style={styles.waterPlus}
                onPress={() => handleWater(1)}
                hitSlop={6}>
                <IconSymbol name="plus" size={20} color={Color.TEXT_REVERSE} />
              </Pressable>
            </View>
          </View>
          <View style={styles.waterDots}>
            {Array.from({ length: WATER_GOAL }, (_, i) => (
              <View
                key={i}
                style={[styles.waterDot, i < day.water && styles.waterDotFull]}
              />
            ))}
          </View>
          {day.water >= WATER_GOAL && (
            <VixText heading="label" additionalStyle={styles.waterDoneText}>
              Target air tercapai — mantap! 🌊
            </VixText>
          )}
        </View>

        {/* ===== Mood hari ini ===== */}
        <View style={styles.card}>
          <VixText heading="title" additionalStyle={styles.moodTitle}>
            Perasaan hari ini?
          </VixText>
          <View style={styles.moodRow}>
            {MOODS.map((m) => {
              const active = day.mood === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.moodButton, active && styles.moodActive]}
                  onPress={() => handleMood(m)}>
                  <VixText additionalStyle={styles.moodEmoji}>{m}</VixText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ===== Target berat ===== */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <VixText heading="title">🎯 Target Berat</VixText>
            <Pressable onPress={openTarget} hitSlop={10}>
              <VixText heading="bold" additionalStyle={styles.editText}>
                {target ? 'Ubah' : 'Pasang'}
              </VixText>
            </Pressable>
          </View>
          {target ? (
            <>
              <VixText heading="subheader" additionalStyle={styles.targetValue}>
                {formatDecimal(profile.weightKg)} kg{' '}
                <VixText heading="label">
                  → target {formatDecimal(target.targetWeightKg)} kg
                </VixText>
              </VixText>
              <View style={styles.targetBarTrack}>
                <View
                  style={[styles.targetBarFill, { width: `${targetPercent}%` }]}
                />
              </View>
              <VixText heading="label">
                {reached
                  ? '🎉 Target tercapai — pertahankan!'
                  : `Mulai dari ${formatDecimal(target.startWeightKg)} kg · sisa ${formatDecimal(remaining)} kg lagi 💪`}
              </VixText>
              <VixText heading="label" additionalStyle={styles.targetHint}>
                Update berat lewat tab Summary → Data Tubuh.
              </VixText>
            </>
          ) : (
            <VixText heading="label">
              Belum ada target. Rentang berat sehatmu (BMI normal,{' '}
              {profile.heightCm} cm): {formatDecimal(range.min)}–
              {formatDecimal(range.max)} kg.
            </VixText>
          )}
        </View>

        {/* ===== Ceklis kebiasaan ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Kebiasaan Harian
        </VixText>
        <View style={styles.inputRow}>
          <FormInput
            style={styles.input}
            placeholder="Tambah kebiasaan baru…"
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable style={styles.addButton} onPress={handleAdd}>
            <IconSymbol name="plus" size={24} color={Color.TEXT_REVERSE} />
          </Pressable>
        </View>

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {habits.map((habit) => {
          const checked = !!day.done[habit.id];
          return (
            <View key={habit.id} style={[styles.row, checked && styles.rowDone]}>
              <Pressable
                style={styles.rowMain}
                onPress={() => handleToggle(habit)}>
                <CheckCircle checked={checked} />
                <VixText
                  heading="paragraph"
                  additionalStyle={[
                    styles.habitText,
                    checked && styles.habitTextDone,
                  ]}>
                  {habit.label}
                </VixText>
              </Pressable>
              <Pressable onPress={() => setRemoving(habit)} hitSlop={10}>
                <IconSymbol
                  name="xmark"
                  size={18}
                  color={Color.TEXT_PLACEHOLDER}
                />
              </Pressable>
            </View>
          );
        })}

        <VixText heading="label" additionalStyle={styles.hint}>
          Ceklis, air, dan mood otomatis reset setiap ganti hari.
        </VixText>
      </ScrollView>

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
        {targetError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {targetError}
          </VixText>
        )}
        {target && (
          <Pressable onPress={handleClearTarget} disabled={savingTarget}>
            <VixText heading="bold" additionalStyle={styles.deleteText}>
              Hapus target
            </VixText>
          </Pressable>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={savingTarget}
          onCancel={() => setTargetOpen(false)}
          onConfirm={handleSaveTarget}
        />
      </CenterDialog>

      {/* Konfirmasi hapus kebiasaan */}
      <ConfirmDialog
        visible={!!removing}
        title="Hapus kebiasaan?"
        detail={
          removing
            ? `${removing.label} — riwayat centang hari-hari sebelumnya tidak ikut terhapus.`
            : undefined
        }
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={handleRemove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  streakChip: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  streakText: { color: Color.ACCENT_DARK },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  heroRingText: { color: Color.TEXT_REVERSE },
  heroRight: { flex: 1, gap: 2 },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waterControls: { flexDirection: 'row', gap: 8 },
  waterMinus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterMinusText: { color: Color.TEXT_LABEL },
  waterPlus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterDots: { flexDirection: 'row', gap: 8 },
  waterDot: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: Color.CONTRAST_CONTAINER,
  },
  waterDotFull: { backgroundColor: Color.MAIN_LIGHT },
  waterDoneText: { color: Color.SUCCESS },
  moodTitle: { marginBottom: 2 },
  moodRow: { flexDirection: 'row', gap: 10 },
  moodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  moodActive: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN,
  },
  moodEmoji: { fontSize: 24, lineHeight: 30 },
  editText: { color: Color.MAIN },
  targetValue: { color: Color.TEXT_TITLE },
  targetBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  targetBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Color.MAIN,
  },
  targetHint: { color: Color.TEXT_PLACEHOLDER },
  sectionTitle: { marginTop: 4, marginBottom: 10 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  input: { flex: 1 },
  addButton: {
    width: 48,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: Color.DANGER, marginBottom: 8, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 12,
  },
  rowDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  habitTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  hint: { textAlign: 'center', marginTop: 6 },
  modalTitle: { marginBottom: 4 },
  modalHint: { marginBottom: 10 },
  deleteText: { color: Color.DANGER, textAlign: 'center', marginTop: 12 },
});
