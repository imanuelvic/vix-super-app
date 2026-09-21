import { heartColor, meetingKindMeta, type CoreLeader, type Visitation } from './core';
import { leaderRecap, type LeaderRecap } from './coreCalendar';
import { formatFullDate, formatFullDateTime, monthShort } from './format';
import {
  escapeHtml,
  lastSharedLabel,
  pdfFileName,
  pdfShellHtml,
  sharePdf,
} from './pdfDoc';

// PDF Rekap Visitasi 📊 untuk SATU CORE — dikirim ke CL-nya sendiri lewat
// sheet "Bagikan ke CORE Leader". Isinya rekap tahun itu dari sudut pandang
// CORE-nya: tiap jenis pertemuan berapa kali & tanggal-tanggalnya, tanggal
// Thanksgiving, total, dan jadwal yang masih menunggu.
//
// Kopnya memakai WARNA HATI CORE itu (heartColor), bukan hijau tua kop
// bersama: PDF ini mewakili CORE 💜 Novia, bukan MCL-nya. Hitungannya di
// lib/coreCalendar.ts (leaderRecap), jadi bisa diuji tanpa expo-print.

/** "12 Feb" — tanggal pendek untuk deretan di satu baris. */
function tanggalPendek(d: Date): string {
  return `${d.getDate()} ${monthShort(d)}`;
}

function barisJenis(r: LeaderRecap['rows'][number]): string {
  const meta = meetingKindMeta(r.kind);
  const n = r.dates.length;
  return `<div class="baris${n === 0 ? ' kosong' : ''}">
    <span class="label">${escapeHtml(`${meta.icon} ${meta.label}`)}</span>
    <span class="jumlah">${n > 0 ? `${n}×` : '·'}</span>
    <span class="tanggal">${
      n > 0 ? escapeHtml(r.dates.map(tanggalPendek).join(' · ')) : 'belum ada'
    }</span>
  </div>`;
}

function jadwalHtml(r: LeaderRecap): string {
  if (r.upcoming.length === 0) return '';
  const isi = r.upcoming
    .map((u) => {
      const meta = meetingKindMeta(u.kind);
      return `<div class="jadwal">
      <span class="jadwal-ikon">${meta.icon}</span>
      <span><b>${escapeHtml(meta.label)}</b><br/>${escapeHtml(formatFullDate(u.date))}</span>
    </div>`;
    })
    .join('');
  return `<h2>📅 Jadwal yang masih menunggu</h2>${isi}`;
}

const EXTRA_CSS = `
  h2 {
    font-size: 15px; margin: 26px 0 12px; color: #10221C;
    border-bottom: 2px solid #EBDCC5; padding-bottom: 6px;
  }
  p { margin: 0 0 8px; }

  /* Tabel rekap: jenis · berapa kali · tanggal-tanggalnya */
  .tabel {
    border: 1px solid #EBDCC5; border-radius: 14px; padding: 4px 15px;
    page-break-inside: avoid; -webkit-column-break-inside: avoid;
  }
  .baris {
    display: flex; align-items: baseline; gap: 12px;
    padding: 9px 0; border-bottom: 1px solid #F1E7D6;
  }
  .baris:last-child { border-bottom: none; }
  .label { flex: 0 0 168px; color: #10221C; }
  .jumlah { flex: 0 0 34px; font-weight: 700; color: #10221C; text-align: right; }
  .tanggal { flex: 1; color: #3F4F48; font-size: 12px; }
  .baris.kosong .label, .baris.kosong .jumlah, .baris.kosong .tanggal { color: #B4BDB8; }
  .baris.total { border-top: 1.5px solid #10221C; }
  .baris.total .label, .baris.total .jumlah { font-weight: 700; }

  /* Jadwal menunggu: kartu kecil per jadwal */
  .jadwal {
    display: flex; gap: 11px; align-items: flex-start;
    border: 1px solid #EBDCC5; border-radius: 14px;
    padding: 11px 14px; margin-bottom: 8px;
    page-break-inside: avoid; -webkit-column-break-inside: avoid;
  }
  .jadwal-ikon { flex: none; font-size: 18px; line-height: 1.3; }
  .jadwal b { color: #10221C; font-size: 12.5px; }
  .penutup { color: #6E7B74; font-size: 11px; margin-top: 12px; font-style: italic; }
`;

/**
 * Cetak rekap visitasi satu tahun untuk CORE `leader` jadi PDF, lalu buka
 * share sheet. `lastShared` = kapan rekap ini terakhir dikirim padanya (ikut
 * dicetak di kop). Melempar error kalau gagal supaya sheet-nya bisa
 * menampilkan pesan.
 */
export async function shareRecapPdf(
  leader: CoreLeader,
  visitations: Visitation[],
  year: number,
  lastShared: Date | null,
  now: Date = new Date(),
): Promise<void> {
  const r = leaderRecap(visitations, leader.id, year, leader.thanksgivingDayId ?? null);
  const judul = `Rekap Visitasi ${leader.heart} ${leader.name}`;

  const bodyHtml = `
    <h2>📊 Pertemuan sepanjang ${year}</h2>
    <div class="tabel">
      ${r.rows.map(barisJenis).join('')}
      <div class="baris${r.thanksgiving ? '' : ' kosong'}">
        <span class="label">🎉 Tanggal Thanksgiving</span>
        <span class="jumlah">${r.thanksgiving ? '1×' : '·'}</span>
        <span class="tanggal">${
          r.thanksgiving ? escapeHtml(formatFullDate(r.thanksgiving)) : 'belum ada'
        }</span>
      </div>
      <div class="baris total">
        <span class="label">Total</span>
        <span class="jumlah">${r.total}×</span>
        <span class="tanggal">pertemuan selesai di ${year}</span>
      </div>
    </div>
    ${jadwalHtml(r)}
    <p class="penutup">Terima kasih ${escapeHtml(leader.name)} & CORE ${leader.heart}, sudah setia bertumbuh bareng sepanjang ${year} 🙏</p>
  `;

  const html = pdfShellHtml({
    eyebrow: `REKAP VISITASI ${year}`,
    title: judul,
    subtitle: `Pertemuan MCL bersama CORE ${leader.heart} ${leader.name} sepanjang ${year}.`,
    chips: [
      { label: 'Tahun', value: String(year) },
      { label: 'Pertemuan selesai', value: `${r.total}×` },
      {
        label: 'Thanksgiving',
        value: r.thanksgiving ? tanggalPendek(r.thanksgiving) : '',
      },
      { label: 'Terakhir dibagikan', value: lastSharedLabel(lastShared) },
      { label: 'Dicetak', value: formatFullDateTime(now) },
    ],
    bodyHtml,
    footerNote: `${judul} ${year} · dicetak ${formatFullDateTime(now)}`,
    extraCss: EXTRA_CSS,
    accent: heartColor(leader.heart),
  });

  await sharePdf(
    html,
    `Kirim ke WhatsApp ${leader.heart} ${leader.name}`,
    pdfFileName(`Rekap Visitasi ${year} - ${leader.name}`, 'Rekap Visitasi'),
  );
}
