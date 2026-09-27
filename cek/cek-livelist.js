// Batch /rapihin: 20 langganan KOLEKSI di 15 berkas lib menyalin blok
// "onSnapshot → snapshot.docs.map({id, ...data})" sendiri-sendiri.
// Sekarang satu `liveList` di lib/liveDoc.ts.
//
// Fungsinya DIJALANKAN di atas onSnapshot tiruan (snapshot palsu dioper apa
// adanya), jadi yang diuji apa yang benar-benar terjadi pada datanya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-livelist');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/liveDoc.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const MOD = fs.existsSync(path.join(OUT, 'lib', 'liveDoc.js'))
  ? path.join(OUT, 'lib', 'liveDoc.js')
  : path.join(OUT, 'liveDoc.js');
if (!fs.existsSync(MOD)) {
  console.log('  ✗ gagal mengompilasi lib/liveDoc.ts');
  process.exit(1);
}

// ---------- Tiruan Firestore ----------
// onSnapshot dicatat: kuerinya apa, dan callback-nya disimpan supaya bisa
// "dikirimi" snapshot palsu kapan saja.
const dipasang = [];
let lepas = 0;
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      Timestamp: class {},
      // Penggabungan kueri memakai queryEqual resmi Firestore. Di sini
      // dibandingkan berdasarkan IDENTITAS objeknya: tiap tes mengirim objek
      // kueri sendiri, jadi kueri "berbeda" memang harus tidak digabung.
      queryEqual: (a, b) => a === b,
      onSnapshot: (q, next, err) => {
        dipasang.push({ q, next, err });
        return () => {
          lepas++;
        };
      },
    };
  }
  if (/async-storage/.test(req)) {
    return {
      default: {
        getItem: async () => null,
        setItem: async () => {},
        multiRemove: async () => {},
      },
    };
  }
  return asli.call(this, req, parent, isMain);
})(Module._load);

const { liveList } = require(MOD);

/** Snapshot palsu dari daftar {id, data}. */
const snap = (rows) => ({
  docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
});

// =====================================================================
console.log('=== 1. Bentuk bawaannya: { id, ...data } ===');
// =====================================================================
{
  dipasang.length = 0;
  let hasil = null;
  const q1 = { tag: 'q1' };
  const stop = liveList(q1, (items) => {
    hasil = items;
  });

  c('memasang TEPAT satu listener', dipasang.length === 1, String(dipasang.length));
  c('kuerinya dioper apa adanya', dipasang[0].q.tag === 'q1');

  dipasang[0].next(
    snap([
      { id: 'a1', data: { title: 'Servis', cost: 500 } },
      { id: 'b2', data: { title: 'Bensin', cost: 100 } },
    ]),
  );
  c('id dokumennya jadi field `id`',
    hasil.map((x) => x.id).join(',') === 'a1,b2', JSON.stringify(hasil));
  c('isi dokumennya ikut apa adanya',
    hasil[0].title === 'Servis' && hasil[0].cost === 500);
  c('urutan dari Firestore TIDAK diubah-ubah',
    hasil[0].id === 'a1' && hasil[1].id === 'b2');
  c('daftar kosong → array kosong, bukan null', (() => {
    dipasang[0].next(snap([]));
    return Array.isArray(hasil) && hasil.length === 0;
  })());

  // `id` milik dokumen harus MENANG atas field `id` di dalam datanya —
  // kalau tidak, satu dokumen yang kebetulan menyimpan field bernama `id`
  // akan menyamar jadi dokumen lain, dan penghapusan bisa kena yang salah.
  dipasang[0].next(snap([{ id: 'asli', data: { id: 'palsu', x: 1 } }]));
  c('field `id` di dalam data TIDAK menimpa id dokumennya',
    hasil[0].id === 'asli', hasil[0].id);

  // Pelepasannya sekarang DITUNDA (IDLE_MS), sama seperti liveDoc: pindah
  // layar sebentar tidak boleh memutus lalu memasang ulang listener — tiap
  // pemasangan ulang itu membaca seluruh koleksinya lagi, dan itu yang mahal.
  lepas = 0;
  stop();
  c('tidak langsung dilepas begitu pemakai terakhir pergi', lepas === 0);
  c('pemakai baru dalam jeda itu memakai listener yang SAMA (0 baca tambahan)',
    (() => {
      const sebelum = dipasang.length;
      const stop2 = liveList(q1, () => {});
      const sama = dipasang.length === sebelum;
      stop2();
      return sama;
    })());
}

