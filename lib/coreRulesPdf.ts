import { parseRuleBody, ruleFullTitle, type CoreRule } from './coreRules';
import { formatFullDate } from './format';
import { escapeHtml, pdfFileName, pdfShellHtml, sharePdf } from './pdfDoc';

// Rules & Suggestions → PDF, memakai kerangka bersama (lib/pdfDoc.ts).
// Strukturnya dibaca oleh parseRuleBody() — parser YANG SAMA dengan yang
// dipakai layar, jadi PDF & layar tak mungkin menafsirkan dokumen berbeda.

/** CSS isi panduan — dipakai juga oleh PDF undangan pertemuan. */
export const RULE_ISI_CSS = `
  .isi { margin-top: 26px; }
  .isi h2 {
    font-size: 13.5px;
    margin: 22px 0 8px;
    color: #0C5C50;
    font-weight: 700;
    letter-spacing: 0.2px;
    page-break-after: avoid;
  }
  .isi h2:first-child { margin-top: 0; }
  .isi p { margin: 0 0 8px; color: #2E3B35; }

  /* Butir daftar: bulatan mint kecil, menjorok rapi */
  .isi .butir {
    display: flex; gap: 9px;
    margin: 0 0 6px; padding-left: 2px;
    page-break-inside: avoid;
  }
  .isi .butir .tanda {
    flex: none; color: #4FBFA6; font-weight: 700; line-height: 1.6;
  }
  .isi .butir .teks { flex: 1; color: #2E3B35; }
  /* Butir bernomor pakai angka hijau tua, bukan bulatan */
  .isi .butir.angka .tanda { color: #0C5C50; min-width: 14px; }

  /* Blok ⚠️ Penting — kartu kuning lembut biar tak mungkin terlewat */
  .isi .penting {
    background: #FFF6E0;
    border-left: 3px solid #E8B84B;
    border-radius: 0 12px 12px 0;
    padding: 10px 14px;
    margin: 10px 0 12px;
    color: #6B4E12;
    page-break-inside: avoid;
  }
  .isi .penting b { color: #8A6410; display: block; }
  /* Butir & paragraf yang berada DI DALAM kotak penting */
  .isi .penting p { margin: 6px 0 0; color: #6B4E12; }
  .isi .penting .butir { margin: 6px 0 0; }
  .isi .penting .butir .tanda { color: #C9962B; }
  .isi .penting .butir .teks { color: #6B4E12; }

  .isi hr {
    border: 0;
    border-top: 1px solid #EBDCC5;
    margin: 20px 0;
  }
`;

/** Ubah isi dokumen jadi HTML, memakai hasil parseRuleBody(). */
export function ruleBodyHtml(body: string): string {
  const out: string[] = [];
  for (const line of parseRuleBody(body)) {
    const t = escapeHtml(line.text);
    switch (line.type) {
      case 'sep':
        out.push('<hr/>');
        break;
      case 'head':
        out.push(`<h2>${t}</h2>`);
        break;
      case 'warn': {
        // Butir milik blok ini ikut MASUK ke dalam kotaknya.
        const isi = (line.children ?? [])
          .map((k) =>
            k.type === 'bullet' || k.type === 'num'
              ? `<div class="butir"><span class="tanda">${
                  k.type === 'num' ? escapeHtml(`${k.marker}.`) : '•'
                }</span><span class="teks">${escapeHtml(k.text)}</span></div>`
              : `<p>${escapeHtml(k.text)}</p>`,
          )
          .join('');
        out.push(`<div class="penting"><b>⚠️ ${t}</b>${isi}</div>`);
        break;
      }
      case 'bullet':
        out.push(
          `<div class="butir"><span class="tanda">•</span><span class="teks">${t}</span></div>`,
        );
        break;
      case 'num':
        out.push(
          `<div class="butir angka">` +
            `<span class="tanda">${escapeHtml(line.marker ?? '')}.</span>` +
            `<span class="teks">${t}</span></div>`,
        );
        break;
      case 'text':
        out.push(`<p>${t}</p>`);
        break;
      // 'blank' tidak menghasilkan apa-apa: jarak sudah diatur margin CSS,
      // kalau baris kosong ikut dicetak PDF-nya jadi berlubang-lubang.
    }
  }
  return `<div class="isi">${out.join('\n')}</div>`;
}

/**
 * Buat PDF satu dokumen aturan lalu buka share sheet.
 * Melempar error kalau gagal supaya pemanggil bisa menampilkan pesan.
 */
export function shareRulePdf(rule: CoreRule): Promise<void> {
  const html = pdfShellHtml({
    eyebrow: 'Rules & Suggestions',
    title: ruleFullTitle(rule),
    subtitle: rule.credit,
    chips: [
      { label: 'Versi', value: rule.version },
      { label: 'Terakhir diperbarui', value: rule.updated },
    ],
    bodyHtml: ruleBodyHtml(rule.body),
    footerNote: `Panduan resmi CORE · dicetak ${formatFullDate(new Date())}`,
    extraCss: RULE_ISI_CSS,
  });
  return sharePdf(
    html,
    pdfFileName(ruleFullTitle(rule), 'Rules CORE'),
    'Kirim panduan ke WhatsApp',
  );
}
