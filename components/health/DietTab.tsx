import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { DonutChart } from '@/components/finance/DonutChart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  BREAKFAST_COMBOS,
  comboMeals,
  comboTotals,
  dietTone,
  dietTotals,
  fatLimitG,
  FOOD_GROUP_LABEL,
  FOOD_PRESETS,
  foodPreset,
  kcalGoal,
  KCAL_MODE_LABEL,
  MEAL_SLOTS,
  mealFromPreset,
  mealSlotMeta,
  mealsBySlot,
  newMealId,
  proteinTargetG,
  saveDietDay,
  SUGAR_IDEAL_G,
  SUGAR_LIMIT_G,
  type DietDay,
  type Meal,
  type MealCombo,
  type MealSlot,
} from '@/lib/diet';
import { formatDecimal, parseDecimal } from '@/lib/format';
import {
  ageFromBirthYear,
  WATER_GOAL,
  type HealthProfile,
  type WeightTarget,
} from '@/lib/health';
import { SAVE_ERROR } from '@/lib/messages';

// Sub-tab Diet 🥗 — "less sugar, less fat, cukup protein".
// Susunannya dari atas ke bawah = urutan yang paling sering dilihat:
//   1. Ring kalori + target yang sudah disesuaikan dengan target berat
//   2. Tiga takaran penting: protein (dikejar), gula & lemak (dibatasi)
//   3. Air putih — angka yang sama dengan yang di Home
//   4. Daftar makan per waktu makan + paket sarapan sekali ketuk
//   5. Panduan singkat
export function DietTab({
  day,
  dayId,
  profile,
  target,
  water,
  onChangeWater,
}: {
  day: DietDay;
  dayId: string;
  profile: HealthProfile;
  target: WeightTarget | null;
  water: number;
  onChangeWater: (delta: number) => void;
}) {
  const { user } = useAuth();

  const [editing, setEditing] = useState<Meal | 'new' | null>(null);
  const [fSlot, setFSlot] = useState<MealSlot>('sarapan');
  const [fPreset, setFPreset] = useState<string | null>(null);
  const [fQty, setFQty] = useState('1');
  const [fName, setFName] = useState('');
  const [fKcal, setFKcal] = useState('');
  const [fProtein, setFProtein] = useState('');
  const [fSugar, setFSugar] = useState('');
  const [fFat, setFFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = dietTotals(day);
  const goal = kcalGoal(profile, ageFromBirthYear(profile.birthYear), target);
  const protein = proteinTargetG(profile.weightKg);
  const fatLimit = fatLimitG(goal.kcal);
  const grouped = mealsBySlot(day);
  const kcalLeft = goal.kcal - totals.kcal;

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
    setFPreset(null);
    setFQty('1');
    setFName('');
    setFKcal('');
    setFProtein('');
    setFSugar('');
    setFFat('');
  }

  function openEdit(meal: Meal) {
    setEditing(meal);
    setFSlot(meal.slot);
    setFPreset(null);
    setFQty('1');
    setFName(meal.name);
    setFKcal(meal.kcal ? String(meal.kcal) : '');
    setFProtein(meal.proteinG ? String(meal.proteinG) : '');
    setFSugar(meal.sugarG ? String(meal.sugarG) : '');
    setFFat(meal.fatG ? String(meal.fatG) : '');
  }

  /** Pilih dari daftar makanan → semua angkanya terisi sendiri (× porsi). */
  function applyPreset(key: string | null, qtyText: string) {
    setFPreset(key);
    const preset = key ? foodPreset(key) : null;
    if (!preset) return;
    const m = mealFromPreset(preset, fSlot, parseDecimal(qtyText) || 1);
    setFName(m.name);
    setFKcal(String(m.kcal));
    setFProtein(String(m.proteinG));
    setFSugar(String(m.sugarG));
    setFFat(String(m.fatG));
  }

  /** Tambahkan seluruh isi satu paket sarapan sekaligus. */
  async function addCombo(combo: MealCombo) {
    if (busy) return;
    setBusy(true);
    await saveMeals([
      ...day.meals,
      ...comboMeals(combo).map((m) => ({ id: newMealId(), ...m })),
    ]);
    setBusy(false);
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
      proteinG: Math.round(parseDecimal(fProtein)),
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
        {/* ===== 1. Ring kalori ===== */}
        <View style={styles.hero}>
          <DonutChart
            size={104}
            thickness={12}
            slices={[
              { value: Math.min(totals.kcal, goal.kcal), color: Color.FUN },
              { value: Math.max(goal.kcal - totals.kcal, 0), color: Color.MAIN },
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
              {KCAL_MODE_LABEL[goal.mode]}
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.heroValue}>
              {goal.kcal} kkal
            </VixText>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              {kcalLeft >= 0
                ? `Sisa ${kcalLeft} kkal 💪`
                : `Lewat ${-kcalLeft} kkal 😅`}
            </VixText>
            {target && (
              <VixText heading="label" additionalStyle={styles.heroTarget}>
                🎯 {formatDecimal(profile.weightKg)} →{' '}
                {formatDecimal(target.targetWeightKg)} kg
              </VixText>
            )}
          </View>
        </View>

        {/* ===== 2. Tiga takaran penting ===== */}
        <GoalBar
          emoji="🥩"
          label="Protein"
          value={totals.proteinG}
          min={protein.min}
          max={protein.max}
          hint={`${formatDecimal(profile.weightKg)} kg × 1,6–2,0 g — ini yang menjaga ototmu`}
        />
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

        {/* ===== 3. Air putih — sumber angkanya sama dengan di Home ===== */}
        <View style={styles.waterCard}>
          <VixText heading="bold" additionalStyle={styles.waterLabel}>
            💧 Air putih {water}/{WATER_GOAL} gelas
          </VixText>
          <View style={styles.waterButtons}>
            <PressableScale
              style={styles.waterButton}
              onPress={() => onChangeWater(-1)}
              hitSlop={6}>
              <VixText heading="bold" additionalStyle={styles.waterButtonText}>
                −
              </VixText>
            </PressableScale>
            <PressableScale
              style={[styles.waterButton, styles.waterButtonPlus]}
              onPress={() => onChangeWater(1)}
              hitSlop={6}>
              <IconSymbol name="plus" size={16} color={Color.MAIN_DARK} />
            </PressableScale>
          </View>
        </View>

        {/* ===== 4. Daftar makan per waktu makan ===== */}
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

              {/* Paket sarapan sekali ketuk — hanya di kartu Sarapan */}
              {slot.key === 'sarapan' && list.length === 0 && (
                <View style={styles.comboBox}>
                  <VixText heading="label" additionalStyle={styles.comboHint}>
                    Sarapan tinggi gula → ganti Protein + Serat + Mikronutrien:
                  </VixText>
                  {BREAKFAST_COMBOS.map((c) => {
                    const t = comboTotals(c);
                    return (
                      <PressableScale
                        key={c.key}
                        style={styles.comboButton}
                        disabled={busy}
                        onPress={() => addCombo(c)}>
                        <VixText heading="bold" additionalStyle={styles.comboTitle}>
                          {c.emoji} {c.title}
                        </VixText>
                        <VixText heading="label" additionalStyle={styles.comboSub}>
                          {t.kcal} kkal · 🥩 {t.proteinG} g · 🍬 {t.sugarG} g
                        </VixText>
                      </PressableScale>
                    );
                  })}
                </View>
              )}

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
                      🥩 {m.proteinG} g · 🍬 {m.sugarG} g · 🧈 {m.fatG} g
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

        <FormError message={error} gap="none" additionalStyle={styles.error} />

        {/* ===== 5. Panduan singkat ===== */}
        <View style={styles.guideCard}>
          <VixText heading="bold" additionalStyle={styles.guideTitle}>
            📋 Pegangan Harian
          </VixText>
          {[
            `🥩 Protein ${protein.min}–${protein.max} g/hari — jangan sampai kurang, ini yang menjaga otot saat lemak turun.`,
            '📉 Jangan defisit terlalu agresif. Incar body recomposition: lemak turun pelan, otot tetap/naik.',
            '📏 Berat tidak banyak turun tapi lingkar pinggang mengecil & strength naik = tetap berhasil.',
            '🍬 Batasi gula tambahan & makanan ultra-proses — bukan dilarang, tapi dihitung.',
            '🥗 Tiap makan usahakan lengkap: sayur, buah, protein, whole grain, lemak sehat.',
          ].map((t) => (
            <VixText key={t} heading="label" additionalStyle={styles.guideText}>
              {t}
            </VixText>
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.footNote}>
          ℹ️ Angka gizi di daftar makanan itu PERKIRAAN untuk porsi yang
          tertulis. Semua tetap bisa diedit setelah dipilih.
        </VixText>
      </ScrollView>

      {/* ===== Sheet tambah / ubah makanan ===== */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Makanan' : 'Ubah Makanan'}
        subtitle={`${mealSlotMeta(fSlot).emoji} ${mealSlotMeta(fSlot).label}`}
        onClose={() => setEditing(null)}>
        {/* Pilih dari daftar → nama & semua angkanya terisi sendiri */}
        <VixText heading="label" additionalStyle={styles.fieldLabelTop}>
          ⚡ Pilih dari daftar makanan
        </VixText>
        <SelectField
          value={fPreset}
          options={FOOD_PRESETS.map((f) => ({
            key: f.key,
            label: `${f.emoji} ${f.name}`,
            sub: `${FOOD_GROUP_LABEL[f.group]} · ${f.portion} · ${f.kcal} kkal · 🥩 ${f.proteinG} g`,
          }))}
          onChange={(k) => applyPreset(k, fQty)}
          placeholder="Pilih makanan / minuman…"
          disabled={busy}
          clearable
        />

        <View style={styles.numberRow}>
          <View style={styles.qtyBox}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Porsi ×
            </VixText>
            <FormInput
              placeholder="1"
              keyboardType="decimal-pad"
              value={fQty}
              onChangeText={(t) => {
                setFQty(t);
                applyPreset(fPreset, t);
              }}
              editable={!busy}
            />
          </View>
          <View style={styles.nameBox}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Nama
            </VixText>
            <FormInput
              placeholder="Nama makanan / minuman"
              value={fName}
              onChangeText={setFName}
              editable={!busy}
            />
          </View>
        </View>

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
              🥩 Protein
            </VixText>
            <FormInput
              placeholder="gram"
              keyboardType="decimal-pad"
              value={fProtein}
              onChangeText={setFProtein}
              editable={!busy}
            />
          </View>
        </View>
        <View style={styles.numberRow}>
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

        <EditDelete
          editing={editing}
          label="Hapus makanan ini"
          busy={busy}
          onDelete={handleDelete}
        />

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

// Bar TARGET (protein): dikejar sampai minimal tercapai — hijau saat sudah
// masuk rentang, abu-abu selama masih kurang.
function GoalBar({
  emoji,
  label,
  value,
  min,
  max,
  hint,
}: {
  emoji: string;
  label: string;
  value: number;
  min: number;
  max: number;
  hint: string;
}) {
  const percent = min > 0 ? Math.min((value / min) * 100, 100) : 0;
  const reached = value >= min;
  return (
    <View style={styles.limitCard}>
      <View style={styles.limitTop}>
        <VixText heading="bold" additionalStyle={styles.limitLabel}>
          {emoji} {label}
        </VixText>
        <VixText
          heading="bold"
          additionalStyle={reached ? styles.goalReached : undefined}>
          {value} / {min}–{max} g
        </VixText>
      </View>
      <View style={styles.limitTrack}>
        <View
          style={[
            styles.limitFill,
            {
              width: `${percent}%`,
              backgroundColor: reached ? Color.MAIN : Color.MAIN_LIGHT,
            },
          ]}
        />
      </View>
      <VixText heading="label" additionalStyle={styles.limitHint}>
        {reached ? '✅ Target protein tercapai' : hint}
      </VixText>
    </View>
  );
}

// Bar BATAS (gula/lemak): hijau → kuning saat ≥80% → merah kalau lewat.
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
  heroTarget: { color: Color.MAIN_LIGHT, marginTop: 2 },
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
  goalReached: { color: Color.MAIN_DARK },
  limitTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  limitFill: { height: '100%', borderRadius: 4 },
  limitHint: { color: Color.TEXT_LABEL },
  // Air putih — bentuknya disamakan dengan baris air di kartu sapaan Home.
  waterCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  waterLabel: { color: Color.MAIN_LIGHT, flexShrink: 1 },
  waterButtons: { flexDirection: 'row', gap: 8 },
  waterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.MAIN_LIGHT,
  },
  waterButtonPlus: { backgroundColor: Color.ACCENT },
  waterButtonText: { color: Color.MAIN_DARK, fontSize: 18, lineHeight: 22 },
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
  // Paket sarapan siap pakai
  comboBox: { gap: 8 },
  comboHint: { color: Color.TEXT_LABEL },
  comboButton: {
    backgroundColor: Color.FUN,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.FUN_DARK,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 1,
  },
  comboTitle: { color: Color.TEXT_TITLE },
  comboSub: { color: Color.FUN_DARK },
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
  error: { marginTop: 10 },
  guideCard: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.MAIN_LIGHT,
    padding: 16,
    gap: 6,
    marginTop: 14,
  },
  guideTitle: { color: Color.MAIN_DARK },
  guideText: { color: Color.TEXT_PARAGRAPH },
  footNote: { color: Color.TEXT_LABEL, marginTop: 12, textAlign: 'center' },
  fieldLabelTop: { marginBottom: 6 },
  fieldLabel: { marginTop: 12, marginBottom: 6 },
  numberRow: { flexDirection: 'row', gap: 8 },
  numberBox: { flex: 1 },
  qtyBox: { width: 84 },
  nameBox: { flex: 1 },
});
