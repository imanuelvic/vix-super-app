import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SoftPill } from '@/components/common/SoftPill';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useDraft } from '@/hooks/useDraft';
import { useFormSave } from '@/hooks/useFormSave';
import {
    deleteMonthlyMeeting,
    emptyMonthlyPoints,
    MAX_MEETING_PHOTOS,
    MONTHLY_AGENDA_POINTS,
    newMonthlyMeetingId,
    pickMeetingPhoto,
    saveMonthlyMeeting,
    subscribeMonthlyMeetings,
    type MonthlyMeeting,
} from '@/lib/core';
import { MONTH_NAMES } from '@/lib/format';
import { DELETE_ERROR, LOAD_ERROR, PHOTO_ERROR } from '@/lib/messages';
import { notulenAiErrorMessage, rapikanNotulen } from '@/lib/notulenAi';
import { photoUri } from '@/lib/photo';

// Layar CATAT / UBAH NOTULEN 🗒️ — dibuka dari tombol "+ Buat Rapat Bulanan"
// atau pensil ✏️ di sub-tab Monthly CORE. `id` = 'new' berarti rapat baru.
//
// Kenapa layar sendiri, bukan sheet seperti dulu: isiannya lima blok teks
// panjang + foto, dan di sheet 3/4 layar semuanya berdesakan dengan keyboard.
// Di layar penuh ada dua hal yang selalu terjangkau tanpa menggulung:
//   · ✨ Rapihkan di kanan atas, sebaris dengan judul layar (header-nya di
//     luar gulungan, jadi tetap di tempat saat notulen digulung ke bawah);
//   · Batal/Simpan di footer bawah.
//
// Datanya dari langganan daftar yang SAMA dengan sub-tab Monthly di baliknya
// (liveList membagi satu listener), jadi membuka layar ini tidak menambah
// bacaan Firestore dan isiannya langsung terisi.
export default function MonthlyMeetingEditScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [meetings, setMeetings] = useState<MonthlyMeeting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  useEffect(() => {
    if (!user) return;
    return subscribeMonthlyMeetings(user.uid, setMeetings, () =>
      setError(LOAD_ERROR),
    );
  }, [user]);

  const meeting = isNew ? null : (meetings?.find((m) => m.id === id) ?? null);

  // Isian form. `useDraft` menyimpan HANYA yang kamu ketik — selama belum
  // disentuh, nilainya ikut data dari Firestore yang datang belakangan.
  const [today] = useState(() => new Date());
  const [fTitle, setFTitle] = useDraft(
    isNew
      ? `00. Meeting MCL CL - ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`
      : (meeting?.title ?? ''),
  );
  // Satu objek Date memuat tanggal SEKALIGUS jam mulai: DateField mengubah
  // tanggalnya (jamnya dipertahankan), TimeField mengubah jamnya.
  const [fDate, setFDate] = useDraft(meeting ? meeting.date.toDate() : today);
  const [fPlace, setFPlace] = useDraft(meeting?.place ?? '');
  const [fPoints, setFPoints] = useDraft<Record<string, string>>({
    ...emptyMonthlyPoints(),
    ...meeting?.points,
  });
  // Dokumentasi foto rapat — JPEG base64 kecil, ikut tercetak di PDF.
  const [fPhotos, setFPhotos] = useDraft<string[]>(meeting?.photos ?? []);
  const foto = useBusyTask<'foto'>();
  const photoBusy = foto.busy !== null;

  // ✨ Rapihkan: sedang menunggu jawaban Gemini (lib/notulenAi.ts).
  const [merapikan, setMerapikan] = useState(false);
  // Sudah berhasil dirapihkan di layar ini → tombolnya mati sampai layarnya
  // dibuka lagi. Click kedua cuma merapikan yang sudah rapi (dan memakai
  // kuota dua kali); kalau memang mau diulang, kembali lalu buka lagi.
  const [sudahRapi, setSudahRapi] = useState(false);

  // Kirim kelima bagian ke Gemini, terima versi kesimpulannya, isikan ke
  // kolom. Kolom TIDAK disimpan otomatis: kamu baca dulu, baru Simpan.
  async function handleRapikan() {
    if (merapikan || busy || sudahRapi) return;
    const adaIsi = MONTHLY_AGENDA_POINTS.some((p) => (fPoints[p.key] ?? '').trim());
    if (!adaIsi) {
      setFormError('Isi dulu catatannya, baru dirapikan.');
      return;
    }
    setMerapikan(true);
    setFormError(null);
    try {
      const rapi = await rapikanNotulen(fPoints);
      setFPoints((prev) => ({ ...prev, ...rapi }));
      setSudahRapi(true);
    } catch (e) {
      setFormError(notulenAiErrorMessage(e));
    } finally {
      setMerapikan(false);
    }
  }

  /** Tambah satu foto dokumentasi dari galeri (sudah dikecilkan otomatis). */
  function handleAddPhoto() {
    if (busy || fPhotos.length >= MAX_MEETING_PHOTOS) return;
    return foto.run({
      key: 'foto',
      task: async () => {
        const photo = await pickMeetingPhoto();
        if (photo) setFPhotos((prev) => [...prev, photo]);
      },
      fail: () => setFormError(PHOTO_ERROR),
    });
  }

  async function handleSave() {
    if (!user || busy) return;
    if (!fTitle.trim()) {
      setFormError('Judul rapat wajib diisi.');
      return;
    }
    await save(async () => {
      await saveMonthlyMeeting(user.uid, isNew ? newMonthlyMeetingId() : id, {
        title: fTitle.trim(),
        date: fDate,
        place: fPlace.trim(),
        // Rapikan spasi di ujung tiap poin sebelum disimpan.
        points: Object.fromEntries(
          MONTHLY_AGENDA_POINTS.map((p) => [p.key, (fPoints[p.key] ?? '').trim()]),
        ),
        photos: fPhotos,
      });
      router.back();
    });
  }

  async function handleDelete() {
    if (!user || isNew || busy) return;
    setBusy(true);
    try {
      await deleteMonthlyMeeting(user.uid, id);
      router.back();
    } catch {
      setFormError(DELETE_ERROR);
      setBusy(false);
    }
  }

  // Notulen lama: tunggu datanya dulu, kalau tidak isiannya sempat kosong.
  const loading = !isNew && meetings === null && !error;
  // Sudah termuat tapi tidak ada (dihapus dari perangkat lain) atau gagal
  // dimuat → tampilkan pesannya, bukan form kosong.
  const hilang = !isNew && !loading && meeting === null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="CORE"
        title={isNew ? 'Catat Rapat' : 'Ubah Notulen'}
        subtitle={isNew ? 'Notulen mentoring bulanan yang baru' : fTitle || 'Notulen'}
        // ✨ Rapihkan: tulisan cepat saat rapat → kesimpulan rapi, tetap lima
        // bagian yang sama. Dikerjakan Gemini lewat Firebase AI Logic, kuota
        // gratis paket Spark (lib/notulenAi.ts). Hasilnya langsung mengisi
        // kelima kolom; Simpan tetap di tanganmu. Sekali click per layar
        // (lihat sudahRapi). Duduk di header supaya tidak ikut tergulung.
        right={
          hilang ? undefined : (
            <SoftPill
              label={
                merapikan ? 'Merapihkan…' : sudahRapi ? '✓ Sudah rapi' : '✨ Rapihkan'
              }
              busy={merapikan}
              disabled={busy || sudahRapi || loading}
              onPress={handleRapikan}
              additionalStyle={sudahRapi && styles.rapikanDone}
            />
          )
        }
      />

      {loading ? (
        <LoadingCenter />
      ) : hilang ? (
        <VixText heading="label" additionalStyle={styles.empty}>
          {error ?? 'Notulen ini sudah tidak ada.'}
        </VixText>
      ) : (
        <>
          <KeyboardAwareScrollView contentContainerStyle={styles.content}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              🏷️ Judul rapat
            </VixText>
            <FormInput
              style={styles.formGap}
              placeholder="Judul rapat"
              value={fTitle}
              onChangeText={setFTitle}
              editable={!busy}
            />

            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              📆 Tanggal rapat
            </VixText>
            <View style={styles.formGap}>
              <DateField value={fDate} onChange={setFDate} />
            </View>

            {/* Jam mulai — menempel di objek Date yang sama dengan tanggal di
                atas, jadi keduanya tersimpan sebagai SATU field. */}
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              🕒 Jam mulai
            </VixText>
            <View style={styles.formGap}>
              <TimeField value={fDate} onChange={setFDate} />
            </View>

            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              📍 Tempat
            </VixText>
            <FormInput
              style={styles.formGap}
              placeholder="Nama tempat"
              value={fPlace}
              onChangeText={setFPlace}
              editable={!busy}
            />

            {MONTHLY_AGENDA_POINTS.map((p) => (
              <View key={p.key}>
                <VixText heading="label" additionalStyle={styles.fieldLabel}>
                  {p.icon} {p.label}
                </VixText>
                <FormInput
                  style={[styles.textArea, styles.formGap]}
                  placeholder={p.hint}
                  value={fPoints[p.key] ?? ''}
                  onChangeText={(text) =>
                    setFPoints((prev) => ({ ...prev, [p.key]: text }))
                  }
                  editable={!busy && !merapikan}
                  multiline
                />
              </View>
            ))}

            {/* Dokumentasi rapat — ikut tercetak di PDF sebagai bukti foto.
                Dibatasi {MAX_MEETING_PHOTOS} biar dokumen notulennya tetap ringan. */}
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              📸 Dokumentasi rapat (opsional), {fPhotos.length}/
              {MAX_MEETING_PHOTOS}
            </VixText>
            <View style={styles.photoWrap}>
              {fPhotos.map((photo, i) => (
                <View key={`${i}-${photo.slice(0, 16)}`} style={styles.photoBox}>
                  <Image
                    source={{ uri: photoUri(photo) }}
                    style={styles.photoFill}
                    resizeMode="cover"
                  />
                  <PressableScale
                    style={styles.photoRemove}
                    hitSlop={6}
                    onPress={() =>
                      setFPhotos((prev) => prev.filter((_, x) => x !== i))
                    }>
                    <VixText heading="bold" additionalStyle={styles.photoRemoveText}>
                      ✕
                    </VixText>
                  </PressableScale>
                </View>
              ))}
              {fPhotos.length < MAX_MEETING_PHOTOS && (
                <PressableScale
                  style={[styles.photoBox, styles.photoAdd]}
                  onPress={handleAddPhoto}
                  disabled={photoBusy || busy}>
                  {photoBusy ? (
                    <ActivityIndicator color={Color.MAIN} />
                  ) : (
                    <VixText heading="label" additionalStyle={styles.photoAddText}>
                      📸{'\n'}Tambah
                    </VixText>
                  )}
                </PressableScale>
              )}
            </View>

            {!isNew && (
              <InlineDelete
                label="Hapus notulen ini"
                busy={busy}
                onDelete={handleDelete}
              />
            )}
          </KeyboardAwareScrollView>

          {/* Pesan gagal ikut di footer, bukan di ujung gulungan: sumbernya
              bisa dari ✨ di paling atas (kuota, offline) maupun Simpan di
              paling bawah, jadi harus terlihat di posisi gulung mana pun. */}
          <View style={styles.footer}>
            <FormError message={formError} />
            <DualButtons
              confirmLabel="Simpan"
              busy={busy}
              onCancel={() => router.back()}
              onConfirm={handleSave}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 24, paddingHorizontal: 20 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  // Sudah dipakai → pudar, supaya terbaca "tidak bisa lagi", bukan "belum".
  rapikanDone: { opacity: 0.5 },
  // Petak foto: thumbnail berjajar + satu kotak "Tambah" di ujungnya.
  photoWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  photoBox: {
    width: 96,
    height: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.BACKGROUND,
    overflow: 'hidden',
  },
  photoFill: { width: '100%', height: '100%' },
  // Tombol ✕ menempel di pojok foto — hapus foto ini dari daftar.
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Color.DANGER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: Color.TEXT_REVERSE, fontSize: 12, lineHeight: 16 },
  photoAdd: {
    borderStyle: 'dashed',
    borderColor: Color.MAIN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { textAlign: 'center', color: Color.MAIN },
  // Batal/Simpan dipatok di bawah layar — sama seperti footer SheetModal,
  // jadi rasanya tidak berubah dari sheet yang dulu.
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    backgroundColor: Color.BACKGROUND,
  },
});
