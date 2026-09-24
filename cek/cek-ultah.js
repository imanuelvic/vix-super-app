// Uji ucapan ulang tahun: doa hikmat & kapasitas + ajakan bercerita ikut
// terbawa di SEMUA templat (grup, cowok, cewek, belum diisi gendernya).
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const src = fs.readFileSync(R + 'lib/core.ts', 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

// Blok ucapan ulang tahun ASLI, diambil apa adanya.
const a = src.indexOf('/** Doa penutup yang ikut di setiap ucapan. */');
const b = src.indexOf('// ==================== Kepribadian');
const js = ts.transpileModule(
  'type Gender = "m" | "f";\n' + src.slice(a, b).replace(/^export /gm, '') +
    '\nexports.birthdayGroupText = birthdayGroupText;' +
    '\nexports.birthdayPersonalText = birthdayPersonalText;',
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
).outputText;
const mod = { exports: {} };
new Function('exports', 'module', js)(mod.exports, mod);
const { birthdayGroupText, birthdayPersonalText } = mod.exports;

const SEMUA = [
  ['grup', birthdayGroupText('Riky')],
  ['pribadi · cowok', birthdayPersonalText('Riky', 'm')],
  ['pribadi · cewek', birthdayPersonalText('Sarah', 'f')],
  ['pribadi · gender belum diisi', birthdayPersonalText('Sarah', null)],
];

console.log('=== Kalimat baru ikut di SEMUA templat ===');
c('doa hikmat & perbesar kapasitas',
  SEMUA.every(([, t]) => t.includes('Kiranya Tuhan kasih hikmat & perbesar kapasitasmu')));
c('supaya jadi berkat buat orang sekitar',
  SEMUA.every(([, t]) => t.includes('makin jadi berkat buat orang-orang di sekitarmu')));
c('ajakan bercerita / minta didoakan',
  SEMUA.every(([, t]) => t.includes('Kalau ada yang mau didoakan atau mau cerita-cerita, silakan yaa 🤗')));
c('ajakannya jadi penutup, bukan nyempil di tengah',
  SEMUA.every(([, t]) => t.trimEnd().endsWith('silakan yaa 🤗')));

console.log('\n=== Yang lama TIDAK hilang ===');
c('ucapan grup tetap apa adanya',
  SEMUA[0][1].startsWith('Selamatt ulang tahun Riky 🔥💪'));
c('sapaan cowok "ma bro" tetap', SEMUA[1][1].includes('happy bday ma bro!'));
c('sapaan cewek tetap', SEMUA[2][1].includes('bersyukur bisa kenal Sarah'));
c('yang belum diisi gendernya tetap memakai versi netral (sama dengan cewek)',
  SEMUA[3][1] === SEMUA[2][1]);
c('4 baris doa lama masih lengkap', SEMUA.every(([, t]) =>
  ['berkenan & menyenangkan hati Tuhan', 'makin mengenal dan makin mengasihi Dia',
   'Bukan kehendak kita, tapi kehendak-Nya yang jadi',
   'Tuhan kirimkan orang-orang baik di sekelilingmu'].every((x) => t.includes(x))));
c('namanya tetap ikut tersulih di doanya', SEMUA[2][1].includes('🙏 Doaku buat Sarah:'));

console.log('\n=== Bentuk pesannya rapi ===');
c('tak ada baris kosong dobel yang menggantung',
  SEMUA.every(([, t]) => !/\n\n\n/.test(t)));
c('doanya dipisah satu baris kosong dari ucapannya',
  SEMUA.every(([, t]) => /\n\n🙏 Doaku buat/.test(t)));
c('satu sumber kalimat — tidak digandakan per templat',
  (src.match(/const BIRTHDAY_INVITE/g) || []).length === 1 &&
    (src.match(/function birthdayPrayer/g) || []).length === 1);

console.log('\n--- Contoh pesan pribadi (cowok) ---');
console.log(SEMUA[1][1].split('\n').map((l) => '  | ' + l).join('\n'));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
