import { escapeHtml, htmlParagraphs, pdfFileName, pdfShellHtml, sharePdf } from './pdfDoc';
import { formatFullDateTime } from './format';
import {
  MIN_FOCUS,
  quarterLabel,
  radarGeometry,
  WHEEL_AREAS,
  type WheelData,
} from './wheel';

// PDF Wheel of Life 🎡 — SELURUH isi satu kuartal dicetak: radar chart, fokus
// kuartal beserta action plan-nya, skor tiap area beserta alasan penilaiannya,
// plus kapan dibuat & terakhir diubah.
//
// Dipakai untuk roda sendiri MAUPUN roda tiap CORE Leader — yang berbeda hanya
// judulnya. Jadi hasil assessment saat visitasi bisa langsung dikirim ke CL-nya
// lewat WhatsApp, tak perlu diketik ulang.
//
// Radar-nya SVG mentah (bukan gambar) — tajam di zoom berapa pun & ukurannya
// beberapa KB saja. Letak titiknya memakai `radarGeometry` yang sama dengan
// <RadarChart/> di layar, jadi bentuknya identik.

const RADAR_SIZE = 340;

/** Warna nada skor — angka yang sama dengan `scoreTone` di layar Wheel. */
function tone(score: number): { warna: string; label: string } {
  if (score >= 8) return { warna: '#1D8D7A', label: 'sehat' };
  if (score >= 5) return { warna: '#B8860B', label: 'perlu naik' };
  return { warna: '#C0392B', label: 'darurat' };
}

/** Radar chart sebagai SVG mentah, sebangun dengan yang tampil di layar. */
function radarSvg(values: number[], target: number[] | null): string {
  const g = radarGeometry(RADAR_SIZE, WHEEL_AREAS.length);

  const cincin = [0.2, 0.4, 0.6, 0.8, 1]
    .map(
      (f) =>
        `<polygon points="${g.ring(f)}" fill="none" stroke="#EBDCC5" stroke-width="1" />`,
    )
    .join('');

  const sumbu = WHEEL_AREAS.map((_, i) => {
    const [x, y] = g.point(i, g.r).split(',');
    return `<line x1="${g.cx}" y1="${g.cy}" x2="${x}" y2="${y}" stroke="#EBDCC5" stroke-width="1" />`;
  }).join('');

  const poligonTarget = target
    ? `<polygon points="${g.polygon(target)}" fill="none" stroke="#8A6B3E" stroke-width="2" stroke-dasharray="6 4" />`
    : '';

  const poligonSkor = `<polygon points="${g.polygon(values)}" fill="#1D8D7A" fill-opacity="0.25" stroke="#1D8D7A" stroke-width="2.5" />`;

  const label = WHEEL_AREAS.map((a, i) => {
    const p = g.labelPos(i);
    return `<text x="${p.x}" y="${p.y + 5}" font-size="15" text-anchor="middle">${a.icon}</text>`;
  }).join('');

  return `<svg width="${RADAR_SIZE}" height="${RADAR_SIZE}" viewBox="0 0 ${RADAR_SIZE} ${RADAR_SIZE}" xmlns="http://www.w3.org/2000/svg">
    ${cincin}${sumbu}${poligonTarget}${poligonSkor}${label}
  </svg>`;
}

/** Satu batang skor 0–10; `target` opsional digambar sebagai garis penanda. */
function bar(score: number, warna: string, target?: number): string {
  const lebar = Math.max(0, Math.min(score, 10)) * 10;
  const penanda =
    target !== undefined
      ? `<i style="left:${Math.max(0, Math.min(target, 10)) * 10}%"></i>`
      : '';
  return `<div class="bar"><b style="width:${lebar}%;background:${warna}"></b>${penanda}</div>`;
}

