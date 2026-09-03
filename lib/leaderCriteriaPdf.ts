import { RULE_ISI_CSS } from './coreRulesPdf';
import { formatFullDate } from './format';
import {
    CRITERIA_SHEETS,
    NDC_VISION,
    type CriteriaSection,
    type CriteriaSheet,
} from './leaderCriteria';
import { escapeHtml, pdfFileName, pdfShellHtml, sharePdf } from './pdfDoc';

// Pedoman CORE Leader → PDF, memakai kerangka & gaya isi yang SAMA dengan
// Rules & Suggestions (lib/pdfDoc.ts + RULE_ISI_CSS). Sengaja tidak bikin gaya
// sendiri: dokumen yang keluar dari fitur CORE harus terlihat satu keluarga.
//
// Nama berkasnya diambil dari judul lembarnya di lib/leaderCriteria.ts, jadi
// yang sampai di WhatsApp persis "Pedoman Tugas CORE Leader.pdf" /
// "Pedoman Mengajukan Calon CORE Leader.pdf" — bukan nama acak bawaan
// expo-print.

/**
 * Visi NDC di atas isi — kotak mint tipis, sekali di tiap dokumen.
 * Warnanya diambil dari yang SUDAH dipakai kerangka PDF bersama (pdfDoc &
 * coreRulesPdf), jadi dokumen ini tidak memperkenalkan palet baru.
 */
const VISI_CSS = `
  .visi {
    background: #BFEFE2;
    border-left: 3px solid #4FBFA6;
    border-radius: 0 12px 12px 0;
    padding: 10px 14px;
    margin: 22px 0 0;
    color: #0C5C50;
  }
  .visi b { display: block; margin-bottom: 2px; }
`;

/** Satu bagian pedoman → HTML. Bagian PERINGATAN memakai kotak ⚠️ bersama. */
function sectionHtml(section: CriteriaSection): string {
  const poin = section.points
    .map(
      (p, i) =>
        `<div class="poin angka">` +
        `<span class="tanda">${i + 1}.</span>` +
        `<span class="teks">${escapeHtml(p)}</span></div>`,
    )
    .join('');

  if (section.tone === 'warn') {
    // Kotak kuning yang sama dengan blok "⚠️ Penting" di panduan CORE —
    // isinya memang setara: hal yang merugikan kalau dilanggar.
    return `<div class="penting"><b>⚠️ ${escapeHtml(section.title)}</b>${poin}</div>`;
  }
  const judul =
    escapeHtml(`${section.icon} ${section.title}`) +
    (section.note ? ` — ${escapeHtml(section.note)}` : '');
  return `<h2>${judul}</h2>${poin}`;
}

/** Judul lembar = nama berkas PDF-nya. */
export function criteriaPdfFileName(sheet: CriteriaSheet): string {
  return pdfFileName(CRITERIA_SHEETS[sheet].title, 'Pedoman CORE Leader');
}

/**
 * Cetak satu lembar pedoman jadi PDF lalu buka share sheet (WhatsApp ada di
 * dalamnya). Melempar error kalau gagal supaya layarnya bisa memberi tahu.
 */
export function shareCriteriaPdf(sheet: CriteriaSheet): Promise<void> {
  const { title, sections, count } = CRITERIA_SHEETS[sheet];
  const html = pdfShellHtml({
    eyebrow: 'Pedoman CORE Leader',
    title,
    subtitle: 'CARE · OPEN · REACH · EQUIP',
    chips: [
      { label: 'Jumlah poin', value: `${count} poin` },
      { label: 'Bagian', value: `${sections.length} bagian` },
    ],
    bodyHtml:
      `<p class="visi"><b>Visi NDC</b>${escapeHtml(NDC_VISION)}</p>` +
      `<div class="isi">${sections.map(sectionHtml).join('\n')}</div>`,
    footerNote: `${title} · dicetak ${formatFullDate(new Date())}`,
    extraCss: RULE_ISI_CSS + VISI_CSS,
  });
  return sharePdf(html, 'Kirim pedoman ke WhatsApp', criteriaPdfFileName(sheet));
}
