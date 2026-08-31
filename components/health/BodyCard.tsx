import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type KeyboardTypeOptions } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatDecimal, formatFullDate, groupDigits, parseDecimal } from '@/lib/format';
import {
  ageFromBirthYear,
  BLOOD_TYPES,
  bmiCategory,
  bmiValue,
  bmrMale,
  bodyAdvice,
  bodyFatCategory,
  bodyFatMale,
  idealWeightRange,
  saveHealthProfile,
  waistHipRatio,
  type HealthProfile,
} from '@/lib/health';
import { SAVE_ERROR } from '@/lib/messages';

// Kartu Data Tubuh 🧍 — dipindah dari Health ke tab Profile karena isinya
// data diri yang jarang berubah (bukan aktivitas harian). Berat badan tetap
// jadi SATU sumber untuk Fitness & target berat.
//
// Kolom ukuran (angka, semua opsional kecuali tinggi & berat).
const SIZE_FIELDS: {
  key: 'waistCm' | 'neckCm' | 'hipCm' | 'chestCm' | 'armCm' | 'thighCm';
  label: string;
}[] = [
  { key: 'waistCm', label: 'Lingkar perut (cm)' },
  { key: 'neckCm', label: 'Lingkar leher (cm)' },
  { key: 'hipCm', label: 'Lingkar pinggang/pinggul (cm)' },
  { key: 'chestCm', label: 'Lingkar dada (cm)' },
  { key: 'armCm', label: 'Lingkar lengan atas (cm)' },
  { key: 'thighCm', label: 'Lingkar paha (cm)' },
];