function focusHtml(data: WheelData): string {
  if (data.focus.length === 0) {
    return `<p class="kosong">Belum ada area fokus — minimal ${MIN_FOCUS} area dipilih tiap kuartal.</p>`;
  }
  return data.focus
    .map((f) => {
      const meta = WHEEL_AREAS.find((a) => a.key === f.area);
      if (!meta) return '';
      const sekarang = data.scores[f.area] ?? 0;
      const sisa = Math.max(0, f.targetScore - sekarang);
      const t = tone(sekarang);
      return `<div class="kartu">
        <div class="kartu-atas">
          <div class="kartu-judul">${meta.icon} ${escapeHtml(meta.label)}</div>
          <div class="pil" style="color:${sisa === 0 ? '#1D8D7A' : '#8A6B3E'}">
            ${sisa === 0 ? '✓ tercapai' : `+${sisa} poin lagi`}
          </div>
        </div>
        <div class="kartu-meta">sekarang ${sekarang} · target ${f.targetScore}</div>
        ${bar(sekarang, t.warna, f.targetScore)}
        <div class="plan-label">Action plan</div>
        <div class="plan">${htmlParagraphs(f.plan)}</div>
      </div>`;
    })
    .join('');
}

function scoresHtml(data: WheelData): string {
  return WHEEL_AREAS.map((a) => {
    const skor = data.scores[a.key] ?? 0;
    const t = tone(skor);
    const catatan = (data.notes[a.key] ?? '').trim();
    const fokus = data.focus.some((f) => f.area === a.key);
    return `<div class="area">
      <div class="area-atas">
        <div class="area-judul">${a.icon} ${escapeHtml(a.label)}${fokus ? ' <em>🎯 fokus</em>' : ''}</div>
        <div class="area-skor" style="color:${t.warna}">${skor}<small>/10 · ${t.label}</small></div>
      </div>
      ${bar(skor, t.warna)}
      <div class="area-tanya">${escapeHtml(a.question)}</div>
      <div class="area-catatan">${
        catatan ? htmlParagraphs(catatan) : '<p class="kosong">— tanpa catatan —</p>'
      }</div>
    </div>`;
  }).join('');
}

const EXTRA_CSS = `
  h2 {
    font-size: 15px; margin: 26px 0 12px; color: #0C5C50;
    border-bottom: 2px solid #EBDCC5; padding-bottom: 6px;
  }
  .kosong { color: #9AA79F; font-style: italic; margin: 0; }

  /* Radar + rata-rata */
  .radar { text-align: center; margin-top: 20px; }
  .rata { font-size: 26px; font-weight: 700; color: #0C5C50; margin: 4px 0 0; }
  .rata small { font-size: 12px; font-weight: 400; color: #9AA79F; }
  .legenda { color: #9AA79F; font-size: 10.5px; margin: 4px 0 0; }

  /* Sebaran nada */
  .sebaran { display: flex; gap: 8px; margin-top: 14px; }
  .sebaran div {
    flex: 1; text-align: center; border-radius: 12px;
    padding: 9px 6px; font-size: 11px; font-weight: 700;
  }

  /* Batang skor — dipakai kartu fokus & daftar area */
  .bar {
    position: relative; height: 9px; border-radius: 5px;
    background: #F1E7D6; overflow: hidden; margin: 7px 0 0;
  }
  .bar b { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 5px; }
  /* Penanda target: garis tegak gelap di atas batangnya */
  .bar i {
    position: absolute; top: -2px; bottom: -2px; width: 2px;
    background: #8A6B3E; overflow: visible;
  }

  /* Kartu area fokus */
  .kartu {
    border: 1px solid #EBDCC5; border-radius: 14px;
    padding: 13px 15px; margin-bottom: 10px;
    /* Jangan terpotong di pergantian halaman */
    page-break-inside: avoid; -webkit-column-break-inside: avoid;
  }
  .kartu-atas { display: flex; justify-content: space-between; gap: 10px; }
  .kartu-judul { font-weight: 700; color: #10221C; font-size: 13.5px; }
  .pil { font-size: 11px; font-weight: 700; white-space: nowrap; }
  .kartu-meta { color: #9AA79F; font-size: 11px; }
  .plan-label {
    margin-top: 10px; font-size: 9.5px; letter-spacing: 1.1px;
    text-transform: uppercase; color: #9AA79F;
  }
  .plan {
    border-left: 3px solid #1D8D7A; padding-left: 10px; margin-top: 3px;
  }
  .plan p { margin: 0; }

  /* Daftar skor per area */
  .area {
    border-bottom: 1px solid #F1E7D6; padding: 11px 0;
    page-break-inside: avoid; -webkit-column-break-inside: avoid;
  }
  .area:last-child { border-bottom: none; }
  .area-atas { display: flex; justify-content: space-between; gap: 10px; }
  .area-judul { font-weight: 700; color: #10221C; font-size: 13px; }
  .area-judul em {
    font-style: normal; font-size: 10px; color: #8A6B3E; font-weight: 400;
  }
  .area-skor { font-size: 17px; font-weight: 700; white-space: nowrap; }
  .area-skor small { font-size: 10px; font-weight: 400; color: #9AA79F; }
  .area-tanya { color: #9AA79F; font-size: 10.5px; margin-top: 6px; }
  .area-catatan { margin-top: 3px; }
  .area-catatan p { margin: 0; }
`;

