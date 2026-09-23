import { Schema } from 'firebase/ai';

import { guardedAiCall } from './aiGuard';
import { GAYA_SETIA, tanpaEmoji, TANPA_EMOJI } from './aiStyle';
import {
  AiAnswerError,
  geminiErrorMessage,
  geminiModel,
  parseJsonAnswer,
  stripEmDash,
  withModelFallback,
} from './gemini';
import { WHEEL_AREAS, type WheelAreaKey } from './wheel';

// ✨ Rapihkan jawaban Wheel of Life dengan AI: catatan tiap area yang diketik
// cepat saat visitasi ("puasa ig tapi terbantu karna hectic kerjaan jadi
// ngalihinya nonton youtube.. tapi bulan lalu liburan ...") → poin-poin
// pendek, satu per baris, diawali "- ". Isinya TIDAK diubah: bahasanya tetap
// bahasa si CL, cuma dipecah jadi poin supaya enak dibaca lagi di PDF-nya.
// Gemini lewat Firebase AI Logic (kuota gratis paket Spark); model, pagar
// biaya, dan pemetaan galatnya di lib/gemini.ts & lib/aiGuard.ts.

export type WheelNotes = Partial<Record<WheelAreaKey, string>>;

// Batas panjang tiap catatan; satu jawaban visitasi tak pernah sepanjang ini.
export const MAX_CHARS_PER_NOTE = 2000;

const SYSTEM = `Kamu merapikan catatan penilaian Wheel of Life: alasan seseorang memberi nilai 1-10 untuk delapan area hidupnya, ditulis cepat dan santai saat ngobrol.

Tugasmu: pecah tiap catatan menjadi poin-poin pendek, satu poin per baris, tiap baris diawali "- " (tanda minus lalu spasi).

Aturan:
1. JANGAN mengubah isi, nada, atau bahasanya. Tetap bahasa Indonesia santai seperti aslinya (boleh "aku", "nggak", "karna"); jangan dibuat formal, jangan ditambah nasihat, jangan disimpulkan.
2. JANGAN menambah fakta, nama, angka, atau perasaan yang tidak ada di tulisan aslinya. JANGAN membuang yang ada. Kalau ragu, pertahankan kalimatnya apa adanya sebagai satu poin.
3. Satu poin = satu hal. Kalimat panjang yang memuat dua hal boleh dipecah jadi dua poin.
4. Singkatan yang sulit dibaca boleh dilengkapi ("yg" menjadi "yang", "dgn" menjadi "dengan"); singkatan gaul yang jelas dibiarkan.
5. Catatan yang kosong tetap kosong (kembalikan string kosong).
6. Jangan memakai markdown selain "- " di awal baris, dan jangan menulis judul; nama areanya sudah ditulis oleh aplikasi.

${GAYA_SETIA}

${TANPA_EMOJI}`;

// Jawaban dipaksa JSON dengan kunci = kedelapan area (structured output).
const SKEMA = Schema.object({
  properties: Object.fromEntries(WHEEL_AREAS.map((a) => [a.key, Schema.string()])),
});

function model(nama: string) {
  return geminiModel(nama, {
    systemInstruction: SYSTEM,
    generationConfig: {
      // Memecah tulisan orang jadi poin itu tugas setia, bukan kreatif.
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: SKEMA,
    },
  });
}

/**
 * Rapikan masukan: hanya kunci area yang dikenal, di-trim, dibatasi
 * panjangnya. Melempar AiAnswerError kalau kosong semua atau ada yang
 * kepanjangan.
 */
export function normalizeWheelNotes(notes: WheelNotes): Record<WheelAreaKey, string> {
  const bersih = Object.fromEntries(WHEEL_AREAS.map((a) => [a.key, ''])) as Record<
    WheelAreaKey,
    string
  >;
  for (const a of WHEEL_AREAS) {
    const v = notes[a.key];
    if (typeof v !== 'string') continue;
    if (v.length > MAX_CHARS_PER_NOTE) {
      throw new AiAnswerError(
        `Catatan ${a.label} terlalu panjang (maks ${MAX_CHARS_PER_NOTE} huruf).`,
      );
    }
    bersih[a.key] = v.trim();
  }
  if (WHEEL_AREAS.every((a) => bersih[a.key] === '')) {
    throw new AiAnswerError('Belum ada catatan yang bisa dirapikan.');
  }
  return bersih;
}

/**
 * Pagar terakhir atas jawaban model: catatan yang aslinya kosong tetap kosong,
 * tanda pisah panjang diganti koma, tiap baris dipastikan diawali "- ".
 * Jawaban yang bukan objek string per area → AiAnswerError.
 */
export function finalizeWheelAnswer(
  asli: Record<WheelAreaKey, string>,
  jawaban: unknown,
): Record<WheelAreaKey, string> {
  if (!jawaban || typeof jawaban !== 'object') {
    throw new AiAnswerError('Jawaban AI tidak terbaca. Coba lagi.');
  }
  const hasil = { ...asli };
  for (const a of WHEEL_AREAS) {
    const v = (jawaban as Record<string, unknown>)[a.key];
    if (asli[a.key] === '') {
      hasil[a.key] = '';
      continue;
    }
    if (typeof v !== 'string') throw new AiAnswerError('Jawaban AI tidak lengkap. Coba lagi.');
    hasil[a.key] = tanpaEmoji(stripEmDash(v))
      .split('\n')
      .map((baris) => baris.trim())
      .filter(Boolean)
      .map((baris) => (baris.startsWith('- ') ? baris : `- ${baris.replace(/^[-*•]\s*/, '')}`))
      .join('\n');
  }
  return hasil;
}

export async function rapikanJawabanWheel(notes: WheelNotes): Promise<WheelNotes> {
  const bersih = normalizeWheelNotes(notes);
  return guardedAiCall(`wheel|${JSON.stringify(bersih)}`, () =>
    withModelFallback(async (nama) => {
      const hasil = await model(nama).generateContent(
        'Rapikan catatan berikut menjadi poin-poin. Kembalikan kedelapan area dengan kunci yang sama.\n\n' +
          JSON.stringify(bersih, null, 2),
      );
      return finalizeWheelAnswer(bersih, parseJsonAnswer(hasil));
    }),
  );
}

export function wheelAiErrorMessage(e: unknown): string {
  return geminiErrorMessage(e, 'Gagal merapikan jawaban. Coba lagi.');
}
