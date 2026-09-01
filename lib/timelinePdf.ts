import { escapeHtml, pdfFileName, pdfShellHtml, sharePdf } from './pdfDoc';
import { formatFullDateTime, MONTH_NAMES } from './format';
import {
  timelineGroups,
  timelineTotals,
  TIMELINE_CATEGORY_META,
  type TimelineItem,
  type TimelineYear,
} from './timeline';

// PDF My Timeline 📍 — SELURUH wishlist yang pernah dicatat, dari tahun paling
// awal sampai yang paling jauh ke depan, digambar sebagai GARIS WAKTU: satu
// garis tegak dengan bulatan di tiap tonggaknya.
//
// Kenapa bukan daftar kartu seperti di layar: kartu bagus untuk MENGERJAKAN
// (satu bulan, satu tahun, sambil dicentang), tapi yang dibagikan ke orang
// lain bukan daftar tugas — melainkan cerita arah hidup. Garis waktu
// menunjukkan urutan & jarak antar tonggak sekaligus; daftar kartu tidak.
//
// Dipakai untuk timeline sendiri MAUPUN timeline tiap CORE Leader — yang
// berbeda hanya judulnya, persis seperti PDF Wheel of Life.

/** Warna garis & bulatannya — senada dengan tema Timeline di layar. */
const GARIS = '#DCC9AE';
const TITIK = '#0C5C50';
const TITIK_LEWAT = '#B9C6BF';

/** Tonggak ini sudah lewat? Bulan kosong (target tahunan) ikut tahunnya. */
function sudahLewat(year: number, month: number | null, now: Date): boolean {
  if (year !== now.getFullYear()) return year < now.getFullYear();
  return month !== null && month < now.getMonth();
}

function itemHtml(item: TimelineItem): string {
  const meta = TIMELINE_CATEGORY_META[item.category];
  const ikon = meta?.icon ?? '📍';
  const nama = meta?.label ?? '';
  return `<div class="wish${item.done ? ' beres' : ''}">
    <span class="tanda">${item.done ? '✅' : '⬜'}</span>
    <span class="isi">${ikon} ${escapeHtml(item.title)}
      ${nama ? `<em>${escapeHtml(nama)}</em>` : ''}</span>
  </div>`;
}

/** Satu baris garis waktu: kapan · bulatan · isinya. */
function barisHtml(
  kapan: string,
  tahun: string,
  isiHtml: string,
  lewat: boolean,
  terakhir: boolean,
): string {
  return `<div class="baris${lewat ? ' lewat' : ''}">
    <div class="kapan">${escapeHtml(kapan)}<small>${escapeHtml(tahun)}</small></div>
    <div class="rel">
      <i class="garis${terakhir ? ' habis' : ''}"></i>
      <span class="titik"></span>
    </div>
    <div class="isi-baris">${isiHtml}</div>
  </div>`;
}

function tahunHtml(t: TimelineYear, now: Date, terakhirSekali: boolean): string {
  const kelompok = timelineGroups(t.items);
  const beres = t.items.filter((i) => i.done).length;

  const kepala = `<div class="baris tahun">
    <div class="kapan"><b>${t.year}</b></div>
    <div class="rel"><i class="garis"></i><span class="titik besar"></span></div>
    <div class="isi-baris">
      <div class="tahun-judul">${t.year}</div>
      <div class="tahun-meta">${t.items.length} wishlist · ${beres} tercapai</div>
    </div>
  </div>`;

  const isi = kelompok
    .map((g, i) =>
      barisHtml(
        g.month === null ? '🎯 Tahunan' : MONTH_NAMES[g.month],
        String(t.year),
        g.items.map(itemHtml).join(''),
        sudahLewat(t.year, g.month, now),
        terakhirSekali && i === kelompok.length - 1,
      ),
    )
    .join('');

  return kepala + isi;
}

