import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  dietTone,
  dietTotals,
  fatLimitG,
  kcalTargetOf,
  MEAL_SLOTS,
  mealSlotMeta,
  mealsBySlot,
  newMealId,
  saveDietDay,
  SUGAR_IDEAL_G,
  SUGAR_LIMIT_G,
  type DietDay,
  type Meal,
  type MealSlot,
} from '@/lib/diet';
import { parseDecimal } from '@/lib/format';
import { ageFromBirthYear, type HealthProfile } from '@/lib/health';
import { SAVE_ERROR } from '@/lib/messages';

// Sub-tab Diet 🥗 — "less sugar, less fat". Ring kalori di atas, lalu dua bar
// batas (gula & lemak), lalu daftar makan hari ini per waktu makan.
// Angka kalori/gula/lemak diisi manual dari label kemasan atau perkiraan —
// tidak ada database makanan, sengaja simpel & tanpa biaya API.
export function DietTab({
  day,
  dayId,
  profile,
}: {
  day: DietDay;
  dayId: string;
  profile: HealthProfile;
}) {
  const { user } = useAuth();

  const [editing, setEditing] = useState<Meal | 'new' | null>(null);
  const [fSlot, setFSlot] = useState<MealSlot>('sarapan');
  const [fName, setFName] = useState('');
  const [fKcal, setFKcal] = useState('');
  const [fSugar, setFSugar] = useState('');
  const [fFat, setFFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = dietTotals(day);
  const kcalTarget = kcalTargetOf(profile, ageFromBirthYear(profile.birthYear));
  const fatLimit = fatLimitG(kcalTarget);
  const grouped = mealsBySlot(day);
  const kcalLeft = kcalTarget - totals.kcal;

  async function saveMeals(meals: Meal[]) {
    if (!user) return;
    setError(null);
    try {
      await saveDietDay(user.uid, dayId, meals);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  function openAdd(slot: MealSlot) {
    setEditing('new');
    setFSlot(slot);
    setFName('');
    setFKcal('');
    setFSugar('');
    setFFat('');
  }

  function openEdit(meal: Meal) {
    setEditing(meal);
    setFSlot(meal.slot);
    setFName(meal.name);
    setFKcal(meal.kcal ? String(meal.kcal) : '');
    setFSugar(meal.sugarG ? String(meal.sugarG) : '');
    setFFat(meal.fatG ? String(meal.fatG) : '');
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    const name = fName.trim();
    if (!name) return;
    setBusy(true);
    const data = {
      slot: fSlot,
      name,
      kcal: Math.round(parseDecimal(fKcal)),
      sugarG: Math.round(parseDecimal(fSugar)),
      fatG: Math.round(parseDecimal(fFat)),
    };
    const next =
      editing === 'new'
        ? [...day.meals, { id: newMealId(), ...data }]
        : day.meals.map((m) => (m.id === editing.id ? { ...m, ...data } : m));
    await saveMeals(next);
    setBusy(false);
    setEditing(null);
  }

  async function handleDelete() {
    if (!editing || editing === 'new' || busy) return;
    setBusy(true);
    await saveMeals(day.meals.filter((m) => m.id !== editing.id));
    setBusy(false);
    setEditing(null);
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* ===== Ring kalori ===== */}
        <View style={styles.hero}>
          <DonutChart
            size={104}
            thickness={12}
            slices={[
              { value: Math.min(totals.kcal, kcalTarget), color: Color.FUN },
              {
                value: Math.max(kcalTarget - totals.kcal, 0),
                color: Color.MAIN,
              },
            ]}>
            <VixText heading="title" additionalStyle={styles.heroRing}>
              {totals.kcal}
            </VixText>
            <VixText heading="label" additionalStyle={styles.heroRingSub}>
              kkal
            </VixText>
          </DonutChart>
          <View style={styles.heroSide}>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              Target hari ini
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.heroValue}>
              {kcalTarget} kkal
            </VixText>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              {kcalLeft >= 0
                ? `Sisa ${kcalLeft} kkal 💪`
                : `Lewat ${-kcalLeft} kkal 😅`}
            </VixText>
          </View>
        </View>

        {/* ===== Dua batas yang paling penting ===== */}
        <LimitBar
          emoji="🍬"
          label="Gula tambahan"
          value={totals.sugarG}
          limit={SUGAR_LIMIT_G}
          hint={`ideal di bawah ${SUGAR_IDEAL_G} g`}
        />
        <LimitBar
          emoji="🧈"
          label="Lemak"
          value={totals.fatG}
          limit={fatLimit}
          hint="±30% dari kebutuhan kalori"
        />

        {/* ===== Daftar makan per waktu makan ===== */}
        {MEAL_SLOTS.map((slot) => {
          const list = grouped[slot.key];
          const slotKcal = list.reduce((s, m) => s + m.kcal, 0);
          return (
            <View key={slot.key} style={styles.slotCard}>
              <View style={styles.slotHead}>
                <VixText heading="bold" additionalStyle={styles.slotTitle}>
                  {slot.emoji} {slot.label}
                </VixText>
                <VixText heading="label">{slotKcal} kkal</VixText>
              </View>
              {list.map((m) => (
                <PressableScale
                  key={m.id}
                  style={styles.mealRow}
                  onPress={() => openEdit(m)}>
                  <View style={styles.mealMain}>
                    <VixText
                      heading="paragraph"
                      numberOfLines={1}
                      additionalStyle={styles.mealName}>
                      {m.name}
                    </VixText>
                    <VixText heading="label">
                      🍬 {m.sugarG} g · 🧈 {m.fatG} g
                    </VixText>
                  </View>
                  <VixText heading="bold" additionalStyle={styles.mealKcal}>
                    {m.kcal}
                  </VixText>
                </PressableScale>
              ))}
              <PressableScale
                style={styles.addRow}
                onPress={() => openAdd(slot.key)}>
                <IconSymbol name="plus" size={16} color={Color.MAIN} />
                <VixText heading="label" additionalStyle={styles.addText}>
                  Tambah {slot.label.toLowerCase()}
                </VixText>
              </PressableScale>
            </View>
          );
        })}

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        <VixText heading="label" additionalStyle={styles.footNote}>
          ℹ️ Angka diisi manual dari label kemasan atau perkiraan. Tidak harus
          presisi — yang penting sadar polanya.
        </VixText>
      </ScrollView>

      {/* ===== Sheet tambah / ubah makanan ===== */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Makanan' : 'Ubah Makanan'}
        subtitle={`${mealSlotMeta(fSlot).emoji} ${mealSlotMeta(fSlot).label}`}
        onClose={() => setEditing(null)}>
        <FormInput
          placeholder="Nama makanan / minuman"
          value={fName}
          onChangeText={setFName}
          autoFocus
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Waktu makan
        </VixText>
        <SelectField
          value={fSlot}
          options={MEAL_SLOTS.map((s) => ({
            key: s.key,
            label: `${s.emoji} ${s.label}`,
          }))}
          onChange={(v) => v && setFSlot(v)}
          disabled={busy}
        />

        <View style={styles.numberRow}>
          <View style={styles.numberBox}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              🔥 Kalori
            </VixText>
            <FormInput
              placeholder="kkal"
              keyboardType="decimal-pad"
              value={fKcal}
              onChangeText={setFKcal}
              editable={!busy}
            />
          </View>
          <View style={styles.numberBox}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              🍬 Gula
            </VixText>
            <FormInput
              placeholder="gram"
              keyboardType="decimal-pad"
              value={fSugar}
              onChangeText={setFSugar}
              editable={!busy}
            />
          </View>
          <View style={styles.numberBox}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              🧈 Lemak
            </VixText>
            <FormInput
              placeholder="gram"
              keyboardType="decimal-pad"
              value={fFat}
              onChangeText={setFFat}
              editable={!busy}
            />
          </View>
        </View>

        {editing && editing !== 'new' && (
          <InlineDelete
            key={editing.id}
            label="Hapus makanan ini"
            busy={busy}
            onDelete={handleDelete}
          />
        )}

        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>
    </View>
  );
}

// Bar batas harian (gula / lemak) — hijau → kuning saat ≥80% → merah kalau lewat.
function LimitBar({
  emoji,
  label,
  value,
  limit,
  hint,
}: {
  emoji: string;
  label: string;
  value: number;
  limit: number;
  hint: string;
}) {
  const tone = dietTone(value, limit);
  const percent = limit > 0 ? Math.min((value / limit) * 100, 100) : 0;
  const fill =
    tone === 'over'
      ? Color.DANGER
      : tone === 'warn'
        ? Color.BUDGET_WARN
        : Color.MAIN;
  return (
    <View style={styles.limitCard}>
      <View style={styles.limitTop}>
        <VixText heading="bold" additionalStyle={styles.limitLabel}>
          {emoji} {label}
        </VixText>
        <VixText
          heading="bold"
          additionalStyle={tone === 'over' ? styles.limitOver : undefined}>
          {value} / {limit} g
        </VixText>
      </View>
      <View style={styles.limitTrack}>
        <View
          style={[styles.limitFill, { width: `${percent}%`, backgroundColor: fill }]}
        />
      </View>
      <VixText heading="label" additionalStyle={styles.limitHint}>
        {hint}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  heroRing: { color: Color.TEXT_REVERSE },
  heroRingSub: { color: Color.TEXT_ON_DARK_MUTED },
  heroSide: { flex: 1, gap: 2 },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  limitCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 6,
    marginBottom: 10,
  },
  limitTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  limitLabel: { color: Color.TEXT_TITLE },
  limitOver: { color: Color.DANGER },
  limitTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  limitFill: { height: '100%', borderRadius: 4 },
  limitHint: { color: Color.TEXT_LABEL },
  slotCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 8,
    marginTop: 10,
  },
  slotHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  slotTitle: { color: Color.TEXT_TITLE },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mealMain: { flex: 1, gap: 1 },
  mealName: { color: Color.TEXT_TITLE },
  mealKcal: { color: Color.MAIN_DARK },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Color.MAIN_LIGHT,
  },
  addText: { color: Color.MAIN },
  error: { color: Color.DANGER, marginTop: 10 },
  footNote: { color: Color.TEXT_LABEL, marginTop: 14, textAlign: 'center' },
  fieldLabel: { marginTop: 12, marginBottom: 6 },
  numberRow: { flexDirection: 'row', gap: 8 },
  numberBox: { flex: 1 },
});
