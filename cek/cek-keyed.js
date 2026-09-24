// Batch /rapihin: useKeyedData — "kosongkan lalu langganan ulang saat kunci
// berubah" dipindah dari efek ke turunan render.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const hook = baca('hooks/useKeyedData.ts');
const timeline = baca('app/timeline.tsx');
const wheel = baca('app/wheel.tsx');
const fund = baca('app/saku/[key].tsx');

console.log('\nHook bersama');
ok('kunci disimpan BERSAMA datanya', /useState<\{ key: K; value: T \} \| null>\(null\)/.test(hook));
ok('"kosong atau tidak" DITURUNKAN saat render, bukan lewat efek',
  /const data = held !== null && held\.key === key \? held\.value : null;/.test(hook));
ok('penerima snapshot ikut membawa kuncinya (jawaban basi tak lolos)',
  /useCallback\(\(value: T\) => setHeld\(\{ key, value \}\), \[key\]\)/.test(hook));

console.log('\nKetiga layar memakainya');
for (const [nama, src, tipe] of [
  // Kunci Timeline sekarang memuat PEMILIKNYA juga (aku / id CORE Leader) —
  // alasannya sama persis dengan Wheel di bawah.
  ['Timeline (ganti tahun & ganti orang)', timeline,
    'useKeyedData<string, TimelineItem\\[\\]>\\(\\s*`\\$\\{owner \\?\\? \'me\'\\}/\\$\\{year\\}`,?\\s*\\)'],
  // Kunci Wheel sekarang memuat PEMILIKNYA juga (aku / id CORE Leader),
  // supaya skor CL A tak pernah sempat terlihat di layar CL B.
  ['Wheel (ganti kuartal & ganti orang)', wheel,
    'useKeyedData<string, WheelData>\\(\\s*`\\$\\{owner \\?\\? \'me\'\\}/\\$\\{qid\\}`,?\\s*\\)'],
  ['Saku (ganti dompet)', fund, 'useKeyedData<string, FundEntry\\[\\]>\\(key\\)'],
]) {
  ok(nama, new RegExp(tipe).test(src));
}

console.log('\nsetState di dalam efek sudah hilang');
ok('Timeline tidak lagi setItems(null) di efek', !/setItems\(null\)/.test(timeline));
ok('Wheel tidak lagi setData(null) di efek', !/setData\(null\);/.test(wheel));
ok('Saku tidak lagi punya setLoading sama sekali', !/setLoading/.test(fund));
ok('…dan loading-nya diturunkan',
  /const loading = loaded === null && error === null;/.test(fund));

console.log('\nPerilaku tetap sama');
ok('Timeline: loading tetap ditandai items === null',
  /items === null/.test(timeline) || /items\?\./.test(timeline));
ok('Saku: spinner masih dipasang di tempat yang sama',
  /\{loading \? \(/.test(fund));
// 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).
// Setter berkuncinya ikut deps: kunci ganti → setter baru → langganan dipasang ulang.
ok('langganan tetap dilepas saat pindah (useLiveAll melepasnya; setter berkunci ikut deps)',
  /subscribeTimelineYear\(/.test(timeline) && /deps: \[year, owner, setItems\], when: unlocked/.test(timeline) &&
  /subscribeWheel\(/.test(wheel) && /deps: \[qid, owner, setData\], when: unlocked/.test(wheel) &&
  /subscribeFundEntries\(/.test(fund) && /deps: \[key, setEntries\], when: !!key/.test(fund));
ok('daftar kosong memakai konstanta TETAP (useMemo tidak terhitung ulang)',
  /const NO_ENTRIES: FundEntry\[\] = \[\];/.test(fund) &&
  /const entries = loaded \?\? NO_ENTRIES;/.test(fund));

console.log('\nBug yang ikut tertutup');
ok('Saku: saldo TIDAK lagi ditimpa 0 saat pemuatan gagal',
  /if \(!user \|\| !key \|\| loaded === null\) return;\s*\n\s*reconcileFundBalance/.test(fund) &&
  !/!user \|\| !key \|\| loading\) return;\s*\n\s*reconcileFundBalance/.test(fund));

console.log(gagal === 0
  ? '\n✅ LULUS — useKeyedData terbukti, perilaku sama.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
