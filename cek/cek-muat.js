// Batch /rapihin: pola "ambil sekali dari luar" (harga pasar, berita, Apple
// Health) diekstrak jadi hooks/useAsyncData.ts + hooks/useHealthToday.ts.
//
// Hook-nya BENAR-BENAR DIJALANKAN di sini lewat tiruan kecil runtime React
// (useState + useEffect + useCallback), dengan aturan yang sama: efek jalan
// ulang hanya kalau salah satu dependency-nya berubah, dan cleanup dipanggil
// sebelum efek berikutnya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-muat');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Tiruan runtime React ============
const H = {
  states: [], efekLama: [], memo: [],
  iState: 0, iEfek: 0, iMemo: 0, antre: [],
  dalamEfek: false, tulisSaatEfek: 0,
};

function useState(init) {
  const idx = H.iState++;
  if (!(idx in H.states)) {
    H.states[idx] = typeof init === 'function' ? init() : init;
  }
  const set = (v) => {
    // Inilah yang dilarang React Compiler: setState yang jalan LANGSUNG di
    // badan efek. Dicatat supaya bisa dibuktikan tidak pernah terjadi.
    if (H.dalamEfek) H.tulisSaatEfek++;
    H.states[idx] = typeof v === 'function' ? v(H.states[idx]) : v;
  };
  return [H.states[idx], set];
}

function useEffect(fn, deps) {
  H.antre.push({ idx: H.iEfek++, fn, deps });
}

function useCallback(fn, deps) {
  const idx = H.iMemo++;
  const lama = H.memo[idx];
  const berubah = !lama || deps.some((d, k) => !Object.is(d, lama.deps[k]));
  if (berubah) H.memo[idx] = { fn, deps };
  return H.memo[idx].fn;
}

function render(fn, ...args) {
  H.iState = 0; H.iEfek = 0; H.iMemo = 0; H.antre = [];
  const hasil = fn(...args);
  H.dalamEfek = true;
  for (const e of H.antre) {
    const lama = H.efekLama[e.idx];
    const berubah = !lama || e.deps.some((d, k) => !Object.is(d, lama.deps[k]));
    if (!berubah) continue;
    if (lama && lama.bersih) lama.bersih();
    H.efekLama[e.idx] = { deps: e.deps, bersih: e.fn() || null };
  }
  H.dalamEfek = false;
  return hasil;
}

function pasangBaru() {
  H.states = []; H.efekLama = []; H.memo = []; H.tulisSaatEfek = 0;
}

const tunggu = () => new Promise((r) => setImmediate(r));

