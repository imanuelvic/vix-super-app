import AsyncStorage from '@react-native-async-storage/async-storage';
import { Schema } from 'firebase/ai';

import { guardedAiCall } from './aiGuard';
import { aturanEmoji, GAYA_BAHASA, rapikanEmoji } from './aiStyle';
import {
  AiAnswerError,
  geminiErrorMessage,
  geminiModel,
  parseJsonAnswer,
  stripEmDash,
  withModelFallback,
} from './gemini';
import { habitNoteDone } from './habits';

// ✨ AI Reflection untuk 📓 Daily Reflection Journal (Habits).
//
// Tulisan refleksi hari itu dikirim ke Gemini (Firebase AI Logic, kuota
// gratis; lihat lib/gemini.ts), pulang sebagai SATU teks PENDEK dengan bentuk
// yang tetap: satu kalimat inti, baris kosong, lalu dua sampai tiga baris
// pendek. Bentuknya sengaja seperti catatan yang siap dibagikan, bukan
// paragraf panjang. Gaya bahasa & emojinya dari lib/aiStyle.ts.
//
// AI-nya asisten untuk melihat, bukan pengkhotbah: tidak boleh menambah
// kejadian/perasaan, tidak boleh mengubah makna, dan tidak boleh memutuskan
// "Tuhan pasti berkata X".
//
// Jatah: SEKALI sehari untuk tombol utamanya, plus "Try Again" sampai total
// REFLECTION_DAILY_CAP kali. Hasil & hitungannya disimpan per hari di
// AsyncStorage, jadi membuka sheet lagi tidak memanggil AI lagi. Di bawahnya
// masih ada pagar umum lib/aiGuard.ts (cooldown, kunci 429, batas harian).

/** Tulisan minimal supaya tombolnya hidup: aturan yang sama dengan centangnya. */
export const reflectionReady = habitNoteDone;

/** Refleksi harian tak pernah sepanjang ini; pagar kuota, bukan batas nyata. */
export const REFLECTION_MAX_CHARS = 2000;

/** Total panggilan per hari (1 generate + sisanya "Try Again"). */
export const REFLECTION_DAILY_CAP = 3;

/** Panjang jawaban yang diminta; bentuknya catatan pendek, bukan paragraf. */
export const REFLECTION_MAX_WORDS = 45;

/** Jatah emoji untuk seluruh jawaban (dipaksa di finalizeReflection). */
export const REFLECTION_EMOJI_MAX = 3;

const SYSTEM = `Kamu membantu seorang penulis jurnal refleksi harian (Kristen, Indonesia) merapikan tulisannya sendiri menjadi refleksi PENDEK yang enak dibaca ulang dan enak dibagikan.

Tulisan itu miliknya. Makna, kejadian, perasaan, nama, dan fakta TIDAK boleh berubah, ditambah, atau dibuang. Kamu asisten yang membantunya melihat, bukan pengkhotbah yang memutuskan.

Bentuk jawaban, wajib persis begini:
1. Baris pertama: inti tulisannya dalam SATU kalimat pendek, maksimal 8 kata. Boleh kalimat ajakan atau pertanyaan.
2. Satu baris kosong.
3. Dua sampai tiga baris pendek, satu kalimat per baris, masing-masing maksimal 15 kata, memakai sudut pandang dan suara penulisnya.
4. TOTAL maksimal ${REFLECTION_MAX_WORDS} kata. Lebih pendek lebih baik.

Isi:
- Pakai kata-katanya sendiri; yang kamu rapikan ejaan dan singkatannya ("yg" menjadi "yang", "hati2" menjadi "hati-hati") lalu alur kalimatnya.
- Baris terakhir BOLEH satu kalimat renungan yang lahir dari tulisan itu sendiri, dan harus tentatif: "Mungkin ini mengingatkan kita bahwa...", "Hal yang bisa direnungkan...", "Salah satu hal yang bisa kamu bawa dalam doa...". Kalau tidak ada yang jelas, jangan dipaksa.
- JANGAN memakai klaim pasti seperti "Tuhan pasti...", "Tuhan berkata...", "ini tandanya Tuhan...".
- Jangan mengutip ayat kecuali penulisnya sendiri menyebutnya.

${GAYA_BAHASA}

${aturanEmoji(REFLECTION_EMOJI_MAX)}

Contoh 1.
Tulisan: "Jangan menyerah dengan keadaan dan kondisi kita, tetap fokus pada rencanaNya, tanganNya tak pernah terlambat menolongku, melepaskan kebiasaan buruk dari generasi sebelumnya"
Jawaban:
Jangan menyerah pada keadaan. 🙏✨

Tetap fokus pada rencana-Nya.
Tangan-Nya tak pernah terlambat menolong.
Bersama-Nya aku bisa memutus kebiasaan buruk dari generasi sebelumnya. 🔥

Contoh 2.
Tulisan: "aku sadar sering nyari Tuhan cuma pas lagi butuh aja, pas lagi tenang malah lupa"
Jawaban:
Apakah aku mencari Tuhan hanya saat membutuhkan? 🙏

Saat tertekan, aku cepat berdoa.
Saat tenang, aku lupa mencari wajah-Nya. ✨

Kembalikan JSON dengan satu kunci: reflection.`;