/**
 * Cetak seluruh isi satu kuartal Wheel of Life jadi PDF, lalu buka share sheet
 * (WhatsApp ada di situ).
 *
 * `orang` = null berarti rodaku sendiri; diisi nama berarti roda CORE Leader
 * itu. Melempar error kalau gagal supaya layar bisa menampilkan pesannya.
 */
export async function shareWheelPdf(
  data: WheelData,
  year: number,
  q: number,
  orang: { name: string; heart: string } | null,
): Promise<void> {
  const kuartal = quarterLabel(year, q);
  const values = WHEEL_AREAS.map((a) => data.scores[a.key] ?? 0);
  const avg = values.reduce((s, v) => s + v, 0) / WHEEL_AREAS.length;

  // Poligon target: skor target untuk area fokus, skor sekarang untuk sisanya
  // — aturan yang sama dengan layarnya.
  const target =
    data.focus.length > 0
      ? WHEEL_AREAS.map((a) => {
          const f = data.focus.find((x) => x.area === a.key);
          return f ? f.targetScore : (data.scores[a.key] ?? 0);
        })
      : null;

  const sehat = values.filter((v) => v >= 8).length;
  const perluNaik = values.filter((v) => v >= 5 && v < 8).length;
  const darurat = values.filter((v) => v < 5).length;
  const sisaPoin = data.focus.reduce(
    (s, f) => s + Math.max(0, f.targetScore - (data.scores[f.area] ?? 0)),
    0,
  );

  const judul = orang
    ? `Wheel of Life ${orang.heart} ${orang.name}`
    : 'Wheel of Life';

  const bodyHtml = `
    <div class="radar">
      ${radarSvg(values, target)}
      <p class="rata">${avg.toFixed(1).replace('.', ',')}<small> / 10 rata-rata</small></p>
      ${target ? '<p class="legenda">─── skor sekarang &nbsp;·&nbsp; ┄┄┄ target fokus</p>' : ''}
    </div>

    <div class="sebaran">
      <div style="background:#E8F5F1;color:#1D8D7A">${sehat} sehat</div>
      <div style="background:#F7EFE0;color:#B8860B">${perluNaik} perlu naik</div>
      <div style="background:#FBEAE7;color:#C0392B">${darurat} darurat</div>
    </div>

    <h2>🎯 Fokus Kuartal${
      data.focus.length > 0
        ? ` — ${data.focus.length} area${sisaPoin > 0 ? `, kurang ${sisaPoin} poin lagi` : ', semua target tercapai 🎉'}`
        : ''
    }</h2>
    ${focusHtml(data)}

    <h2>📋 Skor per Area</h2>
    ${scoresHtml(data)}
  `;

  const html = pdfShellHtml({
    eyebrow: 'WHEEL OF LIFE',
    title: `${judul} — ${kuartal}`,
    subtitle: orang
      ? `8 area hidup ${orang.name}, dinilai bersama saat visitasi.`
      : '8 area hidup, dinilai ulang tiap kuartal.',
    chips: [
      { label: 'Kuartal', value: kuartal },
      {
        label: 'Dibuat',
        value: data.createdAt ? formatFullDateTime(data.createdAt.toDate()) : '—',
      },
      {
        label: 'Terakhir diubah',
        value: data.updatedAt ? formatFullDateTime(data.updatedAt.toDate()) : '—',
      },
      { label: 'Rata-rata', value: `${avg.toFixed(1).replace('.', ',')} / 10` },
    ],
    bodyHtml,
    footerNote: `Wheel of Life ${kuartal} · dicetak ${formatFullDateTime(new Date())}`,
    extraCss: EXTRA_CSS,
  });

  await sharePdf(
    html,
    'Bagikan Wheel of Life',
    pdfFileName(`${judul} - ${kuartal}`, 'Wheel of Life'),
  );
}
