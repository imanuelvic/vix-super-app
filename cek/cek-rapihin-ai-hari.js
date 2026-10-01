// /rapihin 1 Okt 2026 — catatan harian fitur AI jadi SATU tempat.
//
// Empat fitur AI (Refleksi harian, Vix Financial Coach, Analysis pasar,
// Rekomendasi Budget) masing-masing menulis blok yang sama persis: awalan
// kunci AsyncStorage, try/catch baca, JSON.parse, normalisasi field, try/catch
// tulis, lalu `Math.max(0, CAP - terpakai)`. Lima layarnya menulis efek pemuat
// yang sama pula, lengkap dengan penjaga `hidup` supaya setState tidak
// dipanggil pada layar yang sudah ditutup.
//
// Sekarang: lib/aiDay.ts (penyimpanannya) + hooks/useAiDay.ts (sisi React-nya).
//
// Yang DIJALANKAN sungguhan di sini mekanika penyimpanannya, memakai
// AsyncStorage palsu yang bisa dibuat menolak menulis. Dua hal yang diuji
// bukan "apakah kodenya ada", tapi "apakah janjinya ditepati":
//   • kunci penyimpanannya TETAP "ai:<fitur>:<dayId>" — kalau berubah, jatah
//     hari ini terbaca kosong dan hasil yang sudah didapat hilang,
//   • menulis yang GAGAL tidak boleh menggagalkan apa pun.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-rapihin-ai-hari');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Isi berkas TANPA komentar — supaya cek tidak membaca komentar sebagai kode. */
const kode = (p) =>
  baca(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/aiDay.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// AsyncStorage palsu yang bisa dibuat penuh — persis keadaan yang paling
// jarang diuji dan paling tidak boleh merusak apa pun.
const SIMPAN = new Map();
let tolakTulis = false;
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@react-native-async-storage/async-storage') {
    return {
      __esModule: true,
      default: {
        getItem: async (k) => (SIMPAN.has(k) ? SIMPAN.get(k) : null),
        setItem: async (k, v) => {
          if (tolakTulis) throw new Error('penyimpanan penuh');
          SIMPAN.set(k, v);
        },
      },
    };
  }
  return asli(req, parent, isMain);
};
const D = require(path.join(OUT, 'aiDay.js'));
Module._load = asli;

/** Gudang contoh dengan bentuk seperti milik fitur sungguhan. */
const KOSONG = { attempts: 0, hasil: {} };
const GUDANG = D.aiDayStore('uji', KOSONG, (v) => ({
  attempts: typeof v.attempts === 'number' ? v.attempts : 0,
  hasil: v.hasil && typeof v.hasil === 'object' ? v.hasil : {},
}));

// =====================================================================
console.log('\n=== 1. Gudang harian: kuncinya & janjinya ===');
// =====================================================================
(async () => {
  await GUDANG.save('2026-10-01', { attempts: 2, hasil: { a: 1 } });
  // Kunci inilah yang tidak boleh berubah: pemilik app sudah punya catatan
  // hari ini tersimpan dengan nama itu.
  ok('kuncinya "ai:<fitur>:<dayId>", bukan nama karangan',
    SIMPAN.has('ai:uji:2026-10-01'),
    [...SIMPAN.keys()].join(', '));

  const kembali = await GUDANG.load('2026-10-01');
  ok('yang disimpan terbaca utuh',
    kembali.attempts === 2 && kembali.hasil.a === 1);

  ok('hari yang belum tersentuh = catatan kosong',
    (await GUDANG.load('2026-10-02')) === KOSONG);

  SIMPAN.set('ai:uji:2026-10-03', '{bukan json');
  const rusak = await GUDANG.load('2026-10-03');
  ok('data rusak dianggap kosong, tidak melempar', rusak === KOSONG);

  // Versi app lama, isi separuh, field yang tipenya berubah: `bentuk` harus
  // memeriksa, bukan memercayai.
  SIMPAN.set('ai:uji:2026-10-04', JSON.stringify({ attempts: 'dua', hasil: null }));
  const aneh = await GUDANG.load('2026-10-04');
  ok('field bertipe salah dibentuk ulang, bukan diteruskan apa adanya',
    aneh.attempts === 0 && typeof aneh.hasil === 'object' && aneh.hasil !== null);

  // Inilah bagian yang paling gampang lupa disalin ke fitur kelima.
  tolakTulis = true;
  let melempar = false;
  try {
    await GUDANG.save('2026-10-05', { attempts: 1, hasil: {} });
  } catch {
    melempar = true;
  }
  tolakTulis = false;
  ok('penyimpanan penuh TIDAK menggagalkan apa pun', !melempar);

  ok('sisa jatah tidak pernah minus',
    D.sisaJatah(3, 9) === 0 && D.sisaJatah(6, 2) === 4 && D.sisaJatah(3, 3) === 0);

  lanjut();
})();