// =====================================================================
console.log('\n=== 2. Listener mati: dipasang ulang dulu, baru dilaporkan ===');
// =====================================================================
// `onSnapshot` memanggil callback galatnya paling banyak SEKALI — sesudah itu
// listenernya selesai & tak pernah menyala lagi. Dulu galat itu langsung
// diteruskan ke layar, dan karena tak ada lagi data yang datang, pesan "Gagal
// memuat data. Coba lagi." menempel selamanya di atas daftar yang sebenarnya
// sudah tampil. Sekarang dicoba pasang ulang tiga kali dulu.
{
  // Jeda coba-laginya dijalankan seketika, supaya tesnya tidak ikut menunggu
  // 1 + 4 + 10 detik sungguhan.
  const tidurAsli = global.setTimeout;
  global.setTimeout = (fn) => {
    fn();
    return 0;
  };

  dipasang.length = 0;
  let kena = null;
  liveList({}, () => {}, (e) => {
    kena = e;
  });
  const galat = new Error('permission-denied');

  dipasang[0].err(galat);
  c('galat pertama TIDAK langsung dilaporkan — listenernya dipasang ulang',
    kena === null && dipasang.length === 2);

  dipasang[1].err(galat);
  dipasang[2].err(galat);
  c('dicoba selama jatahnya masih ada', kena === null && dipasang.length === 4);

  dipasang[3].err(galat);
  c('jatah habis → galat ASLINYA yang dilaporkan', kena === galat);
  // Batasnya yang menjaga galat menetap (aturan Firestore menolak, kuota
  // habis) tidak jadi pemasangan ulang tanpa henti — itu justru yang
  // menghabiskan kuota baca.
  c('sesudah itu berhenti, bukan mencoba selamanya', dipasang.length === 4);

  // Data yang akhirnya sampai mengembalikan jatahnya — jadi kedipan sinyal
  // besok dapat tiga kesempatan lagi, bukan langsung merah.
  dipasang.length = 0;
  let kena2 = null;
  liveList({}, () => {}, (e) => {
    kena2 = e;
  });
  dipasang[0].err(new Error('a'));
  dipasang[1].next(snap([]));
  dipasang[1].err(new Error('b'));
  c('data yang sampai mengembalikan jatah coba-laginya',
    kena2 === null && dipasang.length === 3);

  // Tanpa onError pun tidak boleh meledak — banyak pemanggil memang tak
  // mengirimnya (galatnya diabaikan dengan sengaja).
  dipasang.length = 0;
  liveList({}, () => {});
  // Penerus galatnya SELALU ada sekarang (ia menyebar ke pendengar yang
  // terdaftar, yang boleh saja kosong) — konsekuensi dari penggabungan:
  // satu listener melayani beberapa pemakai, dan tiap pemakai boleh punya
  // atau tidak punya onError sendiri.
  c('tanpa onError, listener tetap terpasang & galatnya tidak meledak',
    dipasang.length === 1 &&
      typeof dipasang[0].err === 'function' &&
      (() => {
        dipasang[0].err(new Error('x'));
        return true;
      })());

  global.setTimeout = tidurAsli;
}

// =====================================================================
console.log('\n=== 3. `row` sendiri untuk data lama yang perlu dirapikan ===');
// =====================================================================
{
  dipasang.length = 0;
  let hasil = null;
  liveList(
    {},
    (items) => {
      hasil = items;
    },
    undefined,
    (d) => {
      const data = d.data();
      return { id: d.id, ...data, category: data.category ?? 'personal' };
    },
  );
  dipasang[0].next(
    snap([
      { id: 't1', data: { title: 'Lama' } }, // tanpa kategori
      { id: 't2', data: { title: 'Baru', category: 'work' } },
    ]),
  );
  c('dokumen lama dapat nilai bawaannya', hasil[0].category === 'personal');
  c('dokumen baru tidak ditimpa', hasil[1].category === 'work');

  // Ada yang barisnya TIDAK berkunci `id` (coreRules memakai `kind`).
  dipasang.length = 0;
  liveList(
    {},
    (items) => {
      hasil = items;
    },
    undefined,
    (d) => ({ kind: d.id, body: d.data().body ?? '' }),
  );
  dipasang[0].next(snap([{ id: 'visitasi', data: {} }]));
  c('baris boleh berkunci lain (kind, dayId, …)',
    hasil[0].kind === 'visitasi' && hasil[0].body === '',
    JSON.stringify(hasil[0]));
}

