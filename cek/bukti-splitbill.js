// Uji NYATA matematika Split Bill & pembaca nota — bukan cocok-cocokan teks.
//
// lib/friends.ts & lib/receiptOcr.ts dikompilasi dulu ke JS (lihat perintah di
// bawah), lalu fungsinya benar-benar DIJALANKAN dengan angka sungguhan. Ini
// bagian yang salahnya paling mahal: kalau pembagiannya meleset, yang bertengkar
// beneran orang.
//
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-splitbill');

// Dikompilasi sendiri tiap kali dijalankan, jadi tidak ada folder build
// yang harus disiapkan tangan dan tidak mungkin membaca hasil BASI.
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/friends.ts'), path.join(ROOT, 'lib/receiptOcr.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// tsc kadang menaruh hasilnya langsung di OUT, kadang di OUT/lib —
// tergantung akar bersama berkas yang diminta. Terima keduanya.
const BUILD = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;

// Stub modul yang butuh perangkat/jaringan. Yang diuji fungsi MURNI-nya, jadi
// Firestore & expo-constants tidak perlu benar-benar hidup.
class FakeTimestamp {
  constructor(ms) {
    this.ms = ms;
  }
  toMillis() {
    return this.ms;
  }
  toDate() {
    return new Date(this.ms);
  }
  static now() {
    return new FakeTimestamp(Date.now());
  }
  static fromDate(d) {
    return new FakeTimestamp(d.getTime());
  }
}

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      Timestamp: FakeTimestamp,
      collection: () => ({}),
      doc: () => ({}),
      deleteDoc: async () => {},
      setDoc: async () => {},
      onSnapshot: () => () => {},
      orderBy: () => ({}),
      query: () => ({}),
      limit: () => ({}),
    };
  }
  if (req === 'expo-constants') {
    return { default: {}, ExecutionEnvironment: { StoreClient: 'storeClient' } };
  }
  if (req.endsWith('./firebase')) return { db: {} };
  if (req.endsWith('./liveDoc')) return { liveDoc: () => () => {} };
  return asli.apply(this, arguments);
};

