import AsyncStorage from '@react-native-async-storage/async-storage';
import { Schema } from 'firebase/ai';

import { guardedAiCall } from './aiGuard';
import type { BudgetDoc } from './budgets';
import type { FocusProgress } from './financeFocus';
import {
  monthShortName,
  type CategoryHealth,
  type HistoryStats,
  type SafeToSpend,
  type WeekCompare,
} from './financeInsight';
import {
  AiAnswerError,
  geminiErrorMessage,
  geminiModel,
  parseJsonAnswer,
  stripEmDash,
  TANDA_PISAH,
  withModelFallback,
} from './gemini';
import { MONTH_NAMES } from './format';

// 🤖 Vix Financial Coach (22 Sep 2026): Gemini lewat Firebase AI Logic (kuota
// gratis paket Spark; model, pagar biaya & pemetaan galat di lib/gemini.ts &
// lib/aiGuard.ts). Coach BUKAN penasihat keuangan profesional dan tidak
// memberi rekomendasi investasi; fokusnya kesadaran: budget, kebiasaan,
// arus kas, disiplin.
//
// Least privilege: yang dikirim ke model HANYA angka agregat yang disusun
// `buildCoachFacts` (budget/terpakai per kategori, total bulan, ringkasan
// riwayat). Tidak pernah transaksi mentah, catatan, nama orang, nama bank.
// Sebelum dikirim, `assertFactsSafe` menjaga tidak ada field di luar daftar.
//
// Hemat kuota: dipanggil HANYA saat kamu click; jawaban disimpan per hari &
// per pertanyaan di AsyncStorage (bersama sidik angkanya), jadi pertanyaan
// yang sama dengan angka yang sama tidak memanggil AI lagi. Batas
// COACH_DAILY_CAP panggilan Coach per hari, di bawah pagar umum aiGuard (30).

export const COACH_DAILY_CAP = 6;

export type CoachQuestionKey =
  | 'kondisi'
  | 'on-track'
  | 'terbesar'
  | 'pola'
  | 'overspending'
  | 'safe'
  | 'waspada'
  | 'weekly'
  | 'monthly';

export const COACH_QUESTIONS: { key: CoachQuestionKey; label: string }[] = [
  { key: 'kondisi', label: 'Bagaimana kondisi keuangan saya sekarang?' },
  { key: 'on-track', label: 'Apakah saya masih on track?' },
  { key: 'terbesar', label: 'Kategori apa yang paling banyak menghabiskan uang?' },
  { key: 'pola', label: 'Apakah saya mulai keluar dari pola normal saya?' },
  { key: 'overspending', label: 'Apakah saya berpotensi overspending?' },
  { key: 'safe', label: 'Berapa safe-to-spend saya?' },
  { key: 'waspada', label: 'Pengeluaran apa yang perlu saya waspadai?' },
];

const PROMPT_OF: Record<CoachQuestionKey, string> = {
  kondisi: 'Bagaimana kondisi keuangan saya sekarang?',
  'on-track': 'Apakah saya masih on track dengan budget bulan ini?',
  terbesar: 'Kategori apa yang paling banyak menghabiskan uang saya, bulan ini dan dalam riwayat?',
  pola: 'Apakah saya mulai keluar dari pola pengeluaran normal saya?',
  overspending: 'Apakah saya berpotensi overspending sebelum bulan berakhir?',
  safe: 'Berapa safe-to-spend saya hari ini, minggu ini, dan bulan ini, dan bagaimana membacanya?',
  waspada: 'Pengeluaran apa yang perlu saya waspadai beberapa hari ke depan?',
  weekly: 'Buat Weekly Money Review singkat untuk minggu ini: bagaimana minggu saya, apa yang perlu diperhatikan, dan fokus minggu depan.',
  monthly: 'Buat Monthly Financial Summary singkat untuk bulan ini: tiga hal yang terlihat dan fokus bulan depan.',
};

// ---------- Fakta agregat ----------

