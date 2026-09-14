import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { EditButton } from '@/components/common/EditButton';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormError } from '@/components/common/FormError';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SearchBar } from '@/components/common/SearchBar';
import { StickyTop } from '@/components/common/StickyTop';
import { VixText } from '@/components/common/VixText';
import { LinkedNotesButton } from '@/components/core/LinkedNotesButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useBusyTask } from '@/hooks/useBusyTask';
import { usePagination } from '@/hooks/usePagination';
import { useSearchMode } from '@/hooks/useSearchMode';
import { MONTHLY_AGENDA_POINTS, type MonthlyMeeting } from '@/lib/core';
import {
    EMPTY_CORE_NOTE_LINKS,
    subscribeCoreNoteLinks,
    type CoreNoteLinks,
} from '@/lib/coreNotes';
import { formatCompactDateTime } from '@/lib/format';
import { shareMonthlyPdf } from '@/lib/monthlyPdf';
import { photoUri } from '@/lib/photo';

// Sub-tab 🗒️ Monthly — notulen Mentoring Bulanan dari gereja.
// Susunan agendanya selalu 5 poin yang sama (MENTORSHIP · LEADER'S MESSAGE ·
// NDC INFORMATION · CORE · OUR EVENTS), jadi kolomnya sudah disiapkan dan
// tinggal diisi — tidak perlu mengetik ulang judul poinnya tiap rapat.
//
// Di sini cuma DAFTARNYA (+ cari, PDF, tautan catatan). Mencatat & mengubah
// notulen ada di layarnya sendiri, app/core/monthly/[id].tsx — isiannya
// terlalu panjang untuk sheet, dan di sana tombol ✨ Rapihkan bisa dipatok di
// header.
export function MonthlyTab({ meetings }: { meetings: MonthlyMeeting[] }) {
  const router = useRouter();
  const { user } = useAuth();

  // Catatan Revive/Khotbah yang disambungkan ke rapat — untuk tombol 🔗.
  // Dilanggan di sini, bukan dioper dari layarnya: dokumennya SATU dan
  // liveDoc menggabungkan langganan dokumen yang sama, jadi sub-tab Visitation
  // yang juga membacanya tidak menambah biaya baca sama sekali.
  const [noteLinks, setNoteLinks] = useState<CoreNoteLinks>(
    EMPTY_CORE_NOTE_LINKS,
  );
  useEffect(() => {
    if (!user) return;
    return subscribeCoreNoteLinks(user.uid, setNoteLinks);
  }, [user]);

  const [error, setError] = useState<string | null>(null);
  // Kartu yang sedang dibentangkan (rapat lama default tertutup biar ringkas).
  const [openId, setOpenId] = useState<string | null>(null);

  // Mode cari 🔍 — sama seperti sub-tab Pertemuan & Transaksi di Finance.
  const { searchMode, query, setQuery, toggleSearch } = useSearchMode();

  // Notulen yang PDF-nya sedang dibuat (null = tidak ada).
  const pdf = useBusyTask();

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

  /** Layar catat/ubah notulen; 'new' = rapat baru. */
  function openEditor(id: string) {
    router.push({ pathname: '/core/monthly/[id]', params: { id } });
  }

  /** Cetak notulen jadi PDF lalu buka share sheet (ada WhatsApp di dalamnya). */
  function handleShare(m: MonthlyMeeting) {
    return pdf.run({
      key: m.id,
      start: () => setError(null),
      task: () => shareMonthlyPdf(m),
      fail: () => setError('Gagal membuat PDF notulen. Coba lagi.'),
    });
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
          <EditButton onPress={() => openEditor(m.id)} />
          {/* Cetak jadi PDF lalu buka share sheet — WhatsApp ada di situ */}
          <EmojiButton
            icon="square.and.arrow.up"
            onPress={() => handleShare(m)}
            busy={pdf.busy === m.id}
            disabled={pdf.busy !== null}
          />
          {/* 🔗 muncul HANYA kalau ada Catatan Revive / Khotbah yang kamu
              sambungkan ke rapat ini dari fitur Spiritual. */}
          <LinkedNotesButton links={noteLinks} coreId={m.id} />
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
                source={{ uri: photoUri(photo) }}
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
                    {text || '-'}
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
            onPress={() => openEditor('new')}
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
});