function lanjut() {
  // ===================================================================
  console.log('\n=== 2. Keempat fitur AI memakai gudang yang sama ===');
  // ===================================================================
  const MODUL = [
    ['lib/reflectionAi.ts', 'reflection', 'EMPTY_REFLECTION_AI_DAY', 'REFLECTION_DAILY_CAP', 'attempts'],
    ['lib/financeCoach.ts', 'coach', 'EMPTY_COACH_DAY', 'COACH_DAILY_CAP', 'calls'],
    ['lib/marketAi.ts', 'market', 'EMPTY_MARKET_AI_DAY', 'MARKET_DAILY_CAP', 'attempts'],
    ['lib/budgetAi.ts', 'budget', 'EMPTY_BUDGET_AI_DAY', 'BUDGET_AI_DAILY_CAP', 'attempts'],
  ];
  for (const [berkas, fitur, kosong, cap, hitungan] of MODUL) {
    const s = kode(berkas);
    ok(`${fitur}: memakai aiDayStore, bukan menulis ulang blok penyimpanannya`,
      new RegExp(`aiDayStore<\\w+>\\(\\s*\\n?\\s*'${fitur}',\\s*\\n?\\s*${kosong}`).test(s));
    ok(`${fitur}: tidak ada lagi awalan kunci & try/catch sendiri`,
      !/const PREFIX = 'ai:/.test(s) && !/AsyncStorage\.(getItem|setItem)/.test(s));
    ok(`${fitur}: jatahnya lewat sisaJatah(${cap}, day.${hitungan})`,
      new RegExp(`sisaJatah\\(${cap}, day\\.${hitungan}\\)`).test(s));
    // Nama field SENGAJA tidak diseragamkan: nama itu sudah ada di dalam data
    // yang tersimpan di HP pemiliknya. Menyeragamkannya berarti catatan hari
    // ini terbaca kosong sekali, dan jatah yang sudah terpakai jadi gratis.
    ok(`${fitur}: nama field catatannya TIDAK berubah (data tersimpan tetap terbaca)`,
      new RegExp(`${hitungan}: typeof v\\.${hitungan} === 'number'`).test(s));
  }

  // ===================================================================
  console.log('\n=== 3. Kelima layarnya memakai hook yang sama ===');
  // ===================================================================
  const LAYAR = [
    ['app/finance-review.tsx', 'useAiDay(todayId, loadCoachDay)'],
    ['components/finance/CoachCard.tsx', 'useAiDay(dayId, loadCoachDay)'],
    ['components/habits/ReflectionAiPanel.tsx', 'useAiDay(dayId, loadReflectionAiDay)'],
    ['components/investment/AnalysisPanel.tsx', 'useAiDay(today, loadMarketAiDay)'],
    ['components/finance/BudgetAiCard.tsx', 'useAiDay(today, loadBudgetAiDay, open)'],
  ];
  for (const [berkas, panggilan] of LAYAR) {
    const s = kode(berkas);
    ok(`${berkas.split('/').pop()}: lewat useAiDay`, s.includes(panggilan), panggilan);
    // Penjaga `hidup` itu justru bagian yang paling gampang lupa disalin.
    // Sekarang ia tinggal di satu tempat, jadi tidak boleh ada lagi di sini.
    ok(`${berkas.split('/').pop()}: tidak menulis sendiri efek pemuatnya`,
      !/let hidup = true;/.test(s));
  }

  const hook = baca('hooks/useAiDay.ts');
  ok('hook-nya tetap menjaga setState sesudah layar ditutup',
    /let hidup = true;/.test(hook) && /if \(!hidup\) return;/.test(hook) &&
    /return \(\) => \{\s*\n\s*hidup = false;\s*\n\s*\};/.test(hook));
  ok('null selama catatannya belum terbaca (tombol AI mati dulu)',
    /useState<T \| null>\(null\)/.test(hook));
  // Sheet yang ditutup lalu dibuka lagi tidak boleh menimpa catatan yang baru
  // saja didapat dengan isi penyimpanan yang mungkin belum sempat tertulis.
  ok('membaca ulang hanya kalau HARINYA berganti, bukan tiap `aktif` menyala',
    /const dimuat = useRef<string \| null>\(null\);/.test(hook) &&
    /if \(!aktif \|\| dimuat\.current === dayId\) return;/.test(hook));
  ok('`aktif` membuatnya nol pekerjaan selama layarnya belum perlu',
    /aktif = true,/.test(hook));

  console.log(
    gagal === 0 ? '\n✅ SEMUA LULUS.' : `\n❌ ${gagal} cek gagal.`,
  );
  process.exit(gagal === 0 ? 0 : 1);
}
