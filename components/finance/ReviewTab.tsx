import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD_GAP, PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CONTENT_COLUMN, SCREEN_CONTENT } from '@/assets/style/layout';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormError } from '@/components/common/FormError';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  reviewTotals,
  reviewYears,
  type ReviewAmounts,
  type ReviewMonth,
} from '@/lib/financeReview';
import { shareFinanceReview } from '@/lib/financeReviewPdf';
import { formatShortRupiah, MONTH_NAMES } from '@/lib/format';
import { pdfErrorOf } from '@/lib/messages';
import { formatRupiah } from '@/lib/transactions';

// 📋 Review — rekap bulanan sejak 2015, di dalam app.
//
// Bentuknya sengaja BUKAN tiruan spreadsheet-nya. Di lembar aslinya bulan
// melintang ke samping; dua belas kolom angka memang nyaman di layar laptop,
// tapi di layar HP ia jadi tabel yang harus digeser-geser dan tidak pernah
// terbaca utuh. Jadi di sini bulannya turun ke BAWAH dan yang melintang cuma
// tiga angka yang benar-benar ditanyakan: masuk, keluar, sisa.
//
// Rinciannya (pengeluaran, tabungan, investasi dipisah) ada di PDF-nya, yang
// memang mendatar dan punya ruang.
//
// Angkanya tidak dihitung di sini sama sekali; itu urusan lib/financeReview.ts
// yang murni & dicocokkan suite dengan TOTAL di lembar aslinya.

/** Nominal satu sel. Titik = bulan itu memang tidak pernah dicatat. */
function sel(n: number | null): string {
  return n === null ? '·' : formatShortRupiah(n);
}

