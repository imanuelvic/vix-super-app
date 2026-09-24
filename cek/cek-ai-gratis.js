// AI gratis-dulu (14 Sep 2026): ✨ Rapihkan notulen pindah dari Cloud Function
// + Claude ke Firebase AI Logic + Gemini Developer API (kuota gratis Spark).
// lib/aiGuard.ts & lib/notulenAi.ts DIJALANKAN sungguhan dengan firebase/ai
// di-stub, jadi yang diuji perilakunya: dedupe, cooldown, kunci 429, batas
// harian, model cadangan, dan pesan galatnya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');
const ROOT = AKAR + '/';
const KELUAR = path.join(__dirname, 'keluar-ai-gratis');

let gagal = 0;
function c(nama, ok) {
  console.log((ok ? '  ok  ' : '  GAGAL') + ' ' + nama);
  if (!ok) gagal++;
}
const baca = (f) => fs.readFileSync(ROOT + f, 'utf8');
const ada = (f) => fs.existsSync(ROOT + f);
function semuaKode(d) {
  let s = '';
  for (const n of fs.readdirSync(d)) {
    const q = path.join(d, n);
    if (fs.statSync(q).isDirectory()) s += semuaKode(q);
    else if (/.tsx?$/.test(n)) s += fs.readFileSync(q, 'utf8');
  }
  return s;
}

// ---------- transpile ----------
// tsc tetap MENGELUARKAN JS walau ada galat tipe (lib/firebase.ts memakai
// `process` tanpa @types/node di jalur --ignoreConfig ini); yang penting
// berkasnya ada.
try {
  execFileSync(
    'node',
    [
      ROOT + 'node_modules/typescript/bin/tsc', '--ignoreConfig', '--outDir', KELUAR,
      '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      ROOT + 'lib/aiGuard.ts', ROOT + 'lib/gemini.ts', ROOT + 'lib/notulenAi.ts', ROOT + 'lib/format.ts',
    ],
    { stdio: 'ignore' },
  );
} catch {
  // galat tipe saja
}
if (!fs.existsSync(path.join(KELUAR, 'notulenAi.js'))) throw new Error('transpile gagal');

// ---------- stub ----------
const gudang = new Map(); // AsyncStorage
class AIError extends Error {
  constructor(code, message, customErrorData) { super(message); this.code = code; this.customErrorData = customErrorData; }
}
const AIErrorCode = {
  ERROR: 'error', REQUEST_ERROR: 'request-error', RESPONSE_ERROR: 'response-error', FETCH_ERROR: 'fetch-error',
  API_NOT_ENABLED: 'api-not-enabled', PARSE_FAILED: 'parse-failed',
};
const panggilan = []; // { model, prompt }
let jawab = () => ({ mentorship: '1. Rapi.', leadersMessage: '', ndcInfo: '', core: '', events: '' });
const stubAi = {
  AIError, AIErrorCode,
  GoogleAIBackend: class GoogleAIBackend {},
  VertexAIBackend: class VertexAIBackend {},
  Schema: { object: (o) => ({ type: 'object', ...o }), string: () => ({ type: 'string' }) },
  getAI: (app, opts) => ({ app, opts }),
  getGenerativeModel: (ai, params) => ({
    params,
    generateContent: async (prompt) => {
      panggilan.push({ model: params.model, prompt });
      const r = await jawab(params.model);
      return { response: { candidates: [{ finishReason: r.finishReason ?? 'STOP' }], text: () => (typeof r.text === 'string' ? r.text : JSON.stringify(r)) } };
    },
  }),
};
const asliLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'firebase/ai') return stubAi;
  if (request === './firebase') return { app: {} };
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: { getItem: async (k) => gudang.get(k) ?? null, setItem: async (k, v) => { gudang.set(k, v); } } };
  }
  return asliLoad.apply(this, arguments);
};

// Jam palsu supaya cooldown/kunci bisa diuji tanpa menunggu.
let sekarang = Date.parse('2026-09-14T10:00:00');
const DateAsli = Date;
global.Date = class extends DateAsli {
  constructor(...a) { a.length ? super(...a) : super(sekarang); }
  static now() { return sekarang; }
};
const maju = (ms) => { sekarang += ms; };

