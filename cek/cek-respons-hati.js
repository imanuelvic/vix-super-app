// ❤️ Respons hati (2 Okt 2026) — tiga permintaan pemilik app sekaligus:
// chip pilihannya ditambah, ada rekap "yang paling sering aku pilih", dan
// responsnya bisa dibagikan ke WhatsApp sebelum lanjut ke 🎵 Worship.
// (Sore harinya rekap itu dihapus bersama layar Riwayat Morning Journey;
// alasan nomor 1 & 2 di bawah tinggal sejarah, bagian 2 kini menjaga
// supaya keduanya tidak tertinggal sebagai kode mati.)
//
// Kenapa perlu penjaga sendiri:
//
//   1. Rekapnya menghitung TAHUN-TAHUN catatan. Salah urut atau salah hitung
//      di situ tidak akan pernah terlihat salah — angkanya tetap keluar,
//      cuma menjawab pertanyaan yang berbeda. Jadi rumusnya dijalankan di
//      sini dengan data buatan yang jawabannya sudah diketahui.
//   2. Kunci yang HILANG dari daftar. Catatan lama bisa memakai kunci yang
//      suatu saat dihapus dari RESPONSE_OPTIONS; kalau rekapnya membuangnya
//      diam-diam, angka totalmu menyusut tanpa ada yang memberi tahu.
//   3. Pesan yang dibagikan. Bagian kosong yang ikut terkirim sebagai label
//      menggantung ("✨" tanpa kalimat) baru ketahuan SESUDAH terkirim ke
//      grup, dan saat itu sudah terlambat.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? `  → ${extra}` : ''));
};

