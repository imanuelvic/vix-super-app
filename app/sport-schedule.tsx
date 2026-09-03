import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { SportSessionCard } from '@/components/friends/SportSessionCard';
import { usePagination } from '@/hooks/usePagination';
import { useSportData } from '@/hooks/useSportData';
import { dayId as toDayId, dayIdToDate, formatDayDate } from '@/lib/format';
import {
  daysToSession,
  gangMeta,
  SPORT_GANGS,
  upcomingSessions,
  type SportGangKey,
  type SportSession,
} from '@/lib/sport';

// Jadwal Main 📅 — SEMUA pertandingan yang belum lewat, satu geng sekaligus.
//
// Sub-tab Fun Sport sengaja cuma memajang yang paling dekat: itu satu-satunya
// yang benar-benar ditanya orang di grup, dan daftar panjang di sana membuat
// anggota & papan skor terdorong jauh ke bawah. Yang sudah menjadwalkan
// beberapa kali main ke depan melihat semuanya di sini.
export default function SportScheduleScreen() {
  const router = useRouter();

  const { data, isi, error } = useSportData();
  const [gang, setGang] = useState<SportGangKey>('f3');

  const now = new Date();
  const todayId = toDayId(now);
  const meta = gangMeta(gang);
  const daftar = upcomingSessions(isi.sessions, gang, todayId);
  const { currentPage, pageCount, pageItems, setPage } = usePagination(daftar);

  const bukaRincian = (s: SportSession) =>
    router.push({ pathname: '/sport/[id]', params: { id: s.id } });

  /** "Hari ini" · "Besok" · "3 hari lagi" — lebih cepat dibaca dari tanggal. */
  function jarak(s: SportSession): string {
    const n = daysToSession(s, now);
    return n === 0 ? 'Hari ini' : n === 1 ? 'Besok' : `${n} hari lagi`;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Friends"
        title="Jadwal Main 📅"
        subtitle="Semua pertandingan yang akan datang."
      />

      <ScreenError message={error} />

      {data === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView
          key={`${gang}-${currentPage}`}
          contentContainerStyle={styles.content}>
          <SegmentTabs
            tabs={SPORT_GANGS.map((g) => ({
              key: g.key,
              label: `${g.emoji} ${g.label}`,
              sub: `${upcomingSessions(isi.sessions, g.key, todayId).length} jadwal`,
            }))}
            value={gang}
            onChange={setGang}
          />

          {daftar.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada jadwal {meta.label} yang akan datang. Buat lewat
              “Jadwalkan Main” di sub-tab Fun Sport ⚽
            </VixText>
          ) : (
            <>
              <SummaryCard style={styles.hero}>
                <VixText heading="label" additionalStyle={summaryText.label}>
                  {meta.emoji} {meta.label} · main berikutnya
                </VixText>
                <VixText heading="subheader" additionalStyle={summaryText.value}>
                  {formatDayDate(dayIdToDate(daftar[0].dayId))}
                </VixText>
                <VixText heading="label" additionalStyle={summaryText.label}>
                  ⏳ {jarak(daftar[0])} · {daftar.length} jadwal tersimpan
                </VixText>
              </SummaryCard>

              {pageItems.map((s) => (
                <View key={s.id}>
                  <VixText heading="label" additionalStyle={styles.jarak}>
                    ⏳ {jarak(s)}
                  </VixText>
                  {/* Tanpa tombol pensil: formulir ubah jadwalnya tinggal di
                      sub-tab Fun Sport, dan menyalinnya ke sini cuma menambah
                      satu form kedua yang harus ikut berubah selamanya. */}
                  <SportSessionCard s={s} now={now} onOpen={bukaRincian} />
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
  hero: { marginTop: 10 },
  jarak: { color: Color.FRIENDS_DARK, marginBottom: 4, marginTop: 4 },
  empty: { textAlign: 'center', marginVertical: 20 },
});