// =====================================================================
console.log('\n=== 4. Urut/saring DAFTAR dikerjakan di onChange ===');
// =====================================================================
// Dua urusan berbeda: `row` mengubah satu baris, `onChange` mengurus
// daftarnya. Yang dulu bercampur di satu blok sekarang berpisah.
{
  dipasang.length = 0;
  let hasil = null;
  liveList({}, (items) => {
    hasil = [...items].sort((a, b) => b.n - a.n);
  });
  dipasang[0].next(
    snap([
      { id: 'x', data: { n: 1 } },
      { id: 'y', data: { n: 9 } },
      { id: 'z', data: { n: 5 } },
    ]),
  );
  c('penyortiran di onChange bekerja',
    hasil.map((x) => x.n).join(',') === '9,5,1', hasil.map((x) => x.n).join(','));

  dipasang.length = 0;
  liveList(
    {},
    (items) => {
      hasil = items.filter((x) => x.text.trim().length > 0);
    },
    undefined,
    (d) => ({ dayId: d.id, text: d.data().notes?.h1 ?? '' }),
  );
  dipasang[0].next(
    snap([
      { id: '2026-08-30', data: { notes: { h1: 'syukur' } } },
      { id: '2026-08-29', data: { notes: {} } },
      { id: '2026-08-28', data: {} },
    ]),
  );
  c('penyaringan di onChange bekerja (hari kosong dibuang)',
    hasil.length === 1 && hasil[0].dayId === '2026-08-30',
    JSON.stringify(hasil));
}

