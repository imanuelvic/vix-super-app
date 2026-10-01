import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD_GAP, PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT } from '@/assets/style/layout';
import { FormError } from '@/components/common/FormError';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { AnalysisPanel } from '@/components/investment/AnalysisPanel';
import { ChartFullscreen } from '@/components/investment/ChartFullscreen';
import { PriceChart } from '@/components/investment/PriceChart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatShortRupiah } from '@/lib/format';
import type { MarketPoint } from '@/lib/market';
import type { MarketAsset } from '@/lib/marketAi';
import { formatRupiah } from '@/lib/transactions';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Data minimal yang dibutuhkan tampilan pasar (Emas & Crypto pakai bentuk ini). */
export type MarketView = {
  current: number; // harga sekarang (Rupiah)
  series: MarketPoint[]; // deret harian ~6 bulan (titik terakhir = live)
  updatedAt: number; // epoch ms saat diambil
};

// Pengambilan datanya (fetch + loading + error) ditangani hook bersama
// `useAsyncData` — dipakai Emas, Crypto, Saham, Forex, dan tab News.

type Props = {
  heroTitle: string;
  heroSub: string;
  heroAction?: { label: string; onPress: () => void };
  statLabel: string; // "Harga sekarang" / "Harga sekarang (1 BTC)"
  srcText: string; // baris sumber (COMEX/kurs, dsb) — dihitung pemanggil
  noteText: string;
  /** Aset mana yang dibacakan AI di panel ✨ bawah grafik. */
  aiAsset: MarketAsset;
  /** Nama pendeknya untuk judul panel itu, mis. "Emas". */
  aiLabel: string;
  chartColor?: string;
  // Cara menulis nilai: default Rupiah ("Rp 1.234"). IHSG memakai poin (tanpa Rp)
  // dengan mengoper formatValue/formatShort sendiri.
  formatValue?: (n: number) => string; // angka utama & perubahan
  formatShort?: (n: number) => string; // statistik tertinggi/terendah & grafik
  loading: boolean;
  error: string | null;
  data: MarketView | null;
  onReload: () => void;
};

