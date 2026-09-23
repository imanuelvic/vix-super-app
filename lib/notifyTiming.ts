import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NotifyGroup } from './notify';

// ===================== Jam pengingat yang ikut kebiasaanmu =====================
//
// Duolingo tidak mengingatkan di jam yang sama untuk semua orang: ia mengirim
// pengingat di sekitar jam kamu biasanya berlatih. Di sini caranya sama, tapi
// SELURUHNYA di HP sendiri (AsyncStorage) dan tanpa satu pun bacaan Firestore
// tambahan.
//
// Cara belajarnya sederhana dan jujur:
//   1. Tiap kali layar Today digambar, tiap kelompok dicatat "masih ada isinya"
//      atau "sudah kosong" hari itu.
//   2. Begitu satu kelompok berubah dari ADA ISI menjadi KOSONG, jam saat itu
//      disimpan sebagai satu contoh: itulah jam kamu biasanya menyelesaikannya.
//   3. Sesudah cukup contoh (CONTOH_MINIMAL), pengingatnya digeser ke MEDIAN
//      jam itu dikurangi setengah jam, dipatok di dalam jendela yang masuk akal
//      untuk kelompok itu.
//
// Median, bukan rata-rata: satu hari aneh (mengerjakan CORE jam 23.00) tidak
// boleh menggeser pengingat dua minggu ke depan.
//
// Kalau contohnya belum cukup, jamnya tetap jam bawaan. Jadi fitur ini tidak
// pernah "kosong": ia cuma jadi lebih pas seiring waktu.

/** Berapa contoh sebelum jam bawaan boleh digeser. */
export const CONTOH_MINIMAL = 3;

/** Contoh yang disimpan per kelompok (contoh terlama dibuang). */
export const CONTOH_MAKS = 14;

/** Pengingat dikirim sebelum jam kebiasaannya, bukan pas di jamnya. */
export const MAJU_MENIT = 30;

export type Jam = { hour: number; minute: number };

/** Jendela jam yang masuk akal untuk satu kelompok + jam bawaannya. */
export type Jendela = { bawaan: Jam; dari: Jam; sampai: Jam };

/**
 * Kelompok yang jamnya BELAJAR. Sisanya (bacaan Alkitab, Finance, achievement)
 * sengaja tetap: jamnya terikat jendela fiturnya sendiri, bukan kebiasaan.
 */
export const JENDELA: Partial<Record<NotifyGroup, Jendela>> = {
  journey: { bawaan: { hour: 6, minute: 0 }, dari: { hour: 5, minute: 0 }, sampai: { hour: 8, minute: 0 } },
  core: { bawaan: { hour: 8, minute: 30 }, dari: { hour: 7, minute: 0 }, sampai: { hour: 11, minute: 0 } },
  work: { bawaan: { hour: 9, minute: 30 }, dari: { hour: 8, minute: 0 }, sampai: { hour: 12, minute: 0 } },
  life: { bawaan: { hour: 17, minute: 30 }, dari: { hour: 15, minute: 0 }, sampai: { hour: 20, minute: 0 } },
  reflection: { bawaan: { hour: 21, minute: 30 }, dari: { hour: 20, minute: 0 }, sampai: { hour: 23, minute: 0 } },
};

// ----------------------------- hitungan murni -----------------------------

export function keMenit(j: Jam): number {
  return j.hour * 60 + j.minute;
}

export function dariMenit(menit: number): Jam {
  return { hour: Math.floor(menit / 60), minute: menit % 60 };
}

/** Nilai tengah; genap → ambil yang bawah (contohnya sedikit, bukan statistik). */
export function median(nilai: number[]): number | null {
  if (nilai.length === 0) return null;
  const urut = [...nilai].sort((a, b) => a - b);
  return urut[Math.floor((urut.length - 1) / 2)];
}

/**
 * Jam pengingat dari contoh kebiasaan. Contoh kurang dari CONTOH_MINIMAL →
 * jam bawaannya, apa adanya.
 */
