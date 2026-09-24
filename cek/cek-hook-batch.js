// Batch /rapihin: tiga hook bersama (useMonthCursor, useSearchMode,
// useBusyTask) menggantikan blok yang disalin di 13 berkas.
//
// Yang dibuktikan di sini BUKAN "tulisannya mirip", tapi hook-nya BENAR-BENAR
// DIJALANKAN di atas tiruan kecil useState React, lalu hasilnya dibandingkan
// langkah demi langkah dengan SALINAN PERSIS kode lama. Kalau ada satu langkah
// saja yang berbeda, uji ini merah.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'out-hook-batch');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

// ---------- Kompilasi hook-nya ke JS ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    'npx',
    ['tsc', '--ignoreConfig',
      'hooks/useMonthCursor.ts', 'hooks/useSearchMode.ts', 'hooks/useBusyTask.ts',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: R, shell: true, stdio: 'pipe' },
  );
} catch { /* error tipe tidak menghalangi emit — yang penting berkasnya jadi */ }

for (const f of ['useMonthCursor.js', 'useSearchMode.js', 'useBusyTask.js']) {
  if (!fs.existsSync(path.join(OUT, f))) {
    console.log('  ✗ gagal mengompilasi ' + f);
    process.exit(1);
  }
}

// ---------- Tiruan kecil useState React ----------
// Satu komponen, satu deret slot. `render()` memutar ulang badan komponennya
// dari awal — persis seperti React memanggil ulang fungsi komponen sesudah
// setState. Closure `run`/`toggleSearch` yang dikembalikan tiap render
// memotret state pada render ITU, sama seperti di app sungguhan.
const slots = [];
let cursor = 0;
function useState(init) {
  const i = cursor++;
  if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
  return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }];
}
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'react') return { useState };
  return asli.call(this, req, parent, isMain);
})(Module._load);

const { useMonthCursor } = require(path.join(OUT, 'useMonthCursor.js'));
const { useSearchMode } = require(path.join(OUT, 'useSearchMode.js'));
const { useBusyTask } = require(path.join(OUT, 'useBusyTask.js'));

/** Pasang satu "komponen" & sediakan cara me-render ulang. */
function pasang(komponen) {
  slots.length = 0;
  return { render: () => { cursor = 0; return komponen(); } };
}

