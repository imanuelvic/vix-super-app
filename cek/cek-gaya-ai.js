// 🎨 GAYA jawaban Gemini (23 Sep 2026): lib/aiStyle.ts = satu aturan bahasa +
// emoji untuk SEMUA fitur AI. lib/aiStyle.ts, lib/reflectionAi.ts,
// lib/notulenAi.ts, lib/financeCoach.ts DIJALANKAN sungguhan (firebase &
// AsyncStorage di-stub); prompt Wheel dicek dari sumbernya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');
const ROOT = AKAR + '/';
const KELUAR = path.join(__dirname, 'keluar-gaya-ai');

let gagal = 0;
function c(nama, ok) {
  console.log((ok ? '  ok  ' : '  GAGAL') + ' ' + nama);
  if (!ok) gagal++;
}
const baca = (f) => fs.readFileSync(ROOT + f, 'utf8');

try {
  execFileSync('node', [
    ROOT + 'node_modules/typescript/bin/tsc', '--ignoreConfig', '--outDir', KELUAR,
    '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
    ROOT + 'lib/aiStyle.ts', ROOT + 'lib/reflectionAi.ts', ROOT + 'lib/notulenAi.ts',
    ROOT + 'lib/financeCoach.ts',
  ], { stdio: 'ignore' });
} catch {
  // galat tipe saja (beberapa lib butuh @types/node di jalur ini)
}
for (const f of ['aiStyle.js', 'reflectionAi.js', 'notulenAi.js', 'financeCoach.js']) {
  if (!fs.existsSync(path.join(KELUAR, f))) throw new Error('transpile gagal: ' + f);
}

// ---------- stub ----------
class AIError extends Error {
  constructor(code, message, customErrorData) { super(message); this.code = code; this.customErrorData = customErrorData; }
}
const stubAi = {
  AIError,
  AIErrorCode: { ERROR: 'error', RESPONSE_ERROR: 'response-error', FETCH_ERROR: 'fetch-error', API_NOT_ENABLED: 'api-not-enabled', PARSE_FAILED: 'parse-failed' },
  GoogleAIBackend: class {},
  Schema: {
    object: (o) => ({ type: 'object', ...o }),
    string: () => ({ type: 'string' }),
    array: (o) => ({ type: 'array', ...o }),
  },
  getAI: () => ({}),
  getGenerativeModel: (ai, params) => ({ params, generateContent: async () => { throw new Error('tidak dipanggil di suite ini'); } }),
};
const gudang = new Map();
const asliLoad = Module._load;
Module._load = function (request) {
  if (request === 'firebase/ai') return stubAi;
  if (request === 'firebase/firestore') return { doc: () => ({}), setDoc: async () => {}, Timestamp: { now: () => ({}) } };
  if (request === './firebase') return { app: {}, db: {} };
  if (request === './liveDoc') return { liveDoc: () => () => {} };
  if (request === './habits') return { habitNoteDone: (t) => t.trim().length >= 10 };
  // Warna kategori Finance ikut terseret lewat lib/categories.ts.
  if (request.startsWith('@/assets/style/')) {
    return { Color: new Proxy({}, { get: () => '#000000' }) };
  }
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: { getItem: async (k) => gudang.get(k) ?? null, setItem: async (k, v) => { gudang.set(k, v); } } };
  }
  return asliLoad.apply(this, arguments);
};

const S = require(path.join(KELUAR, 'aiStyle.js'));
const R = require(path.join(KELUAR, 'reflectionAi.js'));
const N = require(path.join(KELUAR, 'notulenAi.js'));
const C = require(path.join(KELUAR, 'financeCoach.js'));

const aiStyleTs = baca('lib/aiStyle.ts');
const refleksiTs = baca('lib/reflectionAi.ts');
const coachTs = baca('lib/financeCoach.ts');
const notulenTs = baca('lib/notulenAi.ts');
const wheelTs = baca('lib/wheelAi.ts');

// Penghitung emoji milik suite sendiri (tanpa rangkaian ZWJ), supaya lib tidak
// perlu mengekspor fungsi yang app-nya sendiri tidak pakai.
const hitung = (s) =>
  Array.from(s).filter((ch) => {
    const cp = ch.codePointAt(0);
    return (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x2b00 && cp <= 0x2bff);
  }).length;

