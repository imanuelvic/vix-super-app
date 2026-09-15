import type { CoreLeader } from './core';
import {
  dayIdToDate,
  formatDecimal,
  formatFullDate,
  formatFullDateTime,
} from './format';
import { bodySummary, type BmiTone } from './health';
import { escapeHtml, pdfFileName, pdfShellHtml, sharePdf } from './pdfDoc';

// PDF Data Tubuh CORE Leader 🧍 — dibagikan ke CL-nya lewat share sheet
// (WhatsApp ada di situ), bentuknya sekeluarga dengan PDF Wheel of Life &
// Timeline.
//
// Isinya BUKAN cuma angka. Angka tinggi/berat/BMI yang dikirim polos ke orang
// yang beratnya berlebih gampang terbaca sebagai teguran. Jadi dokumen ini
// menaruh angkanya dulu, lalu MENJELASKAN artinya dengan bahasa yang lembut,
// lalu menutup dengan kebiasaan sehat yang dianjurkan di seluruh dunia
// (WHO: 150 menit gerak seminggu = jalan 30 menit × 5 hari, langkah harian,
// tidur, air, piring seimbang). Yang beratnya berlebih dapat satu bagian
// tambahan berisi langkah kecil yang jelas, tanpa nada menghakimi.
//
// Ini bagian dari area 🍎 Health di Wheel of Life: menggembalakan CL juga
// berarti peduli pada badannya, bukan cuma rohaninya.

/** Warna penilaian di kertas — senada dengan "sebaran" di PDF Wheel of Life. */
const WARNA: Record<BmiTone, string> = {
  ok: '#1D8D7A',
  warn: '#B8860B',
  danger: '#C0392B',
};

/** Angka 2 desimal koma, untuk rasio perut/tinggi (0,48). */
function rasioTeks(r: number): string {
  return r.toFixed(2).replace('.', ',');
}

function baris(label: string, nilai: string, warna?: string): string {
  return `<div class="baris">
    <span class="label">${escapeHtml(label)}</span>
    <span class="nilai"${warna ? ` style="color:${warna}"` : ''}>${escapeHtml(nilai)}</span>
  </div>`;
}

function tip(emoji: string, judul: string, isi: string): string {
  return `<div class="tip">
    <span class="tip-emoji">${emoji}</span>
    <div><b>${escapeHtml(judul)}</b><p>${escapeHtml(isi)}</p></div>
  </div>`;
}

/**
 * "Apa artinya" — satu-dua paragraf yang dipilih dari angkanya. Nada untuk
 * yang berlebih sengaja paling lembut: angkanya dibaca sebagai titik awal
 * dan jaraknya dipecah jadi langkah mingguan yang masuk akal.
 */
