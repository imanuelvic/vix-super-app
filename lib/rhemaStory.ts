import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { Color } from '../assets/style/color';
import { pickOfDay } from './core';

// Rhema → Instagram Story ✍️
//
// Satu ketukan: rhema pagimu dirancang otomatis jadi gambar Story 1080×1920,
// lalu dibagikan lewat lembar berbagi iOS (di situ ada Instagram → Story).
//
// ── Soal "didesain AI" ────────────────────────────────────────────────────
// Desainnya dibuat DI HP ini, bukan oleh AI, dan itu keputusan sadar:
//
//   1. App ini tidak punya AI sama sekali. Menambahkannya berarti API key ikut
//      tertanam di dalam app — dan API key di aplikasi klien BISA DIAMBIL
//      orang lain untuk dipakai atas tagihanmu.
//   2. Model gambar AI terkenal buruk menuliskan HURUF, apalagi bahasa
//      Indonesia. Ayat yang salah ketik di Story itu lebih buruk daripada
//      desain yang sederhana tapi benar.
//   3. Jadi teksnya toh tetap harus ditulis program seperti di sini. Yang AI
//      tambahkan cuma gambar latarnya — dengan biaya per gambar & risiko di
//      atas.
//
// Hasilnya sama seperti yang kamu mau: kamu tidak mendesain apa pun, app yang
// memilihkan. Rancangannya berganti sendiri tiap hari & bisa diganti manual.

/** Ukuran Story Instagram — 9:16. */
export const STORY_W = 1080;
export const STORY_H = 1920;

/**
 * Rancangan kartu Story. Warnanya diambil dari palet app (assets/style/color)
 * supaya Story-mu terasa satu keluarga dengan aplikasinya — bukan tempelan.
 */
export type StoryDesign = {
  key: string;
  label: string;
  /** Gradien latar, dari atas ke bawah. */
  from: string;
  to: string;
  /** Warna teks utama & teks kecil di atasnya. */
  text: string;
  muted: string;
  /** Warna bulatan hias. */
  glow: string;
};

export const STORY_DESIGNS: StoryDesign[] = [
  { key: 'teal', label: 'Teal', from: Color.MAIN_DARK, to: Color.MAIN, text: Color.TEXT_REVERSE, muted: Color.MAIN_LIGHT, glow: Color.MAIN_LIGHT },
  { key: 'spiritual', label: 'Ungu', from: '#3C2A63', to: Color.SPIRITUAL_DARK, text: Color.TEXT_REVERSE, muted: Color.SPIRITUAL, glow: Color.SPIRITUAL },
  { key: 'cream', label: 'Krem', from: Color.BACKGROUND, to: Color.ACCENT, text: Color.MAIN_DARK, muted: Color.ACCENT_DARK, glow: Color.MAIN_LIGHT },
  { key: 'night', label: 'Malam', from: '#0B1F1A', to: Color.MAIN_DARK, text: Color.TEXT_REVERSE, muted: Color.MAIN_LIGHT, glow: Color.MAIN },
  { key: 'sunrise', label: 'Fajar', from: Color.FITNESS_DARK, to: Color.FITNESS, text: Color.TEXT_REVERSE, muted: Color.ACCENT, glow: Color.ACCENT },
  { key: 'ocean', label: 'Laut', from: Color.WORLD_DARK, to: Color.WORLD, text: Color.TEXT_REVERSE, muted: Color.BACKGROUND, glow: Color.BACKGROUND },
  { key: 'rose', label: 'Mawar', from: Color.MARRIED_DARK, to: Color.MARRIED, text: Color.TEXT_REVERSE, muted: Color.BACKGROUND, glow: Color.BACKGROUND },
  { key: 'slate', label: 'Slate', from: Color.HOUSE_DARK, to: Color.HOUSE, text: Color.TEXT_REVERSE, muted: Color.BACKGROUND, glow: Color.BACKGROUND },
];

export function designOf(key: string): StoryDesign {
  return STORY_DESIGNS.find((d) => d.key === key) ?? STORY_DESIGNS[0];
}

/**
 * Rancangan giliran hari ini — diundi tapi TETAP sama sepanjang hari, memakai
 * pengundi harian yang sama dengan kutipan Fitness & pokok doa. Jadi Story-mu
 * ganti nuansa tiap pagi tanpa kamu memilih apa pun.
 */
export function designOfDay(dayId: string): StoryDesign {
  return pickOfDay(STORY_DESIGNS, dayId, 'rhemaStory');
}

// ===================== Menata teksnya =====================

