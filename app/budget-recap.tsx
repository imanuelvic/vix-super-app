import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_GAP, PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import {
  CONTENT_COLUMN,
  SCREEN_CONTENT,
  SCREEN_SAFE,
} from '@/assets/style/layout';
import { EmojiButton } from '@/components/common/EmojiButton';
import { EmptyText } from '@/components/common/EmptyText';
import { FormError } from '@/components/common/FormError';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SegmentTabs, type SegmentTab } from '@/components/common/SegmentTabs';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { TypeChips } from '@/components/finance/TypeChips';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useKeyedData } from '@/hooks/useKeyedData';
import { useLiveAll } from '@/hooks/useLiveAll';
import {
  buildBudgetRecap,
  type RecapMode,
  type RecapRow,
} from '@/lib/budgetRecap';
import { shareBudgetRecap } from '@/lib/budgetRecapPdf';
import { subscribeBudgetRange, type BudgetDoc } from '@/lib/budgets';
import { type FinanceType } from '@/lib/categories';
import {
  formatShortRupiah,
  MONTH_NAMES,
  monthId,
} from '@/lib/format';
import { pdfErrorOf } from '@/lib/messages';
import {
  fetchTransactionsRange,
  formatRupiah,
  type Transaction,
} from '@/lib/transactions';

// 📊 Rekap Budgeting — setahun penuh dalam satu tabel.
//
// Sub-tab Budgeting menjawab "bulan ini berapa?". Layar ini menjawab yang
// tidak bisa dijawabnya: "setahun ini aku anggarkan berapa saja, dan bulan
// mana yang jebol?".
//
// Sakelar Rencana / Kenyataan menukar isi tabel yang sama. Dibuat begitu,
// bukan dua tabel bersusun, karena membandingkan dua tabel yang berjauhan di
// layar HP sama saja dengan tidak membandingkan.

const MODE: SegmentTab<RecapMode>[] = [
  { key: 'budget', label: '🎯 Rencana', sub: 'yang dianggarkan' },
  { key: 'realisasi', label: '💸 Kenyataan', sub: 'yang terpakai' },
];

