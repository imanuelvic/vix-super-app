// /rapihin 10 Sep 2026 — pola "paling banyak SATU bagian terbuka" diangkat
// jadi hooks/useAccordion.ts.
//
// Dua hal yang dijaga suite ini:
//   1. ATURANNYA benar — dijalankan dari sumbernya, bukan dicocokkan hurufnya.
//   2. Ekstraksinya TUNTAS — tidak ada layar yang diam-diam menyimpan sendiri.
//      Ini bagian yang paling mudah membusuk: satu layar baru yang menyalin
//      pola lama sudah cukup membuat "satu tempat" jadi bohong.
const AKAR = require('./akar');
const fs = require('fs');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const hook = baca('hooks/useAccordion.ts');

// =====================================================================
console.log('=== 1. Aturannya, dijalankan dari sumbernya ===');
// =====================================================================
{
  const m = hook.match(/setTerbuka\(\(cur\) => \(([^)]+)\)\)/);
  c('aturan buka-tutup ada di hook-nya', !!m, m?.[1]);
  if (m) {
    const aturan = new Function('cur', 'k', 'return ' + m[1]);
    c('dari tertutup semua, satu klik membuka yang diklik',
      aturan(null, 'a') === 'a');
    c('membuka bagian lain menutup yang sedang terbuka',
      aturan('a', 'b') === 'b' && aturan('b', 'c') === 'c');
    // Tanpa ini, bagian yang terbuka MACET sampai bagian lain dibuka —
    // dan di layar yang cuma punya satu bagian, ia tak bisa ditutup sama
    // sekali.
    c('mengklik yang sedang terbuka menutupnya, bukan membuka ulang',
      aturan('a', 'a') === null);
    // Kunci angka (tier langkah) diperlakukan sama dengan kunci teks.
    c('kunci angka pun berlaku sama', aturan(3, 3) === null && aturan(3, 5) === 5);
  }

  // Bawaannya null: layar yang tidak mengoper apa-apa mulai tertutup semua.
  c('tanpa argumen, bawaannya tertutup semua',
    /awal: K \| null = null/.test(hook));
  // Permukaannya sengaja cuma dua. Menambah yang tak dipakai berarti menambah
  // yang harus dijaga tanpa ada yang memakainya.
  c('permukaannya cuma isOpen & toggle',
    /isOpen: \(k: K\) =>/.test(hook) &&
      /toggle: \(k: K\) =>/.test(hook) &&
      (hook.match(/^\s{4}\w+:/gm) || []).length === 2);
}

// =====================================================================
console.log('\n=== 2. Ekstraksinya tuntas — tak ada salinan tersisa ===');
// =====================================================================
{
  // Kelima layar yang dulu menyalin polanya sendiri-sendiri.
  const PEMAKAI = [
    ['app/futsal/[id].tsx', String.raw`useAccordion<Bagian>\('squad'\)`],
    ['components/core/LeadersTab.tsx', String.raw`useAccordion<'cl' \| 'mt'>\(\)`],
    ['app/wheel.tsx', String.raw`useAccordion<'focus' \| 'score'>\(\)`],
    ['app/monthly-prayers.tsx', String.raw`useAccordion<string>\(\)`],
    ['app/steps.tsx', String.raw`useAccordion<number>\(\)`],
  ];

  for (const [f, pola] of PEMAKAI) {
    const isi = baca(f);
    c(`${f} memakai hook-nya`, new RegExp(pola).test(isi));
  }

  // INI cek terpentingnya: tak ada satu pun yang masih menyimpan sendiri.
  // Nama-nama di bawah adalah state yang dulu dipegang tiap layar.
  const SISA = /const \[terbuka, setTerbuka\]|setOpenLeaderId|setExpandedTier/;
  for (const [f] of PEMAKAI) {
    c(`${f} tidak lagi memegang state-nya sendiri`, !SISA.test(baca(f)));
  }

  // Dan tak ada layar LAIN di app yang menyusun ulang aturannya sendiri.
  // Dicari di seluruh app/ & components/, bukan cuma di kelima berkas di atas —
  // yang dijaga justru layar yang belum ada hari ini.
  const berkas = [];
  (function sisir(dir) {
    for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) sisir(p);
      else if (/\.tsx?$/.test(e.name)) berkas.push(p);
    }
  })('app');
  (function sisir(dir) {
    for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) sisir(p);
      else if (/\.tsx?$/.test(e.name)) berkas.push(p);
    }
  })('components');

  const penyalin = berkas.filter((f) =>
    /\(\(cur\) => \(cur === \w+ \? null : \w+\)\)|\(\(prev\) => \(prev === [\w.]+ \? null : [\w.]+\)\)/.test(
      baca(f),
    ),
  );
  // HabitsTab `areaFilter` sengaja TIDAK ikut: bentuknya memang mirip, tapi
  // artinya beda — ia SARINGAN daftar ("tampilkan area ini saja"), bukan
  // bagian yang dibuka-tutup. Menyeretnya ke useAccordion cuma menyamakan dua
  // hal yang kebetulan berbentuk sama.
  const SAH = ['components/habits/HabitsTab.tsx'];
  const nakal = penyalin.filter((f) => !SAH.includes(f));
  c('tak ada layar yang menyusun ulang aturannya sendiri',
    nakal.length === 0, nakal.join(', ') || 'bersih');
}

// =====================================================================
console.log('\n=== 3. Perilaku di layar tidak bergeser ===');
// =====================================================================
{
  // Nama variabel di tiap layar sengaja DIPERTAHANKAN supaya JSX-nya tidak
  // tersentuh sama sekali — ini yang membuat "tampilannya tetap identik"
  // bukan sekadar klaim.
  const futsal = baca('app/futsal/[id].tsx');
  c('futsal: ketiga nama boolean lamanya tetap',
    /const squadOpen = isOpen\('squad'\);/.test(futsal) &&
      /const gamesOpen = isOpen\('games'\);/.test(futsal) &&
      /const notesOpen = isOpen\('notes'\);/.test(futsal));
  c('futsal: bawaannya tetap Squad & Setoran',
    /useAccordion<Bagian>\('squad'\)/.test(futsal));

  const leaders = baca('components/core/LeadersTab.tsx');
  c('CORE: kedua nama boolean lamanya tetap',
    /const clOpen = isOpen\('cl'\);/.test(leaders) &&
      /const mtOpen = isOpen\('mt'\);/.test(leaders));

  const wheel = baca('app/wheel.tsx');
  c('Wheel: kedua bagiannya tetap dibaca lewat satu pintu',
    /open=\{isOpen\('focus'\)\}/.test(wheel) &&
      /open=\{isOpen\('score'\)\}/.test(wheel) &&
      /\{hasScores && isOpen\('focus'\) && \(/.test(wheel) &&
      /\{hasScores && isOpen\('score'\) && \(/.test(wheel));

  // Doa bulanan punya aturan TAMBAHAN yang tidak boleh hilang: kartu tanpa
  // poin SELALU terbuka, biar gampang langsung diisi.
  const doa = baca('app/monthly-prayers.tsx');
  c('Doa bulanan: kartu kosong tetap selalu terbuka',
    /const open = hasPoints \? kartuTerbuka\(l\.id\) : true;/.test(doa));

  const steps = baca('app/steps.tsx');
  c('Steps: tier dibaca lewat hook-nya', /const open = tierTerbuka\(t\.tier\);/.test(steps));
}

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);
