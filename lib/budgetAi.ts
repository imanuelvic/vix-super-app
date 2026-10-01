import { Schema } from 'firebase/ai';

import { aiDayStore, sisaJatah } from './aiDay';
import { guardedAiCall } from './aiGuard';
import { GAYA_BAHASA, tanpaEmoji } from './aiStyle';
import { budgetKey, totalBudgetOf, type BudgetMap } from './budgets';
import {
  categoryOf,
  FINANCE_CATEGORIES,
  FINANCE_TYPE_LABEL,
  type FinanceType,
} from './categories';
import {
  AiAnswerError,
  geminiErrorMessage,
  geminiModel,
  parseJsonAnswer,
  stripEmDash,
  withModelFallback,
} from './gemini';
import type { Transaction } from './transactions';

// 🤖 Rekomendasi Budget — penyusun rencana budget untuk sub-tab Budgeting.
//
// Yang dilakukannya: mengambil realisasi TIGA BULAN TERAKHIR yang memang sudah
// dilanggan layar Finance (nol read tambahan, lihat `history` di
// app/finance.tsx), memerasnya jadi satu baris per kategori, lalu meminta
// Gemini menyusun angka budget bulan ini beserta alasan sebarisnya. Hasilnya
// DIPERLIHATKAN dulu: baru kalau disetujui, angkanya benar-benar ditulis.
//
// ── Kenapa ia tidak langsung menulis ──────────────────────────────────────
// Budget itu komitmen, bukan saran. App ini sendiri sudah punya kunci bulanan
// yang menolak budget digeser diam-diam; AI yang bisa menimpa angkanya tanpa
// ditanya akan membatalkan seluruh gunanya kunci itu. Jadi alurnya tetap:
// lihat usulannya, baca alasannya, baru setujui. Dan kalau bulannya sedang
// terkunci, menyetujui pun harus lewat Unlock seperti perubahan lain.
//
// ── Kenapa angkanya diperas dulu ──────────────────────────────────────────
// Tiga bulan transaksi bisa ratusan baris. Dikirim apa adanya, satu permintaan
// bisa belasan ribu token, dan itu cara tercepat menghabiskan kuota gratis.
// Yang benar-benar dipakai untuk menyusun budget cuma: realisasi per kategori
// per bulan, rata-ratanya, dan budget yang terpasang sekarang. Belasan baris,
// bukan ratusan.
//
// ── Uang ──────────────────────────────────────────────────────────────────
// Sama seperti seluruh AI di app ini: Firebase AI Logic + Gemini Developer API
// di paket Spark, jadi lewat kuota = ditolak 429, BUKAN ditagih.
//
// Tiga lapis penahan pemakaian:
//   1. Usulannya DISIMPAN per hari per jenis per bulan (AsyncStorage).
//      Membuka sheet-nya lagi tidak memanggil AI lagi, seharian.
//   2. Jatah sendiri: BUDGET_AI_DAILY_CAP panggilan per hari untuk fitur ini.
//   3. Pagar umum lib/aiGuard.ts di bawahnya (dedupe, cooldown, kunci 429,
//      batas harian seluruh app).

/** Jatah panggilan AI penyusun budget per hari. */
export const BUDGET_AI_DAILY_CAP = 3;

/** Usulan untuk SATU kategori. */
export type BudgetAdvice = {
  /** Key kategori, mis. "food-drink". Dijamin ada di FINANCE_CATEGORIES. */
  key: string;
  /** Nominal budget yang diusulkan, rupiah bulat. */
  amount: number;
  /** Alasan sebaris. Boleh kosong. */
  alasan: string;
};

/** Satu rencana budget utuh untuk satu jenis. */
export type BudgetPlanAi = {
  ringkas: string;
  items: BudgetAdvice[];
  catatan: string;
};

// ===================== Peras riwayat jadi angka =====================

/**
 * Satu bulan riwayat. Sengaja hanya dua field yang dipakai, bukan `MonthSlice`
 * utuh dari lib/financeInsight.ts: bentuk ini cukup, dan dengan begitu modul
 * ini bisa dijalankan suite tanpa menyeret seluruh mesin analisis Finance.
 */
export type BudgetHistoryMonth = { monthId: string; items: Transaction[] };

/** Satu baris bahan untuk promptnya. */
export type BudgetHistoryRow = {
  key: string;
  /** Nama kategori beserta emojinya, mis. "🍛 Food Drink". */
  label: string;
  /** Realisasi tiap bulan riwayat, urut lama ke baru. */
  spent: number[];
  avg: number;
  /** Budget yang terpasang sekarang di bulan yang direncanakan. */
  current: number;
};

