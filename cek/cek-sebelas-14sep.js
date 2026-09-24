// 11 permintaan 14 Sep 2026 malam (dari tangkapan layar):
//  1 Bagikan Ayat: nomor ayat dulu, baru isi ayat
//  2 Home: Air putih jadi kartu sendiri di bawah sapaan, lebih besar, ada bar
//  3 Wheel: cap Dibuat/Terakhir diubah pindah ke atas "Fokus Kuartal"
//  4 Wheel assess: ✨ Rapihkan semua jawaban jadi poin "- " (Gemini) +
//    marginTop tombol refleksi
//  5 Wheel assess: Batal/Lanjut dipatok di footer
//  6 PDF Wheel: Fokus Kuartal di halaman baru, radar lebih besar
//  7 Modal Follow Up: 🎡 Wheel & 📋 rekap wishlist CL (tetap PIN)
//  8 Rekap wishlist: hati di samping nama CL
//  9 PDF Timeline: umur CL & umurku di tiap tahun
// 10 Timeline: 📋 rekap pindah ke header
// 11 Rekap wishlist: tanggal terakhir diperbarui
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');
const ROOT = AKAR + '/';
const KELUAR = path.join(__dirname, 'keluar-sebelas');

let gagal = 0;
function c(nama, ok) {
  console.log((ok ? '  ok  ' : '  GAGAL') + ' ' + nama);
  if (!ok) gagal++;
}
const baca = (f) => fs.readFileSync(ROOT + f, 'utf8');
const antara = (s, a, b) => {
  const i = s.indexOf(a);
  const j = s.indexOf(b, i);
  return i < 0 || j < 0 ? '' : s.slice(i, j);
};

// ================= 1. Bagikan Ayat =================
console.log('1. Bagikan Ayat: nomor ayat dulu');
{
  const s = baca('app/bible-story.tsx');
  c('baris "Ayat dari / sampai" ditulis SEBELUM kolom isi ayat',
    s.indexOf('styles.ayatRow') > 0 && s.indexOf('styles.ayatRow') < s.indexOf('styles.verseInput'));
  c('judul "✍️ Isi Ayat" tetap di atas keduanya',
    s.indexOf('✍️ Isi Ayat') < s.indexOf('styles.ayatRow'));
  c('jaraknya pindah ke kolom isi (marginTop 10), baris ayat tanpa marginTop',
    /verseInput: \{ minHeight: 96, textAlignVertical: 'top', marginTop: 10 \}/.test(s) &&
      /ayatRow: \{ flexDirection: 'row', gap: 8 \}/.test(s));
}

