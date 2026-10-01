import type { ReviewLine, ReviewTotal, ReviewYear } from './financeReview';
import { formatCompactDateTime, formatShortRupiah, MONTH_NAMES } from './format';
import { escapeHtml, pdfFileName, pdfShellHtml, sharePdf } from './pdfDoc';
import { formatRupiah } from './transactions';

// 📋 PDF Financial Review — satu tahun penuh di kertas MENDATAR.
//
// Bentuknya sengaja persis seperti lembar kerja yang sudah dibaca pemilik app
// sejak 2015: bulan melintang ke samping, barisnya turun ke bawah, AVERAGE &
// TOTAL di ujung kanan. Di layar HP bentuk itu tidak terbaca (lihat
// ReviewTab.tsx, di sana bulannya justru turun ke bawah), tapi di kertas
// mendatar ia justru bentuk yang paling enak dibandingkan antar bulan.
//
// Yang di layar diringkas jadi tiga kolom, di sini dibuka lengkap: pengeluaran,
// tabungan, dan investasi berdiri sendiri-sendiri, karena kertasnya memang
// punya ruang untuk itu.
//
// Angkanya tidak dihitung di sini sama sekali; itu urusan lib/financeReview.ts
// yang murni & dicocokkan suite dengan TOTAL di lembar aslinya.

/** Nominal di dalam sel: singkat supaya dua belas kolom tetap muat. */
function sel(n: number | null): string {
  return n === null ? '·' : formatShortRupiah(n);
}

function barisHtml(
  label: string,
  nilai: (number | null)[],
  ringkas: ReviewLine,
  kelas = '',
): string {
  const kolom = nilai
    .map((v) => `<td class="${v === null ? 'nol' : ''}">${escapeHtml(sel(v))}</td>`)
    .join('');
  return `<tr class="${kelas}">
    <th scope="row">${escapeHtml(label)}</th>
    ${kolom}
    <td class="rata">${escapeHtml(sel(ringkas.average))}</td>
    <td class="total">${escapeHtml(sel(ringkas.total))}</td>
  </tr>`;
}

const CSS = `
  .tabel { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 10.5px; }
  .tabel th, .tabel td { padding: 5px 6px; text-align: right; white-space: nowrap; }
  .tabel th[scope="row"] { text-align: left; white-space: normal; width: 1%; }
  .tabel thead th {
    background: #0C5C50; color: #fff; font-size: 9.5px;
    letter-spacing: 0.4px; text-transform: uppercase;
  }
  .tabel thead th:first-child { text-align: left; border-top-left-radius: 8px; }
  .tabel thead th:last-child { border-top-right-radius: 8px; }
  .tabel tbody tr { border-bottom: 1px solid #EFE7DA; }
  .tabel tr.keluar { font-weight: 700; background: #FAF6EE; }
  .tabel tr.sisa th, .tabel tr.sisa td {
    background: #0C5C50; color: #fff; font-weight: 700; font-size: 11px;
  }
  .tabel td.rata { font-weight: 700; border-left: 1px solid #EFE7DA; }
  .tabel td.total { font-weight: 700; }
  .tabel td.nol { color: #C3BDB2; }

  /* Tabel kedua: sebelas tahun dalam satu pandangan. */
  .tahun { width: 100%; border-collapse: collapse; margin-top: 22px; font-size: 10.5px; }
  .tahun th, .tahun td { padding: 5px 8px; text-align: right; white-space: nowrap; }
  .tahun th[scope="row"] { text-align: left; }
  .tahun thead th {
    background: #F4EEE3; color: #0C5C50; font-size: 9.5px;
    letter-spacing: 0.6px; text-transform: uppercase;
  }
  .tahun thead th:first-child { text-align: left; }
  .tahun tbody tr { border-bottom: 1px solid #EFE7DA; }
  .tahun tr.ini { background: #FAF6EE; font-weight: 700; }
  .tahun td.minus { color: #B3261E; }

  .judul2 {
    margin: 22px 0 0; font-size: 11px; letter-spacing: 1px;
    text-transform: uppercase; color: #9AA79F;
  }

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

  /* Tanggal dibagikan, DI BAWAH laporannya. Sengaja berjarak & bergaris atas:
     ia bukan bagian dari angka, ia keterangan kapan angka itu diambil. */
  .dibagikan {
    margin-top: 20px; padding-top: 12px; border-top: 1px solid #EBDCC5;
    font-size: 10.5px; color: #10221C;
  }
  .dibagikan span { color: #9AA79F; }
`;