function totalOf(items: Transaction[], type: FinanceType): number {
  let total = 0;
  for (const t of items) if (t.type === type) total += t.amount;
  return total;
}

/**
 * Rata-rata pemasukan per bulan dari riwayat. Bulan yang kosong melompong
 * TIDAK ikut membagi: bulan tanpa satu pun transaksi hampir selalu berarti
 * app-nya memang belum dipakai waktu itu, bukan bahwa pemasukannya nol, dan
 * membaginya ke situ akan menurunkan seluruh rencana tanpa alasan.
 */
export function avgMonthlyIncome(history: BudgetHistoryMonth[]): number {
  const berisi = history.filter((h) => h.items.length > 0);
  if (berisi.length === 0) return 0;
  let total = 0;
  for (const h of berisi) total += totalOf(h.items, 'income');
  return Math.round(total / berisi.length);
}

/**
 * Satu baris per kategori: realisasi tiap bulan riwayat, rata-ratanya, dan
 * budget yang terpasang sekarang.
 *
 * Kategori yang tidak punya realisasi MAUPUN budget tidak ikut: menyuruh AI
 * menyusun angka untuk kategori yang tidak pernah terpakai cuma memanjangkan
 * permintaan, dan jawabannya pasti tebakan.
 */
export function budgetHistoryRows(
  type: FinanceType,
  history: BudgetHistoryMonth[],
  allocations: BudgetMap,
): BudgetHistoryRow[] {
  const rows: BudgetHistoryRow[] = [];
  for (const c of FINANCE_CATEGORIES[type]) {
    const spent = history.map((h) => {
      let total = 0;
      for (const t of h.items) {
        if (t.type === type && t.category === c.key) total += t.amount;
      }
      return total;
    });
    const jumlah = spent.reduce((a, b) => a + b, 0);
    const current = allocations[budgetKey(type, c.key)] ?? 0;
    if (jumlah === 0 && current === 0) continue;
    const kategori = categoryOf(type, c.key);
    rows.push({
      key: c.key,
      label: `${kategori.icon} ${kategori.label}`,
      spent,
      avg: history.length > 0 ? Math.round(jumlah / history.length) : 0,
      current,
    });
  }
  return rows;
}

/**
 * Batas total yang wajar untuk jenis ini: pemasukan rata-rata dikurangi
 * alokasi jenis lain yang SUDAH terpasang bulan ini.
 *
 * Tanpa angka ini, usulan Pengeluaran bisa saja memakai seluruh pemasukan dan
 * diam-diam menelan jatah Tabungan & Investasi yang sudah ditetapkan sendiri.
 * Jenis Income tidak punya batas semacam ini (dia justru sumbernya), jadi
 * jawabannya 0 = tidak ada batas.
 */
export function budgetCeiling(
  type: FinanceType,
  allocations: BudgetMap,
  income: number,
): number {
  if (type === 'income' || income <= 0) return 0;
  let lain = 0;
  for (const t of ['expense', 'saving', 'investment'] as FinanceType[]) {
    if (t !== type) lain += totalBudgetOf(allocations, t);
  }
  return Math.max(0, income - lain);
}

const rp = (n: number): string => Math.round(n).toLocaleString('id-ID');

/** Bahan angka untuk promptnya. MURNI, jadi suite bisa memeriksanya langsung. */
export function budgetBrief(
  type: FinanceType,
  bulan: string,
  rows: BudgetHistoryRow[],
  monthIds: string[],
  income: number,
  ceiling: number,
): string {
  const bagian: string[] = [
    `Bulan yang direncanakan: ${bulan}.`,
    `Jenis yang direncanakan: ${FINANCE_TYPE_LABEL[type]}.`,
  ];
  if (income > 0) {
    bagian.push(`Rata-rata pemasukan per bulan: Rp${rp(income)}.`);
  }
  if (ceiling > 0) {
    bagian.push(
      `Batas total untuk jenis ini: Rp${rp(ceiling)}. Jumlah seluruh angkamu tidak boleh melewati batas itu.`,
    );
  }

  const judulBulan = monthIds.length ? ` (${monthIds.join(', ')})` : '';
  bagian.push(
    `Realisasi ${monthIds.length} bulan terakhir${judulBulan}, urut lama ke baru, lalu rata-ratanya dan budget yang terpasang sekarang:`,
  );
  for (const r of rows) {
    bagian.push(
      `- ${r.label} [${r.key}]: ${r.spent.map(rp).join(' / ')} | rata-rata ${rp(r.avg)} | budget sekarang ${rp(r.current)}`,
    );
  }

  const totalAvg = rows.reduce((a, r) => a + r.avg, 0);
  const totalNow = rows.reduce((a, r) => a + r.current, 0);
  bagian.push(
    `Total rata-rata realisasi Rp${rp(totalAvg)}. Total budget yang terpasang sekarang Rp${rp(totalNow)}.`,
  );
  return bagian.join('\n');
}