export default function BudgetRecapScreen() {
  const { user } = useAuth();
  // ?year=… & ?type=… supaya tombolnya mendarat di tahun & jenis yang sedang
  // dilihat, bukan memaksa memilih ulang.
  const { year: yearParam, type: typeParam } = useLocalSearchParams<{
    year?: string;
    type?: string;
  }>();

  const [year, setYear] = useState(() => {
    const n = Number(yearParam);
    return Number.isFinite(n) && n > 2000 ? n : new Date().getFullYear();
  });
  const [type, setType] = useState<FinanceType>(
    typeParam === 'income' || typeParam === 'saving' || typeParam === 'investment'
      ? typeParam
      : 'expense',
  );
  const [mode, setMode] = useState<RecapMode>('budget');

  const [budgets, setBudgets] = useState<Record<string, BudgetDoc>>({});
  // Transaksi DIKUNCI ke tahun yang dibuka: begitu tahunnya digeser, daftarnya
  // kosong lagi di render yang sama, jadi tak ada sekejap pun angka tahun lalu
  // muncul di bawah judul tahun ini (hook bersama, lihat hooks/useKeyedData).
  const { data: items, set: setItems } = useKeyedData<number, Transaction[]>(year);
  const [bagikan, setBagikan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Budget dua belas bulan: SATU query rentang pada id dokumen, tanpa index
  // tambahan (lihat subscribeBudgetRange di lib/budgets.ts).
  useLiveAll(
    (uid) => [
      subscribeBudgetRange(
        uid,
        monthId(year, 0),
        monthId(year, 11),
        setBudgets,
        () => {},
      ),
    ],
    { deps: [year] },
  );

  // Transaksinya DIAMBIL SEKALI per tahun, bukan dilanggan: rekap setahun
  // tidak perlu hidup per detik.
  useEffect(() => {
    if (!user) return;
    let hidup = true;
    fetchTransactionsRange(user.uid, new Date(year, 0, 1), new Date(year + 1, 0, 1))
      .then((rows) => {
        if (hidup) setItems(rows);
      })
      .catch(() => {
        if (hidup) setItems([]);
      });
    return () => {
      hidup = false;
    };
  }, [user, year, setItems]);

  const budgetRecap = useMemo(
    () =>
      buildBudgetRecap({ year, type, mode: 'budget', budgets, items: items ?? [] }),
    [year, type, budgets, items],
  );
  const realisasiRecap = useMemo(
    () =>
      buildBudgetRecap({ year, type, mode: 'realisasi', budgets, items: items ?? [] }),
    [year, type, budgets, items],
  );
  const aktif = mode === 'budget' ? budgetRecap : realisasiRecap;

  // Bulan yang boleh dipilih di sheet bagikan: yang ada isinya saja.
  const bulanBerisi = MONTH_NAMES.map((_, i) => i).filter(
    (i) => budgetRecap.totalPerMonth[i] !== 0 || realisasiRecap.totalPerMonth[i] !== 0,
  );

  async function kirim(bulan: number | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await shareBudgetRecap(budgetRecap, realisasiRecap, bulan, new Date());
      setBagikan(false);
    } catch {
      setError(pdfErrorOf('rekap budgeting'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Finance"
        title="Budget Recap 📊"
        subtitle="Setahun penuh, rencana & kenyataan"
        right={<EmojiButton emoji="📤" onPress={() => setBagikan(true)} />}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.kolom}>
          <View style={styles.tahunBar}>
            <PressableScale onPress={() => setYear(year - 1)} hitSlop={10}>
              <IconSymbol name="chevron.left" size={22} color={Color.MAIN} />
            </PressableScale>
            <VixText heading="title" additionalStyle={styles.tahunText}>
              {year}
            </VixText>
            <PressableScale onPress={() => setYear(year + 1)} hitSlop={10}>
              <IconSymbol name="chevron.right" size={22} color={Color.MAIN} />
            </PressableScale>
          </View>

          <TypeChips value={type} onChange={setType} />

          <View style={styles.mode}>
            <SegmentTabs tabs={MODE} value={mode} onChange={setMode} />
          </View>

          <FormError message={error} />

          {/* Ringkasan tahun: dua angka yang paling sering ditanya, plus
              selisihnya supaya tidak perlu dihitung di kepala. */}
          <View style={styles.hero}>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              {mode === 'budget' ? 'Dianggarkan' : 'Terpakai'} setahun
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.heroValue}>
              {formatRupiah(aktif.total)}
            </VixText>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              Rencana {formatRupiah(budgetRecap.total)} · Kenyataan{' '}
              {formatRupiah(realisasiRecap.total)}
            </VixText>
          </View>

          {items === null ? (
            <LoadingCenter />
          ) : aktif.rows.length === 0 ? (
            <EmptyText>
              Belum ada {mode === 'budget' ? 'budget' : 'transaksi'} di {year} 🌱
            </EmptyText>
          ) : (
            <View style={styles.tabel}>
              <View style={[styles.baris, styles.kepala]}>
                <VixText heading="label" additionalStyle={styles.kolNamaKepala}>
                  Kategori
                </VixText>
                <VixText heading="label" additionalStyle={styles.kolAngkaKepala}>
                  Rata-rata
                </VixText>
                <VixText heading="label" additionalStyle={styles.kolAngkaKepala}>
                  Setahun
                </VixText>
              </View>

              {aktif.rows.map((r) => (
                <Baris
                  key={r.key}
                  row={r}
                  lawan={
                    (mode === 'budget' ? realisasiRecap : budgetRecap).rows.find(
                      (x) => x.key === r.key,
                    )?.total ?? 0
                  }
                  mode={mode}
                />
              ))}

              <View style={[styles.baris, styles.kaki]}>
                <VixText heading="bold" additionalStyle={styles.kolNama}>
                  TOTAL
                </VixText>
                <VixText heading="label" additionalStyle={styles.kolAngka}>
                  {formatShortRupiah(aktif.average)}
                </VixText>
                <VixText heading="bold" additionalStyle={styles.kolAngka}>
                  {formatShortRupiah(aktif.total)}
                </VixText>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Mau tarik bulan apa? */}
      <SheetModal
        visible={bagikan}
        title="📤 Share Budget Recap"
        subtitle={`${MONTH_NAMES[0]} sampai ${MONTH_NAMES[11]} ${year}`}
        onClose={() => setBagikan(false)}>
        <PressableScale
          style={styles.pilih}
          onPress={() => kirim(null)}
          disabled={busy}>
          <VixText heading="bold" additionalStyle={styles.pilihJudul}>
            📆 Setahun penuh
          </VixText>
          <VixText heading="label" additionalStyle={styles.pilihSub}>
            Dua belas bulan, rencana & kenyataan berdampingan
          </VixText>
        </PressableScale>

        {bulanBerisi.length === 0 ? (
          <EmptyText>Belum ada bulan yang terisi di {year}</EmptyText>
        ) : (
          bulanBerisi.map((i) => (
            <PressableScale
              key={i}
              style={styles.pilih}
              onPress={() => kirim(i)}
              disabled={busy}>
              <VixText heading="bold" additionalStyle={styles.pilihJudul}>
                {MONTH_NAMES[i]} {year}
              </VixText>
              <VixText heading="label" additionalStyle={styles.pilihSub}>
                Budget {formatShortRupiah(budgetRecap.totalPerMonth[i])} ·
                realisasi {formatShortRupiah(realisasiRecap.totalPerMonth[i])}
              </VixText>
            </PressableScale>
          ))
        )}
      </SheetModal>
    </SafeAreaView>
  );
}

/** Satu kategori. Di bawahnya dua belas bulan, dibuat kecil & rapat. */
function Baris({
  row,
  lawan,
  mode,
}: {
  row: RecapRow;
  /** Angka setahun dari sisi SATUNYA, untuk selisihnya. */
  lawan: number;
  mode: RecapMode;
}) {
  // Positif = kenyataannya lebih besar daripada rencananya.
  const beda = mode === 'budget' ? lawan - row.total : row.total - lawan;
  return (
    <View style={styles.barisKategori}>
      <View style={styles.baris}>
        <VixText
          heading="bold"
          numberOfLines={1}
          additionalStyle={styles.kolNama}>
          {row.label}
        </VixText>
        <VixText heading="label" additionalStyle={styles.kolAngka}>
          {formatShortRupiah(row.average)}
        </VixText>
        <VixText heading="bold" additionalStyle={styles.kolAngkaTebal}>
          {formatShortRupiah(row.total)}
        </VixText>
      </View>
      <View style={styles.bulanBar}>
        {row.perMonth.map((v, i) => (
          <View key={i} style={styles.bulanSel}>
            <VixText heading="label" additionalStyle={styles.bulanNama}>
              {MONTH_NAMES[i].slice(0, 1)}
            </VixText>
            <VixText
              heading="label"
              additionalStyle={v === 0 ? styles.bulanNol : styles.bulanNilai}>
              {v === 0 ? '·' : Math.round(v / 100_000) / 10}
            </VixText>
          </View>
        ))}
      </View>
      {beda !== 0 && (
        <VixText
          heading="label"
          additionalStyle={beda > 0 ? styles.lebih : styles.hemat}>
          {beda > 0 ? '▲ lebih ' : '▼ hemat '}
          {formatShortRupiah(Math.abs(beda))} dari{' '}
          {mode === 'budget' ? 'rencana' : 'yang dianggarkan'}
        </VixText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { ...SCREEN_SAFE },
  content: { ...SCREEN_CONTENT, paddingBottom: 32 },
  kolom: { ...CONTENT_COLUMN },

  tahunBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingBottom: 10,
  },
  tahunText: { color: Color.TEXT_TITLE, minWidth: 80, textAlign: 'center' },
  mode: { marginTop: 10, marginBottom: CARD_GAP },

  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 4,
    marginBottom: CARD_GAP,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },

  tabel: { ...PANEL, paddingHorizontal: 12, paddingVertical: 4 },
  barisKategori: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Color.BORDER,
    gap: 6,
  },
  baris: { flexDirection: 'row', alignItems: 'center' },
  kepala: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Color.TEXT_PLACEHOLDER,
  },
  kaki: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: Color.TEXT_PLACEHOLDER },
  kolNama: { flex: 1, color: Color.TEXT_TITLE },
  kolNamaKepala: { flex: 1, color: Color.TEXT_LABEL },
  kolAngka: { width: 78, textAlign: 'right' },
  kolAngkaTebal: { width: 78, textAlign: 'right', color: Color.MAIN_DARK },
  kolAngkaKepala: { width: 78, textAlign: 'right', color: Color.TEXT_LABEL },

  // Dua belas bulan di bawah nama kategorinya, dalam JUTAAN supaya muat di
  // layar HP tanpa digeser. Satu pandangan menjawab "bulan mana yang beda".
  bulanBar: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  bulanSel: { flex: 1, alignItems: 'center' },
  bulanNama: { color: Color.TEXT_PLACEHOLDER },
  bulanNilai: { color: Color.TEXT_PARAGRAPH },
  bulanNol: { color: Color.TEXT_PLACEHOLDER },

  lebih: { color: Color.DANGER },
  hemat: { color: Color.SUCCESS },

  pilih: { ...PANEL, padding: 14, marginBottom: 8, gap: 2 },
  pilihJudul: { color: Color.TEXT_TITLE },
  pilihSub: { color: Color.TEXT_LABEL },
});
