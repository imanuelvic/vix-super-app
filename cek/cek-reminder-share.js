// Tiga permintaan:
//   1. Tombol 🧍 turun ke bawah ✏️ (baris atas kartu CL tidak lagi bertiga)
//   2. Modal ⚖️ Target Berat punya pintu ke Profile › 🧍 Data Tubuh
//   3. Kartu Reminder bisa dijadikan gambar & dikirim ke WhatsApp,
//      plus tambahan quotes & ayat Alkitab
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-reminder-share');
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
      R + 'lib/spiritual.ts',
      R + 'lib/reminderImage.ts',
      R + 'lib/shareImage.ts',
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

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
      collection: () => {}, deleteDoc: () => {}, doc: () => {},
      limit: () => {}, onSnapshot: () => {}, orderBy: () => {},
      query: () => {}, setDoc: () => {}, where: () => {}, addDoc: () => {},
      updateDoc: () => {}, writeBatch: () => {},
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {} };
  if (/assets\/style\/color$/.test(req) || /style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) {
    return { File: class {}, Paths: {}, Asset: {}, requestPermissionsAsync: () => {} };
  }
  return asli.call(this, req, parent, isMain);
})(Module._load);

const sp = require(M('spiritual'));
const ri = require(M('reminderImage'));

// =====================================================================
console.log('=== 1. Kartu CORE Leader: 🧍 turun ke bawah ✏️ ===');
// =====================================================================
{
  const s = baca('components/core/LeadersTab.tsx');
  // Blok kartu CL saja — Main Team punya tombolnya sendiri di bawah.
  const blok = s.slice(s.indexOf('<View style={styles.cardRight}>'),
    s.indexOf('{soon && ('));
  const iWheel = blok.indexOf('emoji="🎡"');
  const iEdit = blok.indexOf('<EditButton');
  const iBody = blok.indexOf('emoji="🧍"');
  const iTutup = blok.indexOf('</View>', iEdit);

  c('ketiga tombolnya masih ada', iWheel > 0 && iEdit > 0 && iBody > 0);
  // Inti permintaannya: baris atas cuma DUA tombol.
  c('baris atas cuma 🎡 + ✏️ — 🧍 tidak lagi ikut',
    iWheel < iEdit && iEdit < iTutup && iBody > iTutup,
    iBody > iTutup ? '🧍 di luar baris' : '🧍 masih di dalam baris');
  c('🧍 berdiri SESUDAH ✏️ (di bawahnya)', iBody > iEdit);
  // Wadah kanannya memang menumpuk ke bawah & rata kanan.
  c('kolom kanannya menumpuk ke bawah, rata kanan',
    /cardRight: \{ alignItems: 'flex-end'/.test(s));
  c('baris tombolnya sendiri tetap menyamping',
    /cardActions: \{ flexDirection: 'row'/.test(s));
}

// =====================================================================
console.log('\n=== 2. ⚖️ Target Berat → pintu ke Profile › 🧍 Data Tubuh ===');
// =====================================================================
{
  const s = baca('components/habits/HabitsTab.tsx');
  const modal = s.slice(s.indexOf('<CenterDialog visible={targetOpen}'),
    s.indexOf('</CenterDialog>'));
  c('ada baris yang bisa ditekan di dalam modalnya',
    /<PressableScale[\s\S]{0,120}styles\.targetHint/.test(modal));
  c('tujuannya Profile, sub-tab Data Tubuh',
    /pathname: '\/profile', params: \{ tab: 'body' \}/.test(modal));
  // Modalnya ditutup DULU — kalau tidak, ia masih menggantung saat kembali.
  c('modalnya ditutup dulu sebelum berpindah',
    /setTargetOpen\(false\);\s*\n\s*router\.push/.test(modal));
  // Yang ditawarkan memang datanya, bukan sekadar tautan.
  c('menyebut rentang sehat & tinggi badannya',
    /formatDecimal\(range\.min\)/.test(modal) &&
      /formatDecimal\(profile\.heightCm\)/.test(modal));
  c("sub-tab 'body' memang ada di Profile", (() => {
    const p = baca('app/profile.tsx');
    return /\{ key: 'body', label: '🧍' \}/.test(p) &&
      /body: 'Data Tubuh'/.test(p);
  })());
  // Param ?tab= hanya berlaku kalau layarnya memang menerimanya.
  c('Profile memang bisa dituju lewat ?tab=', (() => {
    const p = baca('app/profile.tsx');
    return /useTabScroll<Tab>\('profile', \{[\s\S]{0,120}tabs: TABS/.test(p);
  })());
}

// =====================================================================
console.log('\n=== 3. Reminder bisa dibagikan jadi gambar ===');
// =====================================================================
{
  // --- Kartunya persegi, dan itu ada alasannya (pratinjau WhatsApp) ---
  c('kanvasnya PERSEGI 1080×1080',
    ri.REMINDER_W === 1080 && ri.REMINDER_H === 1080,
    `${ri.REMINDER_W}×${ri.REMINDER_H}`);

  // --- Emoji pembuka dipisah dari badan teks ---
  // Bukan soal rupa: pemenggal barisnya menghitung per KARAKTER, dan emoji
  // jauh lebih lebar dari huruf — kalau ikut, barisnya melar keluar kartu.
  const p1 = ri.splitLeadingEmoji('🌊 Damai sejahtera bukan berarti tidak ada masalah');
  c('emoji pembuka dipisah dari kalimatnya',
    p1.emoji === '🌊' && p1.body === 'Damai sejahtera bukan berarti tidak ada masalah',
    JSON.stringify(p1));
  const p2 = ri.splitLeadingEmoji('❤️‍🩹 Pelayanan tanpa doa itu kekeringan');
  c('emoji majemuk (ZWJ + penanda gaya) ikut terbaca utuh',
    p2.emoji === '❤️‍🩹' && p2.body === 'Pelayanan tanpa doa itu kekeringan',
    JSON.stringify(p2));
  const p3 = ri.splitLeadingEmoji('Tanpa emoji sama sekali');
  c('kalimat tanpa emoji tidak dirusak',
    p3.emoji === '' && p3.body === 'Tanpa emoji sama sekali');

  // --- Tata letaknya: kalimat panjang MENGECIL, bukan terpotong ---
  const pendek = ri.layoutReminder('Tuhan itu baik');
  const panjang = ri.layoutReminder(
    'Orang yang menanti-nantikan TUHAN mendapat kekuatan baru: mereka seumpama rajawali yang naik terbang dengan kekuatan sayapnya; mereka berlari dan tidak menjadi lesu, mereka berjalan dan tidak menjadi lelah.',
  );
  c('kalimat pendek dapat huruf lebih besar', pendek.fontSize > panjang.fontSize,
    `${pendek.fontSize} vs ${panjang.fontSize}`);
  c('kalimat panjang tetap UTUH, tidak terpotong', (() => {
    const gabung = panjang.lines.join(' ');
    return gabung.includes('rajawali') && gabung.includes('tidak menjadi lelah.');
  })(), panjang.lines.length + ' baris');
  c('barisnya tetap muat di dalam badan kartunya', (() => {
    const tinggi = panjang.lines.length * panjang.lineHeight;
    return tinggi <= 800 - 300; // BODY_BOTTOM − BODY_TOP
  })());

  // --- SEMUA kalimat reminder harus muat, bukan cuma contoh ---
  const meleset = [];
  for (let i = 0; i < 400; i++) {
    // Ambil kalimat lewat pintu yang dipakai app-nya sendiri.
    const hari = `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
    for (const salt of ['revive', 'nudge']) {
      const teks = sp.dailyReminder(hari, salt);
      const { body } = ri.splitLeadingEmoji(teks);
      const l = ri.layoutReminder(body);
      const utuh = l.lines.join(' ').replace(/\s+/g, ' ').trim();
      const asli = body.replace(/\s+/g, ' ').trim();
      if (utuh !== asli) meleset.push(teks.slice(0, 40));
    }
  }
  c('tak ada satu pun kalimat reminder yang terpotong di kartunya',
    meleset.length === 0, meleset.slice(0, 3).join(' | '));

  // Kalimat terpanjang yang ADA sekarang cuma ±144 huruf — muat di tangga
  // huruf ketiga, jadi dua tangga terkecil belum pernah terpakai. Tangga itu
  // ada justru untuk ayat panjang yang ditambahkan nanti, jadi diuji dengan
  // kalimat yang memang HANYA muat di tangga terkecil: kalau tangganya
  // dibuang, ayat sepanjang ini diam-diam terpotong di tengah.
  {
    const sangatPanjang =
      'Kasih itu sabar; kasih itu murah hati; ia tidak cemburu. Ia tidak memegahkan diri dan tidak sombong. Ia tidak melakukan yang tidak sopan dan tidak mencari keuntungan diri sendiri. Ia tidak pemarah dan tidak menyimpan kesalahan orang lain. Ia tidak bersukacita karena ketidakadilan, tetapi ia bersukacita karena kebenaran. Ia menutupi segala sesuatu, percaya segala sesuatu, mengharapkan segala sesuatu, sabar menanggung segala sesuatu. Kasih tidak berkesudahan. Demikianlah tinggal ketiga hal ini: iman, pengharapan dan kasih.';
    const l = ri.layoutReminder(sangatPanjang);
    const utuh = l.lines.join(' ').replace(/\s+/g, ' ').trim();
    c('ayat panjang pun masih utuh (tangga huruf terkecil memang bekerja)',
      utuh === sangatPanjang.replace(/\s+/g, ' ').trim() && l.fontSize === 28,
      `${sangatPanjang.length} huruf → ${l.lines.length} baris @${l.fontSize}pt`);
  }

  // Kartunya PUNYA batas — dan batas itu sebaiknya diketahui, bukan ditemukan
  // saat sebuah ayat tiba-tiba terpotong. Di atas ±600 huruf, layoutText
  // memang memotong (perilaku bersama dengan Feed & Story, bukan khusus di
  // sini). Jadi: ayat yang mau ditambahkan ke REMINDERS jangan lebih dari itu.
  {
    const kata = 'kasih sabar murah hati tidak cemburu memegahkan sombong sopan mencari keuntungan sendiri pemarah menyimpan kesalahan orang lain bersukacita ketidakadilan kebenaran menutupi percaya mengharapkan menanggung berkesudahan'.split(' ');
    let teks = '';
    let batas = 0;
    for (let i = 0; i < 300; i++) {
      const coba = (teks ? `${teks} ` : '') + kata[i % kata.length];
      const l = ri.layoutReminder(coba);
      const utuh = l.lines.join(' ').replace(/\s+/g, ' ').trim() === coba;
      if (!utuh) break;
      teks = coba;
      batas = coba.length;
    }
    c('kapasitas kartunya jauh di atas kalimat terpanjang yang ada',
      batas >= 500, `muat sampai ±${batas} huruf (terpanjang sekarang 144)`);
  }

  // --- Nama berkasnya ---
  c('nama berkasnya bertanda arsip & tanggal',
    ri.reminderFileName('2026-08-30') === 'vixtory.archive 2026-08-30 reminder.png',
    ri.reminderFileName('2026-08-30'));

  // --- Layar & tombolnya ---
  const layar = baca('app/reminder-share.tsx');
  c('layarnya ada & dikenal typed routes',
    fs.existsSync(R + 'app/reminder-share.tsx') &&
      /pathname: `\/reminder-share`/.test(baca('.expo/types/router.d.ts')));
  // Kalimatnya DIOPER, bukan diundi ulang — yang dibagikan harus sama persis
  // dengan yang barusan dibaca di Home.
  c('kalimatnya dioper lewat parameter, bukan diundi ulang di layarnya',
    /useLocalSearchParams<\{ text\?: string \}>/.test(layar) &&
      !/dailyReminder|activeNudge/.test(layar));
  c('ada tombol bagikan ke WhatsApp & simpan ke Foto',
    /Bagikan ke WhatsApp/.test(layar) && /Simpan ke Foto/.test(layar));
  c('warna tombol bagikannya hijau WhatsApp',
    /background=\{Color\.WHATSAPP\}/.test(layar));

  // 22 Sep 2026: kartu Reminder Home → baris penyegar di hero With God (GodHero).
  const home = baca('components/today/GodHero.tsx');
  // 31 Agu 2026: emoji 📤 → ikon berbagi baku (square.and.arrow.up), rupanya
  // sama dengan tombol kirim di fitur CORE.
  c('kartu Reminder di Home punya tombol berbagi',
    /icon="square\.and\.arrow\.up"/.test(home) && /'\/reminder-share'/.test(home));
  c('tidak lagi memakai emoji 📤', !/emoji="📤"/.test(home));
  // Dioper lewat slot `action` (kanan bawah) — bukan slot lama di samping
  // judul. Salah slot = tombolnya hilang diam-diam, bukan cuma bergeser.
  c('tombol berbagi bersaudara dengan badan kalimatnya (bukan Pressable bersarang)',
    /<\/PressableScale>\s*\n\s*<EmojiButton\s*\n\s*icon="square\.and\.arrow\.up"/.test(home));
  // 31 Agu 2026: activeNudge mengembalikan Nudge utuh, jadi teksnya `nudge.text`.
  c('kalimat yang dikirim = kalimat yang sedang tampil',
    /params: \{ text: god\.nudge\?\.text \?\? '' \}/.test(home) && /\{god\.nudge\.text\}/.test(home));

  // Pressable bersarang di iOS bikin tombol dalam ikut memicu tombol luar —
  // jadi tombolnya harus BERSAUDARA dengan area tekan, bukan di dalamnya.
  const kartu = baca('components/common/ReminderCard.tsx');
  // 15 Sep 2026: cabang yang sama juga melayani tombol ✕ (onClose), jadi
  // syaratnya `action || onClose` dan actionRow-nya bersyarat.
  c('tombolnya bersaudara dengan area click, bukan bertumpuk',
    /if \(action \|\| onClose\) \{[\s\S]{0,400}<View style=\{cardStyle\}>[\s\S]{0,300}<\/PressableScale>\s*\n\s*\{action \? <View style=\{styles\.actionRow\}>\{action\}<\/View> : null\}/.test(kartu));
  // 31 Agu 2026: tempatnya pindah ke pojok kanan BAWAH.
  c('tombolnya menempel di kanan bawah, bukan di samping judul',
    /actionRow: \{ alignItems: 'flex-end'/.test(kartu) && !/headRow/.test(kartu));
  c('kartu tanpa tombol tetap satu tombol besar seperti dulu',
    /return \(\s*\n\s*<PressableScale style=\{cardStyle\} onPress=\{onPress\}>/.test(kartu));

  // --- Berbagi TIDAK menambah apa pun ke galeri Foto ---
  const si = baca('lib/shareImage.ts');
  const fn = si.slice(si.indexOf('export async function sharePng'),
    si.indexOf('export async function openInstagram'));
  c('sharePng cuma menulis ke cache — galeri Foto tidak disentuh',
    /Paths\.cache/.test(fn) && !/Asset\.create/.test(fn));
  c('memakai lembar berbagi iOS (expo-sharing yang sudah terpasang)',
    /Sharing\.shareAsync/.test(fn) && /Sharing\.isAvailableAsync/.test(fn));
  c('menyimpan ke Foto tetap jalur terpisah yang minta izin',
    /requestPermissionsAsync\(true\)/.test(si) && /Asset\.create/.test(si));
}

// =====================================================================
console.log('\n=== 4. Tambahan quotes & ayat Alkitab ===');
// =====================================================================
{
  const s = baca('lib/spiritual.ts');
  const daftar = s.slice(s.indexOf('const REMINDERS'), s.indexOf('\n];', s.indexOf('const REMINDERS')));
  const baris = [...daftar.matchAll(/^\s{2}'(.+)',$/gm)].map((m) => m[1]);
  c('daftarnya bertambah banyak', baris.length >= 60, `${baris.length} kalimat`);

  // Ayat harus SELALU membawa acuannya — kalimat yang dibagikan ke orang lain
  // harus bisa dicek sendiri sumbernya.
  const berayat = baris.filter((b) => b.includes('"'));
  c('ada ayat Alkitab yang dikutip', berayat.length >= 25,
    `${berayat.length} ayat`);
  // Acuannya kini dalam kurung di ujung: '…" (Yoh 14:27)' — bukan lagi
  // dipisah "—" (14 Sep 2026, semua "—" di teks tampil dibuang).
  const tanpaAcuan = berayat.filter((b) => !/\((?:[1-3] )?\w+\.?\s*\d+[:,\d\-–]*[a-z]?\)$/.test(b));
  c('SETIAP ayat menyertakan acuannya (kitab pasal:ayat)',
    tanpaAcuan.length === 0, tanpaAcuan.slice(0, 2).join(' | '));

  // Tidak boleh ada yang kembar — sehari tidak pernah mengulang kata, dan itu
  // cuma benar kalau daftarnya sendiri memang unik.
  const kembar = baris.filter((b, i) => baris.indexOf(b) !== i);
  c('tak ada kalimat kembar', kembar.length === 0, kembar.slice(0, 2).join(' | '));

  // Undiannya tetap tetap per hari (bukan Math.random).
  c('kalimat hari yang sama selalu sama',
    sp.dailyReminder('2026-08-30') === sp.dailyReminder('2026-08-30'));
  c('hari berbeda → kalimat berbeda', (() => {
    const kumpulan = new Set();
    for (let d = 1; d <= 28; d++) {
      kumpulan.add(sp.dailyReminder(`2026-08-${String(d).padStart(2, '0')}`));
    }
    return kumpulan.size >= 20;
  })());
  // Tiga penyegar dalam satu hari tidak boleh mengulang kalimat yang sama.
  c('tiga penyegar sehari tak pernah mengulang kalimat', (() => {
    for (const hari of ['2026-08-30', '2026-01-01', '2026-12-25']) {
      const teks = sp.nudgeSchedule(hari).map((n) => n.text);
      if (new Set(teks).size !== teks.length) return false;
    }
    return true;
  })());
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);