console.log('penyaring emoji (lib/aiStyle.ts)');
c('emoji di AWAL baris dibuang', S.rapikanEmoji('🔥 Semangat hari ini', 3) === 'Semangat hari ini');
c('emoji di TENGAH kalimat dibuang', S.rapikanEmoji('Aku 🙏 berdoa pagi', 3) === 'Aku berdoa pagi');
c('emoji di UJUNG baris dipertahankan', S.rapikanEmoji('Tetap fokus. 🙏✨', 3) === 'Tetap fokus. 🙏✨');
c('paling banyak dua emoji berdampingan', S.rapikanEmoji('Tetap fokus. 🙏✨🔥💛', 4) === 'Tetap fokus. 🙏✨');
c('jatah dihitung untuk SELURUH teks, bukan per baris',
  S.rapikanEmoji('A 🙏✨\n\nB 🔥\nC 💛', 3) === 'A 🙏✨\n\nB 🔥\nC' && hitung(S.rapikanEmoji('A 🙏✨\n\nB 🔥\nC 💛', 3)) === 3);
c('bentuk paragraf (baris kosong) tidak hilang', S.rapikanEmoji('Inti. 🙏\n\nBaris dua.', 3) === 'Inti. 🙏\n\nBaris dua.');
c('jatah 0 → tanpa emoji sama sekali', hitung(S.rapikanEmoji('Inti. 🙏\nBaris. ✨', 0)) === 0);
c('teks tanpa emoji tidak berubah', S.rapikanEmoji('Aku belajar , sabar.', 3) === 'Aku belajar , sabar.');
c('tanpaEmoji membuang semua & merapikan spasi bekasnya', S.tanpaEmoji('Rapi 🙏 banget ✨') === 'Rapi banget');
c('rangkaian gabungan (ZWJ) diperlakukan sebagai SATU emoji, bukan tiga',
  S.tanpaEmoji('👨‍👩‍👧 keluarga') === 'keluarga' && S.rapikanEmoji('Keluarga kecil. 👨‍👩‍👧', 1) === 'Keluarga kecil. 👨‍👩‍👧' &&
  S.rapikanEmoji('Keluarga kecil. 👨‍👩‍👧🔥', 1) === 'Keluarga kecil. 👨‍👩‍👧');
c('daftar emoji sengaja pendek & tiap butirnya memang emoji utuh',
  S.EMOJI_PILIHAN.length <= 12 && S.EMOJI_PILIHAN.every((e) => S.tanpaEmoji(e) === '' && S.rapikanEmoji(`Rapi. ${e}`, 1) === `Rapi. ${e}`));
