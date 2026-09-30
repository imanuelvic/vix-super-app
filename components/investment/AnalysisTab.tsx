import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD_GAP, PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT } from '@/assets/style/layout';
import { FormError } from '@/components/common/FormError';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SegmentTabs, type SegmentTab } from '@/components/common/SegmentTabs';
import { VixText } from '@/components/common/VixText';
import { useAsyncData } from '@/hooks/useAsyncData';
import { dayId, formatShortRupiah } from '@/lib/format';
import { loadMarketAll } from '@/lib/market';
import {
  generateMarketAnalysis,
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
  type MarketHorizon,
  type MarketSignal,
} from '@/lib/marketAi';
import { fetchNews } from '@/lib/news';

// ✨ Sub-tab Analysis — bacaan AI atas emas & Bitcoin, harian atau mingguan.
//
// Isinya bukan ramalan angka. Yang dijawab: arahnya ke mana, seberapa yakin,
// kenapa, apa yang bisa membuatnya meleset, dan apa yang masuk akal disiapkan.
// Alasan bentuk itu (dan seluruh pagar biayanya) ada di lib/marketAi.ts.
//
// Satu bacaan = satu panggilan Gemini, lalu DISIMPAN seharian: membuka tab ini
// lagi, berpindah rentang, atau berpindah tab tidak memanggil AI lagi.

const PASAR_ERROR =
  'Gagal mengambil harga dari Yahoo Finance. Cek koneksi lalu coba lagi.';

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

