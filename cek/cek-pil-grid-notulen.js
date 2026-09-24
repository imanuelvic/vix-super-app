// 23 Sep 2026 (malam) — tiga permintaan:
//   1. tab utama di kaki app punya PIL warna merek di tab yang sedang aktif
//   2. delapan tile grid Life bertukar posisi
//   3. ✨ Rapihkan notulen mengikuti BENTUK notulen pemiliknya sendiri
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');
const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-pil-grid');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

console.log('\n=== 1. Tab aktif punya pil warna merek ===');
{
  const ikon = baca('components/bounce-tab-icon.tsx');
  const tabs = baca('components/common/BottomTabs.tsx');
  ok('pilnya digambar saat tab-nya aktif', /\{focused && <View style=\{styles\.pil\} \/>\}/.test(ikon));
  // 24 Sep 2026: kaki app jadi BAR EMERALD GELAP, jadi pasangan warnanya
  // dibalik — dulu pil mint terang di atas bar putih, sekarang pil emerald di
  // atas bar gelap dengan ikon mint di atasnya. Yang dijaga tetap sama dan
  // tetap tegas: warnanya WAJIB dari token `Color`, tidak boleh hex lepas, dan
  // ikon aktifnya wajib kontras terhadap pilnya.
  const layar = baca('app/(tabs)/_layout.tsx');
  ok('warna pil dari token Color (TABBAR_PILL), bukan hex lepas',
    /backgroundColor: Color\.TABBAR_PILL/.test(ikon) && !/#[0-9a-f]{3,8}\b/i.test(ikon));
  ok('ikon aktifnya mint (TABBAR_ACTIVE), jadi kontras di atas pil emerald itu',
    /color=\{focused \? Color\.TABBAR_ACTIVE : color\}/.test(ikon));
  ok('barnya emerald gelap bergaris, bukan putih polos',
    /backgroundColor: Color\.TABBAR_BG/.test(layar) &&
    /borderTopWidth: 1,\s*\n\s*borderTopColor: Color\.TABBAR_LINE/.test(layar));
  ok('tulisan tab aktif PUTIH tebal, yang lain mint redup',
    /tabBarActiveTintColor: Color\.TEXT_REVERSE/.test(layar) &&
    /tabBarInactiveTintColor: Color\.TABBAR_INACTIVE/.test(layar) &&
    /heading=\{focused \? 'bold' : 'label'\}/.test(layar));
  // Dua bar di BottomTabs: baris sub-tab atas (topBar) & kaki layar fitur
  // (tabBar). Keduanya wajib memakai latar yang sama DAN punya garis
  // pemisahnya sendiri — dicek terpisah supaya tidak terikat urutan baris.
  ok('baris sub-tab tiap fitur ikut bergaya sama (bar gelap + garis)',
    (tabs.match(/backgroundColor: Color\.TABBAR_BG/g) ?? []).length === 2 &&
    /borderBottomWidth: 1,\s*\n\s*borderBottomColor: Color\.TABBAR_LINE/.test(tabs) &&
    /borderTopWidth: 1,\s*\n\s*borderTopColor: Color\.TABBAR_LINE/.test(tabs));
  ok('pil sub-tab yang aktif TETAP memakai warna fiturnya (pastel di atas gelap)',
    /active && \{ backgroundColor: bg, borderColor: bg \}/.test(tabs) &&
    /\[styles\.activePill, \{ backgroundColor: bg \}\]/.test(tabs));
  // 24 Sep 2026: lengkungan kepala layar PINDAH. Dulu pita ScreenHeader yang
  // membulat dan baris sub-tab mengikutinya; sekarang pitanya rata dan baris
  // sub-tab yang memegang lengkungannya, karena ia yang ada di paling bawah.
  // Dua-duanya dijaga di sini supaya tidak pernah membulat berbarengan (takik
  // krem di sudut) maupun rata berbarengan (kepala layar jadi kotak keras).
  const pita = baca('components/common/ScreenHeader.tsx');
  ok('lengkungan kepala layar dipegang baris sub-tab, pitanya rata',
    /borderBottomLeftRadius: 24,\s*\n\s*borderBottomRightRadius: 24/.test(tabs) &&
    !/borderBottomLeftRadius/.test(pita));
  ok('baris sub-tab menempel ke pita (napas BAND_GAP ditiadakan)',
    /marginTop: -BAND_GAP,/.test(tabs) && /export const BAND_GAP = 6;/.test(pita));
  ok('kedua bar bawah (kaki app & kaki fitur) membulat 20 di atasnya',
    /borderTopLeftRadius: 20,\s*\n\s*borderTopRightRadius: 20/.test(tabs) &&
    /borderTopLeftRadius: 20,\s*\n\s*borderTopRightRadius: 20/.test(layar));

  // ---- Label sub-tab aktif HARUS terbaca di atas bar gelap ----
  //
  // 24 Sep 2026, ditemukan dari layar sungguhan: ikon sub-tab ada DI DALAM pil
  // pastel, tapi LABELNYA duduk di luar pil, langsung di atas bar emerald
  // gelap. Sempat dipakai warna gelap fitur (fg) untuk keduanya, dan akibatnya
  // fatal: `TASKS_DARK` nilainya persis #0B3D36 — warna barnya sendiri — jadi
  // label "Daily" di layar Reminder benar-benar tidak terlihat (1,00:1).
  //
  // Cek di bawah bukan cuma memastikan kodenya memakai `bg`, tapi MENGHITUNG
  // kontras tiap warna fitur terhadap barnya. Jadi kalau suatu hari ada fitur
  // baru dengan pastel yang terlalu gelap, ia ketahuan di sini, bukan di HP.
  ok('label sub-tab aktif memakai PASTEL fitur (bg), bukan warna gelapnya (fg)',
    /additionalStyle=\{\{ color: active \? bg : Color\.TABBAR_INACTIVE \}\}/.test(tabs));
  ok('ikonnya tetap fg karena ia DI DALAM pil pastel itu',
    /color=\{active \? fg : Color\.TABBAR_INACTIVE\}/.test(tabs));

  {
    const luminansi = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const kontras = (a, b) => {
      const [x, y] = [luminansi(a), luminansi(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };

    const warna = baca('assets/style/color.ts');
    const nilai = new Map();
    for (const m of warna.matchAll(/^const ([A-Z_]+) = '(#[0-9A-Fa-f]{6})';/gm)) nilai.set(m[1], m[2]);
    for (const m of warna.matchAll(/^\s*([A-Z_]+): '(#[0-9A-Fa-f]{6})'/gm)) nilai.set(m[1], m[2]);
    for (const m of warna.matchAll(/^\s*([A-Z_]+): ([A-Z_]+),/gm)) {
      if (nilai.has(m[2]) && !nilai.has(m[1])) nilai.set(m[1], nilai.get(m[2]));
    }
    const bar = nilai.get('TABBAR_BG');

    const grid = baca('lib/featureGrid.ts');
    const pastel = [...new Set([...grid.matchAll(/bg: Color\.([A-Z_]+)/g)].map((m) => m[1]))];
    const jelek = pastel
      .map((k) => [k, nilai.get(k)])
      .filter(([, h]) => h)
      .map(([k, h]) => [k, kontras(h, bar)])
      .filter(([, c]) => c < 4.5);

    ok(`SEMUA ${pastel.length} pastel fitur terbaca di atas bar (≥ 4,5:1)`,
      bar !== undefined && pastel.length >= 20 && jelek.length === 0,
      jelek.map(([k, c]) => `${k} ${c.toFixed(2)}:1`).join(', '));

    // Jaring pengaman terakhir: kalau suatu saat kodenya diubah balik ke `fg`,
    // ini yang menjelaskan KENAPA itu salah dengan angka, bukan pendapat.
    const fgTasks = nilai.get('TASKS_DARK');
    ok('bukti kenapa fg salah: TASKS_DARK vs bar = 1,00:1 (warna yang sama persis)',
      fgTasks === bar, `${fgTasks} vs ${bar}`);
  }
  ok('posisinya mutlak & melebar keluar kotak ikon → tinggi tab bar tidak bergeser',
    /position: 'absolute'/.test(ikon) && /top: -5,\s*\n\s*bottom: -5,/.test(ikon) &&
    /left: -16,\s*\n\s*right: -16,/.test(ikon) && /borderRadius: 999/.test(ikon));
  ok('bentuknya sama bahasanya dengan pil sub-tab di dalam fitur',
    /activePill: \{\s*\n\s*position: 'absolute'/.test(tabs) && /borderRadius: 999/.test(tabs));
  ok('lompatan kecil saat berpindah tab tetap ada (useTabJump yang sama)',
    /const lompat = useTabJump\(focused\);/.test(ikon));
}

console.log('\n=== 2. Delapan tile bertukar posisi ===');
{
  fs.rmSync(OUT, { recursive: true, force: true });
  try {
    execFileSync(process.execPath, [
      ROOT + '/node_modules/typescript/bin/tsc', '--ignoreConfig',
      ROOT + '/lib/featureGrid.ts', '--outDir', OUT, '--module', 'commonjs',
      '--target', 'es2020', '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ], { stdio: 'pipe' });
  } catch { /* galat tipe diabaikan, yang penting JS-nya terbit */ }
  const asli = Module._load;
  Module._load = function (req, parent, isMain) {
    if (req === '@/assets/style/color') return { Color: new Proxy({}, { get: () => '#000000' }) };
    if (req === 'expo-router') return {};
    return asli.call(this, req, parent, isMain);
  };
  const G = require(path.join(OUT, 'featureGrid.js'));
  Module._load = asli;

  const life = G.LIFE_FEATURES.map((f) => f.label);
  const HARUS = [
    'Reminder', 'Health', 'Fitness', 'Habits',
    'Finance', 'Learning', 'Family', 'Invest',
    'News', 'Book', 'Fun', 'Wheel',
    'Car', 'Residence', 'Friends', 'Games',
    'Device', 'Reward', 'Profile', 'System',
  ];
  ok('grid Life persis urutan yang diminta', JSON.stringify(life) === JSON.stringify(HARUS), life.join(' · '));
  const no = Object.fromEntries(G.HOME_FEATURES.map((f) => [f.key, f.sort]));
  // 23 Sep 2026 (paling akhir): Habits ↔ Reminder ikut bertukar, jadi Reminder
  // yang membuka grid dan Habits duduk di ujung baris pertama.
  ok('putaran lima + Habits ↔ Reminder',
    no.finance === 6 && no.learning === 7 && no.fitness === 3 && no.health === 1 && no.tasks === 0.5);
  ok('Car ↔ Fun', no.car === 15 && no.fun === 13);
  ok('Residence ↔ Wheel', no.residence === 16 && no.wheel === 14);
  ok('Device ↔ Friends', no.device === 19 && no.friends === 17);
  ok('tidak ada nomor kembar (urutan tetap bisa dipercaya)',
    new Set(G.HOME_FEATURES.map((f) => f.sort)).size === G.HOME_FEATURES.length);
  ok('yang sudah punya tab utama tetap tidak digambar di grid',
    !life.includes('Spiritual') && !life.includes('CORE') && !life.includes('Career'));
}

console.log('\n=== 3. Notulen: bentuknya mengikuti punya pemiliknya ===');
{
  const n = baca('lib/notulenAi.ts');
  ok('bentuk poin "• N - 🎓Judul" diajarkan ke model',
    /• 1 - 🎓Judul poinnya/.test(n) && /dimulai "• " lalu nomor urut/.test(n));
  ok('tanggal · jam · tempat turun ke barisnya sendiri, berlambang',
    /🗓️ tanggal, 🕙 jam, 📍 tempat/.test(n) && /TIDAK ditulis di dalam judul/.test(n));
  ok('rincian turunan pakai baris "- "', /ditulis sebagai baris "- " di bawah judulnya/.test(n));
  ok('ada satu contoh jadi, diambil dari notulen aslinya',
    /• 5 - ⛪CORE & Leaders Meeting #3/.test(n) && /📍 R\. Megasa, NDC Central Park/.test(n));
  ok('daftar lambang yang disarankan ikut diberikan', /🎓 kelas\/materi · ⛪ ibadah\/meeting/.test(n));
  // Komentar sejarahnya boleh menyebut tanpaEmoji(); yang dijaga KODENYA.
  const kode = n.replace(/^\s*\/\/.*$/gm, '');
  ok('lambang TIDAK lagi dibuang di finalisasi (dulu tanpaEmoji)',
    /hasil\[k\] = stripEmDash\(v\);/.test(kode) && !/tanpaEmoji\(/.test(kode) && !/TANPA_EMOJI/.test(kode));
  ok('pagar isi tetap: tidak mengarang, tidak membuang, bagian kosong tetap kosong',
    /JANGAN menambah fakta/.test(n) && /JANGAN membuang fakta yang ada/.test(n) &&
    /Bagian yang kosong tetap kosong/.test(n));
  ok('ruang jawabannya dinaikkan karena satu poin kini bisa tiga baris',
    /maxOutputTokens: 8192/.test(n));
  ok('Wheel of Life TETAP tanpa lambang (dicetak ke PDF visitasi)',
    /\$\{TANPA_EMOJI\}/.test(baca('lib/wheelAi.ts')) && /tanpaEmoji\(stripEmDash\(v\)\)/.test(baca('lib/wheelAi.ts')));
  ok('layar notulen tetap memanggil rapikanNotulen yang sama',
    /rapikanNotulen\(/.test(baca('app/core/monthly/[id].tsx')));
}

console.log(gagal === 0 ? '\n✅ LULUS — pil tab, urutan grid, & bentuk notulen beres.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
