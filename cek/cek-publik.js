// Uji: repo ini aman dibuka ke publik, dan orang yang meng-clone TIDAK
// tersambung ke Firebase / server / data pemilik.
//
// Yang paling penting di sini bukan regex, tapi dua hal yang diperiksa
// sungguhan:
//   1. Nilai ASLI dari .env dicari di SELURUH berkas yang dilacak git DAN di
//      SELURUH riwayat commit. Kalau satu saja bocor, uji ini gagal.
//   2. Firebase JS SDK yang asli dipanggil dengan config kosong untuk
//      membuktikan bahwa Auth memang MELEMPAR — itu sebabnya lib/firebase.ts
//      tidak boleh menyentuhnya saat .env belum diisi.
const AKAR = require('./akar');
const fs = require('fs');
const { execSync } = require('child_process');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');
const git = (cmd) =>
  execSync(`git ${cmd}`, { cwd: R, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const dilacak = git('ls-files').trim().split('\n');

console.log('=== Tidak ada rahasia yang ikut ke repo ===');
c('.env TIDAK dilacak git', !dilacak.includes('.env'));
c('.env.example dilacak (sebagai contoh, isinya kosong)',
  dilacak.includes('.env.example'));
c('.env.example benar-benar kosong nilainya', (() => {
  // Per BARIS — `\s` polos ikut memakan baris baru, jadi baris kosong
  // sekalipun dikira berisi.
  const isi = baca('.env.example').replace(/^#.*$/gm, '');
  return !/^[^#\n]*=[^\n]*\S/m.test(isi);
})());
c('tidak ada berkas kredensial yang dilacak',
  !dilacak.some((f) =>
    /google-services\.json|GoogleService-Info\.plist|serviceAccount|adminsdk|\.p8$|\.p12$|\.jks$|\.pem$|\.key$/i.test(f)),
  dilacak.filter((f) => /serviceAccount|adminsdk/i.test(f)).join(', ') || 'bersih');

console.log('\n=== Nilai .env asli tidak bocor ke mana pun ===');
const env = {};
for (const l of baca('.env').split('\n')) {
  if (!l.includes('=') || l.trim().startsWith('#')) continue;
  const k = l.slice(0, l.indexOf('=')).trim();
  const v = l.slice(l.indexOf('=') + 1).trim();
  if (v) env[k] = v;
}
// Dua kelompok, dan bedanya penting:
//
//   RAHASIA  — tidak boleh ada di berkas mana pun maupun riwayat commit.
//   TERBUKA  — memang publik & disengaja: PROJECT_ID sama dengan nama repo
//              ini sendiri, dan email pemilik memang tertulis di rules supaya
//              orang lain bisa memasangnya. Keduanya sudah dijelaskan di
//              SECURITY.md. Yang diuji: keduanya cuma muncul di tempat yang
//              memang seharusnya, tidak bocor ke tempat lain.
const TERBUKA = ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'EXPO_PUBLIC_OWNER_EMAIL'];
const rahasia = Object.entries(env).filter(([k]) => !TERBUKA.includes(k));
c(`ketemu ${rahasia.length} nilai rahasia + ${TERBUKA.length} nilai terbuka di .env`,
  rahasia.length >= 4);

const isiDilacak = dilacak
  .filter((f) => fs.existsSync(R + f) && fs.statSync(R + f).isFile())
  .map((f) => {
    try { return { f, isi: fs.readFileSync(R + f, 'utf8') }; } catch { return null; }
  })
  .filter(Boolean);
const label = (v) => (v.length > 14 ? v.slice(0, 6) + '…' + v.slice(-4) : v);
for (const [k, v] of rahasia) {
  const bocor = isiDilacak.filter((x) => x.isi.includes(v)).map((x) => x.f);
  c(`${k.replace('EXPO_PUBLIC_FIREBASE_', '')} ("${label(v)}") tidak ada di berkas mana pun`,
    bocor.length === 0, bocor.join(', ') || `${isiDilacak.length} berkas disisir`);
}

console.log('\n  — yang memang terbuka, cek tempatnya saja —');
const BOLEH = {
  // AI-GRATIS.md (ter-commit 14 Sep 2026) menyebut nama proyek seperti README.
  // RINGKASAN-APLIKASI.md (22 Sep 2026) & rencana .claude/plans menyebut nama app = nama proyek.
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: /^(README\.md|SECURITY\.md|AI-GRATIS\.md|PEDOMAN-VERSI\.md|RELEASE\.md|RINGKASAN-APLIKASI\.md|\.claude\/|app\.json|package\.json|firestore\.rules|storage\.rules|eas\.json|yarn\.lock|assets\/|components\/|lib\/|app\/)/,
  EXPO_PUBLIC_OWNER_EMAIL: /^(firestore\.rules|storage\.rules|SECURITY\.md)$/,
};
for (const k of TERBUKA) {
  if (!env[k]) continue;
  const di = isiDilacak.filter((x) => x.isi.includes(env[k])).map((x) => x.f);
  const nakal = di.filter((f) => !BOLEH[k].test(f));
  c(`${k.replace('EXPO_PUBLIC_', '')} hanya muncul di tempat yang wajar`,
    nakal.length === 0, nakal.join(', ') || di.join(', '));
}
c('SECURITY.md mengakui email pemilik memang terbaca publik',
  /[Ee]mail(mu)? .*(publik|terbaca)/.test(baca('SECURITY.md')));

console.log('\n=== Riwayat commit juga bersih (bukan cuma keadaan sekarang) ===');
const jumlahCommit = git('log --all --oneline').trim().split('\n').length;
for (const [k, v] of rahasia) {
  const hit = git(`log --all -S"${v}" --oneline`).trim();
  c(`${k.replace('EXPO_PUBLIC_FIREBASE_', '')} ("${label(v)}") tak pernah ada di ${jumlahCommit} commit`,
    hit === '', hit || 'bersih');
}
c('.env tak pernah sekali pun ter-commit', (() => {
  const hit = git("log --all --oneline --name-only --diff-filter=A -- .env '.env.*'")
    .split('\n')
    .filter((l) => l.trim() === '.env' || /^\.env\.(?!example)/.test(l.trim()));
  return hit.length === 0;
})());

console.log('\n=== .gitignore menutup jalurnya ===');
const gi = baca('.gitignore');
c('.env* (bukan cuma .env) — .env.production dsb ikut tertutup',
  /^\.env\*$/m.test(gi));
c('.env.example tetap boleh masuk', /^!\.env\.example$/m.test(gi));
c('service account Admin SDK ditutup',
  /serviceAccountKey\.json/.test(gi) && /adminsdk/.test(gi));
c('google-services.json & GoogleService-Info.plist ditutup',
  /google-services\.json/.test(gi) && /GoogleService-Info\.plist/.test(gi));

console.log('\n=== Config Firebase tidak ditulis di kode ===');
const fb = baca('lib/firebase.ts');
c('semua nilai config dibaca dari process.env', (() => {
  const blok = fb.match(/const firebaseConfig = \{([\s\S]*?)\};/)[1];
  const baris = blok.split('\n').filter((l) => l.includes(':'));
  return baris.length === 6 && baris.every((l) => /process\.env\.EXPO_PUBLIC_/.test(l));
})());
c('tidak ada API key berbentuk AIza… di seluruh berkas yang dilacak',
  !isiDilacak.some((x) => /AIza[0-9A-Za-z_-]{25,}/.test(x.isi)));

console.log('\n=== Tanpa .env: app TIDAK menghubungi Firebase mana pun ===');
// Bukti nyata: Firebase SDK asli dipanggil dengan config kosong.
const { initializeApp, deleteApp } = require(R + 'node_modules/firebase/app');
const { getAuth, initializeAuth, inMemoryPersistence } = require(R + 'node_modules/firebase/auth');
const kosong = initializeApp({ apiKey: undefined, projectId: undefined, appId: undefined }, 'uji-kosong');
const lempar = (fn) => { try { fn(); return null; } catch (e) { return e.code || e.message; } };
const errInit = lempar(() => initializeAuth(kosong, { persistence: inMemoryPersistence }));
const errGet = lempar(() => getAuth(kosong));
c('initializeAuth memang MELEMPAR dengan config kosong', errInit === 'auth/invalid-api-key', String(errInit));
c('getAuth pun MELEMPAR — jadi ia bukan penyelamat', errGet === 'auth/invalid-api-key', String(errGet));
deleteApp(kosong).catch(() => {});
c('karena itu Auth cuma disentuh kalau isFirebaseConfigured true',
  /if \(isFirebaseConfigured\) \{\s*try \{\s*auth = initializeAuth\(/.test(fb));
c('kalau belum dikonfigurasi, auth bernilai null (bukan objek palsu)',
  /let auth: Auth \| null = null;/.test(fb));
const ctx = baca('contexts/auth.tsx');
c('pemakainya menjaga null: langganan sesi dilewati',
  /const a = auth;\s*if \(!a\) return;/.test(ctx));
c('masuk/daftar memberi pesan jelas, bukan error Firebase mentah',
  /class NotConfiguredError/.test(ctx) && /code = 'auth\/not-configured'/.test(ctx) &&
    /function requireAuth\(\)/.test(ctx));
c('layar Login menerjemahkan kodenya ke Bahasa Indonesia',
  /case 'auth\/not-configured':/.test(baca('app/login.tsx')));
c('"menunggu sesi" tidak menyala kalau memang tak ada sesi → Login langsung tampil',
  /useState\(isFirebaseConfigured\)/.test(ctx));
c('layar Login memberi tahu kalau belum dikonfigurasi',
  /!isFirebaseConfigured &&/.test(baca('app/login.tsx')));

console.log('\n=== Security Rules: lapisan yang sesungguhnya ===');
const rules = baca('firestore.rules');
const srules = baca('storage.rules');
c('firestore.rules & storage.rules ikut ke repo (bisa dipasang orang lain)',
  dilacak.includes('firestore.rules') && dilacak.includes('storage.rules'));
c('isolasi antar-akun: request.auth.uid == userId',
  /allow read, write: if isOwner\(\) && request\.auth\.uid == userId;/.test(rules));
c('hanya email pemilik yang lolos',
  /request\.auth\.token\.email == '[^']+@[^']+'/.test(rules));
c('default TOLAK SEMUA di luar users/{uid}',
  /match \/\{document=\*\*\} \{\s*allow read, write: if false;/.test(rules));
c('Storage juga terkunci & default tolak',
  /allow read, write: if isOwner\(\) && request\.auth\.uid == userId;/.test(srules) &&
    /allow read, write: if false;/.test(srules));
c('rules mengingatkan yang meng-clone untuk mengganti emailnya',
  /meng-clone repo ini/.test(rules) && /meng-clone repo ini/.test(srules));

console.log('\n=== Seluruh akses data tetap di bawah users/{uid} ===');
const jalur = new Set();
for (const x of isiDilacak) {
  for (const m of x.isi.matchAll(/(?:doc|collection)\(\s*db\s*,\s*'([^']+)'/g)) {
    jalur.add(m[1]);
  }
}
c('tidak ada koleksi akar selain "users"', [...jalur].join(',') === 'users',
  [...jalur].join(', ') || '(tidak ada)');
// Hanya KODE app yang dihitung — yarn.lock memuat daftar isi paket firebase
// (termasuk "firebase/storage"), dan itu bukan berarti app memakainya.
const KODE = /^(app|components|lib|hooks|contexts|assets)\//;
c('Firebase Storage memang tidak dipakai sama sekali oleh kode app',
  !isiDilacak.some((x) => KODE.test(x.f) && /firebase\/storage|getStorage\(/.test(x.isi)));

console.log('\n=== Panduan untuk yang meng-clone ===');
const readme = baca('README.md');
c('README menyuruh bikin proyek Firebase SENDIRI', /proyek Firebase-mu sendiri/i.test(readme));
c('README menyuruh memasang rules & mengganti emailnya',
  /firestore\.rules/.test(readme) && /EXPO_PUBLIC_OWNER_EMAIL/.test(readme));
c('README memperingatkan soal identitas EAS (updates.url) supaya tidak nyantol',
  /updates\.url/.test(readme) && /eas init/.test(readme));
c('SECURITY.md menjelaskan jalur EAS Update itu apa adanya',
  /EAS Update/.test(baca('SECURITY.md')));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
