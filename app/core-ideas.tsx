import { Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { EditFooter } from '@/components/common/EditFooter';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import {
  EMPTY_CORE_IDEAS,
  newCoreIdeaId,
  saveCoreIdeas,
  subscribeCoreIdeas,
  type CoreIdea,
  type CoreIdeasData,
  type IdeaCadence,
} from '@/lib/core';
import { formatDate } from '@/lib/format';
import { LOAD_ERROR } from '@/lib/messages';

// Layar 💡 Idea For CORE
// Dulu menumpang di ujung bawah sub-tab Follow Up. Tempatnya salah: Follow Up
// itu daftar orang yang harus dihubungi HARI INI, sedangkan ide adalah bahan
// yang dikumpulkan pelan-pelan — dan yang di bawah selalu kalah, harus
// digulung jauh dulu tiap mau menambah satu baris. Sekarang layarnya sendiri,
// dijangkau lewat tombol 💡 di pojok kanan atas CORE.
export default function CoreIdeasScreen() {
  const { user } = useAuth();

  const [ideas, setIdeas] = useState<CoreIdeasData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, formError, setFormError, save, remove } = useFormSave();

  const [editing, setEditing] = useState<CoreIdea | 'new' | null>(null);
  const [fText, setFText] = useState('');
  const [fNote, setFNote] = useState('');
  const [fDate, setFDate] = useState(new Date());

  useEffect(() => {
    if (!user) return;
    return subscribeCoreIdeas(user.uid, setIdeas, () => setError(LOAD_ERROR));
  }, [user]);

  const data = ideas ?? EMPTY_CORE_IDEAS;

  // Ide terbaru di atas.
  const sorted = useMemo(
    () => [...data.ideas].sort((a, b) => b.date.toMillis() - a.date.toMillis()),
    [data.ideas],
  );

  async function setCadence(cadence: IdeaCadence) {
    if (!user || cadence === data.cadence) return;
    try {
      await saveCoreIdeas(user.uid, { ...data, cadence });
    } catch {
      setError(LOAD_ERROR);
    }
  }

  function openAdd() {
    setEditing('new');
    setFText('');
    setFNote('');
    setFDate(new Date());
    setFormError(null);
  }

  function openEdit(idea: CoreIdea) {
    setEditing(idea);
    setFText(idea.text);
    setFNote(idea.note);
    setFDate(idea.date ? idea.date.toDate() : new Date());
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fText.trim()) {
      setFormError('Isi idenya dulu.');
      return;
    }
    const item: CoreIdea = {
      id: editing === 'new' ? newCoreIdeaId() : editing.id,
      text: fText.trim(),
      note: fNote.trim(),
      date: Timestamp.fromDate(fDate),
    };
    const next =
      editing === 'new'
        ? [...data.ideas, item]
        : data.ideas.map((i) => (i.id === editing.id ? item : i));
    await save(async () => {
      await saveCoreIdeas(user.uid, { ...data, ideas: next });
      setEditing(null);
    });
  }

  /** Hapus PERMANEN — daftarnya ditulis ulang tanpa ide ini. */
  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    await remove(async () => {
      await saveCoreIdeas(user.uid, {
        ...data,
        ideas: data.ideas.filter((i) => i.id !== editing.id),
      });
      setEditing(null);
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Idea For CORE 💡"
        subtitle="Masukan buat CORE"
      />

      <ScreenError message={error} />

      {ideas === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <PressableScale style={styles.addButton} onPress={openAdd}>
            <VixText heading="bold" additionalStyle={styles.addText}>
              + Tambah Idea
            </VixText>
          </PressableScale>

          <View style={styles.cadenceRow}>
            <Chip
              label="🗓️ Mingguan"
              active={data.cadence === 'weekly'}
              onPress={() => setCadence('weekly')}
              additionalStyle={styles.cadenceChip}
            />
            <Chip
              label="📅 Bulanan"
              active={data.cadence === 'monthly'}
              onPress={() => setCadence('monthly')}
              additionalStyle={styles.cadenceChip}
            />
          </View>

          {sorted.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada idea. Tekan “+ Tambah Idea” untuk mulai memberi
              masukan 💡
            </VixText>
          ) : (
            sorted.map((idea) => (
              <PressableScale
                key={idea.id}
                style={styles.card}
                onPress={() => openEdit(idea)}>
                <VixText heading="paragraph" additionalStyle={styles.cardText}>
                  {idea.text}
                </VixText>
                <VixText heading="label" additionalStyle={styles.cardDate}>
                  🗓️ {formatDate(idea.date.toDate())}
                </VixText>
                {idea.note ? (
                  <View style={styles.noteBox}>
                    <VixText heading="label" additionalStyle={styles.noteText}>
                      📝 {idea.note}
                    </VixText>
                  </View>
                ) : null}
              </PressableScale>
            ))
          )}
        </ScrollView>
      )}

      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Idea 💡' : 'Edit Idea 💡'}
        subtitle="Masukan buat CORE"
        onClose={() => setEditing(null)}>
        <FormInput
          style={styles.input}
          placeholder="Idenya apa?"
          value={fText}
          onChangeText={setFText}
          multiline
          editable={!busy}
        />
        <FormInput
          style={styles.input}
          placeholder="Catatan untuk grup MT (opsional)"
          value={fNote}
          onChangeText={setFNote}
          multiline
          editable={!busy}
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>
        <FormError message={formError} />
        <EditFooter
          editing={editing}
          deleteLabel="Hapus idea ini"
          busy={busy}
          onDelete={handleDelete}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  addButton: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  addText: { color: Color.TEXT_REVERSE },
  cadenceRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cadenceChip: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    ...CARD,
    marginBottom: 8,
    gap: 4,
  },
  cardText: { color: Color.TEXT_TITLE },
  cardDate: { color: Color.TEXT_LABEL },
  noteBox: {
    backgroundColor: Color.ACCENT,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
  },
  noteText: { color: Color.ACCENT_DARK },
  input: { minHeight: 80, textAlignVertical: 'top', marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
});
