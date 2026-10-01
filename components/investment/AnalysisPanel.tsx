import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD_GAP, PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { FormError } from '@/components/common/FormError';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SegmentTabs, type SegmentTab } from '@/components/common/SegmentTabs';
import { VixText } from '@/components/common/VixText';
import { useAiDay } from '@/hooks/useAiDay';
import { dayId } from '@/lib/format';
import { loadMarketAll } from '@/lib/market';
import {
  generateMarketAnalysis,
  kunciBacaan,
  loadMarketAiDay,
  marketAiErrorMessage,
  marketAttemptsLeft,
  marketBrief,
  MARKET_DAILY_CAP,
  MARKET_NEWS_LIMIT,
  saveMarketAiDay,
  seriesStat,
  type MarketAiDay,
  type MarketArah,
  type MarketAsset,
  type MarketHorizon,
  type MarketSignal,
} from '@/lib/marketAi';
import { fetchNews } from '@/lib/news';

// ✨ Bacaan AI untuk SATU aset — tinggal di dalam sub-tab aset itu sendiri.
//
// Sampai 30 Sep 2026 ini sub-tab tersendiri yang membacakan emas & Bitcoin
// sekaligus. Dipindah ke tiap sub-tab (1 Okt 2026) atas permintaan pemilik
// app, dan itu sekaligus memperbaiki dua hal:
//   • jawabannya tidak lagi terpotong di tengah (satu aset = seperempat
//     panjang; alasan lengkapnya di lib/marketAi.ts),
//   • pertanyaannya jadi ada di tempat pertanyaannya muncul. Kamu melihat
//     harga emas, lalu bertanya soal emas, di layar yang sama.
//
// Isinya bukan ramalan angka. Yang dijawab: arahnya ke mana, seberapa yakin,
// kenapa, apa yang bisa membuatnya meleset, dan apa yang masuk akal disiapkan.
//
// Satu bacaan = satu panggilan Gemini, lalu DISIMPAN seharian per aset per
// rentang: membuka tab ini lagi atau berpindah rentang tidak memanggil AI
// lagi selama bacaannya sudah ada.

const RENTANG: SegmentTab<MarketHorizon>[] = [
  { key: 'harian', label: '📅 Harian', sub: '1 sampai 3 hari' },
  { key: 'mingguan', label: '🗓️ Mingguan', sub: '1 sampai 2 pekan' },
];

const ARAH_META: Record<
  MarketArah,
  { tanda: string; label: string; color: string }
> = {
  naik: { tanda: '▲', label: 'Cenderung naik', color: Color.SUCCESS },
  turun: { tanda: '▼', label: 'Cenderung turun', color: Color.DANGER },
  sideways: { tanda: '▬', label: 'Belum jelas arahnya', color: Color.TEXT_LABEL },
};

/**
 * Judul berita yang ikut dibaca AI: kripto dulu (di situ alasan gerakan harga
 * biasanya ditulis), lalu bisnis. Satu sumber mati tidak membatalkan bacaan,
 * sisanya tetap terpakai; kalau dua-duanya mati, AI membaca dari angkanya saja
 * dan diminta menyebut keterbatasan itu sendiri.
 */
async function judulBerita(): Promise<string[]> {
  const hasil = await Promise.allSettled([
    fetchNews('crypto'),
    fetchNews('bloomberg'),
  ]);
  const kripto = hasil[0].status === 'fulfilled' ? hasil[0].value : [];
  const bisnis = hasil[1].status === 'fulfilled' ? hasil[1].value : [];
  return [...kripto.slice(0, 8), ...bisnis.slice(0, 4)]
    .slice(0, MARKET_NEWS_LIMIT)
    .map((n) => `${n.title} (${n.source})`);
}

