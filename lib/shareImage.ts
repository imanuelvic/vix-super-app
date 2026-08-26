import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { Color } from '../assets/style/color';
import { dayIdToDate } from './format';

// Bahan bersama untuk SEMUA gambar yang bisa dibagikan dari app ini:
//   • Daily Reflection Journal 📓 → Feed 4:5   (lib/reflectionFeed.ts)
//   • Ayat Alkitab 📖            → Story 9:16  (lib/bibleStory.ts)
//
// Yang tinggal di sini cuma yang benar-benar SAMA di keduanya: rupa/warna,
// nomor arsip, pemenggal baris, dan cara menyimpan/membagikan berkasnya.
// Ukuran & tata letaknya beda jauh, jadi itu tetap di berkasnya masing-masing.
//
// ── Kenapa gambarnya dibuat DI HP, bukan oleh AI ──────────────────────────
//   1. App ini tidak punya AI sama sekali. Menambahkannya berarti API key ikut
//      tertanam di dalam app — dan API key di aplikasi klien BISA DIAMBIL
//      orang lain untuk dipakai atas tagihanmu.
//   2. Model gambar AI terkenal buruk menuliskan HURUF, apalagi bahasa
//      Indonesia. Tulisan yang salah ketik itu lebih buruk daripada desain
//      sederhana yang benar. Teksmu di sini disalin apa adanya, cuma dipenggal
//      per baris — maknanya tidak pernah berubah.

/** Nama arsipnya. Dipakai di gambar & nama berkas. */
export const ARCHIVE_NAME = 'vixtory.archive';

/**
 * Rupa kartu. Sengaja SEDIKIT & tenang — ini identitas satu arsip, bukan
 * kumpulan tema. Warnanya diambil dari palet app (assets/style/color) supaya
 * hasilnya terasa satu keluarga dengan aplikasinya.
 */
export type ShareDesign = {
  key: string;
  label: string;
  /** Latar kertas. */
  paper: string;
  /** Tulisan utama. */
  ink: string;
  /** Kop, tanggal, & tanda arsip. */
  muted: string;
  /** Garis rambut pembatas. */
  rule: string;
};

export const SHARE_DESIGNS: ShareDesign[] = [
  {
    key: 'paper',
    label: 'Paper',
    paper: Color.BACKGROUND,
    ink: Color.TEXT_TITLE,
    muted: Color.TEXT_LABEL,
    rule: Color.BORDER,
  },
  {
    key: 'ink',
    label: 'Ink',
    paper: '#12211C',
    ink: '#F3EFE6',
    muted: '#8FA79C',
    rule: '#2C3F38',
  },
  {
    key: 'sage',
    label: 'Sage',
    paper: '#E8EFE9',
    ink: Color.MAIN_DARK,
    muted: '#5F7A70',
    rule: '#C9DACE',
  },
];

export function designOf(key: string): ShareDesign {
  return SHARE_DESIGNS.find((d) => d.key === key) ?? SHARE_DESIGNS[0];
}

/**
 * Nomor arsip: hari ke-berapa dalam tahun itu, mis. "No. 238".
 * Inilah yang membuatnya terbaca sebagai ARSIP — tiap lembar punya nomor urut
 * yang jujur, bukan hiasan acak. (Dipakai apa adanya di gambar.)
 */
export function archiveNo(dayId: string): string {
  const d = dayIdToDate(dayId);
  const awal = new Date(d.getFullYear(), 0, 0);
  const hari = Math.round((d.getTime() - awal.getTime()) / 86_400_000);
  return `No. ${String(hari).padStart(3, '0')}`;
}

/**
 * Penggal teks jadi baris-baris yang muat selebar kartu.
 *
 * Dipotong per KATA, tidak pernah di tengah kata — maknanya harus utuh. Kata
 * tunggal yang lebih panjang dari satu baris (mis. tautan) terpaksa dipotong;
 * lebih baik terpotong daripada melebar keluar gambar.
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

/** Satu tingkat ukuran huruf beserta lebar baris & tinggi barisnya. */
export type TextStep = { maxChars: number; fontSize: number; perLine: number };

/** Hasil penataan teks, siap digambar ke SVG. */
export type TextLayout = {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  /** Titik tengah blok teks pada sumbu Y. */
  centerY: number;
};

/**
 * Tata teks jadi baris + ukuran huruf yang pas di dalam kotak yang tersedia.
 *
 * Dicoba dari huruf paling besar; begitu ketemu ukuran yang barisnya masih
 * muat, itu yang dipakai. Tulisan pendek jadi besar & berwibawa, tulisan
 * panjang mengecil sendiri — tak ada yang perlu kamu atur.
 *
 * Dipakai bersama Feed 4:5 & Story 9:16; yang berbeda cuma tangga ukurannya
 * dan tinggi kotaknya, jadi keduanya mengirim angkanya sendiri.
 */
export function layoutText(
  text: string,
  steps: TextStep[],
  bodyTop: number,
  bodyBottom: number,
): TextLayout {
  const maxLines = (perLine: number) =>
    Math.floor((bodyBottom - bodyTop) / perLine);
  const centerY = (bodyTop + bodyBottom) / 2;
  for (const step of steps) {
    const lines = wrapLines(text, step.maxChars);
    if (lines.length <= maxLines(step.perLine)) {
      return {
        lines,
        fontSize: step.fontSize,
        lineHeight: step.perLine,
        centerY,
      };
    }
  }
  // Terlalu panjang untuk semua ukuran → pakai yang terkecil & potong.
  const step = steps[steps.length - 1];
  return {
    lines: wrapLines(text, step.maxChars).slice(0, maxLines(step.perLine)),
    fontSize: step.fontSize,
    lineHeight: step.perLine,
    centerY,
  };
}

/** Posisi Y baris ke-`i` supaya seluruh blok teksnya persis di tengah badan. */
export function lineY(layout: TextLayout, i: number): number {
  const tinggi = layout.lines.length * layout.lineHeight;
  const atas = layout.centerY - tinggi / 2;
  // +0.72 × tinggi baris = garis alas huruf (baseline), bukan tepi atasnya.
  return atas + i * layout.lineHeight + layout.lineHeight * 0.72;
}

/**
 * Tulis PNG hasil rancangan lalu buka lembar berbagi iOS.
 *
 * Di lembar itu ada "Save Image" (simpan ke Foto) maupun Instagram & aplikasi
 * lain — satu pintu untuk simpan MAUPUN bagikan. `dialogTitle` yang membedakan
 * maksud tombolnya.
 *
 * `base64` = keluaran Svg.toDataURL() (tanpa awalan `data:`). Berkasnya cuma
 * singgah di folder cache; iOS membersihkannya sendiri.
 */
export async function sharePng(
  base64: string,
  fileName: string,
  dialogTitle: string,
): Promise<void> {
  const file = new File(Paths.cache, fileName);
  // Membuat gambar hari yang sama dua kali akan bentrok nama → yang lama dibuang.
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle,
    });
  }
}
