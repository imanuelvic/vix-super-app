import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ActionStack } from '@/components/common/ActionStack';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ShareWhatsAppButton } from '@/components/common/ShareWhatsAppButton';
import { VixText } from '@/components/common/VixText';
import { ConnectCoreButton } from '@/components/spiritual/ConnectCoreButton';
import { useAuth } from '@/contexts/auth';
import { useKeyedData } from '@/hooks/useKeyedData';
import { purgeNoteLinks } from '@/lib/coreNotes';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  deleteSermon,
  saveSermon,
  sermonEditable,
  sermonShareText,
  subscribeSermon,
  type SermonNote,
} from '@/lib/sermon';
import { shareTextToWhatsApp, WHATSAPP_ERROR } from '@/lib/whatsapp';

// Catatan Khotbah ⛪ — LAYAR sendiri, bukan bottom sheet.
//
// Alasannya isi catatannya: poin-poin khotbah bisa puluhan baris. Di dalam
// modal (tinggi maksimal ¾ layar, dan menyusut lagi saat keyboard muncul)
// menulis sepanjang itu berarti mengetik di jendela sempit yang ikut bergoyang.
// Di layar penuh, ruangnya seluruh layar — sama seperti Tulis Revive ✍️.
//
// Satu layar dua keadaan:
//   · masih bisa diubah (Minggu & Senin) → form isian
//   · sudah terkunci (mulai Selasa)      → tampilan baca, enter-nya utuh
export default function SermonScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // ?id=<dayId Minggu>. Catatan baru & catatan lama sama-sama lewat sini —
  // yang membedakan cuma dokumennya sudah ada atau belum.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sundayId = id ?? '';

  // null = belum termuat. Isinya `SermonNote | 'kosong'` supaya "dokumennya
  // memang belum ada" bisa dibedakan dari "belum selesai dibaca".
  const { data: loaded, set: setLoaded } = useKeyedData<
    string,
    SermonNote | 'kosong'
  >(sundayId);
  const note = loaded === 'kosong' ? null : loaded;

  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Isian form. Diisi dari dokumennya lewat tombol "Ubah", bukan lewat efek —
  // supaya yang sedang diketik tidak tertimpa tiap kali snapshot baru datang.
  const [editing, setEditing] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fPreacher, setFPreacher] = useState('');
  const [fTime, setFTime] = useState('');
  const [fQuote, setFQuote] = useState('');
  const [fNote, setFNote] = useState('');
  const [fReflection, setFReflection] = useState('');

  useEffect(() => {
    if (!user || !sundayId) return;
    return subscribeSermon(
      user.uid,
      sundayId,
      (next) => {
        setLoaded(next ?? 'kosong');
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user, sundayId, setLoaded]);

  const now = new Date();
  const bisaDiubah = sundayId ? sermonEditable(sundayId, now) : false;
  // Dokumennya belum ada & masih dalam masa isi → langsung buka formnya.
  const mulaiKosong = loaded === 'kosong' && bisaDiubah;
  const formMode = editing || mulaiKosong;

  function bukaForm(s: SermonNote | null) {
    setFTitle(s?.title ?? '');
    setFPreacher(s?.preacher ?? '');
    setFTime(s?.serviceTime ?? '');
    setFQuote(s?.quote ?? '');
    setFNote(s?.note ?? '');
    setFReflection(s?.reflection ?? '');
    setFormError(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!user || !sundayId || busy) return;
    if (!fTitle.trim()) {
      setFormError('Isi judul khotbahnya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await saveSermon(user.uid, sundayId, {
        title: fTitle.trim(),
        preacher: fPreacher.trim(),
        serviceTime: fTime.trim(),
        quote: fQuote.trim(),
        note: fNote.trim(),
        reflection: fReflection.trim(),
        date: dayIdToDate(sundayId),
      });
      setEditing(false);
      // Catatan baru: begitu tersimpan, kembali ke daftarnya.
      if (mulaiKosong) router.back();
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !sundayId || busy) return;
    setBusy(true);
    try {
      await deleteSermon(user.uid, sundayId);
      // Lepas sambungan 🔗 ke acara CORE (lihat catatan yang sama di revive).
      purgeNoteLinks(user.uid, 'sermon', sundayId).catch(() => {});
      router.back();
    } catch {
      setError(DELETE_ERROR);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const tanggal = sundayId ? formatFullDate(dayIdToDate(sundayId)) : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Spiritual"
        title={formMode ? 'Catatan Khotbah ✍️' : 'Catatan Khotbah ⛪'}
        subtitle={tanggal}
      />

      <ScreenError message={error} />

      {loaded === null ? (
        <LoadingCenter />
      ) : formMode ? (
        /* ===================== ISI / UBAH ===================== */
        <KeyboardAwareScrollView contentContainerStyle={styles.content}>
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

          {/* Tiga isian utamanya — masing-masing punya ruang lega karena ini
              layar penuh, bukan modal. */}
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            💡 Quotes
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
            📝 Catatan Khotbah
          </VixText>
          <FormInput
            style={styles.multiInputTall}
            placeholder={'Poin-poin khotbahnya…\n\n1. \n2. \n3. '}
            value={fNote}
            onChangeText={setFNote}
            multiline
            editable={!busy}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            🏃🏻‍➡️ Aplikasi
          </VixText>
          <FormInput
            style={styles.multiInput}
            placeholder="Apa yang mau kamu terapkan dari khotbah ini?"
            value={fReflection}
            onChangeText={setFReflection}
            multiline
            editable={!busy}
          />

          <FormError message={formError} />

          {note && (
            <PressableScale
              style={styles.deleteButton}
              disabled={busy}
              onPress={() => setConfirmDelete(true)}>
              <VixText heading="bold" additionalStyle={styles.deleteText}>
                Hapus catatan ini
              </VixText>
            </PressableScale>
          )}

          <DualButtons
            confirmLabel={note ? 'Perbarui' : 'Simpan'}
            busy={busy}
            onCancel={() => (mulaiKosong ? router.back() : setEditing(false))}
            onConfirm={handleSave}
          />
        </KeyboardAwareScrollView>
      ) : note ? (
        /* ===================== BACA ===================== */
        <ScrollView contentContainerStyle={styles.content}>
          <VixText heading="header" additionalStyle={styles.readTitle}>
            {note.title}
          </VixText>

          {/* Satu kolom, satu jarak: `gap` yang mengatur, bukan marginBottom
              tiap bagian. Bagian yang kosong (tak ada pembicara, tak ada
              quotes) tidak meninggalkan jarak menggantung — dan yang paling
              penting, bagian TERAKHIR tidak menambah jarak ke tombol di
              bawahnya. Dulu di sinilah 16-nya menumpuk. */}
          <View style={styles.readCol}>
            {note.preacher || note.serviceTime ? (
              <View style={styles.metaRow}>
                {note.preacher ? (
                  <VixText heading="label" additionalStyle={styles.metaChip}>
                    🎤 {note.preacher}
                  </VixText>
                ) : null}
                {note.serviceTime ? (
                  <VixText heading="label" additionalStyle={styles.metaChip}>
                    🕙 {note.serviceTime}
                  </VixText>
                ) : null}
                {!bisaDiubah ? (
                  <VixText heading="label" additionalStyle={styles.lockChip}>
                    🔒 Arsip
                  </VixText>
                ) : null}
              </View>
            ) : null}

            {note.quote ? (
              <View style={styles.quoteBox}>
                <VixText heading="paragraph" additionalStyle={styles.quoteText}>
                  “{note.quote}”
                </VixText>
              </View>
            ) : null}

            {/* Ketiga blok di bawah TIDAK memakai numberOfLines dan tidak
                memotong apa pun: teksnya utuh, enter yang kamu ketik ikut
                terbaca sebagai ganti baris. Inilah gunanya layar penuh. */}
            <ReadBlock label="📝 Catatan Khotbah" text={note.note ?? ''} />
            <ReadBlock label="🏃🏻‍➡️ Aplikasi" text={note.reflection} />
          </View>

          <ActionStack>
            <ShareWhatsAppButton
              onPress={() =>
                shareTextToWhatsApp(sermonShareText(note), () =>
                  setError(WHATSAPP_ERROR),
                )
              }
            />

            {/* Sambungkan khotbah ini ke acara CORE yang akan datang — bahan
                yang kamu terima Minggu jadi bahan yang kamu bawakan nanti. */}
            <ConnectCoreButton
              kind="sermon"
              noteId={note.id}
              title={note.title}
            />

            {/* Terkunci mulai Selasa — jadi tombol ubah cuma ada selama masih
                Minggu/Senin. Isinya tetap bisa dibaca & dibagikan selamanya. */}
            {bisaDiubah ? (
              <PressableScale
                style={styles.editButton}
                onPress={() => bukaForm(note)}>
                <VixText heading="bold" additionalStyle={styles.editText}>
                  ✏️ Ubah catatan
                </VixText>
              </PressableScale>
            ) : (
              <VixText heading="label" additionalStyle={styles.lockNote}>
                🔒 Arsip
              </VixText>
            )}
          </ActionStack>
        </ScrollView>
      ) : (
        /* Dokumennya tidak ada & masa isinya sudah lewat. */
        <VixText heading="label" additionalStyle={styles.empty}>
          Catatan untuk Minggu ini tidak ada, dan masa pengisiannya sudah lewat.
        </VixText>
      )}

      <ConfirmDialog
        visible={confirmDelete}
        title="Hapus catatan khotbah ini?"
        detail="Judul, quotes, catatan, & aplikasinya hilang selamanya dan tidak bisa dikembalikan."
        confirmLabel="Hapus permanen"
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

/**
 * Satu blok catatan panjang di mode baca. Tidak ditampilkan sama sekali kalau
 * kosong — lebih baik pendek daripada penuh judul tanpa isi.
 */
function ReadBlock({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <View>
      <VixText heading="label" additionalStyle={styles.readLabel}>
        {label}
      </VixText>
      <VixText heading="paragraph" additionalStyle={styles.readText}>
        {text}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  multiInput: { minHeight: 110, textAlignVertical: 'top', marginBottom: 12 },
  // Catatan khotbah = yang paling panjang, jadi kotaknya paling tinggi.
  multiInputTall: { minHeight: 260, textAlignVertical: 'top', marginBottom: 12 },
  deleteButton: { alignItems: 'center', paddingVertical: 12, marginBottom: 4 },
  deleteText: { color: Color.DANGER },
  // Mode baca
  readTitle: { color: Color.TEXT_TITLE, marginBottom: 8 },
  // Jarak antar bagian bacaan — satu angka untuk seluruh kolom.
  readCol: { gap: 16 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: {
    backgroundColor: Color.SPIRITUAL,
    color: Color.SPIRITUAL_DARK,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  lockChip: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    color: Color.TEXT_LABEL,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  quoteBox: {
    backgroundColor: Color.CONTAINER,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quoteText: { color: Color.TEXT_TITLE, fontStyle: 'italic' },
  readLabel: { color: Color.SPIRITUAL_DARK, marginBottom: 4 },
  readText: { color: Color.TEXT_PARAGRAPH },
  editButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  editText: { color: Color.SPIRITUAL_DARK },
  lockNote: { textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 40, paddingHorizontal: 30 },
});
