import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { GangTabs } from '@/components/friends/GangTabs';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { FutsalSessionCard } from '@/components/friends/FutsalSessionCard';
import { FutsalSessionSheet } from '@/components/friends/FutsalSessionSheet';
import { useFutsalGang } from '@/contexts/futsalGang';
import { usePagination } from '@/hooks/usePagination';
import { useFutsalData } from '@/hooks/useFutsalData';
import { useFutsalSessionForm } from '@/hooks/useFutsalSessionForm';
import { dayIdToDate, formatDayDate, dayId as toDayId } from '@/lib/format';
import {
    daysToSession,
    gangMeta,
    pastSessions,
    upcomingSessions,
    type FutsalSession,
} from '@/lib/futsal';

// Jadwal Main 📅 — SELURUH pertandingan satu geng: yang akan datang & yang
// sudah lewat, satu daftar bernomor halaman.
//
// Sub-tab Fun Futsal sengaja cuma memajang pertandingan TERDEKAT. Itu satu-
// satunya yang benar-benar ditanya orang di grup, sedangkan daftar panjang di
// sana mendorong anggota & kas jauh ke bawah — padahal keduanya yang dibuka
// tiap hari. Semua sisanya, termasuk riwayat main, tinggal di sini.
//
// Satu daftar, bukan dua: yang akan datang di atas (paling dekat dulu), lalu
// riwayat di bawahnya (terbaru dulu). Dua daftar dengan dua paginasi berarti
// dua tombol halaman di satu layar, dan tak pernah jelas yang mana milik siapa.
export default function FutsalScheduleScreen() {
  const router = useRouter();
  const { data, isi, error } = useFutsalData();
  // Gengnya sama dengan yang sedang dibuka di sub-tab Fun Futsal — berpindah
  // geng diam-diam saat pindah halaman itu persis yang bikin orang mengira
  // datanya hilang.
  const { gang, setGang } = useFutsalGang();

  const now = new Date();
  const todayId = toDayId(now);
  const meta = gangMeta(gang);
  const form = useFutsalSessionForm(isi, gang);

  const akanDatang = upcomingSessions(isi.sessions, gang, todayId);
  const riwayat = pastSessions(isi.sessions, gang, todayId);
  const semua = [...akanDatang, ...riwayat];
  const { currentPage, pageCount, pageItems, setPage } = usePagination(semua);

  const bukaRincian = (s: FutsalSession) =>
    router.push({ pathname: '/futsal/[id]', params: { id: s.id } });

  /** "Besok" · "3 hari lagi" · "12 hari lalu" — lebih cepat dibaca dari tanggal. */
  function jarak(s: FutsalSession): string {
    const n = daysToSession(s, now);
    if (n < 0) return `🧾 ${-n} hari lalu`;
    return n === 0 ? '⏳ Hari ini' : n === 1 ? '⏳ Besok' : `⏳ ${n} hari lagi`;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Friends"
        title="Jadwal Main 📅"
        subtitle="Semua pertandingan — yang akan datang & riwayatnya."
      />

      <ScreenError message={error} />

      {/* Tab geng berdiri DI LUAR gulungan: ia tak ikut bergerak sama sekali,
          jadi berpindah geng selalu satu klik dari mana pun kamu berhenti
          membaca. */}
      <GangTabs value={gang} onChange={setGang} />

      {data === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView
          key={`${gang}-${currentPage}`}
          contentContainerStyle={styles.content}>
          {semua.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada jadwal {meta.label} sama sekali. Buat lewat “Jadwalkan
              Main” di sub-tab Fun Futsal ⚽
            </VixText>
          ) : (
            <>
              {akanDatang.length > 0 ? (
                <SummaryCard style={styles.hero}>
                  <VixText heading="label" additionalStyle={summaryText.label}>
                    {meta.emoji} {meta.label} · main berikutnya
                  </VixText>
                  <VixText heading="subheader" additionalStyle={summaryText.value}>
                    {formatDayDate(dayIdToDate(akanDatang[0].dayId))}
                  </VixText>
                  <VixText heading="label" additionalStyle={summaryText.label}>
                    {jarak(akanDatang[0])} · {akanDatang.length} jadwal tersimpan
                  </VixText>
                </SummaryCard>
              ) : (
                <VixText heading="label" additionalStyle={styles.empty}>
                  Belum ada jadwal {meta.label} yang akan datang.
                </VixText>
              )}

              {pageItems.map((s, i) => {
                const lewat = daysToSession(s, now) < 0;
                const mulaiRiwayat =
                  lewat && (i === 0 || daysToSession(pageItems[i - 1], now) >= 0);
                return (
                  <View key={s.id}>
                    {mulaiRiwayat && (
                      <VixText heading="title" additionalStyle={styles.sectionTitle}>
                        🧾 Riwayat Main
                      </VixText>
                    )}
                    <FutsalSessionCard
                      s={s}
                      now={now}
                      onOpen={bukaRincian}
                      onEdit={form.bukaUbah}
                    />
                  </View>
                );
              })}

              <Pagination
                page={currentPage}
                pageCount={pageCount}
                onChange={setPage}
              />
            </>
          )}
        </ScrollView>
      )}

      <FutsalSessionSheet form={form} gang={gang} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: { marginBottom: 6 },
  sectionTitle: { ...SECTION_SPACE },
  empty: { textAlign: 'center', marginVertical: 20 },
});
