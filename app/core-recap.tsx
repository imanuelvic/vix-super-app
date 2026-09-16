import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { EmojiButton } from '@/components/common/EmojiButton';
import { EmptyText } from '@/components/common/EmptyText';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { ShareToLeaderSheet } from '@/components/core/ShareToLeaderSheet';
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
import { shareRecapPdf } from '@/lib/recapPdf';

const MIN_YEAR = 2026;

export default function CoreRecapScreen() {
  const { user } = useAuth();

  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Sheet "Bagikan ke CORE Leader": PDF rekap tahun ini untuk SATU CORE
  // (warna hatinya), dikirim ke CL-nya lewat WhatsApp.
  const [shareOpen, setShareOpen] = useState(false);

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
        subtitle="Rekap visitasi setiap CORE"
        right={
          leaders && leaders.length > 0 ? (
            <EmojiButton
              icon="square.and.arrow.up"
              onPress={() => setShareOpen(true)}
            />
          ) : undefined
        }
      />
      <ScreenError message={error} />

      {visitations === null || leaders === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
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
              {year}
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

          {leaders.length === 0 ? (
            <EmptyText>Belum ada CORE Leader untuk direkap.</EmptyText>
          ) : (
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
                        {meta.icon}
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
        </ScrollView>
      )}

      <ShareToLeaderSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        kind="recap"
        doc={`Rekap Visitasi ${year}`}
        share={(l, lastShared) =>
          shareRecapPdf(l, visitations ?? [], year, lastShared)
        }
      />
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
});
