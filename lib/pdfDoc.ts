import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { LOGO_CORE_GWU_DATA_URI } from '@/assets/logoCoreGwu';

// Kerangka bersama semua PDF CORE (notulen bulanan & Rules & Suggestions):
// kop hijau berlogo, kartu keterangan, kaki dokumen, lalu dicetak expo-print
// dan dibagikan lewat share sheet OS.
//
// CATATAN: iOS tidak mengizinkan sebuah berkas didorong LANGSUNG ke WhatsApp
// lewat tautan; share sheet memang satu-satunya jalan resmi. Judul dialognya
// dibuat jelas supaya tidak bingung harus menekan apa.

/** Penanda pemilik dokumen — tampil di sudut kanan atas & kaki tiap PDF. */
export const PDF_BRAND = 'CORE MCL Imanuel Victory';

/** Nama berkas terpanjang yang dipakai; jauh di bawah batas 255 byte APFS. */
const MAX_FILE_NAME = 80;

/**
 * Jarak tepi kertas, dalam poin (kertas bawaan expo-print 612×792 @72 PPI).
 *
 * Dipasang lewat opsi `margins` expo-print, BUKAN padding body: iOS memakai
 * angka ini membentuk area cetak yang berlaku di SETIAP halaman, sedangkan
 * padding body hanya mendorong isi sekali di awal dokumen — akibatnya halaman
 * kedua dan seterusnya mulai mepet di ujung atas kertas.
 */
const PAGE_MARGINS = { top: 36, right: 40, bottom: 44, left: 40 };

/**
 * Ubah judul dokumen jadi nama berkas PDF yang aman.
 * "44. Meeting MCL CL - Juli 2026" → "44. Meeting MCL CL - Juli 2026.pdf"
 *
 * Yang dibuang: karakter terlarang di iOS/Android/Windows (`/ \ : * ? " < > |`
 * dan karakter kendali), spasi berlebih, serta titik/spasi di kedua ujung —
 * titik di depan bikin berkas tersembunyi, titik di belakang bikin "nama..pdf".
 */