// ===================== Prompt =====================

const SYSTEM = `Kamu membantu satu orang Indonesia menyusun BUDGET BULANAN pribadinya, di dalam aplikasi catatan keuangannya sendiri. Dia bukan ahli keuangan; dia sedang belajar menetapkan batas yang masuk akal lalu menaatinya sebulan penuh.

Kamu diberi realisasi beberapa bulan terakhir per kategori, budget yang terpasang sekarang, dan (kalau ada) batas total yang wajar. Tugasmu menyusun angka budget untuk bulan yang direncanakan.

Aturan yang tidak boleh dilanggar:
- Jawab HANYA dengan kategori yang ada di daftar, memakai kode di dalam kurung siku persis seperti tertulis. Jangan mengarang kategori baru.
- Sebutkan SEMUA kategori yang ada di daftar, satu per satu, walau angkanya kamu biarkan sama dengan sekarang.
- Kalau ada batas total, jumlah seluruh angkamu TIDAK BOLEH melewatinya. Kalau rata-rata realisasinya sendiri sudah melewati batas itu, potong kategori yang paling bisa ditahan, lalu katakan di ringkas bahwa totalnya memang harus dipangkas.
- Angkanya kelipatan 50.000 rupiah, bilangan bulat, tanpa titik dan tanpa koma.
- Berpijak pada realisasi, bukan angan-angan. Kategori yang tiga bulan berturut-turut melewati budgetnya jangan dipaksa turun drastis: naikkan ke angka yang jujur, lalu potong di kategori yang memang bisa ditahan.
- Kebutuhan pokok (makan, transportasi, rumah, tagihan, kesehatan) didahulukan daripada keinginan.
- JANGAN menurunkan angka sampai nol kecuali kategorinya memang tidak terpakai sama sekali sepanjang riwayat yang diberikan.

Bentuk tiap kolom. JAWAB PENDEK, ini dibaca di layar HP:
- ringkas: SATU kalimat, maksimal 18 kata, berisi inti rencananya.
- items: satu baris per kategori. key = kode di dalam kurung siku. amount = nominal rupiah bulat. alasan = maksimal 8 kata, menyebut angkanya kalau membantu.
- catatan: SATU kalimat jujur bahwa ini usulan dari data beberapa bulan saja, bukan nasihat keuangan.

${GAYA_BAHASA}

Aturan emoji: JANGAN memakai emoji sama sekali. Aplikasinya sendiri yang memasang lambang dan warnanya.

Kembalikan JSON dengan kunci: ringkas, items, catatan.`;

const SKEMA = Schema.object({
  properties: {
    ringkas: Schema.string(),
    items: Schema.array({
      items: Schema.object({
        properties: {
          key: Schema.string(),
          amount: Schema.integer(),
          alasan: Schema.string(),
        },
      }),
    }),
    catatan: Schema.string(),
  },
});

function model(nama: string) {
  return geminiModel(nama, {
    systemInstruction: SYSTEM,
    generationConfig: {
      // Rendah: ini menyusun angka, bukan menulis puisi. Jawaban yang
      // "kreatif" di sini justru berarti mengarang.
      temperature: 0.2,
      // Longgar karena jawabannya bisa belasan baris SEKALIGUS menanggung
      // token "berpikir" Gemini 3.x, yang ikut dihitung ke jatah ini. Dengan
      // jatah sempit jawabannya terpotong di tengah (finishReason MAX_TOKENS)
      // dan yang sampai ke layar cuma pesan galat.
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: SKEMA,
    },
  });
}

// ===================== Baca jawabannya =====================

/** Pembulatan nominal usulan. Budget yang bulat lebih gampang ditaati. */
const KELIPATAN = 10_000;

