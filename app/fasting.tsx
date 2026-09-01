import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ACTION_TOP } from '@/assets/style/space';
import { DateField } from '@/components/common/DateField';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useDraft } from '@/hooks/useDraft';
import {
  deleteFastingPlan,
  FASTING_GRACE_DAYS,
  fastingLockDaysLeft,
  fastingLocked,
  fastingProgress,
  newFastingId,
  saveFastingPlan,
  subscribeFastingPlans,
  type FastingPlan,
} from '@/lib/fasting';
import { dayIdToDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';

// Layar Puasa 🍽️ — MENGATUR satu periode puasa: pokok doa, peraturan, tanggal
// mulai–selesai, dan jawaban doanya. Checklist hariannya punya layar sendiri
// (/fasting-days) — yang ditulis sekali dan yang dibuka tiap malam memang dua
// urusan berbeda. Tanpa ?id= berarti membuat periode BARU.
export default function FastingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // ?id=<puasa> membuka periode tertentu.
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();

  const [plans, setPlans] = useState<FastingPlan[] | null>(null);
  const [planId, setPlanId] = useState(
    typeof idParam === 'string' ? idParam : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeFastingPlans(user.uid, setPlans);
  }, [user]);

  const plan = plans?.find((p) => p.id === planId) ?? null;

  // Keterangan periode. Isinya ikut data tersimpan SELAMA belum diketik —
  // begitu diketik, ketikan itu yang menang (snapshot berikutnya tidak
  // menimpanya). Hook bersama useDraft; dulu satu bendera `loaded` + satu efek
  // besar yang mengisi keenam kolom sekaligus.
  const [today] = useState(() => new Date());
  const [title, setTitle] = useDraft(plan?.title ?? '');
  const [prayer, setPrayer] = useDraft(plan?.prayer ?? '');
  const [rules, setRules] = useDraft(plan?.rules ?? '');
  const [answer, setAnswer] = useDraft(plan?.answer ?? '');
  const [startDate, setStartDate] = useDraft(
    plan?.startId ? dayIdToDate(plan.startId) : today,
  );
  const [endDate, setEndDate] = useDraft(
    plan?.endId ? dayIdToDate(plan.endId) : today,
  );

  const progress = plan ? fastingProgress(plan) : { done: 0, total: 0 };
  // Lewat masa tenggang → catatannya baca-saja SELAMANYA (lihat lib/fasting.ts).
  const terkunci = plan ? fastingLocked(plan, today) : false;
  const sisaKunci = plan ? fastingLockDaysLeft(plan, today) : null;

  async function handleSaveInfo() {
    if (!user || busy || terkunci) return;
    if (!title.trim()) {
      setError('Isi nama puasanya dulu.');
      return;
    }
    if (endDate < startDate) {
      setError('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }
    const id = planId || newFastingId();
    setBusy(true);
    setError(null);
    try {
      await saveFastingPlan(user.uid, id, {
        title: title.trim(),
        prayer: prayer.trim(),
        rules: rules.trim(),
        answer: answer.trim(),
        startId: dayDocId(startDate),
        endId: dayDocId(endDate),
      });
      setPlanId(id);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePlan() {
    if (!user || !planId || busy) return;
    setBusy(true);
    try {
      await deleteFastingPlan(user.uid, planId);
      router.back();
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Spiritual"
        title={
          terkunci ? 'Puasa 🍽️' : planId ? 'Edit Puasa 🍽️' : 'Puasa Baru 🍽️'
        }
        subtitle={
          terkunci
            ? '🔒 Sudah dikunci — tinggal dibaca'
            : 'Pokok doa, peraturan & jawaban doa'
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* ===== Keterangan periode puasa ===== */}
          {/* Label PERTAMA tanpa marginTop — jarak ke subjudul layar sudah
              dipegang header + paddingTop daftar. Dengan marginTop-nya, kolom
              pertama menggantung jauh dari judulnya. */}
          <VixText
            heading="label"
            additionalStyle={[styles.fieldLabel, styles.firstLabel]}>
            Nama puasa
          </VixText>
          <FormInput
            placeholder="Nama Puasa"
            value={title}
            onChangeText={setTitle}
            editable={!busy && !terkunci}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            🙏 Pokok doa utama
          </VixText>
          <FormInput
            placeholder="Apa yang kamu doakan sepanjang puasa ini?"
            value={prayer}
            onChangeText={setPrayer}
            editable={!busy && !terkunci}
            multiline
            style={styles.textArea}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            📜 Peraturan puasa saya
          </VixText>
          <FormInput
            placeholder="mis. makan hanya jam 18.00–20.00"
            value={rules}
            onChangeText={setRules}
            editable={!busy && !terkunci}
            multiline
            style={styles.textArea}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Mulai puasa
          </VixText>
          <DateField
            value={startDate}
            onChange={setStartDate}
            disabled={terkunci}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Selesai puasa
          </VixText>
          <DateField
            value={endDate}
            onChange={setEndDate}
            disabled={terkunci}
          />

          <FormError message={error} gap="none" additionalStyle={styles.error} />

          {/* Terkunci → tombol simpannya HILANG, bukan sekadar mati: tombol
              mati yang tetap terpampang cuma mengundang ditekan berulang. */}
          {terkunci ? (
            <VixText heading="label" additionalStyle={styles.locked}>
              🔒 Puasa ini sudah selesai lebih dari {FASTING_GRACE_DAYS} hari
              lalu, jadi catatannya dikunci — tinggal dibaca.
            </VixText>
          ) : (
            <PrimaryButton
              label={planId ? '💾 Simpan Perubahan' : '✅ Mulai Puasa'}
              busy={busy}
              onPress={handleSaveInfo}
              additionalStyle={styles.saveButton}
            />
          )}

          {/* Peringatan sebelum terkunci — biar tidak kaget kehilangan akses. */}
          {sisaKunci !== null && (
            <VixText heading="label" additionalStyle={styles.locked}>
              ⏳ Bisa diubah{' '}
              {sisaKunci === 0 ? 'sampai hari ini saja' : `${sisaKunci} hari lagi`},
              sesudah itu dikunci selamanya.
            </VixText>
          )}

          {/* ===== Pintu ke checklist harian ===== */}
          {plan ? (
            <>
              <PressableScale
                style={styles.daysLink}
                onPress={() =>
                  router.push({
                    pathname: '/fasting-days',
                    params: { id: plan.id },
                  })
                }>
                <View style={styles.daysMain}>
                  <VixText heading="bold" additionalStyle={styles.daysTitle}>
                    📆 Lihat Hari per Hari
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.daysSub}>
                    🍽️ Puasa berhasil {progress.done} dari {progress.total} hari
                  </VixText>
                </View>
                <IconSymbol
                  name="chevron.right"
                  size={18}
                  color={Color.SPIRITUAL_DARK}
                />
              </PressableScale>

              {/* ===== Hasil keseluruhan ===== */}
              <VixText heading="title" additionalStyle={styles.sectionTitle}>
                ✨ Jawaban Doa
              </VixText>
              <FormInput
                placeholder="Apa yang Tuhan kerjakan lewat puasa ini?"
                value={answer}
                onChangeText={setAnswer}
                editable={!busy && !terkunci}
                multiline
                style={styles.textArea}
              />
              {!terkunci && (
                <PrimaryButton
                  label="💾 Simpan Jawaban Doa"
                  busy={busy}
                  onPress={handleSaveInfo}
                  additionalStyle={styles.saveButton}
                />
              )}

              {/* Hapus TETAP ada walau terkunci. Yang dikunci itu MENGUBAH
                  catatannya — mencentang hari yang dulu gagal jadi berhasil.
                  Membuang seluruh catatan yang salah masuk itu perkara lain,
                  dan tanpa ini catatan salah ketik tertinggal selamanya. */}
              <InlineDelete
                label="Hapus puasa ini…"
                busy={busy}
                onDelete={handleDeletePlan}
              />
            </>
          ) : (
            <VixText heading="label" additionalStyle={styles.hint}>
              Simpan maka daftar hari per hari muncul otomatis
              sesuai tanggal mulai & selesai 📆
            </VixText>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  flex: { flex: 1 },
  // paddingTop 4 = sama dengan layar berisian lain (mis. Template Chat).
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  fieldLabel: { marginTop: 12, marginBottom: 6 },
  firstLabel: { marginTop: 0 },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  error: { marginTop: 10 },
  // Jarak tombol aksi dari isian di atasnya — sama dengan layar Spiritual lain.
  saveButton: { marginTop: ACTION_TOP },
  hint: { marginTop: 16, textAlign: 'center' },
  locked: { color: Color.TEXT_LABEL, marginTop: ACTION_TOP },
  sectionTitle: { marginTop: 18, marginBottom: 4 },
  // Pintu ke checklist harian — kartu ungu muda, bentuk yang sama dengan
  // kartu "Sedang Puasa" di daftarnya.
  daysLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  daysMain: { flex: 1, gap: 2 },
  daysTitle: { color: Color.TEXT_TITLE },
  daysSub: { color: Color.SPIRITUAL_DARK },
});
