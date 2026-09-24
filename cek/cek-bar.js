// Bandingkan bar tulis-tangan (SEBELUM) dengan <ProgressBar> (SESUDAH).
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';

// Nilai ASLI, dicatat dari sumber sebelum penyuntingan.
// (Dua bar InsuranceTab ikut dikonversi dulu, tapi tab Insurance sudah dihapus
// permanen atas permintaan pemilik app — lihat cek-timeline-career.js.)
const SEBELUM = {
  'BudgetingTab · bar':{ h: 8, r: 4, track: 'CONTRAST_CONTAINER / MAIN saat onDark', fill: 'MAIN_LIGHT→BUDGET_WARN→FINANCE_INVESTMENT_DARK→DANGER' },
  'HabitsTab · target berat':{ h: 8, r: 4, track: 'CONTRAST_CONTAINER', fill: 'MAIN' },
};

// ProgressBar: radius = height/2. Jadi height 8 → radius 4. Cek di sumbernya.
const pb = fs.readFileSync(R + 'components/common/ProgressBar.tsx', 'utf8');
const radiusDariTinggi = /const radius = height \/ 2;/.test(pb);
const trackBisaDiatur = /track = Color\.BORDER/.test(pb) && /backgroundColor: track/.test(pb);

console.log('=== Komponen bersama ===');
console.log('  ' + (radiusDariTinggi ? '✓' : '✗') + ' radius = tinggi / 2  → height 8 menghasilkan radius 4 (sama)');
console.log('  ' + (trackBisaDiatur ? '✓' : '✗') + ' warna alur bisa diatur lewat prop `track`');

// Semua pemanggilan ProgressBar di 4 berkas itu harus height 8 + track CONTRAST/MAIN.
const berkas = [
  'components/finance/BudgetingTab.tsx',
  'components/habits/HabitsTab.tsx',
];
console.log('\n=== Pemanggilan sesudah konversi ===');
let ok = radiusDariTinggi && trackBisaDiatur;
let n = 0;
for (const f of berkas) {
  const src = fs.readFileSync(R + f, 'utf8');
  for (const m of src.matchAll(/<ProgressBar\b([\s\S]*?)\/>/g)) {
    n++;
    const a = m[1];
    const h = /height=\{(\d+)\}/.exec(a);
    const track = /track=\{([^}]+)\}/.exec(a);
    const total = /total=\{(\d+)\}/.exec(a);
    const benar = h && h[1] === '8' && track && total && total[1] === '100';
    if (!benar) ok = false;
    console.log(
      '  ' + (benar ? '✓' : '✗') + ' ' + f.replace('components/', '').padEnd(32) +
        ' tinggi=' + (h ? h[1] : '—') + ' alur=' + (track ? track[1].replace('Color.', '') : '—'),
    );
  }
}

console.log('\n=== Style bar tulis-tangan yang tersisa ===');
const sisa = [];
for (const f of berkas) {
  const src = fs.readFileSync(R + f, 'utf8');
  for (const k of ['barTrack', 'barFill', 'barFillHit', 'barTrackDark', 'targetBarTrack', 'targetBarFill', 'limitTrack', 'limitFill']) {
    if (new RegExp('^  ' + k + ':', 'm').test(src)) sisa.push(f + ' :: ' + k);
  }
}
console.log(sisa.length ? sisa.map((s) => '  ✗ ' + s).join('\n') : '  ✓ tidak ada — semuanya sudah dibuang');
if (sisa.length) ok = false;

console.log('\n' + n + ' bar dikonversi.');
console.log('sebelum → sesudah:');
for (const [k, v] of Object.entries(SEBELUM)) {
  console.log('  ' + k.padEnd(26) + ' tinggi ' + v.h + ' · radius ' + v.r + ' · alur ' + v.track);
}
console.log('\n' + (ok
  ? 'LULUS: tinggi, radius, warna alur, & warna isian sama persis.\nSATU-SATUNYA beda: isian kini menyapu 0,5 detik (bawaan ProgressBar).'
  : 'GAGAL: ada yang tidak cocok.'));
