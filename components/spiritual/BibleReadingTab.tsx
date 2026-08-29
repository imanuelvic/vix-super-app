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
import { useFormSave } from '@/hooks/useFormSave';
import { splitBibleRefs, usfmRef } from '@/lib/bible';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR } from '@/lib/messages';
import {
  BIBLE_SESSIONS,
  BIBLE_VERSION_DEFAULT,
  bibleHasOther,
  bibleSessionMeta,
  bibleSessionNow,
  deleteBibleReading,
  isBibleSkipped,
  openYouVersion,
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
  const [version, setVersion] = useState(BIBLE_VERSION_DEFAULT);
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

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
    setVersion(d.versions[session]);
    setFormError(null);
  }

  async function handleSave() {
    const value = text.trim();
    if (!user || !editing || busy) return;
    if (!value) {
      setFormError('Isi kitab & pasalnya dulu, atau hapus catatannya.');
      return;
    }
    await save(async () => {
      await saveBibleReading(user.uid, editing.id, session, value, version);
      setEditing(null);
    });
  }

  async function handleDelete() {
    if (!user || !editing || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      // Dokumen harinya cuma dihapus kalau tidak ada sesi lain yang terisi.
      await deleteBibleReading(
        user.uid,
        editing.id,
        session,
        bibleHasOther(editing, session),
      );
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
                      Ubah
                    </VixText>
                  </PressableScale>
                )}
              </View>
              {/* "Amsal 16 (TB)" — acuannya beserta terjemahan yang dibaca.
                  Catatan lama yang belum punya kolom terjemahan tampil (TB),
                  dan itu memang benar: semuanya dibuat dari Terjemahan Baru.

                  Tiap acuan bisa di-click SENDIRI-SENDIRI → membuka pasal itu
                  di YouVersion. Baris "Yakobus 3, Amsal 14" jadi dua tombol,
                  bukan satu: yang mau dibaca ulang biasanya cuma salah satunya.
                  Terjemahannya ikut, jadi yang terbuka bacaan yang sama persis
                  (selama nomor versinya sudah terdaftar — lihat lib/spiritual). */}
              <View style={styles.refRow}>
                {splitBibleRefs(d[session]).map((acuan, i) => {
                  const versi = d.versions[session] || BIBLE_VERSION_DEFAULT;
                  const bisa = usfmRef(acuan) !== null;
                  return (
                    <PressableScale
                      key={`${d.id}-${i}`}
                      style={[styles.refChip, !bisa && styles.refChipPlain]}
                      onPress={() => void openYouVersion(acuan, versi)}
                      disabled={!bisa}>
                      <VixText
                        heading="paragraph"
                        additionalStyle={bisa ? styles.refChipText : styles.cardText}>
                        {acuan}
                        {bisa ? ' ›' : ''}
                      </VixText>
                    </PressableScale>
                  );
                })}
                <VixText heading="paragraph" additionalStyle={styles.cardVersion}>
                  ({d.versions[session] || BIBLE_VERSION_DEFAULT})
                </VixText>
              </View>
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

        <VixText heading="label" additionalStyle={styles.fieldLabelTop}>
          Terjemahan
        </VixText>
        <FormInput
          placeholder={BIBLE_VERSION_DEFAULT}
          value={version}
          onChangeText={setVersion}
          editable={!busy}
          autoCapitalize="characters"
          maxLength={12}
          style={styles.versionInput}
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
  // Acuan yang bisa di-click tampil sebagai pil ungu muda — beda jelas dari
  // teks biasa, jadi kelihatan mana yang membuka YouVersion dan mana yang
  // cuma tulisan (kitab yang namanya tidak dikenali tetap tampil apa adanya).
  refRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  refChip: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  refChipPlain: { backgroundColor: 'transparent', paddingHorizontal: 0 },
  refChipText: { color: Color.SPIRITUAL_DARK },
  cardVersion: { color: Color.TEXT_LABEL },
  fieldLabel: { marginBottom: 6 },
  fieldLabelTop: { marginTop: 12, marginBottom: 6 },
  input: { minHeight: 88, textAlignVertical: 'top' },
  // Sempit: isinya cuma singkatan 2–4 huruf (TB, BIS, NIV, TSI).
  versionInput: { maxWidth: 140 },
});