export function ReviewTab({
  live,
  loading,
}: {
  /** Bulan yang angkanya dihitung app sendiri ("YYYY-MM" → jumlah). */
  live: Record<string, ReviewAmounts>;
  loading: boolean;
}) {
  const years = useMemo(() => reviewYears(live), [live]);
  const totals = useMemo(() => reviewTotals(years), [years]);

  // Tahun yang sedang dibuka. Default tahun paling baru yang ada catatannya,
  // bukan tahun sistem: kalau tahunnya berganti sebelum ada transaksi apa pun,
  // layar ini tidak boleh membuka halaman kosong.
  const [year, setYear] = useState(() => years[0]?.year ?? 2026);
  const aktif = years.find((y) => y.year === year) ?? years[0] ?? null;

  const index = years.findIndex((y) => y.year === aktif?.year);
  const adaSebelum = index >= 0 && index < years.length - 1;
  const adaSesudah = index > 0;

  const [bagikanBusy, setBagikanBusy] = useState(false);
  const [bagikanError, setBagikanError] = useState<string | null>(null);

  async function bagikan() {
    if (!aktif || bagikanBusy) return;
    setBagikanBusy(true);
    setBagikanError(null);
    try {
      await shareFinanceReview(aktif, totals, new Date());
    } catch {
      setBagikanError(pdfErrorOf('rekap'));
    } finally {
      setBagikanBusy(false);
    }
  }

  if (loading) return <LoadingCenter />;
  if (!aktif) return null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.kolom}>
        {/* Navigasi tahun — bentuk yang sama dengan navigasi bulan di atas
            layar Finance, supaya dua-duanya terbaca sebagai hal yang sama.
            Tombol 📤 duduk di baris ini, bukan di pita header: yang dibagikan
            adalah TAHUN YANG SEDANG DILIHAT, jadi tombolnya pantas berdiri
            tepat di sebelah tahunnya. */}
        <View style={styles.tahunBar}>
          <View style={styles.tahunNav}>
            <PressableScale
              onPress={() => adaSebelum && setYear(years[index + 1].year)}
              disabled={!adaSebelum}
              hitSlop={10}>
              <IconSymbol
                name="chevron.left"
                size={22}
                color={adaSebelum ? Color.MAIN : Color.DISABLED}
              />
            </PressableScale>
            <VixText heading="title" additionalStyle={styles.tahunText}>
              {aktif.year}
            </VixText>
            <PressableScale
              onPress={() => adaSesudah && setYear(years[index - 1].year)}
              disabled={!adaSesudah}
              hitSlop={10}>
              <IconSymbol
                name="chevron.right"
                size={22}
                color={adaSesudah ? Color.MAIN : Color.DISABLED}
              />
            </PressableScale>
          </View>
          <EmojiButton emoji="📤" busy={bagikanBusy} onPress={bagikan} />
        </View>

        <FormError message={bagikanError} />

        {/* Ringkasan tahun itu */}
        <View style={styles.hero}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            Sisa {aktif.year}
            {aktif.live ? ' · sebagian dari transaksi app' : ''}
          </VixText>
          <VixText
            heading="subheader"
            additionalStyle={
              aktif.balance.total < 0 ? styles.heroMinus : styles.heroValue
            }>
            {formatRupiah(aktif.balance.total)}
          </VixText>
          <View style={styles.heroBaris}>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              Masuk {formatRupiah(aktif.income.total)}
            </VixText>
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              Keluar {formatRupiah(aktif.outflow.total)}
            </VixText>
          </View>
        </View>

        {/* Tabel bulan */}
        <View style={styles.tabel}>
          <View style={[styles.baris, styles.kepala]}>
            <VixText heading="label" additionalStyle={styles.kolBulanKepala}>
              Bulan
            </VixText>
            <VixText heading="label" additionalStyle={styles.kolAngkaKepala}>
              Masuk
            </VixText>
            <VixText heading="label" additionalStyle={styles.kolAngkaKepala}>
              Keluar
            </VixText>
            <VixText heading="label" additionalStyle={styles.kolAngkaKepala}>
              Sisa
            </VixText>
          </View>

          {aktif.months.map((m) => (
            <Baris key={m.month} bulan={m} />
          ))}

          <Ringkas
            label="TOTAL"
            masuk={aktif.income.total}
            keluar={aktif.outflow.total}
            sisa={aktif.balance.total}
            tebal
          />
          <Ringkas
            label="RATA-RATA"
            masuk={aktif.income.average}
            keluar={aktif.outflow.average}
            sisa={aktif.balance.average}
          />
        </View>

        {/* Semua tahun — sekali pandang, sebelas tahun. */}
        <VixText heading="title" additionalStyle={styles.judulTahun}>
          📆 Semua Tahun
        </VixText>
        {totals.map((t) => (
          <PressableScale
            key={t.year}
            style={[styles.tahunRow, t.year === aktif.year && styles.tahunAktif]}
            onPress={() => setYear(t.year)}>
            <VixText heading="bold" additionalStyle={styles.tahunRowLabel}>
              {t.year}
            </VixText>
            <VixText heading="label" additionalStyle={styles.tahunRowAngka}>
              {sel(t.income)}
            </VixText>
            <VixText heading="label" additionalStyle={styles.tahunRowAngka}>
              {sel(t.outflow)}
            </VixText>
            <VixText
              heading="bold"
              additionalStyle={[
                styles.tahunRowAngka,
                t.balance < 0 ? styles.minus : styles.plus,
              ]}>
              {sel(t.balance)}
            </VixText>
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  );
}

/** Satu bulan di tabel. */
function Baris({ bulan }: { bulan: ReviewMonth }) {
  const kosong = bulan.source === null;
  return (
    <View style={[styles.baris, kosong && styles.barisKosong]}>
      <VixText heading="label" additionalStyle={styles.kolBulan}>
        {MONTH_NAMES[bulan.month].slice(0, 3)}
      </VixText>
      <VixText heading="label" additionalStyle={styles.kolAngka}>
        {sel(bulan.income)}
      </VixText>
      <VixText heading="label" additionalStyle={styles.kolAngka}>
        {sel(bulan.outflow)}
      </VixText>
      <VixText
        heading="bold"
        additionalStyle={[
          styles.kolAngka,
          bulan.balance === null
            ? styles.kosong
            : bulan.balance < 0
              ? styles.minus
              : styles.plus,
        ]}>
        {sel(bulan.balance)}
      </VixText>
    </View>
  );
}

/** Baris TOTAL / RATA-RATA di kaki tabel. */
function Ringkas({
  label,
  masuk,
  keluar,
  sisa,
  tebal = false,
}: {
  label: string;
  masuk: number;
  keluar: number;
  sisa: number;
  tebal?: boolean;
}) {
  return (
    <View style={[styles.baris, styles.kaki, tebal && styles.kakiTebal]}>
      <VixText heading="bold" additionalStyle={styles.kolBulan}>
        {label}
      </VixText>
      <VixText heading="label" additionalStyle={styles.kolAngka}>
        {sel(masuk)}
      </VixText>
      <VixText heading="label" additionalStyle={styles.kolAngka}>
        {sel(keluar)}
      </VixText>
      <VixText
        heading="bold"
        additionalStyle={[
          styles.kolAngka,
          sisa < 0 ? styles.minus : styles.plus,
        ]}>
        {sel(sisa)}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { ...SCREEN_CONTENT, paddingBottom: 24 },
  // Di iPad tabelnya berhenti di 680 lalu duduk di tengah; tanpa ini empat
  // kolom angka terlempar ke tepi layar dan tengahnya jadi padang kosong.
  kolom: { ...CONTENT_COLUMN },

  tahunBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 10,
  },
  tahunNav: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  tahunText: { color: Color.TEXT_TITLE, minWidth: 80, textAlign: 'center' },

  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 4,
    marginBottom: CARD_GAP,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  heroMinus: { color: Color.FINANCE_EXPENSE },
  heroBaris: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },

  tabel: { ...PANEL, paddingHorizontal: 12, paddingVertical: 4 },
  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Color.BORDER,
  },
  // Bulan yang memang tak pernah dicatat: dipudarkan, bukan disembunyikan.
  // Dua belas baris yang selalu lengkap bikin mata gampang membandingkan
  // tahun yang satu dengan yang lain.
  barisKosong: { opacity: 0.45 },
  kepala: { borderBottomColor: Color.TEXT_PLACEHOLDER },
  kaki: { borderBottomWidth: 0, paddingVertical: 7 },
  kakiTebal: { borderTopWidth: 1, borderTopColor: Color.TEXT_PLACEHOLDER },

  kolBulan: { width: 62, color: Color.TEXT_TITLE },
  kolBulanKepala: { width: 62, color: Color.TEXT_LABEL },
  kolAngka: { flex: 1, textAlign: 'right' },
  kolAngkaKepala: { flex: 1, textAlign: 'right', color: Color.TEXT_LABEL },
  minus: { color: Color.DANGER },
  plus: { color: Color.SUCCESS },
  kosong: { color: Color.TEXT_PLACEHOLDER },

  judulTahun: { color: Color.TEXT_TITLE, marginTop: 18, marginBottom: 8 },
  tahunRow: {
    ...PANEL,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  tahunAktif: { borderColor: Color.MAIN, borderWidth: 1.5 },
  tahunRowLabel: { width: 62, color: Color.TEXT_TITLE },
  tahunRowAngka: { flex: 1, textAlign: 'right' },
});