/** Satu angka ringkasan di atas tabel. */
function ringkasSel(label: string, nilai: number, merahKalauMinus = false): string {
  const minus = merahKalauMinus && nilai < 0;
  return `<div><span>${escapeHtml(label)}</span><b class="${minus ? 'minus' : ''}">${escapeHtml(
    formatRupiah(nilai),
  )}</b></div>`;
}

export function financeReviewHtml(
  tahun: ReviewYear,
  semua: ReviewTotal[],
  dibuat: Date,
): string {
  const judulKolom = MONTH_NAMES.map(
    (m) => `<th scope="col">${escapeHtml(m.slice(0, 3))}</th>`,
  ).join('');

  const tabel = `<table class="tabel">
    <thead>
      <tr>
        <th scope="col">${escapeHtml(String(tahun.year))}</th>
        ${judulKolom}
        <th scope="col">Rata-rata</th>
        <th scope="col">Total</th>
      </tr>
    </thead>
    <tbody>
      ${barisHtml('Masuk', tahun.months.map((m) => m.income), tahun.income)}
      ${barisHtml('Pengeluaran', tahun.months.map((m) => m.expense), tahun.expense)}
      ${barisHtml('Tabungan', tahun.months.map((m) => m.saving), tahun.saving)}
      ${barisHtml('Investasi', tahun.months.map((m) => m.investment), tahun.investment)}
      ${barisHtml('Keluar', tahun.months.map((m) => m.outflow), tahun.outflow, 'keluar')}
      ${barisHtml('Sisa', tahun.months.map((m) => m.balance), tahun.balance, 'sisa')}
    </tbody>
  </table>`;

  const barisTahun = semua
    .map(
      (t) => `<tr class="${t.year === tahun.year ? 'ini' : ''}">
        <th scope="row">${escapeHtml(String(t.year))}</th>
        <td>${escapeHtml(sel(t.income))}</td>
        <td>${escapeHtml(sel(t.outflow))}</td>
        <td class="${t.balance < 0 ? 'minus' : ''}">${escapeHtml(sel(t.balance))}</td>
      </tr>`,
    )
    .join('');

  const tabelTahun = `<p class="judul2">Semua Tahun</p>
  <table class="tahun">
    <thead>
      <tr>
        <th scope="col">Tahun</th>
        <th scope="col">Masuk</th>
        <th scope="col">Keluar</th>
        <th scope="col">Sisa</th>
      </tr>
    </thead>
    <tbody>${barisTahun}</tbody>
  </table>`;

  const ringkas = `<div class="ringkas">
    ${ringkasSel('Masuk setahun', tahun.income.total)}
    ${ringkasSel('Keluar setahun', tahun.outflow.total)}
    ${ringkasSel('Sisa setahun', tahun.balance.total, true)}
    ${ringkasSel('Rata-rata sisa', tahun.balance.average, true)}
  </div>`;

  const catatan = `<p class="catatan">
    "Keluar" = pengeluaran ditambah tabungan dan investasi. "Sisa" = masuk
    dikurangi keluar. Angka bertanda titik berarti bulan itu memang tidak
    pernah dicatat, bukan nol. Rata-rata dibagi dengan jumlah bulan yang
    terisi, bukan dengan dua belas. Nominal dibulatkan untuk dibaca; angka
    persisnya ada di aplikasi.
  </p>`;

  const dibagikan = `<p class="dibagikan">
    <span>Dibagikan</span> ${escapeHtml(formatCompactDateTime(dibuat))}
  </p>`;

  return pdfShellHtml({
    eyebrow: 'Financial Review',
    title: `Financial Review ${tahun.year}`,
    subtitle: `${tahun.income.months} bulan tercatat pemasukan · ${tahun.outflow.months} bulan tercatat pengeluaran`,
    chips: [
      { label: 'Tahun', value: String(tahun.year) },
      { label: 'Dibuat', value: formatCompactDateTime(dibuat) },
    ],
    bodyHtml: ringkas + tabel + tabelTahun + catatan + dibagikan,
    footerNote:
      'Rekap ini disusun dari catatan keuangan sejak 2015 dan dari transaksi Finance di aplikasi vix.',
    extraCss: CSS,
  });
}

/** Cetak & bagikan rekapnya. Selalu MENDATAR: dua belas kolom bulan. */
export async function shareFinanceReview(
  tahun: ReviewYear,
  semua: ReviewTotal[],
  dibuat: Date,
): Promise<void> {
  await sharePdf(
    financeReviewHtml(tahun, semua, dibuat),
    'Bagikan Financial Review',
    pdfFileName(`Financial Review ${tahun.year}`, 'Financial Review'),
    true,
  );
}