function artiHtml(leader: CoreLeader): string {
  const r = bodySummary(leader);
  const nama = leader.name;
  const par: string[] = [];

  if (!r.lengkap || r.bmi == null || !r.kategori || !r.ideal) {
    par.push(
      `Tinggi & berat ${nama} belum lengkap, jadi BMI dan berat idealnya belum bisa dihitung. Lengkapi dulu lewat ✏️ di kartunya, lalu cetak lagi.`,
    );
  } else {
    const bmi = formatDecimal(r.bmi);
    const rentang = `${formatDecimal(r.ideal.min)}–${formatDecimal(r.ideal.max)} kg`;
    const berat = leader.weightKg!;
    if (r.bmi < 18.5) {
      par.push(
        `BMI ${nama} ${bmi}, sedikit di bawah rentang normal. Bukan berarti ada yang salah; tubuhnya cuma butuh bahan bakar lebih. Makan teratur 3 kali + camilan sehat, protein di tiap makan, dan latihan kekuatan supaya yang bertambah otot, bukan cuma lemak. Rentang sehat untuk tingginya ${rentang}.`,
      );
    } else if (r.bmi < 23) {
      par.push(
        `BMI ${nama} ${bmi}, tepat di rentang normal. Beratnya sudah pas untuk tingginya (${rentang}). Yang penting sekarang bukan mengejar angka, tapi menjaga kebiasaan yang sudah jalan.`,
      );
    } else if (r.bmi < 25) {
      const selisih = Math.max(0, berat - r.ideal.max);
      par.push(
        `BMI ${nama} ${bmi}, sedikit di atas rentang normal (${rentang}). Ini zona "perhatian", bukan zona bahaya: ${formatDecimal(selisih)} kg lebih dekat ke rentang sehat sudah cukup untuk terasa bedanya. Turun 0,5 kg seminggu itu pelan, dan justru yang pelan itulah yang bertahan.`,
      );
    } else {
      const selisih = Math.max(0, berat - r.ideal.max);
      const minggu = Math.ceil(selisih / 0.75);
      const bulan = Math.max(1, Math.round(minggu / 4.3));
      par.push(
        `BMI ${nama} ${bmi}, masuk kategori ${r.kategori.label}. Angka ini bukan penilaian tentang dirinya, cuma titik awal yang jujur. Rentang sehat untuk tinggi ${formatDecimal(leader.heightCm!)} cm adalah ${rentang}; jaraknya ${formatDecimal(selisih)} kg, dan tidak perlu ditempuh sekaligus. Turun 0,5–1 kg seminggu (kira-kira ${minggu} minggu, sekitar ${bulan} bulan) sudah luar biasa, dan lebih mungkin bertahan daripada turun cepat.`,
      );
      par.push(
        `Target pertama yang paling masuk akal: 5% dari berat sekarang, sekitar ${formatDecimal(berat * 0.05)} kg dalam 3 bulan. Segitu saja tekanan darah, gula darah, dan napas saat naik tangga biasanya sudah membaik.${
          r.bmi >= 30
            ? ' Karena BMI-nya sudah 30 ke atas, ajak juga berkonsultasi ke dokter; itu tanda peduli, bukan tanda gagal.'
            : ''
        }`,
      );
    }
  }

  if (leader.waistCm != null && leader.heightCm) {
    const rasio = leader.waistCm / leader.heightCm;
    par.push(
      rasio < 0.5
        ? `Lingkar perutnya ${formatDecimal(leader.waistCm)} cm, masih di bawah setengah tinggi badan (rasio ${rasioTeks(rasio)}). Tanda lemak perutnya terjaga.`
        : `Lingkar perutnya ${formatDecimal(leader.waistCm)} cm, lebih dari setengah tinggi badan (rasio ${rasioTeks(rasio)}). Lemak di perut yang paling berpengaruh ke jantung & gula darah, jadi target sederhananya: lingkar perut di bawah ${Math.floor(leader.heightCm / 2)} cm.`,
    );
  } else if (r.lengkap) {
    par.push(
      'Lingkar perutnya belum diisi. Ukur sekali dengan meteran jahit setinggi pusar; itu petunjuk lemak perut yang lebih jujur daripada berat saja.',
    );
  }

  return par.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}

/** Kebiasaan sehat yang dianjurkan di seluruh dunia (WHO & sejenisnya). */
const TIPS_UMUM: [string, string, string][] = [
  [
    '🚶',
    'Jalan atau lari pagi 30 menit sehari',
    'WHO menganjurkan 150 menit aktivitas sedang seminggu: itu persis jalan cepat 30 menit × 5 hari. Boleh dicicil 3 × 10 menit, yang penting napasnya sedikit terengah.',
  ],
  [
    '👣',
    'Mulai dari 5.000 langkah sehari',
    'Naikkan 500 langkah tiap minggu sampai 7.000–10.000. Dari 5.000 ke 7.000 saja risiko penyakit jantung sudah turun jauh; sisanya bonus.',
  ],
  [
    '🏋️',
    'Latihan kekuatan 2 hari seminggu',
    'Push-up, squat, plank, atau beban ringan. Otot yang lebih banyak membakar kalori bahkan saat duduk, dan menjaga tulang & lutut sampai tua.',
  ],
  [
    '🍽️',
    'Piring seimbang',
    'Setengah piring sayur & buah, seperempat protein (telur, ikan, tempe, ayam), seperempat nasi atau karbohidrat lain. Kurangi minuman manis & gorengan.',
  ],
  [
    '💧',
    'Air putih 8 gelas sehari',
    'Sekitar 2 liter. Rasa haus sering dikira lapar; minum dulu, tunggu 10 menit, baru putuskan mau makan atau tidak.',
  ],
  [
    '😴',
    'Tidur 7–9 jam',
    'Kurang tidur menaikkan hormon lapar dan bikin ngidam yang manis-manis. Jam tidur yang tetap lebih berpengaruh daripada yang orang kira.',
  ],
  [
    '🪑',
    'Jangan duduk terlalu lama',
    'Berdiri, regangkan badan, atau jalan sebentar tiap 30–60 menit. Duduk 8 jam tanpa jeda tidak tertebus oleh olahraga sekali.',
  ],
  [
    '⚖️',
    'Timbang seminggu sekali',
    'Di hari & jam yang sama (pagi, sebelum makan), lalu catat. Yang dilihat arahnya dari minggu ke minggu, bukan angka satu hari.',
  ],
];

