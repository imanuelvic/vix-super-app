import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import {
  filledNoteLines,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import {
  subscribeHabitNotes,
  type HabitNoteDay,
} from '@/lib/health';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';

// Riwayat Syukur 🙏 — kumpulan "3 hal yang aku syukuri" dari baris kebiasaan
// 🙏 Bersyukur 3 Hal, hari terbaru dulu.
//
// Tak ada penyimpanan baru: yang dibaca catatan harian kebiasaan itu sendiri
// (habitDays/{hari}.notes[id]), teks yang sama yang kamu ketik di Habits.
// Layar ini cuma memberinya tempat untuk dibaca ulang — karena itulah gunanya
// mencatat syukur: dibaca lagi waktu hari sedang berat.
export default function GratitudeScreen() {
  const { user } = useAuth();

  const [habits, setHabits] = useState<ScheduledHabit[] | null>(null);
  const [days, setDays] = useState<HabitNoteDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Id barisnya tidak ditulis di kode: daftar kebiasaan itu datamu, dan
  // id-nya lahir saat baris itu dibuat. Jadi dicari dari namanya, sama seperti
  // pintasan kebiasaan lain (lihat habitNoteLines di lib/habits.ts).
  const gratitude = habits?.find((h) => /bersyukur/i.test(h.label)) ?? null;
  // Yang dipakai jadi dependency efek di bawah: ID-nya, BUKAN objeknya.
  //
  // `habits` datang dari Firestore, dan tiap snapshot melahirkan objek baru —
  // termasuk saat isinya tidak berubah sama sekali. Dengan objeknya sebagai
  // dependency, efeknya memutus lalu memasang ulang langganan tiap snapshot,
  // dan tiap pemasangan ulang itu membaca sampai 120 dokumen habitDays lagi.
  // Boros, dan daftarnya sempat kosong sekejap tiap kali.
  const gratitudeId = gratitude?.id ?? null;

  // Galatnya DIBERSIHKAN tiap data baru sampai — bukan cuma dipasang saat
  // gagal. Tanpa itu, satu kegagalan sekejap (mis. sinyal putus sedetik saat
  // layar dibuka) menempel selamanya: pesan "Gagal memuat data" tetap terpampang
  // di atas daftar syukur yang sebenarnya sudah tampil lengkap di bawahnya.
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
    if (!user || !gratitudeId) return;
    return unsubscribeAll([
      subscribeHabitNotes(
        user.uid,
        gratitudeId,
        (next) => {
          setDays(next);
          setError(null);
        },
        () => setError(LOAD_ERROR),
      ),
    ]);
  }, [user, gratitudeId]);

  const isi = days ?? [];
  const { setPage, currentPage, pageCount, pageItems } = usePagination(isi);
  const totalHal = isi.reduce((n, d) => n + filledNoteLines(d.text).length, 0);

  // Barisnya memang belum ada di daftar kebiasaan — bukan sedang memuat.
  const belumAda = habits !== null && gratitude === null;
  const memuat = habits === null || (!belumAda && days === null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Spiritual"
        title="Riwayat Syukur 🙏"
        subtitle={
          memuat || belumAda
            ? undefined
            : `${totalHal} hal disyukuri dalam ${isi.length} hari`
        }
      />

      <ScreenError message={error} />

      {memuat ? (
        <LoadingCenter />
      ) : (
        <ScrollView key={currentPage} contentContainerStyle={styles.content}>
          {belumAda ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Baris 🙏 Bersyukur 3 Hal belum ada di daftar kebiasaanmu.
            </VixText>
          ) : isi.length === 0 ? (
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
                      <VixText heading="paragraph" additionalStyle={styles.lineText}>
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
  line: { flexDirection: 'row', gap: 8 },
  lineNo: { color: Color.TEXT_LABEL, width: 16 },
  lineText: { flex: 1, color: Color.TEXT_PARAGRAPH },
});