export function BodyCard({ profile }: { profile: HealthProfile }) {
  const { user } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [fBirthYear, setFBirthYear] = useState('');
  const [fHeight, setFHeight] = useState('');
  const [fWeight, setFWeight] = useState('');
  const [fSizes, setFSizes] = useState<Record<string, string>>({});
  const [fBlood, setFBlood] = useState<string | null>(null);
  const [fEyeL, setFEyeL] = useState('');
  const [fEyeR, setFEyeR] = useState('');
  const [fCylL, setFCylL] = useState('');
  const [fCylR, setFCylR] = useState('');
  const [fShirt, setFShirt] = useState('');
  const [fPants, setFPants] = useState('');
  const [fShoe, setFShoe] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const age = ageFromBirthYear(profile.birthYear);
  const bmi = bmiValue(profile.weightKg, profile.heightCm);
  const cat = bmiCategory(bmi);
  const bmr = bmrMale(profile.weightKg, profile.heightCm, age);
  const ideal = idealWeightRange(profile.heightCm);
  const whtr = profile.waistCm ? profile.waistCm / profile.heightCm : null;
  const whr = waistHipRatio(profile.waistCm, profile.hipCm);
  const fat = bodyFatMale(profile.waistCm, profile.neckCm, profile.heightCm);
  const fatCat = fat != null ? bodyFatCategory(fat) : null;
  const advice = bodyAdvice(profile, age);

  function openEdit() {
    setFBirthYear(String(profile.birthYear));
    setFHeight(String(profile.heightCm));
    setFWeight(String(profile.weightKg));
    const sizes: Record<string, string> = {};
    for (const f of SIZE_FIELDS) {
      const v = profile[f.key];
      sizes[f.key] = v != null ? String(v) : '';
    }
    setFSizes(sizes);
    setFBlood(profile.bloodType);
    setFEyeL(profile.eyeLeft != null ? String(profile.eyeLeft) : '');
    setFEyeR(profile.eyeRight != null ? String(profile.eyeRight) : '');
    setFCylL(profile.eyeCylLeft != null ? String(profile.eyeCylLeft) : '');
    setFCylR(profile.eyeCylRight != null ? String(profile.eyeCylRight) : '');
    setFShirt(profile.shirtSize ?? '');
    setFPants(profile.pantsSize ?? '');
    setFShoe(profile.shoeSize != null ? String(profile.shoeSize) : '');
    setFormError(null);
    setEditOpen(true);
  }

  // Reminder timbang berat dari Home (?weighIn=1) → buka editor sekali.
  const { weighIn } = useLocalSearchParams<{ weighIn?: string }>();
  const weighInOpened = useRef(false);
  useEffect(() => {
    if (weighIn === '1' && !weighInOpened.current) {
      weighInOpened.current = true;
      openEdit();
    }
    // openEdit stabil secara fungsional; cukup bereaksi pada param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weighIn]);

  async function handleSave() {
    if (!user || saving) return;
    const birthYear = Math.round(parseDecimal(fBirthYear));
    const heightCm = parseDecimal(fHeight);
    const weightKg = parseDecimal(fWeight);
    if (birthYear < 1900 || birthYear > new Date().getFullYear()) {
      setFormError('Tahun lahir tidak valid.');
      return;
    }
    if (heightCm <= 0 || weightKg <= 0) {
      setFormError('Tinggi dan berat wajib diisi.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const sizes = Object.fromEntries(
      SIZE_FIELDS.map((f) => [
        f.key,
        fSizes[f.key]?.trim() ? parseDecimal(fSizes[f.key]) : null,
      ]),
    );
    try {
      await saveHealthProfile(user.uid, {
        birthYear,
        heightCm,
        weightKg,
        ...sizes,
        bloodType: fBlood,
        eyeLeft: fEyeL.trim() ? parseDecimal(fEyeL) : null,
        eyeRight: fEyeR.trim() ? parseDecimal(fEyeR) : null,
        eyeCylLeft: fCylL.trim() ? parseDecimal(fCylL) : null,
        eyeCylRight: fCylR.trim() ? parseDecimal(fCylR) : null,
        shirtSize: fShirt.trim() || null,
        pantsSize: fPants.trim() || null,
        shoeSize: fShoe.trim() ? parseDecimal(fShoe) : null,
      });
      setEditOpen(false);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <VixText heading="title">🧍 Data Tubuh</VixText>
          <PressableScale onPress={openEdit} hitSlop={10}>
            <VixText heading="bold" additionalStyle={styles.editText}>
              Ubah
            </VixText>
          </PressableScale>
        </View>
        <VixText heading="label" additionalStyle={styles.updatedText}>
          Diperbarui:{' '}
          {profile.updatedAt
            ? formatFullDate(profile.updatedAt.toDate())
            : 'belum pernah'}
        </VixText>

        <Row label="Umur" value={`${age} tahun`} />
        <Row label="Tinggi" value={`${profile.heightCm} cm`} />
        <Row label="Berat" value={`${profile.weightKg} kg`} />
        <Row
          label="Berat ideal"
          value={`${formatDecimal(ideal.min)}–${formatDecimal(ideal.max)} kg`}
        />
        <View style={styles.row}>
          <VixText heading="label">BMI</VixText>
          <VixText heading="bold" additionalStyle={toneStyle(cat.tone)}>
            {formatDecimal(bmi)} · {cat.label}
          </VixText>
        </View>
        {fat != null && fatCat && (
          <View style={styles.row}>
            <VixText heading="label">Lemak tubuh (perkiraan)</VixText>
            <VixText heading="bold" additionalStyle={toneStyle(fatCat.tone)}>
              {formatDecimal(fat)}% · {fatCat.label}
            </VixText>
          </View>
        )}
        {whtr != null && (
          <View style={styles.row}>
            <VixText heading="label">Rasio perut/tinggi</VixText>
            <VixText
              heading="bold"
              additionalStyle={whtr < 0.5 ? styles.ok : styles.warn}>
              {whtr.toFixed(2).replace('.', ',')} ·{' '}
              {whtr < 0.5 ? 'Sehat' : 'Perhatian'}
            </VixText>
          </View>
        )}
        {whr != null && (
          <View style={styles.row}>
            <VixText heading="label">Rasio perut/pinggul</VixText>
            <VixText
              heading="bold"
              additionalStyle={whr < 0.9 ? styles.ok : styles.warn}>
              {whr.toFixed(2).replace('.', ',')} ·{' '}
              {whr < 0.9 ? 'Sehat' : 'Perhatian'}
            </VixText>
          </View>
        )}
        <Row
          label="Kalori basal (BMR)"
          value={`±${groupDigits(String(Math.round(bmr)))} kkal/hari`}
        />

        {/* Ukuran badan — untuk melihat perubahan bentuk, bukan cuma berat */}
        {SIZE_FIELDS.map((f) => (
          <Row
            key={f.key}
            label={f.label.replace(' (cm)', '')}
            value={profile[f.key] != null ? `${profile[f.key]} cm` : 'belum diisi'}
          />
        ))}
        <Row label="Gol. darah" value={profile.bloodType ?? 'belum diisi'} />
        <Row
          label="Minus mata (L/R)"
          value={pairText(profile.eyeLeft, profile.eyeRight)}
        />
        <Row
          label="Silinder mata (L/R)"
          value={pairText(profile.eyeCylLeft, profile.eyeCylRight)}
        />
        <Row label="Ukuran baju" value={profile.shirtSize || 'belum diisi'} />
        <Row label="Ukuran celana" value={profile.pantsSize || 'belum diisi'} />
        <Row
          label="Ukuran sepatu"
          value={profile.shoeSize != null ? String(profile.shoeSize) : 'belum diisi'}
        />

        <VixText heading="label" additionalStyle={styles.hint}>
          BMI ambang Asia-Pasifik (normal 18,5–22,9) · rasio perut/tinggi sehat
          {' < '}0,50 · lemak tubuh dihitung metode US Navy (perkiraan).
        </VixText>
      </View>

      {/* ===== Saran supaya badan makin sehat & mendekati ideal ===== */}
      <View style={styles.adviceCard}>
        <VixText heading="title" additionalStyle={styles.adviceTitle}>
          🎯 Menuju Badan Ideal
        </VixText>
        {advice.map((a) => (
          <VixText key={a} heading="label" additionalStyle={styles.adviceText}>
            {a}
          </VixText>
        ))}
      </View>

      {/* Modal ubah data tubuh */}
      <SheetModal
        visible={editOpen}
        title="Ubah Data Tubuh 🧍"
        subtitle="Kosongkan yang belum diukur — tidak wajib semua"
        onClose={() => setEditOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={saving}
            onCancel={() => setEditOpen(false)}
            onConfirm={handleSave}
          />
        }>
        <Field label="Tahun lahir" keyboard="number-pad" value={fBirthYear} onChange={setFBirthYear} disabled={saving} />
        <Field label="Tinggi (cm)" value={fHeight} onChange={setFHeight} disabled={saving} />
        <Field label="Berat (kg)" value={fWeight} onChange={setFWeight} disabled={saving} />

        <VixText heading="bold" additionalStyle={styles.section}>
          📏 Ukuran Badan
        </VixText>
        {SIZE_FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            value={fSizes[f.key] ?? ''}
            onChange={(t) => setFSizes((prev) => ({ ...prev, [f.key]: t }))}
            disabled={saving}
          />
        ))}

        <VixText heading="bold" additionalStyle={styles.section}>
          👕 Ukuran Pakaian
        </VixText>
        <Field label="Ukuran baju" keyboard="default" value={fShirt} onChange={setFShirt} disabled={saving} />
        <Field label="Ukuran celana" keyboard="default" value={fPants} onChange={setFPants} disabled={saving} />
        <Field label="Ukuran sepatu (EU)" value={fShoe} onChange={setFShoe} disabled={saving} />

        <VixText heading="bold" additionalStyle={styles.section}>
          🩸 Lain-lain
        </VixText>
        <VixText heading="label">Golongan darah</VixText>
        <View style={styles.bloodRow}>
          {BLOOD_TYPES.map((b) => (
            <Chip
              key={b}
              label={b}
              active={fBlood === b}
              onPress={() => setFBlood(fBlood === b ? null : b)}
              additionalStyle={styles.bloodChip}
            />
          ))}
        </View>
        <VixText heading="label">Minus mata (kiri / kanan)</VixText>
        <View style={styles.pairRow}>
          <FormInput style={styles.pairInput} placeholder="Minus kiri" keyboardType="decimal-pad" value={fEyeL} onChangeText={setFEyeL} editable={!saving} />
          <FormInput style={styles.pairInput} placeholder="Minus kanan" keyboardType="decimal-pad" value={fEyeR} onChangeText={setFEyeR} editable={!saving} />
        </View>
        <VixText heading="label">Silinder mata (kiri / kanan)</VixText>
        <View style={styles.pairRow}>
          <FormInput style={styles.pairInput} placeholder="Silinder kiri" keyboardType="decimal-pad" value={fCylL} onChangeText={setFCylL} editable={!saving} />
          <FormInput style={styles.pairInput} placeholder="Silinder kanan" keyboardType="decimal-pad" value={fCylR} onChangeText={setFCylR} editable={!saving} />
        </View>

        <FormError message={formError} gap="none" additionalStyle={styles.error} />
      </SheetModal>
    </>
  );
}

// Satu kolom berlabel di modal (default keyboard angka desimal).
function Field({
  label,
  value,
  onChange,
  disabled,
  keyboard = 'decimal-pad',
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
  keyboard?: KeyboardTypeOptions;
}) {
  return (
    <>
      <VixText heading="label">{label}</VixText>
      <FormInput
        style={styles.input}
        keyboardType={keyboard}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
      />
    </>
  );
}

// Baris label–nilai di kartu.
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <VixText heading="label">{label}</VixText>
      <VixText heading="bold" additionalStyle={styles.value}>
        {value}
      </VixText>
    </View>
  );
}