// Tampilan tab pasar (angka utama + statistik + grafik tren) — sama untuk Emas
// & Crypto, hanya teks/warna/sumber data yang berbeda lewat props.
export function MarketTab({
  heroTitle,
  heroSub,
  heroAction,
  statLabel,
  srcText,
  noteText,
  aiAsset,
  aiLabel,
  chartColor,
  formatValue = (n: number) => formatRupiah(Math.round(n)),
  formatShort = formatShortRupiah,
  loading,
  error,
  data,
  onReload,
}: Props) {
  const [chartW, setChartW] = useState(0);
  const [besar, setBesar] = useState(false);

  const series = data?.series ?? [];
  const prices = series.map((s) => s.price);
  const high = prices.length ? Math.max(...prices) : 0;
  const low = prices.length ? Math.min(...prices) : 0;
  const prev = series.length > 1 ? series[series.length - 2].price : null;
  const changeAbs = data && prev != null ? data.current - prev : 0;
  const changePct = prev ? (changeAbs / prev) * 100 : 0;
  const sixMoPct =
    series.length > 1 && series[0].price
      ? ((series[series.length - 1].price - series[0].price) /
          series[0].price) *
        100
      : 0;
  const up = changeAbs >= 0;
  const updated = data ? new Date(data.updatedAt) : null;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Judul + sumber data */}
        <View style={styles.hero}>
          <VixText heading="subheader" additionalStyle={styles.heroTitle}>
            {heroTitle}
          </VixText>
          <VixText heading="label" additionalStyle={styles.heroSub}>
            {heroSub}
          </VixText>
          {heroAction && (
            <PressableScale
              style={styles.linkButton}
              onPress={heroAction.onPress}>
              <VixText heading="bold" additionalStyle={styles.linkText}>
                {heroAction.label}
              </VixText>
            </PressableScale>
          )}
        </View>

        {loading && !data ? (
          <LoadingCenter />
        ) : error && !data ? (
          <View style={styles.errorCard}>
            <VixText heading="label" additionalStyle={styles.error}>
              {error}
            </VixText>
            <PressableScale style={styles.retryButton} onPress={onReload}>
              <VixText heading="bold" additionalStyle={styles.retryText}>
                🔄 Coba lagi
              </VixText>
            </PressableScale>
          </View>
        ) : data ? (
          <>
            <FormError message={error} />

            {/* Statistik ringkas */}
            <View style={styles.statsCard}>
              <View style={styles.statLatest}>
                <VixText heading="label" additionalStyle={styles.statLabel}>
                  {statLabel}
                  {updated
                    ? ` · diperbarui ${pad2(updated.getHours())}.${pad2(
                        updated.getMinutes(),
                      )}`
                    : ''}
                </VixText>
                <VixText heading="header" additionalStyle={styles.statValue}>
                  {formatValue(data.current)}
                </VixText>
                {prev != null && (
                  <VixText
                    heading="label"
                    additionalStyle={up ? styles.upText : styles.downText}>
                    {up ? '▲' : '▼'} {formatValue(Math.abs(changeAbs))} (
                    {changePct >= 0 ? '+' : ''}
                    {changePct.toFixed(1)}%) vs kemarin
                  </VixText>
                )}
                <VixText heading="label" additionalStyle={styles.srcText}>
                  {srcText}
                </VixText>
              </View>
              <View style={styles.statGrid}>
                <View style={styles.statBox}>
                  <VixText heading="label" additionalStyle={styles.statBoxLabel}>
                    Tertinggi
                  </VixText>
                  <VixText heading="bold">{formatShort(high)}</VixText>
                </View>
                <View style={styles.statBox}>
                  <VixText heading="label" additionalStyle={styles.statBoxLabel}>
                    Terendah
                  </VixText>
                  <VixText heading="bold">{formatShort(low)}</VixText>
                </View>
                <View style={styles.statBox}>
                  <VixText heading="label" additionalStyle={styles.statBoxLabel}>
                    6 bln
                  </VixText>
                  <VixText heading="bold">
                    {sixMoPct >= 0 ? '+' : ''}
                    {sixMoPct.toFixed(0)}%
                  </VixText>
                </View>
              </View>
            </View>

            {/* Grafik tren harian ~6 bulan. Di-click → satu layar penuh yang
                bisa dicubit (components/investment/ChartFullscreen.tsx): di
                kartu sekecil ini, gerakan harian yang justru menentukan
                keputusan cuma terlihat sebagai getaran garis. */}
            <PressableScale
              style={styles.chartCard}
              scaleTo={0.98}
              onLayout={(e) => setChartW(e.nativeEvent.layout.width - 24)}
              onPress={() => setBesar(true)}>
              <View>
                <PriceChart
                  series={data.series}
                  width={chartW}
                  color={chartColor}
                  format={formatShort}
                />
                <View style={styles.expand}>
                  <IconSymbol
                    name="arrow.up.left.and.arrow.down.right"
                    size={16}
                    color={Color.TEXT_LABEL}
                  />
                </View>
              </View>
              <VixText heading="label" additionalStyle={styles.chartHint}>
                Click grafiknya untuk satu layar penuh, lalu cubit untuk
                memperbesar 🔍
              </VixText>
            </PressableScale>

            {/* ✨ Bacaan AI untuk aset INI — di bawah grafiknya, karena itu
                urutan membacanya: lihat trennya dulu, baru baca pendapat AI
                atasnya. Dulu ini sub-tab tersendiri (lihat AnalysisPanel). */}
            <AnalysisPanel asset={aiAsset} label={aiLabel} />

            <PressableScale style={styles.refreshButton} onPress={onReload}>
              <VixText heading="bold" additionalStyle={styles.refreshText}>
                🔄 Perbarui harga
              </VixText>
            </PressableScale>

            <VixText heading="label" additionalStyle={styles.noteText}>
              {noteText}
            </VixText>
          </>
        ) : null}
      </ScrollView>

      {/* Deret yang ditampilkan SAMA PERSIS dengan yang di kartu — layar penuh
          ini cuma menggambarnya lebih besar, tidak mengambil data baru. */}
      {data && (
        <ChartFullscreen
          visible={besar}
          onClose={() => setBesar(false)}
          title={heroTitle}
          sub={heroSub}
          series={data.series}
          color={chartColor}
          format={formatShort}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { ...SCREEN_CONTENT, paddingBottom: 24 },
  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    marginBottom: CARD_GAP,
  },
  heroTitle: { color: Color.TEXT_REVERSE },
  heroSub: { color: Color.TEXT_ON_DARK_MUTED },
  linkButton: {
    alignSelf: 'flex-start',
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 2,
  },
  linkText: { color: Color.ACCENT_DARK },
  // Dipakai di kartu gagal-muat (yang ada tombol "Coba lagi") — bukan pesan
  // satu baris seperti FormError, jadi tetap ditulis sendiri di sini.
  error: { color: Color.DANGER, marginBottom: 8 },
  errorCard: {
    ...PANEL,
    padding: 16,
    gap: 10,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: Color.MAIN,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  retryText: { color: Color.TEXT_REVERSE },
  statsCard: {
    ...PANEL,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  statLatest: { gap: 2 },
  statLabel: { color: Color.TEXT_LABEL },
  statValue: { color: Color.TEXT_TITLE },
  srcText: { color: Color.TEXT_LABEL, marginTop: 2 },
  upText: { color: Color.SUCCESS },
  downText: { color: Color.DANGER },
  statGrid: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  statBoxLabel: { color: Color.TEXT_LABEL },
  chartCard: {
    ...PANEL,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  chartHint: { color: Color.TEXT_LABEL, textAlign: 'center' },
  // Lambang "perbesar" di pojok kanan atas grafik — menjawab "ini bisa
  // di-click?" tanpa menunggu kalimat di bawahnya dibaca.
  expand: { position: 'absolute', top: 0, right: 0 },
  refreshButton: {
    alignSelf: 'center',
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 12,
  },
  refreshText: { color: Color.ACCENT_DARK },
  noteText: { color: Color.TEXT_LABEL },
});