export function pdfFileName(title: string, fallback = 'Dokumen'): string {
  const bersih = title
    .replace(/[/\\:*?"<>|\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILE_NAME)
    .replace(/^[\s.]+|[\s.]+$/g, '');
  return `${bersih || fallback}.pdf`;
}

/** Escape teks pengguna agar aman dimasukkan ke HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Ubah teks berbaris jadi paragraf HTML.
 *
 * Enter yang kamu ketik DIHORMATI: baris kosong jadi jeda antar-kelompok,
 * bukan dibuang. Tapi beberapa enter beruntun tetap jadi SATU jeda saja, dan
 * enter di awal/akhir catatan dibuang — itu sisa mengetik, bukan jeda yang
 * disengaja; kalau ikut dicetak, PDF-nya jadi berlubang-lubang.
 */
export function htmlParagraphs(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());
  while (lines.length > 0 && !lines[0]) lines.shift();
  while (lines.length > 0 && !lines[lines.length - 1]) lines.pop();
  if (lines.length === 0) return '<p class="kosong">— belum diisi —</p>';

  const out: string[] = [];
  let adaJeda = false;
  for (const line of lines) {
    if (!line) {
      adaJeda = true;
      continue;
    }
    if (adaJeda) out.push('<div class="jeda"></div>');
    adaJeda = false;
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  return out.join('');
}

/** Satu kartu keterangan di dalam kop, mis. "TANGGAL / Rabu, 19 Agustus 2026". */
export type PdfChip = { label: string; value: string };

/** CSS bersama — kop, kartu keterangan, & kaki. Isi dokumen menambah sendiri. */
const BASE_CSS = `
  * { box-sizing: border-box; }

  /* WebKit membuang warna latar saat mencetak kecuali diminta tegas. Tanpa
     dua baris ini, kop hijau & kartu catatan keluar PUTIH POLOS di PDF. */
  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    color: #10221C;
    /* Jarak tepi TIDAK diatur di sini, melainkan lewat opsi margins
       expo-print (lihat PAGE_MARGINS) — padding body cuma berlaku sekali di
       awal dokumen, jadi halaman kedua dan seterusnya akan mepet tanpa jeda. */
    margin: 0;
    padding: 0;
    font-size: 13px;
    line-height: 1.6;
    background: #fff;
  }

  /* ============ Kop: blok hijau tua, seperti kartu ringkasan di app ============ */
  .kop {
    background: #0C5C50;
    border-radius: 20px;
    padding: 24px 26px;
    color: #fff;
  }
  .kop-atas {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
  }
  .kop-kiri { min-width: 0; }
  .kop .jenis {
    font-size: 10px;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #9FE6D5;
    margin: 0 0 7px;
  }
  .kop h1 {
    font-size: 25px;
    margin: 0;
    line-height: 1.22;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .kop .anak-judul {
    margin: 9px 0 0;
    font-size: 11px;
    line-height: 1.5;
    color: #BFEFE2;
  }

  /* Sudut kanan atas: logo CORE + pemilik dokumen. Logonya lingkaran GELAP,
     jadi diberi alas putih — kalau ditempel langsung ke hijau tua ia hilang. */
  .kop-kanan {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 7px;
  }
  .logo {
    width: 54px;
    height: 54px;
    border-radius: 27px;
    background: #fff;
    padding: 3px;
    display: block;
  }
  .merek {
    margin: 0;
    background: rgba(255,255,255,0.14);
    border-radius: 999px;
    padding: 5px 11px;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: #9FE6D5;
    white-space: nowrap;
  }

  /* Kartu keterangan: tanggal · jam · tempat / versi · pembaruan */
  .info { display: flex; gap: 9px; margin-top: 20px; flex-wrap: wrap; }
  .info div {
    background: rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 9px 13px;
    font-size: 12px;
    line-height: 1.45;
  }
  .info span {
    color: #9FE6D5;
    font-size: 9.5px;
    letter-spacing: 1.1px;
    text-transform: uppercase;
  }

  /* Jeda dari baris kosong yang kamu ketik sendiri (lihat htmlParagraphs) */
  .jeda { height: 9px; }

  /* ============ Kaki ============ */
  .kaki {
    margin-top: 34px; padding-top: 16px;
    border-top: 1px solid #EBDCC5;
    display: flex; align-items: center; gap: 10px;
  }
  .kaki-logo { width: 26px; height: 26px; flex: none; display: block; }
  .kaki-teks { flex: 1; color: #9AA79F; font-size: 10px; line-height: 1.5; }
  .kaki-teks b { color: #0C5C50; font-size: 10.5px; display: block; }
`;

/**
 * Susun satu halaman PDF lengkap.
 * `bodyHtml` & `extraCss` sudah harus aman untuk HTML (pakai escapeHtml).
 */
export function pdfShellHtml({
  eyebrow,
  title,
  subtitle,
  chips,
  bodyHtml,
  footerNote,
  extraCss = '',
}: {
  eyebrow: string;
  title: string;
  /** Baris kecil di bawah judul, mis. kredit penyusun. Boleh kosong. */
  subtitle?: string;
  chips: PdfChip[];
  bodyHtml: string;
  footerNote: string;
  extraCss?: string;
}): string {
  const chipHtml = chips
    .filter((c) => c.value)
    .map(
      (c) =>
        `<div><span>${escapeHtml(c.label)}</span><br/>${escapeHtml(c.value)}</div>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${BASE_CSS}${extraCss}</style>
</head>
<body>
  <div class="kop">
    <div class="kop-atas">
      <div class="kop-kiri">
        <p class="jenis">${escapeHtml(eyebrow)}</p>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="anak-judul">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <div class="kop-kanan">
        <img class="logo" src="${LOGO_CORE_GWU_DATA_URI}" alt="Logo CORE" />
        <p class="merek">${escapeHtml(PDF_BRAND)}</p>
      </div>
    </div>
    ${chipHtml ? `<div class="info">${chipHtml}</div>` : ''}
  </div>

  ${bodyHtml}

  <div class="kaki">
    <img class="kaki-logo" src="${LOGO_CORE_GWU_DATA_URI}" alt="" />
    <div class="kaki-teks">
      <b>${escapeHtml(PDF_BRAND)}</b>
      ${escapeHtml(footerNote)}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Cetak HTML jadi PDF lalu buka share sheet OS.
 *
 * `fileName` opsional: kalau diisi, berkasnya dinamai ulang supaya penerima
 * langsung tahu isinya; kalau tidak, nama acak bawaan expo-print dipakai apa
 * adanya. Melempar error kalau gagal supaya pemanggil bisa menampilkan pesan.
 */
export async function sharePdf(
  html: string,
  dialogTitle: string,
  fileName?: string,
): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, margins: PAGE_MARGINS });

  // expo-print selalu menamai hasilnya acak (cache/Print/<UUID>.pdf), jadi di
  // WhatsApp muncul sebagai "9F3C1A….pdf".
  //
  // rename() memakai nama POLOS & tetap di folder yang sama. Folder Print/ itu
  // dipakai bersama semua PDF, jadi membagikan dokumen yang sama dua kali akan
  // bentrok nama → berkas lama dibuang lebih dulu. Kalau penamaan gagal karena
  // sebab lain, PDF tetap dibagikan apa adanya; nama jelek lebih baik daripada
  // batal kirim.
  const pdf = new File(uri);
  if (fileName) {
    try {
      const bentrok = new File(pdf.parentDirectory, fileName);
      if (bentrok.exists) bentrok.delete();
      pdf.rename(fileName);
    } catch {
      // Biarkan nama bawaan expo-print.
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(pdf.uri, {
      mimeType: 'application/pdf',
      dialogTitle,
      UTI: 'com.adobe.pdf',
    });
  }
}
