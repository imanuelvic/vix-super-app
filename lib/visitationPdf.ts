import {
  meetingKindMeta,
  meetingLeaderNames,
  type CoreLeader,
  type Visitation,
} from './core';
import { type CoreRule } from './coreRules';
import { ruleBodyHtml, RULE_ISI_CSS } from './coreRulesPdf';
import { formatFullDate, formatTime } from './format';
import {
  escapeHtml,
  htmlParagraphs,
  pdfFileName,
  pdfShellHtml,
  sharePdf,
} from './pdfDoc';

// Notulen pertemuan CORE → PDF yang dikirim ke CORE Leader-nya.
//
// Isinya dua bagian: keterangan acara (judul & agenda) lalu panduan resmi
// jenis acara itu dari Rules & Suggestions — memang itu gunanya: satu berkas
// yang menjawab "kapan, di mana, dan bagaimana acaranya dijalankan".

const ACARA_CSS = `
  .acara { margin-top: 26px; }
  .acara h2 {
    font-size: 13.5px; margin: 0 0 8px;
    color: #0C5C50; font-weight: 700; letter-spacing: 0.2px;
  }
  .acara .kotak {
    padding: 12px 15px;
    background: #FAF7F0;
    border-left: 3px solid #9FE6D5;
    border-radius: 0 12px 12px 0;
  }
  .acara .kotak p { margin: 0 0 7px; color: #2E3B35; }
  .acara .kotak p:last-child { margin-bottom: 0; }
  .acara .kosong { color: #A8B3AB; font-style: italic; }

  /* Garis pemisah sebelum panduan */
  .pisah {
    border: 0; border-top: 1px solid #EBDCC5;
    margin: 30px 0 0;
  }
  .panduan-kop {
    margin: 22px 0 0;
    font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase;
    color: #4FBFA6; font-weight: 700;
  }
  .panduan-judul {
    margin: 4px 0 0; font-size: 17px; font-weight: 700; color: #0C5C50;
  }
  .panduan-meta { margin: 3px 0 0; font-size: 10.5px; color: #9AA79F; }
`;

/**
 * Nama berkas: jenis pertemuan + nama CORE-nya.
 * "Visitasi CORE - Riky.pdf" · gabungan → "CORE Gabungan - Riky, Sarah.pdf"
 */
export function visitationPdfName(
  v: Visitation,
  leaders: CoreLeader[],
): string {
  // Emoji hati CL ikut terbawa kalau namanya diambil apa adanya, jadi di sini
  // dipakai nama polosnya saja supaya nama berkas tetap enak dibaca.
  const nama = v.leaderIds
    .map((id) => leaders.find((l) => l.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  const jenis = meetingKindMeta(v.kind).label;
  return pdfFileName(nama ? `${jenis} - ${nama}` : jenis, 'Pertemuan CORE');
}

function buildHtml(
  v: Visitation,
  leaders: CoreLeader[],
  rule: CoreRule | undefined,
): string {
  const d = v.date.toDate();
  const meta = meetingKindMeta(v.kind);

  const acara = `
    <section class="acara">
      <h2>🗒️ ${escapeHtml(v.note.trim() || 'Agenda Pertemuan')}</h2>
      <div class="kotak">${htmlParagraphs(v.agenda)}</div>
    </section>`;

  // Panduan resminya ditempel di bawah notulen — tanpa ini, PDF-nya cuma
  // pengumuman jadwal dan CORE Leader tetap harus dikirimi berkas kedua.
  const panduan = rule?.body.trim()
    ? `
    <hr class="pisah" />
    <p class="panduan-kop">Panduan Acara</p>
    <p class="panduan-judul">${escapeHtml(`${rule.icon} ${rule.title}`)}</p>
    <p class="panduan-meta">${escapeHtml(
      [rule.credit, rule.version, rule.updated].filter(Boolean).join(' · '),
    )}</p>
    ${ruleBodyHtml(rule.body)}`
    : '';

  return pdfShellHtml({
    eyebrow: `Meeting ${meta.label}`,
    title: meetingLeaderNames(v, leaders, { fallback: 'CORE' }),
    subtitle: v.thanksgiving && v.kind !== 'thanksgiving' ? '🎉 Sekalian Thanksgiving' : undefined,
    chips: [
      { label: 'Jenis acara', value: `${meta.icon} ${meta.label}` },
      { label: 'Tanggal', value: formatFullDate(d) },
      { label: 'Mulai', value: `${formatTime(d)} WIB` },
    ],
    bodyHtml: acara + panduan,
    footerNote: rule?.body.trim()
      ? `Notulen & panduan acara · dikirim ${formatFullDate(new Date())}`
      : `Notulen · dikirim ${formatFullDate(new Date())}`,
    extraCss: ACARA_CSS + RULE_ISI_CSS,
  });
}

/**
 * Buat PDF notulen pertemuan lalu buka share sheet (WhatsApp / Files / dll).
 * `rule` boleh undefined — PDF-nya tetap terbit, hanya tanpa bagian panduan.
 * Melempar error kalau gagal supaya pemanggil bisa menampilkan pesan.
 */
export function shareVisitationPdf(
  v: Visitation,
  leaders: CoreLeader[],
  rule: CoreRule | undefined,
): Promise<void> {
  return sharePdf(
    buildHtml(v, leaders, rule),
    'Kirim notulen ke WhatsApp',
    visitationPdfName(v, leaders),
  );
}
