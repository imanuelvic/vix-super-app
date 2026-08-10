import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { GreetingHeader } from '@/components/common/Greeting';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { formatDecimal, parseDecimal } from '@/lib/format';
import {
  HABIT_SLOTS,
  habitsBySlot,
  newHabitId,
  saveHabits,
  slotMeta,
  slotNow,
  type HabitSlot,
  type ScheduledHabit,
} from '@/lib/habits';
import {
  activeStreak,
  bumpStreak,
  clearWeightTarget,
  idealWeightRange,
  saveWeightTarget,
  setHabitDone,
  type HabitDay,
  type HealthProfile,
  type Streak,
  type WeightTarget,
} from '@/lib/health';
import { SAVE_ERROR } from '@/lib/messages';

// Tab Habits: kebiasaan harian (sama tiap hari) dibagi 3 sesi
// Pagi/Siang/Malam — bisa ditambah, di-rename, diurutkan, & dihapus. Plus
// ring progress + streak 🔥, air minum 💧, dan target berat 🎯.
export function TodoTab({
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

  const [error, setError] = useState<string | null>(null);
  // Tab sesi aktif — default ke sesi sesuai jam sekarang (Pagi/Siang/Malam).
  const [activeSlot, setActiveSlot] = useState<HabitSlot>(() =>
    slotNow(new Date()),
  );

  // Modal tambah/edit kebiasaan.
  const [editing, setEditing] = useState<ScheduledHabit | 'new' | null>(null);
  const [editSlot, setEditSlot] = useState<HabitSlot>('morning');
  const [fLabel, setFLabel] = useState('');
  const [busy, setBusy] = useState(false);

  // Modal pasang/ubah target berat.
  const [targetOpen, setTargetOpen] = useState(false);
  const [fTarget, setFTarget] = useState('');
  const [targetError, setTargetError] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);

  const doneCount = habits.filter((h) => day.done[h.id]).length;
  const streakDays = activeStreak(streak, dayId);
  const range = idealWeightRange(profile.heightCm);
  const grouped = habitsBySlot(habits);
  const activeList = grouped[activeSlot];

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

  async function handleToggle(habit: ScheduledHabit) {
    if (!user) return;
    setError(null);
    const nextChecked = !day.done[habit.id];
    try {
      await setHabitDone(user.uid, dayId, habit.id, nextChecked);
      // Kalau centang ini melengkapi SEMUA kebiasaan hari ini → streak naik 🔥
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

  function openAdd(slot: HabitSlot) {
    setEditing('new');
    setEditSlot(slot);
    setFLabel('');
  }

  function openEdit(habit: ScheduledHabit) {
    setEditing(habit);
    setEditSlot(habit.slot);
    setFLabel(habit.label);
  }

  async function handleSaveHabit() {
    if (!user || busy) return;
    const label = fLabel.trim();
    if (!label) return;
    setBusy(true);
    const g = habitsBySlot(habits);
    if (editing === 'new') {
      g[editSlot] = [...g[editSlot], { id: newHabitId(), label, slot: editSlot }];
    } else if (editing) {
      g[editing.slot] = g[editing.slot].map((h) =>
        h.id === editing.id ? { ...h, label } : h,
      );
    }
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
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {/* Sapaan + tanggal + streak (komponen bersama) */}
        <GreetingHeader streak={streakDays} />

        {/* ===== Baris atas: Kebiasaan (ring) + Target berat ===== */}
        <View style={styles.statsRow}>
          <View style={styles.heroCard}>
            <DonutChart
              size={84}
              thickness={11}
              slices={[
                { value: doneCount, color: Color.MAIN_LIGHT },
                { value: habits.length - doneCount, color: Color.MAIN },
              ]}>
              <VixText heading="title" additionalStyle={styles.heroRingText}>
                {doneCount}/{habits.length}
              </VixText>
            </DonutChart>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              Kebiasaan Hari Ini
            </VixText>
            <VixText heading="bold" additionalStyle={styles.heroValue}>
              {doneCount === habits.length && habits.length > 0
                ? 'Beres semua! 🎉'
                : `${habits.length - doneCount} lagi 💪`}
            </VixText>
          </View>

          <View style={styles.targetCard}>
            <View style={styles.cardHeader}>
              <VixText heading="title">🎯 Target</VixText>
              <PressableScale onPress={openTarget} hitSlop={10}>
                <VixText heading="bold" additionalStyle={styles.editText}>
                  {target ? 'Ubah' : 'Pasang'}
                </VixText>
              </PressableScale>
            </View>
            {target ? (
              <>
                <VixText heading="subheader" additionalStyle={styles.targetValue}>
                  {formatDecimal(profile.weightKg)}
                  <VixText heading="label">
                    {' '}
                    → {formatDecimal(target.targetWeightKg)} kg
                  </VixText>
                </VixText>
                <View style={styles.targetBarTrack}>
                  <View
                    style={[styles.targetBarFill, { width: `${targetPercent}%` }]}
                  />
                </View>
                <VixText heading="label" additionalStyle={styles.targetSub}>
                  {reached
                    ? 'Tercapai! 🎉'
                    : `sisa ${formatDecimal(remaining)} kg 💪`}
                </VixText>
              </>
            ) : (
              <VixText heading="label">
                Belum ada target. Sehat {formatDecimal(range.min)}–
                {formatDecimal(range.max)} kg.
              </VixText>
            )}
          </View>
        </View>

        {/* ===== Kebiasaan: tab sesi Pagi/Siang/Malam (satu sesi tampil biar
            tak perlu scroll panjang; default ke sesi jam sekarang) ===== */}
        <View style={styles.slotTabs}>
          {HABIT_SLOTS.map((s) => {
            const list = grouped[s.key];
            const slotDone = list.filter((h) => day.done[h.id]).length;
            const active = s.key === activeSlot;
            const complete = list.length > 0 && slotDone === list.length;
            return (
              <PressableScale
                key={s.key}
                style={[styles.slotTab, active && styles.slotTabActive]}
                onPress={() => setActiveSlot(s.key)}>
                <VixText
                  heading="bold"
                  numberOfLines={1}
                  additionalStyle={[
                    styles.slotTabLabel,
                    active && styles.slotTabLabelActive,
                  ]}>
                  {s.emoji} {s.label}
                </VixText>
                <VixText
                  heading="label"
                  additionalStyle={[
                    styles.slotTabCount,
                    active && styles.slotTabCountActive,
                  ]}>
                  {complete ? '✅ beres' : `${slotDone}/${list.length}`}
                </VixText>
              </PressableScale>
            );
          })}
        </View>

        {/* Kebiasaan sesi yang aktif */}
        <View style={styles.slotBlock}>
          {activeList.map((habit) => {
            const checked = !!day.done[habit.id];
            return (
              <View
                key={habit.id}
                style={[styles.row, checked && styles.rowDone]}>
                <PressableScale onPress={() => handleToggle(habit)} hitSlop={8}>
                  <CheckCircle checked={checked} />
                </PressableScale>
                {/* Teks tidak bisa ditekan — ubah/urutkan/hapus lewat tombol edit */}
                <View style={styles.rowMain}>
                  <VixText
                    heading="paragraph"
                    additionalStyle={[
                      styles.habitText,
                      checked && styles.habitTextDone,
                    ]}>
                    {habit.label}
                  </VixText>
                </View>
                {/* Tombol edit → buka modal ubah / urutkan / hapus */}
                <PressableScale
                  style={styles.editButton}
                  onPress={() => openEdit(habit)}
                  hitSlop={8}>
                  <IconSymbol name="pencil" size={18} color={Color.TEXT_LABEL} />
                </PressableScale>
              </View>
            );
          })}

          <PressableScale
            style={styles.addRow}
            onPress={() => openAdd(activeSlot)}>
            <IconSymbol name="plus" size={16} color={Color.MAIN} />
            <VixText heading="label" additionalStyle={styles.addText}>
              Tambah kebiasaan {slotMeta(activeSlot).label.toLowerCase()}
            </VixText>
          </PressableScale>
        </View>

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}
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
        <FormInput
          placeholder="Nama kebiasaan (boleh pakai emoji)"
          value={fLabel}
          onChangeText={setFLabel}
          autoFocus
          editable={!busy}
        />

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

        {editing && editing !== 'new' && (
          <InlineDelete
            key={editing.id}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  heroCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 16,
  },
  heroRingText: { color: Color.TEXT_REVERSE },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  heroValue: { color: Color.TEXT_REVERSE, textAlign: 'center' },
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
  editText: { color: Color.MAIN },
  targetValue: { color: Color.TEXT_TITLE },
  targetBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  targetBarFill: { height: '100%', borderRadius: 4, backgroundColor: Color.MAIN },
  // Tab sesi (Pagi/Siang/Malam) — segmen yang bisa dipencet.
  slotTabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  slotTab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  slotTabActive: {
    borderColor: Color.MAIN,
    backgroundColor: Color.MAIN_TRANSPARENT,
  },
  slotTabLabel: { color: Color.TEXT_LABEL },
  slotTabLabelActive: { color: Color.MAIN_DARK },
  slotTabCount: { color: Color.TEXT_PLACEHOLDER },
  slotTabCountActive: { color: Color.MAIN },
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
  rowMain: { flex: 1 },
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
  error: { color: Color.DANGER, marginBottom: 8, marginTop: 6 },
  modalTitle: { marginBottom: 4 },
  modalHint: { marginBottom: 10 },
  deleteText: { color: Color.DANGER, textAlign: 'center', marginTop: 12 },
});
