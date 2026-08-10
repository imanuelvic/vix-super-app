import { MarketTab, useMarket } from '@/components/investment/MarketTab';
import { loadForex } from '@/lib/market';

const FOREX_GREEN = '#2E7D32'; // hijau "uang" untuk grafik
const FOREX_ERROR =
  'Gagal mengambil kurs Rupiah dari Yahoo Finance. Cek koneksi lalu coba lagi.';

// Tab Forex 💵 — kurs Rupiah terhadap Dollar (USDIDR=X) LIVE dari Yahoo Finance:
// berapa Rupiah untuk 1 USD sekarang, grafik tren harian ~6 bulan, & statistik.
// Nilainya sudah dalam Rupiah → pakai format Rupiah bawaan MarketTab.
export function ForexTab() {
  const { data, loading, error, reload } = useMarket(loadForex, FOREX_ERROR);

  return (
    <MarketTab
      heroTitle="💵 Kurs Rupiah (USD → IDR)"
      heroSub="Live dari Yahoo Finance (USDIDR=X) · Rupiah per 1 USD"
      statLabel="1 USD sekarang"
      srcText="Kurs pasar USD→IDR · Yahoo Finance"
      noteText="⚠️ Ini kurs pasar (indikatif). Kurs jual/beli di bank atau money changer biasanya sedikit berbeda."
      chartColor={FOREX_GREEN}
      loading={loading}
      error={error}
      data={data && { current: data.idr, series: data.series, updatedAt: data.updatedAt }}
      onReload={() => reload(true)}
    />
  );
}
