// ✨ AI Reflection di 📓 Daily Reflection Journal (14 Sep 2026).
// lib/reflectionAi.ts DIJALANKAN sungguhan (firebase/ai, ./firebase, ./habits,
// AsyncStorage di-stub); panel & penyambungannya dicek dari sumbernya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');
const ROOT = AKAR + '/';
const KELUAR = path.join(__dirname, 'keluar-refleksi-ai');

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
    ROOT + 'lib/aiGuard.ts', ROOT + 'lib/gemini.ts', ROOT + 'lib/reflectionAi.ts', ROOT + 'lib/format.ts',
  ], { stdio: 'ignore' });
} catch {
  // galat tipe saja (lib/firebase.ts butuh @types/node di jalur ini)
}
if (!fs.existsSync(path.join(KELUAR, 'reflectionAi.js'))) throw new Error('transpile gagal');

// ---------- stub ----------
const gudang = new Map();
class AIError extends Error {
  constructor(code, message, customErrorData) { super(message); this.code = code; this.customErrorData = customErrorData; }
}
const AIErrorCode = { ERROR: 'error', RESPONSE_ERROR: 'response-error', FETCH_ERROR: 'fetch-error', API_NOT_ENABLED: 'api-not-enabled', PARSE_FAILED: 'parse-failed' };
const panggilan = [];
let jawab = () => ({ reflection: 'Hari ini aku belajar sabar. Mungkin ini mengingatkan kita bahwa proses juga berharga.' });
const stubAi = {
  AIError, AIErrorCode,
  GoogleAIBackend: class {},
  Schema: { object: (o) => ({ type: 'object', ...o }), string: () => ({ type: 'string' }) },
  getAI: () => ({}),
  getGenerativeModel: (ai, params) => ({
    params,
    generateContent: async (prompt) => {
      panggilan.push({ model: params.model, prompt, params });
      const r = await jawab(params.model);
      return { response: { candidates: [{ finishReason: r.finishReason ?? 'STOP' }], text: () => (typeof r.text === 'string' ? r.text : JSON.stringify(r)) } };
    },
  }),
};
const asliLoad = Module._load;
Module._load = function (request) {
  if (request === 'firebase/ai') return stubAi;
  if (request === './firebase') return { app: {} };
  if (request === './habits') return { habitNoteDone: (t) => t.trim().length >= 10 };
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: { getItem: async (k) => gudang.get(k) ?? null, setItem: async (k, v) => { gudang.set(k, v); } } };
  }
  return asliLoad.apply(this, arguments);
};
let sekarang = Date.parse('2026-09-14T06:30:00');
const DateAsli = Date;
global.Date = class extends DateAsli {
  constructor(...a) { a.length ? super(...a) : super(sekarang); }
  static now() { return sekarang; }
};
const maju = (ms) => { sekarang += ms; };

const guard = require(path.join(KELUAR, 'aiGuard.js'));
const r = require(path.join(KELUAR, 'reflectionAi.js'));
async function tangkap(p) { try { await p; return null; } catch (e) { return e; } }
const TULISAN = 'hari ini aku belajar sabar yg susah bgt, tp Tuhan tolong';

