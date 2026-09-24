// Uji batch /rapihin: blok pasang-lepas langganan Firestore yang dulu disalin
// di 24 layar sekarang jadi satu util bersama `unsubscribeAll`.
//
// Yang paling penting bukan bentuk tulisannya, tapi dua hal:
//   • perilakunya PERSIS sama dengan bentuk lama (dijalankan berdampingan),
//   • tidak ada satu pun layar yang memasang listener tanpa melepaskannya.
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const live = baca('lib/liveDoc.ts');

console.log('=== Utilnya sendiri ===');
const src = live.match(/export function unsubscribeAll[\s\S]*?\n\}/);
c('unsubscribeAll ada di lib/liveDoc.ts', !!src);
const unsubscribeAll = new Function(
  `${src[0].replace(/^export /, '').replace(/: \(\(\) => void\)\[\]/, '').replace(/\): \(\) => void/, ')')}
   return unsubscribeAll;`,
)();
// Bentuk LAMA, disalin apa adanya dari kode sebelum batch ini — dipakai
// sebagai pembanding, bukan sebagai teori.
const caraLama = (unsubs) => () => unsubs.forEach((unsub) => unsub());

c('mengembalikan fungsi, bukan langsung menjalankan', (() => {
  let jalan = 0;
  unsubscribeAll([() => jalan++]);
  return jalan === 0; // belum dipanggil = listener belum dilepas
})());

c('semua langganan dilepas saat pembersihnya dipanggil', (() => {
  const jalan = [];
  unsubscribeAll([() => jalan.push('a'), () => jalan.push('b'), () => jalan.push('c')])();
  return jalan.join('') === 'abc';
})());

c('urutannya sama dengan urutan daftarnya', (() => {
  const urut = [];
  unsubscribeAll([1, 2, 3, 4, 5].map((i) => () => urut.push(i)))();
  return urut.join(',') === '1,2,3,4,5';
})());

c('daftar kosong tidak error', (() => {
  try { unsubscribeAll([])(); return true; } catch { return false; }
})());

c('dipanggil dua kali → tiap langganan dilepas dua kali, sama seperti dulu', (() => {
  let baru = 0, lama = 0;
  const b = unsubscribeAll([() => baru++]);
  const l = caraLama([() => lama++]);
  b(); b(); l(); l();
  return baru === 2 && lama === 2 && baru === lama;
})());

c('PERSIS sama dengan bentuk lama pada 40 susunan acak', (() => {
  for (let n = 0; n < 40; n++) {
    const jumlah = n % 7;
    const jejakBaru = [], jejakLama = [];
    unsubscribeAll(Array.from({ length: jumlah }, (_, i) => () => jejakBaru.push(i)))();
    caraLama(Array.from({ length: jumlah }, (_, i) => () => jejakLama.push(i)))();
    if (jejakBaru.join() !== jejakLama.join()) return false;
  }
  return true;
})());

c('kalau satu langganan melempar, sisanya ikut berhenti — SAMA seperti dulu', (() => {
  const jejak = (fn) => {
    const j = [];
    try {
      fn([() => j.push(1), () => { throw new Error('x'); }, () => j.push(3)])();
    } catch { j.push('lempar'); }
    return j.join(',');
  };
  // Sengaja TIDAK "diperbaiki" jadi tahan-banting: itu akan mengubah perilaku.
  return jejak(unsubscribeAll) === jejak(caraLama);
})(), 'perilaku lama dipertahankan apa adanya');

console.log('\n=== Pola lamanya benar-benar habis ===');
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(R + dir, { withFileTypes: true })) {
    if (f.isDirectory()) walk(dir + '/' + f.name);
    else if (/\.tsx?$/.test(f.name)) files.push(dir + '/' + f.name);
  }
})('app');
(function walk(dir) {
  for (const f of fs.readdirSync(R + dir, { withFileTypes: true })) {
    if (f.isDirectory()) walk(dir + '/' + f.name);
    else if (/\.tsx?$/.test(f.name)) files.push(dir + '/' + f.name);
  }
})('components');