const guard = require(path.join(KELUAR, 'aiGuard.js'));
const ai = require(path.join(KELUAR, 'notulenAi.js'));
const isi = (mentorship) => ({ mentorship, leadersMessage: '', ndcInfo: '', core: '', events: '' });
async function tangkap(p) { try { await p; return null; } catch (e) { return e; } }

(async () => {
  console.log('normalisasi & finalisasi (murni)');
  c('trim + kunci asing diabaikan', ai.normalizeNotulenPoints({ mentorship: '  a  ', asing: 'x' }).mentorship === 'a');
  c('kosong semua → AiAnswerError', (await tangkap(Promise.resolve().then(() => ai.normalizeNotulenPoints({}))))?.name === 'AiAnswerError');
  c('kepanjangan → AiAnswerError', (await tangkap(Promise.resolve().then(() => ai.normalizeNotulenPoints(isi('x'.repeat(4001))))))?.name === 'AiAnswerError');
  const fin = ai.finalizeNotulenAnswer(isi('a'), { mentorship: ' 1. A — B ', leadersMessage: 'DIISI MODEL', ndcInfo: '', core: '', events: '' });
  c('bagian kosong tetap kosong walau model mengisi', fin.leadersMessage === '');
  c('tanda pisah panjang → koma, ujung di-trim', fin.mentorship === '1. A , B');
  c('jawaban bukan objek → AiAnswerError', (await tangkap(Promise.resolve().then(() => ai.finalizeNotulenAnswer(isi('a'), 'teks'))))?.name === 'AiAnswerError');

  console.log('alur normal & dedupe');
  guard.resetAiGuardForTests();
  const h1 = await ai.rapikanNotulen(isi('hati2 yg melayani'));
  c('memanggil model UTAMA gemini-3.8-flash sekali', panggilan.length === 1 && panggilan[0].model === 'gemini-3.8-flash');
  c('prompt membawa JSON kelima bagian', /"mentorship": "hati2 yg melayani"/.test(panggilan[0].prompt));
  c('hasilnya sudah difinalisasi', h1.mentorship === '1. Rapi.' && h1.core === '');
  c('model dibuat dengan JSON terstruktur, suhu 0.3, ≤8192 token',
    (() => { const p = stubAi.getGenerativeModel({}, { model: 'x', generationConfig: {} }).params; return true; })() &&
      /responseMimeType: 'application\/json'/.test(baca('lib/notulenAi.ts')) && /temperature: 0\.3/.test(baca('lib/notulenAi.ts')) && /maxOutputTokens: 8192/.test(baca('lib/notulenAi.ts')));
  const h2 = await ai.rapikanNotulen(isi('hati2 yg melayani'));
  c('masukan yang sama → jawaban diingat, TIDAK memanggil lagi', panggilan.length === 1 && h2 === h1);
  c('percobaan tercatat di AsyncStorage per hari', gudang.get('ai:calls:2026-09-14') === '1');

  console.log('cooldown & permintaan bersamaan');
  const e1 = await tangkap(ai.rapikanNotulen(isi('teks lain')));
  c('masukan lain < 5 detik → ditolak pagar (cooldown), tanpa jaringan', e1?.name === 'AiGuardError' && e1.kind === 'cooldown' && panggilan.length === 1);
  maju(6000);
  let lepas; jawab = () => new Promise((r) => { lepas = r; });
  const p1 = ai.rapikanNotulen(isi('bersamaan'));
  const p2 = ai.rapikanNotulen(isi('bersamaan'));
  await new Promise((r) => setTimeout(r, 5));
  lepas(isi('1. Sama.'));
  const [r1, r2] = await Promise.all([p1, p2]);
  c('dua click bersamaan → SATU panggilan, hasil sama', panggilan.length === 2 && r1 === r2);
  jawab = () => isi('1. Rapi.');

  console.log('kuota gratis penuh (429)');
  maju(6000);
  jawab = (m) => { if (m === 'gemini-3.8-flash') throw new AIError('fetch-error', '429', { status: 429 }); return isi('1. Lite.'); };
  const h3 = await ai.rapikanNotulen(isi('utama penuh'));
  c('utama 429 → otomatis coba cadangan gemini-3.5-flash-lite', h3.mentorship === '1. Lite.' && panggilan.slice(-2).map((p) => p.model).join(',') === 'gemini-3.8-flash,gemini-3.5-flash-lite');
  maju(6000);
  jawab = () => { throw new AIError('fetch-error', '429', { status: 429 }); };
  const e2 = await tangkap(ai.rapikanNotulen(isi('dua-duanya penuh')));
  c('keduanya 429 → galat 429 diteruskan', e2?.customErrorData?.status === 429);
  c('pesannya menegaskan TIDAK ADA BIAYA', /Tidak ada biaya/.test(ai.notulenAiErrorMessage(e2)) && /Kuota gratis/.test(ai.notulenAiErrorMessage(e2)));
  maju(6000);
  const sebelum = panggilan.length;
  const e3 = await tangkap(ai.rapikanNotulen(isi('masih terkunci')));
  c('60 detik berikutnya semua panggilan DIKUNCI di app, jaringan tak disentuh', e3?.kind === 'quota-locked' && panggilan.length === sebelum && /detik/.test(e3.message));
  maju(61_000);
  jawab = () => isi('1. Pulih.');
  c('sesudah 60 detik boleh lagi', (await ai.rapikanNotulen(isi('masih terkunci'))).mentorship === '1. Pulih.');

  console.log('model pensiun (404) & jawaban rusak');
  maju(6000);
  jawab = (m) => { if (m === 'gemini-3.8-flash') throw new AIError('fetch-error', '404', { status: 404 }); return isi('1. Lite.'); };
  c('utama 404 → cadangan', (await ai.rapikanNotulen(isi('pensiun'))).mentorship === '1. Lite.');
  maju(6000);
  jawab = () => ({ finishReason: 'MAX_TOKENS', text: '{' });
  const e4 = await tangkap(ai.rapikanNotulen(isi('kepanjangan')));
  c('MAX_TOKENS → pesan "terpotong"', e4?.name === 'AiAnswerError' && /terpotong/.test(e4.message));
  maju(6000);
  jawab = () => ({ text: 'bukan json' });
  const e5 = await tangkap(ai.rapikanNotulen(isi('rusak')));
  c('JSON rusak → pesan "tidak terbaca"', e5?.name === 'AiAnswerError' && /tidak terbaca/.test(e5.message));

  console.log('batas harian');
  maju(6000);
  gudang.set('ai:calls:2026-09-14', '30');
  const e6 = await tangkap(ai.rapikanNotulen(isi('hari ini penuh')));
  c('30 percobaan/hari → ditolak pagar, tanpa jaringan', e6?.kind === 'daily-cap' && /30/.test(e6.message));
  maju(24 * 3600 * 1000);
  jawab = () => isi('1. Besok.');
  c('besok boleh lagi (kunci per tanggal)', (await ai.rapikanNotulen(isi('besok'))).mentorship === '1. Besok.');

  console.log('pesan galat lain');
  c('api-not-enabled → petunjuk console AI Logic', /AI Logic belum diaktifkan/.test(ai.notulenAiErrorMessage(new AIError('api-not-enabled', 'x', { status: 403 }))));
  c('403 → akses ditolak', /403/.test(ai.notulenAiErrorMessage(new AIError('fetch-error', 'x', { status: 403 }))));
  c('404 → sebut kedua nama model', /gemini-3\.8-flash \/ gemini-3\.5-flash-lite/.test(ai.notulenAiErrorMessage(new AIError('fetch-error', 'x', { status: 404 }))));
  c('5xx → layanan bermasalah', /bermasalah/.test(ai.notulenAiErrorMessage(new AIError('fetch-error', 'x', { status: 503 }))));
  c('filter keamanan → response-error', /filter keamanan/.test(ai.notulenAiErrorMessage(new AIError('response-error', 'blocked'))));
  c('offline → koneksi', /koneksi/.test(ai.notulenAiErrorMessage(new AIError('error', 'Error fetching: Network request failed'))));
  c('galat asing → kalimat umum', ai.notulenAiErrorMessage(new Error('?')) === 'Gagal merapikan notulen. Coba lagi.');

  console.log('konfigurasi: gratis-dulu, tanpa kunci, tanpa layanan berbayar');
  const src = baca('lib/notulenAi.ts');
  const gem = baca('lib/gemini.ts');
  c('backend Gemini Developer API (GoogleAIBackend) di lib/gemini.ts, bukan Vertex', /new GoogleAIBackend\(\)/.test(gem) && !/VertexAIBackend/.test(gem) && /from '\.\/gemini'/.test(src));
  c('tidak ada kunci API di kode app (AIza…, sk-…), Firebase config tetap dari env',
    !/AIza[0-9A-Za-z_-]{20,}/.test(src + gem + baca('lib/reflectionAi.ts') + baca('lib/firebase.ts') + baca('lib/aiGuard.ts')) && !/sk-ant-|sk-[A-Za-z0-9]{20,}/.test(src) && /process\.env\.EXPO_PUBLIC_FIREBASE_API_KEY/.test(baca('lib/firebase.ts')));
  c('.env tidak menyimpan kunci Gemini/Anthropic', !ada('.env') || !/GEMINI|ANTHROPIC|GOOGLE_AI/i.test(baca('.env')));
  c('.gitignore mengabaikan .env', /^\.env/m.test(baca('.gitignore')));
  c('tidak ada lagi firebase/functions, Cloud Function, firebase.json, .firebaserc, .easignore',
    !/firebase\/functions/.test(src) && !ada('functions/src/index.ts') && !ada('firebase.json') && !ada('.firebaserc') && !ada('.easignore'));
  c('tidak ada @anthropic-ai / firebase-functions di package.json', !/@anthropic-ai|firebase-functions/.test(baca('package.json')));
  c('tsconfig & eslint tidak lagi menyebut functions/', !/functions/.test(baca('tsconfig.json')) && !/functions\/\*/.test(baca('eslint.config.js')));
  c('tidak ada pemakai Vertex/Agent Platform/Cloud Run di app',
    !/VertexAIBackend|@google-cloud\/|aiplatform|run\.googleapis/.test(['lib', 'components', 'app', 'hooks', 'contexts'].map((d) => semuaKode(ROOT + d)).join('')));
  c('model utama & cadangan = model kuota gratis (Sep 2026)', /GEMINI_MODEL = 'gemini-3\.8-flash'/.test(gem) && /GEMINI_MODEL_CADANGAN = 'gemini-3\.5-flash-lite'/.test(gem));
  // 14 Sep sore: form notulen pindah ke layar sendiri.
  const tab = baca('app/core/monthly/[id].tsx');
  c('layar notulen memakai rapikanNotulen + notulenAiErrorMessage (API tetap)', /await rapikanNotulen\(fPoints\)/.test(tab) && /notulenAiErrorMessage\(e\)/.test(tab) && !/Cloud Function/.test(tab));
  c('firebase/ai memang ada di SDK terpasang', ada('node_modules/firebase/ai/package.json'));
  c('Expo winter memasang URL/DOMException/AbortSignal.any yang dibutuhkan SDK',
    /install\('URL'/.test(baca('node_modules/expo/src/winter/runtime.native.ts')) && /install\('DOMException'/.test(baca('node_modules/expo/src/winter/runtime.native.ts')) && /installAbortSignalPatch\(AbortSignal\)/.test(baca('node_modules/expo/src/winter/runtime.native.ts')));
  const doc = baca('AI-GRATIS.md');
  c('AI-GRATIS.md: Spark, langkah console, model, sumber tagihan, cara cek', /Spark/.test(doc) && /Get started/.test(doc) && /gemini-3\.8-flash/.test(doc) && /Sumber tagihan/.test(doc) && /rate-limit/.test(doc));
  c('tidak ada "—" di teks baru', !/—/.test(doc) && !/—/.test(baca('lib/aiGuard.ts')));

  console.log(gagal === 0 ? 'CEK-AI-GRATIS OK' : gagal + ' gagal');
  process.exit(gagal === 0 ? 0 : 1);
})();
