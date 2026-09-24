// Buktikan pola penyegar Home: jam & kalimatnya benar-benar diundi, tapi tetap
// stabil dalam satu hari. Fungsi yang diuji diambil APA ADANYA dari sumber.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };
const jam = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`;

function muat(kode, luar = {}) {
  const mod = { exports: {} };
  const nama = Object.keys(luar);
  const js = ts.transpileModule(kode, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'module', ...nama, js)(mod.exports, mod, ...nama.map((n) => luar[n]));
  return mod.exports;
}

// hashString & pickOfDay ASLI dari lib/core.ts.
const coreSrc = baca('lib/core.ts');
const potong = (src, nama) => {
  const a = src.indexOf(`export function ${nama}`);
  const b = src.indexOf('\n}', a) + 2;
  return src.slice(a, b).replace('export function', 'function');
};
const util = muat(
  potong(coreSrc, 'hashString') + potong(coreSrc, 'pickOfDay') +
    '\nexport { hashString, pickOfDay };',
);

// Blok penyegar ASLI dari lib/spiritual.ts.
const spiritSrc = baca('lib/spiritual.ts');
const a = spiritSrc.indexOf('const REMINDERS');
const b = spiritSrc.indexOf('// ===================== Aplikasi NDC Ministry');
const spirit = muat(
  spiritSrc.slice(a, b).replace(/^export /gm, '') +
    '\nexport { REMINDERS, dailyReminder, nudgeSchedule, activeNudge };',
  { hashString: util.hashString, pickOfDay: util.pickOfDay },
);
const { REMINDERS, nudgeSchedule, activeNudge, dailyReminder } = spirit;

const HARI = [];
for (let i = 0; i < 365; i++) {
  const d = new Date(2026, 0, 1 + i);
  HARI.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
}

console.log('=== Bentuk jadwalnya ===');
console.log(`  ${REMINDERS.length} kalimat di daftar`);
const contoh = nudgeSchedule('2026-08-20');
console.log('  contoh 20 Agu 2026:');
for (const n of contoh) console.log(`    ${jam(n.from)}–${jam(n.to)}  ${n.text.slice(0, 52)}…`);

c('3 kali sehari', HARI.every((d) => nudgeSchedule(d).length === 3));
c('semua di dalam jendela 06.00–22.00',
  HARI.every((d) => nudgeSchedule(d).every((n) => n.from >= 6 * 60 && n.to <= 22 * 60)));
c('tampil 1 jam tiap kali', HARI.every((d) => nudgeSchedule(d).every((n) => n.to - n.from === 60)));
c('jeda antar-kemunculan minimal 1 jam',
  HARI.every((d) => {
    const s = nudgeSchedule(d);
    return s[1].from - s[0].to >= 60 && s[2].from - s[1].to >= 60;
  }));
c('kalimatnya BEDA-BEDA dalam satu hari',
  HARI.every((d) => new Set(nudgeSchedule(d).map((n) => n.text)).size === 3));

console.log('\n=== Benar-benar stabil dalam sehari (bukan Math.random) ===');
const sekali = JSON.stringify(nudgeSchedule('2026-08-20'));
c('dipanggil 50× hasilnya identik',
  Array.from({ length: 50 }, () => JSON.stringify(nudgeSchedule('2026-08-20'))).every((x) => x === sekali));
c('kartunya tidak berkedip: jam 10.00 & 10.59 di slot yang sama, hasilnya sama', (() => {
  const s = nudgeSchedule('2026-08-20')[0];
  const t1 = new Date(2026, 7, 20, Math.floor(s.from / 60), s.from % 60);
  const t2 = new Date(2026, 7, 20, Math.floor((s.to - 1) / 60), (s.to - 1) % 60);
  // 31 Agu 2026: activeNudge mengembalikan Nudge utuh (bukan cuma teksnya),
  // karena kartunya perlu tahu kalimat itu datang dari Revive hari yang mana.
  return activeNudge(t1, '2026-08-20').text === s.text && activeNudge(t2, '2026-08-20').text === s.text;
})());
c('di luar slot → tidak muncul sama sekali', (() => {
  const s = nudgeSchedule('2026-08-20');
  const luar = new Date(2026, 7, 20, Math.floor(s[0].to / 60), s[0].to % 60); // tepat sesudah slot 1
  return activeNudge(luar, '2026-08-20') === null;
})());
c('dini hari selalu kosong (05.59)',
  HARI.every((d) => activeNudge(new Date(2026, 0, 1, 5, 59), d) === null));

console.log('\n=== Acaknya nyata: sebar jam & kalimat sepanjang 2026 ===');
const jamMulai = new Set();
const kalimatDipakai = new Map();
let samaDenganKemarin = 0;
for (let i = 0; i < HARI.length; i++) {
  const s = nudgeSchedule(HARI[i]);
  for (const n of s) {
    jamMulai.add(n.from);
    kalimatDipakai.set(n.text, (kalimatDipakai.get(n.text) ?? 0) + 1);
  }
  if (i > 0 && JSON.stringify(s.map((n) => n.from)) === JSON.stringify(nudgeSchedule(HARI[i - 1]).map((n) => n.from))) {
    samaDenganKemarin++;
  }
}
const slot1 = HARI.map((d) => nudgeSchedule(d)[0].from);
const slot3 = HARI.map((d) => nudgeSchedule(d)[2].from);
console.log(`  ${jamMulai.size} menit-mulai berbeda terpakai dalam setahun (dari 1095 kemunculan)`);
console.log(`  kemunculan ke-1 : ${jam(Math.min(...slot1))} – ${jam(Math.max(...slot1))}`);
console.log(`  kemunculan ke-3 : ${jam(Math.min(...slot3))} – ${jam(Math.max(...slot3))}`);
console.log(`  ${kalimatDipakai.size} dari ${REMINDERS.length} kalimat kepakai dalam setahun`);
c('jamnya bervariasi, bukan patokan tetap', jamMulai.size > 300);
c('jadwalnya hampir tak pernah sama 2 hari beruntun', samaDenganKemarin <= 3);
c('SEMUA kalimat kebagian dalam setahun', kalimatDipakai.size === REMINDERS.length);
c('tidak ada kalimat yang mendominasi (≤ 3× rata-rata)', (() => {
  const rata = 1095 / REMINDERS.length;
  return Math.max(...kalimatDipakai.values()) <= rata * 3;
})());
c('jam kemunculan PERTAMA sendiri bervariasi tiap hari', new Set(slot1).size > 100);

console.log('\n=== Reminder layar (Revive & Baca Alkitab) tak saling menyalin ===');
c('garam beda → kalimatnya beda di hari yang sama', (() => {
  let beda = 0;
  for (const d of HARI) {
    const a2 = dailyReminder(d, 'revive');
    const b2 = dailyReminder(d, 'baca-morning');
    const c2 = dailyReminder(d, 'baca-night');
    if (a2 !== b2 && b2 !== c2 && a2 !== c2) beda++;
  }
  console.log(`  ${beda}/${HARI.length} hari ketiganya benar-benar beda`);
  return beda / HARI.length > 0.8;
})());

console.log('\n=== Pesan WhatsApp pokok doa ===');
const chain = muat(
  potong(coreSrc, 'prayerChainMessage')
    .replace('function prayerChainMessage', 'function prayerChainMessage') +
    coreSrc.slice(coreSrc.indexOf('function sambungKalimat'), coreSrc.indexOf('\n}', coreSrc.indexOf('function sambungKalimat')) + 2) +
    '\nexport { prayerChainMessage };',
);
// Pokok doa NYATA dari foto WhatsApp Theofilus.
const pesan = chain.prayerChainMessage('Theofilus', [
  'Kesehatan - Lagi Batuk, Suara agak ilang, Flu',
  'Project Sebulan kedepan biar bisa lancar',
  'Semakin diberi hikmat untuk melayani di Gereja dan CORE',
  'Damai Sejahtera dan Sukacita selaluu',
]);
c('menyapa dengan namanya', pesan.startsWith('Shalom Theofilus! 🙏'));
c('memakai gaya "Gw … lu", bukan "Aku … kamu"',
  pesan.includes('Gw lagi mendoakan lu utk pokok doa bulan ini') && !pesan.includes('Aku lagi mendoakan'));
// Isi poinnya utuh — hanya huruf PERTAMA tiap poin yang diturunkan.
c('SEMUA pokok doa ikut terbawa', [
  'Lagi Batuk, Suara agak ilang, Flu', 'Sebulan kedepan biar bisa lancar',
  'hikmat untuk melayani di Gereja dan CORE', 'Sejahtera dan Sukacita selaluu',
].every((x) => pesan.includes(x)));
c('tiap poin jadi kalimat "Gw doakan"', (pesan.match(/Gw doakan/g) || []).length === 4);
c('poin ke-2 dst pakai "Gw doakan jg"', (pesan.match(/Gw doakan jg/g) || []).length === 3);
c('huruf depan diturunkan biar nyambung', pesan.includes('Gw doakan kesehatan - Lagi Batuk'));
c('singkatan HURUF BESAR tidak dirusak',
  chain.prayerChainMessage('X', ['CORE makin bertumbuh']).includes('Gw doakan CORE makin bertumbuh'));
c('ditutup kalimat penyemangat', pesan.includes('finish strong'));
c('belum ada pokok doa → tetap sopan, tanpa baris kosong menggantung', (() => {
  const kosong = chain.prayerChainMessage('Riky', []);
  return !kosong.includes('\n\n\n') && kosong.includes('Shalom Riky') && !kosong.includes('Gw doakan ');
})());

console.log('\n--- Pesan yang benar-benar terkirim ---');
console.log(pesan.split('\n').map((l) => '  | ' + l).join('\n'));

console.log('\n=== Gerbang doa pagi tak lagi melempar ke fitur CORE ===');
// 21 Sep 2026: gerbangnya jadi Morning Journey; Doa Rantai di langkah 🙏 Pray.
const gate = baca('components/spiritual/journey/JourneySteps.tsx');
const mp = baca('app/morning-journey.tsx');
c('tombol "Buka Doa Rantai →" sudah tidak ada', !/Buka Doa Rantai/.test(gate));
c('tidak ada lagi navigasi ke /core dari gerbang', !/'\/core'/.test(mp) && !/onOpenChain/.test(mp + gate));
c('pokok doa tiap CL tampil langsung di gerbang', /chainLeaders\.map\(/.test(gate));
c('tombol WA per CL memakai pesan yang sama dengan tab Follow Up',
  /prayerChainMessage\(leader\.name, leader\.points\)/.test(mp) &&
    /prayerChainMessage\(prayerModal\.name, pmPts\)/.test(baca('components/core/FollowupTab.tsx')));
c('penanda "sudah didoakan" ditulis lewat aturan bersama',
  /markPrayerFollowed/.test(mp) && /markPrayerFollowed/.test(baca('components/core/FollowupTab.tsx')) &&
    (coreSrc.match(/export function markPrayerFollowed/g) || []).length === 1);

console.log('\n=== Emoji tak lagi kepotong ===');
const dash = baca('app/reminders.tsx');
c('streakIcon lineHeight = 1,5× fontSize (dulu 1,18×)',
  /streakIcon: \{ fontSize: 22, lineHeight: 33 \}/.test(dash));

console.log('\n=== Blok reminder + NDC Ministry dipakai bersama ===');
c('komponennya satu', /export function SpiritualIntro/.test(baca('components/spiritual/SpiritualIntro.tsx')));
c('Revive memakainya', /<SpiritualIntro reminder=\{reminder\} \/>/.test(baca('app/revive.tsx')));
// 28 Agu 2026: tombolnya boleh menuju app yang BEDA per layar — Baca Alkitab
// membuka YouVersion (Alkitabnya), Revive tetap NDC Ministry (renungannya).
c('Baca Alkitab memakainya',
  /<SpiritualIntro\s*\n\s*reminder=\{dailyReminder\(dayId, `baca-\$\{session\}`\)\}\s*\n\s*app="youversion"/.test(
    baca('app/bible-reading.tsx'),
  ));
c('deep link NDC & YouVersion cuma ditulis sekali (di lib/spiritual.ts)',
  /const NDC_DEEPLINK/.test(spiritSrc) &&
    /const YOUVERSION_DEEPLINK/.test(spiritSrc) &&
    !/ndc:\/\//.test(baca('app/revive.tsx')) &&
    !/youversion:\/\//.test(baca('app/bible-reading.tsx')));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