export type CoachFacts = {
  bulan: string;
  hari_ke: number;
  jumlah_hari: number;
  hari_tersisa: number;
  budget_terkunci: boolean;
  pernah_unlock: number;
  safe_to_spend: {
    ada_budget: boolean;
    aman_hari_ini: number;
    sisa_minggu_ini: number;
    sisa_bulan_ini: number;
    rata_rata_per_hari: number;
    status: string;
  };
  kategori: {
    nama: string;
    irama: 'harian' | 'tetap';
    budget: number;
    terpakai: number;
    sisa: number;
    persen: number;
    status: string;
    tujuh_hari_terakhir: number | null;
    rata_rata_mingguan_riwayat: number | null;
    tren_riwayat: string;
    per_bulan: { bulan: string; jumlah: number }[];
  }[];
  riwayat: {
    bulan_tersedia: number;
    cukup: boolean;
    per_bulan: { bulan: string; income: number; expense: number; saving: number; investment: number; budget_expense: number }[];
  };
  fokus_mingguan: {
    nama: string;
    batas_rp: number;
    terpakai_rp: number;
    batas_kali: number;
    terpakai_kali: number;
  }[];
};

const FACT_KEYS: (keyof CoachFacts)[] = [
  'bulan',
  'hari_ke',
  'jumlah_hari',
  'hari_tersisa',
  'budget_terkunci',
  'pernah_unlock',
  'safe_to_spend',
  'kategori',
  'riwayat',
  'fokus_mingguan',
];

const bulat = (n: number) => Math.round(n);

/** Susun fakta agregat dari hasil lib/financeInsight. Tidak ada transaksi mentah. */
export function buildCoachFacts(input: {
  safe: SafeToSpend;
  health: CategoryHealth[];
  history: HistoryStats;
  weekCompare: WeekCompare[];
  budgetDoc: BudgetDoc;
  focus: FocusProgress[];
  year: number;
  month: number;
  ref: Date;
}): CoachFacts {
  const { safe, health, history, weekCompare, budgetDoc, focus, year, month, ref } = input;
  const cmp = new Map(weekCompare.map((w) => [w.key, w]));
  const trend = new Map(history.byCategory.map((c) => [c.key, c]));
  const kategori = health
    .filter((h) => h.budget > 0 || h.spent > 0)
    .slice(0, 10)
    .map((h) => {
      const w = cmp.get(h.key);
      const t = trend.get(h.key);
      return {
        nama: h.category.label,
        irama: h.daily ? ('harian' as const) : ('tetap' as const),
        budget: bulat(h.budget),
        terpakai: bulat(h.spent),
        sisa: bulat(h.remaining),
        persen: bulat(h.pct),
        status: h.status,
        tujuh_hari_terakhir: w ? bulat(w.last7) : null,
        rata_rata_mingguan_riwayat: w && w.avgWeek > 0 ? bulat(w.avgWeek) : null,
        tren_riwayat: t?.trend ?? 'insufficient',
        per_bulan: (t?.months ?? []).map((m) => ({ bulan: monthShortName(m.monthId), jumlah: bulat(m.spent) })),
      };
    });
  return {
    bulan: `${MONTH_NAMES[month]} ${year}`,
    hari_ke: ref.getDate(),
    jumlah_hari: new Date(year, month + 1, 0).getDate(),
    hari_tersisa: safe.daysLeft,
    budget_terkunci: budgetDoc.locked,
    pernah_unlock: budgetDoc.unlocks.length,
    safe_to_spend: {
      ada_budget: safe.hasBudget,
      aman_hari_ini: bulat(safe.today),
      sisa_minggu_ini: bulat(safe.week),
      sisa_bulan_ini: bulat(safe.month),
      rata_rata_per_hari: bulat(safe.avgPerDay),
      status: safe.status,
    },
    kategori,
    riwayat: {
      bulan_tersedia: history.monthsAvailable,
      cukup: history.enough,
      per_bulan: history.totalsByMonth.map((m) => ({
        bulan: monthShortName(m.monthId),
        income: bulat(m.income),
        expense: bulat(m.expense),
        saving: bulat(m.saving),
        investment: bulat(m.investment),
        budget_expense: bulat(m.budget),
      })),
    },
    fokus_mingguan: focus.map((f) => ({
      nama: f.subLabel ? `${f.category.label} › ${f.subLabel}` : f.category.label,
      batas_rp: f.item.limitAmount,
      terpakai_rp: bulat(f.spent),
      batas_kali: f.item.limitCount,
      terpakai_kali: f.count,
    })),
  };
}

/**
 * Pagar terakhir sebelum kirim: hanya field yang terdaftar, dan tidak ada
 * string panjang (catatan transaksi tak mungkin lolos, karena memang tak
 * pernah dimasukkan; ini penjaga kalau suatu hari ada yang menambahkannya).
 */
