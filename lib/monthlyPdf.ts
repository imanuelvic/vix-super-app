import { MONTHLY_AGENDA_POINTS, type MonthlyMeeting } from './core';
import { formatFullDate, formatTime } from './format';
import {
  escapeHtml,
  htmlParagraphs,
  pdfFileName,
  pdfShellHtml,
  sharePdf,
} from './pdfDoc';

// Notulen Mentoring Bulanan → PDF. Kop, logo, kartu keterangan, & kaki
// dokumennya dipinjam dari kerangka bersama (lib/pdfDoc.ts) — berkas ini
// tinggal mengisi 5 poin agendanya.

/** CSS khusus isi notulen: nomor bulat + kartu catatan bertepi aksen. */
const ISI_CSS = `
  .poin { margin-top: 24px; page-break-inside: avoid; }
  .poin-kepala { display: flex; align-items: center; gap: 10px; }
  .nomor {
    width: 25px; height: 25px; flex: none;
    border-radius: 13px;
    background: #0C5C50; color: #9FE6D5;
    font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .poin h2 {
    font-size: 13px; margin: 0;
    letter-spacing: 0.7px; color: #0C5C50; font-weight: 700;
  }
  /* Catatan dikemas jadi kartu bertepi aksen — lebih terbaca daripada teks
     telanjang, dan blok kosong jadi jelas terlihat kosong. */
  .poin-isi {
    margin: 9px 0 0 35px;
    padding: 12px 15px;
    background: #FAF7F0;
    border-left: 3px solid #9FE6D5;
    border-radius: 0 12px 12px 0;
  }
  .poin-isi p { margin: 0 0 7px; color: #2E3B35; }
  .poin-isi p:last-child { margin-bottom: 0; }
  .poin-isi .kosong { color: #A8B3AB; font-style: italic; }

  /* Dokumentasi foto rapat — sejajar dengan kartu catatan di atasnya (35px),
     dua kolom supaya satu halaman tidak habis oleh satu foto saja. Foto
     tunggal dibiarkan selebar isi. Tinggi TIDAK dipatok: fotonya tampil utuh
     apa adanya, tidak ada wajah yang terpotong. */
  .foto-grid {
    margin: 9px 0 0 35px;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 10px;
  }
  .foto-grid img {
    width: calc(50% - 5px);
    border-radius: 12px;
    border: 1px solid #EBDCC5;
    display: block;
  }
  .foto-grid.tunggal img { width: 100%; }
`;

/** Susun HTML notulen: kop berlogo, keterangan rapat, lalu 5 poin agenda. */
function buildHtml(m: MonthlyMeeting): string {
  const d = m.date.toDate();
  const isi = MONTHLY_AGENDA_POINTS.map((p, i) => {
    const text = (m.points[p.key] ?? '').trim();
    return `
      <section class="poin">
        <div class="poin-kepala">
          <span class="nomor">${i + 1}</span>
          <h2>${p.icon} ${escapeHtml(p.label)}</h2>
        </div>
        <div class="poin-isi">${htmlParagraphs(text)}</div>
      </section>`;
  }).join('');

  const terisi = MONTHLY_AGENDA_POINTS.filter((p) =>
    (m.points[p.key] ?? '').trim(),
  ).length;

  // Dokumentasi foto ditempel sesudah 5 poin agenda — bukti rapatnya benar
  // terjadi. Isinya sudah pasti base64 buatan app sendiri, tapi tetap disaring
  // ke abjad base64 saja supaya tak mungkin ada tanda kutip yang mematahkan
  // atribut src-nya.
  const fotoBersih = m.photos
    .map((p) => p.replace(/[^A-Za-z0-9+/=]/g, ''))
    .filter(Boolean);
  const foto = fotoBersih.length
    ? `
      <section class="poin">
        <div class="poin-kepala">
          <span class="nomor">📸</span>
          <h2>DOKUMENTASI</h2>
        </div>
        <div class="foto-grid${fotoBersih.length === 1 ? ' tunggal' : ''}">
          ${fotoBersih
            .map((p) => `<img src="data:image/jpeg;base64,${p}" alt="" />`)
            .join('')}
        </div>
      </section>`
    : '';

  return pdfShellHtml({
    eyebrow: 'Notulen Mentoring Bulanan',
    title: m.title || 'Rapat Bulanan',
    chips: [
      { label: 'Tanggal', value: formatFullDate(d) },
      { label: 'Mulai', value: `${formatTime(d)} WIB` },
      { label: 'Tempat', value: m.place },
    ],
    bodyHtml: isi + foto,
    footerNote:
      `${terisi} dari ${MONTHLY_AGENDA_POINTS.length} poin agenda terisi · ` +
      (fotoBersih.length ? `${fotoBersih.length} foto dokumentasi · ` : '') +
      `dicetak ${formatFullDate(new Date())}`,
    extraCss: ISI_CSS,
  });
}

/**
 * Buat PDF notulen lalu buka share sheet (WhatsApp / Save to Files / dll).
 * Melempar error kalau gagal supaya pemanggil bisa menampilkan pesan.
 */
export function shareMonthlyPdf(m: MonthlyMeeting): Promise<void> {
  return sharePdf(
    buildHtml(m),
    'Kirim notulen ke WhatsApp',
    pdfFileName(m.title, 'Notulen Rapat'),
  );
}
