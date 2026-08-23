import { useState } from 'react';

import { MarketTab } from '@/components/investment/MarketTab';
import { useAsyncData } from '@/hooks/useAsyncData';
import { groupDigits } from '@/lib/format';
import { openExternalUrl } from '@/lib/linking';
import { loadGold } from '@/lib/market';
import { formatRupiah } from '@/lib/transactions';

const LOGAM_MULIA_URL = 'https://www.logammulia.com/id/harga-emas-hari-ini';
const GOLD_ERROR =
  'Gagal mengambil harga emas dari Yahoo Finance. Cek koneksi lalu coba lagi.';

// Tab Emas 🏅 — harga emas 1 gr LIVE dari Yahoo Finance (COMEX GC=F × kurs
// USD→IDR ÷ 31,1035): angka utama, grafik tren harian ~6 bulan, & statistik.
export function GoldTab() {
  const { data, loading, error, reload } = useAsyncData(loadGold, GOLD_ERROR);

  // Gagal membuka tautan Logam Mulia bukan urusan pengambilan harga, jadi
  // pesannya disimpan sendiri — tapi tampil di tempat yang sama, dan ikut
  // hilang begitu 🔄 ditekan (persis seperti sebelumnya).
  const [linkError, setLinkError] = useState<string | null>(null);

  function openLogamMulia() {
    openExternalUrl(LOGAM_MULIA_URL, {
      onError: () => setLinkError('Gagal membuka tautan.'),
    });
  }

  const srcText = data
    ? `Emas COMEX $${groupDigits(String(Math.round(data.usdPerOz)))}/oz · Kurs ${formatRupiah(Math.round(data.usdIdr))}/USD`
    : '';

  return (
    <MarketTab
      heroTitle="🏅 Harga Emas 1 gr"
      heroSub="Live dari Yahoo Finance (COMEX) · estimasi Rupiah/gram"
      heroAction={{ label: '🔗 Bandingkan harga Antam', onPress: openLogamMulia }}
      statLabel="Harga sekarang"
      srcText={srcText}
      noteText="⚠️ Ini harga emas internasional (spot/futures). Harga beli Antam biasanya lebih tinggi karena ada premium & pajak."
      loading={loading}
      error={linkError ?? error}
      data={data}
      onReload={() => {
        setLinkError(null);
        reload(true);
      }}
    />
  );
}
