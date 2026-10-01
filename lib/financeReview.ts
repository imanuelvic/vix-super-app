import { monthId } from './format';
import type { Transaction } from './transactions';

// 📋 Financial Review — rekap bulanan SEJAK 2015, di dalam app.
//
// Pemilik app sudah mencatat uangnya di satu spreadsheet sejak 2015: tiap
// tahun satu blok, bulan melintang ke samping, lalu AVERAGE & TOTAL di ujung
// kanan. Sebelas tahun angka itu tidak bisa dihitung ulang dari transaksi di
// app, karena app ini baru lahir 21 Juli 2026. Jadi riwayatnya DISALIN ke sini
// apa adanya, dan app mengambil alih mulai bulan yang disebut di
// REVIEW_LIVE_FROM.
//
// ── Bagaimana angka lama dipetakan ────────────────────────────────────────
// Baris di spreadsheet-nya berganti-ganti bentuk selama sebelas tahun. Di sini
// semuanya diperas jadi EMPAT baris yang sama dengan jenis transaksi app:
//
//   2015 sampai 2021  Revenue → masuk, Expense → keluar.
//   2022 dan 2023     Expense + Insurance + Sow Seeds → keluar,
//                     Saving for Future → tabungan, Investation → investasi.
//   2024              Expense + Bills → keluar; Saving & Investment digabung
//                     satu kolom di sumbernya, jadi seluruhnya masuk TABUNGAN.
//                     Angkanya benar, pecahannya memang tidak pernah dipisah.
//   2025 dan 2026     sudah persis empat baris itu.
//
// Pemetaan ini DIBUKTIKAN suite: TOTAL tiap bulan hasil hitungan di sini wajib
// sama dengan TOTAL yang tertulis di spreadsheet aslinya.
//
// ── `null` berbeda dari nol ───────────────────────────────────────────────
// `null` = bulan itu memang tidak pernah dicatat. `0` = dicatat, nilainya nol
// (mis. pemasukan 2020 yang memang kosong di masa pandemi). Bedanya penting
// karena rata-rata membagi dengan JUMLAH BULAN YANG TERISI, bukan dengan 12.

/** Dua belas angka, Januari sampai Desember. `null` = tidak ada catatan. */
export type Bulanan = (number | null)[];

/**
 * Baris yang mulai di bulan ke-`mulai` (0 = Januari) lalu berjalan berurutan;
 * sisanya kosong. Semua baris di spreadsheet aslinya memang satu runtun.
 */
function dari(mulai: number, ...nilai: number[]): Bulanan {
  const out: Bulanan = Array(12).fill(null);
  nilai.forEach((v, i) => {
    if (mulai + i < 12) out[mulai + i] = v;
  });
  return out;
}

/** Satu tahun catatan lama. */
type Sejarah = {
  year: number;
  income: Bulanan;
  expense: Bulanan;
  saving: Bulanan;
  investment: Bulanan;
};

const NOL: Bulanan = Array(12).fill(null);

// ===================== Catatan lama (2015 sampai 2026) =====================

