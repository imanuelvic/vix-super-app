// Fitur News 📰 — tiga permintaan pemilik (28 Agu 2026):
//   1. Pengingat kirim Motivational Word 🔥 di modal Follow Up.
//   2. Baris kebiasaan "Reading the News" → buka News › Berita + auto-centang.
//   3. Kategori Teknologi & Dev, dan fitur "World" berganti nama jadi "News".
//
// Sumber beritanya diuji dengan MENJALANKAN fetchNews yang asli — sekali ke
// jaringan sungguhan (alamat RSS-nya memang hidup?) dan sekali dengan fetch
// palsu (satu feed mati tidak boleh mengosongkan tab).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-berita');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi lib/news.ts ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/news.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan — hasil emit-nya diperiksa di bawah */ }

const MODUL = fs.existsSync(path.join(OUT, 'lib', 'news.js'))
  ? path.join(OUT, 'lib', 'news.js')
  : path.join(OUT, 'news.js');
if (!fs.existsSync(MODUL)) {
  console.log('  ✗ gagal mengompilasi lib/news.ts');
  process.exit(1);
}

const fetchAsli = global.fetch;
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return { doc: () => ({}), setDoc: async () => {}, onSnapshot: () => () => {} };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  // Modul native yang ikut terseret lewat liveDoc — tak satu pun dipakai
  // di sini; yang diuji cuma pengambil RSS-nya.
  if (/^(expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const N = require(MODUL);

async function main() {
  // ===================================================================
  console.log('=== 1. Tujuh kategori berita (Crypto ditambah 23 Sep 2026) ===');
  // ===================================================================
  const kunci = N.NEWS_SOURCES.map((s) => s.key);
  // Urutan chip-nya diatur ulang PEMILIKNYA sendiri (Teknologi & Dev ditaruh
  // paling depan). Jadi yang dijaga di sini ketujuh kategorinya lengkap & tak
  // ada yang kembar — urutannya memang haknya dia, cukup dicetak saja.
  c('ketujuh kategorinya lengkap & tak ada yang kembar',
    [...kunci].sort().join(',') === 'bloomberg,christian,crypto,dev,indonesia,tech,world' &&
      new Set(kunci).size === 7,
    kunci.join(' · '));
  for (const s of N.NEWS_SOURCES) {
    console.log(`      ${s.emoji} ${s.label.padEnd(10)} ${s.sub}`);
  }
  const tech = N.NEWS_SOURCES.find((s) => s.key === 'tech');
  const dev = N.NEWS_SOURCES.find((s) => s.key === 'dev');
  c('Teknologi menyebut AI & robotika', /AI/.test(tech.sub) && /robot/i.test(tech.sub));
  c('Dev menyebut Expo, RN, iOS & Android',
    /Expo/.test(dev.sub) && /RN/.test(dev.sub) && /iOS/.test(dev.sub) && /Android/.test(dev.sub));

  // ===================================================================
  console.log('\n=== 2. Alamat RSS-nya HIDUP (ke jaringan sungguhan) ===');
  // ===================================================================
  for (const key of ['tech', 'dev']) {
    try {
      const items = await N.fetchNews(key);
      const sumber = [...new Set(items.map((i) => i.source))];
      c(`${key.padEnd(4)} → ${items.length} berita`, items.length > 0);
      console.log('      penerbit: ' + sumber.slice(0, 6).join(' · '));
      items.slice(0, 3).forEach((i) =>
        console.log(`        • ${i.title.slice(0, 68)}`));
      // Blog resmi tidak menyebut penerbitnya di RSS — tanpa nama cadangan
      // semuanya akan tertulis "Google News", dan itu jelas keliru.
      if (key === 'dev') {
        c('penerbit blog resmi tertulis benar, bukan "Google News"',
          sumber.some((s) => /React Native|Expo|Apple|Android|web\.dev/i.test(s)) &&
            !sumber.every((s) => s === 'Google News'));
      }
      c(`${key.padEnd(4)} terurut terbaru dulu`, (() => {
        const t = items.map((i) => i.publishedAt?.getTime() ?? 0);
        return t.every((v, idx) => idx === 0 || t[idx - 1] >= v);
      })());
      c(`${key.padEnd(4)} tak ada judul kembar`,
        new Set(items.map((i) => i.title.toLowerCase())).size === items.length);
    } catch (e) {
      c(`${key} bisa diambil`, false, e.message);
    }
  }

  // ===================================================================
  console.log('\n=== 3. Satu feed mati tidak mengosongkan tabnya ===');
  // ===================================================================
  {
    // Feed pertama selalu gagal; sisanya mengembalikan satu berita.
    let ke = 0;
    global.fetch = async () => {
      ke += 1;
      // Nomornya dikunci PER panggilan. Kalau `ke` dibaca nanti di dalam
      // text(), kelima feed sudah sama-sama bernilai 5 → judulnya kembar
      // semua dan pembuang-kembar dengan benar menyisakan satu. (Itu terjadi
      // sungguhan waktu uji ini pertama ditulis: yang salah fetch palsunya,
      // bukan kodenya.)
      const n = ke;
      if (n === 1) throw new Error('jaringan putus');
      return {
        ok: true,
        status: 200,
        text: async () => `<rss><channel>
          <item><title>Berita hidup ${n}</title><link>https://x/${n}</link>
          <pubDate>Thu, 27 Aug 2026 10:0${n}:00 GMT</pubDate></item>
        </channel></rss>`,
      };
    };
    const items = await N.fetchNews('dev');
    c('4 dari 5 feed selamat → beritanya tetap tampil', items.length === 4, `${items.length} berita`);

    // SEMUA mati → barulah error dilempar, supaya layarnya menampilkan
    // "Coba lagi" dan bukan daftar kosong yang membingungkan.
    global.fetch = async () => { throw new Error('semua putus'); };
    let dilempar = null;
    try { await N.fetchNews('tech'); } catch (e) { dilempar = e; }
    c('semua feed mati → melempar error (bukan daftar kosong)', dilempar !== null);

    // Judul kembar dari dua feed berbeda cuma tampil sekali, terbaru dulu.
    global.fetch = async () => ({
      ok: true, status: 200,
      text: async () => `<rss><channel>
        <item><title>Berita Kembar</title><link>https://a</link>
          <pubDate>Thu, 20 Aug 2026 08:00:00 GMT</pubDate></item>
        <item><title>Berita Baru</title><link>https://b</link>
          <pubDate>Thu, 27 Aug 2026 08:00:00 GMT</pubDate></item>
      </channel></rss>`,
    });
    const gabung = await N.fetchNews('tech'); // 2 feed × 2 berita = 4 mentah
    c('judul kembar dibuang (4 mentah → 2 tampil)', gabung.length === 2, `${gabung.length}`);
    c('yang terbaru di atas', gabung[0].title === 'Berita Baru', gabung[0].title);
    global.fetch = fetchAsli;
  }

  // ===================================================================
  console.log('\n=== 4. "World" benar-benar jadi "News" ===');
  // ===================================================================
  c('app/world.tsx sudah tidak ada', !fs.existsSync(R + 'app/world.tsx'));
  c('lib/world.ts sudah tidak ada', !fs.existsSync(R + 'lib/world.ts'));
  c('components/world/ sudah tidak ada', !fs.existsSync(R + 'components/world'));
  c('app/news.tsx, lib/news.ts & components/news/ ada',
    fs.existsSync(R + 'app/news.tsx') && fs.existsSync(R + 'lib/news.ts') &&
      fs.existsSync(R + 'components/news/NewsTab.tsx'));

  const layar = baca('app/news.tsx');
  c('judul layarnya "News 📰"', /title="News 📰"/.test(layar));
  c('tab Berita jadi tab PERTAMA', /\{ key: 'news',[\s\S]{0,80}\{ key: 'population'/.test(layar));

  const grid = baca('lib/featureGrid.ts');
  const tile = /\{ key: 'news',[^}]*\}/.exec(grid);
  c('ubin Home: key news · label News · rute /news · ikon koran', !!tile &&
    /label: 'News'/.test(tile[0]) && /route: '\/news'/.test(tile[0]) &&
    /icon: 'newspaper\.fill'/.test(tile[0]), tile ? tile[0].slice(0, 72) : '—');
  c('rutenya terdaftar & typed routes sudah di-regen',
    /Stack\.Screen name="news"/.test(baca('app/_layout.tsx')) &&
      /`\/news`/.test(baca('.expo/types/router.d.ts')) &&
      !/`\/world`/.test(baca('.expo/types/router.d.ts')));

  // Warna & rujukan lama tidak boleh tertinggal di mana pun.
  const semua = [];
  const sapu = (dir) => {
    for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) sapu(p);
      else if (/\.tsx?$/.test(e.name)) semua.push(p);
    }
  };
  ['app', 'components', 'lib', 'hooks', 'contexts', 'assets'].forEach(sapu);
  const sisa = semua.filter((f) => {
    const s = baca(f);
    return /Color\.WORLD\b|Color\.WORLD_DARK|from '@\/lib\/world'|from '\.\/world'|'\/world'/.test(s);
  });
  c('tak ada Color.WORLD / impor lib/world / rute /world yang tersisa',
    sisa.length === 0, sisa.join(', ') || 'bersih');
  c('Color.NEWS & NEWS_DARK ada di palet',
    /NEWS: '#/.test(baca('assets/style/color.ts')) &&
      /NEWS_DARK: '#/.test(baca('assets/style/color.ts')));

  // Yang SENGAJA tidak ikut diganti: jalur Firestore-nya.
  const libNews = baca('lib/news.ts');
  c("jalur Firestore tetap 'world' → data lama tidak jadi yatim",
    /doc\(db, 'users', uid, 'world', 'population'\)/.test(libNews) &&
      /'world', 'prayerNews'/.test(baca('lib/prayerNews.ts')));
  c('alasannya ditulis di kodenya, bukan didiamkan',
    /SENGAJA tetap/.test(libNews) && /yatim/.test(libNews));

  // ===================================================================
  console.log('\n=== 5. Kebiasaan "Reading the News" ===');
  // ===================================================================
  const habits = baca('lib/habits.ts');
  // Berhenti di `\n  },` (tutup di kolom 2) — bukan di `},` pertama, karena
  // `route: { … } },` di dalamnya juga memuat `},`.
  const tautan = /\{\s*match: \/reading the news[\s\S]*?\n  \},/.exec(habits);
  c('ada pintasannya di HABIT_LINKS', !!tautan);
  c('mendarat di News › tab Berita', !!tautan &&
    /pathname: '\/news', params: \{ tab: 'news' \}/.test(tautan[0]));
  c('ditandai doneOnOpen → click = centang + buka', !!tautan &&
    /doneOnOpen: true/.test(tautan[0]));
  // Bunyi keterangannya dipendekkan pemiliknya jadi "Buka News" saja — yang
  // penting keterangannya ADA dan menyebut News; janji "tandai selesai"-nya
  // sudah dijaga oleh doneOnOpen di atas.
  c('keterangannya ada & menyebut News', !!tautan &&
    /note: '[^']*News[^']*'/.test(tautan[0]),
    (/note: ('[^']*')/.exec(tautan?.[0] ?? '') ?? [])[1]);
  c('BUKAN mirrorOf (centangnya tidak menunggu bukti di layar lain)',
    !!tautan && !/mirrorOf/.test(tautan[0]));

  const tab = baca('components/habits/HabitsTab.tsx');
  c('HabitsTab mencentang lalu membuka', /if \(link\.doneOnOpen && habit && !day\.done\[habit\.id\] && !day\.skipped\[habit\.id\]\)/.test(tab));
  c('yang sudah tercentang / sudah ✗ tidak dicentang ulang',
    /!day\.done\[habit\.id\] && !day\.skipped\[habit\.id\]/.test(tab));
  c('lingkarannya tetap bisa di-click → centangnya bisa dibatalkan',
    /mirrored \? openHabitLink\(link!\) : handleToggle\(habit\)/.test(tab));
  c('nama kebiasaannya yang membawa habit-nya ke openHabitLink',
    /onPress=\{\(\) => link && openHabitLink\(link, habit\)\}/.test(tab));

  // ===================================================================
  console.log('\n=== 6. Pengingat Motivational Word 🔥 di modal Follow Up ===');
  // ===================================================================
  const fu = baca('components/core/FollowupTab.tsx');
  c('pengingatnya ada di modal follow up',
    /Sudah kirim Motivational Word \{todayName\(\)\} ke grup CORE\?/.test(fu));
  c('menyebut HARI ini, bukan kalimat umum', /todayName\(\)/.test(fu) &&
    /from '@\/lib\/chatTemplates'/.test(fu));
  c('click-nya membuka Template Chat', /router\.push\('\/chat-templates'\)/.test(fu));
  // Tombol Chat WA yang sama dipakai DUA modal (Doa Rantai & Follow Up), jadi
  // yang dibandingkan harus yang di modal Follow Up — yaitu yang TERAKHIR.
  c('letaknya PERSIS di atas tombol Chat WA modal Follow Up', (() => {
    const a = fu.indexOf('styles.motivasiRow');
    const b = fu.lastIndexOf('styles.modalWaButton');
    if (a < 0 || b < a) return false;
    const antara = fu.slice(a, b);
    // Di antara keduanya tak boleh ada elemen isi lain — cuma penutup baris
    // pengingatnya lalu percabangan "punya nomor HP atau tidak".
    return /followupModal\.phone \? \(/.test(antara) && !/ScrollView|CardActionButton/.test(antara);
  })());
  c('rupanya lebih tenang dari tombol Chat WA (bukan tombol hijau kedua)',
    /motivasiRow: \{[\s\S]*?backgroundColor: Color\.MAIN_TRANSPARENT/.test(fu));
  // 31 Agu 2026: Template Chat sekarang membuka dengan SEMUA kategori
  // tertutup, jadi pengingat ini mendarat di daftarnya — tinggal satu click
  // membuka Motivational Words, yang tetap ada di paling atas daftar.
  c('Template Chat membuka dengan semua kategori tertutup',
    /useState<string \| null>\(null\)/.test(baca('app/chat-templates.tsx')) &&
    /key: 'motivational'/.test(baca('lib/chatTemplates.ts')));

  console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
  process.exit(ok ? 0 : 1);
}

main();
