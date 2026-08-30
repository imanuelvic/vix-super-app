import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
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
// ── PENTING soal ukuran gambar ────────────────────────────────────────────
// Svg.toDataURL({ width, height }) hanya menentukan besar KANVAS-nya; kartunya
// tetap digambar sebesar ukuran TATA LETAK view-nya (react-native-svg memanggil
// drawToContext dengan `self.bounds`, bukan dengan kanvas yang kita minta).
// Jadi kalau pratinjaunya dirender selebar 320 px, hasilnya kartu 320 px di
// pojok kiri-atas kanvas 1080 px — sisanya kosong/hitam.
//
// Karena itu kedua layar merender kartunya pada ukuran PENUH (1080 px) lalu
// mengecilkannya secara visual dengan `transform: scale`. Transform tidak
// mengubah ukuran tata letak, jadi yang tertangkap tetap 1080 px penuh.
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

/** Tahun kabisat? (aturan Gregorian lengkap — 1900 bukan, 2000 iya.) */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Nomor arsip: hari ke-berapa dalam tahun itu, dari total harinya —
 * mis. "Day 241 / 365", dan "Day 241 / 366" di tahun kabisat.
 *
 * Inilah yang membuatnya terbaca sebagai ARSIP: bukan cuma nomor urut, tapi
 * juga seberapa jauh tahun ini sudah berjalan. (Dipakai apa adanya di gambar.)
 */
export function archiveNo(dayId: string): string {
  const d = dayIdToDate(dayId);
  const awal = new Date(d.getFullYear(), 0, 0);
  const hari = Math.round((d.getTime() - awal.getTime()) / 86_400_000);
  return `Day ${hari} / ${isLeapYear(d.getFullYear()) ? 366 : 365}`;
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

/** Izin Foto ditolak — dibedakan supaya layarnya bisa memberi pesan yang benar. */
export class PhotoPermissionError extends Error {
  constructor() {
    super('Izin menyimpan ke Foto belum diberikan.');
    this.name = 'PhotoPermissionError';
  }
}

/**
 * Pesan yang tepat untuk kegagalan menyimpan gambar.
 *
 * Izin yang ditolak BUKAN "coba lagi" — mengulang tidak akan pernah berhasil
 * sampai izinnya dinyalakan sendiri di Settings, dan iOS cuma menanyakannya
 * SEKALI. Jadi kasus itu diberi jalan keluarnya, bukan ajakan mengulang.
 */
export function photoErrorMessage(error: unknown): string {
  return error instanceof PhotoPermissionError
    ? 'Izin simpan ke Foto belum diberikan. Buka Settings → vix → Photos → pilih “Add Photos Only”, lalu coba lagi.'
    : 'Gagal menyimpan gambarnya. Coba lagi ya.';
}

/**
 * Simpan PNG hasil rancangan LANGSUNG ke Foto di HP.
 *
 * `base64` = keluaran Svg.toDataURL() (tanpa awalan `data:`). Berkasnya ditulis
 * dulu ke folder cache karena Foto hanya menerima berkas, bukan teks base64;
 * setelah tersalin ke Foto, salinan cache-nya tidak dipakai lagi dan iOS
 * membersihkannya sendiri.
 *
 * Izin yang diminta sengaja `writeOnly` (Add Photos Only): app ini cuma perlu
 * MENAMBAH gambar, tidak perlu membaca seluruh galerimu.
 */
export async function savePngToPhotos(
  base64: string,
  fileName: string,
): Promise<void> {
  const izin = await requestPermissionsAsync(true);
  if (!izin.granted) throw new PhotoPermissionError();

  const file = new File(Paths.cache, fileName);
  // Membuat gambar hari yang sama dua kali akan bentrok nama → yang lama dibuang.
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  await Asset.create(file.uri);
}

/**
 * Bagikan gambar lewat lembar berbagi iOS — WhatsApp, Telegram, Notes, siapa
 * pun yang bisa menerima gambar. Berkasnya ditulis ke folder cache app, jadi
 * TIDAK menambah apa pun ke galeri Foto-mu (beda dengan savePngToPhotos).
 *
 * Kenapa PNG dan bukan JPG: gambar keluar dari `Svg.toDataURL()` memang PNG,
 * dan mengubahnya jadi JPG butuh modul native tambahan (expo-image-manipulator)
 * — artinya build EAS baru untuk keuntungan yang nol: WhatsApp menampilkan PNG
 * sebagai foto biasa, persis sama.
 */
export async function sharePng(
  base64: string,
  fileName: string,
  dialogTitle: string,
): Promise<void> {
  const file = new File(Paths.cache, fileName);
  // Membagikan gambar hari yang sama dua kali akan bentrok nama → yang lama
  // dibuang dulu (pola yang sama dengan savePngToPhotos di atas).
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing off');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'image/png',
    dialogTitle,
    UTI: 'public.png',
  });
}

/**
 * Buka aplikasi Instagram.
 *
 * `story` membuka langsung kamera Story — di pojok kiri bawahnya ada pratinjau
 * foto TERBARU di galerimu, jadi gambar yang barusan disimpan tinggal
 * di-click sekali. `app` membuka Instagram apa adanya (untuk Feed, karena
 * unggahan Feed memang lewat tombol + di dalam app-nya).
 *
 * iOS tidak mengizinkan aplikasi lain menyuntikkan gambar ke dalam Instagram
 * tanpa izin khusus dari Meta — karena itu alurnya: simpan ke Foto dulu, baru
 * Instagram dibuka. Kalau Instagram tidak terpasang, situsnya yang dibuka.
 */
export async function openInstagram(target: 'app' | 'story'): Promise<void> {
  const skema = target === 'story' ? 'instagram://story-camera' : 'instagram://app';
  try {
    await Linking.openURL(skema);
  } catch {
    await Linking.openURL('https://www.instagram.com/');
  }
}