export function AnalysisTab() {
  const today = dayId(new Date());
  const { data: pasar, loading, error, reload } = useAsyncData(loadMarketAll, PASAR_ERROR);

  const [rentang, setRentang] = useState<MarketHorizon>('harian');
  // null = jatah & hasil hari ini belum selesai dibaca dari AsyncStorage.
  const [hari, setHari] = useState<MarketAiDay | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    loadMarketAiDay(today).then((d) => {
      if (hidup) setHari(d);
    });
    return () => {
      hidup = false;
    };
  }, [today]);

  const hasil = hari ? hari[rentang] : null;
  const sisa = hari ? marketAttemptsLeft(hari) : 0;

  async function baca() {
    if (!pasar || !hari || busy) return;
    setBusy(true);
    setAiError(null);
    try {
      const brief = marketBrief({
        emas: seriesStat(pasar.gold.series),
        btc: seriesStat(pasar.btc.series),
        kurs: seriesStat(pasar.forex.series),
      });
      const analysis = await generateMarketAnalysis(
        brief,
        await judulBerita(),
        rentang,
        today,
        hari.attempts + 1,
      );
      const berikut: MarketAiDay = {
        ...hari,
        attempts: hari.attempts + 1,
        [rentang]: analysis,
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
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <VixText heading="subheader" additionalStyle={styles.heroTitle}>
            ✨ Baca Pasar
          </VixText>
          <VixText heading="label" additionalStyle={styles.heroSub}>
            AI membaca harga 6 bulan emas, Bitcoin & kurs, ditambah judul berita
            kripto terbaru.
          </VixText>
        </View>

        <SegmentTabs tabs={RENTANG} value={rentang} onChange={setRentang} />

        {loading && !pasar ? (
          <LoadingCenter />
        ) : (
          <>
            <FormError message={error} gap="top" />

            {/* Angka yang DIBACA AI, terlihat apa adanya. Tanpa ini, jawabannya
                terasa datang entah dari mana dan tidak bisa diperiksa. */}
            {pasar && (
              <View style={styles.dataCard}>
                <VixText heading="label" additionalStyle={styles.dataLabel}>
                  Angka yang dibaca
                </VixText>
                <View style={styles.dataRow}>
                  <Angka label="🏅 Emas/gr" value={formatShortRupiah(pasar.gold.current)} />
                  <Angka label="₿ Bitcoin" value={formatShortRupiah(pasar.btc.idr)} />
                  <Angka label="💵 1 USD" value={formatShortRupiah(pasar.forex.idr)} />
                </View>
                <PressableScale style={styles.refresh} onPress={() => reload(true)}>
                  <VixText heading="bold" additionalStyle={styles.refreshText}>
                    🔄 Perbarui harga
                  </VixText>
                </PressableScale>
              </View>
            )}

            <FormError message={aiError} gap="top" />

            {hasil ? (
              <>
                <SignalCard judul="🏅 Emas" sinyal={hasil.emas} />
                <SignalCard judul="₿ Bitcoin" sinyal={hasil.btc} />
                <VixText heading="label" additionalStyle={styles.catatan}>
                  {hasil.catatan}
                </VixText>
              </>
            ) : (
              <View style={styles.kosongCard}>
                <VixText heading="bold" additionalStyle={styles.kosongTitle}>
                  Belum dibaca hari ini
                </VixText>
                <VixText heading="label">
                  Bacaannya disimpan seharian, jadi satu click cukup. Berpindah
                  rentang tidak memanggil AI lagi selama bacaannya sudah ada.
                </VixText>
              </View>
            )}

            <PrimaryButton
              label={hasil ? '✨ Baca ulang' : '✨ Baca pasar sekarang'}
              busy={busy}
              disabled={!pasar || hari === null || sisa === 0}
              onPress={baca}
              additionalStyle={styles.action}
            />
            <VixText heading="label" additionalStyle={styles.jatah}>
              {hari === null
                ? ' '
                : sisa === 0
                  ? `Jatah ${MARKET_DAILY_CAP} bacaan hari ini sudah terpakai. Lanjut besok.`
                  : `Sisa ${sisa} dari ${MARKET_DAILY_CAP} bacaan hari ini.`}
            </VixText>

            <VixText heading="label" additionalStyle={styles.noteText}>
              ⚠️ Ini bacaan dari data terbatas untuk dipelajari, BUKAN nasihat
              keuangan. Keputusan beli & jual tetap milikmu.
            </VixText>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Angka({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataBox}>
      <VixText heading="label" additionalStyle={styles.dataBoxLabel}>
        {label}
      </VixText>
      <VixText heading="bold">{value}</VixText>
    </View>
  );
}

function SignalCard({ judul, sinyal }: { judul: string; sinyal: MarketSignal }) {
  const arah = ARAH_META[sinyal.arah];
  return (
    <View style={styles.signalCard}>
      <View style={styles.signalTop}>
        <VixText heading="title" additionalStyle={styles.signalTitle}>
          {judul}
        </VixText>
        <VixText heading="bold" additionalStyle={{ color: arah.color }}>
          {arah.tanda} {arah.label}
        </VixText>
      </View>
      <VixText heading="label" additionalStyle={styles.keyakinan}>
        Keyakinan {sinyal.keyakinan}
      </VixText>
      <VixText heading="bold" additionalStyle={styles.ringkas}>
        {sinyal.ringkas}
      </VixText>
      {sinyal.alasan.map((a) => (
        <VixText key={a} heading="label" additionalStyle={styles.alasan}>
          • {a}
        </VixText>
      ))}
      {!!sinyal.cermati && (
        <VixText heading="label" additionalStyle={styles.cermati}>
          ⚠️ Cermati: {sinyal.cermati}
        </VixText>
      )}
      {!!sinyal.aksi && (
        <VixText heading="label" additionalStyle={styles.aksi}>
          🎯 Yang bisa disiapkan: {sinyal.aksi}
        </VixText>
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
  dataCard: { ...PANEL, padding: 14, marginTop: CARD_GAP, marginBottom: CARD_GAP, gap: 10 },
  dataLabel: { color: Color.TEXT_LABEL },
  dataRow: { flexDirection: 'row', gap: 8 },
  dataBox: {
    flex: 1,
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  dataBoxLabel: { color: Color.TEXT_LABEL },
  refresh: {
    alignSelf: 'center',
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  refreshText: { color: Color.ACCENT_DARK },
  kosongCard: { ...PANEL, padding: 14, marginBottom: CARD_GAP, gap: 4 },
  kosongTitle: { color: Color.TEXT_TITLE },
  signalCard: { ...PANEL, padding: 14, marginBottom: CARD_GAP, gap: 4 },
  signalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  signalTitle: { color: Color.TEXT_TITLE },
  keyakinan: { color: Color.TEXT_LABEL },
  ringkas: { color: Color.TEXT_TITLE, marginTop: 4 },
  alasan: { color: Color.TEXT_PARAGRAPH },
  cermati: { color: Color.TEXT_PARAGRAPH, marginTop: 4 },
  aksi: { color: Color.TEXT_PARAGRAPH },
  catatan: { color: Color.TEXT_LABEL, marginBottom: CARD_GAP },
  action: { marginTop: 4 },
  jatah: { color: Color.TEXT_LABEL, textAlign: 'center', marginTop: 8 },
  noteText: { color: Color.TEXT_LABEL, marginTop: 12 },
});