export function jamDariContoh(contoh: number[], jendela: Jendela): Jam {
  if (contoh.length < CONTOH_MINIMAL) return jendela.bawaan;
  const tengah = median(contoh);
  if (tengah === null) return jendela.bawaan;
  const maju = tengah - MAJU_MENIT;
  const dipatok = Math.min(Math.max(maju, keMenit(jendela.dari)), keMenit(jendela.sampai));
  // Dibulatkan ke kelipatan 15 menit: "08.45" terbaca sebagai jam yang dipilih,
  // "08.47" terbaca seperti kesalahan.
  return dariMenit(Math.round(dipatok / 15) * 15);
}

// ----------------------------- penyimpanan -----------------------------

const CONTOH_KEY = (g: NotifyGroup) => `notify:jam:${g}`;
const PANTAU_KEY = 'notify:pantau';

type Pantau = { dayId: string; buka: NotifyGroup[] };

async function bacaJson<T>(kunci: string, kalauKosong: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(kunci);
    return raw ? (JSON.parse(raw) as T) : kalauKosong;
  } catch {
    return kalauKosong;
  }
}

/** Contoh jam selesai satu kelompok (menit sejak tengah malam). */
export async function contohJam(group: NotifyGroup): Promise<number[]> {
  const isi = await bacaJson<number[]>(CONTOH_KEY(group), []);
  return Array.isArray(isi) ? isi.filter((n) => typeof n === 'number' && n >= 0 && n < 1440) : [];
}

async function simpanContoh(group: NotifyGroup, menit: number): Promise<void> {
  const lama = await contohJam(group);
  const baru = [...lama, menit].slice(-CONTOH_MAKS);
  await AsyncStorage.setItem(CONTOH_KEY(group), JSON.stringify(baru)).catch(() => {});
}

/**
 * Catat keadaan tiap kelompok hari ini. `terisi` = kelompok yang HARI INI masih
 * punya sesuatu yang menunggu. Yang tadi ada lalu sekarang hilang = baru saja
 * diselesaikan, jamnya disimpan sebagai contoh.
 *
 * Dipanggil dari `syncNotifications`, jadi ia ikut tiap kali layar Today
 * digambar. Aman diulang: yang menentukan cuma perubahan ADA menjadi KOSONG.
 */
export async function catatKebiasaan(
  terisi: NotifyGroup[],
  dayId: string,
  now: Date,
): Promise<void> {
  const pantau = await bacaJson<Pantau>(PANTAU_KEY, { dayId, buka: [] });
  const bukaKemarin = pantau.dayId === dayId && Array.isArray(pantau.buka) ? pantau.buka : [];
  const menit = now.getHours() * 60 + now.getMinutes();
  for (const g of bukaKemarin) {
    if (!terisi.includes(g)) await simpanContoh(g, menit);
  }
  await AsyncStorage.setItem(
    PANTAU_KEY,
    JSON.stringify({ dayId, buka: terisi } satisfies Pantau),
  ).catch(() => {});
}

/** Jam pengingat satu kelompok sekarang (sesudah belajar dari kebiasaan). */
export async function jamPengingat(group: NotifyGroup): Promise<Jam | null> {
  const jendela = JENDELA[group];
  if (!jendela) return null;
  return jamDariContoh(await contohJam(group), jendela);
}

/** Semua jam yang sudah dipelajari, siap dipakai penyusun jadwal & layar. */
export async function semuaJamPengingat(): Promise<Partial<Record<NotifyGroup, Jam>>> {
  const hasil: Partial<Record<NotifyGroup, Jam>> = {};
  for (const key of Object.keys(JENDELA) as NotifyGroup[]) {
    const jam = await jamPengingat(key);
    if (jam) hasil[key] = jam;
  }
  return hasil;
}

/** Kelompok ini sudah punya cukup contoh untuk menggeser jamnya? */
export async function sudahBelajar(group: NotifyGroup): Promise<boolean> {
  if (!JENDELA[group]) return false;
  return (await contohJam(group)).length >= CONTOH_MINIMAL;
}
