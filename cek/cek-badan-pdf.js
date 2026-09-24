// 15 Sep 2026 sore: (1) Data Tubuh CL bisa dibagikan sebagai PDF (angka +
// arti yang lembut + tips sehat dunia; bagian khusus untuk yang berlebih),
// hitungannya satu sumber (bodySummary) dengan dialognya. (2) Modal baca
// CL/Main Team: "Gender" di samping 📱 No. HP, Love Language di samping MBTI.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-badan-pdf');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const dialog = baca('components/core/LeaderBodyDialog.tsx');
const pdfSrc = baca('lib/leaderBodyPdf.ts');
const health = baca('lib/health.ts');
const leaders = baca('components/core/LeadersTab.tsx');

// ============ Statis: dialog & modal ============
console.log('\n=== Dialog Data Tubuh: tombol bagikan ===');
ok('tombol share (ikon yang sama dengan Wheel/Timeline) ada di kepala dialog',
  /<EmojiButton\s*\n\s*icon="square\.and\.arrow\.up"\s*\n\s*onPress=\{bagikan\}/.test(dialog));
ok('cuma tampil kalau memang ada data tubuh', /\{ada && \(\s*\n\s*<EmojiButton/.test(dialog));
ok('tidak bisa dobel & tombolnya berputar saat mencetak (useBusyTask)',
  /const tugas = useBusyTask<'pdf'>\(\);/.test(dialog) &&
  /busy=\{tugas\.busy === 'pdf'\}\s*\n\s*disabled=\{tugas\.busy !== null\}/.test(dialog));
ok('gagal → pesan di dalam dialog, bersih lagi saat ditutup',
  /fail: \(\) => setError\(pdfErrorOf\('Data Tubuh'\)\)/.test(dialog) &&
  /Gagal membuat PDF \$\{apa\}\. Coba lagi\./.test(baca('lib/messages.ts')) &&
  /<FormError message=\{error\} gap="top" \/>/.test(dialog) &&
  /function tutup\(\) \{\s*\n\s*setError\(null\);\s*\n\s*onClose\(\);/.test(dialog) &&
  /onClose=\{tutup\}/.test(dialog) && /onPress=\{tutup\}/.test(dialog));
ok('hitungan dialog & PDF satu sumber: bodySummary di lib/health',
  /export function bodySummary\(/.test(health) &&
  /= bodySummary\(leader \?\? \{\}\);/.test(dialog) &&
  /bodySummary\(leader\)/.test(pdfSrc) &&
  !/bmiValue|bmiCategory|idealWeightRange/.test(dialog));
ok('tampilan barisnya tidak berubah (Tinggi/Berat/Berat ideal/BMI/Lingkar perut/Rasio)',
  ['label="Tinggi"', 'label="Berat"', 'label="Berat ideal"', 'label="BMI"', 'label="Lingkar perut"', 'label="Rasio perut/tinggi"']
    .every((t) => dialog.includes(t)));

console.log('\n=== Modal baca CL / Main Team: lebih pendek ===');
ok('"Cowok / Cewek" jadi "Gender" (form & modal baca)',
  !/Cowok \/ Cewek/.test(leaders) && (leaders.match(/🚻 Gender/g) || []).length === 2);
ok('📱 No. HP & Gender berdampingan',
  /<View style=\{styles\.viewPair\}>\s*\n\s*<InfoRow\s*\n\s*label="📱 No\. HP"[\s\S]{0,120}half\s*\n\s*\/>\s*\n\s*\{jenis \? <InfoRow label="🚻 Gender" value=\{jenis\} half \/> : null\}\s*\n\s*<\/View>/.test(leaders));
ok('MBTI & Love Language berdampingan (barisnya tidak dibuat kalau dua-duanya kosong)',
  /\{person\.mbti \|\| love \? \(\s*\n\s*<View style=\{styles\.viewPair\}>\s*\n\s*\{person\.mbti \? <InfoRow label="🧩 MBTI" value=\{person\.mbti\} half \/> : null\}\s*\n\s*\{love \? <InfoRow label="💞 Love Language" value=\{love\} half \/> : null\}/.test(leaders));
ok('tiap paruh membagi lebar sama rata',
  /viewPair: \{ flexDirection: 'row', gap: 12 \}/.test(leaders) && /viewHalf: \{ flex: 1 \}/.test(leaders) &&
  /style=\{\[styles\.viewRow, half && styles\.viewHalf\]\}/.test(leaders));
// Dilihat di badan PersonView saja: label yang sama juga dipakai formulir
// isiannya lebih atas di berkas ini.
const modalBaca = leaders.slice(leaders.indexOf('function PersonView('), leaders.indexOf('function InfoRow('));
ok('urutan sisanya tetap: lahir → ulang tahun → HP+Gender → pendidikan → pekerjaan → DISC → MBTI+Love',
  // 22 Sep 2026: "🎂 Tanggal Lahir" / "Ulang Tahun" dikapitalkan sendiri oleh pemilik app.
  ['🎂 Tanggal Lahir', '🎈 Ulang Tahun', '📱 No. HP', '🚻 Gender" value={jenis}', '🎓 Pendidikan', '💼 Pekerjaan', '🎨 DISC', '🧩 MBTI', '💞 Love Language" value={love}']
    .every((t, i, arr) => modalBaca.includes(t) && (i === 0 || modalBaca.indexOf(arr[i - 1]) < modalBaca.indexOf(t))));

// ============ Dijalankan sungguhan: isi PDF-nya ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/leaderBodyPdf.ts'), path.join(ROOT, 'lib/health.ts'),
      path.join(ROOT, 'lib/format.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

let dibagikan = null;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === './pdfDoc') {
    return {
      escapeHtml: esc,
      pdfFileName: (t, f) => `${t || f}.pdf`,
      pdfShellHtml: (a) => JSON.stringify({ ...a, extraCss: undefined }),
      sharePdf: async (html, judul, nama) => { dibagikan = { html, judul, nama }; },
    };
  }
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req === './streak') return { alreadyCounted: () => false, nextStreak: () => ({}) };
  if (req === './reward') return {};
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const H = require(path.join(OUT, 'health.js'));
const P = require(path.join(OUT, 'leaderBodyPdf.js'));
Module._load = asli;

console.log('\n=== bodySummary: satu sumber hitungan ===');
const reyki = { name: 'Reyki', heart: '🖤', heightCm: 173, weightKg: 87, waistCm: null, bodyUpdatedDayId: '2026-09-12' };
const r = H.bodySummary(reyki);
ok('Reyki 173 cm / 87 kg → BMI 29,1 Obesitas I, ideal 55,4–68,5',
  r.lengkap && r.bmi.toFixed(1) === '29.1' && r.kategori.label === 'Obesitas I' &&
  r.ideal.min.toFixed(1) === '55.4' && r.ideal.max.toFixed(1) === '68.5' && r.rasio === null);
const elvina = { name: 'Elvina', heart: '🧡', heightCm: 165, weightKg: 65, waistCm: 80, bodyUpdatedDayId: '2026-09-07' };
const e = H.bodySummary(elvina);
ok('Elvina + lingkar perut 80 → rasio 0,48 (sehat), BMI 23,9 Berlebih',
  e.rasio.toFixed(2) === '0.48' && e.kategori.label === 'Berlebih (berisiko)');
const kosong = H.bodySummary({ waistCm: 90 });
ok('cuma lingkar perut → BMI/kategori/ideal/rasio null, bukan 0',
  !kosong.lengkap && kosong.bmi === null && kosong.kategori === null && kosong.ideal === null && kosong.rasio === null);

const KATA_TERLARANG = /klik|ketuk|\btekan\b|ditekan|menekan|beruntun|Rentetan/i;

(async () => {
  console.log('\n=== PDF: yang berlebih (Reyki) ===');
  await P.shareLeaderBodyPdf(reyki, new Date(2026, 8, 15, 17, 54));
  let d = JSON.parse(dibagikan.html);
  ok('judul & nama berkas: "Data Tubuh 🖤 Reyki"',
    d.title === 'Data Tubuh 🖤 Reyki' && dibagikan.nama === 'Data Tubuh 🖤 Reyki.pdf' &&
    dibagikan.judul === 'Bagikan Data Tubuh');
  ok('kop: eyebrow DATA TUBUH, sebut area Health Wheel of Life',
    d.eyebrow === 'DATA TUBUH' && /🍎 Health di Wheel of Life/.test(d.subtitle));
  ok('kartu keterangan: diperbarui, BMI, berat ideal, dicetak',
    d.chips.map((c) => c.label).join(',') === 'Diperbarui,BMI,Berat ideal,Dicetak' &&
    d.chips[0].value === 'Sabtu, 12 September 2026' &&
    d.chips[1].value === '29,1 · Obesitas I' && d.chips[2].value === '55,4–68,5 kg');
  ok('tabel angka: tinggi, berat, berat ideal, BMI merah',
    /Tinggi<\/span>\s*<span class="nilai">173 cm/.test(d.bodyHtml) &&
    /Berat<\/span>\s*<span class="nilai">87 kg/.test(d.bodyHtml) &&
    /Berat ideal<\/span>\s*<span class="nilai">55,4–68,5 kg/.test(d.bodyHtml) &&
    /BMI<\/span>\s*<span class="nilai" style="color:#C0392B">29,1 · Obesitas I/.test(d.bodyHtml));
  ok('"apa artinya": lembut, jaraknya dipecah per minggu, target 5% dulu',
    /Angka ini bukan penilaian tentang dirinya, cuma titik awal yang jujur/.test(d.bodyHtml) &&
    /jaraknya 18,5 kg/.test(d.bodyHtml) &&
    /Turun 0,5–1 kg seminggu \(kira-kira 25 minggu, sekitar 6 bulan\)/.test(d.bodyHtml) &&
    /5% dari berat sekarang, sekitar 4,4 kg dalam 3 bulan/.test(d.bodyHtml));
  ok('BMI < 30 → belum menyarankan dokter', !/berkonsultasi ke dokter/.test(d.bodyHtml));
  ok('lingkar perut kosong → diajak mengukur, bukan dinilai',
    /Lingkar perutnya belum diisi\. Ukur sekali dengan meteran jahit/.test(d.bodyHtml));
  ok('tips dunia: jalan/lari 30 menit (WHO 150 menit), 5.000 langkah, tidur, air, piring seimbang',
    /Jalan atau lari pagi 30 menit sehari/.test(d.bodyHtml) && /150 menit aktivitas sedang seminggu/.test(d.bodyHtml) &&
    /Mulai dari 5\.000 langkah sehari/.test(d.bodyHtml) && /Tidur 7–9 jam/.test(d.bodyHtml) &&
    /Air putih 8 gelas sehari/.test(d.bodyHtml) && /Piring seimbang/.test(d.bodyHtml) &&
    /Latihan kekuatan 2 hari seminggu/.test(d.bodyHtml));
  ok('yang berlebih dapat bagian "Langkah kecil untuk Reyki" (7 tips hangat)',
    /<h2>💛 Langkah kecil untuk Reyki<\/h2>/.test(d.bodyHtml) &&
    (d.bodyHtml.match(/class="tip hangat"/g) || []).length === 7 &&
    /Hindari diet ekstrem/.test(d.bodyHtml) && /Jangan sendirian/.test(d.bodyHtml) && /Gagal seminggu itu biasa/.test(d.bodyHtml));
  ok('penutup mengaitkan ke area Health Wheel of Life',
    /class="penutup">Badan yang sehat itu bagian dari area 🍎 Health di Wheel of Life/.test(d.bodyHtml));
  ok('kaki: judul + waktu cetak', d.footerNote === 'Data Tubuh 🖤 Reyki · dicetak Selasa, 15 September 2026 · 🕒 17.54');
  ok('tidak ada tanda pisah panjang & kata terlarang di teks PDF',
    !/—/.test(dibagikan.html) && !KATA_TERLARANG.test(d.bodyHtml.replace(/tekanan/g, '')));

  console.log('\n=== PDF: BMI 30 ke atas ===');
  await P.shareLeaderBodyPdf({ ...reyki, weightKg: 95 });
  d = JSON.parse(dibagikan.html);
  ok('Obesitas II → diajak berkonsultasi ke dokter, dengan nada peduli',
    /Obesitas II/.test(d.bodyHtml) && /berkonsultasi ke dokter; itu tanda peduli, bukan tanda gagal/.test(d.bodyHtml));

  console.log('\n=== PDF: yang normal (Novia) ===');
  await P.shareLeaderBodyPdf({ name: 'Novia', heart: '💚', heightCm: 169.5, weightKg: 63, waistCm: null, bodyUpdatedDayId: '2026-09-11' });
  d = JSON.parse(dibagikan.html);
  ok('BMI normal → "tepat di rentang normal", TANPA bagian langkah kecil',
    /tepat di rentang normal/.test(d.bodyHtml) && !/Langkah kecil untuk/.test(d.bodyHtml) &&
    !/class="tip hangat"/.test(d.bodyHtml));
  ok('tips umumnya tetap ikut (8 kartu)', (d.bodyHtml.match(/class="tip"/g) || []).length === 8);

  console.log('\n=== PDF: berlebih ringan dengan lingkar perut (Elvina) ===');
  await P.shareLeaderBodyPdf(elvina);
  d = JSON.parse(dibagikan.html);
  ok('zona "perhatian", bukan bahaya; rasio 0,48 sehat',
    /zona "perhatian", bukan zona bahaya/.test(d.bodyHtml) &&
    /rasio 0,48\)\. Tanda lemak perutnya terjaga/.test(d.bodyHtml) &&
    /Rasio perut\/tinggi<\/span>\s*<span class="nilai" style="color:#1D8D7A">0,48 · Sehat/.test(d.bodyHtml));
  ok('berlebih ringan pun dapat bagian langkah kecil', /Langkah kecil untuk Elvina/.test(d.bodyHtml));

  console.log('\n=== PDF: perut lebih dari setengah tinggi ===');
  await P.shareLeaderBodyPdf({ ...elvina, waistCm: 90 });
  d = JSON.parse(dibagikan.html);
  ok('rasio ≥ 0,5 → target lingkar perut di bawah setengah tinggi (82 cm)',
    /rasio 0,55\)\. Lemak di perut/.test(d.bodyHtml) && /lingkar perut di bawah 82 cm/.test(d.bodyHtml) &&
    /0,55 · Perhatian/.test(d.bodyHtml));

  console.log('\n=== PDF: berat kurang & data belum lengkap ===');
  await P.shareLeaderBodyPdf({ name: 'Adi', heart: '💙', heightCm: 175, weightKg: 52, waistCm: null, bodyUpdatedDayId: null });
  d = JSON.parse(dibagikan.html);
  ok('BMI 17 → "sedikit di bawah rentang normal", makan teratur + latihan kekuatan',
    /sedikit di bawah rentang normal/.test(d.bodyHtml) && /Makan teratur 3 kali/.test(d.bodyHtml) &&
    !/Langkah kecil untuk/.test(d.bodyHtml));
  ok('belum pernah diperbarui → chip "belum pernah"', d.chips[0].value === 'belum pernah');
  await P.shareLeaderBodyPdf({ name: 'Budi', heart: '💛', heightCm: null, weightKg: null, waistCm: 85, bodyUpdatedDayId: null });
  d = JSON.parse(dibagikan.html);
  ok('cuma lingkar perut → BMI "belum lengkap", diajak melengkapi lewat ✏️',
    d.chips[1].value === 'belum lengkap' && /belum lengkap, jadi BMI dan berat idealnya belum bisa dihitung/.test(d.bodyHtml) &&
    /Lingkar perut<\/span>\s*<span class="nilai">85 cm/.test(d.bodyHtml));
  await P.shareLeaderBodyPdf({ ...reyki, name: 'A <b>' });
  d = JSON.parse(dibagikan.html);
  ok('nama dengan karakter HTML tetap aman (escape)',
    /Langkah kecil untuk A &lt;b&gt;/.test(d.bodyHtml) && /BMI A &lt;b&gt; 29,1/.test(d.bodyHtml));

  console.log(gagal === 0 ? '\n✅ LULUS — PDF Data Tubuh & modal ringkas beres.' : `\n❌ ${gagal} cek gagal.`);
  process.exit(gagal === 0 ? 0 : 1);
})();
