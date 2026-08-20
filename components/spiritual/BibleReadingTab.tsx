import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  BIBLE_SESSIONS,
  bibleSessionMeta,
  bibleSessionNow,
  deleteBibleReading,
  isBibleSkipped,
  saveBibleReading,
  type BibleReadingDay,
  type BibleSession,
} from '@/lib/spiritual';

// Tab Bible Reading 📖 — riwayat bacaan Alkitab harian yang dicatat dari Home.
// Dua sesi (🌅 Pagi & 🌙 Malam) dipisah supaya kelihatan mana yang rutin dan
// mana yang bolong, plus pasal apa saja yang sering dibaca.
// Catatan HARI INI masih bisa dibetulkan/dihapus; hari lalu jadi arsip.
export function BibleReadingTab({ days }: { days: BibleReadingDay[] }) {
  const { user } = useAuth();

  // Default ke sesi yang jendelanya sedang terbuka; di luar jam baca → Pagi.
  const [session, setSession] = useState<BibleSession>(
    () => bibleSessionNow(new Date()) ?? 'morning',
  );

  // Hari yang sedang diedit (hanya hari ini) + isi kotak teksnya.
  const [editing, setEditing] = useState<BibleReadingDay | null>(null);
  const [text, setText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Hari yang sesi ini-nya benar-benar DIBACA (days sudah urut terbaru →
  // terlama). Hari yang sengaja dilewati tidak ditampilkan sama sekali: ini
  // arsip bacaan, bukan daftar absen — barisnya cuma jadi lubang kosong.
  // Penandanya sendiri tetap tersimpan, jadi kartu di Home & badge Habits
  // tetap tahu hari itu sudah diurus dan berhenti menagih.
  const list = days.filter((d) => !!d[session] && !isBibleSkipped(d[session]));
  const meta = bibleSessionMeta(session);
  const todayId = dayDocId(new Date());

  function openEdit(d: BibleReadingDay) {
    setEditing(d);
    // Yang dilewati tidak pernah masuk daftar, jadi isinya pasti acuan asli —
    // penanda "__skip__" tak mungkin nyasar ke kotak teks ini.
    setText(d[session]);
    setFormError(null);
  }

  async function handleSave() {
    const value = text.trim();
    if (!user || !editing || busy) return;
    if (!value) {
      setFormError('Isi kitab & pasalnya dulu, atau hapus catatannya.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await saveBibleReading(user.uid, editing.id, session, value);
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || busy) return;
    const other = session === 'morning' ? 'night' : 'morning';
    setBusy(true);
    setFormError(null);
    try {
      await deleteBibleReading(user.uid, editing.id, session, !!editing[other]);
      setEditing(null);
    } catch {
      setFormError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <SegmentTabs
          tabs={BIBLE_SESSIONS.map((s) => ({
            key: s.key,
            label: `${s.emoji} ${s.label}`,
          }))}
          value={session}
          onChange={setSession}
        />

        {list.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan bacaan {meta.label.toLowerCase()}. Isi lewat kartu
            “{meta.title}” di Home pada jam {meta.fromHour}.00–{meta.toHour}.00
            📖
          </VixText>
        )}

        {list.map((d) => {
          const editable = d.id === todayId;
          return (
            <View key={d.id} style={styles.card}>
              <View style={styles.cardTop}>
                <VixText heading="label" additionalStyle={styles.cardDate}>
                  📆 {formatFullDate(dayIdToDate(d.id))}
                </VixText>
                {/* Hanya catatan HARI INI yang boleh diubah/dihapus */}
                {editable && (
                  <PressableScale onPress={() => openEdit(d)} hitSlop={10}>
                    <VixText heading="label" additionalStyle={styles.editText}>
                      ✏️ Edit
                    </VixText>
                  </PressableScale>
                )}
              </View>
              <VixText heading="paragraph" additionalStyle={styles.cardText}>
                {d[session]}
              </VixText>
            </View>
          );
        })}
      </ScrollView>

      {/* Sheet edit/hapus catatan hari ini */}
      <SheetModal
        visible={!!editing}
        title={`${meta.emoji} Edit ${meta.title}`}
        subtitle={editing ? formatFullDate(dayIdToDate(editing.id)) : undefined}
        onClose={() => setEditing(null)}
        footer={
          <DualButtons
            confirmLabel="Perbarui"
            busy={busy}
            onCancel={() => setEditing(null)}
            onConfirm={handleSave}
          />
        }>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Kitab, pasal & ayat
        </VixText>
        <FormInput
          placeholder="Alkitab"
          value={text}
          onChangeText={setText}
          editable={!busy}
          multiline
          style={styles.input}
        />

        <FormError message={formError} gap="top" />

        {/* key per hari+sesi → konfirmasi hapus ikut reset tiap ganti catatan */}
        <InlineDelete
          key={`${editing?.id}-${session}`}
          label="Hapus catatan ini…"
          busy={busy}
          onDelete={handleDelete}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: { color: Color.SPIRITUAL_DARK },
  editText: { color: Color.MAIN },
  cardText: { color: Color.TEXT_TITLE },
  fieldLabel: { marginBottom: 6 },
  input: { minHeight: 88, textAlignVertical: 'top' },
});