const social = require(path.join(BUILD, 'friends.js'));
const ocr = require(path.join(BUILD, 'receiptOcr.js'));

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else {
    gagal++;
    console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`);
  }
}
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ===================== Membaca angka nota =====================
console.log('\nMembaca angka rupiah dari nota');
const angka = [
  ['50.000', 50000],
  ['50,000', 50000],
  ['Rp 50.000', 50000],
  ['1.250.000', 1250000],
  // Mesin kasir sering mencetak sen. Tanpa aturan desimal, ini terbaca 5 juta.
  ['50.000,00', 50000],
  ['50,000.00', 50000],
  ['8.000', 8000],
  ['', 0],
];
for (const [teks, harap] of angka) {
  const dapat = ocr.parseReceiptAmount(teks);
  ok(`"${teks}" → ${harap}`, dapat === harap, `dapat ${dapat}`);
}

// ===================== Membaca baris nota =====================
console.log('\nMembaca baris nota jadi item');
const baris = [
  ['2 Nasi Goreng      50.000', { name: 'Nasi Goreng', qty: 2, price: 50000 }],
  ['2x Es Teh          8.000', { name: 'Es Teh', qty: 2, price: 8000 }],
  ['Ayam Bakar        35.000', { name: 'Ayam Bakar', qty: 1, price: 35000 }],
  ['Nasi Campur ..... 25.000', { name: 'Nasi Campur', qty: 1, price: 25000 }],
];
for (const [teks, harap] of baris) {
  const dapat = ocr.parseReceiptLine(teks);
  ok(`"${teks.trim()}"`, sama(dapat, harap), JSON.stringify(dapat));
}

console.log('\n  …dan baris yang JELAS bukan item harus dibuang');
// Ini kesalahan paling merusak: "Total 118.000" ikut jadi menu → nota dobel.
const bukanItem = [
  'TOTAL             118.000',
  'Sub Total         100.000',
  'Pajak PB1 10%      10.000',
  'Service Charge      8.000',
  'Tunai             150.000',
  'Kembalian          32.000',
  'Diskon             10.000',
  'Terima kasih',
  'QRIS              118.000',
  'Pembulatan             50',
];
for (const teks of bukanItem) {
  ok(`buang: "${teks.trim()}"`, ocr.parseReceiptLine(teks) === null,
    JSON.stringify(ocr.parseReceiptLine(teks)));
}

const notaUtuh = [
  'WARUNG BU IMAS',
  '2 Nasi Goreng      50.000',
  '1 Ayam Bakar       35.000',
  '3 Es Teh           15.000',
  'Sub Total         100.000',
  'PB1 10%            10.000',
  'Service 5%          5.000',
  'TOTAL             115.000',
  'Tunai             120.000',
  'Kembalian           5.000',
];
const terbaca = ocr.parseReceiptLines(notaUtuh);
ok('satu nota utuh → tepat 3 item, bukan 3 + total-totalan',
  terbaca.length === 3 &&
  terbaca[0].price === 50000 && terbaca[1].price === 35000 &&
  terbaca[2].price === 15000,
  JSON.stringify(terbaca));

// ===================== Pembagian tagihan =====================
console.log('\nPembagian tagihan — angka sungguhan');

const ts = (s) => new FakeTimestamp(s);
function bikinBill(over = {}) {
  return {
    id: 'b1',
    title: 'Makan bareng',
    place: 'Warung',
    date: ts(0),
    items: [],
    people: [],
    taxPercent: 0,
    servicePercent: 0,
    discount: 0,
    photo: null,
    note: '',
    ...over,
  };
}

// Kasus inti: A makan 50rb, B makan 30rb, es teh 20rb dibagi berdua.
// Pajak 10% + service 5% = 15% dari subtotal 100rb = 15rb.
const bill = bikinBill({
  people: [
    { id: 'a', name: 'Ana', paid: false },
    { id: 'b', name: 'Budi', paid: false },
  ],
  items: [
    { id: 'i1', name: 'Steak', qty: 1, price: 50000, sharedBy: ['a'] },
    { id: 'i2', name: 'Ayam', qty: 1, price: 30000, sharedBy: ['b'] },
    { id: 'i3', name: 'Es Teh', qty: 2, price: 20000, sharedBy: ['a', 'b'] },
  ],
  taxPercent: 10,
  servicePercent: 5,
});

ok('subtotal = 100.000', social.billSubtotal(bill) === 100000,
  String(social.billSubtotal(bill)));
ok('total kasir = 115.000 (100rb + 15%)', social.billTotal(bill) === 115000,
  String(social.billTotal(bill)));

const s = social.billShares(bill);
const ana = s.find((x) => x.person.id === 'a');
const budi = s.find((x) => x.person.id === 'b');
// Ana: 50rb + separuh es teh 10rb = 60rb → pajaknya 60% × 15rb = 9rb → 69rb
// Budi: 30rb + 10rb = 40rb → 40% × 15rb = 6rb → 46rb
ok('Ana bayar 69.000 (item 60rb + 9rb pajak)',
  ana.items === 60000 && ana.extra === 9000 && ana.total === 69000,
  JSON.stringify(ana));
ok('Budi bayar 46.000 (item 40rb + 6rb pajak)',
  budi.items === 40000 && budi.extra === 6000 && budi.total === 46000,
  JSON.stringify(budi));
ok('jumlah setoran = total kasir, tidak ada yang bocor',
  ana.total + budi.total === social.billTotal(bill),
  `${ana.total} + ${budi.total} vs ${social.billTotal(bill)}`);

console.log('\n  Pajak dibagi PROPORSIONAL, bukan rata — ini intinya');
ok('yang makan lebih banyak menanggung pajak lebih besar',
  ana.extra > budi.extra && ana.extra / ana.items === budi.extra / budi.items,
  `${ana.extra} vs ${budi.extra}`);

console.log('\n  Diskon');
const billDiskon = bikinBill({
  ...bill,
  discount: 15000, // pas menghapus pajaknya
});
const sd = social.billShares(billDiskon);
ok('diskon ikut proporsional — total balik ke subtotal',
  sd[0].total + sd[1].total === 100000 &&
  sd[0].total === 60000 && sd[1].total === 40000,
  JSON.stringify(sd.map((x) => x.total)));

console.log('\n  Item yang belum dibagi');
const billBocor = bikinBill({
  people: [{ id: 'a', name: 'Ana', paid: false }],
  items: [
    { id: 'i1', name: 'Steak', qty: 1, price: 50000, sharedBy: ['a'] },
    { id: 'i2', name: 'Entah', qty: 1, price: 30000, sharedBy: [] },
  ],
});
ok('item tanpa pemakan terdeteksi & diperingatkan',
  social.unsharedItems(billBocor).length === 1);
ok('…dan memang TIDAK ditagihkan ke siapa pun (bukan diam-diam dibagi)',
  social.billShares(billBocor)[0].total === 50000 &&
  social.billTotal(billBocor) === 80000,
  JSON.stringify(social.billShares(billBocor)));

console.log('\n  Orang yang dihapus tidak menyisakan hantu');
const billHantu = bikinBill({
  people: [{ id: 'a', name: 'Ana', paid: false }],
  // 'z' sudah dihapus dari people tapi masih tertinggal di item.
  items: [{ id: 'i1', name: 'Pizza', qty: 1, price: 60000, sharedBy: ['a', 'z'] }],
});
ok('bagian orang hilang tidak ditimpakan ke yang tersisa',
  social.billShares(billHantu)[0].total === 30000,
  JSON.stringify(social.billShares(billHantu)));

console.log('\n  Pembulatan saat dibagi tiga');
const billTiga = bikinBill({
  people: [
    { id: 'a', name: 'A', paid: false },
    { id: 'b', name: 'B', paid: false },
    { id: 'c', name: 'C', paid: false },
  ],
  items: [
    { id: 'i1', name: 'Sharing', qty: 1, price: 100000, sharedBy: ['a', 'b', 'c'] },
  ],
});
const st = social.billShares(billTiga);
const jumlahTiga = st.reduce((n, x) => n + x.total, 0);
ok('selisih pembulatannya paling banyak Rp 2 (jujur, bukan disembunyikan)',
  Math.abs(jumlahTiga - social.billTotal(billTiga)) <= 2,
  `${jumlahTiga} vs ${social.billTotal(billTiga)}`);

console.log('\n  Penagihan');
const billLunas = bikinBill({
  ...bill,
  people: [
    { id: 'a', name: 'Ana', paid: true },
    { id: 'b', name: 'Budi', paid: false },
  ],
});
ok('sisa penagihan = punya Budi saja',
  social.unpaidCount(billLunas) === 1 &&
  social.outstandingTotal([billLunas]) === 46000,
  String(social.outstandingTotal([billLunas])));
ok('tagihan tanpa orang TIDAK dianggap belum lunas',
  social.billUnsettled(bikinBill()) === false);
ok('yang belum lunas naik ke atas daftar',
  social.sortedBills([
    bikinBill({ id: 'lunas', date: ts(2000), people: [{ id: 'a', name: 'A', paid: true }] }),
    bikinBill({ id: 'belum', date: ts(1000), people: [{ id: 'b', name: 'B', paid: false }] }),
  ])[0].id === 'belum');

console.log('\n  Nilai ekstrem tidak bikin NaN / minus');
ok('tagihan kosong aman (tidak bagi nol)',
  social.billTotal(bikinBill()) === 0 &&
  social.billShares(bikinBill()).length === 0);
ok('diskon lebih besar dari tagihan tidak jadi setoran minus',
  social.billShares(bikinBill({
    people: [{ id: 'a', name: 'A', paid: false }],
    items: [{ id: 'i', name: 'X', qty: 1, price: 10000, sharedBy: ['a'] }],
    discount: 999999,
  }))[0].total === 0);

console.log(gagal === 0
  ? '\n✅ LULUS — hitungan Split Bill & pembaca nota terbukti benar.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
