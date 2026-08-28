import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { EditButton } from '@/components/common/EditButton';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  newFitNoteId,
  saveFitNotes,
  tidyUrl,
  urlHost,
  type FitNote,
} from '@/lib/fitNotes';
import { useFormSave } from '@/hooks/useFormSave';
import { openExternalUrl } from '@/lib/linking';
import { SAVE_ERROR } from '@/lib/messages';

// Sub-tab Notes 📝 — kumpulan tautan & catatan latihan.
//
// Click kartunya = LANGSUNG buka tautannya (itu yang paling sering dilakukan).
// Mengubah/menghapus lewat tombol ✏️ di sebelahnya, yang sengaja jadi SAUDARA
// kartunya — Pressable bersarang tidak andal di iOS.
export function NotesTab({ notes }: { notes: FitNote[] }) {
  const { user } = useAuth();

  const [editing, setEditing] = useState<FitNote | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fUrl, setFUrl] = useState('');
  const [fNote, setFNote] = useState('');
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  function openAdd() {
    setEditing('new');
    setFTitle('');
    setFUrl('');
    setFNote('');
    setFormError(null);
  }

  function openEdit(n: FitNote) {
    setEditing(n);
    setFTitle(n.title);
    setFUrl(n.url);
    setFNote(n.note);
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Judulnya diisi dulu ya.');
      return;
    }
    const data: FitNote = {
      id: editing === 'new' ? newFitNoteId() : editing.id,
      title: fTitle.trim(),
      // Disimpan sudah rapi, jadi yang tersimpan pasti bisa dibuka.
      url: tidyUrl(fUrl),
      note: fNote.trim(),
    };
    await save(async () => {
      await saveFitNotes(
        user.uid,
        editing === 'new'
          ? [...notes, data]
          : notes.map((n) => (n.id === editing.id ? data : n)),
      );
      setEditing(null);
    });
  }

  /** Hapus permanen — daftarnya ditulis ulang tanpa catatan ini. */
  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveFitNotes(user.uid, notes.filter((n) => n.id !== editing.id));
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Tambah Catatan"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {notes.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan. Tempel link video gerakan, program, atau artikel
            yang mau kamu simpan 📝
          </VixText>
        )}

        {notes.map((n) => {
          const host = urlHost(n.url);
          return (
            <View key={n.id} style={styles.card}>
              {/* Area utama = buka tautannya. Kalau tidak ada tautannya,
                  click itu tidak melakukan apa-apa — jadi dimatikan supaya
                  tidak terasa rusak. */}
              <PressableScale
                style={styles.cardMain}
                disabled={!n.url}
                onPress={() => openExternalUrl(n.url)}>
                <VixText heading="bold" additionalStyle={styles.cardTitle}>
                  {n.title}
                </VixText>
                {host ? (
                  <VixText heading="label" additionalStyle={styles.cardHost}>
                    🔗 {host}
                  </VixText>
                ) : (
                  <VixText heading="label" additionalStyle={styles.cardNoLink}>
                    Tanpa tautan
                  </VixText>
                )}
                {n.note ? (
                  <VixText heading="label" numberOfLines={2}>
                    {n.note}
                  </VixText>
                ) : null}
              </PressableScale>

              <EditButton onPress={() => openEdit(n)} />
            </View>
          );
        })}
      </ScrollView>

      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Catatan' : 'Ubah Catatan'}
        subtitle="Isi link"
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏷️ Judul
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Cara Deadlift yang benar"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🔗 Link (opsional)
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Tempel di sini"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={fUrl}
          onChangeText={setFUrl}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📝 Catatan (opsional)
        </VixText>
        <FormInput
          style={[styles.textArea, styles.formGap]}
          placeholder="Kenapa disimpan? Bagian mana yang penting?"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
          multiline
        />

        <FormError message={formError} />
        <EditDelete
          editing={editing}
          label="Hapus catatan ini"
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginVertical: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: Color.TEXT_TITLE },
  cardHost: { color: Color.FITNESS_DARK },
  cardNoLink: { color: Color.TEXT_PLACEHOLDER },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  textArea: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
});