// Komentarnya boleh menyebut \p{...}; yang dilarang memakainya di kode.
const aiStyleKode = aiStyleTs.split('\n').filter((b) => !/^\s*\/\//.test(b)).join('\n');
c('tanpa properti Unicode di regex (Hermes belum menjamin \\p{...})', !/\\p\{/.test(aiStyleKode));

console.log('blok aturan yang dibagi');
c('aturanEmoji menyebut jatah, "ujung baris", dua berdampingan, & daftarnya',
  /Maksimal 3 emoji/.test(S.aturanEmoji(3)) && /UJUNG baris/.test(S.aturanEmoji(3)) &&
  /dua emoji berdampingan/.test(S.aturanEmoji(3)) && S.aturanEmoji(3).includes(S.EMOJI_PILIHAN.join(' ')));
c('GAYA_BAHASA: kalimat pendek, Gen Z, tanpa markdown, tanpa tanda pisah panjang',
  /Kalimat PENDEK/.test(S.GAYA_BAHASA) && /Gen Z/.test(S.GAYA_BAHASA) && /Tanpa markdown/.test(S.GAYA_BAHASA) &&
  S.GAYA_BAHASA.includes(String.fromCharCode(0x2014)));
c('GAYA_SETIA (merapikan tulisan orang lain): suara penulisnya tidak diubah',
  /tetap miliknya/.test(S.GAYA_SETIA) && !/Gen Z/.test(S.GAYA_SETIA) && /Kalimat PENDEK/.test(S.GAYA_SETIA));
c('TANPA_EMOJI dipakai untuk yang dicetak jadi PDF', /JANGAN memakai emoji sama sekali/.test(S.TANPA_EMOJI) && /PDF/.test(S.TANPA_EMOJI));

console.log('AI Reflection: pendek, berbentuk, ber-emoji');
const sys = refleksiTs.slice(refleksiTs.indexOf('const SYSTEM = `'), refleksiTs.indexOf('const SKEMA'));
c('jatah kata & emoji jadi angka bersama', R.REFLECTION_MAX_WORDS === 45 && R.REFLECTION_EMOJI_MAX === 3);
c('bentuk wajib: 1 kalimat inti, baris kosong, 2-3 baris pendek, total 45 kata',
  /Baris pertama: inti tulisannya dalam SATU kalimat pendek/.test(sys) && /Satu baris kosong/.test(sys) &&
  /Dua sampai tiga baris pendek/.test(sys) && /TOTAL maksimal \$\{REFLECTION_MAX_WORDS\} kata/.test(sys));
c('dua contoh bergaya baru ikut di prompt (hook + baris pendek + emoji di ujung)',
  /Contoh 1\./.test(sys) && /Contoh 2\./.test(sys) &&
  /Jangan menyerah pada keadaan\. 🙏✨/.test(sys) && /Apakah aku mencari Tuhan hanya saat membutuhkan\? 🙏/.test(sys));
c('gaya & aturan emoji diambil dari lib/aiStyle (bukan ditulis ulang)',
  /\$\{GAYA_BAHASA\}/.test(sys) && /\$\{aturanEmoji\(REFLECTION_EMOJI_MAX\)\}/.test(sys) &&
  /import \{ aturanEmoji, GAYA_BAHASA, rapikanEmoji \} from '\.\/aiStyle';/.test(refleksiTs));
c('pagar lama TETAP: tentatif, larang "Tuhan pasti", tidak mengarang, tidak mengutip ayat',
  /Mungkin ini mengingatkan kita bahwa/.test(sys) && /Tuhan pasti/.test(sys) &&
  /TIDAK boleh berubah, ditambah, atau dibuang/.test(sys) && /Jangan mengutip ayat/.test(sys));
c('aturan lama yang bertentangan sudah hilang (90 kata, "tanpa emoji")',
  !/90 kata/.test(sys) && !/tanpa emoji/i.test(sys));
const liar = R.finalizeReflection({
  reflection: '🔥 Jangan menyerah pada keadaan. 🙏✨\n\nTetap fokus pada rencana-Nya. 💛\nTangan-Nya tak pernah terlambat. 🔥💪✨',
});
c('finalisasi: emoji liar dirapikan (≤3, hanya di ujung baris)',
  liar === 'Jangan menyerah pada keadaan. 🙏✨\n\nTetap fokus pada rencana-Nya. 💛\nTangan-Nya tak pernah terlambat.' &&
  hitung(liar) === R.REFLECTION_EMOJI_MAX);
c('finalisasi: kutip pembungkus & tanda pisah panjang tetap dibuang',
  R.finalizeReflection({ reflection: `"Aku belajar ${String.fromCharCode(0x2014)} sabar."` }) === 'Aku belajar , sabar.');
c('panel tidak ikut berubah bentuk (hasil tetap satu teks)', /\{day\.result\}/.test(baca('components/habits/ReflectionAiPanel.tsx')));

console.log('Vix Financial Coach: satu emoji, cuma di headline');
c('jatah emoji Coach = 1', C.COACH_EMOJI_MAX === 1);
c('prompt Coach memakai blok bersama & membolehkan satu emoji di headline',
  /\$\{GAYA_BAHASA\}/.test(coachTs) && /\$\{aturanEmoji\(COACH_EMOJI_MAX\)\}/.test(coachTs) &&
  /boleh diakhiri SATU emoji/.test(coachTs) && !/tanpa emoji, tanpa tanda pisah/.test(coachTs));
const jc = C.finalizeCoachAnswer({
  headline: '🔥 Kamu masih punya ruang Rp1.250.000 🌱✨',
  data: ['Terpakai 62% 🔥'],
  interpretasi: ['Tampaknya polanya stabil ✨'],
  saran: ['Fokus: catat pengeluaran makan 💛'],
});
c('headline: satu emoji di ujung, yang di awal dibuang', jc.headline === 'Kamu masih punya ruang Rp1.250.000 🌱');
c('DATA / INTERPRETASI / SARAN tetap bersih tanpa emoji',
  jc.data[0] === 'Terpakai 62%' && jc.interpretasi[0] === 'Tampaknya polanya stabil' && jc.saran[0] === 'Fokus: catat pengeluaran makan');
c('kata terlarang & tanda pisah tetap dijaga',
  C.finalizeCoachAnswer({ headline: `Kamu boros ${String.fromCharCode(0x2014)} ya`, data: [], interpretasi: [], saran: [] }).headline === 'Kamu lebih tinggi dari rencana , ya');

console.log('Notulen: bentuk berlambang · Wheel: tetap tanpa lambang');
// 23 Sep 2026: notulen mengikuti bentuk yang sudah dipakai pemiliknya sendiri,
// dan lambang adalah BAGIAN dari bentuk itu — jadi penyaring tanpaEmoji()
// sengaja dilepas dari langkah finalisasinya.
c('prompt notulen mengajarkan bentuk "• N - 🎓Judul" + baris tanggal/jam/tempat',
  /• 1 - 🎓Judul poinnya/.test(notulenTs) &&
  /🗓️ tanggal, 🕙 jam, 📍 tempat/.test(notulenTs) &&
  /\$\{GAYA_BAHASA\}/.test(notulenTs) && !/TANPA_EMOJI/.test(notulenTs));
c('prompt notulen memuat satu contoh jadi (few-shot)',
  /CONTOH \(perhatikan bentuknya, bukan isinya\)/.test(notulenTs) &&
  /• 5 - ⛪CORE & Leaders Meeting #3/.test(notulenTs));
c('notulen: lambang TIDAK lagi dibuang di finalisasi, tanda pisah tetap',
  N.finalizeNotulenAnswer({ mentorship: 'ada', leadersMessage: '', ndcInfo: '', core: '', events: '' },
    { mentorship: '• 1 - 🎓Materi Mentoring', leadersMessage: '', ndcInfo: '', core: '', events: '' }).mentorship === '• 1 - 🎓Materi Mentoring' &&
  N.finalizeNotulenAnswer({ mentorship: 'ada', leadersMessage: '', ndcInfo: '', core: '', events: '' },
    { mentorship: `• 1 ${String.fromCharCode(0x2014)} Materi`, leadersMessage: '', ndcInfo: '', core: '', events: '' }).mentorship === '• 1 , Materi');
c('bagian yang aslinya kosong tetap kosong',
  N.finalizeNotulenAnswer({ mentorship: '', leadersMessage: '', ndcInfo: '', core: '', events: '' },
    { mentorship: '• 1 - 🎓Karangan', leadersMessage: '', ndcInfo: '', core: '', events: '' }).mentorship === '');
c('prompt Wheel memakai GAYA_SETIA + TANPA_EMOJI (bukan gaya Gen Z)',
  /\$\{GAYA_SETIA\}/.test(wheelTs) && /\$\{TANPA_EMOJI\}/.test(wheelTs) && !/GAYA_BAHASA/.test(wheelTs));
c('Wheel tetap menjaga bahasa CL & bentuk poin "- "',
  /JANGAN mengubah isi, nada, atau bahasanya/.test(wheelTs) && /singkatan gaul yang jelas dibiarkan/.test(wheelTs) &&
  /diawali "- "/.test(wheelTs) && /tanpaEmoji\(stripEmDash\(v\)\)/.test(wheelTs));

console.log('rapi');
c('tidak ada prompt yang mengarang aturan emojinya sendiri',
  [refleksiTs, coachTs, notulenTs, wheelTs].every((s) => /from '\.\/aiStyle'/.test(s)));
c('tanda pisah panjang cuma disebut di lib/gemini.ts & lib/aiStyle.ts',
  !/TANDA_PISAH/.test(refleksiTs) && !/TANDA_PISAH/.test(coachTs) && !/TANDA_PISAH/.test(notulenTs) && !/TANDA_PISAH/.test(wheelTs) &&
  /TANDA_PISAH/.test(aiStyleTs));
// Aturannya melarang tanda pisah panjang di STRING yang tampil; komentar kode
// memang dikecualikan (lihat AGENTS.md), jadi komentarnya dibuang dulu.
const tanpaKomentar = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
c('tidak ada "—" mentah di berkas yang diubah',
  [aiStyleTs, refleksiTs, coachTs, notulenTs, wheelTs]
    .map(tanpaKomentar)
    .every((s) => !s.includes(String.fromCharCode(0x2014) + ' ')));

console.log(gagal === 0 ? 'CEK-GAYA-AI OK' : gagal + ' gagal');
process.exit(gagal === 0 ? 0 : 1);
