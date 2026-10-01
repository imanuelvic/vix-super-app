import { recapGap, type BudgetRecap, type RecapRow } from './budgetRecap';
import { FINANCE_TYPE_LABEL } from './categories';
import { formatCompactDateTime, formatShortRupiah, MONTH_NAMES } from './format';
import { escapeHtml, pdfFileName, pdfShellHtml, sharePdf } from './pdfDoc';
import { formatRupiah } from './transactions';

// 📊 PDF Rekap Budgeting — rencana & kenyataan berdampingan.
//
// Dua bentuk, satu berkas:
//   • SETAHUN  dua tabel berkolom bulan (budget lalu realisasi) plus baris
//              selisihnya, supaya kelihatan bulan mana yang jebol.
//   • SEBULAN  satu tabel per kategori: budget, realisasi, selisih, persen.
//
// Keduanya di kertas MENDATAR. Yang sebulan sebenarnya muat di kertas tegak,
// tapi dibuat sama supaya dua berkas yang dibagikan berturut-turut tidak
// berganti orientasi di tengah jalan.
//
// Angkanya tidak dihitung di sini sama sekali; itu urusan lib/budgetRecap.ts
// yang murni & dijalankan suite.

/** Nominal di dalam sel: singkat supaya dua belas kolom tetap muat. */
function sel(n: number): string {
  return n === 0 ? '·' : formatShortRupiah(n);
}

function barisHtml(r: RecapRow, kelas = ''): string {
  const kolom = r.perMonth
    .map((v) => `<td class="${v === 0 ? 'nol' : ''}">${escapeHtml(sel(v))}</td>`)
    .join('');
  return `<tr class="${kelas}">
    <th scope="row">${escapeHtml(r.label)}</th>
    ${kolom}
    <td class="rata">${escapeHtml(sel(r.average))}</td>
    <td class="total">${escapeHtml(sel(r.total))}</td>
  </tr>`;
}

function tabelTahun(rekap: BudgetRecap, judul: string, selisih?: number[]): string {
  const kolomBulan = MONTH_NAMES.map(
    (m) => `<th scope="col">${escapeHtml(m.slice(0, 3))}</th>`,
  ).join('');

  const total: RecapRow = {
    key: '__total',
    label: 'TOTAL',
    perMonth: rekap.totalPerMonth,
    total: rekap.total,
    average: rekap.average,
    months: 0,
  };

  const barisSelisih = selisih
    ? barisHtml(
        {
          key: '__gap',
          label: 'Selisih',
          perMonth: selisih,
          total: selisih.reduce((a, b) => a + b, 0),
          average: 0,
          months: 0,
        },
        'selisih',
      )
    : '';

  return `<p class="judul2">${escapeHtml(judul)}</p>
  <table class="tabel">
    <thead>
      <tr>
        <th scope="col">Kategori</th>
        ${kolomBulan}
        <th scope="col">Rata-rata</th>
        <th scope="col">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rekap.rows.map((r) => barisHtml(r)).join('')}
      ${barisHtml(total, 'jumlah')}
      ${barisSelisih}
    </tbody>
  </table>`;
}

function tabelBulan(
  budget: BudgetRecap,
  realisasi: BudgetRecap,
  bulan: number,
): string {
  const kunci = [
    ...new Set([
      ...budget.rows.map((r) => r.key),
      ...realisasi.rows.map((r) => r.key),
    ]),
  ];
  const nilai = (rekap: BudgetRecap, key: string) =>
    rekap.rows.find((r) => r.key === key)?.perMonth[bulan] ?? 0;
  const nama = (key: string) =>
    (budget.rows.find((r) => r.key === key) ??
      realisasi.rows.find((r) => r.key === key))!.label;

  let totalB = 0;
  let totalR = 0;
  const baris = kunci
    .map((key) => {
      const b = nilai(budget, key);
      const r = nilai(realisasi, key);
      if (b === 0 && r === 0) return '';
      totalB += b;
      totalR += r;
      const beda = r - b;
      const persen = b > 0 ? `${Math.round((r / b) * 100)}%` : '·';
      return `<tr>
        <th scope="row">${escapeHtml(nama(key))}</th>
        <td>${escapeHtml(sel(b))}</td>
        <td>${escapeHtml(sel(r))}</td>
        <td class="${beda > 0 ? 'lebih' : ''}">${escapeHtml(beda === 0 ? '·' : formatShortRupiah(beda))}</td>
        <td>${escapeHtml(persen)}</td>
      </tr>`;
    })
    .join('');

  const bedaTotal = totalR - totalB;
  return `<table class="tabel bulan">
    <thead>
      <tr>
        <th scope="col">Kategori</th>
        <th scope="col">Budget</th>
        <th scope="col">Realisasi</th>
        <th scope="col">Selisih</th>
        <th scope="col">Terpakai</th>
      </tr>
    </thead>
    <tbody>
      ${baris}
      <tr class="jumlah">
        <th scope="row">TOTAL</th>
        <td>${escapeHtml(sel(totalB))}</td>
        <td>${escapeHtml(sel(totalR))}</td>
        <td class="${bedaTotal > 0 ? 'lebih' : ''}">${escapeHtml(bedaTotal === 0 ? '·' : formatShortRupiah(bedaTotal))}</td>
        <td>${escapeHtml(totalB > 0 ? `${Math.round((totalR / totalB) * 100)}%` : '·')}</td>
      </tr>
    </tbody>
  </table>`;
}