export function assertFactsSafe(facts: CoachFacts): void {
  for (const k of Object.keys(facts)) {
    if (!FACT_KEYS.includes(k as keyof CoachFacts)) {
      throw new AiAnswerError('Data yang dikirim ke Coach di luar daftar yang diizinkan.');
    }
  }
  const teks = JSON.stringify(facts);
  const panjang = teks.match(/"[^"]{60,}"/);
  if (panjang) throw new AiAnswerError('Ada teks panjang yang tidak boleh dikirim ke Coach.');
}

/** Sidik angka: pertanyaan sama + angka sama = jawaban yang sama (tanpa AI). */
export function factsHash(facts: CoachFacts): string {
  const s = JSON.stringify(facts);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ---------- Model ----------

const SYSTEM = `Kamu adalah Vix Financial Coach: teman yang mengenal pola keuangan pemilik aplikasi (satu orang, di Indonesia, mata uang Rupiah) dan membantunya tetap sadar sebelum mengambil keputusan pengeluaran. Kamu BUKAN penasihat keuangan profesional.

Kamu hanya menerima RINGKASAN ANGKA (JSON): budget dan realisasi per kategori bulan ini, safe-to-spend, riwayat beberapa bulan, dan fokus mingguan. Tidak ada transaksi satuan. Jawab HANYA dari angka itu.

Aturan isi:
1. Bedakan tiga hal dan jangan mencampurnya: DATA (angka yang ada), INTERPRETASI (apa artinya, selalu tentatif: "tampaknya", "kemungkinan"), SARAN (apa yang bisa diperhatikan, tetap pilihan pemiliknya).
2. Kalau riwayat.cukup = false, katakan dengan jelas bahwa pola beberapa bulan belum bisa disimpulkan; jangan menebak pola dari satu bulan.
3. Jangan menyimpulkan PENYEBAB yang tidak ada di data (misalnya "karena kamu sering nongkrong"). Boleh mengajak memeriksa: "coba perhatikan apakah ada perubahan rutinitas".
4. Jangan memberi rekomendasi investasi, produk, atau instrumen apa pun.
5. Uang ditulis "Rp1.250.000" (titik ribuan, tanpa spasi, tanpa desimal). Persen ditulis "18%".

Aturan nada, sangat penting:
- Tenang, suportif, objektif, personal, ringkas. Sapa dengan "kamu".
- DILARANG memakai kata "boros", "gagal", "buruk", "impulsif", "jangan beli", label kepribadian, atau diagnosis psikologis. Sebut "pola pengeluaran", "perilaku pengeluaran akhir-akhir ini".
- Gunakan kalimat seperti: "Kamu mulai mendekati batas budget", "Pengeluaran makanan minggu ini lebih tinggi dari pola biasanya", "Kalau pola ini berlanjut, budget kemungkinan akan habis lebih cepat", "Kamu masih punya ruang RpX", "Sebelum membeli, cek dulu apakah pengeluaran ini masih sesuai rencana bulan ini".
- Keputusan tetap milik pemiliknya; kamu meningkatkan kesadaran, bukan mengontrol.

Bentuk jawaban (JSON):
- headline: satu kalimat inti (maksimal 25 kata).
- data: 1 sampai 3 poin angka apa adanya.
- interpretasi: 1 sampai 2 poin tentatif.
- saran: 1 sampai 2 poin yang bisa dilakukan; untuk pertanyaan mingguan/bulanan, poin terakhir diawali "Fokus: ".
Total di bawah 120 kata. Bahasa Indonesia. Tanpa markdown, tanpa emoji, tanpa tanda pisah panjang "${TANDA_PISAH}".`;

const SKEMA = Schema.object({
  properties: {
    headline: Schema.string(),
    data: Schema.array({ items: Schema.string() }),
    interpretasi: Schema.array({ items: Schema.string() }),
    saran: Schema.array({ items: Schema.string() }),
  },
});

function model(nama: string) {
  return geminiModel(nama, {
    systemInstruction: SYSTEM,
    generationConfig: {
      // Membaca angka dengan setia, sedikit ruang untuk kalimat yang hangat.
      temperature: 0.4,
      // Jawabannya < 120 kata; sisanya ruang "berpikir" model (ikut dihitung).
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: SKEMA,
    },
  });
}

export type CoachAnswer = {
  headline: string;
  data: string[];
  interpretasi: string[];
  saran: string[];
};

const KATA_TERLARANG = /\b(boros|gagal|impulsif|buruk)\b/i;

/** Pagar atas jawaban model: bentuk lengkap, tanda pisah dibuang, kata terlarang diganti. */
export function finalizeCoachAnswer(jawaban: unknown): CoachAnswer {
  const j = jawaban as Partial<Record<keyof CoachAnswer, unknown>> | null;
  const headline = typeof j?.headline === 'string' ? stripEmDash(j.headline) : '';
  const daftar = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map(stripEmDash).slice(0, max)
      : [];
  if (!headline) throw new AiAnswerError('Jawaban Coach tidak terbaca. Coba lagi.');
  const halus = (s: string) =>
    s
      .replace(/\bboros\b/gi, 'lebih tinggi dari rencana')
      .replace(/\bgagal\b/gi, 'belum tercapai')
      .replace(/\bimpulsif\b/gi, 'tidak direncanakan')
      .replace(/\bburuk\b/gi, 'perlu diperhatikan');
  const rapikan = (s: string) => (KATA_TERLARANG.test(s) ? halus(s) : s);
  return {
    headline: rapikan(headline),
    data: daftar(j?.data, 3).map(rapikan),
    interpretasi: daftar(j?.interpretasi, 2).map(rapikan),
    saran: daftar(j?.saran, 2).map(rapikan),
  };
}

// ---------- Cache per hari (AsyncStorage) ----------

export type CoachDay = {
  calls: number;
  answers: Partial<Record<CoachQuestionKey, { hash: string; answer: CoachAnswer }>>;
};

export const EMPTY_COACH_DAY: CoachDay = { calls: 0, answers: {} };
const PREFIX = 'ai:coach:';

export async function loadCoachDay(dayId: string): Promise<CoachDay> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + dayId);
    if (!raw) return EMPTY_COACH_DAY;
    const v = JSON.parse(raw) as Partial<CoachDay>;
    return {
      calls: typeof v.calls === 'number' ? v.calls : 0,
      answers: v.answers && typeof v.answers === 'object' ? v.answers : {},
    };
  } catch {
    return EMPTY_COACH_DAY;
  }
}

