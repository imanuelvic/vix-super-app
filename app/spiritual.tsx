import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormInput } from '@/components/common/FormInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { type LoginStreak as DayStreak } from '@/lib/achievements';
import { formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import {
  bumpReviveStreak,
  dailyReminder,
  deleteReviveEntry,
  saveReviveEntry,
  subscribeReviveEntries,
  subscribeReviveStreak,
  type ReviveEntry,
} from '@/lib/spiritual';

type Mode = 'list' | 'edit';

// Spiritual ✝️ — jurnal REVIVE harian + reminder fokus pada Tuhan.
export default function SpiritualScreen() {
  const { user } = useAuth();

  const [entries, setEntries] = useState<ReviveEntry[] | null>(null);
  const [streak, setStreak] = useState<DayStreak | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [busy, setBusy] = useState(false);

  // Editor jurnal (mengikuti struktur renungan NDC REVIVE).
  const [editingDay, setEditingDay] = useState('');
  const [editingDate, setEditingDate] = useState(new Date());
  const [fTitle, setFTitle] = useState('');
  const [fPassage, setFPassage] = useState('');
  const [fVerse, setFVerse] = useState('');
  const [fRhema, setFRhema] = useState('');
  const [fReflection, setFReflection] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError('Gagal memuat data. Cek koneksi internet.');
    const unsubs = [
      subscribeReviveEntries(
        user.uid,
        (next) => {
          setEntries(next);
          setError(null);
        },
        fail,
      ),
      subscribeReviveStreak(user.uid, setStreak, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const todayId = dayDocId(new Date());
  const todayEntry = entries?.find((e) => e.id === todayId) ?? null;
  const reminder = dailyReminder(todayId);
  // Streak tampil 0 kalau sudah bolong lebih dari sehari.
  const streakShown =
    streak && streak.lastDayId >= dayDocId(new Date(Date.now() - 86_400_000))
      ? streak.count
      : 0;

  function openEditor(entry: ReviveEntry | null) {
    setEditingDay(entry?.id ?? todayId);
    setEditingDate(entry ? entry.date.toDate() : new Date());
    setFTitle(entry?.title ?? '');
    setFPassage(entry?.passage ?? '');
    setFVerse(entry?.verse ?? '');
    setFRhema(entry?.rhema ?? '');
    setFReflection(entry?.reflection ?? '');
    setFormError(null);
    setMode('edit');
  }

  async function handleSave() {
    if (!user || busy) return;
    if (!fTitle.trim()) {
      setFormError('Judul renungannya diisi dulu ya.');
      return;
    }
    if (!fRhema.trim()) {
      setFormError('Tulis rhema-nya — firman apa yang ngena di hatimu hari ini?');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await saveReviveEntry(user.uid, editingDay, {
        title: fTitle.trim(),
        passage: fPassage.trim(),
        verse: fVerse.trim(),
        rhema: fRhema.trim(),
        reflection: fReflection.trim(),
        date: editingDate,
      });
      // Jurnal HARI INI pertama kali → streak naik 🔥
      if (editingDay === todayId) {
        await bumpReviveStreak(user.uid, streak, todayId);
      }
      setMode('list');
    } catch {
      setFormError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await deleteReviveEntry(user.uid, editingDay);
    } finally {
      setConfirmDelete(false);
      setBusy(false);
      setMode('list');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Spiritual ✝️"
        subtitle="Being with God — bukan sekadar doing for God"
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {entries === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Color.MAIN} />
        </View>
      ) : mode === 'edit' ? (
        /* ===== Editor jurnal REVIVE ===== */
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <VixText heading="label" additionalStyle={styles.editorDate}>
            📖 {formatFullDate(editingDate)}
          </VixText>
          <FormInput
            style={styles.formGap}
            placeholder="Judul Revive"
            value={fTitle}
            onChangeText={setFTitle}
            editable={!busy}
          />
          <View style={styles.rowGap}>
            <FormInput
              style={styles.halfInput}
              placeholder="Bacaan Alkitab"
              value={fPassage}
              onChangeText={setFPassage}
              editable={!busy}
            />
            <FormInput
              style={styles.halfInput}
              placeholder="Ayat Hafalan"
              value={fVerse}
              onChangeText={setFVerse}
              editable={!busy}
            />
          </View>
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            ✨ Rhema — firman yang ngena di hatimu
          </VixText>
          <FormInput
            style={styles.bigInput}
            placeholder="Jujur saja di sini… renungan hari ini bicara apa ke kamu?"
            value={fRhema}
            onChangeText={setFRhema}
            multiline
            editable={!busy}
          />
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            🪞 Refleksi & komitmen (opsional)
          </VixText>
          <FormInput
            style={styles.mediumInput}
            placeholder="Apa yang mau kamu lakukan menanggapi firman ini?"
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
          {todayEntry?.id === editingDay || entries.some((e) => e.id === editingDay) ? (
            <Pressable onPress={() => setConfirmDelete(true)} disabled={busy}>
              <VixText heading="bold" additionalStyle={styles.deleteText}>
                Hapus jurnal ini
              </VixText>
            </Pressable>
          ) : null}
          <View style={styles.navRow}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => setMode('list')}
              disabled={busy}>
              <VixText heading="bold">Batal</VixText>
            </Pressable>
            <PrimaryButton
              label="Simpan 🙏"
              busy={busy}
              onPress={handleSave}
              additionalStyle={styles.saveButton}
            />
          </View>
        </ScrollView>
      ) : (
        /* ===== Daftar jurnal ===== */
        <ScrollView contentContainerStyle={styles.content}>
          {/* Streak Revive */}
          <View style={styles.streakCard}>
            <VixText heading="bold" additionalStyle={styles.streakText}>
              📖 Revive {streakShown} hari beruntun 🔥
            </VixText>
            <VixText heading="label" additionalStyle={styles.streakSub}>
              Terbaik: {streak?.best ?? 0} · total {streak?.total ?? 0} jurnal —
              lanjutkan di halaman Achievement 🏆
            </VixText>
          </View>

          {/* Reminder harian */}
          <View style={styles.reminderCard}>
            <VixText heading="label" additionalStyle={styles.reminderLabel}>
              🕊️ Reminder Hari Ini
            </VixText>
            <VixText heading="paragraph" additionalStyle={styles.reminderText}>
              {reminder}
            </VixText>
          </View>

          {/* Jurnal hari ini */}
          {todayEntry ? (
            <Pressable
              style={[styles.entryCard, styles.todayCard]}
              onPress={() => openEditor(todayEntry)}>
              <VixText heading="label" additionalStyle={styles.todayBadge}>
                ✅ Revive hari ini selesai — tap untuk baca/edit
              </VixText>
              <VixText heading="bold" additionalStyle={styles.entryTitle}>
                {todayEntry.title}
              </VixText>
              <VixText heading="paragraph" numberOfLines={2}>
                {todayEntry.rhema}
              </VixText>
            </Pressable>
          ) : (
            <PrimaryButton
              label="✍️ Tulis Revive Hari Ini"
              onPress={() => openEditor(null)}
              additionalStyle={styles.writeButton}
            />
          )}

          {/* Riwayat jurnal */}
          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            🗂️ Jurnal Sebelumnya
          </VixText>
          {entries.filter((e) => e.id !== todayId).length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada jurnal — mulai hari ini, satu rhema sehari 🌱
            </VixText>
          ) : (
            entries
              .filter((e) => e.id !== todayId)
              .map((e) => (
                <Pressable
                  key={e.id}
                  style={styles.entryCard}
                  onPress={() => openEditor(e)}>
                  <VixText heading="label">
                    {formatFullDate(e.date.toDate())}
                    {e.passage ? ` · ${e.passage}` : ''}
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.entryTitle}>
                    {e.title}
                  </VixText>
                  <VixText heading="paragraph" numberOfLines={2}>
                    {e.rhema}
                  </VixText>
                </Pressable>
              ))
          )}
        </ScrollView>
      )}

      {/* Konfirmasi hapus jurnal */}
      <ConfirmDialog
        visible={confirmDelete}
        title="Hapus jurnal ini?"
        detail="Catatan rhema hari itu akan terhapus permanen."
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  streakCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    padding: 16,
    gap: 2,
    marginBottom: 10,
  },
  streakText: { color: Color.SPIRITUAL_DARK },
  streakSub: { color: Color.SPIRITUAL_DARK },
  reminderCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    padding: 14,
    gap: 4,
    marginBottom: 10,
  },
  reminderLabel: { color: Color.SPIRITUAL_DARK },
  reminderText: { color: Color.TEXT_TITLE },
  writeButton: { marginBottom: 4 },
  todayCard: {
    borderColor: Color.SPIRITUAL_DARK,
    backgroundColor: Color.SPIRITUAL,
  },
  todayBadge: { color: Color.SPIRITUAL_DARK },
  sectionTitle: { marginTop: 14, marginBottom: 10 },
  empty: { textAlign: 'center', marginTop: 8 },
  entryCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 3,
    marginBottom: 10,
  },
  entryTitle: { color: Color.TEXT_TITLE },
  // Editor
  editorDate: { marginBottom: 10 },
  formGap: { marginBottom: 10 },
  rowGap: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  halfInput: { flex: 1 },
  fieldLabel: { marginBottom: 6 },
  bigInput: {
    minHeight: 140,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  mediumInput: {
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  deleteText: { color: Color.DANGER, textAlign: 'center', marginTop: 6 },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  saveButton: { flex: 1 },
});