/** Langkah kecil untuk yang beratnya berlebih. Jelas, tapi lembut. */
const TIPS_BERLEBIH: [string, string, string][] = [
  [
    '🎯',
    'Target kecil dulu',
    'Bukan "harus ideal", tapi turun 5% dulu dalam 3 bulan. Tubuh menyesuaikan diri lebih baik dengan perubahan pelan, dan hasilnya lebih awet.',
  ],
  [
    '🥗',
    'Kurangi 300–500 kkal sehari, bukan setengah porsi',
    'Ganti minuman manis dengan air putih, nasi dikurangi seperempat, lauk goreng jadi rebus/panggang 3 dari 5 kali. Kecil-kecil, tapi tiap hari.',
  ],
  [
    '🚶',
    'Gerak yang paling ringan justru yang paling bertahan',
    'Mulai jalan 20 menit, tambah 5 menit tiap minggu sampai 45–60 menit. Lari boleh belakangan, setelah lutut & napasnya siap.',
  ],
  [
    '🕗',
    'Makan pelan, sarapan berprotein',
    'Sekitar 20 menit per makan supaya rasa kenyang sempat datang. Sarapan telur, tempe, atau yogurt bikin siangnya tidak kalap.',
  ],
  [
    '🚫',
    'Hindari diet ekstrem & obat pelangsing',
    'Turun cepat hampir selalu naik cepat. Yang dicari bukan diet 30 hari, tapi kebiasaan yang bisa dijalani 10 tahun.',
  ],
  [
    '🤝',
    'Jangan sendirian',
    'Ajak teman CORE jalan bareng atau saling kirim kabar tiap minggu. Kebiasaan yang ditemani bertahan jauh lebih lama.',
  ],
  [
    '💚',
    'Gagal seminggu itu biasa',
    'Mulai lagi minggu depannya tanpa rasa bersalah. Konsisten mengalahkan sempurna, selalu.',
  ],
];

const EXTRA_CSS = `
  h2 {
    font-size: 15px; margin: 26px 0 12px; color: #0C5C50;
    border-bottom: 2px solid #EBDCC5; padding-bottom: 6px;
  }
  p { margin: 0 0 8px; }

  /* Tabel angka: label kiri, nilai kanan, seperti kartu di app */
  .tabel {
    border: 1px solid #EBDCC5; border-radius: 14px; padding: 4px 15px;
    page-break-inside: avoid; -webkit-column-break-inside: avoid;
  }
  .baris {
    display: flex; justify-content: space-between; gap: 12px;
    padding: 9px 0; border-bottom: 1px solid #F1E7D6;
  }
  .baris:last-child { border-bottom: none; }
  .label { color: #6E7B74; }
  .nilai { font-weight: 700; color: #10221C; text-align: right; }

  /* Kotak "apa artinya": lembut, dibingkai garis kiri hijau */
  .arti {
    border-left: 3px solid #1D8D7A; padding: 2px 0 2px 12px;
    page-break-inside: avoid; -webkit-column-break-inside: avoid;
  }
  .arti p:last-child { margin-bottom: 0; }

  /* Kartu tips: emoji di kiri, judul tebal + penjelasan */
  .tip {
    display: flex; gap: 11px; align-items: flex-start;
    border: 1px solid #EBDCC5; border-radius: 14px;
    padding: 11px 14px; margin-bottom: 8px;
    page-break-inside: avoid; -webkit-column-break-inside: avoid;
  }
  .tip-emoji { flex: none; font-size: 18px; line-height: 1.3; }
  .tip b { display: block; color: #10221C; font-size: 12.5px; }
  .tip p { margin: 2px 0 0; color: #3F4F48; font-size: 11.5px; line-height: 1.55; }
  .tip.hangat { background: #FFF6E5; border-color: #F1D9A6; }
  .penutup { color: #6E7B74; font-size: 11px; margin-top: 12px; font-style: italic; }
`;

