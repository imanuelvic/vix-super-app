import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { MONTHLY_AGENDA_POINTS, type MonthlyMeeting } from './core';
import { formatFullDate, formatTime } from './format';

// Notulen Mentoring Bulanan → PDF. Alurnya sama persis dengan Invoice
// (lib/invoice.ts): susun HTML → expo-print jadikan PDF → expo-sharing buka
// share sheet OS, tempat WhatsApp muncul sebagai salah satu tujuan.
//
// CATATAN: iOS tidak mengizinkan sebuah berkas didorong LANGSUNG ke WhatsApp
// lewat tautan; share sheet memang satu-satunya jalan resmi. Judul dialognya
// dibuat jelas supaya tidak bingung harus menekan apa.

/** Escape teks pengguna agar aman dimasukkan ke HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Ubah baris-baris catatan jadi paragraf HTML (baris kosong dibuang). */
function paragraphs(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return '<p class="kosong">— belum diisi —</p>';
  }
  return lines.map((l) => `<p>${esc(l)}</p>`).join('');
}

/** Susun HTML notulen: kop, keterangan rapat, lalu 5 poin agenda. */
function buildHtml(m: MonthlyMeeting): string {
  const d = m.date.toDate();
  const isi = MONTHLY_AGENDA_POINTS.map((p, i) => {
    const text = (m.points[p.key] ?? '').trim();
    return `
      <section class="poin">
        <div class="poin-kepala">
          <span class="nomor">${i + 1}</span>
          <h2>${p.icon} ${esc(p.label)}</h2>
        </div>
        <div class="poin-isi">${paragraphs(text)}</div>
      </section>`;
  }).join('');

  const terisi = MONTHLY_AGENDA_POINTS.filter((p) =>
    (m.points[p.key] ?? '').trim(),
  ).length;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    color: #10221C;
    margin: 0;
    padding: 40px 44px 52px;
    font-size: 13px;
    line-height: 1.6;
    background: #fff;
  }

  /* Kop: blok hijau tua, seperti kartu ringkasan di dalam app */
  .kop {
    background: #0C5C50;
    border-radius: 18px;
    padding: 24px 26px;
    color: #fff;
  }
  .kop .jenis {
    font-size: 10.5px;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: #9FE6D5;
    margin: 0 0 6px;
  }
  .kop h1 { font-size: 24px; margin: 0; line-height: 1.25; font-weight: 700; }

  /* Keterangan rapat: tanggal · jam · tempat */
  .info { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .info div {
    background: rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 12px;
  }
  .info span { color: #9FE6D5; }

  /* Isi agenda */
  .poin { margin-top: 26px; page-break-inside: avoid; }
  .poin-kepala { display: flex; align-items: center; gap: 10px; }
  .nomor {
    width: 24px; height: 24px; flex: none;
    border-radius: 12px;
    background: #9FE6D5; color: #0C5C50;
    font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .poin h2 {
    font-size: 13.5px; margin: 0;
    letter-spacing: 0.6px; color: #0C5C50; font-weight: 700;
  }
  .poin-isi {
    margin: 8px 0 0 34px;
    padding-left: 14px;
    border-left: 2px solid #EBDCC5;
  }
  .poin-isi p { margin: 0 0 6px; color: #2E3B35; }
  .poin-isi p:last-child { margin-bottom: 0; }
  .poin-isi .kosong { color: #9AA79F; font-style: italic; }

  .kaki {
    margin-top: 38px; padding-top: 14px;
    border-top: 1px solid #EBDCC5;
    text-align: center; color: #9AA79F; font-size: 10.5px;
  }
</style>
</head>
<body>
  <div class="kop">
    <p class="jenis">Notulen Mentoring Bulanan</p>
    <h1>${esc(m.title || 'Rapat Bulanan')}</h1>
    <div class="info">
      <div><span>Tanggal</span><br/>${formatFullDate(d)}</div>
      <div><span>Mulai</span><br/>${formatTime(d)} WIB</div>
      ${m.place ? `<div><span>Tempat</span><br/>${esc(m.place)}</div>` : ''}
    </div>
  </div>

  ${isi}

  <div class="kaki">
    ${terisi} dari ${MONTHLY_AGENDA_POINTS.length} poin agenda terisi ·
    dicetak ${formatFullDate(new Date())}
  </div>
</body>
</html>`;
}

/**
 * Buat PDF notulen lalu buka share sheet (WhatsApp / Save to Files / dll).
 * Melempar error kalau gagal supaya pemanggil bisa menampilkan pesan.
 */
export async function shareMonthlyPdf(m: MonthlyMeeting): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildHtml(m) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Kirim notulen ke WhatsApp',
      UTI: 'com.adobe.pdf',
    });
  }
}