const SEJARAH: Sejarah[] = [
  {
    year: 2015,
    income: NOL,
    expense: dari(9, 1_946_500, 2_071_500, 1_225_500),
    saving: NOL,
    investment: NOL,
  },
  {
    year: 2016,
    income: NOL,
    expense: dari(0, 2_150_000, 1_674_000, 5_045_500, 3_446_000, 3_069_000, 3_470_000, 2_026_000, 2_892_000, 3_163_000, 2_046_000, 3_237_500, 3_529_000),
    saving: NOL,
    investment: NOL,
  },
  {
    year: 2017,
    income: dari(0, 7_200_000, 3_700_000, 3_000_000, 3_200_000, 3_050_000, 3_200_000, 2_050_000, 3_500_000, 4_570_000, 3_600_000, 3_243_800, 3_050_000),
    expense: dari(0, 4_763_000, 2_658_500, 4_906_500, 3_182_000, 3_253_000, 3_818_000, 2_362_500, 4_053_500, 2_564_000, 2_522_500, 4_507_500, 3_383_000),
    saving: NOL,
    investment: NOL,
  },
  {
    year: 2018,
    income: dari(0, 3_700_000, 2_674_000, 2_795_000, 4_147_500, 3_750_000, 2_505_000, 2_000_000, 750_000, 3_400_000, 2_000_000, 2_500_000, 200_000),
    expense: dari(0, 3_149_000, 2_322_700, 3_901_300, 2_982_300, 1_830_900, 3_523_400, 3_003_500),
    saving: NOL,
    investment: NOL,
  },
  {
    year: 2019,
    income: dari(0, 1_750_000, 2_750_000, 750_000, 750_000, 300_000, 500_000, 700_000, 2_400_000, 3_400_000, 4_400_000, 3_700_000, 2_050_000),
    expense: NOL,
    saving: NOL,
    investment: NOL,
  },
  {
    year: 2020,
    income: dari(0, 3_200_000, 2_400_000, 3_900_000, 2_400_000, 10_000_000, 100_000, 0, 200_000, 600_000, 0, 0, 0),
    expense: NOL,
    saving: NOL,
    investment: NOL,
  },
  {
    year: 2021,
    income: dari(0, 1_000_000, 1_000_000, 500_000, 2_000_000, 3_000_000, 2_800_000, 2_600_000, 3_000_000, 2_000_000, 6_000_000, 6_000_000, 5_000_000),
    expense: dari(11, 6_527_000),
    saving: NOL,
    investment: NOL,
  },
  {
    year: 2022,
    income: dari(0, 5_000_000, 6_000_000, 5_000_000, 8_500_000, 8_500_000, 8_500_000, 8_500_000, 8_500_000, 8_500_000, 8_500_000, 8_500_000, 13_250_000),
    // Expense + Insurance + Sow Seeds.
    expense: dari(0, 3_695_000, 2_712_500, 3_786_500, 6_445_000, 8_637_500, 5_028_000, 6_365_500, 6_098_500, 7_461_500, 8_532_500, 7_350_500, 11_656_000),
    saving: dari(0, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000),
    investment: dari(0, 1_500_000, 1_000_000, 0, 0, 0, 1_000_000, 0, 1_000_000, 500_000, 1_000_000, 1_500_000, 1_000_000),
  },
  {
    year: 2023,
    income: dari(0, 8_500_000, 9_000_000, 9_000_000, 9_000_000, 9_000_000, 9_000_000, 9_000_000, 9_000_000, 9_000_000, 9_000_000, 9_000_000, 18_000_000),
    // Expense + Insurance + Sow Seeds.
    expense: dari(0, 7_538_000, 8_076_500, 8_240_000, 8_192_500, 9_498_000, 9_155_500, 8_938_500, 6_891_000, 8_090_500, 8_045_000, 7_747_500, 11_176_500),
    saving: dari(0, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000),
    investment: dari(0, 0, 0, 0, 1_500_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000),
  },
  {
    year: 2024,
    income: dari(0, 8_932_500, 9_632_500, 9_335_000, 9_492_500, 9_212_500, 9_528_285, 9_563_285, 9_913_286, 9_755_786, 9_615_786, 9_650_786, 18_464_991),
    // Expense + Bills.
    expense: dari(0, 8_560_000, 6_378_889, 7_884_726, 5_289_432, 7_104_345, 9_648_706, 8_186_250, 9_549_150, 9_992_800, 9_688_064, 10_882_679, 6_872_033),
    // Sumbernya menggabung Saving & Investment jadi satu kolom.
    saving: dari(0, 1_900_000, 900_000, 900_000, 700_000, 900_000, 1_700_000, 700_000, 700_000, 1_000_000, 1_000_000, 1_000_000, 2_000_000),
    investment: NOL,
  },
  {
    year: 2025,
    income: dari(0, 9_068_232, 10_315_731, 10_283_286, 10_143_286, 28_863_285, 10_659_935, 12_409_935, 15_449_935, 15_274_935, 10_239_935, 10_029_935),
    expense: dari(0, 12_821_299, 8_360_859, 7_391_946, 8_811_715, 12_353_622, 9_526_328, 10_386_814, 11_926_025, 9_092_061, 8_421_347, 10_393_364),
    saving: dari(0, 300_000, 450_000, 1_700_000, 1_100_000, 10_800_000, 3_550_000, 3_530_000, 3_550_000, 2_650_000, 3_090_995, 2_600_000),
    investment: dari(0, 500_000, 700_000, 1_050_000, 1_050_000, 800_000, 1_200_000, 1_200_000, 1_300_000, 1_550_000, 1_300_000, 1_350_000),
  },
  {
    year: 2026,
    income: dari(0, 9_565_000, 10_780_000, 10_902_500, 10_710_000, 11_270_000, 10_815_000, 10_990_000),
    expense: dari(0, 11_198_436, 7_233_600, 10_387_900, 9_928_284, 10_529_408, 8_134_144),
    saving: dari(0, 3_200_000, 3_250_000, 3_400_000, 3_450_000, 3_450_000, 3_320_000),
    investment: dari(0, 1_775_000, 1_800_000, 1_800_000, 1_250_000, 1_250_000, 1_050_000),
  },
];

