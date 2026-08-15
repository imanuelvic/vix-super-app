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
import { CheckCircle } from '@/components/common/CheckCircle';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  deleteFastingPlan,
  fastingDay,
  fastingDayIds,
  fastingProgress,
  newFastingId,
  saveFastingDay,
  saveFastingPlan,
  subscribeFastingPlans,
  type FastingDay,
  type FastingPlan,
} from '@/lib/fasting';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';

// Layar Puasa 🍽️ — satu periode puasa: keterangan (pokok doa, peraturan,
// tanggal mulai–selesai) + checklist hari per hari. Dibuat halaman penuh
// (bukan modal) karena isinya panjang dan tiap hari punya modal edit sendiri.
// Tanpa ?id= berarti membuat periode BARU.
export default function FastingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id: idParam } = useLocalSearchParams<{ id?: string }>();

  const [plans, setPlans] = useState<FastingPlan[] | null>(null);
  const [planId, setPlanId] = useState(
    typeof idParam === 'string' ? idParam : '',
  );
  const [loaded, setLoaded] = useState(false); // prefill form sekali saja

  // Keterangan periode.
  const [title, setTitle] = useState('');
  const [prayer, setPrayer] = useState('');
  const [rules, setRules] = useState('');
  const [answer, setAnswer] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hari yang sedang diedit di modal (null = tertutup).
  const [editDay, setEditDay] = useState<string | null>(null);
  const [dPrayer, setDPrayer] = useState('');
  const [dAnswer, setDAnswer] = useState('');
  const [dDone, setDDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeFastingPlans(user.uid, setPlans);
  }, [user]);

  const plan = plans?.find((p) => p.id === planId) ?? null;

  // Isi form dari data tersimpan — sekali saja, biar ketikan tak tertimpa.
  useEffect(() => {
    if (!plan || loaded) return;
    setTitle(plan.title);
    setPrayer(plan.prayer);
    setRules(plan.rules);
    setAnswer(plan.answer);
    if (plan.startId) setStartDate(dayIdToDate(plan.startId));
    if (plan.endId) setEndDate(dayIdToDate(plan.endId));
    setLoaded(true);
  }, [plan, loaded]);

  const todayId = dayDocId(new Date());
  // Daftar hari mengikuti tanggal DI FORM, jadi langsung berubah saat tanggal
  // digeser — walaupun belum ditekan Simpan.
  const dayIds = fastingDayIds(dayDocId(startDate), dayDocId(endDate));
  const progress = plan ? fastingProgress(plan) : { done: 0, total: 0 };

  async function handleSaveInfo() {
    if (!user || busy) return;
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
      setLoaded(true);
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

  function openDay(dayId: string) {
    if (!plan) return;
    const d = fastingDay(plan, dayId);
    setEditDay(dayId);
    setDPrayer(d.prayer);
    setDAnswer(d.answer);
    setDDone(d.done);
  }

  async function saveDay(dayId: string, next: FastingDay) {
    if (!user || !planId) return;
    setError(null);
    try {
      await saveFastingDay(user.uid, planId, dayId, next);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  // Centang langsung dari kartu — 1 tulis, tanpa buka modal.
  function toggleDay(dayId: string) {
    if (!plan) return;
    const d = fastingDay(plan, dayId);
    saveDay(dayId, { ...d, done: !d.done });
  }

  async function handleSaveDay() {
    if (!editDay || busy) return;
    setBusy(true);
    await saveDay(editDay, {
      prayer: dPrayer.trim(),
      answer: dAnswer.trim(),
      done: dDone,
    });
    setBusy(false);
    setEditDay(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Spiritual"
        title={planId ? 'Edit Puasa 🍽️' : 'Puasa Baru 🍽️'}
        subtitle="Pokok doa, peraturan & catatan hari per hari"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          {/* ===== Keterangan periode puasa ===== */}
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Nama puasa
          </VixText>
          <FormInput
            placeholder="mis. Puasa Daniel 7 Hari"
            value={title}
            onChangeText={setTitle}
            editable={!busy}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            🙏 Pokok doa utama
          </VixText>
          <FormInput
            placeholder="Apa yang kamu doakan sepanjang puasa ini?"
            value={prayer}
            onChangeText={setPrayer}
            editable={!busy}
            multiline
            style={styles.textArea}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            📜 Peraturan puasa saya
          </VixText>
          <FormInput
            placeholder="mis. makan hanya jam 18.00–20.00, tanpa daging & gula"
            value={rules}
            onChangeText={setRules}
            editable={!busy}
            multiline
            style={styles.textArea}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Mulai puasa
          </VixText>
          <DateField value={startDate} onChange={setStartDate} />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Selesai puasa
          </VixText>
          <DateField value={endDate} onChange={setEndDate} />

          {error && (
            <VixText heading="label" additionalStyle={styles.error}>
              {error}
            </VixText>
          )}

          <PrimaryButton
            label={planId ? '💾 Simpan Perubahan' : '✅ Mulai Puasa'}
            busy={busy}
            onPress={handleSaveInfo}
            additionalStyle={styles.saveButton}
          />

          {/* ===== Checklist hari per hari (setelah periode tersimpan) ===== */}
          {plan ? (
            <>
              <View style={styles.progressCard}>
                <VixText heading="label" additionalStyle={styles.progressLabel}>
                  🍽️ Puasa berhasil
                </VixText>
                <VixText
                  heading="subheader"
                  additionalStyle={styles.progressValue}>
                  {progress.done}{' '}
                  <VixText heading="label" additionalStyle={styles.progressLabel}>
                    dari {progress.total} hari
                  </VixText>
                </VixText>
              </View>

              <VixText heading="title" additionalStyle={styles.sectionTitle}>
                📆 Hari per Hari
              </VixText>
              <VixText heading="label" additionalStyle={styles.sectionHint}>
                Ketuk lingkaran kalau hari itu berhasil, ketuk kartunya untuk
                menulis pokok doa & jawaban doa hari itu.
              </VixText>

              {dayIds.map((dayId, i) => {
                const d = fastingDay(plan, dayId);
                const isToday = dayId === todayId;
                return (
                  <View
                    key={dayId}
                    style={[styles.dayCard, isToday && styles.dayCardToday]}>
                    <PressableScale
                      onPress={() => toggleDay(dayId)}
                      hitSlop={8}>
                      <CheckCircle checked={d.done} size={26} />
                    </PressableScale>
                    <PressableScale
                      style={styles.dayMain}
                      onPress={() => openDay(dayId)}>
                      <VixText heading="bold" additionalStyle={styles.dayTitle}>
                        Hari ke-{i + 1}
                        {isToday ? ' · hari ini' : ''}
                      </VixText>
                      <VixText heading="label" additionalStyle={styles.dayDate}>
                        {formatFullDate(dayIdToDate(dayId))}
                      </VixText>
                      {d.prayer ? (
                        <VixText
                          heading="label"
                          numberOfLines={2}
                          additionalStyle={styles.dayPrayer}>
                          🙏 {d.prayer}
                        </VixText>
                      ) : null}
                      {d.answer ? (
                        <VixText
                          heading="label"
                          numberOfLines={2}
                          additionalStyle={styles.dayAnswer}>
                          ✨ {d.answer}
                        </VixText>
                      ) : null}
                    </PressableScale>
                  </View>
                );
              })}

              {/* ===== Hasil keseluruhan ===== */}
              <VixText heading="title" additionalStyle={styles.sectionTitle}>
                ✨ Jawaban Doa
              </VixText>
              <FormInput
                placeholder="Apa yang Tuhan kerjakan lewat puasa ini?"
                value={answer}
                onChangeText={setAnswer}
                editable={!busy}
                multiline
                style={styles.textArea}
              />
              <PrimaryButton
                label="💾 Simpan Jawaban Doa"
                busy={busy}
                onPress={handleSaveInfo}
                additionalStyle={styles.saveButton}
              />

              <InlineDelete
                label="Hapus puasa ini…"
                busy={busy}
                onDelete={handleDeletePlan}
              />
            </>
          ) : (
            <VixText heading="label" additionalStyle={styles.hint}>
              Simpan dulu keterangannya — daftar hari per hari muncul otomatis
              sesuai tanggal mulai & selesai 📆
            </VixText>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal catatan satu hari puasa */}
      <SheetModal
        visible={editDay !== null}
        title={
          editDay && plan
            ? `Hari ke-${dayIds.indexOf(editDay) + 1} 🍽️`
            : 'Catatan Hari Ini 🍽️'
        }
        subtitle={editDay ? formatFullDate(dayIdToDate(editDay)) : undefined}
        onClose={() => setEditDay(null)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={busy}
            onCancel={() => setEditDay(null)}
            onConfirm={handleSaveDay}
          />
        }>
        {/* Berhasil / gagal hari itu */}
        <PressableScale
          style={styles.doneRow}
          onPress={() => setDDone((v) => !v)}>
          <CheckCircle checked={dDone} size={26} />
          <VixText heading="bold" additionalStyle={styles.doneText}>
            {dDone ? '✅ Berhasil puasa hari ini' : '❌ Belum / gagal hari ini'}
          </VixText>
        </PressableScale>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🙏 Pokok doa hari ini
        </VixText>
        <FormInput
          placeholder="Yang khusus didoakan hari ini"
          value={dPrayer}
          onChangeText={setDPrayer}
          editable={!busy}
          multiline
          style={styles.textArea}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          ✨ Jawaban doa hari ini
        </VixText>
        <FormInput
          placeholder="Apa yang terjadi / Tuhan jawab hari ini?"
          value={dAnswer}
          onChangeText={setDAnswer}
          editable={!busy}
          multiline
          style={styles.textArea}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  fieldLabel: { marginTop: 12, marginBottom: 6 },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
  error: { color: Color.DANGER, marginTop: 10 },
  saveButton: { marginTop: 14 },
  hint: { marginTop: 16, textAlign: 'center' },
  progressCard: {
    backgroundColor: Color.SPIRITUAL_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 2,
    marginTop: 18,
  },
  progressLabel: { color: Color.TEXT_ON_DARK_MUTED },
  progressValue: { color: Color.TEXT_REVERSE },
  sectionTitle: { marginTop: 18, marginBottom: 4 },
  sectionHint: { marginBottom: 10 },
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  dayCardToday: { borderColor: Color.SPIRITUAL_DARK, borderWidth: 1.5 },
  dayMain: { flex: 1, gap: 2 },
  dayTitle: { color: Color.TEXT_TITLE },
  dayDate: { color: Color.TEXT_LABEL },
  dayPrayer: { color: Color.SPIRITUAL_DARK },
  dayAnswer: { color: Color.MAIN_DARK },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneText: { color: Color.TEXT_TITLE },
});