const EXTRA_CSS = `
  /* ===== Garis waktu ===== */
  .baris {
    display: flex; align-items: stretch;
    page-break-inside: avoid; -webkit-column-break-inside: avoid;
  }
  /* Kolom kiri: kapan tonggak ini. Rata kanan supaya menempel ke garisnya. */
  .kapan {
    width: 74px; flex: none; text-align: right; padding: 1px 12px 0 0;
    font-size: 10.5px; font-weight: 700; color: #8A6B3E; line-height: 1.35;
  }
  .kapan small { display: block; font-weight: 400; color: #9AA79F; font-size: 9.5px; }
  .kapan b { font-size: 13px; color: ${TITIK}; }

  /* Kolom tengah: garisnya sendiri + bulatan tonggaknya. */
  .rel { width: 18px; flex: none; position: relative; }
  .garis {
    position: absolute; left: 8px; top: 0; bottom: 0; width: 2px;
    background: ${GARIS}; display: block;
  }
  /* Baris paling akhir: garisnya berhenti di bulatan, tidak menggantung. */
  .garis.habis { bottom: auto; height: 10px; }
  .titik {
    position: absolute; left: 3px; top: 3px; width: 12px; height: 12px;
    border-radius: 50%; background: ${TITIK};
    border: 2px solid #FFF8F0; box-sizing: border-box;
  }
  .titik.besar {
    left: 0; top: 0; width: 18px; height: 18px; border-width: 3px;
  }
  /* Yang sudah berlalu tetap dicetak — cuma warnanya lebih tenang. */
  .lewat .titik { background: ${TITIK_LEWAT}; }
  .lewat .isi-baris { opacity: 0.72; }

  /* Kolom kanan: isinya. */
  .isi-baris { flex: 1; padding: 0 0 15px 13px; }
  .baris.tahun .isi-baris { padding-bottom: 12px; }
  .tahun-judul {
    font-size: 16px; font-weight: 700; color: ${TITIK}; line-height: 1.2;
  }
  .tahun-meta { color: #9AA79F; font-size: 10.5px; margin-top: 1px; }

  /* Satu wishlist */
  .wish { display: flex; gap: 7px; margin-bottom: 3px; align-items: baseline; }
  .wish .tanda { flex: none; font-size: 10px; }
  .wish .isi { font-size: 12.5px; color: #10221C; }
  .wish em {
    font-style: normal; color: #9AA79F; font-size: 10px;
    white-space: nowrap; margin-left: 3px;
  }
  .beres .isi { color: #6E7B74; text-decoration: line-through; }

  .kosong { color: #9AA79F; font-style: italic; }
`;

/**
 * Cetak SELURUH timeline jadi PDF garis waktu, lalu buka share sheet
 * (WhatsApp ada di situ).
 *
 * `orang` = null berarti timeline-ku sendiri; diisi nama berarti timeline
 * CORE Leader itu. Melempar error kalau gagal supaya layar bisa menampilkan
 * pesannya.
 */
export async function shareTimelinePdf(
  years: TimelineYear[],
  orang: { name: string; heart: string } | null,
  now: Date = new Date(),
): Promise<void> {
  const { total, done } = timelineTotals(years);
  const judul = orang
    ? `Timeline ${orang.heart} ${orang.name}`
    : 'My Timeline';

  const rentang =
    years.length > 0
      ? years[0].year === years[years.length - 1].year
        ? String(years[0].year)
        : `${years[0].year} – ${years[years.length - 1].year}`
      : '—';

  const bodyHtml =
    years.length === 0
      ? '<p class="kosong">Belum ada wishlist yang dicatat.</p>'
      : years
          .map((t, i) => tahunHtml(t, now, i === years.length - 1))
          .join('');

  const html = pdfShellHtml({
    eyebrow: 'TIMELINE',
    title: judul,
    subtitle: orang
      ? `Wishlist & panggilan hidup ${orang.name}, disusun bersama.`
      : 'Wishlist & panggilan hidup, dari tahun ke tahun.',
    chips: [
      { label: 'Rentang', value: rentang },
      { label: 'Wishlist', value: String(total) },
      { label: 'Tercapai', value: `${done} dari ${total}` },
      { label: 'Dicetak', value: formatFullDateTime(now) },
    ],
    bodyHtml,
    footerNote: `${judul} · dicetak ${formatFullDateTime(now)}`,
    extraCss: EXTRA_CSS,
  });

  await sharePdf(html, 'Bagikan Timeline', pdfFileName(judul, 'Timeline'));
}
