import { useRouter } from 'expo-router';
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
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useLiveAll } from '@/hooks/useLiveAll';
import {
  averageDeposit,
  emergencyTarget,
  fundFlow,
  fundProgress,
  fundRows,
  monthsToTarget,
  pensionTarget,
  PENSION_MONTHS,
  type FundRow,
  type FundTarget,
} from '@/lib/emergencyFund';
import { liveMonths, reviewLiveStart, reviewYears } from '@/lib/financeReview';
import { formatShortDate, formatShortRupiah } from '@/lib/format';
import {
  subscribeFundEntries,
  type FundEntry,
} from '@/lib/saku';
import {
  fetchTransactionsRange,
  formatRupiah,
  type Transaction,
} from '@/lib/transactions';

/** Dompet Saku yang dipakai dana darurat. JANGAN diganti: itu id Firestore. */
const FUND_KEY = 'emergency';

// 🚨 Emergency Fund — berapa yang harus dikejar, dan sudah sampai mana.
//
// Mutasinya dompet Saku biasa (users/{uid}/funds/emergency/entries), jadi
// menabung dari layar Saku maupun dari sini hasilnya SATU data yang sama.
// Yang beda cuma bacaannya: di Saku ia daftar mutasi, di sini ia target yang
// dikejar, berapa kurangnya, dan berapa bulan lagi kalau setorannya segini.
//
// ── Targetnya dihitung, bukan diketik ─────────────────────────────────────
// Rumusnya diambil dari spreadsheet pemilik app sendiri dan dibuktikan cocok
// persis di seluruh tahun yang punya datanya (lihat lib/emergencyFund.ts):
//   dana darurat = rata-rata pemasukan bulanan × 5
//   dana pensiun = rata-rata pengeluaran bulanan × 300
// Target yang diketik tangan basi diam-diam begitu penghasilannya berubah;
// yang dihitung ikut bergerak sendiri.
export default function EmergencyFundScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<FundEntry[] | null>(null);
  const [items, setItems] = useState<Transaction[] | null>(null);

  useLiveAll((uid) => [
    subscribeFundEntries(uid, FUND_KEY, setEntries, () => setEntries([])),
  ]);

  // Transaksi sejak garis batas Review: bahan rata-rata bulanan yang jadi
  // dasar targetnya. Diambil SEKALI, bukan dilanggan.
  useEffect(() => {
    if (!user) return;
    let hidup = true;
    fetchTransactionsRange(user.uid, reviewLiveStart(), new Date(2100, 0, 1))
      .then((rows) => {
        if (hidup) setItems(rows);
      })
      .catch(() => {
        if (hidup) setItems([]);
      });
    return () => {
      hidup = false;
    };
  }, [user]);

  const years = useMemo(
    () => reviewYears(liveMonths(items ?? [])),
    [items],
  );
  const darurat = useMemo(() => emergencyTarget(years), [years]);
  const pensiun = useMemo(() => pensionTarget(years), [years]);

  const rows = useMemo(() => fundRows(entries ?? []), [entries]);
  const saldo = rows[0]?.running ?? 0;
  const arus = useMemo(() => fundFlow(entries ?? []), [entries]);
  const rata = useMemo(() => averageDeposit(entries ?? []), [entries]);

  const maju = fundProgress(saldo, darurat.target);
  const sisaBulan = monthsToTarget(maju, rata);

  if (entries === null || items === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader backLabel="Finance" title="Emergency Fund 🚨" />
        <LoadingCenter />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Finance"
        title="Emergency Fund 🚨"
        subtitle="Simpanan untuk hal tak terduga"
        right={
          // Menabung & mengubah mutasi tetap di layar Saku: satu tempat
          // menulis, satu tempat membaca.
          <EmojiButton
            emoji="👛"
            onPress={() =>
              router.push({
                pathname: '/saku/[key]',
                params: { key: FUND_KEY },
              })
            }
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.kolom}>
          {/* Yang paling ingin diketahui: sudah berapa, kurang berapa. */}
          <View style={styles.hero}>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              Terkumpul
            </VixText>
            <VixText heading="header" additionalStyle={styles.heroValue}>
              {formatRupiah(maju.saved)}
            </VixText>
            <ProgressBar
              value={maju.percent}
              total={100}
              height={10}
              color={maju.done ? Color.SUCCESS : Color.MAIN_LIGHT}
              track={Color.MAIN}
            />
            <View style={styles.heroBaris}>
              <VixText heading="label" additionalStyle={styles.heroLabel}>
                {maju.percent.toFixed(1)}% dari {formatRupiah(maju.target)}
              </VixText>
              <VixText heading="label" additionalStyle={styles.heroLabel}>
                {maju.done ? '✅ Tercapai' : `Kurang ${formatRupiah(maju.short)}`}
              </VixText>
            </View>
          </View>

          {/* Satu kalimat, bukan paragraf: inilah yang perlu dia lakukan. */}
          <View style={styles.saran}>
            <VixText heading="bold" additionalStyle={styles.saranJudul}>
              {maju.done
                ? '✅ Dana daruratmu sudah aman'
                : sisaBulan === null
                  ? '🌱 Mulai sisihkan tiap bulan'
                  : `🎯 ${sisaBulan} bulan lagi kalau setoranmu tetap segini`}
            </VixText>
            <VixText heading="label" additionalStyle={styles.saranSub}>
              {rata > 0
                ? `Rata-rata kamu menabung ${formatRupiah(rata)} per bulan.`
                : 'Belum ada setoran yang tercatat.'}
            </VixText>
          </View>

          <Target
            emoji="🚨"
            nama="Dana Darurat"
            target={darurat}
            kali={`${formatRupiah(darurat.perMonth)} per bulan × 5`}
            alasan="Supaya kehilangan penghasilan tidak langsung jadi utang."
          />
          <Target
            emoji="🪑"
            nama="Dana Pensiun"
            target={pensiun}
            kali={`${formatRupiah(pensiun.perMonth)} per bulan × ${PENSION_MONTHS}`}
            alasan="Dua puluh lima tahun hidup dengan gaya hidup sekarang."
          />

          {/* Masuk & keluar seluruh mutasi */}
          <View style={styles.arus}>
            <View style={styles.arusSel}>
              <VixText heading="label" additionalStyle={styles.arusLabel}>
                Masuk
              </VixText>
              <VixText heading="bold" additionalStyle={styles.arusMasuk}>
                {formatRupiah(arus.addition)}
              </VixText>
            </View>
            <View style={styles.arusSel}>
              <VixText heading="label" additionalStyle={styles.arusLabel}>
                Keluar
              </VixText>
              <VixText heading="bold" additionalStyle={styles.arusKeluar}>
                {formatRupiah(arus.reduction)}
              </VixText>
            </View>
          </View>

          <VixText heading="title" additionalStyle={styles.judul}>
            📜 Mutasi
          </VixText>

          {rows.length === 0 ? (
            <EmptyText>
              Belum ada mutasi. Click 👛 di pojok kanan atas untuk menabung
              pertama kali 🌱
            </EmptyText>
          ) : (
            rows.map((r) => <Mutasi key={r.entry.id} row={r} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Satu target beserta asal angkanya. */
function Target({
  emoji,
  nama,
  target,
  kali,
  alasan,
}: {
  emoji: string;
  nama: string;
  target: FundTarget;
  /** Asal angkanya, mis. "Rp10.000.000 per bulan × 5". */
  kali: string;
  alasan: string;
}) {
  return (
    <View style={styles.target}>
      <View style={styles.targetAtas}>
        <VixText heading="bold" additionalStyle={styles.targetNama}>
          {emoji} {nama}
        </VixText>
        <VixText heading="bold" additionalStyle={styles.targetNilai}>
          {formatShortRupiah(target.target)}
        </VixText>
      </View>
      <VixText heading="label" additionalStyle={styles.targetSub}>
        {target.months === 0 ? 'Belum bisa dihitung, catat dulu beberapa bulan.' : kali}
      </VixText>
      <VixText heading="label" additionalStyle={styles.targetAlasan}>
        {alasan}
      </VixText>
    </View>
  );
}

/**
 * Satu baris mutasi. Yang membuatnya beda dari mutasi Saku biasa: kolom
 * SALDO BERJALAN, yang menjawab "waktu itu sudah terkumpul berapa".
 */
function Mutasi({ row }: { row: FundRow }) {
  const masuk = row.entry.direction === 'debit';
  return (
    <View style={styles.mutasi}>
      <View style={styles.mutasiTanda}>
        <IconSymbol
          name={masuk ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill'}
          size={18}
          color={masuk ? Color.SUCCESS : Color.DANGER}
        />
      </View>
      <View style={styles.mutasiIsi}>
        <VixText heading="bold" numberOfLines={1} additionalStyle={styles.mutasiJudul}>
          {row.entry.title}
        </VixText>
        <VixText heading="label" additionalStyle={styles.mutasiTanggal}>
          {formatShortDate(row.entry.date.toDate())}
          {row.entry.cause ? ` · ${row.entry.cause}` : ''}
        </VixText>
      </View>
      <View style={styles.mutasiAngka}>
        <VixText
          heading="bold"
          additionalStyle={masuk ? styles.mutasiMasuk : styles.mutasiKeluar}>
          {masuk ? '+' : '−'}
          {formatShortRupiah(row.entry.amount)}
        </VixText>
        <VixText heading="label" additionalStyle={styles.mutasiSaldo}>
          {formatShortRupiah(row.running)}
        </VixText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { ...SCREEN_SAFE },
  content: { ...SCREEN_CONTENT, paddingBottom: 32 },
  kolom: { ...CONTENT_COLUMN },

  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 20,
    gap: 8,
    marginBottom: CARD_GAP,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  heroBaris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },

  saran: { ...PANEL, padding: 14, gap: 2, marginBottom: CARD_GAP },
  saranJudul: { color: Color.TEXT_TITLE },
  saranSub: { color: Color.TEXT_LABEL },

  target: { ...PANEL, padding: 14, gap: 3, marginBottom: 8 },
  targetAtas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  targetNama: { flex: 1, color: Color.TEXT_TITLE },
  targetNilai: { color: Color.MAIN_DARK },
  targetSub: { color: Color.TEXT_LABEL },
  targetAlasan: { color: Color.TEXT_PARAGRAPH },

  arus: { flexDirection: 'row', gap: 8, marginTop: 6 },
  arusSel: { ...PANEL, flex: 1, padding: 12, gap: 2 },
  arusLabel: { color: Color.TEXT_LABEL },
  arusMasuk: { color: Color.SUCCESS },
  arusKeluar: { color: Color.DANGER },

  judul: { color: Color.TEXT_TITLE, marginTop: 18, marginBottom: 8 },

  mutasi: {
    ...PANEL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  mutasiTanda: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Color.CONTRAST_CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutasiIsi: { flex: 1, gap: 1 },
  mutasiJudul: { color: Color.TEXT_TITLE },
  mutasiTanggal: { color: Color.TEXT_LABEL },
  mutasiAngka: { alignItems: 'flex-end', gap: 1 },
  mutasiMasuk: { color: Color.SUCCESS },
  mutasiKeluar: { color: Color.DANGER },
  // Saldo berjalan: inilah kolom yang membuat daftar ini berguna.
  mutasiSaldo: { color: Color.TEXT_PLACEHOLDER },
});