// =====================================================================
console.log('\n=== 5. Semua berkas lib memakainya ===');
// =====================================================================
{
  // 27 Sep 2026: learning · multiplication · tournament ikut masuk. Ketiganya
  // dulu memakai `onSnapshot` mentah, jadi ketiganya kehilangan ref-count,
  // hasil hangat antar-layar, dan terutama pemasangan ulang listener yang mati
  // (`pulihkan`) — langganan yang tumbang di situ diam SELAMANYA.
  const F = [
    'lib/car.ts', 'lib/core.ts', 'lib/coreRules.ts', 'lib/debts.ts',
    'lib/device.ts', 'lib/family.ts', 'lib/fasting.ts', 'lib/saku.ts',
    'lib/health.ts', 'lib/residence.ts', 'lib/sermon.ts', 'lib/friends.ts',
    'lib/spiritual.ts', 'lib/tasks.ts', 'lib/transactions.ts',
    'lib/learning.ts', 'lib/multiplication.ts', 'lib/tournament.ts',
  ];
  const pakai = F.filter((f) => /liveList[<(]/.test(baca(f)));
  c(`${F.length} berkas memanggil liveList`, pakai.length === F.length,
    `${pakai.length}/${F.length} — kurang: ${F.filter((f) => !pakai.includes(f)).join(', ')}`);
  const imporSalah = F.filter(
    (f) => !/import \{[^}]*liveList[^}]*\} from '\.\/liveDoc';/.test(baca(f)),
  );
  c('semuanya mengimpornya dari lib/liveDoc', imporSalah.length === 0,
    imporSalah.join(', '));

  // Blok lamanya benar-benar hilang — bukan cuma ditambahi yang baru.
  //
  // Satu pengecualian yang sah: pengambilan SEKALI JALAN (`getDocs`) memang
  // tak bisa lewat liveList — liveList membungkus `onSnapshot`. Yang tetap
  // dilarang: menulis ULANG bentuk barisnya di situ. Jadi pemetaannya harus
  // memakai mapper BERNAMA yang sama dengan yang dipakai langganannya, bukan
  // blok `(d) => ({ … })` kedua yang gampang beda sendiri.
  const sisa = F.filter((f) => {
    const s = baca(f);
    const semua = s.match(/snapshot\.docs\.map\([^)]*\)/g) || [];
    if (semua.length === 0) return false;
    return !(
      /await getDocs\(/.test(s) &&
      semua.every((m) => /^snapshot\.docs\.map\(\w+\)$/.test(m))
    );
  });
  c('tak ada lagi snapshot.docs.map() yang ditulis tangan',
    sisa.length === 0, sisa.join(', '));

  // onSnapshot yang jadi nganggur ikut dibuang dari impornya.
  const nganggur = F.filter((f) => {
    const s = baca(f);
    return /^\s*onSnapshot,$/m.test(s) && !/\bonSnapshot\(/.test(s);
  });
  c('impor onSnapshot yang nganggur ikut dibuang', nganggur.length === 0,
    nganggur.join(', '));

  // 27 Sep 2026 — penjagaan DIKETATKAN, bukan dilonggarkan. Dulu di sini ada
  // pengecualian: `saku` & `learning` boleh tetap memakai `onSnapshot` mentah
  // "karena membangun bentuk lain, bukan array baris". Alasan itu ternyata
  // keliru: bentuk akhirnya memang beda, tapi `liveList` sudah menyediakan
  // pemeta baris (`row`) + pembungkus `onChange`, jadi peta saldo & arsip
  // rangkuman pun bisa lewat situ. Yang hilang gara-gara pengecualian itu
  // bukan kerapian, tapi pemasangan ulang listener yang mati.
  //
  // Sekarang aturannya tanpa kecuali: SATU-SATUNYA pemanggil `onSnapshot` di
  // seluruh lib/ adalah lib/liveDoc.ts sendiri.
  const semuaLib = fs
    .readdirSync(R + 'lib')
    .filter((f) => f.endsWith('.ts') && f !== 'liveDoc.ts');
  const mentah = semuaLib.filter((f) => /\bonSnapshot\(/.test(baca('lib/' + f)));
  c('tak ada lagi onSnapshot mentah di lib/ (cuma lib/liveDoc.ts)',
    mentah.length === 0, mentah.join(', ') || `${semuaLib.length} modul disisir`);
}

// =====================================================================
console.log('\n=== 6. Yang SENGAJA tidak diubah ===');
// =====================================================================
{
  // liveList SEKARANG menggabungkan kueri yang sama — sengaja diubah, karena
  // koleksi seperti `tasks` didengarkan Home, Dashboard & layar Reminder
  // sekaligus, dan ketiganya hidup berbarengan (tab tetap terpasang).
  //
  // Yang TIDAK ikut: cache disk. Isi koleksi tak bisa disimpan apa adanya
  // seperti satu dokumen, jadi kalau suatu hari AsyncStorage muncul di sini,
  // itu perubahan besar yang harus disengaja.
  const src = baca('lib/liveDoc.ts');
  const fn = src.slice(src.indexOf('export function liveList'),
    src.indexOf('export function unsubscribeAll'));
  c('liveList menggabungkan kueri yang sama', /queryEqual\(x\.q, q\)/.test(fn));
  c('…tapi tetap TANPA cache disk',
    !/AsyncStorage|readCache|writeCache/.test(fn));
  c('…dan tidak mencampuri peta dokumen milik liveDoc',
    !/entries\.get|entries\.set/.test(fn));
  c('bedanya dengan liveDoc ditulis di komentarnya',
    /TANPA cache disk/.test(src));

  // liveDoc sendiri tidak boleh ikut tergeser.
  c('liveDoc masih menggabungkan listener & menyimpan ke disk',
    /const entries = new Map<string, Entry>\(\);/.test(src) &&
      /writeCache\(path, snapshot\.exists\(\)/.test(src));
  c('unsubscribeAll tidak disentuh',
    /export function unsubscribeAll\(unsubs: \(\(\) => void\)\[\]\): \(\) => void \{\s*\n\s*return \(\) => unsubs\.forEach\(\(unsub\) => unsub\(\)\);/.test(src));

  // Bentuk yang BUKAN array baris (peta saldo Saku) tetap lewat liveList:
  // pemeta barisnya menghasilkan pasangan [key, saldo], lalu `onChange`-nya
  // dibungkus jadi Record. Dan sengaja TANPA limit — jumlah dompetnya dipatok
  // daftar FUNDS, jadi ia tidak bisa tumbuh sendiri.
  {
    const saku = baca('lib/saku.ts');
    const blok = /export function subscribeFundBalances[\s\S]*?\n\}/.exec(saku)?.[0] ?? '';
    c('peta saldo Saku dibangun dari liveList, bukan onSnapshot sendiri',
      /liveList<\[string, number\]>/.test(blok) && /Object\.fromEntries\(rows\)/.test(blok));
    c('langganan saldo Saku sengaja tanpa limit (dipatok daftar FUNDS)',
      !/limit\(/.test(blok) && /FUNDS/.test(blok));
  }
}

// =====================================================================
console.log('\n=== 7. Mapper ASLI tiap berkas ikut dijalankan ===');
// =====================================================================
// Yang paling mungkin rusak saat 20 blok dipindah bukan mesinnya, tapi
// PEMETAAN BARISNYA — satu nilai bawaan yang jatuh saat dipotong-tempel
// tidak akan ketahuan sampai suatu hari data lama tampil kosong.
// Jadi di sini fungsi subscribe-nya yang SUNGGUHAN dijalankan.
{
  fs.rmSync(path.join(__dirname, 'keluar-lv2'), { recursive: true, force: true });
  const OUT2 = path.join(__dirname, 'keluar-lv2');
  try {
    execFileSync(
      process.execPath,
      [
        R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
        R + 'lib/tasks.ts', R + 'lib/family.ts', R + 'lib/car.ts',
        R + 'lib/coreRules.ts',
        // 27 Sep 2026: tiga pindahan terbaru ikut DIJALANKAN, bukan cuma
        // dibaca bentuk tulisannya.
        R + 'lib/saku.ts', R + 'lib/tournament.ts', R + 'lib/multiplication.ts',
        '--outDir', OUT2,
        '--module', 'commonjs', '--target', 'es2020',
        '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
      ],
      { stdio: 'pipe' },
    );
  } catch { /* keluhan tipe diabaikan */ }

  const M2 = (nama) => {
    for (const k of [`lib/${nama}.js`, `${nama}.js`]) {
      const p = path.join(OUT2, ...k.split('/'));
      if (fs.existsSync(p)) return p;
    }
    return null;
  };
  // Modul-modul ini mengimpor liveDoc yang sudah dikompilasi tadi.
  const asliLoad = Module._load;
  Module._load = function (req, parent, isMain) {
    if (/liveDoc$/.test(req)) return require(MOD);
    if (req === 'firebase/firestore') {
      // Pembangun kueri cukup dikembalikan apa adanya — yang diuji di sini
      // pemetaan barisnya, bukan kuerinya.
      return {
        Timestamp: class {},
        collection: (...a) => ({ tag: 'collection', a }),
        query: (...a) => ({ tag: 'query', a }),
        orderBy: () => ({}), limit: () => ({}), where: () => ({}),
        doc: () => ({}), addDoc: () => {}, setDoc: () => {},
        updateDoc: () => {}, deleteDoc: () => {}, writeBatch: () => ({}),
        serverTimestamp: () => ({}), documentId: () => ({}),
        onSnapshot: (q, next, err) => {
          dipasang.push({ q, next, err });
          return () => {};
        },
      };
    }
    if (/\/firebase$/.test(req)) return { db: {} };
    if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
    return asliLoad.call(this, req, parent, isMain);
  };

  const jalankan = (modul, fn, args, rows) => {
    dipasang.length = 0;
    let hasil = null;
    modul[fn](...args, (items) => {
      hasil = items;
    });
    if (dipasang.length === 0) return null;
    dipasang[dipasang.length - 1].next(snap(rows));
    return hasil;
  };

  const tasks = require(M2('tasks'));
  const tugas = jalankan(tasks, 'subscribeTasks', ['u1'], [
    { id: 'lama', data: { title: 'Tanpa kategori' } },
    { id: 'baru', data: { title: 'Lengkap', category: 'work', dayId: '2026-01-01' } },
  ]);
  c('subscribeTasks: task lama tetap dapat kategori Personal',
    tugas?.[0].category === 'personal', JSON.stringify(tugas?.[0]));
  c('subscribeTasks: task lama tetap dapat dayId hari ini',
    /^\d{4}-\d{2}-\d{2}$/.test(tugas?.[0].dayId ?? ''), tugas?.[0].dayId);
  c('subscribeTasks: task lengkap tidak ditimpa',
    tugas?.[1].category === 'work' && tugas?.[1].dayId === '2026-01-01');

  const other = jalankan(tasks, 'subscribeOtherTasks', ['u1'], [
    { id: 'o1', data: { title: 'Lama' } },
  ]);
  c('subscribeOtherTasks: prioritas & catatan bawaannya utuh',
    other?.[0].priority === 2 && other?.[0].note === '' &&
      other?.[0].category === 'personal', JSON.stringify(other?.[0]));

  const family = require(M2('family'));
  const anggota = jalankan(family, 'subscribeFamily', ['u1'], [
    { id: 'f1', data: { name: 'Opa', birthYear: 1940 } },
  ]);
  c('subscribeFamily: anggota lama dapat lingkar "inti" & bukan "saya"',
    anggota?.[0].circle === 'inti' && anggota?.[0].isSelf === false,
    JSON.stringify(anggota?.[0]));
  c('subscribeFamily: relasi & foto kosongnya jadi nilai aman',
    Array.isArray(anggota?.[0].parentIds) &&
      Array.isArray(anggota?.[0].partnerIds) &&
      anggota?.[0].photo === null);

  const car = require(M2('car'));
  const log = jalankan(car, 'subscribeCarLogs', ['u1'], [
    { id: 'c1', data: { title: 'Servis', cost: 500 } },
    { id: 'c2', data: { title: 'Bensin', cost: 100, liters: 20 } },
  ]);
  c('subscribeCarLogs: catatan non-bensin tetap liters null (bukan undefined)',
    log?.[0].liters === null, String(log?.[0].liters));
  c('subscribeCarLogs: liters yang ada tidak dihapus', log?.[1].liters === 20);

  const rules = require(M2('coreRules'));
  const panduan = jalankan(rules, 'subscribeCoreRules', ['u1'], [
    { id: 'visitasi', data: { title: 'Panduan' } },
  ]);
  c('subscribeCoreRules: barisnya berkunci `kind`, bukan `id`',
    panduan?.[0].kind === 'visitasi' && panduan?.[0].id === undefined,
    JSON.stringify(panduan?.[0]));
  c('subscribeCoreRules: dokumen tanpa ikon dapat ikon jenis acaranya',
    typeof panduan?.[0].icon === 'string' && panduan[0].icon.length > 0,
    panduan?.[0].icon);

  // ---- Tiga pindahan 27 Sep 2026 ----
  // Saku paling berbeda: hasilnya PETA saldo, jadi yang diperiksa bukan cuma
  // nilainya tapi bentuknya — kalau ia diam-diam jadi array, daftar dompet
  // menampilkan saldo kosong tanpa satu pun galat.
  const saku = require(M2('saku'));
  const saldo = jalankan(saku, 'subscribeFundBalances', ['u1'], [
    { id: 'vacation', data: { balance: 250_000 } },
    { id: 'giving', data: {} },
  ]);
  c('subscribeFundBalances: hasilnya peta { key: saldo }, bukan array',
    !!saldo && !Array.isArray(saldo) && saldo.vacation === 250_000,
    JSON.stringify(saldo));
  c('subscribeFundBalances: dompet tanpa kolom balance jadi 0',
    saldo?.giving === 0, String(saldo?.giving));

  const turnamen = require(M2('tournament'));
  const juara = jalankan(turnamen, 'subscribeTournaments', ['u1'], [
    { id: 't1', data: { name: 'Badminton Agustus', size: 16, createdAt: 5 } },
    { id: 't2', data: {} },
  ]);
  c('subscribeTournaments: turnamen lama tanpa tanggal tetap date null',
    juara?.[0].date === null, String(juara?.[0].date));
  c('subscribeTournaments: dokumen kosong dapat nilai bawaan yang aman',
    juara?.[1].name === 'Turnamen' && juara?.[1].size === 8 &&
      Array.isArray(juara?.[1].participants) && Array.isArray(juara?.[1].matches) &&
      juara?.[1].champion === null,
    JSON.stringify(juara?.[1]));

  const multi = require(M2('multiplication'));
  const mult = jalankan(multi, 'subscribeMultiplications', ['u1'], [
    { id: 'm1', data: { fromName: 'CORE Lama', createdAt: 9 } },
  ]);
  c('subscribeMultiplications: nama & daftar langkahnya tidak jadi undefined',
    mult?.[0].fromName === 'CORE Lama' && mult?.[0].toName === '' &&
      Array.isArray(mult?.[0].steps) && Array.isArray(mult?.[0].members),
    JSON.stringify(mult?.[0]));

  Module._load = asliLoad;
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);