import AsyncStorage from '@react-native-async-storage/async-storage';

import { dayId } from './format';

// Pagar pemakaian AI di sisi app: semua panggilan model (lib/notulenAi.ts,
// dan fitur AI lain kelak) lewat sini, supaya satu jari yang gatal atau satu
// bug pengulang tidak bisa menguras kuota gratis Gemini, apalagi jadi tagihan.
//
// Lima lapis, dari yang paling murah:
//   1. Jawaban terakhir DIINGAT per kunci masukan: teks yang persis sama
//      tidak pernah dikirim dua kali.
//   2. Permintaan yang sama selagi masih berjalan DIPAKAI BERSAMA (dedupe),
//      bukan dikirim lagi.
//   3. Jeda minimal antar panggilan (COOLDOWN_MS): click bertubi-tubi ditolak
//      sopan, bukan diantre.
//   4. Sesudah server menjawab 429 (kuota gratis penuh) semua panggilan
//      dikunci QUOTA_LOCK_MS: memukul kuota yang sudah penuh cuma memperpanjang
//      penaltinya.
//   5. Batas harian per perangkat (DAILY_CAP) di AsyncStorage, jauh di bawah
//      kuota gratis harian Gemini, jadi kuota itu tak pernah tersentuh dari
//      app ini.
//
// Uang: proyek Firebase-nya di paket Spark (tanpa kartu), dan Gemini Developer
// API di Spark hanya punya kuota gratis. Lewat kuota = ditolak (429), BUKAN
// ditagih. Pagar di sini menjaga PENGALAMAN (tidak mentok kuota), bukan
// dompet; dompetnya dijaga oleh paket Spark itu sendiri. Lihat AI-GRATIS.md.

const COOLDOWN_MS = 5_000;
const QUOTA_LOCK_MS = 60_000;
const DAILY_CAP = 30;
const DAILY_PREFIX = 'ai:calls:';

/** Ditolak oleh pagar, sebelum menyentuh jaringan. `message` siap tampil. */
export class AiGuardError extends Error {
  constructor(
    readonly kind: 'cooldown' | 'quota-locked' | 'daily-cap',
    message: string,
  ) {
    super(message);
    this.name = 'AiGuardError';
  }
}

let lastCallAt = 0;
let quotaLockedUntil = 0;
const inFlight = new Map<string, Promise<unknown>>();
let lastAnswer: { key: string; value: unknown } | null = null;

async function dailyCount(now: Date): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(DAILY_PREFIX + dayId(now));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

async function bumpDaily(now: Date, count: number): Promise<void> {
  try {
    await AsyncStorage.setItem(DAILY_PREFIX + dayId(now), String(count + 1));
  } catch {
    // Tidak bisa mencatat = tidak apa-apa; pagar lain masih berdiri.
  }
}

/**
 * Jalankan `run` (satu panggilan model) di balik pagar. `key` = masukan yang
 * dikirim, dalam bentuk string; masukan yang sama → jawaban yang sama.
 * Melempar AiGuardError kalau ditolak pagar; galat dari `run` diteruskan.
 */
export async function guardedAiCall<T>(key: string, run: () => Promise<T>): Promise<T> {
  if (lastAnswer && lastAnswer.key === key) return lastAnswer.value as T;

  const running = inFlight.get(key);
  if (running) return running as Promise<T>;

  const now = new Date();
  const t = now.getTime();
  if (t < quotaLockedUntil) {
    const detik = Math.ceil((quotaLockedUntil - t) / 1000);
    throw new AiGuardError(
      'quota-locked',
      `Kuota gratis AI sedang penuh. Coba lagi dalam ${detik} detik.`,
    );
  }
  if (t - lastCallAt < COOLDOWN_MS) {
    throw new AiGuardError('cooldown', 'Sebentar, permintaan sebelumnya baru saja dikirim.');
  }

  // Pemeriksaan di atas & pendaftaran di bawah sengaja TANPA await di
  // antaranya: dua click yang datang bersamaan harus melihat satu sama lain.
  // Pemeriksaan harian (butuh AsyncStorage, jadi async) dikerjakan di dalam
  // promise yang sudah terdaftar.
  lastCallAt = t;
  const p = (async () => {
    try {
      const dipakai = await dailyCount(now);
      if (dipakai >= DAILY_CAP) {
        throw new AiGuardError(
          'daily-cap',
          `Batas ${DAILY_CAP} permintaan AI per hari di perangkat ini sudah tercapai. Lanjut besok.`,
        );
      }
      // Dihitung saat DICOBA, bukan saat berhasil: percobaan yang gagal pun
      // memakan kuota di server.
      await bumpDaily(now, dipakai);
      const value = await run();
      lastAnswer = { key, value };
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, p);
  return p;
}

/** Dipanggil pemakai begitu server menjawab 429: kunci semua panggilan sebentar. */
export function markQuotaExhausted(): void {
  quotaLockedUntil = Date.now() + QUOTA_LOCK_MS;
}

/** Hanya untuk pengujian: kosongkan semua keadaan pagar. */
export function resetAiGuardForTests(): void {
  lastCallAt = 0;
  quotaLockedUntil = 0;
  inFlight.clear();
  lastAnswer = null;
}
