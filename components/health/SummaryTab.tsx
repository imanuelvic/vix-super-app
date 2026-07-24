import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { Chip } from '@/components/common/Chip';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  formatDecimal,
  formatFullDate,
  groupDigits,
  parseDecimal,
} from '@/lib/format';
import {
  ageFromBirthYear,
  BLOOD_TYPES,
  bmiCategory,
  bmiValue,
  bmrMale,
  dailyWaterLiters,
  saveHealthProfile,
  type HealthProfile,
} from '@/lib/health';
import {
  healthKitStatus,
  readTodaySummary,
  requestHealthAccess,
  type DailyHealthSummary,
} from '@/lib/healthkit';

/** Sapaan sesuai jam perangkat. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi ☀️';
  if (h < 15) return 'Selamat siang 🌤️';
  if (h < 19) return 'Selamat sore 🌇';
  return 'Selamat malam 🌙';
}

// Tab Summary: ringkasan harian dari Apple Health + data tubuh manual (BMI).
export function SummaryTab({ profile }: { profile: HealthProfile }) {
  const { user } = useAuth();

  // ---- Apple Health ----
  // Status tidak berubah selama app hidup, cukup dihitung sekali.
  const [hkStatus] = useState(() => healthKitStatus());
  const [hk, setHk] = useState<DailyHealthSummary | null>(null);
  const [hkBusy, setHkBusy] = useState(false);

  const loadHk = useCallback(async () => {
    setHkBusy(true);
    try {
      setHk(await readTodaySummary());
    } finally {
      setHkBusy(false);
    }
  }, []);

  useEffect(() => {
    // Kalau izin sudah pernah diberikan, data langsung tampil tanpa tombol.
    if (hkStatus === 'ok') loadHk();
  }, [hkStatus, loadHk]);

  async function handleConnect() {
    setHkBusy(true);
    await requestHealthAccess(); // memunculkan dialog izin iOS
    await loadHk();
  }

  // ---- Data tubuh ----
  const [editOpen, setEditOpen] = useState(false);
  const [fBirthYear, setFBirthYear] = useState('');
  const [fHeight, setFHeight] = useState('');
  const [fWeight, setFWeight] = useState('');
  const [fWaist, setFWaist] = useState('');
  const [fBlood, setFBlood] = useState<string | null>(null);
  const [fEyeL, setFEyeL] = useState('');
  const [fEyeR, setFEyeR] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const age = ageFromBirthYear(profile.birthYear);
  const bmi = bmiValue(profile.weightKg, profile.heightCm);
  const cat = bmiCategory(bmi);
  // Standar kesehatan yang dihitung otomatis dari data tubuh.
  const bmr = bmrMale(profile.weightKg, profile.heightCm, age);
  const waterL = dailyWaterLiters(profile.weightKg);
  const whtr = profile.waistCm ? profile.waistCm / profile.heightCm : null;

  function openEdit() {
    setFBirthYear(String(profile.birthYear));
    setFHeight(String(profile.heightCm));
    setFWeight(String(profile.weightKg));
    setFWaist(profile.waistCm ? String(profile.waistCm) : '');
    setFBlood(profile.bloodType);
    setFEyeL(profile.eyeLeft != null ? String(profile.eyeLeft) : '');
    setFEyeR(profile.eyeRight != null ? String(profile.eyeRight) : '');
    setFormError(null);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!user || saving) return;
    const birthYear = Math.round(parseDecimal(fBirthYear));
    const heightCm = parseDecimal(fHeight);
    const weightKg = parseDecimal(fWeight);
    const waistCm = fWaist.trim() ? parseDecimal(fWaist) : null;
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
    try {
      await saveHealthProfile(user.uid, {
        birthYear,
        heightCm,
        weightKg,
        waistCm,
        bloodType: fBlood,
        eyeLeft: fEyeL.trim() ? parseDecimal(fEyeL) : null,
        eyeRight: fEyeR.trim() ? parseDecimal(fEyeR) : null,
      });
      setEditOpen(false);
    } catch {
      setFormError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Sapaan personal + tanggal */}
      <View style={styles.greetingBlock}>
        <VixText heading="subheader" additionalStyle={styles.greetingText}>
          {greeting()}
        </VixText>
        <VixText heading="label">📆 {formatFullDate(new Date())}</VixText>
      </View>

      {/* ===== Apple Health ===== */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <VixText heading="title">🍎 Apple Health</VixText>
          {hkStatus === 'ok' && (
            <Pressable onPress={loadHk} hitSlop={10} disabled={hkBusy}>
              <IconSymbol
                name="arrow.triangle.2.circlepath"
                size={20}
                color={hkBusy ? Color.TEXT_PLACEHOLDER : Color.MAIN}
              />
            </Pressable>
          )}
        </View>

        {hkStatus === 'unsupported-platform' && (
          <VixText heading="label">
            Apple Health hanya tersedia di iPhone.
          </VixText>
        )}
        {hkStatus === 'needs-build' && (
          <VixText heading="label">
            Koneksi Apple Health aktif setelah app di-build lewat EAS (tidak
            tersedia di Expo Go).
          </VixText>
        )}

        {hkStatus === 'ok' && (
          <>
            <View style={styles.statRow}>
              <StatTile
                value={hk?.steps != null ? groupDigits(String(hk.steps)) : '–'}
                label="👣 Langkah"
              />
              <StatTile
                value={hk?.activeKcal != null ? groupDigits(String(hk.activeKcal)) : '–'}
                label="🔥 kkal Aktif"
              />
            </View>
            <Pressable
              style={[styles.connectButton, hkBusy && styles.busy]}
              onPress={handleConnect}
              disabled={hkBusy}>
              <VixText heading="bold" additionalStyle={styles.connectText}>
                Hubungkan Apple Health
              </VixText>
            </Pressable>
          </>
        )}
      </View>

      {/* ===== Data tubuh ===== */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <VixText heading="title">🧍 Data Tubuh</VixText>
          <Pressable onPress={openEdit} hitSlop={10}>
            <VixText heading="bold" additionalStyle={styles.editText}>
              Ubah
            </VixText>
          </Pressable>
        </View>

        <BodyRow label="Umur" value={`${age} tahun`} />
        <BodyRow label="Tinggi" value={`${profile.heightCm} cm`} />
        <BodyRow label="Berat" value={`${profile.weightKg} kg`} />
        <BodyRow
          label="Lingkar perut"
          value={profile.waistCm ? `${profile.waistCm} cm` : 'belum diisi'}
        />
        <BodyRow
          label="Gol. darah"
          value={profile.bloodType ?? 'belum diisi'}
        />
        <BodyRow
          label="Minus mata (L/R)"
          value={
            profile.eyeLeft != null || profile.eyeRight != null
              ? `${profile.eyeLeft != null ? formatDecimal(profile.eyeLeft) : '–'} / ${profile.eyeRight != null ? formatDecimal(profile.eyeRight) : '–'}`
              : 'belum diisi'
          }
        />
        <View style={styles.bodyRow}>
          <VixText heading="label">BMI</VixText>
          <VixText
            heading="bold"
            additionalStyle={
              cat.tone === 'ok'
                ? styles.bmiOk
                : cat.tone === 'warn'
                  ? styles.bmiWarn
                  : styles.bmiDanger
            }>
            {formatDecimal(bmi)} · {cat.label}
          </VixText>
        </View>
        {/* Standar kesehatan terhitung otomatis */}
        <BodyRow
          label="Kalori basal (BMR)"
          value={`±${groupDigits(String(Math.round(bmr)))} kkal/hari`}
        />
        <BodyRow
          label="Kebutuhan air"
          value={`±${formatDecimal(waterL)} L/hari`}
        />
        {whtr != null && (
          <View style={styles.bodyRow}>
            <VixText heading="label">Rasio pinggang/tinggi</VixText>
            <VixText
              heading="bold"
              additionalStyle={whtr < 0.5 ? styles.bmiOk : styles.bmiWarn}>
              {whtr.toFixed(2).replace('.', ',')} ·{' '}
              {whtr < 0.5 ? 'Sehat' : 'Perhatian'}
            </VixText>
          </View>
        )}
        <VixText heading="label" additionalStyle={styles.hint}>
          BMI ambang Asia-Pasifik (normal 18,5–22,9) · rasio pinggang/tinggi
          sehat {'<'} 0,50.
        </VixText>
        {/* Kapan terakhir data ini diperbarui */}
        <VixText heading="label" additionalStyle={styles.updatedText}>
          Diperbarui:{' '}
          {profile.updatedAt
            ? formatFullDate(profile.updatedAt.toDate())
            : 'belum pernah'}
        </VixText>
      </View>

      {/* Modal ubah data tubuh */}
      <CenterDialog visible={editOpen} onClose={() => setEditOpen(false)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          Ubah Data Tubuh
        </VixText>
        {/* Form makin panjang → digulir di dalam dialog */}
        <ScrollView
          style={styles.modalScroll}
          keyboardShouldPersistTaps="handled">
          <VixText heading="label">Tahun lahir</VixText>
          <FormInput
            style={styles.modalInput}
            keyboardType="number-pad"
            value={fBirthYear}
            onChangeText={setFBirthYear}
            editable={!saving}
          />
          <VixText heading="label">Tinggi (cm)</VixText>
          <FormInput
            style={styles.modalInput}
            keyboardType="decimal-pad"
            value={fHeight}
            onChangeText={setFHeight}
            editable={!saving}
          />
          <VixText heading="label">Berat (kg)</VixText>
          <FormInput
            style={styles.modalInput}
            keyboardType="decimal-pad"
            value={fWeight}
            onChangeText={setFWeight}
            editable={!saving}
          />
          <VixText heading="label">Lingkar perut</VixText>
          <FormInput
            style={styles.modalInput}
            keyboardType="decimal-pad"
            value={fWaist}
            onChangeText={setFWaist}
            editable={!saving}
          />
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
          <VixText heading="label">Minus mata</VixText>
          <View style={styles.eyeRow}>
            <FormInput
              style={styles.eyeInput}
              placeholder="Kiri"
              keyboardType="decimal-pad"
              value={fEyeL}
              onChangeText={setFEyeL}
              editable={!saving}
            />
            <FormInput
              style={styles.eyeInput}
              placeholder="Kanan"
              keyboardType="decimal-pad"
              value={fEyeR}
              onChangeText={setFEyeR}
              editable={!saving}
            />
          </View>
        </ScrollView>
        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={saving}
          onCancel={() => setEditOpen(false)}
          onConfirm={handleSave}
        />
      </CenterDialog>
    </ScrollView>
  );
}

// Kotak kecil satu angka statistik Apple Health.
function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <VixText heading="bold" additionalStyle={styles.statValue}>
        {value}
      </VixText>
      <VixText heading="label">{label}</VixText>
    </View>
  );
}

