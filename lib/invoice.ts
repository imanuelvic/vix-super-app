import { invoiceTotal, type FreelanceProject, type InvoiceItem } from './career';
import { formatDate } from './format';
import { escapeHtml, pdfFileName, sharePdf } from './pdfDoc';
import { formatRupiah } from './transactions';

// Invoice PDF untuk proyek freelance — template resmi PT. Victory Technology
// Indonesia. Berkas ini hanya menyusun HTML-nya; pencetakan ke PDF & pembukaan
// share sheet ditangani util bersama lib/pdfDoc.ts.
//
// Catatan: invoice TIDAK memakai kop/logo CORE dari pdfShellHtml — ini surat
// resmi perusahaan dengan letterhead sendiri, jadi HTML-nya berdiri sendiri.

// Data perusahaan (dari letterhead resmi). Ubah di sini kalau berubah.
const COMPANY_INFO = {
  name: 'PT. Victory Technology Indonesia',
  address:
    'Flamboyan Tower, Apt. Mediterania G.R.2, RT.3/RW.8 Podomoro City, Jl. Letjen S. Parman No.28, Tj. Duren Sel., Grogol Petamburan, Jakarta Barat, DKI Jakarta 11470',
  phone: '0813-7785-3271',
  signer: 'Imanuel Victory Rumayar',
};

export type InvoicePreset = {
  desc: string;
  /** Perkiraan harga SATUAN (Rp) — bukan harga mati. */
  price: number;
};

// Item siap-pakai untuk mempercepat pengisian rincian biaya.
//
// Tiap item punya PERKIRAAN harga satuannya. Begitu dipilih, harganya langsung
// terisi supaya kamu tidak menebak dari nol tiap bikin invoice — dan tetap bisa
// diubah per proyek (client besar, proyek buru-buru, diskon, dsb.). Yang
// tersimpan di Firestore selalu harga yang benar-benar kamu pakai, bukan angka
// di bawah ini.
//
// ANGKA-ANGKA INI PERKIRAAN AWAL, silakan betulkan sesuai tarifmu sendiri —
// ini satu-satunya tempatnya, jangan ditulis ulang di layar mana pun.
export const INVOICE_PRESETS: InvoicePreset[] = [
  { desc: 'Jasa Pembuatan Website', price: 7_500_000 },
  { desc: 'Jasa Pembuatan Aplikasi', price: 25_000_000 },
  { desc: 'Maintenance (per bulan)', price: 500_000 },
  { desc: 'Administrasi (per bulan)', price: 300_000 },
  { desc: 'Pemasaran & SEO (per bulan)', price: 1_500_000 },
  { desc: 'Lisensi & Tema', price: 1_000_000 },
  { desc: 'Domain (.id / .com)', price: 250_000 },
  { desc: 'Hosting', price: 1_200_000 },
];

/**
 * Perkiraan harga satuan untuk sebuah deskripsi item — 0 kalau item itu
 * diketik sendiri (bukan dari daftar di atas). Dipakai layar untuk mengisi
 * harga awal & menulis ancar-ancar di placeholder.
 */
export function presetPrice(desc: string): number {
  const found = INVOICE_PRESETS.find(
    (p) => p.desc.toLowerCase() === desc.trim().toLowerCase(),
  );
  return found?.price ?? 0;
}

const ROMAN = [
  'I', 'II', 'III', 'IV', 'V', 'VI',
  'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
];

/** Nomor invoice gaya surat resmi: "042/VTI/VIII/2026" (stabil per proyek). */
function invoiceNumber(p: FreelanceProject, date: Date): string {
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
  const seq = String((Math.abs(h) % 900) + 100);
  return `${seq}/VTI/${ROMAN[date.getMonth()]}/${date.getFullYear()}`;
}

