import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditButton } from '@/components/common/EditButton';
import { EditDelete } from '@/components/common/EditDelete';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SearchBar } from '@/components/common/SearchBar';
import { SheetModal } from '@/components/common/SheetModal';
import { StickyTop } from '@/components/common/StickyTop';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import {
  deleteMonthlyMeeting,
  emptyMonthlyPoints,
  MAX_MEETING_PHOTOS,
  MONTHLY_AGENDA_POINTS,
  newMonthlyMeetingId,
  pickMeetingPhoto,
  saveMonthlyMeeting,
  type MonthlyMeeting,
} from '@/lib/core';
import { formatCompactDateTime, MONTH_NAMES } from '@/lib/format';
import { DELETE_ERROR, PHOTO_ERROR, SAVE_ERROR } from '@/lib/messages';
import { shareMonthlyPdf } from '@/lib/monthlyPdf';

// Sub-tab 🗒️ Monthly — notulen Mentoring Bulanan dari gereja.
// Susunan agendanya selalu 5 poin yang sama (MENTORSHIP · LEADER'S MESSAGE ·
// NDC INFORMATION · CORE · OUR EVENTS), jadi kolomnya sudah disiapkan dan
// tinggal diisi — tidak perlu mengetik ulang judul poinnya tiap rapat.
export function MonthlyTab({ meetings }: { meetings: MonthlyMeeting[] }) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kartu yang sedang dibentangkan (rapat lama default tertutup biar ringkas).
  const [openId, setOpenId] = useState<string | null>(null);

  // Mode cari 🔍 — sama seperti sub-tab Pertemuan & Transaksi di Finance.
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');

  // Form tambah/edit.
  const [editing, setEditing] = useState<MonthlyMeeting | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  // Satu objek Date memuat tanggal SEKALIGUS jam mulai: DateField mengubah
  // tanggalnya (jamnya dipertahankan), TimeField mengubah jamnya.
  const [fDate, setFDate] = useState(new Date());
  const [fPlace, setFPlace] = useState('');
  const [fPoints, setFPoints] = useState<Record<string, string>>(
    emptyMonthlyPoints(),
  );
  // Dokumentasi foto rapat — JPEG base64 kecil, ikut tercetak di PDF.
  const [fPhotos, setFPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Notulen yang PDF-nya sedang dibuat (null = tidak ada).
  const [sharingId, setSharingId] = useState<string | null>(null);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown =
    words.length === 0
      ? meetings
      : meetings.filter((m) => {
          const hay = `${m.title} ${MONTHLY_AGENDA_POINTS.map(
            (p) => m.points[p.key] ?? '',
          ).join(' ')}`.toLowerCase();
          return words.every((w) => hay.includes(w));
        });

  // Halaman notulen — sama seperti daftar panjang lain di app ini.
  const { currentPage, pageCount, pageItems, setPage } = usePagination(shown);

  function toggleSearch() {
    setSearchMode((on) => !on);
    setQuery('');
  }

  function openAdd() {
    const now = new Date();
    setEditing('new');
    setFTitle(`00. Meeting MCL CL - ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`);
    setFDate(now);
    setFPlace('');
    setFPoints(emptyMonthlyPoints());
    setFPhotos([]);
    setFormError(null);
  }

  function openEdit(m: MonthlyMeeting) {
    setEditing(m);
    setFTitle(m.title);
    setFDate(m.date.toDate());
    setFPlace(m.place);
    setFPoints({ ...emptyMonthlyPoints(), ...m.points });
    setFPhotos(m.photos);
    setFormError(null);
  }

  /** Tambah satu foto dokumentasi dari galeri (sudah dikecilkan otomatis). */
  async function handleAddPhoto() {
    if (photoBusy || busy || fPhotos.length >= MAX_MEETING_PHOTOS) return;
    setPhotoBusy(true);
    try {
      const photo = await pickMeetingPhoto();
      if (photo) setFPhotos((prev) => [...prev, photo]);
    } catch {
      setFormError(PHOTO_ERROR);
    } finally {
      setPhotoBusy(false);
    }
  }

  /** Cetak notulen jadi PDF lalu buka share sheet (ada WhatsApp di dalamnya). */
  async function handleShare(m: MonthlyMeeting) {
    if (sharingId) return;
    setSharingId(m.id);
    setError(null);
    try {
      await shareMonthlyPdf(m);
    } catch {
      setError('Gagal membuat PDF notulen. Coba lagi.');
    } finally {
      setSharingId(null);
    }
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Judul rapat wajib diisi.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await saveMonthlyMeeting(
        user.uid,
        editing === 'new' ? newMonthlyMeetingId() : editing.id,
        {
          title: fTitle.trim(),
          date: fDate,
          place: fPlace.trim(),
          // Rapikan spasi di ujung tiap poin sebelum disimpan.
          points: Object.fromEntries(
            MONTHLY_AGENDA_POINTS.map((p) => [
              p.key,
              (fPoints[p.key] ?? '').trim(),
            ]),
          ),
          photos: fPhotos,
        },
      );
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
      await deleteMonthlyMeeting(user.uid, editing.id);
      setEditing(null);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function renderCard(m: MonthlyMeeting) {
    const expanded = openId === m.id;
    return (
      <View key={m.id} style={styles.card}>
        {/* Semua tombol ada DI ATAS, sebaris dengan judul — tak perlu
            menggulung notulen yang panjang dulu untuk bisa mengubah atau
            mengirimnya. Tombolnya sengaja jadi SAUDARA dari area click, bukan
            anaknya: Pressable bersarang di iOS bikin click tombolnya ikut
            membuka/menutup kartu.
            Panah buka/tutup tidak dipakai lagi — seluruh blok judul memang
            sudah jadi sakelarnya, jadi panahnya cuma memakan tempat. */}
        <View style={styles.cardHeader}>
          <PressableScale
            style={styles.cardMain}
            onPress={() => setOpenId(expanded ? null : m.id)}>
            <VixText heading="bold" additionalStyle={styles.cardTitle}>
              {m.title}
            </VixText>
            {/* Bentuk tanggal+jam ini dipakai bersama kartu jadwal visitasi —
                lihat formatCompactDateTime di lib/format. */}
            <VixText heading="label" additionalStyle={styles.cardDate}>
              📆 {formatCompactDateTime(m.date.toDate())}
            </VixText>
            {m.place ? (
              <VixText heading="label" additionalStyle={styles.cardDate}>
                📍 {m.place}
              </VixText>
            ) : null}
            {/* Penanda ada dokumentasi walau kartunya masih tertutup */}
            {m.photos.length > 0 ? (
              <VixText heading="label" additionalStyle={styles.cardDate}>
                📸 {m.photos.length} foto dokumentasi
              </VixText>
            ) : null}
          </PressableScale>
          <EditButton onPress={() => openEdit(m)} />
          {/* Cetak jadi PDF lalu buka share sheet — WhatsApp ada di situ */}
          <EmojiButton
            icon="square.and.arrow.up"
            onPress={() => handleShare(m)}
            busy={sharingId === m.id}
            disabled={sharingId !== null}
          />
        </View>

        {expanded && (
          // Isi notulennya sendiri jadi sakelar TUTUP. Notulen yang panjang
          // membuat judulnya (sakelar buka/tutup) tergulung jauh ke atas —
          // tanpa ini harus scroll balik ke atas dulu cuma untuk menutupnya.
          // Mengecilnya dibuat samar (0.99): yang ditekan sebidang kartu, bukan
          // tombol kecil.
          <PressableScale
            style={styles.cardBody}
            scaleTo={0.99}
            onPress={() => setOpenId(null)}>
            {/* Dokumentasi rapat — bukti fotonya, sama yang ikut ke PDF */}
            {m.photos.map((photo, i) => (
              <Image
                key={`${i}-${photo.slice(0, 16)}`}
                source={{ uri: `data:image/jpeg;base64,${photo}` }}
                style={styles.cardPhoto}
                resizeMode="cover"
              />
            ))}
            {MONTHLY_AGENDA_POINTS.map((p) => {
              const text = (m.points[p.key] ?? '').trim();
              return (
                <View key={p.key} style={styles.pointBlock}>
                  <VixText heading="title" additionalStyle={styles.pointLabel}>
                    {p.icon} {p.label}
                  </VixText>
                  <VixText
                    heading="paragraph"
                    additionalStyle={text ? styles.pointText : styles.pointEmpty}>
                    {text || '—'}
                  </VixText>
                </View>
              );
            })}
          </PressableScale>
        )}
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Dipatok di atas: tombol buat rapat (atau kolom cari) selalu terjangkau,
          tidak ikut hilang ke atas saat notulen digulung ke bawah. */}
      <StickyTop>
        {searchMode ? (
          <View style={styles.searchWrap}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Cari judul atau isi notulen…"
              autoFocus
            />
          </View>
        ) : (
          <PrimaryButton
            label="Buat Rapat Bulanan"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addButton}
          />
        )}
      </StickyTop>

      {/* key = halaman → balik ke atas tiap ganti halaman; ganti mode cari juga
          mengosongkan daftarnya. SearchBar sendiri sudah aman dari mount ulang
          karena sekarang ada di luar ScrollView ini. */}
      <ScrollView
        key={searchMode ? 'search' : currentPage}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <FormError message={error} />

        {shown.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            {words.length > 0
              ? `Tidak ada notulen yang cocok dengan “${query.trim()}”.`
              : 'Belum ada notulen. Catat rapat mentoring bulan ini 🗒️'}
          </VixText>
        ) : (
          <>
            {pageItems.map(renderCard)}
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={setPage}
            />
          </>
        )}
      </ScrollView>

      {/* FAB mengambang: buka/tutup mode cari 🔍 */}
      <PressableScale style={styles.fab} onPress={toggleSearch}>
        <IconSymbol
          name={searchMode ? 'xmark' : 'magnifyingglass'}
          size={24}
          color={Color.TEXT_REVERSE}
        />
      </PressableScale>

      {/* Sheet tambah / edit notulen */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catat Rapat Bulanan' : 'Ubah Notulen'}
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏷️ Judul rapat
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Mentoring Agustus 2026"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📆 Tanggal rapat
        </VixText>
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal reset tiap ganti rapat */}
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>

        {/* Jam mulai — menempel di objek Date yang sama dengan tanggal di atas,
            jadi keduanya tersimpan sebagai SATU field. */}
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🕒 Jam mulai
        </VixText>
        <View style={styles.formGap}>
          <TimeField
            key={`t-${editing === 'new' ? 'new' : editing?.id}`}
            value={fDate}
            onChange={setFDate}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📍 Tempat
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Gereja NDC lt. 3"
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
              editable={!busy}
              multiline
            />
          </View>
        ))}

        {/* Dokumentasi rapat — ikut tercetak di PDF sebagai bukti foto.
            Dibatasi {MAX_MEETING_PHOTOS} biar dokumen notulennya tetap ringan. */}
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📸 Dokumentasi rapat (opsional) — {fPhotos.length}/
          {MAX_MEETING_PHOTOS}
        </VixText>
        <View style={styles.photoWrap}>
          {fPhotos.map((photo, i) => (
            <View key={`${i}-${photo.slice(0, 16)}`} style={styles.photoBox}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${photo}` }}
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

        <FormError message={formError} />
        <EditDelete
          editing={editing}
          label="Hapus notulen ini"
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
  // paddingTop 0 — jarak atasnya sudah dipegang StickyTop di atas daftar ini.
  // paddingBottom lega supaya kartu terakhir tidak tertutup FAB.
  content: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 90 },
  addButton: { marginBottom: 12 },
  searchWrap: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 10 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  // Judul (area click buka/tutup) + tombol-tombolnya, semua di baris paling
  // atas. 'flex-start' menahan tombol tetap di KANAN ATAS walau judulnya
  // memanjang jadi beberapa baris.
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: Color.TEXT_TITLE },
  cardDate: { color: Color.TEXT_LABEL },
  cardBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    gap: 10,
  },
  pointBlock: { gap: 1 },
  pointLabel: { color: Color.MAIN_DARK, marginTop: 10, },
  pointText: { color: Color.TEXT_PARAGRAPH },
  pointEmpty: { color: Color.TEXT_PLACEHOLDER },
  // Foto dokumentasi di dalam kartu — selebar kartu, ditumpuk ke bawah.
  cardPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: Color.BORDER,
  },
  // Petak foto di form: thumbnail berjajar + satu kotak "Tambah" di ujungnya.
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
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
});