async function main() {
  // ===================================================================
  console.log('=== 1. useMonthCursor: geser bulan sama persis dengan kode lama ===');
  // ===================================================================

  // SALINAN PERSIS kode lama (app/finance.tsx sebelum batch ini).
  const lamaShift = (year, month, delta) => {
    const d = new Date(year, month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  };

  {
    const now = new Date(2026, 7, 26); // 26 Agustus 2026
    const { render } = pasang(() => useMonthCursor(now));

    // Sapu 60 bulan maju lalu 120 bulan mundur, bandingkan TIAP langkah.
    let beda = 0;
    let bandingan = { year: now.getFullYear(), month: now.getMonth() };
    let api = render();
    for (const delta of [...Array(60).fill(1), ...Array(120).fill(-1)]) {
      bandingan = lamaShift(bandingan.year, bandingan.month, delta);
      api.shiftMonth(delta);
      api = render();
      if (api.year !== bandingan.year || api.month !== bandingan.month) beda += 1;
    }
    c('180 pergeseran bulan → hasilnya identik dengan kode lama', beda === 0);

    // Titik yang paling gampang salah kalau ditulis manual.
    const cek = [
      ['Des 2026 +1 → Jan 2027', 2026, 11, 1, 2027, 0],
      ['Jan 2026 −1 → Des 2025', 2026, 0, -1, 2025, 11],
      ['Mar 2026 −1 → Feb (bulan pendek)', 2026, 2, -1, 2026, 1],
      ['Jan 2026 +12 → Jan 2027', 2026, 0, 12, 2027, 0],
    ];
    let lolos = 0;
    for (const [nama, y, m, d, ey, em] of cek) {
      const { render: r2 } = pasang(() => useMonthCursor(new Date(y, m, 15)));
      r2().shiftMonth(d);
      const a = r2();
      const benar = a.year === ey && a.month === em;
      if (benar) lolos += 1;
      console.log(`      ${benar ? '·' : '!'} ${nama}`);
    }
    c('pergantian tahun & bulan pendek benar (4 kasus)', lolos === cek.length);

    const { render: r3 } = pasang(() => useMonthCursor(now));
    r3().shiftMonth(-7);
    r3().goNow();
    const balik = r3();
    c('goNow() balik ke bulan berjalan',
      balik.year === now.getFullYear() && balik.month === now.getMonth());
  }

  // ===================================================================
  console.log('\n=== 2. useSearchMode: urutan buka/tutup sama dengan kode lama ===');
  // ===================================================================

  // SALINAN PERSIS kode lama (TransactionsTab & fund/[key] sebelum batch ini):
  // kata kunci & urutan hanya di-reset saat DITUTUP.
  const lamaToggle = (s) => {
    const next = !s.searchMode;
    const b = { ...s, searchMode: next };
    if (!next) { b.query = ''; b.sort = 'recent'; }
    return b;
  };

  {
    // Kolom cari HANYA dirender selama mode cari menyala — jadi mengetik saat
    // mode cari mati itu mustahil. Skenario ini menirukan itu.
    const langkah = [
      'toggle', 'ketik:kopi', 'urut:high', 'toggle',   // buka, cari, urut, tutup
      'toggle', 'toggle',                              // buka-tutup kosong
      'toggle', 'ketik:bensin', 'toggle', 'toggle',    // buka, cari, tutup, buka
    ];

    let lama = { searchMode: false, query: '', sort: 'recent' };
    let sortBaru = 'recent';
    const { render } = pasang(() =>
      useSearchMode({ onClose: () => { sortBaru = 'recent'; } }),
    );
    let api = render();
    let beda = 0;

    for (const l of langkah) {
      if (l === 'toggle') {
        lama = lamaToggle(lama);
        api.toggleSearch();
        api = render();
      } else if (l.startsWith('ketik:')) {
        const kata = l.slice(6);
        lama = { ...lama, query: kata };
        api.setQuery(kata);
        api = render();
      } else {
        const s = l.slice(5);
        lama = { ...lama, sort: s };
        sortBaru = s;
      }
      const sama =
        api.searchMode === lama.searchMode &&
        api.query === lama.query &&
        sortBaru === lama.sort;
      if (!sama) beda += 1;
      console.log(
        `      ${sama ? '·' : '!'} ${l.padEnd(13)} cari=${api.searchMode ? 'ON ' : 'off'}` +
        ` kata="${api.query}" urut=${sortBaru}`,
      );
    }
    c(`${langkah.length} langkah tekan/ketik → identik dengan kode lama`, beda === 0);

    // Bukti bahwa "kosongkan tiap toggle" AMAN: saat DIBUKA kata kuncinya
    // memang selalu sudah kosong, karena penutupan sebelumnya mengosongkannya.
    const { render: r2 } = pasang(() => useSearchMode());
    let a2 = r2();
    a2.toggleSearch(); a2 = r2();       // buka
    a2.setQuery('halo'); a2 = r2();     // ketik
    a2.toggleSearch(); a2 = r2();       // tutup → kosong
    const kosongSaatTutup = a2.query === '' && a2.searchMode === false;
    a2.toggleSearch(); a2 = r2();       // buka lagi
    c('tutup mengosongkan kata kunci; dibuka lagi tetap kosong',
      kosongSaatTutup && a2.query === '' && a2.searchMode === true);

    // onClose HANYA saat menutup, onToggle tiap kali ditekan.
    let tutup = 0;
    let tekan = 0;
    const { render: r3 } = pasang(() =>
      useSearchMode({ onClose: () => { tutup += 1; }, onToggle: () => { tekan += 1; } }),
    );
    let a3 = r3();
    for (let i = 0; i < 5; i += 1) { a3.toggleSearch(); a3 = r3(); }
    c('5× tekan → onToggle 5×, onClose 2× (hanya saat menutup)',
      tekan === 5 && tutup === 2);
  }

  // ===================================================================
  console.log('\n=== 3. useBusyTask: penjaga & pemadam penanda sibuk ===');
  // ===================================================================

  {
    // (a) Sukses: penanda menyala selama bekerja, padam sesudahnya.
    const { render } = pasang(() => useBusyTask());
    let api = render();
    let sedang = null;
    let gagal = 0;
    let mulai = 0;

    await api.run({
      key: 'nota-1',
      start: () => { mulai += 1; },
      task: async () => { sedang = render().busy; },
      fail: () => { gagal += 1; },
    });
    api = render();
    c('selama bekerja, busy = key-nya (spinner cuma di baris itu)', sedang === 'nota-1');
    c('selesai → busy kembali null', api.busy === null);
    c('start dipanggil sekali, fail tidak dipanggil', mulai === 1 && gagal === 0);
  }

  {
    // (b) Gagal: fail dipanggil, DAN penanda tetap padam. Ini yang dulu gampang
    //     lupa ditulis di `finally` — sekali lupa, tombolnya mati selamanya.
    const { render } = pasang(() => useBusyTask());
    let api = render();
    let pesan = null;
    await api.run({
      key: 'nota-2',
      task: async () => { throw new Error('printer meledak'); },
      fail: () => { pesan = 'Gagal membuat PDF. Coba lagi.'; },
    });
    api = render();
    c('task melempar error → fail dipanggil (ada pesannya)', pesan !== null);
    c('walau gagal, busy tetap padam — tombolnya hidup lagi', api.busy === null);
  }

  {
    // (c) Tekanan kedua saat masih sibuk diabaikan — tidak cetak dobel.
    const { render } = pasang(() => useBusyTask());
    let api = render();
    let jalan = 0;
    let mulai = 0;
    let lepas;
    const tertahan = new Promise((res) => { lepas = res; });

    const pertama = api.run({
      key: 'a',
      start: () => { mulai += 1; },
      task: async () => { jalan += 1; await tertahan; },
      fail: () => {},
    });
    api = render(); // React sudah render ulang dengan busy='a'
    await api.run({
      key: 'b',
      start: () => { mulai += 1; },
      task: async () => { jalan += 1; },
      fail: () => {},
    });
    c('tekanan kedua saat sibuk: task-nya TIDAK jalan', jalan === 1);
    c('tekanan kedua juga tidak menjalankan start (pesan lama tak terhapus)', mulai === 1);
    c('key tetap milik tugas pertama, tidak dibajak tugas kedua', render().busy === 'a');

    lepas();
    await pertama;
    api = render();
    c('sesudah tugas pertama selesai → busy padam, siap dipakai lagi', api.busy === null);
    await api.run({ key: 'c', task: async () => { jalan += 1; }, fail: () => {} });
    c('tekanan berikutnya jalan normal', jalan === 2);
  }

  // ===================================================================
  console.log('\n=== 4. Salinan lama benar-benar hilang, hook-nya dipakai ===');
  // ===================================================================

  const PAKAI = {
    // InsuranceTab dulu ikut di sini; tab Insurance sudah dihapus permanen.
    'hooks/useMonthCursor.ts': ['app/finance.tsx', 'app/tasks.tsx'],
    'hooks/useSearchMode.ts': [
      'app/saku/[key].tsx', 'components/finance/TransactionsTab.tsx',
      'components/core/MonthlyTab.tsx', 'components/core/VisitationTab.tsx',
    ],
    'hooks/useBusyTask.ts': [
      'app/core-rules.tsx', 'app/leader-criteria.tsx', 'app/wheel.tsx',
      'components/core/MonthlyTab.tsx', 'components/core/VisitationTab.tsx',
      'app/profile.tsx', 'app/family.tsx',
      // 14 Sep 2026: form Fun (termasuk pemilih foto medali) pindah dari sheet
      // di FunArchive ke layar sendiri — pemakai useBusyTask-nya ikut pindah.
      'components/fun/FunEntryScreen.tsx',
    ],
  };
  for (const [hook, pemakai] of Object.entries(PAKAI)) {
    const nama = path.basename(hook, '.ts');
    const kurang = pemakai.filter((f) => !new RegExp(`@/hooks/${nama}`).test(baca(f)));
    c(`${nama.padEnd(15)} diimpor di ${pemakai.length} berkas`, kurang.length === 0);
    if (kurang.length) console.log('      belum: ' + kurang.join(', '));
  }

  // Blok lamanya tidak boleh tersisa di mana pun.
  const SEMUA = [...new Set(Object.values(PAKAI).flat())];
  const sisa = [];
  for (const f of SEMUA) {
    const src = baca(f);
    if (/const \[month, setMonth\] = useState\(now\.getMonth\(\)\)/.test(src)) sisa.push(f + ' :: state bulan lama');
    if (/setSearchMode\(/.test(src)) sisa.push(f + ' :: setSearchMode lama');
    if (/setSharingId\(|setSharing\(|setPhotoBusy\(/.test(src)) sisa.push(f + ' :: penanda sibuk lama');
    if (/function shiftMonth\(delta: number\) \{\s*const d = new Date/.test(src)) sisa.push(f + ' :: shiftMonth lama');
  }
  c('tak ada satu pun salinan blok lama yang tertinggal', sisa.length === 0);
  if (sisa.length) console.log('      ' + sisa.join('\n      '));

  // Hook-nya sendiri tidak boleh punya efek/dependency tersembunyi.
  for (const h of Object.keys(PAKAI)) {
    const src = baca(h);
    c(`${path.basename(h).padEnd(20)} murni useState (tanpa useEffect)`,
      !/useEffect/.test(src) && /useState/.test(src));
  }

  console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
  process.exit(ok ? 0 : 1);
}

main();