/** Bersihkan satu kalimat: tanpa tanda pisah panjang, tanpa emoji, tanpa kutip. */
function kalimat(v: unknown): string {
  if (typeof v !== 'string') return '';
  return tanpaEmoji(stripEmDash(v).replace(/^["“”']+|["“”']+$/g, '')).trim();
}

/**
 * Jawaban mentah Gemini → rencana yang dipakai layar.
 *
 * `rows` bukan sekadar daftar nama: ia PAGAR. Key yang tidak ada di situ
 * dibuang, bukan dibiarkan lewat. Kategori karangan yang lolos sampai ke
 * Firestore akan jadi alokasi yatim yang tidak pernah tampil di layar mana pun
 * tapi ikut tersalin tiap bulan (persis masalah yang dibereskan
 * REMOVED_BUDGET_KEYS di lib/budgets.ts).
 *
 * Nominal negatif, bukan angka, atau key yang sama dua kali juga dibuang.
 */
export function finalizeBudgetPlan(
  jawaban: unknown,
  rows: BudgetHistoryRow[],
): BudgetPlanAi {
  const o = (jawaban ?? {}) as Record<string, unknown>;
  const boleh = new Set(rows.map((r) => r.key));
  const sudah = new Set<string>();
  const items: BudgetAdvice[] = [];

  for (const baris of Array.isArray(o.items) ? o.items : []) {
    const b = (baris ?? {}) as Record<string, unknown>;
    const key = typeof b.key === 'string' ? b.key.trim() : '';
    if (!boleh.has(key) || sudah.has(key)) continue;
    const angka = typeof b.amount === 'number' ? b.amount : Number(b.amount);
    if (!Number.isFinite(angka) || angka < 0) continue;
    sudah.add(key);
    items.push({
      key,
      amount: Math.round(angka / KELIPATAN) * KELIPATAN,
      alasan: kalimat(b.alasan),
    });
  }

  const ringkas = kalimat(o.ringkas);
  if (items.length === 0 || !ringkas) {
    throw new AiAnswerError('Jawaban AI tidak terbaca. Coba lagi.');
  }
  return {
    ringkas,
    items,
    catatan:
      kalimat(o.catatan) ||
      'Ini usulan dari data beberapa bulan saja, bukan nasihat keuangan.',
  };
}

/**
 * Minta satu rencana budget. `brief` dari `budgetBrief`.
 *
 * `jenis`, `bulanId` & `attempt` ikut jadi kunci pagar, jadi permintaan yang
 * sama tidak pernah dikirim dua kali; `attempt` dinaikkan kalau memang sengaja
 * minta usulan baru.
 */
export async function generateBudgetPlan(
  type: FinanceType,
  brief: string,
  rows: BudgetHistoryRow[],
  bulanId: string,
  attempt = 1,
): Promise<BudgetPlanAi> {
  if (rows.length === 0) {
    throw new AiAnswerError(
      'Belum ada realisasi maupun budget yang bisa dibaca. Catat transaksimu dulu.',
    );
  }
  return guardedAiCall(`budget|${type}|${bulanId}|${attempt}|${brief}`, () =>
    withModelFallback(async (nama) => {
      const hasil = await model(nama).generateContent(brief);
      return finalizeBudgetPlan(parseJsonAnswer(hasil), rows);
    }),
  );
}

export function budgetAiErrorMessage(e: unknown): string {
  return geminiErrorMessage(
    e,
    'AI belum bisa menyusun budget sekarang. Budgetnya tetap bisa diatur sendiri seperti biasa.',
  );
}

// ============ Jatah & usulan per hari (AsyncStorage) ============

/** Kunci usulan tersimpan: "expense|2026-10". */
type KunciRencana = `${FinanceType}|${string}`;

export type BudgetAiDay = {
  /** Berapa kali AI dipanggil hari itu (semua jenis & bulan digabung). */
  attempts: number;
  /** Usulan terakhir per jenis+bulan, supaya membuka sheet-nya lagi gratis. */
  hasil: Partial<Record<KunciRencana, BudgetPlanAi>>;
};

export const EMPTY_BUDGET_AI_DAY: BudgetAiDay = { attempts: 0, hasil: {} };

export const kunciRencana = (
  type: FinanceType,
  bulanId: string,
): KunciRencana => `${type}|${bulanId}`;

const HARI = aiDayStore<BudgetAiDay>('budget', EMPTY_BUDGET_AI_DAY, (v) => ({
  attempts: typeof v.attempts === 'number' ? v.attempts : 0,
  hasil: v.hasil && typeof v.hasil === 'object' ? v.hasil : {},
}));

export const loadBudgetAiDay = HARI.load;
export const saveBudgetAiDay = HARI.save;

/** Masih boleh minta lagi hari ini? */
export function budgetAttemptsLeft(day: BudgetAiDay): number {
  return sisaJatah(BUDGET_AI_DAILY_CAP, day.attempts);
}