const CSS = `
  .tabel { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10.5px; }
  .tabel th, .tabel td { padding: 5px 6px; text-align: right; white-space: nowrap; }
  .tabel th[scope="row"] { text-align: left; white-space: normal; width: 1%; }
  .tabel thead th {
    background: #0C5C50; color: #fff; font-size: 9.5px;
    letter-spacing: 0.4px; text-transform: uppercase;
  }
  .tabel thead th:first-child { text-align: left; border-top-left-radius: 8px; }
  .tabel thead th:last-child { border-top-right-radius: 8px; }
  .tabel tbody tr { border-bottom: 1px solid #EFE7DA; }
  .tabel tr.jumlah { font-weight: 700; background: #FAF6EE; }
  .tabel tr.selisih th, .tabel tr.selisih td {
    background: #0C5C50; color: #fff; font-weight: 700;
  }
  .tabel td.rata { font-weight: 700; border-left: 1px solid #EFE7DA; }
  .tabel td.total { font-weight: 700; }
  .tabel td.nol { color: #C3BDB2; }
  .tabel td.lebih { color: #B3261E; font-weight: 700; }
  .tabel.bulan th, .tabel.bulan td { padding: 6px 10px; font-size: 11.5px; }

  .judul2 {
    margin: 20px 0 0; font-size: 11px; letter-spacing: 1px;
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
  .dibagikan {
    margin-top: 20px; padding-top: 12px; border-top: 1px solid #EBDCC5;
    font-size: 10.5px; color: #10221C;
  }
  .dibagikan span { color: #9AA79F; }
`;

function ringkasSel(label: string, nilai: number, merahKalauMinus = false): string {
  const minus = merahKalauMinus && nilai < 0;
  return `<div><span>${escapeHtml(label)}</span><b class="${minus ? 'minus' : ''}">${escapeHtml(
    formatRupiah(nilai),
  )}</b></div>`;
}

/** `bulan` null = setahun penuh; 0..11 = satu bulan saja. */
export function budgetRecapHtml(
  budget: BudgetRecap,
  realisasi: BudgetRecap,
  bulan: number | null,
  dibuat: Date,
): string {
  const jenis = FINANCE_TYPE_LABEL[budget.type];
  const rentang =
    bulan === null
      ? `${budget.year}`
      : `${MONTH_NAMES[bulan]} ${budget.year}`;

  const totalB = bulan === null ? budget.total : budget.totalPerMonth[bulan];
  const totalR =
    bulan === null ? realisasi.total : realisasi.totalPerMonth[bulan];

  const isi =
    bulan === null
      ? tabelTahun(budget, 'Rencana (budget)') +
        tabelTahun(realisasi, 'Kenyataan (realisasi)', recapGap(budget, realisasi))
      : tabelBulan(budget, realisasi, bulan);

  const ringkas = `<div class="ringkas">
    ${ringkasSel('Budget', totalB)}
    ${ringkasSel('Realisasi', totalR)}
    ${ringkasSel('Selisih', totalR - totalB, true)}
  </div>`;

  const catatan = `<p class="catatan">
    "Selisih" = realisasi dikurangi budget, jadi angka merah berarti terpakai
    lebih banyak daripada yang direncanakan. Angka bertanda titik berarti nol.
    Sub-budget tidak dihitung terpisah; nominalnya sudah termasuk di budget
    kategorinya. Nominal dibulatkan untuk dibaca; angka persisnya ada di
    aplikasi.
  </p>`;

  const dibagikan = `<p class="dibagikan">
    <span>Dibagikan</span> ${escapeHtml(formatCompactDateTime(dibuat))}
  </p>`;

  return pdfShellHtml({
    eyebrow: 'Rekap Budgeting',
    title: `Budgeting ${jenis} ${rentang}`,
    subtitle: 'Rencana & kenyataan berdampingan',
    chips: [
      { label: 'Rentang', value: rentang },
      { label: 'Jenis', value: jenis },
      { label: 'Dibuat', value: formatCompactDateTime(dibuat) },
    ],
    bodyHtml: ringkas + isi + catatan + dibagikan,
    footerNote: 'Rekap ini dibuat otomatis dari budget & transaksi Finance di aplikasi vix.',
    extraCss: CSS,
  });
}

export async function shareBudgetRecap(
  budget: BudgetRecap,
  realisasi: BudgetRecap,
  bulan: number | null,
  dibuat: Date,
): Promise<void> {
  const rentang =
    bulan === null ? `${budget.year}` : `${MONTH_NAMES[bulan]} ${budget.year}`;
  await sharePdf(
    budgetRecapHtml(budget, realisasi, bulan, dibuat),
    'Bagikan Rekap Budgeting',
    pdfFileName(`Rekap Budgeting - ${rentang}`, 'Rekap Budgeting'),
    true,
  );
}