/** "2,5 / 3,8" — pasangan kiri/kanan, "belum diisi" kalau dua-duanya kosong. */
function pairText(left?: number | null, right?: number | null): string {
  if (left == null && right == null) return 'belum diisi';
  const one = (n?: number | null) => (n != null ? formatDecimal(n) : '–');
  return `${one(left)} / ${one(right)}`;
}

function toneStyle(tone: 'ok' | 'warn' | 'danger') {
  return tone === 'ok' ? styles.ok : tone === 'warn' ? styles.warn : styles.danger;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  editText: { color: Color.MAIN },
  updatedText: { color: Color.TEXT_PLACEHOLDER, marginTop: 4, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  value: { color: Color.TEXT_TITLE, flexShrink: 1, textAlign: 'right' },
  ok: { color: Color.SUCCESS },
  warn: { color: Color.WARNING },
  danger: { color: Color.DANGER },
  hint: { marginTop: 8 },
  adviceCard: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.MAIN_LIGHT,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  adviceTitle: { color: Color.MAIN_DARK, marginBottom: 2 },
  adviceText: { color: Color.TEXT_PARAGRAPH },
  // Modal
  input: { marginBottom: 10, marginTop: 4 },
  section: { color: Color.MAIN_DARK, marginTop: 6, marginBottom: 8 },
  bloodRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 10 },
  bloodChip: { flex: 1 },
  pairRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 10 },
  pairInput: { flex: 1 },
  error: { marginTop: 4 },
});