/**
 * Cetak Data Tubuh satu CORE Leader (angka + arti + tips sehat) jadi PDF,
 * lalu buka share sheet. Melempar error kalau gagal supaya dialognya bisa
 * menampilkan pesannya.
 */
export async function shareLeaderBodyPdf(
  leader: CoreLeader,
  now: Date = new Date(),
): Promise<void> {
  const r = bodySummary(leader);
  const judul = `Data Tubuh ${leader.heart} ${leader.name}`;
  const berlebih = r.bmi != null && r.bmi >= 23;
  const diperbarui = leader.bodyUpdatedDayId
    ? formatFullDate(dayIdToDate(leader.bodyUpdatedDayId))
    : 'belum pernah';

  const tabel = [
    leader.heightCm != null ? baris('Tinggi', `${formatDecimal(leader.heightCm)} cm`) : '',
    leader.weightKg != null ? baris('Berat', `${formatDecimal(leader.weightKg)} kg`) : '',
    r.ideal
      ? baris('Berat ideal', `${formatDecimal(r.ideal.min)}–${formatDecimal(r.ideal.max)} kg`)
      : '',
    r.bmi != null && r.kategori
      ? baris('BMI', `${formatDecimal(r.bmi)} · ${r.kategori.label}`, WARNA[r.kategori.tone])
      : '',
    leader.waistCm != null ? baris('Lingkar perut', `${formatDecimal(leader.waistCm)} cm`) : '',
    r.rasio != null
      ? baris(
          'Rasio perut/tinggi',
          `${rasioTeks(r.rasio)} · ${r.rasio < 0.5 ? 'Sehat' : 'Perhatian'}`,
          WARNA[r.rasio < 0.5 ? 'ok' : 'warn'],
        )
      : '',
  ]
    .filter(Boolean)
    .join('');

  const bodyHtml = `
    <h2>📏 Angka-angkanya</h2>
    <div class="tabel">${tabel}</div>

    <h2>💬 Apa artinya</h2>
    <div class="arti">${artiHtml(leader)}</div>

    <h2>🌿 Kebiasaan sehat yang dianjurkan di seluruh dunia</h2>
    ${TIPS_UMUM.map(([e, j, i]) => tip(e, j, i)).join('')}
    ${
      berlebih
        ? `<h2>💛 Langkah kecil untuk ${escapeHtml(leader.name)}</h2>
    ${TIPS_BERLEBIH.map(([e, j, i]) => tip(e, j, i).replace('class="tip"', 'class="tip hangat"')).join('')}`
        : ''
    }
    <p class="penutup">Badan yang sehat itu bagian dari area 🍎 Health di Wheel of Life. Bukan soal bentuk, tapi soal punya tenaga untuk hal-hal yang Tuhan percayakan.</p>
  `;

  const html = pdfShellHtml({
    eyebrow: 'DATA TUBUH',
    title: judul,
    subtitle: 'Area 🍎 Health di Wheel of Life: dipantau bersama, pelan tapi pasti.',
    chips: [
      { label: 'Diperbarui', value: diperbarui },
      {
        label: 'BMI',
        value:
          r.bmi != null && r.kategori
            ? `${formatDecimal(r.bmi)} · ${r.kategori.label}`
            : 'belum lengkap',
      },
      {
        label: 'Berat ideal',
        value: r.ideal
          ? `${formatDecimal(r.ideal.min)}–${formatDecimal(r.ideal.max)} kg`
          : '',
      },
      { label: 'Dicetak', value: formatFullDateTime(now) },
    ],
    bodyHtml,
    footerNote: `${judul} · dicetak ${formatFullDateTime(now)}`,
    extraCss: EXTRA_CSS,
  });

  await sharePdf(html, 'Bagikan Data Tubuh', pdfFileName(judul, 'Data Tubuh'));
}
