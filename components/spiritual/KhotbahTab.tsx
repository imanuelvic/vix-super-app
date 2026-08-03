import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import {
  currentSundayId,
  deleteSermon,
  isSunday,
  saveSermon,
  type SermonNote,
} from '@/lib/sermon';

// Tab Khotbah ⛪ — catatan khotbah ibadah Minggu NDC.
// Hanya bisa DITAMBAH pada hari Minggu, satu catatan per Minggu.
export function KhotbahTab({ sermons }: { sermons: SermonNote[] }) {
  const { user } = useAuth();

  const [editing, setEditing] = useState<SermonNote | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fPreacher, setFPreacher] = useState('');
  const [fTime, setFTime] = useState('');
  const [fQuote, setFQuote] = useState('');
  const [fReflection, setFReflection] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const todaySundayId = currentSundayId(now);
  const canAddToday = isSunday(now) && !sermons.some((s) => s.id === todaySundayId);

  function openAdd() {
    setEditing('new');
    setFTitle('');
    setFPreacher('');
    setFTime('');
    setFQuote('');
    setFReflection('');
    setFormError(null);
  }

  function openEdit(s: SermonNote) {
    setEditing(s);
    setFTitle(s.title);
    setFPreacher(s.preacher);
    setFTime(s.serviceTime);
    setFQuote(s.quote);
    setFReflection(s.reflection);
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Isi judul khotbahnya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    // Baru → id = Minggu ini; edit → pakai id (tanggal Minggu) yang ada.
    const sundayId = editing === 'new' ? todaySundayId : editing.id;
    try {
      await saveSermon(user.uid, sundayId, {
        title: fTitle.trim(),
        preacher: fPreacher.trim(),
        serviceTime: fTime.trim(),
        quote: fQuote.trim(),
        reflection: fReflection.trim(),
        date: dayIdToDate(sundayId),
      });
      setEditing(null);
    } catch {
      setFormError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await deleteSermon(user.uid, editing.id);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            ⛪ Catatan Khotbah Minggu
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {sermons.length}{' '}
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              catatan tersimpan
            </VixText>
          </VixText>
        </View>

        {/* Tombol tambah — hanya Minggu & belum ada catatan Minggu ini */}
        {canAddToday ? (
          <PrimaryButton
            label="Tambah Catatan Khotbah"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addButton}
          />
        ) : (
          <View style={styles.lockCard}>
            <VixText heading="label" additionalStyle={styles.lockText}>
              {isSunday(now)
                ? '✅ Catatan khotbah Minggu ini sudah dicatat.'
                : '🙏 Catatan khotbah hanya bisa ditambahkan di hari Minggu.'}
            </VixText>
          </View>
        )}

        {sermons.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan. Datang ke ibadah Minggu & catat firmannya di sini ⛪
          </VixText>
        )}

        {sermons.map((s) => (
          <PressableScale
            key={s.id}
            style={styles.card}
            onPress={() => openEdit(s)}>
            <VixText heading="label" additionalStyle={styles.cardDate}>
              📆 {formatFullDate(dayIdToDate(s.id))}
            </VixText>
            <VixText heading="title" additionalStyle={styles.cardTitle}>
              {s.title}
            </VixText>
            <View style={styles.metaRow}>
              {s.preacher ? (
                <VixText heading="label" additionalStyle={styles.metaChip}>
                  🎤 {s.preacher}
                </VixText>
              ) : null}
              {s.serviceTime ? (
                <VixText heading="label" additionalStyle={styles.metaChip}>
                  🕙 {s.serviceTime}
                </VixText>
              ) : null}
            </View>
            {s.quote ? (
              <View style={styles.quoteBox}>
                <VixText heading="paragraph" additionalStyle={styles.quoteText}>
                  “{s.quote}”
                </VixText>
              </View>
            ) : null}
            {s.reflection ? (
              <VixText
                heading="label"
                numberOfLines={3}
                additionalStyle={styles.reflectionText}>
                🏃🏻‍➡️ {s.reflection}
              </VixText>
            ) : null}
          </PressableScale>
        ))}
      </ScrollView>

      {/* Sheet tambah/edit catatan */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catatan Khotbah' : 'Edit Catatan'}
        subtitle={
          editing && editing !== 'new'
            ? formatFullDate(dayIdToDate(editing.id))
            : formatFullDate(dayIdToDate(todaySundayId))
        }
        scroll={false}
        onClose={() => setEditing(null)}>
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Judul khotbah
          </VixText>
          <FormInput
            style={styles.formGap}
            placeholder="Judul"
            value={fTitle}
            onChangeText={setFTitle}
            autoCapitalize="words"
            editable={!busy}
          />
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Pastor / Pembicara
          </VixText>
          <FormInput
            style={styles.formGap}
            placeholder="Pembicara"
            value={fPreacher}
            onChangeText={setFPreacher}
            editable={!busy}
          />
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Ibadah jam
          </VixText>
          <FormInput
            style={styles.formGap}
            placeholder="Jam Ibadah"
            value={fTime}
            onChangeText={setFTime}
            editable={!busy}
          />
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            💡 Hikmat / Quote
          </VixText>
          <FormInput
            style={styles.multiInput}
            placeholder="Kalimat/hikmat yang paling nempel…"
            value={fQuote}
            onChangeText={setFQuote}
            multiline
            editable={!busy}
          />
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            🏃🏻‍➡️ Aplikasi
          </VixText>
          <FormInput
            style={styles.multiInputTall}
            placeholder="Apa yang mau kamu terapkan dari khotbah ini?"
            value={fReflection}
            onChangeText={setFReflection}
            multiline
            editable={!busy}
          />
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
            confirmLabel={editing === 'new' ? 'Simpan' : 'Perbarui'}
            busy={busy}
            onCancel={() => setEditing(null)}
            onConfirm={handleSave}
          />
        </ScrollView>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  heroCard: {
    backgroundColor: Color.SPIRITUAL_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 2,
    marginBottom: 12,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  addButton: { marginBottom: 12 },
  lockCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 12,
    marginBottom: 12,
  },
  lockText: { color: Color.TEXT_LABEL, textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    padding: 16,
    marginBottom: 10,
    gap: 6,
  },
  cardDate: { color: Color.SPIRITUAL_DARK },
  cardTitle: { color: Color.TEXT_TITLE },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: {
    backgroundColor: Color.SPIRITUAL,
    color: Color.SPIRITUAL_DARK,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  quoteBox: {
    backgroundColor: Color.BACKGROUND,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quoteText: { color: Color.TEXT_TITLE, fontStyle: 'italic' },
  reflectionText: { color: Color.TEXT_PARAGRAPH },
  formScroll: { flexShrink: 1 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  multiInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  multiInputTall: {
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  error: { color: Color.DANGER, marginBottom: 8 },
});