export async function saveCoachDay(dayId: string, day: CoachDay): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + dayId, JSON.stringify(day));
  } catch {
    // Tidak tersimpan = paling buruk boleh dipanggil lagi hari ini; pagar
    // umum lib/aiGuard.ts masih berdiri.
  }
}

export function coachCallsLeft(day: CoachDay): number {
  return Math.max(0, COACH_DAILY_CAP - day.calls);
}

/**
 * Tanya Coach. Jawaban yang sudah ada untuk pertanyaan + angka yang sama
 * dikembalikan tanpa memanggil AI dan tanpa mengurangi jatah. Mengembalikan
 * keadaan hari yang sudah diperbarui (pemanggil menyimpannya).
 */
export async function askCoach(
  question: CoachQuestionKey,
  facts: CoachFacts,
  dayId: string,
  day: CoachDay,
): Promise<{ answer: CoachAnswer; day: CoachDay; fromCache: boolean }> {
  assertFactsSafe(facts);
  const hash = factsHash(facts);
  const cached = day.answers[question];
  if (cached && cached.hash === hash) return { answer: cached.answer, day, fromCache: true };
  if (coachCallsLeft(day) === 0) {
    throw new AiAnswerError(`Jatah Coach hari ini (${COACH_DAILY_CAP}×) sudah terpakai. Insight lokal tetap tersedia; lanjut besok.`);
  }
  const answer = await guardedAiCall(`coach|${dayId}|${question}|${hash}`, () =>
    withModelFallback(async (nama) => {
      const hasil = await model(nama).generateContent(
        `${PROMPT_OF[question]}\n\nRingkasan angka (JSON):\n${JSON.stringify(facts)}`,
      );
      return finalizeCoachAnswer(parseJsonAnswer(hasil));
    }),
  );
  const next: CoachDay = {
    calls: day.calls + 1,
    answers: { ...day.answers, [question]: { hash, answer } },
  };
  return { answer, day: next, fromCache: false };
}

export function coachErrorMessage(e: unknown): string {
  return geminiErrorMessage(e, 'Coach belum bisa menjawab sekarang. Insight lokal di atas tetap berlaku.');
}