(async () => {
  console.log('syarat & finalisasi');
  c('tombol hidup memakai aturan centang jurnal (≥10 huruf)', r.reflectionReady('pendek') === false && r.reflectionReady('cukup panjang ya') === true);
  c('jatah harian = 3 (1 generate + 2 try again)', r.REFLECTION_DAILY_CAP === 3);
  const kosong = await tangkap(r.generateReflection('  ', '2026-09-14', 1));
  c('belum ditulis → pesan ramah, tanpa jaringan', kosong?.name === 'AiAnswerError' && /Tulis refleksinya dulu/.test(kosong.message) && panggilan.length === 0);
  const panjang = await tangkap(r.generateReflection('x'.repeat(2001), '2026-09-14', 1));
  c('kepanjangan → ditolak sebelum jaringan', panjang?.name === 'AiAnswerError' && panggilan.length === 0);
  c('finalisasi: kutip pembungkus & tanda pisah panjang dibuang', r.finalizeReflection({ reflection: '"Aku belajar — sabar."' }) === 'Aku belajar , sabar.');
  c('finalisasi: jawaban kosong → galat', (await tangkap(Promise.resolve().then(() => r.finalizeReflection({ reflection: '  ' }))))?.name === 'AiAnswerError');

  console.log('alur normal');
  guard.resetAiGuardForTests();
  const h1 = await r.generateReflection(TULISAN, '2026-09-14', 1);
  c('model utama gemini-3.8-flash, prompt membawa tulisannya', panggilan.length === 1 && panggilan[0].model === 'gemini-3.8-flash' && panggilan[0].prompt.includes(TULISAN));
  c('jawaban = teks tunggal yang sudah difinalisasi', h1.startsWith('Hari ini aku belajar sabar.'));
  const p = panggilan[0].params;
  c('JSON terstruktur satu kunci, suhu 0.5, ≤2048 token', p.generationConfig.responseMimeType === 'application/json' && p.generationConfig.temperature === 0.5 && p.generationConfig.maxOutputTokens === 2048);
  const si = p.systemInstruction;
  c('system prompt: tentatif ("Mungkin ini mengingatkan"), larang "Tuhan pasti", larang mengarang & mengubah makna, tidak mengutip ayat',
    /Mungkin ini mengingatkan kita bahwa/.test(si) && /Tuhan pasti/.test(si) && /TIDAK boleh berubah, ditambah, atau dibuang/.test(si) && /Jangan mengutip ayat/.test(si));
  // 23 Sep 2026: bentuknya jadi catatan pendek ber-emoji (lib/aiStyle.ts).
  c('system prompt: bentuk pendek ≤45 kata (1 kalimat inti + 2-3 baris) & emoji rapi di ujung baris',
    /TOTAL maksimal 45 kata/.test(si) && /Baris pertama: inti tulisannya dalam SATU kalimat pendek/.test(si) &&
    /Dua sampai tiga baris pendek/.test(si) && /Maksimal 3 emoji/.test(si) && /UJUNG baris/.test(si) &&
    /Jangan menyerah pada keadaan\. 🙏✨/.test(si));
  const h1b = await r.generateReflection(TULISAN, '2026-09-14', 1);
  c('tulisan & attempt sama → jawaban diingat, tidak memanggil lagi', panggilan.length === 1 && h1b === h1);
  maju(6000);
  await r.generateReflection(TULISAN, '2026-09-14', 2);
  c('Try Again (attempt 2) → panggilan BARU walau tulisannya sama', panggilan.length === 2);

  console.log('kuota & galat');
  maju(6000);
  jawab = (m) => { if (m === 'gemini-3.8-flash') throw new AIError('fetch-error', '429', { status: 429 }); return { reflection: 'lite' }; };
  c('utama 429 → cadangan lite', (await r.generateReflection(TULISAN, '2026-09-14', 3)) === 'lite');
  maju(6000);
  jawab = () => { throw new AIError('fetch-error', '429', { status: 429 }); };
  const e429 = await tangkap(r.generateReflection(TULISAN + ' lagi', '2026-09-14', 1));
  c('keduanya 429 → pesan "kuota gratis penuh, tidak ada biaya"', /Kuota gratis/.test(r.reflectionAiErrorMessage(e429)) && /Tidak ada biaya/.test(r.reflectionAiErrorMessage(e429)));
  maju(6000);
  const eKunci = await tangkap(r.generateReflection(TULISAN + ' lagi2', '2026-09-14', 1));
  c('sesudah itu dikunci di app (tanpa jaringan)', eKunci?.kind === 'quota-locked');
  c('offline → "Tidak ada koneksi"', /koneksi/.test(r.reflectionAiErrorMessage(new AIError('error', 'Network request failed'))));
  c('galat asing → kalimat ramah yang menegaskan jurnal tetap bisa disimpan', /tetap bisa disimpan/.test(r.reflectionAiErrorMessage(new Error('?'))));
  c('tidak ada retry otomatis di lib (tidak ada loop/setTimeout/retry)', !/setTimeout|while \(|for \(|retry/i.test(baca('lib/reflectionAi.ts')));

  console.log('jatah per hari (AsyncStorage)');
  const kosongHari = await r.loadReflectionAiDay('2026-09-14');
  c('belum ada → { attempts 0, result null }', kosongHari.attempts === 0 && kosongHari.result === null);
  await r.saveReflectionAiDay('2026-09-14', { attempts: 1, result: 'hasil' });
  const lagi = await r.loadReflectionAiDay('2026-09-14');
  c('tersimpan & terbaca kembali per tanggal', lagi.attempts === 1 && lagi.result === 'hasil' && gudang.has('ai:reflection:2026-09-14'));
  c('sisa jatah dihitung dari cap', r.reflectionAttemptsLeft({ attempts: 1, result: 'x' }) === 2 && r.reflectionAttemptsLeft({ attempts: 5, result: 'x' }) === 0);
  gudang.set('ai:reflection:2026-09-15', 'rusak{');
  c('data rusak → dianggap kosong, tidak crash', (await r.loadReflectionAiDay('2026-09-15')).attempts === 0);

  console.log('panel (components/habits/ReflectionAiPanel.tsx)');
  const panel = baca('components/habits/ReflectionAiPanel.tsx');
  c('tombol "✨ Generate with AI" mati sebelum tulisannya cukup', /✨ Generate with AI/.test(panel) && /disabled=\{!siap\}/.test(panel) && /const siap = reflectionReady\(text\);/.test(panel));
  c('sekali sehari: tombol utama hilang begitu ada hasil (hanya saat !day.result)', /\) : !day\.result \? \(/.test(panel));
  c('loading "AI is reflecting…" + spinner, tombol tak bisa diclick ganda', /AI is reflecting…/.test(panel) && /if \(busy \|\| !day\) return;/.test(panel));
  c('hasil tampil di lembar tersendiri: kop "AI REFLECTION ✨", gaya sage vixtory.archive', /AI REFLECTION ✨/.test(panel) && /designOf\('sage'\)/.test(panel) && /backgroundColor: SAGE\.paper/.test(panel));
  c('Use This Reflection mengganti kolom & bisa dikembalikan tanpa dialog', /label="Use This Reflection"/.test(panel) && /setSebelum\(text\);\s*onUse\(day\.result\);/.test(panel) && /Kembalikan tulisan asli/.test(panel));
  c('Try Again dibatasi jatah harian; Dismiss cuma menyembunyikan (hasil tetap)', /Try Again · \$\{sisa\} lagi/.test(panel) && /disabled=\{sisa === 0\}/.test(panel) && /onPress=\{\(\) => setShown\(false\)\}/.test(panel) && /✨ Lihat refleksi AI/.test(panel));
  c('gagal → FormError, tidak ada retry otomatis', /<FormError message=\{error\}/.test(panel) && !/retry|setTimeout/i.test(panel));
  c('jatah & hasil dibaca/disimpan per hari', /loadReflectionAiDay\(dayId\)/.test(panel) && /saveReflectionAiDay\(dayId, baru\)/.test(panel));

  console.log('penyambungan');
  const nf = baca('components/common/NoteField.tsx');
  c('NoteField punya slot `below` (draf + setText), hanya untuk paragraf', /below\?: \(ctx: \{ text: string; setText: \(t: string\) => void \}\) => ReactNode;/.test(nf) && /\{below \? <View style=\{styles\.below\}>\{below\(\{ text, setText \}\)\}<\/View> : null\}/.test(nf));
  const ht = baca('components/habits/HabitsTab.tsx');
  c('HabitsTab memasang panel HANYA di 📓 Daily Reflection Journal', /isReflectionJournal\(habit\)\s*\?\s*\(\{ text, setText \}\) => \(\s*<ReflectionAiPanel dayId=\{dayId\} text=\{text\} onUse=\{setText\} \/>/.test(ht));
  const hb = baca('lib/habits.ts');
  c('pengenal jurnalnya satu pola (REFLECTION_JOURNAL_MATCH) dipakai pintu Feed juga', /export const REFLECTION_JOURNAL_MATCH = \/reflection journal\|rhema\/i;/.test(hb) && /match: REFLECTION_JOURNAL_MATCH,/.test(hb));
  c('tidak ada halaman jurnal baru (app/ tidak bertambah rute refleksi)', !fs.existsSync(ROOT + 'app/reflection-ai.tsx') && !fs.existsSync(ROOT + 'app/journal.tsx'));
  const gem = baca('lib/gemini.ts');
  c('pintu Gemini satu (lib/gemini.ts): GoogleAIBackend, tanpa Vertex, tanpa kunci', /new GoogleAIBackend\(\)/.test(gem) && !/VertexAIBackend/.test(gem) && !/AIza[0-9A-Za-z_-]{20,}/.test(gem + baca('lib/reflectionAi.ts') + panel));
  c('refleksi lewat guardedAiCall + withModelFallback (pagar & cadangan yang sama)', /guardedAiCall\(`reflection\|\$\{dayId\}\|\$\{attempt\}\|\$\{bersih\}`/.test(baca('lib/reflectionAi.ts')) && /withModelFallback\(/.test(baca('lib/reflectionAi.ts')));
  c('tidak ada "—" di berkas baru', !/—/.test(panel) && !/—/.test(baca('lib/reflectionAi.ts')) && !/—/.test(gem));
  c('AI-GRATIS.md menyebut fitur AI Reflection', /AI Reflection/.test(baca('AI-GRATIS.md')));

  console.log(gagal === 0 ? 'CEK-REFLEKSI-AI OK' : gagal + ' gagal');
  process.exit(gagal === 0 ? 0 : 1);
})();
