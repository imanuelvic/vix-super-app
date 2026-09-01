import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useDraft } from '@/hooks/useDraft';
import {
  EMPTY_FASTING_DAY as EMPTY_DAY,
  fastingDay,
  fastingDayIds,
  fastingLocked,
  fastingProgress,
  saveFastingDay,
  subscribeFastingPlans,
  type FastingDay,
  type FastingPlan,
} from '@/lib/fasting';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';

// Hari per Hari 🍽️ — checklist satu periode puasa, layarnya SENDIRI.
//
// Dulu menempel di bawah layar Edit Puasa. Dua hal yang berbeda tujuannya
// tertumpuk di satu halaman: keterangan puasa itu ditulis SEKALI di awal,
// sedangkan checklist hariannya dibuka tiap malam. Yang dibuka tiap hari
// jadi harus digulir melewati enam kolom isian dulu — dan tiap kali kamu ke
// sana, seluruh kolom keterangan ikut terpasang ulang.
//
// Sekarang dipisah: /fasting untuk MENGATUR, /fasting-days untuk MENJALANI.
export default function FastingDaysScreen() {
  const { user } = useAuth();
  // ?id=<puasa> wajib; ?day=<YYYY-MM-DD> sekalian membuka modal hari itu
  // (dipakai kartu 🍽️ malam di Home — lihat lib/fasting.ts).
  const { id: idParam, day: dayParam } = useLocalSearchParams<{
    id?: string;
    day?: string;
  }>();
  const planId = typeof idParam === 'string' ? idParam : '';

  const [plans, setPlans] = useState<FastingPlan[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeFastingPlans(
      user.uid,
      (next) => {
        setPlans(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user]);

  const plan = plans?.find((p) => p.id === planId) ?? null;
  const now = new Date();
  const todayId = dayDocId(now);
  const dayIds = plan ? fastingDayIds(plan.startId, plan.endId) : [];
  const progress = plan ? fastingProgress(plan) : { done: 0, total: 0 };
  // Sesudah masa tenggang, layar ini baca-saja SELAMANYA — centangnya mati,
  // modalnya tetap boleh dibuka untuk dibaca.
  const terkunci = plan ? fastingLocked(plan, now) : false;

  const [editDay, setEditDay] = useDraft<string | null>(
    dayParam && dayIds.includes(dayParam) ? dayParam : null,
  );

  // Ketikan di modal DIKUNCI PER HARI — pindah hari otomatis kembali ke data
  // hari itu, bukan sisa ketikan hari sebelumnya.
  const [edits, setEdits] = useState<Record<string, FastingDay>>({});
  const dayData = editDay && plan ? fastingDay(plan, editDay) : EMPTY_DAY;
  const draft = (editDay ? edits[editDay] : null) ?? dayData;
  const setDraft = (patch: Partial<FastingDay>) => {
    if (!editDay) return;
    setEdits((e) => ({ ...e, [editDay]: { ...draft, ...patch } }));
  };

  /** Buka modal satu hari — kolomnya selalu mulai dari data tersimpannya. */
  function openDay(dayId: string) {
    if (!plan) return;
    setEdits((e) => {
      const bersih = { ...e };
      delete bersih[dayId];
      return bersih;
    });
    setEditDay(dayId);
  }

  async function saveDay(dayId: string, next: FastingDay) {
    if (!user || !planId || terkunci) return;
    setError(null);
    try {
      await saveFastingDay(user.uid, planId, dayId, next);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  // Centang langsung dari kartu — 1 tulis, tanpa buka modal.
  function toggleDay(dayId: string) {
    if (!plan || terkunci) return;
    const d = fastingDay(plan, dayId);
    saveDay(dayId, { ...d, done: !d.done });
  }

  async function handleSaveDay() {
    if (!editDay || busy) return;
    setBusy(true);
    await saveDay(editDay, {
      prayer: draft.prayer.trim(),
      answer: draft.answer.trim(),
      done: draft.done,
    });
    setBusy(false);
    setEditDay(null);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Spiritual"
        title="Hari per Hari 🍽️"
        subtitle={plan?.title}
      />

      <ScreenError message={error} />

      {plans === null ? (
        <LoadingCenter />
      ) : !plan ? (
        <VixText heading="label" additionalStyle={styles.empty}>
          Puasanya sudah tidak ada.
        </VixText>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SummaryCard
            label="🍽️ Puasa berhasil"
            value={`${progress.done} dari ${progress.total} hari`}
            sub={`📆 ${formatFullDate(dayIdToDate(plan.startId))} – ${formatFullDate(
              dayIdToDate(plan.endId),
            )}`}
          />

          {terkunci && (
            <VixText heading="label" additionalStyle={styles.locked}>
              🔒 Sudah dikunci — puasanya selesai lebih dari 3 hari lalu, jadi
              catatannya tinggal dibaca.
            </VixText>
          )}

          {dayIds.map((dayId, i) => {
            const d = fastingDay(plan, dayId);
            const isToday = dayId === todayId;
            return (
              <View
                key={dayId}
                style={[styles.dayCard, isToday && styles.dayCardToday]}>
                <PressableScale
                  onPress={() => toggleDay(dayId)}
                  disabled={terkunci}
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
        </ScrollView>
      )}

      {/* Modal catatan satu hari puasa. Saat terkunci ia tetap terbuka untuk
          DIBACA — yang hilang cuma tombol simpannya. */}
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
          terkunci ? undefined : (
            <DualButtons
              confirmLabel="Simpan"
              busy={busy}
              onCancel={() => setEditDay(null)}
              onConfirm={handleSaveDay}
            />
          )
        }>
        <PressableScale
          style={styles.doneRow}
          disabled={terkunci}
          onPress={() => setDraft({ done: !draft.done })}>
          <CheckCircle checked={draft.done} size={26} />
          <VixText heading="bold" additionalStyle={styles.doneText}>
            {draft.done ? 'Berhasil berpuasa' : '❌ Gagal'}
          </VixText>
        </PressableScale>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🙏 Pokok doa hari ini
        </VixText>
        <FormInput
          placeholder="Yang khusus didoakan hari ini"
          value={draft.prayer}
          onChangeText={(v) => setDraft({ prayer: v })}
          editable={!busy && !terkunci}
          multiline
          style={styles.textArea}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          ✨ Jawaban doa hari ini
        </VixText>
        <FormInput
          placeholder="Apa yang terjadi / Tuhan jawab hari ini?"
          value={draft.answer}
          onChangeText={(v) => setDraft({ answer: v })}
          editable={!busy && !terkunci}
          multiline
          style={styles.textArea}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  empty: { textAlign: 'center', marginTop: 20 },
  locked: { color: Color.TEXT_LABEL, marginBottom: 10 },
  fieldLabel: { marginTop: 12, marginBottom: 6 },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
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