// Baris label–nilai di kartu Data Tubuh.
function BodyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.bodyRow}>
      <VixText heading="label">{label}</VixText>
      <VixText heading="bold" additionalStyle={styles.bodyValue}>
        {value}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  greetingBlock: { marginBottom: 12, gap: 2 },
  greetingText: { color: Color.MAIN_DARK },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statTile: {
    flex: 1,
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { color: Color.TEXT_TITLE },
  connectButton: {
    backgroundColor: Color.MAIN,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  busy: { opacity: 0.6 },
  connectText: { color: Color.TEXT_REVERSE },
  hint: { marginTop: 8 },
  updatedText: { color: Color.TEXT_PLACEHOLDER, marginTop: 4 },
  modalScroll: { maxHeight: 420 },
  bloodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  bloodChip: { flex: 1 },
  eyeRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 4 },
  eyeInput: { flex: 1 },
  editText: { color: Color.MAIN },
  bodyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  bodyValue: { color: Color.TEXT_TITLE },
  bmiOk: { color: Color.SUCCESS },
  bmiWarn: { color: Color.WARNING },
  bmiDanger: { color: Color.DANGER },
  modalTitle: { marginBottom: 10 },
  modalInput: { marginBottom: 10, marginTop: 4 },
  error: { color: Color.DANGER, marginTop: 4 },
});
