import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { usePagination } from '@/hooks/usePagination';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import { openExternalUrl } from '@/lib/linking';
import {
  allPopulationPoints,
  estimatePopulation,
  formatBillions,
  formatCount,
  pointGrowth,
  populationFacts,
  POPULATION_SOURCE,
  RECORD_DAY,
  type PopulationSaved,
} from '@/lib/news';

// Tab Population 🌏 — perkiraan populasi dunia yang berjalan tiap detik,
// fakta laju pertambahan, dan riwayat catatan bulanan.
export function PopulationTab({ saved }: { saved: PopulationSaved }) {
  // Angka "hidup" — dihitung ulang tiap 3 detik supaya terasa berjalan.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 3_000);
    return () => clearInterval(t);
  }, []);

  const points = allPopulationPoints(saved);
  const { setPage, currentPage, pageCount, pageItems } = usePagination(points);
  const live = estimatePopulation(now);

  return (
    <ScrollView key={currentPage} contentContainerStyle={styles.content}>
      {/* Penghitung besar */}
      <View style={styles.hero}>
        <VixText heading="label" additionalStyle={styles.heroLabel}>
          🌏 Perkiraan Populasi Dunia
        </VixText>
        <VixText heading="header" additionalStyle={styles.heroValue}>
          {formatCount(live)}
        </VixText>
        <VixText heading="label" additionalStyle={styles.heroLabel}>
          ± {formatBillions(live)} jiwa · {formatShortDayDate(now)}
        </VixText>
      </View>

      {/* Fakta laju pertambahan */}
      <View style={styles.factRow}>
        {populationFacts().map((f) => (
          <View key={f.label} style={styles.factTile}>
            <VixText additionalStyle={styles.factIcon}>{f.icon}</VixText>
            <VixText heading="bold" additionalStyle={styles.factValue}>
              {f.value}
            </VixText>
            <VixText heading="label" additionalStyle={styles.factLabel}>
              {f.label}
            </VixText>
          </View>
        ))}
      </View>

      <View style={styles.noteCard}>
        <VixText heading="label" additionalStyle={styles.noteText}>
          ℹ️ Angka di atas adalah PERKIRAAN yang dihitung di HP-mu — dari
          catatan terakhir ditambah laju pertambahan harian. Persis begitu juga
          cara worldometers menampilkan penghitungnya (ekstrapolasi data PBB,
          bukan sensus real-time). Tiap tanggal {RECORD_DAY} catatan bulan baru
          ditambahkan otomatis saat kamu membuka layar ini.
        </VixText>
        <PressableScale onPress={() => openExternalUrl(POPULATION_SOURCE)}>
          <VixText heading="bold" additionalStyle={styles.sourceLink}>
            🔗 Buka worldometers.info
          </VixText>
        </PressableScale>
      </View>

      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        📜 Riwayat Catatan ({points.length})
      </VixText>

      {pageItems.map((p) => {
        const index = points.indexOf(p);
        const growth = pointGrowth(points, index);
        return (
          <View key={p.dayId} style={styles.row}>
            <View style={styles.rowMain}>
              <VixText heading="bold" additionalStyle={styles.rowCount}>
                {formatCount(p.count)}
              </VixText>
              <VixText heading="label">
                📆 {formatShortDayDate(dayIdToDate(p.dayId))}
                {p.estimated ? ' · perkiraan app' : ''}
              </VixText>
            </View>
            {growth !== null && (
              <VixText heading="label" additionalStyle={styles.rowGrowth}>
                +{formatCount(growth)}
              </VixText>
            )}
          </View>
        );
      })}

      <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  hero: {
    backgroundColor: Color.NEWS_DARK,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  heroValue: { color: Color.TEXT_REVERSE },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  factTile: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    gap: 1,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  factIcon: { fontSize: 20, lineHeight: 26 },
  factValue: { color: Color.TEXT_TITLE, textAlign: 'center' },
  factLabel: { textAlign: 'center' },
  noteCard: {
    backgroundColor: Color.NEWS,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.NEWS_DARK,
    padding: 14,
    gap: 8,
    marginBottom: 4,
  },
  noteText: { color: Color.NEWS_DARK },
  sourceLink: { color: Color.NEWS_DARK },
  sectionTitle: { marginTop: 14, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowMain: { flex: 1, gap: 1 },
  rowCount: { color: Color.TEXT_TITLE },
  rowGrowth: { color: Color.NEWS_DARK },
});
