import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { BibleRefField } from '@/components/common/BibleRefField';
import { CheckCircle } from '@/components/common/CheckCircle';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useDraft } from '@/hooks/useDraft';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
    deletePromise,
    newPromiseId,
    promiseWaitDays,
    savePromise,
    subscribePromises,
    type Promise as HisPromise,
} from '@/lib/promise';

// Tulis Janji Tuhan 🚩 — LAYAR sendiri, bukan bottom sheet.
//
// Dua alasan, dan keduanya soal isi: ceritanya bisa panjang (bagaimana janji
// ini kamu terima, apa yang Tuhan kerjakan sejak itu), dan pemilih kitab untuk
// ayatnya SENDIRI sebuah modal — modal di atas modal tidak andal di iOS.
//
// Satu layar dua keadaan: janji baru (tanpa ?id=) & janji lama yang diubah.
export default function PromiseScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ?? '';

  // Daftarnya di-subscribe lagi di sini — dan itu TIDAK menambah pembacaan
  // Firestore: kuerinya sama persis dengan yang dipakai sub-tab His Promise,
  // dan liveList berbagi satu pendengar untuk kueri yang sama (lihat
  // `queryEqual` di lib/liveDoc.ts).
  const [list, setList] = useState<HisPromise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribePromises(user.uid, setList, () => setError(LOAD_ERROR));
  }, [user]);

  const janji = editId ? (list?.find((p) => p.id === editId) ?? null) : null;
  // Janji baru tidak perlu menunggu daftarnya sampai — formulirnya kosong.
  const memuat = !!editId && list === null;

  // Isian. Ikut data tersimpan SELAMA belum diketik; begitu diketik, ketikan
  // itu yang menang (hook bersama useDraft) — jadi snapshot berikutnya tidak
  // menimpa apa yang sedang kamu tulis.
  const [fPromise, setFPromise] = useDraft(janji?.promise ?? '');
  const [fVerse, setFVerse] = useDraft(janji?.verse ?? '');
  const [fStruggle, setFStruggle] = useDraft(janji?.struggle ?? '');
  const [fStory, setFStory] = useDraft(janji?.story ?? '');
  const [fPrayed, setFPrayed] = useDraft(janji?.prayed ?? false);
  const [fAnswered, setFAnswered] = useDraft<Date | null>(
    janji?.answeredId ? dayIdToDate(janji.answeredId) : null,
  );

  const menunggu = janji ? promiseWaitDays(janji) : null;

  async function simpan() {
    if (!user || busy) return;
    if (!fPromise.trim()) {
      setFormError('Tulis dulu janji Tuhan yang kamu pegang.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await savePromise(
        user.uid,
        editId || newPromiseId(),
        {
          promise: fPromise.trim(),
          verse: fVerse.trim(),
          struggle: fStruggle.trim(),
          story: fStory.trim(),
          prayed: fPrayed,
          answeredId: fAnswered ? dayDocId(fAnswered) : '',
        },
        { baru: !editId },
      );
      router.back();
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function hapus() {
    if (!user || !editId || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await deletePromise(user.uid, editId);
      router.back();
    } catch {
      setFormError(DELETE_ERROR);
    } finally {
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Spiritual"
        title={editId ? 'Ubah Janji 🚩' : 'Janji Tuhan 🚩'}
        subtitle="Yang Dia katakan, Dia genapi"
      />

      <ScreenError message={error} />

      {memuat ? (
        <LoadingCenter />
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={styles.content}>
          {/* ===== Perjalanan janji ini =====
              Ketiga tanggalnya ditulis app, bukan diketik: kapan kamu
              menerimanya, kapan terakhir disentuh, dan berapa lama menunggu.
              Cuma muncul pada janji yang MEMANG sudah pernah tersimpan. */}
          {janji ? (
            <View style={styles.riwayat}>
              <VixText heading="label" additionalStyle={styles.riwayatText}>
                ✍️ Ditulis {formatShortDayDate(dayIdToDate(janji.createdId))}
                {janji.updatedId && janji.updatedId !== janji.createdId
                  ? `  ·  🔄 Diperbarui ${formatShortDayDate(dayIdToDate(janji.updatedId))}`
                  : ''}
              </VixText>
              {menunggu !== null && (
                <VixText heading="label" additionalStyle={styles.riwayatDone}>
                  🙌 Digenapi setelah menunggu {menunggu} hari
                </VixText>
              )}
            </View>
          ) : null}

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            🚩 Janji Tuhan apa?
          </VixText>
          <FormInput
            placeholder="mis. Tuhan menyediakan rumah untuk keluargaku"
            value={fPromise}
            onChangeText={setFPromise}
            editable={!busy}
            multiline
            style={styles.promiseInput}
          />

          <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.gap]}>
            📖 Fakta ayatnya di mana?
          </VixText>
          {/* Ayatnya PERSIS, bukan cuma pasalnya: sebuah janji berdiri di satu
              kalimat tertentu, dan kalimat itulah yang mau kamu buka lagi
              bertahun-tahun kemudian. */}
          <BibleRefField value={fVerse} onChange={setFVerse} editable={!busy} />

          <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.gap]}>
            💭 Pergumulan yang relate (opsional)
          </VixText>
          <FormInput
            placeholder="Apa yang sedang kamu hadapi waktu janji ini datang?"
            value={fStruggle}
            onChangeText={setFStruggle}
            editable={!busy}
            multiline
            style={styles.noteInput}
          />

          <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.gap]}>
            📝 Ceritakan keterangannya
          </VixText>
          <FormInput
            placeholder="Bagaimana janji ini kamu terima, dan apa yang Tuhan kerjakan sejak itu?"
            value={fStory}
            onChangeText={setFStory}
            editable={!busy}
            multiline
            style={styles.storyInput}
          />

          {/* ===== Doa & jawabannya =====
              Tanggal terjawabnya baru ditanyakan SESUDAH kamu bilang ada
              doanya — menanyakan "terjawab kapan" untuk janji yang belum
              pernah didoakan cuma kolom yang tak punya jawaban. */}
          <PressableScale
            style={[styles.prayRow, styles.gap]}
            onPress={() => !busy && setFPrayed(!fPrayed)}
            disabled={busy}
            haptic={fPrayed ? 'light' : 'success'}>
            <CheckCircle checked={fPrayed} />
            <View style={styles.prayMain}>
              <VixText heading="bold" additionalStyle={styles.prayTitle}>
                🙏 Ada doa perihal janji ini
              </VixText>
              <VixText heading="label">
                Nyalakan kalau kamu memang mendoakannya secara khusus.
              </VixText>
            </View>
          </PressableScale>

          {fPrayed && (
            <>
              <VixText
                heading="label"
                additionalStyle={[styles.fieldLabel, styles.gap]}>
                🙌 Doanya terjawab kapan? (opsional)
              </VixText>
              <DateField
                value={fAnswered}
                onChange={setFAnswered}
                placeholder="Belum terjawab — biarkan kosong"
                disabled={busy}
              />
            </>
          )}

          <FormError message={formError} gap="top" />

          <View style={styles.footer}>
            <DualButtons
              confirmLabel={editId ? 'Simpan' : 'Tulis Janji'}
              busy={busy}
              onCancel={() => router.back()}
              onConfirm={simpan}
            />
          </View>

          {/* Hapus PERMANEN — janji yang dihapus tidak diarsipkan di mana pun. */}
          {editId ? (
            <EditDelete
              editing={janji}
              label="Hapus janji ini"
              busy={busy}
              onDelete={() => setConfirmDelete(true)}
            />
          ) : null}
        </KeyboardAwareScrollView>
      )}

      <ConfirmDialog
        visible={confirmDelete}
        title="Hapus janji ini?"
        detail="Catatannya hilang permanen — tanggal & ceritanya tidak bisa dikembalikan."
        confirmLabel="Hapus"
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={hapus}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  // Riwayat tanggalnya: keterangan, bukan isian — jadi dibedakan dengan latar
  // krem, bukan kotak isian berbingkai.
  riwayat: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    marginBottom: 14,
  },
  riwayatText: { color: Color.TEXT_LABEL },
  riwayatDone: { color: Color.MAIN_DARK },
  fieldLabel: { marginBottom: 6 },
  gap: { marginTop: 14 },
  promiseInput: { minHeight: 68, textAlignVertical: 'top' },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  storyInput: { minHeight: 140, textAlignVertical: 'top' },
  prayRow: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prayMain: { flex: 1, minWidth: 0, gap: 2 },
  prayTitle: { color: Color.TEXT_TITLE },
  footer: { marginTop: 18 },
});
