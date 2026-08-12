import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { daysBetween, formatDate } from '@/lib/format';
import { SAVE_ERROR } from '@/lib/messages';
import {
  addOtherTask,
  deleteOtherTask,
  effectiveOtherTask,
  otherTaskDaysUntil,
  OTHER_REMINDER_DAYS,
  setOtherTaskDone,
  updateOtherTask,
  type OtherTask,
} from '@/lib/tasks';

/** Tenggat bawaan reminder baru: 14 hari — di luar jendela mendesak H-7. */
function defaultDeadline(): Date {
  return new Date(Date.now() + 14 * 86_400_000);
}

// Tab Prioritas 📌 — Reminder prioritas yang bisa dikerjakan kapan saja
// (bukan task harian), tapi tetap punya tenggat. Sama seperti Career →
// Fulltime: begitu masuk H-7, prioritas dipaksa P1 & tidak bisa diubah.
// Urut: belum selesai dulu → prioritas efektif → deadline terdekat.
export function PriorityTab({ items }: { items: OtherTask[] }) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<OtherTask | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fNote, setFNote] = useState('');
  const [fPriority, setFPriority] = useState<1 | 2 | 3>(2);
  const [fDeadline, setFDeadline] = useState(defaultDeadline());
  const [formError, setFormError] = useState<string | null>(null);

  // Tenggat tinggal ≤ 7 hari (termasuk lewat) → otomatis P1 & terkunci.
  const urgent = daysBetween(new Date(), fDeadline) <= OTHER_REMINDER_DAYS;
  useEffect(() => {
    if (!urgent) return;
    setFPriority((p) => (p === 1 ? p : 1));
  }, [urgent]);

  const today = new Date();
  const sorted = items
    .map((i) => effectiveOtherTask(i, today))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      const da = a.deadline?.toMillis() ?? Infinity;
      const db = b.deadline?.toMillis() ?? Infinity;
      return da - db;
    });
  const activeCount = items.filter((i) => !i.done).length;

  function openAdd() {
    setEditing('new');
    setFTitle('');
    setFNote('');
    setFPriority(2);
    setFDeadline(defaultDeadline());
    setFormError(null);
  }

  function openEdit(item: OtherTask) {
    setEditing(item);
    setFTitle(item.title);
    setFNote(item.note);
    setFPriority(item.priority);
    setFDeadline(item.deadline ? item.deadline.toDate() : defaultDeadline());
    setFormError(null);
  }

  async function handleToggle(item: OtherTask) {
    if (!user) return;
    setError(null);
    try {
      await setOtherTaskDone(user.uid, item.id, !item.done);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Isi reminder dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      // Aturan H-7 ditegakkan di sini juga, tidak bergantung timing effect.
      const data = {
        title: fTitle.trim(),
        note: fNote.trim(),
        priority: (urgent ? 1 : fPriority) as 1 | 2 | 3,
        deadline: fDeadline,
      };
      if (editing === 'new') {
        await addOtherTask(user.uid, data);
      } else {
        await updateOtherTask(user.uid, editing.id, data);
      }
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await deleteOtherTask(user.uid, editing.id);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  function priorityStyle(p: 1 | 2 | 3) {
    return p === 1 ? styles.p1 : p === 2 ? styles.p2 : styles.p3;
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            📌 Reminder Prioritas
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {activeCount}{' '}
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              belum dikerjakan
            </VixText>
          </VixText>
        </View>

        <PrimaryButton
          label="Tambah Reminder Prioritas"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {sorted.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada reminder. Simpan ide/prioritas penting di sini 📝
          </VixText>
        )}

        {sorted.map((item) => {
          const days = otherTaskDaysUntil(item, today);
          const late = days !== null && days < 0;
          const soon = days !== null && days <= OTHER_REMINDER_DAYS;
          return (
            <View
              key={item.id}
              style={[styles.card, item.done && styles.cardDone]}>
              {/* Lingkaran = tandai selesai */}
              <PressableScale onPress={() => handleToggle(item)} hitSlop={8}>
                <CheckCircle checked={item.done} size={24} />
              </PressableScale>
              {/* Tekan isi → edit */}
              <PressableScale
                style={styles.cardMain}
                onPress={() => openEdit(item)}>
                <View style={styles.cardTitleRow}>
                  <View
                    style={[styles.priorityBadge, priorityStyle(item.priority)]}>
                    <VixText heading="label" additionalStyle={styles.priorityText}>
                      P{item.priority}
                    </VixText>
                  </View>
                  <VixText
                    heading="bold"
                    additionalStyle={[
                      styles.cardTitle,
                      item.done && styles.cardTitleDone,
                    ]}>
                    {item.title}
                  </VixText>
                </View>
                {item.note ? (
                  <VixText heading="label" additionalStyle={styles.cardNote}>
                    {item.note}
                  </VixText>
                ) : null}
                {item.deadline && !item.done ? (
                  <VixText
                    heading="label"
                    additionalStyle={
                      late
                        ? styles.dueLate
                        : soon
                          ? styles.dueSoon
                          : styles.dueNormal
                    }>
                    🗓️ {formatDate(item.deadline.toDate())}
                    {days === 0
                      ? ' — HARI INI!'
                      : late
                        ? ` — lewat ${-days!} hari`
                        : ` — ${days} hari lagi`}
                  </VixText>
                ) : null}
              </PressableScale>
            </View>
          );
        })}
      </ScrollView>

      {/* Sheet tambah/edit */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Reminder Prioritas' : 'Edit Reminder'}
        onClose={() => setEditing(null)}>
        {/* Catatan singkat = kotak kecil; detailnya yang panjang di bawah. */}
        <FormInput
          style={styles.formGap}
          placeholder="Reminder Prioritas"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />
        <FormInput
          style={styles.detailInput}
          placeholder="Detail (opsional)"
          value={fNote}
          onChangeText={setFNote}
          multiline
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🗓️ Deadline
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={editing === 'new' ? 'new' : (editing?.id ?? 'none')}
            value={fDeadline}
            onChange={setFDeadline}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Prioritas (P1 = paling penting)
        </VixText>
        <View style={styles.chipRow}>
          {([1, 2, 3] as const).map((p) => (
            <Chip
              key={p}
              label={`P${p}`}
              active={fPriority === p}
              onPress={urgent ? () => {} : () => setFPriority(p)}
              additionalStyle={[
                styles.chipFlex,
                urgent && fPriority !== p && styles.chipLocked,
              ]}
            />
          ))}
        </View>
        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {editing !== 'new' && editing !== null && (
          <InlineDelete
            key={editing.id}
            label="Hapus reminder ini"
            busy={busy}
            onDelete={handleDelete}
          />
        )}
        <DualButtons
          confirmLabel={editing === 'new' ? 'Tambah' : 'Simpan'}
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  heroCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 2,
    marginBottom: 12,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  addButton: { marginBottom: 12 },
  error: { color: Color.DANGER, marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
  },
  cardDone: { opacity: 0.6 },
  cardMain: { flex: 1, gap: 4 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  p1: { backgroundColor: Color.DANGER },
  p2: { backgroundColor: Color.WARNING },
  p3: { backgroundColor: Color.TEXT_PLACEHOLDER },
  priorityText: { color: Color.TEXT_REVERSE },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  cardTitleDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  cardNote: { color: Color.TEXT_LABEL },
  dueNormal: { color: Color.TEXT_LABEL },
  dueSoon: { color: Color.WARNING },
  dueLate: { color: Color.DANGER },
  // Judul reminder = kotak kecil, detail = kotak besar.
  detailInput: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chipFlex: { flex: 1 },
  chipLocked: { opacity: 0.4 },
});
