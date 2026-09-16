import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { EmptyText } from '@/components/common/EmptyText';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  meetingKindMeta,
  subscribeCoreLeaders,
  subscribeVisitations,
  type CoreLeader,
  type Visitation,
} from '@/lib/core';
import { visitationRecap } from '@/lib/coreCalendar';
import { monthShort } from '@/lib/format';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';

// Rekap Visitasi 📊 — tabel setahun: baris = jenis pertemuan, kolom = CORE
// Leader (hatinya), isinya berapa kali visitasi jenis itu SELESAI ✅ dengan
// CL itu. Bentuknya mengikuti lembar rekap yang dulu dibuat manual di
// spreadsheet: baris Thanksgiving berisi tanggalnya, baris Total di dasar.
//
// Adil: acara gabungan dihitung untuk tiap CL yang ikut, dan yang dihitung
// hanya yang sudah benar-benar terjadi (jadwal yang masih menunggu disebut
// terpisah di kartu ringkasan). Hitungannya di lib/coreCalendar.ts.

/** Tahun paling awal yang ada datanya — app ini mulai dipakai 2026. */
const MIN_YEAR = 2026;

export default function CoreRecapScreen() {
  const { user } = useAuth();

  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeVisitations(user.uid, setVisitations, fail),
      subscribeCoreLeaders(user.uid, setLeaders, fail),
    ]);
  }, [user]);

  const tahunIni = new Date().getFullYear();
  const [year, setYear] = useState(tahunIni);

  const rekap = useMemo(
    () => visitationRecap(visitations ?? [], leaders ?? [], year),
    [visitations, leaders, year],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Rekap Visitasi 📊"
        subtitle="Berapa kali tiap CL sudah kamu temui, per jenis"
      />
      <ScreenError message={error} />

      {visitations === null || leaders === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Navigasi tahun */}
          <View style={styles.yearRow}>
            <PressableScale
              onPress={() => setYear((y) => y - 1)}
              hitSlop={10}
              disabled={year <= MIN_YEAR}>
              <IconSymbol
                name="chevron.left"
                size={22}
                color={year <= MIN_YEAR ? Color.BORDER : Color.CORE_DARK}
              />
            </PressableScale>
            <VixText heading="title" additionalStyle={styles.yearText}>
              Tahun {year}
            </VixText>
            <PressableScale
              onPress={() => setYear((y) => y + 1)}
              hitSlop={10}
              disabled={year >= tahunIni}>
              <IconSymbol
                name="chevron.right"
                size={22}
                color={year >= tahunIni ? Color.BORDER : Color.CORE_DARK}
              />
            </PressableScale>
          </View>

          <SummaryCard
            label={`Visitasi selesai ${year}`}
            value={`${rekap.grand}× pertemuan`}
            sub={`${leaders.length} CORE Leader · ${rekap.planned} jadwal masih menunggu`}
          />

          {leaders.length === 0 ? (
            <EmptyText>Belum ada CORE Leader untuk direkap.</EmptyText>
          ) : (
            /* Tabel: label jenis di kiri, satu kolom per CL, Σ di kanan.
               Kolomnya melebar mengisi layar; kalau CL-nya banyak sekali,
               tabelnya bisa digeser ke samping. */
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tableScroll}>
              <View style={styles.table}>
                <View style={[styles.row, styles.headRow]}>
                  <VixText heading="label" additionalStyle={styles.labelCol}>
                    Jenis
                  </VixText>
                  {leaders.map((l) => (
                    <VixText key={l.id} heading="bold" additionalStyle={styles.cell}>
                      {l.heart}
                    </VixText>
                  ))}
                  <VixText heading="bold" additionalStyle={[styles.cell, styles.sumCol]}>
                    Σ
                  </VixText>
                </View>

                {/* Tanggal Thanksgiving tiap CL — seperti di lembar rekapnya */}
                <View style={styles.row}>
                  <VixText heading="label" additionalStyle={styles.labelCol} numberOfLines={2}>
                    🎉 Thanksgiving
                  </VixText>
                  {rekap.thanksgiving.map((d, i) => (
                    <VixText
                      key={leaders[i].id}
                      heading="label"
                      additionalStyle={[styles.cell, d ? styles.cellDate : styles.cellZero]}>
                      {d ? `${d.getDate()}\n${monthShort(d)}` : '·'}
                    </VixText>
                  ))}
                  <VixText heading="label" additionalStyle={[styles.cell, styles.sumCol]}>
                    {rekap.thanksgiving.filter(Boolean).length}
                  </VixText>
                </View>

                {rekap.rows.map((r) => {
                  const meta = meetingKindMeta(r.kind);
                  return (
                    <View key={r.kind} style={styles.row}>
                      <VixText heading="label" additionalStyle={styles.labelCol} numberOfLines={2}>
                        {meta.icon} {meta.label}
                      </VixText>
                      {r.counts.map((n, i) => (
                        <VixText
                          key={leaders[i].id}
                          heading={n > 0 ? 'bold' : 'label'}
                          additionalStyle={[styles.cell, n === 0 && styles.cellZero]}>
                          {n > 0 ? n : '·'}
                        </VixText>
                      ))}
                      <VixText
                        heading={r.total > 0 ? 'bold' : 'label'}
                        additionalStyle={[styles.cell, styles.sumCol, r.total === 0 && styles.cellZero]}>
                        {r.total > 0 ? r.total : '·'}
                      </VixText>
                    </View>
                  );
                })}

                <View style={[styles.row, styles.totalRow]}>
                  <VixText heading="bold" additionalStyle={styles.labelCol}>
                    Total
                  </VixText>
                  {rekap.totals.map((n, i) => (
                    <VixText key={leaders[i].id} heading="bold" additionalStyle={[styles.cell, styles.totalText]}>
                      {n}
                    </VixText>
                  ))}
                  <VixText heading="bold" additionalStyle={[styles.cell, styles.sumCol, styles.totalText]}>
                    {rekap.grand}
                  </VixText>
                </View>
              </View>
            </ScrollView>
          )}

          <VixText heading="label" additionalStyle={styles.note}>
            Yang dihitung hanya visitasi yang sudah ditandai ✅ selesai. Acara
            gabungan dihitung untuk tiap CL yang ikut. Baris Thanksgiving
            menunjukkan tanggal Thanksgiving tiap CL tahun itu.
          </VixText>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  yearText: { color: Color.CORE_DARK },
  // Tabel selebar layar; melebihi itu baru bisa digeser.
  tableScroll: { minWidth: '100%' },
  // Tabel: bingkai kartu tanpa padding (barisnya sendiri yang berpadding),
  // overflow hidden supaya latar kepala terpotong rapi di sudutnya.
  table: {
    flex: 1,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Color.BORDER,
  },
  headRow: { backgroundColor: Color.CORE },
  totalRow: { borderBottomWidth: 0, borderTopWidth: 1.5, borderTopColor: Color.CORE_DARK },
  labelCol: { width: 96, color: Color.TEXT_TITLE },
  // Tiap CL satu kolom sempit; 8 CL + Σ masih muat di iPhone 15 tanpa geser.
  cell: { flex: 1, minWidth: 28, textAlign: 'center', color: Color.TEXT_TITLE },
  sumCol: { color: Color.CORE_DARK },
  cellZero: { color: Color.TEXT_PLACEHOLDER },
  cellDate: { fontSize: 11, lineHeight: 14 },
  totalText: { color: Color.CORE_DARK },
  note: { color: Color.TEXT_LABEL, marginTop: CARD_GAP },
});