/**
 * Penggal teks jadi baris-baris yang muat selebar kartu.
 *
 * Dipotong per KATA, tidak pernah di tengah kata. Kata tunggal yang lebih
 * panjang dari satu baris (mis. tautan) dipaksa dipotong — lebih baik terpotong
 * daripada melebar keluar gambar.
 */
export function wrapLines(text: string, maxChars: number): string[] {
  const out: string[] = [];
  // Baris kosong ganda dirapikan jadi satu; enter yang kamu ketik dihormati.
  for (const paragraf of text.trim().split(/\n+/)) {
    let baris = '';
    for (const kata of paragraf.trim().split(/\s+/)) {
      if (!kata) continue;
      if (kata.length > maxChars) {
        if (baris) {
          out.push(baris);
          baris = '';
        }
        for (let i = 0; i < kata.length; i += maxChars) {
          out.push(kata.slice(i, i + maxChars));
        }
        continue;
      }
      const gabung = baris ? `${baris} ${kata}` : kata;
      if (gabung.length <= maxChars) {
        baris = gabung;
      } else {
        out.push(baris);
        baris = kata;
      }
    }
    if (baris) out.push(baris);
  }
  return out;
}

/** Hasil penataan teks, siap digambar ke SVG. */
export type StoryLayout = {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  /** Titik tengah blok teks pada sumbu Y. */
  centerY: number;
};

// Ukuran huruf menyesuaikan panjang rhema: makin panjang, makin kecil, supaya
// selalu muat tanpa pernah terpotong. Angkanya dipilih dari lebar 1080 px
// dikurangi tepi kiri-kanan.
const STORY_STEPS: { maxChars: number; fontSize: number; perLine: number }[] = [
  { maxChars: 18, fontSize: 92, perLine: 120 },
  { maxChars: 24, fontSize: 74, perLine: 98 },
  { maxChars: 30, fontSize: 60, perLine: 80 },
  { maxChars: 38, fontSize: 48, perLine: 64 },
  { maxChars: 48, fontSize: 38, perLine: 52 },
];

/** Paling banyak berapa baris yang muat di badan kartu. */
const MAX_LINES = 16;

/**
 * Tata rhema jadi baris + ukuran huruf yang pas.
 *
 * Dicoba dari huruf paling besar; begitu ketemu ukuran yang barisnya masih
 * muat, itu yang dipakai. Rhema pendek jadi besar & berwibawa, rhema panjang
 * mengecil sendiri — tak ada yang perlu kamu atur.
 */
export function layoutStory(text: string): StoryLayout {
  for (const step of STORY_STEPS) {
    const lines = wrapLines(text, step.maxChars);
    const muat = lines.length * step.perLine <= 1080;
    if (muat && lines.length <= MAX_LINES) {
      return {
        lines,
        fontSize: step.fontSize,
        lineHeight: step.perLine,
        centerY: STORY_H / 2,
      };
    }
  }
  // Terlalu panjang untuk semua ukuran → pakai yang terkecil & potong.
  const step = STORY_STEPS[STORY_STEPS.length - 1];
  const lines = wrapLines(text, step.maxChars).slice(0, MAX_LINES);
  return {
    lines,
    fontSize: step.fontSize,
    lineHeight: step.perLine,
    centerY: STORY_H / 2,
  };
}

/** Posisi Y baris ke-`i` supaya seluruh blok teksnya persis di tengah. */
export function lineY(layout: StoryLayout, i: number): number {
  const tinggi = layout.lines.length * layout.lineHeight;
  const atas = layout.centerY - tinggi / 2;
  // +0.72 × tinggi baris = garis alas huruf (baseline), bukan tepi atasnya.
  return atas + i * layout.lineHeight + layout.lineHeight * 0.72;
}

// ===================== Menyimpan & membagikan =====================

/** Nama berkas yang enak dibaca di Instagram/Files. */
export function storyFileName(dayId: string): string {
  return `Rhema ${dayId}.png`;
}

/**
 * Simpan PNG hasil rancangan lalu buka lembar berbagi iOS — di situ ada
 * Instagram, yang membukanya langsung ke pilihan Story.
 *
 * `base64` = keluaran Svg.toDataURL() (tanpa awalan `data:`). Berkasnya cuma
 * singgah di folder cache; iOS membersihkannya sendiri.
 */
export async function shareStoryPng(
  base64: string,
  fileName: string,
): Promise<void> {
  const file = new File(Paths.cache, fileName);
  // Membagikan rhema hari yang sama dua kali akan bentrok nama → yang lama
  // dibuang dulu.
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Bagikan ke Instagram Story',
    });
  }
}
