import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import {
  GRATITUDE_PAGE,
  rescueGratitude,
  subscribeGratitudeDays,
  type GratitudeDay,
} from '@/lib/gratitude';
import {
  filledNoteLines,
  isGratitudeHabit,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import { subscribeHabitNotes, type HabitNotes } from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';

// Riwayat Syukur 🙏 — kumpulan "3 hal yang aku syukuri", hari terbaru dulu.
//
// Sumbernya sekarang arsipnya SENDIRI (users/{uid}/gratitude/{hari}), bukan
// lagi catatan kebiasaan yang kuncinya id baris — alasan lengkapnya di
// lib/gratitude.ts. Ringkasnya: mengganti nama atau membuat ulang baris
// "🙏 Bersyukur 3 Hal" dulu memutus seluruh arsip sekaligus, diam-diam.
//
// Catatan kebiasaannya masih ikut dibaca, dan itu bukan sisa: di situlah
// catatan LAMA berada. Yang ditemukan di sana tapi belum ada di arsip langsung
// dipindahkan sekali jalan (`rescueGratitude`), jadi tidak ada satu hari pun
// yang tertinggal di tempat lama.
//
// Tidak ada hari yang dibuang: tiap hari dokumennya sendiri, selamanya. Yang
// dibatasi cuma sejauh apa yang DITARIK sekali angkat (GRATITUDE_PAGE) —
// sisanya menyusul lewat tombol di bawah daftar.
export default function GratitudeScreen() {
  const { user } = useAuth();

  const [habits, setHabits] = useState<ScheduledHabit[] | null>(null);
  const [notes, setNotes] = useState<HabitNotes | null>(null);
  const [arsip, setArsip] = useState<GratitudeDay[] | null>(null);
  // Sejauh mana riwayatnya ditarik. Naik sejendela tiap tombolnya di-klik.
  const [jendela, setJendela] = useState(GRATITUDE_PAGE);
  const [menarik, setMenarik] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Id barisnya tidak ditulis di kode: daftar kebiasaan itu datamu, dan id-nya
  // lahir saat baris itu dibuat. Sekarang ia dipakai HANYA untuk membaca
  // catatan lama — arsipnya sendiri tidak lagi bergantung padanya.
  //
  // Yang dipakai jadi dependency efek di bawah: ID-nya, BUKAN objeknya.
  // `habits` datang dari Firestore, dan tiap snapshot melahirkan objek baru —
  // termasuk saat isinya tidak berubah. Dengan objeknya sebagai dependency,
  // efeknya memasang ulang langganan tiap snapshot, dan tiap pemasangan ulang
  // membaca sampai 120 dokumen habitDays lagi.
  const gratitudeId = habits?.find(isGratitudeHabit)?.id ?? null;

  // Galatnya DIBERSIHKAN tiap data baru sampai — bukan cuma dipasang saat
  // gagal. Tanpa itu, satu kegagalan sekejap (mis. sinyal putus sedetik saat
  // layar dibuka) menempel selamanya: pesan "Gagal memuat data" tetap
  // terpampang di atas daftar syukur yang sebenarnya sudah tampil di bawahnya.
  useEffect(() => {
    if (!user) return;
    return subscribeHabitSchedule(
      user.uid,
      (next) => {
        setHabits(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeGratitudeDays(
      user.uid,
      (next) => {
        setArsip(next);
        setMenarik(false);
        setError(null);
      },
      () => {
        setMenarik(false);
        setError(LOAD_ERROR);
      },
      jendela,
    );
  }, [user, jendela]);

  useEffect(() => {
    if (!user || !gratitudeId) return;
    return subscribeHabitNotes(
      user.uid,
      gratitudeId,
      (next) => {
        setNotes(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
      jendela,
    );
  }, [user, gratitudeId, jendela]);

  const baru = arsip ?? [];
  const lama = notes?.days ?? [];
  // Arsip sendiri MENANG kalau harinya ada di dua tempat: itulah yang ditulis
  // paling akhir, dan yang tidak bisa lagi putus dari barisnya.
  const isi = [
    ...baru,
    ...lama.filter((d) => !baru.some((b) => b.dayId === d.dayId)),
  ].sort((a, b) => b.dayId.localeCompare(a.dayId));

  // Pindahkan yang masih tertinggal di catatan kebiasaan — SEKALI saja per
  // layar dibuka, dan hanya hari yang memang belum ada di arsip. Kalau tidak
  // ada yang kurang, tidak ada tulis sama sekali (keadaan normal sesudah
  // pemindahan pertama).
  //
  // Penandanya dipasang SEBELUM menulis: menulis ke arsip memicu snapshot baru
  // → efek ini jalan lagi → tanpa penanda, ia bisa menulis berkali-kali.
  const dipindah = useRef(false);
  useEffect(() => {
    if (dipindah.current || !user || arsip === null || notes === null) return;
    const kurang = notes.days.filter(
      (d) => d.text.trim() && !arsip.some((b) => b.dayId === d.dayId),
    );
    dipindah.current = true;
    if (kurang.length === 0) return;
    rescueGratitude(user.uid, kurang).catch(() => undefined);
  }, [user, arsip, notes]);

  const { setPage, currentPage, pageCount, pageItems } = usePagination(isi);
  const totalHal = isi.reduce((n, d) => n + filledNoteLines(d.text).length, 0);

  // Barisnya memang belum ada di daftar kebiasaan — bukan sedang memuat.
  // Ini TIDAK lagi menyembunyikan arsipnya: catatan lama tetap boleh dibaca
  // walau barisnya sudah tidak ada. Yang hilang cuma tempat mengisinya.
  const belumAda = habits !== null && gratitudeId === null;
  const memuat =
    arsip === null || habits === null || (gratitudeId !== null && notes === null);
  // Masih mungkin ada yang lebih lama di salah satu dari dua sumbernya.
  const adaYangLebihLama = (notes?.more ?? false) || baru.length >= jendela;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Spiritual"
        title="Riwayat Syukur 🙏"
        subtitle={
          memuat
            ? undefined
            : `${totalHal} hal disyukuri dalam ${isi.length} hari`
        }
      />

      {/*
        Galatnya hanya ditampilkan kalau memang TIDAK ADA yang bisa dibaca.
        Layar ini cuma membaca; kalau riwayatnya sudah terpampang, kegagalan
        menyegarkan bukan kabar yang layak ditulis merah-merah di atasnya —
        yang terbaca malah "catatanmu gagal dimuat", padahal ada di bawahnya.
      */}
      <ScreenError message={isi.length === 0 ? error : null} />

      {memuat ? (
        <LoadingCenter />
      ) : (
        <ScrollView key={currentPage} contentContainerStyle={styles.content}>
          {isi.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada yang tercatat.
            </VixText>
          ) : (
            <>
              {pageItems.map((d) => (
                <View key={d.dayId} style={styles.card}>
                  <VixText heading="label" additionalStyle={styles.cardDate}>
                    📆 {formatFullDate(dayIdToDate(d.dayId))}
                  </VixText>
                  {filledNoteLines(d.text).map((hal, i) => (
                    <View key={i} style={styles.line}>
                      <VixText heading="label" additionalStyle={styles.lineNo}>
                        {i + 1}.
                      </VixText>
                      <VixText
                        heading="paragraph"
                        additionalStyle={styles.lineText}>
                        {hal}
                      </VixText>
                    </View>
                  ))}
                </View>
              ))}

              <Pagination
                page={currentPage}
                pageCount={pageCount}
                onChange={setPage}
              />
            </>
          )}

          {/* Barisnya hilang dari daftar kebiasaan → arsipnya tetap terbaca di
              atas, tapi tidak ada lagi tempat mengisi yang baru. Itu kabar yang
              harus disebut, bukan didiamkan. */}
          {belumAda && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Baris 🙏 Bersyukur 3 Hal sudah tidak ada di daftar kebiasaanmu —
              catatan lama tetap tersimpan, tapi yang baru belum bisa diisi.
            </VixText>
          )}

          {/*
            Muncul selama salah satu sumbernya masih mungkin punya yang lebih
            lama — termasuk saat daftarnya kosong, karena bisa saja seratus hari
            terakhir memang tak ada yang tercatat sedangkan yang lama ada.
          */}
          {adaYangLebihLama && (
            <PrimaryButton
              label="Muat hari yang lebih lama"
              icon="arrow.down.to.line"
              busy={menarik}
              background={Color.CONTAINER}
              textColor={Color.SPIRITUAL_DARK}
              additionalStyle={styles.older}
              onPress={() => {
                setMenarik(true);
                setJendela((n) => n + GRATITUDE_PAGE);
              }}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  cardDate: { color: Color.SPIRITUAL_DARK },
  older: { marginTop: 14, borderWidth: 1, borderColor: Color.BORDER },
  line: { flexDirection: 'row', gap: 8 },
  lineNo: { color: Color.TEXT_LABEL, width: 16 },
  lineText: { flex: 1, color: Color.TEXT_PARAGRAPH },
});
