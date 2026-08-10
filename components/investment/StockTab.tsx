import { MarketTab, useMarket } from '@/components/investment/MarketTab';
import { groupDigits } from '@/lib/format';
import { loadIhsg } from '@/lib/market';

const IHSG_BLUE = '#3D82B5'; // biru "investment" untuk grafik
const IHSG_ERROR =
  'Gagal mengambil data IHSG dari Yahoo Finance. Cek koneksi lalu coba lagi.';

// IHSG adalah POIN indeks, bukan harga Rupiah → tampilkan angka bergrup tanpa "Rp".
const points = (n: number) => groupDigits(String(Math.round(n)));

// Tab Saham 📊 — IHSG (Indeks Harga Saham Gabungan) LIVE dari Yahoo Finance
// (^JKSE): poin sekarang, grafik tren harian ~6 bulan, & statistik.
export function StockTab() {
  const { data, loading, error, reload } = useMarket(loadIhsg, IHSG_ERROR);

  return (
    <MarketTab
      heroTitle="📊 IHSG (Saham Indonesia)"
      heroSub="Live dari Yahoo Finance (^JKSE) · poin indeks"
      statLabel="Poin IHSG sekarang"
      srcText="Indeks Harga Saham Gabungan · Bursa Efek Indonesia (IDX)"
      noteText="⚠️ Ini indeks gabungan (poin), bukan harga 1 saham. Naik/turunnya mencerminkan pasar saham Indonesia secara umum."
      chartColor={IHSG_BLUE}
      formatValue={points}
      formatShort={points}
      loading={loading}
      error={error}
      data={data}
      onReload={() => reload(true)}
    />
  );
}
