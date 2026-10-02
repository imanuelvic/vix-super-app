// ❤️ Respons hati (2 Okt 2026) — tiga permintaan pemilik app sekaligus:
// chip pilihannya ditambah, ada rekap "yang paling sering aku pilih", dan
// responsnya bisa dibagikan ke WhatsApp sebelum lanjut ke 🎵 Worship.
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
const riwayat = baca('app/journey-history.tsx');
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
console.log('\n=== 2. Rekap "yang paling sering aku pilih" ===');
// =====================================================================

{
  // Tiga pagi: grateful 3×, grow 2×, brave 1×.
  const pagi = [
    ['grateful', 'grow'],
    ['grateful', 'grow', 'brave'],
    ['grateful'],
  ];
  const r = J.tallyResponses(pagi);
  const peta = Object.fromEntries(r.map((x) => [x.key, x.count]));
  c('menghitung tiap respons dari banyak pagi',
    peta.grateful === 3 && peta.grow === 2 && peta.brave === 1,
    JSON.stringify(peta));
  c('terbanyak di urutan pertama',
    r[0].key === 'grateful' && r[1].key === 'grow' && r[2].key === 'brave',
    r.slice(0, 3).map((x) => x.key).join(','));
  // Yang belum pernah dipilih justru kabar yang paling berguna — kalau
  // disaring di sini, layarnya tidak punya cara membedakan "nol" dari
  // "tidak ada pilihannya".
  c('yang belum pernah dipilih ikut, dengan angka 0',
    r.length === 10 && peta.repent === 0 && peta.love === 0,
    String(r.length));
  // Urutan yang seri harus TETAP, bukan berganti-ganti tiap layar dibuka.
  const seri = J.tallyResponses([['surrender', 'forgive']]);
  const nol = seri.filter((x) => x.count === 0).map((x) => x.key).join(',');
  c('yang seri mengikuti urutan daftarnya (hasilnya tidak berubah-ubah)',
    seri[0].key === 'surrender' && seri[1].key === 'forgive' &&
      nol === 'grateful,brave,grow,trust,repent,hope,calm,love',
    `${seri[0].key},${seri[1].key} | ${nol}`);
  c('dijalankan dua kali hasilnya sama persis',
    JSON.stringify(J.tallyResponses(pagi)) === JSON.stringify(J.tallyResponses(pagi)));
}
// Catatan lama bisa memakai kunci yang sudah tidak ada di daftar. Membuangnya
// diam-diam membuat angka totalmu menyusut tanpa ada yang memberi tahu.
{
  const r = J.tallyResponses([['married', 'grateful'], ['married']]);
  const asing = r.find((x) => x.key === 'married');
  c('kunci asing dari catatan lama tetap dihitung, bukan dibuang diam-diam',
    !!asing && asing.count === 2 && asing.label === 'married', JSON.stringify(asing));
  c('kunci asing tetap dapat lambang, jadi barisnya tidak kosong',
    !!asing && asing.emoji.length > 0);
}
c('tanpa catatan sama sekali: semua 0, bukan meledak',
  J.tallyResponses([]).length === 10 &&
    J.tallyResponses([undefined, undefined]).every((x) => x.count === 0));

// Kartunya menumpang data yang MEMANG sudah dilanggan layar riwayat.
c('rekapnya tidak menambah satu pun pembacaan Firestore',
  /<ResponsRekap pagi=\{semua\} \/>/.test(riwayat) &&
    !/getDocs|fetch[A-Z]/.test(riwayat));
c('dihitung dari seluruh pagi, bukan dari halaman yang sedang dibuka',
  /tallyResponses\(pagi\.map\(\(d\) => d\.entry\?\.responses\)\)/.test(riwayat) &&
    !/tallyResponses\(pageItems/.test(riwayat));
// Angka "paling sering" yang ikut menyusut mengikuti kata kunci tidak menjawab
// pertanyaan apa pun; ia cuma terbaca seperti rekapmu tiba-tiba berubah.
c('disembunyikan selagi mencari', /\{!q && <ResponsRekap/.test(riwayat));
c('yang teratas diberi kalimatnya sendiri, bukan cuma baris teratas',
  /paling sering, \{teratas\.count\}×/.test(riwayat));
c('yang belum pernah dipilih ikut disebut di kaki kartunya',
  /Belum pernah: \{belum\.map/.test(riwayat));
c('panjang batangnya relatif terhadap yang teratas',
  /\(r\.count \/ tertinggi\) \* 100/.test(riwayat));
c('kartunya tidak digambar kalau memang belum ada yang pernah dipilih',
  /if \(terpakai\.length === 0\) return null;/.test(riwayat));

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

for (const f of ['lib/journey.ts', 'app/journey-history.tsx']) {
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