// ================= 2. Air putih =================
console.log('2. Air putih: keluar dari kartu sapaan (15 Sep: jadi tombol mengambang, lihat cek-lima-15sep.js)');
{
  // 22 Sep 2026: kartu sapaan Home diganti hero With God (Today); air putih
  // tetap milik WaterFloat (dipasang di root layout), Today cuma menagih
  // gelas yang kurang lewat baris malam (Today Engine).
  const s = baca('app/(tabs)/index.tsx') + baca('components/today/GodHero.tsx');
  c('hero With God tidak memuat Air putih', s.length > 0 && !/Air putih/.test(s));
  c('Today tidak mengurus air sendiri (WaterFloat di root layout; Today cuma baris malam)',
    !/changeWater|waterCard|setWater\(/.test(s) && /<WaterFloat \/>/.test(baca('app/_layout.tsx')) &&
      /id: 'water',/.test(baca('lib/today.ts')));
}

// ================= 3, 4, 5. Layar Wheel =================
console.log('3. Wheel: cap tanggal di atas Fokus Kuartal');
const wheel = baca('app/wheel.tsx');
{
  const anak0 = antara(wheel, '{/* 0 — grafik', '{/* 1 — DIPATOK */}');
  const anak2 = antara(wheel, '{/* 2 */}', '{/* 3 — DIPATOK */}');
  c('blok Dibuat/Terakhir diubah ada di anak 0 (di atas judul Fokus Kuartal)',
    /styles\.stampBox/.test(anak0) && /🆕 Dibuat:/.test(anak0) && /🕒 Terakhir diubah:/.test(anak0));
  c('tidak lagi di dalam isi Fokus Kuartal', !/stampBox/.test(anak2));
  c('urutannya: sebaran nada → cap tanggal', anak0.indexOf('styles.spreadBox') < anak0.indexOf('styles.stampBox'));
  c('jaraknya: spread 10 → cap 12 → judul', /spreadBox: \{ marginBottom: 10/.test(wheel) && /stampBox: \{ marginBottom: 12, gap: 1 \}/.test(wheel));
}

console.log('4. Wheel assess: ✨ Rapihkan semua jawaban + marginTop refleksi');
{
  c('tombol 💭 refleksi punya marginTop 12', /reflectButton: \{[\s\S]{0,300}marginTop: 12,\s*marginBottom: 14/.test(wheel));
  const assess = antara(wheel, '===== Wizard assessment', "mode === 'focus' ?");
  c('pil ✨ hanya di pertanyaan TERAKHIR', /\{idx === WHEEL_AREAS\.length - 1 && \(\s*\n\s*<View style=\{styles\.rapikanBox\}>\s*\n\s*<SoftPill/.test(assess));
  c('labelnya "✨ Rapihkan semua jawaban" / "Merapihkan…" / "✓ Sudah dirapihkan"',
    /'✨ Rapihkan semua jawaban'/.test(assess) && /'Merapihkan…'/.test(assess) && /'✓ Sudah dirapihkan'/.test(assess));
  c('sekali per assessment: penanda sudahRapi, dipulihkan di startAssess',
    /if \(merapikan \|\| busy \|\| sudahRapi\) return;/.test(wheel) &&
      /function startAssess\(\) \{[\s\S]{0,400}setSudahRapi\(false\);/.test(wheel));
  c('hasilnya mengisi draftNotes (belum tersimpan sampai Selesai ✅)',
    /const rapi = await rapikanJawabanWheel\(draftNotes\);\s*\n\s*setDraftNotes\(\(prev\) => \(\{ \.\.\.prev, \.\.\.rapi \}\)\);\s*\n\s*setSudahRapi\(true\);/.test(wheel) &&
      !/rapikanJawabanWheel[\s\S]{0,400}saveWheelScores/.test(wheel));
  c('kolom catatan dikunci selagi merapikan', /editable=\{!busy && !merapikan\}/.test(assess));
  c('kosong semua → ditolak sebelum memanggil server', /Belum ada catatan yang bisa dirapikan\./.test(wheel));
}

console.log('5. Wheel: Batal/Lanjut dipatok di footer');
{
  const assess = antara(wheel, '===== Wizard assessment', "mode === 'focus' ?");
  c('navRow ada DI LUAR KeyboardAwareScrollView, di footer',
    assess.indexOf('</KeyboardAwareScrollView>') < assess.indexOf('styles.footer') &&
      assess.indexOf('styles.footer') < assess.indexOf('styles.navRow'));
  c('footer memakai ruang aman bawah (SafeAreaView layar ini cuma top)',
    /paddingBottom: Math\.max\(insets\.bottom, 12\)/.test(assess) && /useSafeAreaInsets\(\)/.test(wheel));
  c('pesan gagal ikut di footer (kelihatan di posisi gulung mana pun)',
    /styles\.footer[^\n]*\n\s*<FormError message=\{assessError\} \/>/.test(assess));
  c('editor Fokus memakai footer yang sama (Batal / Simpan Fokus)',
    (wheel.match(/style=\{\[styles\.footer, \{ paddingBottom: Math\.max\(insets\.bottom, 12\) \}\]\}/g) || []).length === 2 &&
      /<FormError message=\{focusError\} \/>/.test(wheel));
  c('gaya footer: garis atas + latar, navRow tanpa marginTop',
    /footer: \{\s*paddingHorizontal: 20,\s*paddingTop: 10,\s*borderTopWidth: 1/.test(wheel) &&
      /navRow: \{ flexDirection: 'row', gap: 10 \}/.test(wheel));
}

// ================= 4b. lib/wheelAi.ts dijalankan sungguhan =================
console.log('4b. lib/wheelAi.ts: poin "- ", isi tidak diubah, pagar');
try {
  execFileSync('node', [
    ROOT + 'node_modules/typescript/bin/tsc', '--ignoreConfig', '--outDir', KELUAR,
    '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
    ROOT + 'lib/aiGuard.ts', ROOT + 'lib/gemini.ts', ROOT + 'lib/wheelAi.ts',
    ROOT + 'lib/timelinePdf.ts', ROOT + 'lib/timeline.ts', ROOT + 'lib/family.ts',
  ], { stdio: 'ignore' });
} catch {
  // galat tipe saja
}
if (!fs.existsSync(path.join(KELUAR, 'wheelAi.js'))) throw new Error('transpile gagal');
{
  const gudang = new Map();
  class AIError extends Error {
    constructor(code, message, customErrorData) { super(message); this.code = code; this.customErrorData = customErrorData; }
  }
  const AIErrorCode = { ERROR: 'error', RESPONSE_ERROR: 'response-error', FETCH_ERROR: 'fetch-error', API_NOT_ENABLED: 'api-not-enabled', PARSE_FAILED: 'parse-failed' };
  const panggilan = [];
  const EM = String.fromCharCode(0x2014);
  let jawab = () => ({
    spirituality: 'aku masih rajin ibadah, core dan EN\nsebulan terakhir rajin baca revive ' + EM + ' bahas firman setelah EN',
    fun: '* puasa ig tapi terbantu karna hectic kerjaan\n- bulan lalu liburan sama adek ke bandung',
    health: 'INI HARUSNYA DIBUANG',
  });
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
        return { response: { candidates: [{ finishReason: 'STOP' }], text: () => JSON.stringify(r) } };
      },
    }),
  };
  const asliLoad = Module._load;
  Module._load = function (request) {
    if (request === 'firebase/ai') return stubAi;
    if (request === './firebase') return { app: {}, db: {} };
    if (request === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
    if (request === './photo') return { pickCompressedImage: async () => null };
    if (request === 'firebase/firestore') {
      return { collection: () => ({}), doc: () => ({}), getDocs: async () => ({ docs: [] }), setDoc: async () => {}, Timestamp: { now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }) }, orderBy: () => {}, query: () => {}, limit: () => {}, where: () => {}, deleteDoc: async () => {}, writeBatch: () => ({}) };
    }
    if (request === '@react-native-async-storage/async-storage') {
      return { __esModule: true, default: { getItem: async (k) => gudang.get(k) ?? null, setItem: async (k, v) => { gudang.set(k, v); } } };
    }
    return asliLoad.apply(this, arguments);
  };
  const ai = require(path.join(KELUAR, 'wheelAi.js'));

  (async () => {
    let e = null;
    try { ai.normalizeWheelNotes({}); } catch (x) { e = x; }
    c('kosong semua → AiAnswerError', e && e.name === 'AiAnswerError');
    e = null;
    try { ai.normalizeWheelNotes({ fun: 'x'.repeat(2001) }); } catch (x) { e = x; }
    c('kepanjangan (> 2000) → AiAnswerError', e && /terlalu panjang/.test(e.message));

    const catatan = { spirituality: ' aku masih rajin ibadah ', fun: 'puasa ig tapi terbantu' };
    const hasil = await ai.rapikanJawabanWheel(catatan);
    c('sistem prompt: poin "- ", jangan ubah isi, catatan kosong tetap kosong',
      /diawali "- "/.test(panggilan[0].params.systemInstruction) &&
        /JANGAN mengubah isi/.test(panggilan[0].params.systemInstruction) &&
        /kosong tetap kosong/.test(panggilan[0].params.systemInstruction));
    c('structured output JSON dengan kunci kedelapan area',
      panggilan[0].params.generationConfig.responseMimeType === 'application/json' &&
        Object.keys(panggilan[0].params.generationConfig.responseSchema.properties).length === 8);
    c('tiap baris jawaban dipastikan diawali "- " (termasuk yang model tulis "* ")',
      hasil.fun === '- puasa ig tapi terbantu karna hectic kerjaan\n- bulan lalu liburan sama adek ke bandung');
    c('tanda pisah panjang dari model dibuang',
      !hasil.spirituality.includes(EM) && /^- aku masih rajin ibadah, core dan EN\n- sebulan terakhir/.test(hasil.spirituality));
    c('area yang aslinya kosong TETAP kosong walau model mengisinya', hasil.health === '');
    c('pesan galatnya lewat pemetaan bersama (kuota 429 → tanpa biaya)',
      /Tidak ada biaya/.test(ai.wheelAiErrorMessage(new AIError('error', 'x', { status: 429 }))));

    // ================= 9. PDF Timeline dijalankan sungguhan =================
    console.log('9. PDF Timeline: umur CL & umurku di tiap tahun');
    const cetakan = { html: null };
    Module._load = function (request) {
      if (request === 'expo-print') return { printToFileAsync: async ({ html }) => { cetakan.html = html; return { uri: '/tmp/x.pdf' }; } };
      if (request === 'expo-sharing') return { isAvailableAsync: async () => true, shareAsync: async () => {} };
      if (request === 'expo-file-system') {
        return { File: class { constructor() { this.uri = '/tmp/x.pdf'; this.exists = false; } rename() {} delete() {} get parentDirectory() { return '/tmp'; } } };
      }
      if (request === '@/assets/logoCoreGwu') return { LOGO_CORE_GWU_DATA_URI: 'data:image/png;base64,AA' };
      if (request === './firebase') return { app: {}, db: {} };
      if (request === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
      if (request === './photo') return { pickCompressedImage: async () => null };
      if (request === 'firebase/firestore') {
        return { collection: () => ({}), doc: () => ({}), getDocs: async () => ({ docs: [] }), setDoc: async () => {}, Timestamp: { now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }) }, orderBy: () => {}, query: () => {}, limit: () => {}, where: () => {}, deleteDoc: async () => {}, writeBatch: () => ({}) };
      }
      return asliLoad.apply(this, arguments);
    };
    const { shareTimelinePdf } = require(path.join(KELUAR, 'timelinePdf.js'));
    const tl = require(path.join(KELUAR, 'timeline.js'));
    Module._load = asliLoad;
    const tahun = [
      { year: 2026, items: [{ id: 'a', title: 'level mandarin hsk 3', category: 'career', month: 10, done: false }] },
      { year: 2028, items: [{ id: 'b', title: 'married', category: 'relationship', month: 6, done: false }] },
    ];
    await shareTimelinePdf(tahun, { name: 'Novia', heart: '💜', birthYear: 1998 }, null, new Date(2026, 8, 14, 21, 27));
    // 15 Sep 2026: umurku TIDAK ikut (permintaan user) — dokumennya tentang dia.
    c('tiap kepala tahun memuat umur CL di tahun itu (tanpa umurku)',
      /tahun-umur">🎂 Novia 28 th</.test(cetakan.html) &&
        /tahun-umur">🎂 Novia 30 th</.test(cetakan.html) &&
        !/tahun-umur">[^<]*Imanuel/.test(cetakan.html));
    c('umur dihitung dari tahun lahir yang dioper; BIRTH_YEAR (lib/timeline) tetap 1998 untuk timeline-ku',
      tl.BIRTH_YEAR === 1998 && !/OWNER_NAME|NAMA_DEPANKU/.test(baca('lib/timelinePdf.ts')));
    await shareTimelinePdf(tahun, null, null, new Date(2026, 8, 14));
    c('timeline-ku sendiri: cuma umurku', /tahun-umur">🎂 Umur 28 th</.test(cetakan.html) && !/Novia/.test(cetakan.html));
    c('barisnya di bawah "n wishlist · n tercapai", digayakan sendiri',
      /\.tahun-umur \{ color: #8A6B3E/.test(cetakan.html) &&
        cetakan.html.indexOf('tahun-meta">1 wishlist') < cetakan.html.indexOf('tahun-umur">🎂 Umur 28'));

    // ================= 11. updatedAt =================
    console.log('11. Rekap wishlist: terakhir diperbarui');
    const ts = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
    c('timelineLastUpdated mengambil yang paling baru dari semua tahun',
      tl.timelineLastUpdated([{ year: 2026, items: [], updatedAt: ts(5) }, { year: 2027, items: [], updatedAt: ts(9) }, { year: 2028, items: [] }]).getTime() === 9);
    c('tanpa cap sama sekali → null', tl.timelineLastUpdated([{ year: 2026, items: [] }]) === null);
    c('saveTimelineYear menulis updatedAt: Timestamp.now() bersama items',
      /setDoc\(timelineRef\(uid, year, owner\), \{ items, updatedAt: Timestamp\.now\(\) \}\)/.test(baca('lib/timeline.ts')));
    c('fetchTimelineAll ikut membaca updatedAt', /updatedAt: \(d\.data\(\)\?\.updatedAt as Timestamp \| undefined\)/.test(baca('lib/timeline.ts')));

    selesaiSemua();
  })().catch((e) => { console.log('  GAGAL galat tak terduga: ' + (e && e.stack)); gagal++; selesaiSemua(); });
}

function selesaiSemua() {
  // ================= 6. PDF Wheel =================
  console.log('6. PDF Wheel: Fokus Kuartal di halaman baru, radar 400');
  {
    const s = baca('lib/wheelPdf.ts');
    c('judul Fokus Kuartal memakai kelas halaman-baru (page-break-before)',
      /<h2 class="halaman-baru">🎯 Fokus Kuartal/.test(s) && /h2\.halaman-baru \{ page-break-before: always; margin-top: 0; \}/.test(s));
    c('radar 400 (dari 340)', /const RADAR_SIZE = 400;/.test(s));
    c('Score per Area tidak ikut dipaksa ke halaman baru', /<h2>📋 Score per Area<\/h2>/.test(s));
  }

  // ================= 7. Modal Follow Up =================
  console.log('7. Modal Follow Up: 🎡 Wheel & 📋 rekap wishlist CL');
  {
    const s = baca('components/core/FollowupTab.tsx');
    const kepala = antara(s, 'style={styles.modalHead}>', '<ScrollView');
    c('kepala modal: judul di kiri, dua tombol di kanan',
      kepala.length > 0 && /styles\.modalHeadMain/.test(kepala) && /styles\.modalHeadButtons/.test(kepala) &&
        /modalHead: \{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 \}/.test(s));
    c('🎡 → /wheel dengan leaderId, name, heart',
      /emoji="🎡"\s*\n\s*locked[\s\S]{0,300}pathname: '\/wheel',\s*\n\s*params: \{ leaderId: l\.id, name: l\.name, heart: l\.heart \}/.test(kepala));
    c('📋 → /timeline dengan tahun lahir + rekap: \'1\' (rekapnya langsung terbuka)',
      /emoji="📋"\s*\n\s*locked[\s\S]{0,400}pathname: '\/timeline'[\s\S]{0,300}birthYear: String\(l\.birthYear\),\s*\n\s*rekap: '1',/.test(kepala));
    c('modalnya ditutup DULU sebelum mendorong layar (Modal menutupi layar baru)',
      (kepala.match(/setFollowupModal\(null\);\s*\n\s*router\.push\(/g) || []).length === 2);
    c('keduanya bergaris "terkunci" (locked) → PIN tetap diminta di layarnya',
      (kepala.match(/locked/g) || []).length === 2 &&
        /const \[unlocked, setUnlocked\] = useState\(owner === null\);/.test(baca('app/timeline.tsx')) &&
        /const \[unlocked, setUnlocked\] = useState\(owner === null\);/.test(wheel));
    c('CL-nya utuh dioper ke modal (leader: l)', /leader: l,/.test(s) && /leader: CoreLeader;/.test(s));
  }

  // ================= 8, 10, 11 (layar). Timeline =================
  console.log('8/10/11. Timeline: hati di rekap, 📋 di header, terakhir diperbarui, ?rekap=1');
  {
    const s = baca('app/timeline.tsx');
    c('subjudul rekap: hati + nama CL', /subtitle=\{\s*\n\s*owner \? `\$\{params\.heart \?\? '📍'\} \$\{orang\}` : 'Semua tahun yang pernah kamu isi'/.test(s));
    c('📋 di header, di kiri tombol bagikan; petak lama hilang',
      /right=\{\s*\n\s*<>[\s\S]{0,400}emoji="📋"\s*\n\s*onPress=\{openRekap\}[\s\S]{0,300}icon="square\.and\.arrow\.up"/.test(s) &&
        !/recapButton|aksiRow/.test(s));
    c('kartu ringkasan rekap menampilkan 🕒 Terakhir diperbarui (tanggal / "-")',
      /🕒 Terakhir diperbarui/.test(s) && /const kapan = timelineLastUpdated\(semua\);\s*\n\s*return kapan \? formatDayDate\(kapan\) : '-';/.test(s));
    c('?rekap=1 → sheet rekap terbuka sejak awal, isinya dimuat sesudah PIN terbuka',
      /const rekapAwal = params\.rekap === '1';\s*\n\s*const \[rekapOpen, setRekapOpen\] = useState\(rekapAwal\);/.test(s) &&
        /if \(!user \|\| !unlocked \|\| !rekapAwal\) return;\s*\n\s*muatRekap\(\);/.test(s));
    // 16 Sep 2026: pemiliknya dihitung sekali (dipakai bagikan biasa & bagikan ke CL).
    c('PDF Timeline menerima tahun lahir CL', /const pemilik = owner\s*\n\s*\? \{ name: orang, heart: params\.heart \?\? '📍', birthYear \}\s*\n\s*: null;/.test(s));
  }

  console.log(gagal === 0 ? 'CEK-SEBELAS-14SEP OK' : gagal + ' gagal');
  process.exit(gagal === 0 ? 0 : 1);
}