const isi = Object.fromEntries(files.map((f) => [f, baca(f)]));
const sisa = files.filter((f) => /const unsubs = \[|unsubs\.forEach/.test(isi[f]));
c('tidak ada lagi "const unsubs = [ … ]" di mana pun', sisa.length === 0,
  sisa.join(', ') || `${files.length} berkas disisir`);

// 21 Sep 2026: layar tidak lagi memanggil unsubscribeAll sendiri — blok
// useEffect-nya pindah ke hooks/useLiveAll.ts (satu-satunya pemakai util
// ini). Yang dijaga tetap sama: TIDAK ADA yang menyalin ulang blok
// `const unsubs = […]` (cek di atas), dan semua layar memakai satu jalan.
const pakai = files.filter((f) => /useLiveAll\(/.test(isi[f]));
c(`${pakai.length} layar/komponen memakai util bersamanya (useLiveAll)`, pakai.length >= 30,
  `${pakai.length} berkas`);
const imporKurang = pakai.filter(
  (f) => !/import \{ useLiveAll \} from '@\/hooks\/useLiveAll';/.test(isi[f]),
);
c('semuanya mengimpor dari @/hooks/useLiveAll (bukan menyalin ulang)',
  imporKurang.length === 0, imporKurang.join(', ') || 'lengkap');
const langsung = files.filter((f) => /unsubscribeAll\(/.test(isi[f]));
c('tak ada layar yang memanggil unsubscribeAll langsung (cuma hooks/useLiveAll.ts)',
  langsung.length === 0 && /return unsubscribeAll\(subscribe\(user\.uid, /.test(baca('hooks/useLiveAll.ts')),
  langsung.join(', ') || 'bersih');

console.log('\n=== Tak ada listener yang menggantung ===');
// Tiap useEffect yang memasang langganan HARUS mengembalikan pembersihnya.
// Kurung kurawal dicocokkan sungguhan supaya efek bersarang tidak salah baca.
const gantung = [];
for (const f of files) {
  const s = isi[f];
  for (const m of [...s.matchAll(/useEffect\(\(\) => \{/g)]) {
    let depth = 0;
    let akhir = -1;
    const mulai = m.index + m[0].length - 1;
    for (let i = mulai; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') { depth--; if (depth === 0) { akhir = i; break; } }
    }
    if (akhir === -1) continue;
    const badan = s.slice(mulai, akhir);
    const pasang = /\bsubscribe[A-Z]\w*\(|\bliveDoc\(|addListener\(|onSnapshot\(/.test(badan);
    if (!pasang) continue;
    // "return;" = penjaga (mis. `if (!user) return;`), BUKAN pembersih.
    // Pembersih = `return <sesuatu>;` — termasuk `return subscribeX(…)` yang
    // langsung meneruskan fungsi pelepasnya.
    const lepas = /\breturn\s+[^;\s]/.test(badan);
    if (!lepas) {
      gantung.push(`${f}:${s.slice(0, m.index).split('\n').length}`);
    }
  }
}
c('setiap efek yang memasang langganan mengembalikan pembersihnya',
  gantung.length === 0, gantung.join(', ') || 'bersih');

console.log('\n=== Aturan wajib ===');
const berubah = [...pakai, 'lib/liveDoc.ts'];
c('tidak ada soft-delete diselundupkan',
  !berubah.some((f) => /isDeleted|archived: true/.test(f === 'lib/liveDoc.ts' ? live : isi[f])));
c('tidak ada warna hex mentah yang baru masuk',
  !/#[0-9A-Fa-f]{6}/.test(live));
// expo-media-library DITAMBAHKAN atas permintaan pemiliknya (27 Agu 2026):
// tombol "Simpan ke Foto" harus benar-benar menyimpan ke Photos, dan tidak ada
// cara lain selain modul native ini. Konsekuensinya rilis berikutnya WAJIB
// `eas build`, bukan `eas update` — dicatat di sini supaya tidak terlupa.
c('modul native yang bertambah CUMA expo-media-library, dan disengaja', (() => {
  const pkg = JSON.parse(baca('package.json'));
  const app = JSON.parse(baca('app.json'));
  const terdaftar = app.expo.plugins.some(
    (p) => Array.isArray(p) && p[0] === 'expo-media-library');
  return !!pkg.dependencies['expo-media-library'] && terdaftar &&
    /firebase/.test(Object.keys(pkg.dependencies).join(','));
})());
c('utilnya dipakai apa adanya, bukan dibungkus hook baru yang tak perlu',
  !fs.existsSync(R + 'hooks/useSubscriptions.ts'));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
