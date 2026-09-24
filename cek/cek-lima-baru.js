// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// Lima permintaan:
//   1. Reward langkah 👣 & strength training dipisah
//   2. Kamis 12.00–14.00 → kartu Home "Kirim Catatan Khotbah"
//   3. Tombol 🔗 pindah ke KIRI tombol share, ikonnya seirama
//   4. Tab sesi "tak tuntas" ikut memerah, bukan cuma tulisannya
//   5. Fun: tab Creators (YouTube tanpa API key), Reflection dibuang,
//      Race pindah ke Health
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-lima-baru');
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
      R + 'lib/reward.ts', R + 'lib/sermon.ts', R + 'lib/youtube.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const M = (nama) => {
  for (const k of [`lib/${nama}.js`, `${nama}.js`]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi lib/${nama}.ts`);
  process.exit(1);
};

// ---------- Tiruan modul + jaringan ----------
let feedPalsu = null;
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
      collection: () => {}, deleteDoc: () => {}, doc: () => {}, getDoc: () => {},
      limit: () => {}, onSnapshot: () => () => {}, orderBy: () => {},
      query: () => {}, setDoc: () => {}, writeBatch: () => {}, where: () => {},
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {} };
  if (/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const ach = require(M('reward'));
const srm = require(M('sermon'));
const yt = require(M('youtube'));

const T = (d) => ({ toDate: () => d });

// =====================================================================
console.log('=== 1. Reward langkah 👣 & strength dipisah ===');
// =====================================================================
{
  const src = baca('lib/reward.ts');
  const kategori = [...src.matchAll(/\{ key: '(\w+)', icon: [^,]+, label: '([^']+)'/g)]
    .map(([, key, label]) => ({ key, label }));
  const week = kategori.find((k) => k.key === 'week');
  // Judulnya kini Inggris & ringkas (permintaan 4 Sep 2026), tapi tetap
  // harus menyebut LANGKAH — kolom ini memang bukan soal angkat beban.
  c('kategori langkah mingguan ada & namanya jelas soal LANGKAH',
    !!week && /Steps/.test(week.label), week?.label);
  c('lambang kolom langkah tetap 👣',
    /key: 'week', icon: '👣'/.test(src));

  // 31 Agu 2026: kolom 'strength' DIBUBARKAN — ketiga lencananya pindah ke
  // kolom Fitness (lihat cek-enam-permintaan.js). Yang tetap dijaga di sini:
  // tak satu pun lencana angkat beban tertinggal di kolom LANGKAH.
  const isi = (kat) =>
    [...src.matchAll(/\{ id: '(\w+)', category: '(\w+)'/g)]
      .filter(([, , k]) => k === kat)
      .map(([, id]) => id);
  const isiWeek = isi('week');
  c('tak ada satu pun weekGym yang tertinggal di kolom langkah',
    !isiWeek.some((id) => id.startsWith('weekGym')), isiWeek.join(', '));
  c('kolom langkah tetap berisi ladder langkahnya',
    ['weekStep1', 'weekStep4', 'weekStep12'].every((id) => isiWeek.includes(id)));
  // "Minggu Sempurna" butuh KEDUANYA — tetap di kolom langkah, karena ia
  // diukur atas MINGGU-nya sebagai satu satuan.
  c('"Sempurna" (butuh dua-duanya) tetap di kolom langkah',
    isiWeek.includes('weekBoth1'));
}

// =====================================================================
console.log('\n=== 2. Kamis 12.00–14.00: kirim catatan khotbah ===');
// =====================================================================
{
  // 2026: 27 Agu = Kamis, 30 Agu = Minggu.
  const kamis = (jam, menit = 0) => new Date(2026, 7, 27, jam, menit);
  c('jendelanya Kamis 12.00–14.00', srm.SERMON_SHARE_DAY === 4);
  c('jam 11.59 belum', !srm.sermonShareWindow(kamis(11, 59)));
  c('jam 12.00 mulai', srm.sermonShareWindow(kamis(12, 0)));
  c('jam 13.59 masih', srm.sermonShareWindow(kamis(13, 59)));
  c('jam 14.00 sudah lewat', !srm.sermonShareWindow(kamis(14, 0)));
  c('hari lain tidak menagih sama sekali', (() => {
    for (const hari of [24, 25, 26, 28, 29, 30]) {
      if (srm.sermonShareWindow(new Date(2026, 7, hari, 13, 0))) return false;
    }
    return true;
  })());

  // Yang ditagih = catatan MINGGU KEMARIN (23 Agu 2026 = Minggu sebelum
  // Kamis 27 Agu).
  const mingguLalu = { id: '2026-08-23', title: 'MENJADI BENAR-BENAR MERDEKA' };
  const mingguLain = { id: '2026-08-16', title: 'Khotbah lama' };
  c('yang ditagih catatan ibadah Minggu kemarin',
    srm.sermonShareDue([mingguLain, mingguLalu], kamis(12, 30))?.id ===
      '2026-08-23');
  c('di luar jamnya tidak menagih apa-apa',
    srm.sermonShareDue([mingguLalu], kamis(9, 0)) === null);
  // Mengajak membagikan sesuatu yang belum ditulis = tuduhan, bukan pengingat.
  c('catatan yang BELUM ditulis tidak ditagih',
    srm.sermonShareDue([mingguLain], kamis(12, 30)) === null);
  c('daftar kosong pun aman', srm.sermonShareDue([], kamis(12, 30)) === null);

  // Beda dari reminder Rabu & Jumat yang sudah ada — dua hal berbeda.
  c('tidak menabrak reminder renungan Rabu & Jumat', (() => {
    const rabu = new Date(2026, 7, 26, 13, 0);
    return srm.sermonReminderActive(rabu) && !srm.sermonShareWindow(rabu);
  })());

  const home = baca('app/(tabs)/index.tsx');
  // 22 Sep 2026: kartunya jadi baris di hero With God (Today Engine).
  const engine = BACA_TODAY('lib/today.ts');
  const dataToday = BACA_TODAY('hooks/useTodayData.ts');
  c('barisnya ada di Today (With God)', /Kirim catatan khotbah: \$\{sermonKirim\.title\}/.test(engine));
  c('menuju halaman catatan khotbah minggu itu',
    /pathname: '\/sermon', params: \{ id: sermonKirim\.id \}/.test(engine));
  c('mengingatkan membagikannya ke WhatsApp',
    /Bagikan ke CORE Leader lewat WhatsApp/.test(engine));
  c('Today ikut mendengarkan catatan khotbah',
    /subscribeSermons\(uid, mark\('sermons', setSermons\), fail\)/.test(dataToday));
  c('gerbang Today ikut menghitung sumber barunya', (() => {
    const n = Number(/const SOURCES = (\d+)/.exec(dataToday)?.[1] ?? 0);
    return n === (dataToday.match(/mark\('/g) ?? []).length;
  })(), `SOURCES=${/const SOURCES = (\d+)/.exec(dataToday)?.[1]}`);
  // Halaman tujuannya memang punya tombol share-nya.
  c('halaman tujuannya memang punya tombol Share ke WhatsApp',
    /<ShareWhatsAppButton/.test(baca('app/sermon.tsx')));
}

// =====================================================================
console.log('\n=== 3. Tombol 🔗 di KIRI tombol share, ikonnya seirama ===');
// =====================================================================
{
  const lnb = baca('components/core/LinkedNotesButton.tsx');
  c('bukan emoji 🔗 lagi, tapi ikon rata',
    /icon="link"/.test(lnb) && !/emoji="🔗"/.test(lnb));
  c('ikon "link" memang terpetakan', /'link': 'link'/.test(
    baca('components/ui/icon-symbol.tsx')));

  const vis = baca('components/core/VisitationTab.tsx');
  const sisi = vis.slice(vis.indexOf('<View style={styles.cardSide}>'),
    vis.indexOf('<VisitationStatus'));
  const iLink = sisi.indexOf('<LinkedNotesButton');
  const iShare = sisi.indexOf('icon="square.and.arrow.up"');
  c('keduanya di dalam SATU baris', /<View style=\{styles\.cardActions\}>/.test(sisi));
  c('tombol bahan (🔗) di KIRI tombol kirim', iLink > 0 && iLink < iShare,
    iLink < iShare ? 'link → share' : 'urutannya terbalik');
  c('barisnya memang menyamping',
    /cardActions: \{ flexDirection: 'row'/.test(vis));
}

// =====================================================================
console.log('\n=== 4. "tak tuntas" → SELURUH tabnya memerah ===');
// =====================================================================
{
  const seg = baca('components/common/SegmentTabs.tsx');
  c('SegmentTab punya penanda bahaya', /danger\?: boolean;/.test(seg));
  // Warnanya harus benar-benar dipakai untuk latar & garis tepinya, bukan
  // cuma tulisan kecilnya.
  // Diiris sampai `const skin` — `return (` yang pertama ada di komponen
  // SegmentTabs di ATAS Segment, jadi irisannya akan kosong.
  c('latar & garis tepinya ikut merah', (() => {
    const blok = seg.slice(seg.indexOf('const diam ='), seg.indexOf('const skin ='));
    return /Color\.DANGER_TRANSPARENT/.test(blok) &&
      /tepiDiam = tab\.danger \? Color\.DANGER/.test(blok) &&
      /tepiNyala = tab\.danger \? Color\.DANGER/.test(blok);
  })());
  c('labelnya ikut merah', /labelDanger: \{ color: Color\.DANGER \}/.test(seg));
  c('tab biasa tidak ikut berubah warna', (() => {
    const blok = seg.slice(seg.indexOf('const diam ='), seg.indexOf('const skin ='));
    return /Color\.CONTAINER/.test(blok) && /Color\.MAIN_TRANSPARENT/.test(blok) &&
      /Color\.BORDER/.test(blok) && /Color\.MAIN/.test(blok);
  })());

  const hab = baca('components/habits/HabitsTab.tsx');
  c('Habits menyalakannya tepat saat "tak tuntas"',
    /danger: complete && !tuntas/.test(hab));
  // Aturannya sama persis dengan yang sudah dipakai warna tulisannya —
  // mustahil tulisan merah tapi kartunya tidak, atau sebaliknya.
  c('aturannya sama dengan warna tulisannya (tak mungkin beda pendapat)',
    /subColor:\s*\n?\s*complete && !tuntas \? Color\.DANGER : undefined/.test(hab));
  c('yang tuntas & yang masih berjalan TIDAK ikut memerah',
    !/danger: true/.test(hab) && !/danger: complete\b(?! && !tuntas)/.test(hab));
}

// =====================================================================
console.log('\n=== 5. Fun: Creators masuk, Reflection keluar, Race pindah ===');
// =====================================================================
{
  const fun = baca('app/fun.tsx');
  const health = baca('app/health.tsx');

  // --- Tab-tabnya ---
  c('Fun: Summit → Creators → Recreation', (() => {
    const keys = [...fun.matchAll(/\{ key: '(\w+)', label: '[^']+'/g)].map((m) => m[1]);
    return JSON.stringify(keys) === '["summit","creators","recreation"]';
  })());
  c('Reflection & Race sudah tidak ada di Fun',
    !/label: 'Reflection'/.test(fun) && !/label: 'Race'/.test(fun));
  // 2 Sep 2026: Race & Steps ditukar tempatnya — Race jadi paling kiri. Yang
  // dijaga tetap sama: keduanya BERDAMPINGAN (soal kaki yang sama) dan
  // Check-up tetap di ujung kanan.
  c('Health: Race → Steps → Check-up', (() => {
    const keys = [...health.matchAll(/\{ key: '(\w+)', label: '[^']+'/g)].map((m) => m[1]);
    return JSON.stringify(keys) === '["race","steps","checkup"]';
  })());
  // 31 Agu 2026: warnanya ikut layar Health (hijau MAIN), bukan merah kategori
  // Fun — lihat cek-reminder-revive.js.
  c('tab Race di Health menggambar arsip Fun kategori race',
    /<FunArchive category="race" accent=\{Color\.MAIN\} \/>/.test(health));

  // --- Datanya TIDAK pindah dokumen ---
  const arsip = baca('components/fun/FunArchive.tsx');
  c('arsipnya satu komponen, dipakai dua layar',
    /export function FunArchive\(\{\s*category,/.test(arsip) &&
      /<FunArchive category=\{tab\} \/>/.test(fun));
  c('sumber datanya tetap dokumen fun yang sama',
    /subscribeFun\(/.test(arsip) && /'fun', 'data'/.test(baca('lib/fun.ts')));
  // Entri Refleksi lama tidak boleh jadi yatim — ia menumpang di Rekreasi.
  c('entri Refleksi lama tetap punya tempat tampil (di Rekreasi)',
    /category === 'recreation' && e\.category === 'reflection'/.test(arsip));
  c('dan lambangnya tetap lambang aslinya, bukan lambang tabnya',
    /funCategoryMeta\(item\.category\)\.emoji/.test(arsip));
  c('tidak ada satu pun tulis Firestore untuk memindahkannya',
    !/category: 'recreation'/.test(arsip));

  // --- YouTube TANPA API key ---
  const ytSrc = baca('lib/youtube.ts');
  c('memakai feed publik kanal, bukan Data API',
    /youtube\.com\/feeds\/videos\.xml\?channel_id=/.test(ytSrc) &&
      !/googleapis\.com|API_KEY|apiKey|key=/.test(ytSrc));
  c('tidak ada kunci rahasia apa pun di kode', !/AIza[\w-]{10,}/.test(ytSrc));
  // 31 Agu 2026: kelompoknya diganti jadi Mr. Beast / Mountain / Recreation
  // (chip "Semua" dihapus) — lihat cek-delapan-permintaan.js.
  c('tiap kelompok kanal ada isinya',
    ['mrbeast', 'mountain', 'recreation'].every((k) =>
      yt.CREATORS.some((x) => x.kind === k)),
    `${yt.CREATORS.length} kanal`);
  c('MrBeast termasuk', yt.CREATORS.some((x) => x.name === 'MrBeast'));
  c('tiap kanal punya channel id berbentuk benar (UC…)',
    yt.CREATORS.every((x) => /^UC[\w-]{20,}$/.test(x.channelId)),
    yt.CREATORS.filter((x) => !/^UC[\w-]{20,}$/.test(x.channelId))
      .map((x) => x.name).join(', ') || 'semua sah');
  c('key kanalnya unik', new Set(yt.CREATORS.map((x) => x.key)).size ===
    yt.CREATORS.length);

  // Pembacaan feed ATOM-nya DIJALANKAN atas XML sungguhan.
  const XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <id>yt:video:ABC123</id>
    <yt:videoId>ABC123</yt:videoId>
    <title>Aku Kasih 100 Orang Rp1 Miliar &amp; Ini Hasilnya</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=ABC123"/>
    <published>2026-08-30T04:00:00+00:00</published>
    <media:group>
      <media:thumbnail url="https://i.ytimg.com/vi/ABC123/hqdefault.jpg" width="480" height="360"/>
    </media:group>
  </entry>
  <entry>
    <yt:videoId>DEF456</yt:videoId>
    <title>Video kedua</title>
    <published>2026-08-29T04:00:00+00:00</published>
  </entry>
</feed>`;
  const asliFetch = global.fetch;
  global.fetch = async () => ({ ok: true, text: async () => (feedPalsu ?? XML) });

  (async () => {
    const v = await yt.fetchCreatorVideos(yt.CREATORS[0]);
    c('dua video terbaca dari feed ATOM', v.length === 2, String(v.length));
    // Feed YouTube itu ATOM: bloknya <entry>, bukan <item> — kalau salah
    // parser, hasilnya daftar KOSONG tanpa pesan galat.
    c('judulnya utuh & entitas HTML-nya dipulihkan',
      v[0].title === 'Aku Kasih 100 Orang Rp1 Miliar & Ini Hasilnya', v[0].title);
    // Tautannya ada di ATRIBUT href, jadi dibangun dari videoId — bukan
    // dibaca sebagai isi tag (yang hasilnya kosong).
    c('tautannya menuju videonya, bukan kosong',
      v[0].link === 'https://www.youtube.com/watch?v=ABC123', v[0].link);
    c('tanggalnya terbaca', v[0].publishedAt instanceof Date &&
      v[0].publishedAt.getUTCFullYear() === 2026);
    c('sampulnya dari feed kalau ada',
      v[0].thumb === 'https://i.ytimg.com/vi/ABC123/hqdefault.jpg');
    c('video tanpa sampul di feed tetap dapat sampul (dibangun dari id)',
      v[1].thumb === 'https://i.ytimg.com/vi/DEF456/hqdefault.jpg', v[1].thumb);
    c('id-nya menyertakan kanalnya (dua kanal tak mungkin bentrok)',
      v[0].id.startsWith(`${yt.CREATORS[0].key}-`), v[0].id);

    // Satu kanal mati TIDAK boleh mengosongkan seluruh tab.
    let ke = 0;
    global.fetch = async () => {
      ke++;
      if (ke === 1) return { ok: false, status: 404, text: async () => '' };
      return { ok: true, text: async () => XML };
    };
    const gabung = await yt.fetchCreatorFeed();
    c('satu kanal gagal → sisanya tetap tampil', gabung.length > 0,
      `${gabung.length} video`);
    c('digabung & diurutkan terbaru dulu', (() => {
      for (let i = 1; i < gabung.length; i++) {
        const a = gabung[i - 1].publishedAt?.getTime() ?? 0;
        const b = gabung[i].publishedAt?.getTime() ?? 0;
        if (a < b) return false;
      }
      return true;
    })());

    // SEMUA kanal gagal → barulah errornya dilempar (layarnya "Coba lagi").
    global.fetch = async () => ({ ok: false, status: 500, text: async () => '' });
    let melempar = false;
    try {
      await yt.fetchCreatorFeed();
    } catch {
      melempar = true;
    }
    c('semua kanal gagal → error dilempar (bukan diam-diam kosong)', melempar);

    global.fetch = asliFetch;

    // Usia video — bunyinya sama dengan fitur News.
    const now = new Date(2026, 7, 30, 12, 0);
    c('"4 jam lalu"',
      yt.videoAge(new Date(2026, 7, 30, 8, 0), now) === '4 jam lalu',
      yt.videoAge(new Date(2026, 7, 30, 8, 0), now));
    c('"2 hari lalu"',
      yt.videoAge(new Date(2026, 7, 28, 12, 0), now) === '2 hari lalu');
    c('tanpa tanggal → kosong, bukan "NaN"', yt.videoAge(null, now) === '');

    const tab = baca('components/fun/CreatorsTab.tsx');
    c('videonya dibuka di YouTube, bukan diputar di dalam app',
      /openExternalUrl\(v\.link\)/.test(tab));
    // 1 Sep 2026: turun baris → digeser ke samping, sama seperti Reminder &
    // News. Yang menjaga "tak ada yang terpotong" kini `activeIndex` —
    // lihat cek-chip-geser.js.
    c('barisan saringannya digeser, & chip aktifnya ditarik utuh ke layar',
      /activeIndex=\{CREATOR_KINDS\.findIndex\(\(k\) => k\.key === kind\)\}/.test(tab) &&
      !/fit="wrap"/.test(tab));
    c('chip yang sudah aktif ditekan lagi → muat ulang & balik ke atas',
      /reload\(\);\s*\n\s*listRef\.current\?\.scrollTo\(\{ y: 0/.test(tab));

    console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
    process.exit(ok ? 0 : 1);
  })();
}