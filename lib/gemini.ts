import {
  AIError,
  AIErrorCode,
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  type AI,
  type GenerateContentResult,
  type GenerativeModel,
  type ModelParams,
} from 'firebase/ai';

import { AiGuardError, markQuotaExhausted } from './aiGuard';
import { app } from './firebase';

// Satu pintu ke Gemini untuk seluruh app (notulen CORE, refleksi harian).
//
// Dikerjakan lewat FIREBASE AI LOGIC dengan backend Gemini Developer API,
// bukan Vertex AI dan bukan Cloud Function:
//   • Gratis: di paket Spark, Gemini Developer API hanya punya kuota gratis.
//     Lewat kuota = ditolak 429, tidak pernah ditagih (tidak ada kartu).
//     Cloud Functions / Vertex AI mewajibkan Blaze, dan begitu proyek ada di
//     Blaze SELURUH pemakaian Gemini Developer API jadi berbayar
//     (firebase.google.com/docs/ai-logic/pricing).
//   • Tanpa kunci di app: app memanggil proxy Firebase AI Logic memakai config
//     Firebase yang memang publik (EXPO_PUBLIC_*). Kunci Gemini-nya dibuat &
//     disimpan Google di dalam proyek, tidak pernah lewat repo maupun IPA.
//   • Berjalan di Expo SDK 57 karena runtime "winter" Expo memasang URL,
//     DOMException, AbortSignal.any & TextDecoder yang dibutuhkan SDK-nya.
//
// Setup sekali di console (bukan kode): Firebase › Build › AI Logic › Get
// started › Gemini Developer API. Sebelum itu, SDK menjawab `api-not-enabled`
// dan tombolnya menampilkan petunjuknya. Panduan lengkap: AI-GRATIS.md.
//
// Pemanggilnya WAJIB lewat `guardedAiCall` (lib/aiGuard.ts) supaya pagar
// pemakaiannya (memo, dedupe, cooldown, kunci 429, batas harian) berlaku.

// Model: keduanya di kuota gratis Gemini Developer API (Sep 2026,
// firebase.google.com/docs/ai-logic/models). Yang utama model stabil terbaru;
// kalau kuota per-modelnya penuh (429) atau modelnya sudah pensiun (404),
// coba yang ringan, kuotanya terpisah dan lebih longgar. Cukup ganti di sini
// kalau Google mengganti nama modelnya.
export const GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_MODEL_CADANGAN = 'gemini-3.5-flash-lite';

// Tanda pisah panjang (U+2014). Ditulis lewat kodenya karena app ini melarang
// karakter itu di string mana pun (terlalu terasa "buatan AI"); di sini ia
// cuma disebut untuk DILARANG di prompt dan DIBERSIHKAN dari jawaban.
export const TANDA_PISAH = String.fromCharCode(0x2014);

/** Ganti tanda pisah panjang jadi koma, buang spasi di ujung. */
export function stripEmDash(s: string): string {
  return s.split(TANDA_PISAH).join(',').trim();
}

/** Galat yang pesannya sudah siap tampil (masukan salah, jawaban rusak). */
export class AiAnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiAnswerError';
  }
}

let ai: AI | null = null;

/** Model Gemini dengan pengaturan pemanggilnya (system instruction, skema). */
export function geminiModel(nama: string, params: Omit<ModelParams, 'model'>): GenerativeModel {
  ai ??= getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, { model: nama, ...params });
}

function statusOf(e: unknown): number | undefined {
  return e instanceof AIError ? e.customErrorData?.status : undefined;
}

/** 429 = kuota gratis penuh (Gemini menjawab RESOURCE_EXHAUSTED). */
export function isQuotaError(e: unknown): boolean {
  return statusOf(e) === 429;
}

/**
 * Jalankan `run` dengan model utama; kuota penuh (429) atau modelnya sudah
 * tidak ada (404) → ulangi dengan model cadangan. Kalau cadangannya pun 429,
 * pagar dikunci sebentar (markQuotaExhausted) supaya app berhenti memukul
 * kuota yang sudah penuh.
 */
export async function withModelFallback<T>(run: (nama: string) => Promise<T>): Promise<T> {
  try {
    return await run(GEMINI_MODEL);
  } catch (e) {
    const s = statusOf(e);
    if (s !== 429 && s !== 404) throw e;
    try {
      return await run(GEMINI_MODEL_CADANGAN);
    } catch (e2) {
      if (isQuotaError(e2)) markQuotaExhausted();
      throw e2;
    }
  }
}

/**
 * Baca jawaban JSON (responseMimeType application/json). Jawaban yang
 * terpotong (MAX_TOKENS) atau bukan JSON → AiAnswerError yang siap tampil.
 */
export function parseJsonAnswer(hasil: GenerateContentResult): unknown {
  if (hasil.response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw new AiAnswerError('Jawaban AI terpotong karena terlalu panjang. Persingkat tulisannya.');
  }
  try {
    return JSON.parse(hasil.response.text());
  } catch {
    throw new AiAnswerError('Jawaban AI tidak terbaca. Coba lagi.');
  }
}

/**
 * Pesan galat yang bisa dibaca pemilik. Yang paling berguna: "belum
 * diaktifkan" (pertama kali) dan "kuota gratis penuh" (yang menegaskan tidak
 * ada biaya). `umum` = kalimat untuk galat yang tak dikenali.
 */
export function geminiErrorMessage(e: unknown, umum: string): string {
  if (e instanceof AiGuardError || e instanceof AiAnswerError) return e.message;
  if (e instanceof AIError) {
    const status = e.customErrorData?.status;
    if (e.code === AIErrorCode.API_NOT_ENABLED) {
      return 'Firebase AI Logic belum diaktifkan. Firebase console › Build › AI Logic › Get started › Gemini Developer API (lihat AI-GRATIS.md).';
    }
    if (status === 429) {
      return 'Kuota gratis Gemini sedang penuh (batas per menit atau per hari). Tidak ada biaya; coba lagi beberapa menit.';
    }
    if (status === 403) return 'Akses AI ditolak (403). Cek pengaturan AI Logic di Firebase console.';
    if (status === 404) {
      return `Model ${GEMINI_MODEL} / ${GEMINI_MODEL_CADANGAN} tidak tersedia lagi. Ganti nama modelnya di lib/gemini.ts.`;
    }
    if (status !== undefined && status >= 500) return 'Layanan Gemini sedang bermasalah. Coba lagi nanti.';
    if (e.code === AIErrorCode.RESPONSE_ERROR) return 'Jawaban ditahan filter keamanan Gemini. Ubah kalimatnya lalu coba lagi.';
    if (e.code === AIErrorCode.PARSE_FAILED) return 'Jawaban AI tidak terbaca. Coba lagi.';
    if (/Network request failed/i.test(e.message)) return 'Tidak ada koneksi internet.';
  }
  return umum;
}
