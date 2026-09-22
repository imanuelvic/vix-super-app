import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { EmptyText } from '@/components/common/EmptyText';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { TokenPurchaseSheet } from '@/components/residence/TokenPurchaseSheet';
import { useLiveAll } from '@/hooks/useLiveAll';
import { usePagination } from '@/hooks/usePagination';
import { useTokenPurchaseForm } from '@/hooks/useTokenPurchaseForm';
import { formatCompactDate, formatDecimal } from '@/lib/format';
import {
  ratePerKwh,
  subscribeTokenPurchases,
  totalCost,
  type TokenPurchase,
} from '@/lib/token';
import { formatRupiah } from '@/lib/transactions';

// Pembelian Token 🧾 — seluruh riwayat beli token listrik, terbaru di atas.
//
// Dulu daftar ini menumpang di paling bawah sub-tab Token, di bawah riwayat
// pemakaian & catatan meteran — tempat yang baru terlihat sesudah menggulung
// jauh, padahal ia dibuka justru saat mau membandingkan harga per kWh antar
// pembelian. Sekarang ia halaman sendiri, pintunya tombol 🧾 di pojok header
// Residence (15 Sep 2026). Click satu baris = ubah/hapus pembelian itu;
// mencatat pembelian BARU tetap lewat tombol "Beli Token" di sub-tab Token.
//
// Datanya dari pendengar yang SAMA dengan layar Residence di bawahnya
// (lib/liveDoc.ts menghitung pemakainya), jadi membuka halaman ini tidak
// menambah bacaan Firestore.
export default function TokenPurchasesScreen() {
  const [purchases, setPurchases] = useState<TokenPurchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLiveAll(
    (uid, fail) => [
      subscribeTokenPurchases(
        uid,
        (next) => {
          setPurchases(next);
          setError(null);
        },
        fail,
      ),
    ],
    { onError: setError },
  );

  const isi = purchases ?? [];
  const form = useTokenPurchaseForm(isi);

  const urut = [...isi].sort((a, b) => b.date.toMillis() - a.date.toMillis());
  const { currentPage, pageCount, pageItems, setPage } = usePagination(urut);

  const total = totalCost(isi);
  const totalKwh = isi.reduce((sum, p) => sum + p.kwh, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Residence"
        title="Pembelian Token 🧾"
        subtitle="Semua token listrik yang pernah dibeli, terbaru di atas."
      />

      <ScreenError message={error} />

      {purchases === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView key={currentPage} contentContainerStyle={styles.content}>
          {/* Rata-rata harga per kWh dari SELURUH riwayat, bukan pembelian
              terakhir saja (itu tugas currentRate di sub-tab Token): di sini
              yang ditanya "selama ini token itu makan berapa". */}
          <SummaryCard
            label="Total pembelian"
            value={isi.length > 0 ? formatRupiah(total) : 'Belum ada'}
            sub={
              isi.length > 0
                ? `${isi.length}× beli · ${formatDecimal(totalKwh)} kWh · rata-rata ${
                    totalKwh > 0 ? formatRupiah(Math.round(total / totalKwh)) : '-'
                  }/kWh`
                : 'Catat lewat tombol Beli Token di sub-tab Token.'
            }
          />

          {urut.length === 0 ? (
            <EmptyText>
              Belum ada. Catat sekali saja, biar app tahu harga per kWh-mu.
            </EmptyText>
          ) : (
            <>
              {pageItems.map((p) => (
                <PressableScale
                  key={p.id}
                  style={styles.row}
                  onPress={() => form.bukaUbah(p)}>
                  <View style={styles.rowMain}>
                    <VixText heading="bold" additionalStyle={styles.rowTitle}>
                      {formatRupiah(p.cost)} · {formatDecimal(p.kwh)} kWh
                    </VixText>
                    <VixText heading="label">
                      {formatCompactDate(p.date.toDate())} · {p.platform} ·{' '}
                      {formatRupiah(Math.round(ratePerKwh(p)))}/kWh
                    </VixText>
                    {p.note ? (
                      <VixText heading="label" additionalStyle={styles.rowNote}>
                        📝 {p.note}
                      </VixText>
                    ) : null}
                  </View>
                </PressableScale>
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

      <TokenPurchaseSheet form={form} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 },
  row: { ...CARD, marginBottom: 8 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: Color.TEXT_TITLE },
  rowNote: { color: Color.TEXT_PLACEHOLDER },
});
