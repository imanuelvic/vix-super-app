import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { SAVE_ERROR } from '@/lib/messages';
import {
  addOtherTask,
  deleteOtherTask,
  setOtherTaskDone,
  updateOtherTask,
  type OtherTask,
} from '@/lib/tasks';

// Tab Other Task 📌 — catatan prioritas/reminder penting yang bisa dikerjakan
// kapan saja (bukan task harian). Urut: belum selesai dulu, lalu prioritas.
export function OtherTaskTab({ items }: { items: OtherTask[] }) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<OtherTask | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fNote, setFNote] = useState('');
  const [fPriority, setFPriority] = useState<1 | 2 | 3>(2);
  const [formError, setFormError] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.priority - b.priority;
  });
  const activeCount = items.filter((i) => !i.done).length;

  function openAdd() {
    setEditing('new');
    setFTitle('');
    setFNote('');
    setFPriority(2);
    setFormError(null);
  }

  function openEdit(item: OtherTask) {
    setEditing(item);
    setFTitle(item.title);
    setFNote(item.note);
    setFPriority(item.priority);
    setFormError(null);
  }

  async function handleToggle(item: OtherTask) {
    if (!user) return;
    setError(null);
    try {
      await setOtherTaskDone(user.uid, item.id, !item.done);
    } catch {
      setError('Gagal menyimpan. Coba lagi.');
    }
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Isi catatannya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editing === 'new') {
        await addOtherTask(user.uid, {
          title: fTitle.trim(),
          note: fNote.trim(),
          priority: fPriority,
        });
      } else {
        await updateOtherTask(user.uid, editing.id, {
          title: fTitle.trim(),
          note: fNote.trim(),
          priority: fPriority,
        });
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
            📌 Catatan & Prioritas
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {activeCount}{' '}
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              belum dikerjakan
            </VixText>
          </VixText>
        </View>

        <PrimaryButton
          label="Tambah Catatan Prioritas"
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
            Belum ada catatan. Simpan ide/prioritas penting di sini 📝
          </VixText>
        )}

        {sorted.map((item) => (
          <View
            key={item.id}
            style={[styles.card, item.done && styles.cardDone]}>
            {/* Lingkaran = tandai selesai */}
            <PressableScale onPress={() => handleToggle(item)} hitSlop={8}>
              <CheckCircle checked={item.done} size={24} />
            </PressableScale>
            {/* Tekan isi → edit */}
            <PressableScale style={styles.cardMain} onPress={() => openEdit(item)}>
              <View style={styles.cardTitleRow}>
                <View style={[styles.priorityBadge, priorityStyle(item.priority)]}>
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
            </PressableScale>
          </View>
        ))}
      </ScrollView>

      {/* Sheet tambah/edit */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catatan Prioritas' : 'Edit Catatan'}
        onClose={() => setEditing(null)}>
        <FormInput
          style={styles.taskInput}
          placeholder="Catatan / prioritas…"
          value={fTitle}
          onChangeText={setFTitle}
          multiline
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Detail (opsional)"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Prioritas (P1 = paling penting)
        </VixText>
        <View style={styles.chipRow}>
          {([1, 2, 3] as const).map((p) => (
            <Chip
              key={p}
              label={`P${p}`}
              active={fPriority === p}
              onPress={() => setFPriority(p)}
              additionalStyle={styles.chipFlex}
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
            label="Hapus catatan ini"
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
  taskInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chipFlex: { flex: 1 },
});
