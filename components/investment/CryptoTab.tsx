import { MarketTab } from '@/components/investment/MarketTab';
import { useAsyncData } from '@/hooks/useAsyncData';
import { groupDigits } from '@/lib/format';
import { loadBtc } from '@/lib/market';
import { formatRupiah } from '@/lib/transactions';

const BTC_ORANGE = '#F7931A'; // warna khas Bitcoin untuk grafik
const BTC_ERROR =
  'Gagal mengambil harga Bitcoin dari Yahoo Finance. Cek koneksi lalu coba lagi.';

// Tab Crypto ₿ — harga Bitcoin LIVE dari Yahoo Finance (BTC-USD × kurs USD→IDR):
// angka utama dalam Rupiah, grafik tren harian ~6 bulan, & statistik.
export function CryptoTab() {
  const { data, loading, error, reload } = useAsyncData(loadBtc, BTC_ERROR);

  const srcText = data
    ? `1 BTC = $${groupDigits(String(Math.round(data.usd)))} · Kurs ${formatRupiah(Math.round(data.usdIdr))}/USD`
    : '';

  return (
    <MarketTab
      heroTitle="₿ Harga Bitcoin"
      heroSub="Live dari Yahoo Finance (BTC-USD) · dalam Rupiah"
      statLabel="Harga sekarang (1 BTC)"
      srcText={srcText}
      noteText="⚠️ Crypto sangat fluktuatif. Ini data untuk dipelajari, bukan ajakan beli/jual."
      chartColor={BTC_ORANGE}
      loading={loading}
      error={error}
      data={data && { current: data.idr, series: data.series, updatedAt: data.updatedAt }}
      onReload={() => reload(true)}
    />
  );
}
