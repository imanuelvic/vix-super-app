import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { useAsyncData } from '@/hooks/useAsyncData';
import { groupDigits } from '@/lib/format';
import { dailyChangePercent, loadBtc } from '@/lib/market';

// 🪙 Satu baris harga Bitcoin di atas berita Crypto.
//
// Gunanya menjawab setengah pertanyaan "kenapa naik, kenapa turun": barisnya
// bilang HARI INI naik atau turun berapa, judul-judul di bawahnya yang bilang
// KENAPA. Tanpa ini, daftar judul kripto sulit dibaca sebagai satu cerita.
//
// Harganya dari `loadBtc` yang SAMA dengan fitur Investment ₿ (Yahoo Finance,
// tanpa kunci API, cache 5 menit di lib/market.ts), jadi membuka tab ini tidak
// menambah permintaan baru kalau barusan membuka Investment.
//
// Gagal ambil (offline, Yahoo diblokir) = barisnya TIDAK muncul sama sekali.
// Ini pelengkap; beritanya sendiri yang utama, dan satu pesan galat di atas
// daftar cuma bikin panik tanpa guna.
export function CryptoPulse() {
  const { data } = useAsyncData(loadBtc, '');

  if (!data) return null;
  const ubah = dailyChangePercent(data.series);
  const naik = (ubah ?? 0) >= 0;

  return (
    <View style={styles.wrap}>
      <VixText heading="label" additionalStyle={styles.label}>
        ₿ Bitcoin ${groupDigits(String(Math.round(data.usd)))}
      </VixText>
      {ubah === null ? null : (
        <VixText
          heading="label"
          additionalStyle={[styles.change, naik ? styles.up : styles.down]}>
          {naik ? '▲' : '▼'} {Math.abs(ubah).toFixed(1).replace('.', ',')}% hari ini
        </VixText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Sebaris dengan keterangan sumber di atasnya: rata kiri, tanpa kartu
  // sendiri. Baris ini penjelas, bukan kartu pasar kedua.
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  label: { color: Color.TEXT_TITLE },
  change: { fontWeight: '600' },
  up: { color: Color.SUCCESS },
  down: { color: Color.DANGER },
});
