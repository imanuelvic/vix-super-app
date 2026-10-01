import { reportTitle, type FinanceReport, type ReportSection } from './financeReport';
import { formatCompactDateTime, formatShortRupiah } from './format';
import { escapeHtml, pdfFileName, pdfShellHtml, sharePdf } from './pdfDoc';
import { formatRupiah } from './transactions';

// 📊 PDF Laporan Keuangan — tabel berkolom bulan, siap dipresentasikan.
//
// Bentuknya sengaja seperti lembar kerja: kategori turun ke bawah, bulan
// melintang ke samping, total di ujung kanan. Satu halaman menjawab
// pertanyaan yang selama ini butuh membuka dua belas layar Monthly Review:
// "kategori mana yang jebol, dan bulan apa saja?".
//
// Kertasnya MENDATAR begitu bulannya lebih dari tiga — dua belas kolom angka
// di kertas tegak jadi terlalu sempit untuk dibaca, apalagi ditunjukkan ke
// orang lain.
//
// Angkanya tidak dihitung di sini sama sekali; itu urusan lib/financeReport.ts
// yang murni & teruji. Berkas ini cuma merangkainya jadi HTML.

/** Nominal di dalam sel: singkat supaya dua belas kolom tetap muat. */
function sel(n: number): string {
  return n === 0 ? '·' : formatShortRupiah(n);
}

function barisHtml(
  label: string,
  perMonth: number[],
  total: number,
  kelas = '',
): string {
  const kolom = perMonth
    .map((v) => `<td class="${v === 0 ? 'nol' : ''}">${escapeHtml(sel(v))}</td>`)
    .join('');
  return `<tr class="${kelas}">
    <th scope="row">${escapeHtml(label)}</th>
    ${kolom}
    <td class="total">${escapeHtml(sel(total))}</td>
  </tr>`;
}

function bagianHtml(s: ReportSection, jumlahBulan: number): string {
  if (s.rows.length === 0) {
    return `<tr class="judul"><th scope="row">${escapeHtml(s.label)}</th>
      <td class="kosong" colspan="${jumlahBulan + 1}">belum ada catatan di rentang ini</td></tr>`;
  }
  return [
    `<tr class="judul"><th scope="row" colspan="${jumlahBulan + 2}">${escapeHtml(s.label)}</th></tr>`,
    ...s.rows.map((r) => barisHtml(r.label, r.perMonth, r.total)),
    barisHtml('Subtotal', s.totalPerMonth, s.total, 'subtotal'),
  ].join('');
}

const CSS = `
  .tabel { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 10.5px; }
  .tabel th, .tabel td { padding: 5px 6px; text-align: right; white-space: nowrap; }
  /* Nama kategori rata kiri & boleh melebar; angkanya yang harus rapat. */
  .tabel th[scope="row"] { text-align: left; white-space: normal; width: 1%; }
  .tabel thead th {
    background: #0C5C50; color: #fff; font-size: 9.5px;
    letter-spacing: 0.4px; text-transform: uppercase;
  }
  .tabel thead th:first-child { text-align: left; border-top-left-radius: 8px; }
  .tabel thead th:last-child { border-top-right-radius: 8px; }
  .tabel tbody tr { border-bottom: 1px solid #EFE7DA; }
  /* Judul bagian (Income / Expense / …): baris pemisah yang jelas. */
  .tabel tr.judul th {
    background: #F4EEE3; color: #0C5C50; font-size: 10px;
    letter-spacing: 0.6px; text-transform: uppercase; padding-top: 9px;
  }
  .tabel tr.subtotal { font-weight: 700; background: #FAF6EE; }
  .tabel tr.bersih th, .tabel tr.bersih td {
    background: #0C5C50; color: #fff; font-weight: 700; font-size: 11px;
  }
  .tabel td.total { font-weight: 700; border-left: 1px solid #EFE7DA; }
  .tabel td.nol { color: #C3BDB2; }
  .tabel td.kosong { text-align: left; color: #9AA79F; font-style: italic; }

  .ringkas { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .ringkas div {
    border: 1px solid #EBDCC5; border-radius: 12px; padding: 10px 14px; min-width: 150px;
  }
  .ringkas span {
    display: block; color: #9AA79F; font-size: 9px;
    letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px;
  }
  .ringkas b { font-size: 15px; color: #10221C; }
  .ringkas b.minus { color: #B3261E; }

  .catatan { margin-top: 16px; font-size: 10px; color: #9AA79F; line-height: 1.6; }
`;

/** Satu angka ringkasan di atas tabel. */
function ringkasSel(label: string, nilai: number, merahKalauMinus = false): string {
  const minus = merahKalauMinus && nilai < 0;
  return `<div><span>${escapeHtml(label)}</span><b class="${minus ? 'minus' : ''}">${escapeHtml(
    formatRupiah(nilai),
  )}</b></div>`;
}

export function financeReportHtml(laporan: FinanceReport, dibuat: Date): string {
  const { months, sections } = laporan;
  const judulKolom = months
    .map((m) => `<th scope="col">${escapeHtml(m.label)}</th>`)
    .join('');

  const totalOf = (t: string) => sections.find((s) => s.type === t)!.total;

  const tabel = `<table class="tabel">
    <thead>
      <tr>
        <th scope="col">Kategori</th>
        ${judulKolom}
        <th scope="col">Total</th>
      </tr>
    </thead>
    <tbody>
      ${sections.map((s) => bagianHtml(s, months.length)).join('')}
      ${barisHtml('Sisa bersih', laporan.netPerMonth, laporan.netTotal, 'bersih')}
    </tbody>
  </table>`;

  const ringkas = `<div class="ringkas">
    ${ringkasSel('Total income', totalOf('income'))}
    ${ringkasSel('Total expense', totalOf('expense'))}
    ${ringkasSel('Total saving', totalOf('saving'))}
    ${ringkasSel('Total investment', totalOf('investment'))}
    ${ringkasSel('Sisa bersih', laporan.netTotal, true)}
  </div>`;

  const catatan = `<p class="catatan">
    "Sisa bersih" = income dikurangi expense, saving, dan investment. Angka
    bertanda titik berarti tidak ada catatan di bulan itu. Kategori yang nol di
    seluruh rentang tidak ditampilkan. Nominal dibulatkan untuk dibaca; angka
    persisnya ada di aplikasi.
  </p>`;

  return pdfShellHtml({
    eyebrow: 'Laporan Keuangan',
    title: reportTitle(months),
    subtitle: `${months.length} bulan · ${laporan.txCount} transaksi`,
    chips: [
      { label: 'Rentang', value: reportTitle(months) },
      { label: 'Dibuat', value: formatCompactDateTime(dibuat) },
    ],
    bodyHtml: ringkas + tabel + catatan,
    footerNote: 'Laporan ini dibuat otomatis dari catatan Finance di aplikasi vix.',
    extraCss: CSS,
  });
}

/**
 * Cetak & bagikan laporannya. Kertas MENDATAR begitu bulannya lebih dari tiga
 * (lihat alasannya di kepala berkas ini).
 */
export async function shareFinanceReport(
  laporan: FinanceReport,
  dibuat: Date,
): Promise<void> {
  const judul = reportTitle(laporan.months);
  await sharePdf(
    financeReportHtml(laporan, dibuat),
    'Bagikan Laporan Keuangan',
    pdfFileName(`Laporan Keuangan - ${judul}`, 'Laporan Keuangan'),
    laporan.months.length > 3,
  );
}