const SKEMA = Schema.object({ properties: { reflection: Schema.string() } });

function model(nama: string) {
  return geminiModel(nama, {
    systemInstruction: SYSTEM,
    generationConfig: {
      // Sedikit ruang untuk kata yang hangat, tapi tetap setia pada tulisannya.
      temperature: 0.5,
      // Jawabannya ≤ 90 kata; sisanya ruang "berpikir" model (ikut dihitung).
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: SKEMA,
    },
  });
}

/**
 * Buang pembungkus yang dilarang prompt tapi kadang tetap lolos, lalu paksa
 * bentuk emojinya (ujung baris, maksimal REFLECTION_EMOJI_MAX).
 */
export function finalizeReflection(jawaban: unknown): string {
  const v = (jawaban as { reflection?: unknown } | null)?.reflection;
  if (typeof v !== 'string' || !v.trim()) {
    throw new AiAnswerError('Jawaban AI tidak terbaca. Coba lagi.');
  }
  const bersih = stripEmDash(v)
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return rapikanEmoji(bersih, REFLECTION_EMOJI_MAX);
}

/**
 * Minta AI Reflection untuk `text`. `attempt` (1, 2, 3, ...) ikut jadi kunci
 * pagar supaya "Try Again" memang menghasilkan jawaban baru, bukan jawaban
 * yang diingat; `dayId` supaya tulisan yang sama di hari lain juga baru.
 */
export async function generateReflection(
  text: string,
  dayId: string,
  attempt: number,
): Promise<string> {
  const bersih = text.trim();
  if (!reflectionReady(bersih)) {
    throw new AiAnswerError('Tulis refleksinya dulu, baru minta AI merenungkannya.');
  }
  if (bersih.length > REFLECTION_MAX_CHARS) {
    throw new AiAnswerError(`Refleksinya terlalu panjang untuk AI (maks ${REFLECTION_MAX_CHARS} huruf).`);
  }
  return guardedAiCall(`reflection|${dayId}|${attempt}|${bersih}`, () =>
    withModelFallback(async (nama) => {
      const hasil = await model(nama).generateContent(
        'Rapikan dan renungkan refleksi harian berikut.\n\n' + bersih,
      );
      return finalizeReflection(parseJsonAnswer(hasil));
    }),
  );
}

export function reflectionAiErrorMessage(e: unknown): string {
  return geminiErrorMessage(e, 'AI belum bisa merenungkan tulisanmu. Jurnalnya tetap bisa disimpan seperti biasa.');
}

// ---------- Jatah & hasil per hari (AsyncStorage) ----------

export type ReflectionAiDay = {
  /** Berapa kali AI berhasil dipanggil hari itu (generate + try again). */
  attempts: number;
  /** Hasil terakhir, supaya membuka sheet lagi tidak memanggil AI lagi. */
  result: string | null;
};

export const EMPTY_REFLECTION_AI_DAY: ReflectionAiDay = { attempts: 0, result: null };

const PREFIX = 'ai:reflection:';

export async function loadReflectionAiDay(dayId: string): Promise<ReflectionAiDay> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + dayId);
    if (!raw) return EMPTY_REFLECTION_AI_DAY;
    const v = JSON.parse(raw) as Partial<ReflectionAiDay>;
    return {
      attempts: typeof v.attempts === 'number' ? v.attempts : 0,
      result: typeof v.result === 'string' ? v.result : null,
    };
  } catch {
    return EMPTY_REFLECTION_AI_DAY;
  }
}

export async function saveReflectionAiDay(dayId: string, day: ReflectionAiDay): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + dayId, JSON.stringify(day));
  } catch {
    // Tidak tersimpan = paling buruk boleh dipanggil lagi hari ini; pagar
    // umum lib/aiGuard.ts masih berdiri.
  }
}

/** Masih boleh minta lagi hari ini? */
export function reflectionAttemptsLeft(day: ReflectionAiDay): number {
  return Math.max(0, REFLECTION_DAILY_CAP - day.attempts);
}