/**
 * Bulan pertama yang angkanya diambil dari TRANSAKSI APP, bukan catatan lama.
 *
 * Sebelum bulan ini, yang dipakai salinan spreadsheet di atas; mulai bulan ini
 * dan seterusnya, app menghitung sendiri dari transaksinya. Satu baris ini
 * satu-satunya tempat garis batas itu ditulis, jadi memindahkannya cukup di
 * sini (mis. kalau Juli & Agustus 2026 mau ikut dihitung app juga).
 */
export const REVIEW_LIVE_FROM = '2026-09';

/** Tanggal pertama yang transaksinya perlu ditarik dari Firestore. */
export function reviewLiveStart(): Date {
  const [tahun, bulan] = REVIEW_LIVE_FROM.split('-').map(Number);
  return new Date(tahun, bulan - 1, 1);
}

// ===================== Hitungannya =====================

/** Empat angka satu bulan. */
export type ReviewAmounts = {
  income: number;
  expense: number;
  saving: number;
  investment: number;
};

export type ReviewSource = 'catatan' | 'app';

export type ReviewMonth = {
  /** 0 = Januari. */
  month: number;
  income: number | null;
  expense: number | null;
  saving: number | null;
  investment: number | null;
  /** Keluar seluruhnya: pengeluaran + tabungan + investasi. */
  outflow: number | null;
  /** Masuk dikurangi keluar. `null` kalau pemasukannya memang tak pernah dicatat. */
  balance: number | null;
  /** Dari mana angkanya; `null` = bulan itu kosong. */
  source: ReviewSource | null;
};

/** Satu baris ringkasan: totalnya, berapa bulan terisi, dan rata-ratanya. */
export type ReviewLine = { total: number; months: number; average: number };

export type ReviewYear = {
  year: number;
  months: ReviewMonth[];
  income: ReviewLine;
  expense: ReviewLine;
  saving: ReviewLine;
  investment: ReviewLine;
  outflow: ReviewLine;
  balance: ReviewLine;
  /** Ada satu pun bulan yang angkanya dari transaksi app? */
  live: boolean;
};

function garis(nilai: (number | null)[]): ReviewLine {
  const ada = nilai.filter((v): v is number => v !== null);
  const total = ada.reduce((a, b) => a + b, 0);
  return {
    total,
    months: ada.length,
    average: ada.length > 0 ? Math.round(total / ada.length) : 0,
  };
}

/** Rata-rata satu baris TANPA dibulatkan, untuk hitungan lanjutan. */
function rata(l: ReviewLine): number {
  return l.months > 0 ? l.total / l.months : 0;
}

/**
 * Jumlah keluar satu bulan. `null` kalau ketiganya memang tak pernah dicatat,
 * supaya bulan kosong tidak terbaca sebagai "keluar Rp0".
 */
function keluar(
  expense: number | null,
  saving: number | null,
  investment: number | null,
): number | null {
  if (expense === null && saving === null && investment === null) return null;
  return (expense ?? 0) + (saving ?? 0) + (investment ?? 0);
}

/**
 * Transaksi app → empat angka per bulan ("YYYY-MM" → jumlah).
 *
 * MURNI: tidak menyentuh Firestore maupun jam sistem, jadi suite bisa
 * menjalankannya apa adanya.
 */