// ============ Kompilasi & pasang hook aslinya ============
for (const f of ['hooks/useAsyncData.ts', 'hooks/useHealthToday.ts']) {
  try {
    execFileSync(
      'npx',
      ['tsc', path.join(ROOT, f), '--ignoreConfig', '--outDir', OUT,
        '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
        '--esModuleInterop', '--moduleResolution', 'bundler'],
      { cwd: ROOT, stdio: 'pipe', shell: true },
    );
  } catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
}
for (const f of ['useAsyncData.js', 'useHealthToday.js']) {
  if (!fs.existsSync(path.join(OUT, f))) {
    console.log(`  ❌ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}

// Apple Health palsu.
const hk = { status: 'ok', hasil: { steps: 8000 }, dipanggil: 0, tolak: false };
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'react') return { useState, useEffect, useCallback };
  if (req === '@/hooks/useAsyncData') return require(path.join(OUT, 'useAsyncData.js'));
  if (req === '@/lib/healthkit') {
    return {
      healthKitStatus: () => hk.status,
      readTodaySummary: () => {
        hk.dipanggil++;
        return hk.tolak ? Promise.reject(new Error('hk mati')) : Promise.resolve(hk.hasil);
      },
      readRecentDailySteps: () => Promise.resolve(null),
    };
  }
  return asli(req, parent, isMain);
};
const { useAsyncData } = require(path.join(OUT, 'useAsyncData.js'));
const { useHealthToday } = require(path.join(OUT, 'useHealthToday.js'));
Module._load = asli;

const PESAN = 'Gagal mengambil harga emas. Coba lagi.';

/** Pembuat loader yang jawabannya bisa ditunda/ditentukan dari tes. */
function bikinLoader(nama) {
  const catatan = { panggilan: [], tunda: [] };
  const fn = (force) => {
    catatan.panggilan.push(force);
    return new Promise((selesai, gagalkan) => {
      catatan.tunda.push({ selesai, gagalkan });
    });
  };
  fn.catatan = catatan;
  fn.namaUji = nama;
  return fn;
}

// ===================================================================
async function jalan() {
  console.log('\n=== Muat pertama ===');
  pasangBaru();
  let emas = bikinLoader('emas');
  let h = render(useAsyncData, emas, PESAN);
  ok('langsung loading, belum ada isi & belum ada galat',
    h.loading === true && h.data === null && h.error === null,
    JSON.stringify({ loading: h.loading, data: h.data, error: h.error }));
  ok('pengambilnya dipanggil sekali, tanpa force',
    emas.catatan.panggilan.length === 1 && emas.catatan.panggilan[0] === false,
    JSON.stringify(emas.catatan.panggilan));
  ok('TIDAK ada satu pun setState yang jalan langsung di badan efek ' +
     '(inilah yang dilarang React Compiler)',
    H.tulisSaatEfek === 0, `${H.tulisSaatEfek} tulisan`);

  emas.catatan.tunda[0].selesai({ current: 100 });
  await tunggu();
  h = render(useAsyncData, emas, PESAN);
  ok('sesudah jawabannya sampai: berhenti loading, isinya tampil',
    h.loading === false && h.data.current === 100 && h.error === null,
    JSON.stringify(h.data));

  console.log('\n=== Tombol 🔄 muat ulang ===');
  h.reload(true);
  h = render(useAsyncData, emas, PESAN);
  ok('loading menyala lagi di render yang sama (tak perlu menunggu efek)',
    h.loading === true, String(h.loading));
  ok('isi lama tetap terbaca selagi memuat (grafik tidak berkedip kosong)',
    h.data.current === 100, JSON.stringify(h.data));
  ok('force diteruskan ke pengambilnya (melewati cache)',
    emas.catatan.panggilan.length === 2 && emas.catatan.panggilan[1] === true,
    JSON.stringify(emas.catatan.panggilan));
  emas.catatan.tunda[1].selesai({ current: 111 });
  await tunggu();
  h = render(useAsyncData, emas, PESAN);
  ok('angkanya diperbarui', h.data.current === 111 && h.loading === false);

  console.log('\n=== Muat ulang GAGAL (perilaku tab pasar) ===');
  h.reload(true);
  h = render(useAsyncData, emas, PESAN);
  emas.catatan.tunda[2].gagalkan(new Error('offline'));
  await tunggu();
  h = render(useAsyncData, emas, PESAN);
  ok('pesan galatnya muncul', h.error === PESAN, String(h.error));
  ok('berhenti loading', h.loading === false, String(h.loading));
  ok('angka & grafik LAMA tetap tampil — sama seperti sebelum dirapikan',
    h.data.current === 111, JSON.stringify(h.data));

  console.log('\n=== Coba lagi sesudah gagal ===');
  h.reload(true);
  h = render(useAsyncData, emas, PESAN);
  ok('galatnya langsung bersih begitu ditekan (pengganti setError(null) yang dulu ' +
     'jalan di awal loader)', h.error === null, String(h.error));
  ok('dan loading menyala', h.loading === true);

  console.log('\n=== Gagal DENGAN isi ikut dikosongkan (perilaku tab News) ===');
  pasangBaru();
  const berita = bikinLoader('berita');
  h = render(useAsyncData, berita, PESAN, false);
  berita.catatan.tunda[0].selesai(['judul 1']);
  await tunggu();
  h = render(useAsyncData, berita, PESAN, false);
  ok('daftar pertama masuk', h.data.length === 1);
  h.reload();
  h = render(useAsyncData, berita, PESAN, false);
  berita.catatan.tunda[1].gagalkan(new Error('rss mati'));
  await tunggu();
  h = render(useAsyncData, berita, PESAN, false);
  ok('daftarnya ikut dikosongkan (bukan daftar basi)', h.data === null, JSON.stringify(h.data));
  ok('pesan galatnya tampil', h.error === PESAN);
  h.reload();
  h = render(useAsyncData, berita, PESAN, false);
  ok('"Coba lagi" → mulai dari layar kosong + loading, persis seperti dulu',
    h.data === null && h.loading === true && h.error === null);

  console.log('\n=== Ganti sumber (fungsi pengambilnya berganti) ===');
  pasangBaru();
  const sumberA = bikinLoader('A');
  const sumberB = bikinLoader('B');
  h = render(useAsyncData, sumberA, PESAN, false);
  sumberA.catatan.tunda[0].selesai(['berita A']);
  await tunggu();
  h = render(useAsyncData, sumberA, PESAN, false);
  ok('sumber A tampil', h.data[0] === 'berita A');

  h = render(useAsyncData, sumberB, PESAN, false);
  ok('begitu sumbernya diganti, loading langsung menyala tanpa menekan apa pun',
    h.loading === true, String(h.loading));
  ok('pengambil sumber B ikut dipanggil', sumberB.catatan.panggilan.length === 1);
  sumberB.catatan.tunda[0].selesai(['berita B']);
  await tunggu();
  h = render(useAsyncData, sumberB, PESAN, false);
  ok('sumber B tampil', h.data[0] === 'berita B' && h.loading === false);

  // Jawaban sumber A yang telat datang TIDAK boleh menimpa B.
  sumberA.catatan.tunda.push({});
  h = render(useAsyncData, sumberB, PESAN, false);
  await tunggu();
  h = render(useAsyncData, sumberB, PESAN, false);
  ok('jawaban sumber lama yang telat sampai tidak menimpa yang baru',
    h.data[0] === 'berita B', JSON.stringify(h.data));

  console.log('\n=== load = null (belum boleh mengambil apa-apa) ===');
  pasangBaru();
  const diam = bikinLoader('diam');
  h = render(useAsyncData, null, PESAN);
  ok('tidak loading & tidak ada permintaan yang dikirim',
    h.loading === false && diam.catatan.panggilan.length === 0);
  ok('isinya null, galatnya null', h.data === null && h.error === null);

  // =================================================================
  console.log('\n=== Apple Health: satu hook untuk dua layar ===');
  pasangBaru();
  hk.status = 'ok'; hk.dipanggil = 0; hk.hasil = { steps: 8000 };
  let hh = render(useHealthToday);
  ok('izin ada → langsung mengambil, tanpa menunggu tombol', hk.dipanggil === 1);
  ok('selagi mengambil, tombol 🔄 dinonaktifkan (busy)', hh.busy === true);
  await tunggu();
  hh = render(useHealthToday);
  ok('angkanya masuk & busy padam',
    hh.today.steps === 8000 && hh.busy === false, JSON.stringify(hh.today));
  ok('status diteruskan apa adanya', hh.status === 'ok');

  // Angka barunya disiapkan DULU: Apple Health palsu ini menjawab dengan isi
  // `hk.hasil` pada saat dipanggil.
  hk.hasil = { steps: 9500 };
  hh.reload();
  hh = render(useHealthToday);
  ok('tombol 🔄 memicu pengambilan baru', hk.dipanggil === 2 && hh.busy === true);
  await tunggu();
  hh = render(useHealthToday);
  ok('angkanya ikut diperbarui', hh.today.steps === 9500 && hh.busy === false);

  console.log('\n=== Apple Health tidak tersedia ===');
  pasangBaru();
  hk.status = 'needs-build'; hk.dipanggil = 0;
  hh = render(useHealthToday);
  await tunggu();
  hh = render(useHealthToday);
  ok('tidak ada permintaan ke Apple Health sama sekali', hk.dipanggil === 0);
  ok('busy TIDAK menyala selamanya (loading yang tak pernah selesai)',
    hh.busy === false, String(hh.busy));
  ok('status apa adanya, angkanya null', hh.status === 'needs-build' && hh.today === null);

  console.log('\n=== Apple Health error → didiamkan ===');
  pasangBaru();
  hk.status = 'ok'; hk.dipanggil = 0; hk.tolak = true;
  hh = render(useHealthToday);
  await tunggu();
  hh = render(useHealthToday);
  ok('gagal baca tidak membuat layar macet loading', hh.busy === false);
  ok('angkanya tetap null (rekor tersimpan yang dipakai)', hh.today === null);
  hk.tolak = false;

  // =================================================================
  console.log('\n=== Salinan lamanya sudah hilang dari layar ===');
  const market = baca('components/investment/MarketTab.tsx');
  const news = baca('components/news/NewsTab.tsx');
  const stepsTab = baca('components/health/StepsTab.tsx');
  const stepsScreen = baca('app/steps.tsx');

  ok('hook pasar tidak lagi menumpang di berkas komponen',
    !/export function useMarket/.test(market) && !/useState<T \| null>/.test(market));
  ok('MarketTab kini murni tampilan (tak ada lagi useEffect/useCallback)',
    !/useEffect|useCallback/.test(market));
  for (const f of ['GoldTab', 'CryptoTab', 'StockTab', 'ForexTab']) {
    const src = baca(`components/investment/${f}.tsx`);
    ok(`${f} memakai hook bersama useAsyncData`,
      /useAsyncData\(/.test(src) && /from '@\/hooks\/useAsyncData'/.test(src) &&
      !/useMarket/.test(src));
  }
  ok('tab News memakai hook yang sama (bukan salinan sendiri)',
    /useAsyncData\(load, NEWS_ERROR, false\)/.test(news) &&
    !/setBusy|setItems/.test(news));
  ok('kedua layar langkah memakai useHealthToday',
    /useHealthToday\(\)/.test(stepsTab) && /useHealthToday\(\)/.test(stepsScreen));
  ok('tak ada lagi pembacaan Apple Health yang disalin di kedua layar',
    !/readTodaySummary/.test(stepsTab) && !/readTodaySummary/.test(stepsScreen) &&
    !/healthKitStatus/.test(stepsTab) && !/healthKitStatus/.test(stepsScreen));

  console.log('\n=== Yang tidak boleh berubah di layarnya ===');
  ok('tombol 🔄 Steps tetap padam selagi mengambil',
    /disabled=\{hkBusy\}/.test(stepsTab) &&
    /hkBusy \? Color\.TEXT_PLACEHOLDER : Color\.MAIN/.test(stepsTab));
  ok('backfill riwayat Apple Health tetap sekali per buka (tidak ikut diutak-atik)',
    /backfilled\.current = true/.test(stepsTab) &&
    /backfilledRef\.current = true/.test(stepsScreen));
  ok('News: tarik-ke-bawah & "Coba lagi" tetap memuat ulang',
    (news.match(/onPress=\{\(\) => reload\(\)\}/g) ?? []).length === 1 &&
    (news.match(/onRefresh=\{\(\) => reload\(\)\}/g) ?? []).length === 1);
  ok('Emas: galat "gagal membuka tautan" tetap tampil di tempat yang sama & ' +
     'ikut hilang saat 🔄 ditekan',
    /error=\{linkError \?\? error\}/.test(baca('components/investment/GoldTab.tsx')) &&
    /setLinkError\(null\);\s*\n\s*reload\(true\);/.test(baca('components/investment/GoldTab.tsx')));

  console.log('\n=== Finance & Fun: loading diturunkan dari kuncinya ===');
  const fin = baca('app/finance.tsx');
  // 30 Agu 2026: badan arsip Fun pindah ke komponen bersama (dipakai juga
  // tab Race di Health), jadi yang diperiksa berkas komponennya.
  const fun = baca('components/fun/FunArchive.tsx');
  ok('Finance memakai useKeyedData dengan kunci tahun-bulan',
    /useKeyedData<string, Transaction\[\]>\(\s*`\$\{year\}-\$\{month\}`,?\s*\)/.test(fin));
  ok('Fun memakai useKeyedData dengan kunci pemiliknya',
    /useKeyedData<[\s\S]{0,60}>\(user\?\.uid\)/.test(fun));
  ok('tak ada lagi setLoading di kedua layar',
    !/setLoading/.test(fin) && !/setLoading/.test(fun));
  ok('loading diturunkan, bukan diatur lewat efek',
    /const loading = loaded === null;/.test(fin) &&
    /const loading = loaded === null;/.test(fun));
  ok('gagal memuat tetap berhenti loading (daftar kosong + pesan galat)',
    /setItems\(\[\]\);\s*\n\s*setError\(LOAD_ERROR\);/.test(fin) &&
    /setData\(EMPTY_FUN\);\s*\n\s*setError\(LOAD_ERROR\);/.test(fun));
  ok('Finance tetap hanya berlangganan sesudah PIN dibuka (tak ada biaya read ' +
     'kalau batal masuk)',
    // 22 Sep 2026: keempat langganannya lewat useLiveAll { when: unlocked }
    // (pinjaman, riwayat 3 bulan, transaksi+budget bulan ini, sub-kategori).
    (fin.match(/when: unlocked \}/g) ?? []).length === 4 && !/if \(!user \|\| !unlocked\) return;/.test(fin));
  ok('urutan & isi daftarnya tidak disentuh',
    /subscribeTransactionsByMonth\(/.test(fin) && /subscribeFun\(/.test(fun));

  console.log(gagal === 0
    ? '\n✅ LULUS — satu hook untuk semua pengambilan sekali-jalan.'
    : `\n❌ ${gagal} cek gagal.`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan();
