import { MONTHLY_AGENDA_POINTS, type MonthlyMeeting } from './core';
import { formatFullDate, formatTime } from './format';
import { escapeHtml, pdfFileName, pdfShellHtml, sharePdf } from './pdfDoc';

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
`;

/** Ubah baris-baris catatan jadi paragraf HTML (baris kosong dibuang). */
function paragraphs(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return '<p class="kosong">— belum diisi —</p>';
  }
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

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
        <div class="poin-isi">${paragraphs(text)}</div>
      </section>`;
  }).join('');

  const terisi = MONTHLY_AGENDA_POINTS.filter((p) =>
    (m.points[p.key] ?? '').trim(),
  ).length;

  return pdfShellHtml({
    eyebrow: 'Notulen Mentoring Bulanan',
    title: m.title || 'Rapat Bulanan',
    chips: [
      { label: 'Tanggal', value: formatFullDate(d) },
      { label: 'Mulai', value: `${formatTime(d)} WIB` },
      { label: 'Tempat', value: m.place },
    ],
    bodyHtml: isi,
    footerNote:
      `${terisi} dari ${MONTHLY_AGENDA_POINTS.length} poin agenda terisi · ` +
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
    pdfFileName(m.title, 'Notulen Rapat'),
    'Kirim notulen ke WhatsApp',
  );
}