export function liveMonths(items: Transaction[]): Record<string, ReviewAmounts> {
  const out: Record<string, ReviewAmounts> = {};
  for (const t of items) {
    const d = t.date.toDate();
    const id = monthId(d.getFullYear(), d.getMonth());
    out[id] ??= { income: 0, expense: 0, saving: 0, investment: 0 };
    out[id][t.type] += t.amount;
  }
  return out;
}

/**
 * Susun seluruh tahun, terbaru di DEPAN. `live` dari `liveMonths`.
 *
 * Tahun yang belum ada di catatan lama tapi sudah ada transaksinya di app
 * ikut dibuatkan sendiri, jadi berkas ini tidak perlu disunting tiap ganti
 * tahun.
 */
export function reviewYears(
  live: Record<string, ReviewAmounts> = {},
): ReviewYear[] {
  const tahunLive = new Set(
    Object.keys(live)
      .filter((id) => id >= REVIEW_LIVE_FROM)
      .map((id) => Number(id.slice(0, 4))),
  );
  const semua = [...new Set([...SEJARAH.map((s) => s.year), ...tahunLive])].sort(
    (a, b) => b - a,
  );

  return semua.map((year) => {
    const lama = SEJARAH.find((s) => s.year === year);
    const months: ReviewMonth[] = [];

    for (let m = 0; m < 12; m++) {
      const id = monthId(year, m);
      const pakaiApp = id >= REVIEW_LIVE_FROM;
      const dariApp = pakaiApp ? (live[id] ?? null) : null;

      const income = dariApp ? dariApp.income : (lama?.income[m] ?? null);
      const expense = dariApp ? dariApp.expense : (lama?.expense[m] ?? null);
      const saving = dariApp ? dariApp.saving : (lama?.saving[m] ?? null);
      const investment = dariApp
        ? dariApp.investment
        : (lama?.investment[m] ?? null);

      const out = keluar(expense, saving, investment);
      months.push({
        month: m,
        income,
        expense,
        saving,
        investment,
        outflow: out,
        // Tanpa catatan pemasukan, "sisa" cuma berarti seluruh pengeluaran
        // dibalik tandanya, dan itu bukan sisa.
        balance: income === null ? null : income - (out ?? 0),
        source:
          income === null && out === null ? null : dariApp ? 'app' : 'catatan',
      });
    }

    const income = garis(months.map((x) => x.income));
    const outflow = garis(months.map((x) => x.outflow));
    return {
      year,
      months,
      income,
      expense: garis(months.map((x) => x.expense)),
      saving: garis(months.map((x) => x.saving)),
      investment: garis(months.map((x) => x.investment)),
      outflow,
      balance: {
        total: income.total - outflow.total,
        months: months.filter((x) => x.balance !== null).length,
        // Spreadsheet aslinya menghitung rata-rata sisa sebagai rata-rata
        // masuk dikurangi rata-rata keluar, BUKAN rata-rata dari sisa tiap
        // bulan. Keduanya berbeda begitu ada bulan yang pemasukannya tercatat
        // tapi pengeluarannya belum. Dibuat sama persis supaya angkanya tidak
        // berselisih dengan lembar yang sudah dibaca sebelas tahun.
        //
        // Dikurangkan SEBELUM dibulatkan, bukan sesudah: membulatkan kedua
        // rata-rata dulu bisa meleset satu rupiah dari lembar aslinya, dan
        // selisih satu rupiah di angka yang dicocokkan dengan lembar lama
        // terbaca sebagai salah hitung.
        average: Math.round(rata(income) - rata(outflow)),
      },
      live: months.some((x) => x.source === 'app'),
    };
  });
}

/** Satu baris ringkasan per tahun, untuk daftar "semua tahun". */
export type ReviewTotal = {
  year: number;
  income: number;
  outflow: number;
  balance: number;
  live: boolean;
};

export function reviewTotals(years: ReviewYear[]): ReviewTotal[] {
  return years.map((y) => ({
    year: y.year,
    income: y.income.total,
    outflow: y.outflow.total,
    balance: y.balance.total,
    live: y.live,
  }));
}