export function AnalysisPanel({
  asset,
  label,
}: {
  asset: MarketAsset;
  /** Nama pendek asetnya untuk judul panel, mis. "Emas". */
  label: string;
}) {
  const today = dayId(new Date());
  const [rentang, setRentang] = useState<MarketHorizon>('harian');
  // null = jatah & bacaan hari ini belum selesai dibaca dari AsyncStorage.
  const [hari, setHari] = useAiDay(today, loadMarketAiDay);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const hasil = hari?.hasil[kunciBacaan(asset, rentang)] ?? null;
  const sisa = hari ? marketAttemptsLeft(hari) : 0;

  async function baca() {
    if (!hari || busy) return;
    setBusy(true);
    setAiError(null);
    try {
      // Harganya baru diambil SEKARANG, bukan saat tab dibuka: tanpa click
      // tombol ini, panel ini nol permintaan jaringan. Cache 5 menit di
      // lib/market.ts membuatnya biasanya nol permintaan baru juga.
      const pasar = await loadMarketAll(false);
      const brief = marketBrief({
        emas: seriesStat(pasar.gold.series),
        btc: seriesStat(pasar.btc.series),
        saham: seriesStat(pasar.ihsg.series),
        forex: seriesStat(pasar.forex.series),
      });
      const sinyal = await generateMarketAnalysis(
        asset,
        brief,
        await judulBerita(),
        rentang,
        today,
        hari.attempts + 1,
      );
      const berikut: MarketAiDay = {
        attempts: hari.attempts + 1,
        hasil: { ...hari.hasil, [kunciBacaan(asset, rentang)]: sinyal },
      };
      setHari(berikut);
      await saveMarketAiDay(today, berikut);
    } catch (e) {
      setAiError(marketAiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      <VixText heading="title" additionalStyle={styles.judul}>
        ✨ Baca Pasar {label}
      </VixText>
      <VixText heading="label" additionalStyle={styles.sub}>
        AI membaca harga 6 bulan emas, Bitcoin, IHSG & kurs, ditambah judul
        berita terbaru.
      </VixText>

      <View style={styles.rentang}>
        <SegmentTabs tabs={RENTANG} value={rentang} onChange={setRentang} />
      </View>

      <FormError message={aiError} gap="top" />

      {hasil ? (
        <Sinyal sinyal={hasil} />
      ) : (
        <VixText heading="label" additionalStyle={styles.kosong}>
          Belum dibaca hari ini. Bacaannya disimpan seharian, jadi satu click
          cukup.
        </VixText>
      )}

      <PrimaryButton
        label={hasil ? '✨ Baca ulang' : '✨ Baca pasar sekarang'}
        busy={busy}
        disabled={hari === null || sisa === 0}
        onPress={baca}
      />
      <VixText heading="label" additionalStyle={styles.jatah}>
        {hari === null
          ? ' '
          : sisa === 0
            ? `Jatah ${MARKET_DAILY_CAP} bacaan hari ini sudah terpakai. Lanjut besok.`
            : `Sisa ${sisa} dari ${MARKET_DAILY_CAP} bacaan hari ini.`}
      </VixText>
    </View>
  );
}

function Sinyal({ sinyal }: { sinyal: MarketSignal }) {
  const arah = ARAH_META[sinyal.arah];
  return (
    <View style={styles.isi}>
      <View style={styles.atas}>
        <VixText heading="bold" additionalStyle={{ color: arah.color }}>
          {arah.tanda} {arah.label}
        </VixText>
        <VixText heading="label" additionalStyle={styles.keyakinan}>
          Keyakinan {sinyal.keyakinan}
        </VixText>
      </View>
      <VixText heading="bold" additionalStyle={styles.ringkas}>
        {sinyal.ringkas}
      </VixText>
      {sinyal.alasan.map((a) => (
        <VixText key={a} heading="label" additionalStyle={styles.alasan}>
          • {a}
        </VixText>
      ))}
      {!!sinyal.cermati && (
        <VixText heading="label" additionalStyle={styles.alasan}>
          ⚠️ Cermati: {sinyal.cermati}
        </VixText>
      )}
      {!!sinyal.aksi && (
        <VixText heading="label" additionalStyle={styles.alasan}>
          🎯 Yang bisa disiapkan: {sinyal.aksi}
        </VixText>
      )}
      <VixText heading="label" additionalStyle={styles.catatan}>
        {sinyal.catatan}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...PANEL, padding: 14, marginBottom: CARD_GAP, gap: 8 },
  judul: { color: Color.TEXT_TITLE },
  sub: { color: Color.TEXT_LABEL },
  rentang: { marginTop: 2 },
  kosong: { color: Color.TEXT_LABEL },
  isi: { gap: 4 },
  atas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  keyakinan: { color: Color.TEXT_LABEL },
  ringkas: { color: Color.TEXT_TITLE, marginTop: 2 },
  alasan: { color: Color.TEXT_PARAGRAPH },
  catatan: { color: Color.TEXT_LABEL, marginTop: 4 },
  jatah: { color: Color.TEXT_LABEL, textAlign: 'center' },
});