/** Susun HTML invoice (satu halaman A4, rapi & resmi). */
function buildInvoiceHtml(p: FreelanceProject, date: Date): string {
  const items: InvoiceItem[] = p.invoiceItems ?? [];
  const total = invoiceTotal(items);
  const rows =
    items
      .map(
        (it) => `
        <tr>
          <td class="desc">${escapeHtml(it.desc)}</td>
          <td class="num">${it.qty}</td>
          <td class="num">${formatRupiah(it.price)}</td>
          <td class="num">${formatRupiah(it.qty * it.price)}</td>
        </tr>`,
      )
      .join('') ||
    `<tr><td class="desc" colspan="4" style="text-align:center;color:#888">
       (Belum ada rincian biaya)
     </td></tr>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    color: #1d2b1d;
    margin: 0;
    padding: 40px 44px;
    font-size: 13px;
    line-height: 1.5;
  }
  .brand { text-align: center; }
  .brand h1 {
    color: #3d5a3d;
    font-size: 22px;
    margin: 0 0 6px;
    letter-spacing: 0.3px;
  }
  .brand p { color: #6b7a6b; font-size: 10.5px; margin: 0 auto; max-width: 90%; }
  .rule { border: none; border-top: 2px solid #3d5a3d; margin: 14px 0 22px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  .title { font-size: 26px; font-weight: 700; color: #3d5a3d; letter-spacing: 1px; }
  .meta { text-align: right; font-size: 12px; color: #333; }
  .meta b { color: #1d2b1d; }
  .to { margin: 20px 0 14px; }
  .to .label { color: #6b7a6b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .to .name { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .to .sub { color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead th {
    background: #3d5a3d; color: #fff; text-align: left;
    padding: 9px 10px; font-size: 11px; letter-spacing: 0.3px;
  }
  thead th.num { text-align: right; }
  tbody td { padding: 9px 10px; border-bottom: 1px solid #e3e8e3; vertical-align: top; }
  td.num { text-align: right; white-space: nowrap; }
  td.desc { width: 55%; }
  .total-row td {
    border-top: 2px solid #3d5a3d; border-bottom: none;
    font-weight: 700; font-size: 14px; padding-top: 12px;
  }
  .total-row .label { text-align: right; color: #3d5a3d; }
  .note { margin-top: 22px; color: #555; font-size: 12px; }
  .sign { margin-top: 40px; }
  .sign .greet { color: #333; }
  .sign .name { margin-top: 40px; font-weight: 700; border-top: 1px solid #1d2b1d; display: inline-block; padding-top: 3px; }
  .sign .co { color: #6b7a6b; font-size: 11px; }
  .foot { margin-top: 34px; text-align: center; color: #9aa89a; font-size: 10px; }
</style>
</head>
<body>
  <div class="brand">
    <h1>${escapeHtml(COMPANY_INFO.name)}</h1>
    <p>${escapeHtml(COMPANY_INFO.address)}<br/>Phone: ${escapeHtml(COMPANY_INFO.phone)}</p>
  </div>
  <hr class="rule" />

  <div class="top">
    <div class="title">INVOICE</div>
    <div class="meta">
      <div><b>No.</b> ${invoiceNumber(p, date)}</div>
      <div><b>Tanggal:</b> ${formatDate(date)}</div>
    </div>
  </div>

  <div class="to">
    <div class="label">Kepada</div>
    <div class="name">${escapeHtml(p.client || '-')}</div>
    ${p.name ? `<div class="sub">Perihal: ${escapeHtml(p.name)}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th>Deskripsi</th>
        <th class="num">Qty</th>
        <th class="num">Harga Satuan</th>
        <th class="num">Jumlah</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td class="label" colspan="3">TOTAL</td>
        <td class="num">${formatRupiah(total)}</td>
      </tr>
    </tbody>
  </table>

  <div class="note">
    Terima kasih atas kepercayaan Anda. Untuk pertanyaan lebih lanjut, silakan
    hubungi kami di ${escapeHtml(COMPANY_INFO.phone)}.
  </div>

  <div class="sign">
    <div class="greet">Hormat kami,</div>
    <div class="name">${escapeHtml(COMPANY_INFO.signer)}</div>
    <div class="co">${escapeHtml(COMPANY_INFO.name)}</div>
  </div>

  <div class="foot">${escapeHtml(COMPANY_INFO.name)} · ${escapeHtml(COMPANY_INFO.phone)}</div>
</body>
</html>`;
}

/**
 * Buat PDF invoice lalu buka share sheet (WhatsApp / Save to Files / dll).
 * Lempar error kalau gagal supaya pemanggil bisa menampilkan pesan.
 */
/**
 * Nama berkas invoice: "Victory Technology - 042-VTI-VIII-2026.pdf".
 *
 * Garis miring nomor invoice ("042/VTI/VIII/2026") diganti tanda hubung: `/`
 * tidak sah di nama berkas, dan kalau dibiarkan pdfFileName menggantinya jadi
 * SPASI sehingga nomornya terbaca seperti empat kata lepas.
 */
export function invoiceFileName(p: FreelanceProject, date: Date): string {
  const nomor = invoiceNumber(p, date).replace(/\//g, '-');
  return pdfFileName(`Victory Technology - ${nomor}`, 'Invoice');
}

export function shareInvoicePdf(p: FreelanceProject): Promise<void> {
  // SATU tanggal untuk isi PDF DAN nama berkasnya. Kalau `new Date()`
  // dipanggil dua kali, keduanya bisa jatuh di bulan berbeda tepat saat
  // pergantian bulan — nomor di dalam dokumen jadi tidak sama dengan nomor di
  // namanya, dan itu jenis kesalahan yang baru ketahuan setelah terkirim.
  const now = new Date();
  return sharePdf(
    buildInvoiceHtml(p, now),
    'Bagikan Invoice',
    invoiceFileName(p, now),
  );
}