function jalankan(berkas, stub = {}) {
  const js = ts.transpileModule(baca(berkas), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (nama) => {
    if (nama in stub) return stub[nama];
    throw new Error(`impor tak terduga: ${nama}`);
  };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
}

const J = jalankan('lib/journey.ts', {
  './core': { pickOfDay: (list) => list[0] },
  './family': { OWNER_NAME: 'Imanuel Victory' },
  './linking': {},
});

const steps = baca('components/spiritual/journey/JourneySteps.tsx');
const layar = baca('components/spiritual/MorningJourney.tsx');
const modul = baca('lib/journey.ts');

// =====================================================================
console.log('\n=== 1. Chip bertambah, yang lama tidak bergeser ===');
// =====================================================================

c('sepuluh pilihan', J.RESPONSE_OPTIONS.length === 10, String(J.RESPONSE_OPTIONS.length));
// Menggeser chip yang sudah hafal di tangan membuat jari memilih yang salah
// selama berminggu-minggu — jadi yang baru DITARUH DI BELAKANG.
c('lima yang lama tetap di lima posisi pertama',
  J.RESPONSE_OPTIONS.slice(0, 5).map((o) => o.key).join(',') ===
    'grateful,surrender,brave,forgive,grow',
  J.RESPONSE_OPTIONS.slice(0, 5).map((o) => o.key).join(','));
c('lima yang baru: percaya · bertobat · berharap · ditenangkan · mengasihi',
  J.RESPONSE_OPTIONS.slice(5).map((o) => o.key).join(',') ===
    'trust,repent,hope,calm,love',
  J.RESPONSE_OPTIONS.slice(5).map((o) => o.key).join(','));
c('tidak ada lambang maupun kunci yang kembar',
  new Set(J.RESPONSE_OPTIONS.map((o) => o.emoji)).size === 10 &&
    new Set(J.RESPONSE_OPTIONS.map((o) => o.key)).size === 10);
// ❤️ sudah jadi lambang langkah Respond di jejak journey; chip yang memakainya
// akan terbaca sebagai langkahnya sendiri, bukan pilihan di dalamnya.
c('tak satu pun memakai ❤️ (lambang langkah Respond)',
  J.RESPONSE_OPTIONS.every((o) => o.emoji !== '❤️'));
c('tidak bentrok dengan lambang kategori doa',
  J.RESPONSE_OPTIONS.every(
    (o) => !J.PRAYER_TOPICS.some((t) => t.emoji === o.emoji)));
c('kunci baru pun punya labelnya, bukan dicetak mentah',
  J.responseLabel('calm') === '🕯️ Ditenangkan' &&
    J.responsesLine(['trust', 'love']) === '🤲 Percaya · 🫶 Mengasihi');

// =====================================================================
console.log('\n=== 2. Rekap respons dihapus bersama layar riwayatnya ===');
// =====================================================================

// Sore 2 Okt 2026: layar Riwayat Morning Journey DIHAPUS atas permintaan
// pemilik app (isinya sama dengan Revive History). Kartu rekap ❤️ cuma hidup
// di layar itu, jadi ia ikut pergi bersama rumusnya. Dijaga di sini supaya
// tidak tertinggal sebagai kode mati.
c('layar Riwayat Morning Journey tidak ada lagi',
  !fs.existsSync(R + 'app/journey-history.tsx'));
c('rumus rekapnya ikut dibuang, bukan jadi ekspor mati',
  typeof J.tallyResponses === 'undefined' && !/tallyResponses|ResponseTally/.test(modul));
c('respons hati tetap terbaca di arsip Revive (dibuka dari Revive History)',
  /responsesLine\(entry\.responses\)/.test(baca('app/revive.tsx')));

// =====================================================================
console.log('\n=== 3. Dibagikan ke WhatsApp, sebelum 🎵 Worship ===');
// =====================================================================

const penuh = J.respondShareText({
  dateLabel: 'Jumat, 2 Oktober 2026',
  title: 'Kasih yang Tidak Berubah',
  passage: 'Mazmur 23',
  rhema: 'Tuhan menuntun walau aku tidak melihat jalannya',
  responses: ['grateful', 'grow'],
  carry: 'sabar ke Mama',
});

c('pesannya memuat tanggal, bacaan, rhema, respons, & yang dibawa',
  penuh.includes('Jumat, 2 Oktober 2026') &&
    penuh.includes('📖 Kasih yang Tidak Berubah · Mazmur 23') &&
    penuh.includes('✨ Tuhan menuntun walau aku tidak melihat jalannya') &&
    penuh.includes('❤️ Respons hatiku: 💚 Bersyukur · 🌱 Bertumbuh') &&
    penuh.includes('🏃 Yang aku bawa hari ini: sabar ke Mama'));
c('ditutup kalimat berkat, sama seperti share Revive',
  penuh.endsWith(J.JOURNEY_SHARE_CLOSING) &&
    /God bless/.test(J.JOURNEY_SHARE_CLOSING));

// Bagian kosong harus HILANG seluruhnya. Label menggantung baru ketahuan
// sesudah terkirim ke grup, dan saat itu sudah terlambat.
{
  const minim = J.respondShareText({
    dateLabel: 'Jumat, 2 Oktober 2026',
    title: '',
    passage: '',
    rhema: '   ',
    responses: ['grateful'],
    carry: '',
  });
  c('bagian yang kosong tidak ikut sebagai label menggantung',
    !minim.includes('📖') && !minim.includes('✨') && !minim.includes('🏃'),
    minim);
  c('yang ada tetap terkirim', minim.includes('❤️ Respons hatiku: 💚 Bersyukur'));
  c('tidak pernah ada dua baris kosong berurutan', !/\n\n\n/.test(minim), minim);
  c('pesan paling minim pun masih utuh (pembuka & penutupnya ada)',
    minim.startsWith('🌅 Morning Journey') && minim.endsWith(J.JOURNEY_SHARE_CLOSING));
}
c('respons kosong tidak menyisakan "Respons hatiku:" yang hampa',
  !J.respondShareText({
    dateLabel: 'x', title: '', passage: '', rhema: '', responses: [], carry: 'y',
  }).includes('❤️'));

// Tombolnya SAMA dengan share Revive — permintaan pemilik app memang itu.
c('memakai tombol yang sama dengan Revive, bukan salinannya',
  /<ShareWhatsAppButton onPress=\{bagikan\} \/>/.test(steps) &&
    /from '@\/components\/common\/ShareWhatsAppButton'/.test(steps) &&
    /<ShareWhatsAppButton onPress=\{shareToWhatsApp\} \/>/.test(baca('app/revive.tsx')));
c('membuka WhatsApp tanpa nomor tujuan — chat/grupnya dipilih sendiri',
  /shareTextToWhatsApp\(\s*respondShareText\(\{/.test(steps.replace(/\s+/g, ' ')
    .replace(/shareTextToWhatsApp\( respondShareText\(\{/, 'shareTextToWhatsApp(\n      respondShareText({')));
c('gagal membuka WhatsApp diberi tahu, bukan diam saja',
  /\(\) => setFormError\(WHATSAPP_ERROR\)/.test(steps));
// Membagikan BUKAN cara menyimpan: yang tersimpan tetap lewat "Lanjut".
c('membagikan tidak menyimpan apa pun',
  (() => {
    const i = steps.indexOf('function bagikan()');
    const blok = steps.slice(i, steps.indexOf('}', steps.indexOf('setFormError(WHATSAPP_ERROR)')));
    return i > 0 && !/onSave\(|save\(/.test(blok);
  })());
c('tombolnya baru muncul kalau memang ada isinya',
  /const adaIsi = responses\.length > 0 \|\| carry\.trim\(\)\.length > 0;/.test(steps) &&
    /\{adaIsi && <ShareWhatsAppButton/.test(steps));
// "baru ke menyembah" — urutannya tidak berubah: share dulu, Worship setelahnya.
// Dipotong dari langkah Respond saja: `label="Lanjut"` juga dipakai langkah
// lain, dan tanpa potongan ini urutannya diuji di kartu yang salah.
{
  const awal = steps.indexOf('export function RespondStep');
  // Penutupnya judul bagian berikutnya, bukan sekadar "🎵 Worship": kata itu
  // juga muncul di komentar tombol share, dan potongan yang berhenti di situ
  // akan diam-diam melewatkan tombol yang justru sedang diuji.
  const respond = steps.slice(awal, steps.indexOf('==== 🎵 Worship', awal));
  c('urutannya: chip → yang dibawa → share → Lanjut ke 🎵 Worship',
    awal > 0 &&
      respond.indexOf('RESPONSE_OPTIONS.map') <
        respond.indexOf('{adaIsi && <ShareWhatsAppButton') &&
      respond.indexOf('{adaIsi && <ShareWhatsAppButton') <
        respond.indexOf('<JourneyNext label="Lanjut"') &&
      /nextJourneyStep/.test(layar),
    `chip@${respond.indexOf('RESPONSE_OPTIONS.map')} share@${respond.indexOf('{adaIsi && <ShareWhatsAppButton')} lanjut@${respond.indexOf('<JourneyNext label="Lanjut"')}`);
  c('kolom "satu hal yang ingin kamu bawa" tetap di atas tombol share',
    respond.indexOf('Satu hal saja, yang nyata untuk hari ini') <
      respond.indexOf('{adaIsi && <ShareWhatsAppButton'));
}
c('tanggalnya dioper dari layarnya, bukan dihitung di dalam kartu',
  /dateLabel=\{formatFullDate\(new Date\(\)\)\}/.test(layar) &&
    /dateLabel: string;/.test(steps));

// =====================================================================
console.log('\n=== 4. Aturan repo ===');
// =====================================================================

for (const f of ['lib/journey.ts']) {
  const s = baca(f);
  c(`${f}: tidak ada "tekan"`, !/\btekan\b|ditekan|menekan/i.test(s));
  c(`${f}: tidak ada "Klik" (yang dipakai "click")`, !/\bklik\b/i.test(s));
  const t = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  c(`${f}: tak ada tanda pisah panjang di tulisan yang tampil`,
    !/—/.test(t), (t.match(/.{0,30}—.{0,30}/) || [])[0]);
}
c('tidak ada koleksi Firestore baru (respons tetap menumpang Revive)',
  !/collection\(|doc\(db/.test(modul));

console.log(ok ? '\n✅ LULUS — respons hati.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
