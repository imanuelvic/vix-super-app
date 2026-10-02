import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT, SCREEN_SAFE } from '@/assets/style/layout';
import { EmptyText } from '@/components/common/EmptyText';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useAsyncData } from '@/hooks/useAsyncData';
import { usePagination } from '@/hooks/usePagination';
import { dayIdToDate, formatClock, formatDecimal, formatFullDate } from '@/lib/format';
import { LOAD_ERROR } from '@/lib/messages';
import {
  fetchFitLogs,
  fitKindMeta,
  fitLogPace,
  FIT_HISTORY_DAYS,
  type FitLogEntry,
} from '@/lib/fitness';

// Riwayat olahraga ⏱️ — semua sesi yang direkam stopwatch di sub-tab Record,
// terbaru dulu. Dibuka dari tombol 📜 di pojok kanan atas Fitness.
//
// Dibaca SEKALI saat layar dibuka (bukan langganan): riwayat tidak berubah
// selagi kamu membacanya, dan langganan ke 120 dokumen itu mahal untuk
// halaman yang dibuka sesekali.
export default function FitnessHistoryScreen() {
  const { user } = useAuth();

  const muat = useMemo(
    () => (user ? () => fetchFitLogs(user.uid) : null),
    [user],
  );
  const { data, error } = useAsyncData(muat, LOAD_ERROR);

  const logs: FitLogEntry[] | null = data ?? null;
  // 12 per halaman — riwayat ini menumpuk terus, jadi tanpa paginasi daftarnya
  // jadi gulungan tanpa ujung. Pola & komponennya sama dengan arsip lain.
  const { currentPage, pageCount, pageItems, setPage } = usePagination(
    logs ?? [],
    12,
  );

  // Total seluruh yang terbaca — satu kalimat yang menjawab "sejauh ini aku
  // sudah berapa lama olahraga", tanpa perlu menjumlah sendiri di kepala.
  const totalDetik = (logs ?? []).reduce((n, l) => n + l.seconds, 0);
  const totalKm = (logs ?? []).reduce((n, l) => n + l.km, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Fitness"
        title="Workout History ⏱️"
        subtitle={`Sesi yang direkam di Record · ${FIT_HISTORY_DAYS} hari terakhir`}
      />

      <ScreenError message={error} />

      {logs === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView key={currentPage} contentContainerStyle={styles.content}>
          {logs.length === 0 ? (
            <EmptyText>
              Belum ada sesi yang direkam. Buka sub-tab Record ⏱️, pilih
              olahraganya, lalu click Mulai.
            </EmptyText>
          ) : (
            <>
              <View style={styles.hero}>
                <VixText heading="subheader" additionalStyle={styles.heroValue}>
                  {formatClock(totalDetik)}
                </VixText>
                <VixText heading="label" additionalStyle={styles.heroLabel}>
                  {logs.length} sesi
                  {totalKm > 0 ? ` · ${formatDecimal(totalKm)} km` : ''}
                </VixText>
              </View>

              {pageItems.map((l, i) => {
                const m = fitKindMeta(l.kind);
                const pace = fitLogPace(l);
                return (
                  <View key={`${l.dayId}-${l.at}-${i}`} style={styles.card}>
                    <View style={styles.cardTop}>
                      <VixText heading="label" additionalStyle={styles.cardDate}>
                        📆 {formatFullDate(dayIdToDate(l.dayId))}
                      </VixText>
                      {l.at ? (
                        <VixText heading="label">🕒 {l.at}</VixText>
                      ) : null}
                    </View>
                    <VixText heading="bold" additionalStyle={styles.cardTitle}>
                      {m.emoji} {m.label} · {formatClock(l.seconds)}
                    </VixText>
                    {l.km > 0 || l.place ? (
                      <VixText heading="label" additionalStyle={styles.cardSub}>
                        {[
                          l.km > 0 ? `${formatDecimal(l.km)} km` : '',
                          pace,
                          l.place ? `📍 ${l.place}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </VixText>
                    ) : null}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { ...SCREEN_SAFE },
  content: { ...SCREEN_CONTENT, paddingBottom: 40 },
  hero: {
    backgroundColor: Color.FITNESS_DARK,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 2,
    marginBottom: 12,
  },
  heroValue: { color: Color.TEXT_REVERSE },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  card: {
    ...PANEL,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: { color: Color.FITNESS_DARK },
  cardTitle: { color: Color.TEXT_TITLE },
  cardSub: { color: Color.TEXT_LABEL },
});
