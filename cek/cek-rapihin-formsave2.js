// /rapihin 16 Sep 2026: lima layar/tab lagi memakai useFormSave. Yang dijaga:
// pesan gagalnya tetap bersama (SAVE_ERROR/DELETE_ERROR lewat hook), penjaga
// click-ganda tetap ada, dan tugas yang sengaja BUKAN lewat hook tidak ikut
// berubah perilakunya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const promise = baca('app/promise.tsx');
const sermon = baca('app/sermon.tsx');
const bible = baca('app/bible-reading.tsx');
const tasks = baca('app/tasks.tsx');
const turnamen = baca('components/games/TournamentTab.tsx');
const hook = baca('hooks/useFormSave.ts');

console.log('\n=== Hook bersamanya sendiri tidak disentuh ===');
ok('save → SAVE_ERROR, remove → DELETE_ERROR, busy selalu padam di finally',
  /const save = \(task: \(\) => Promise<void>\) => jalankan\(task, SAVE_ERROR\);/.test(hook) &&
  /const remove = \(task: \(\) => Promise<void>\) => jalankan\(task, DELETE_ERROR\);/.test(hook) &&
  /finally \{\s*\n\s*setBusy\(false\);/.test(hook) && /if \(busy\) return;/.test(hook));

console.log('\n=== Promise 🤝: simpan & hapus ===');
ok('memakai hook, tidak ada lagi useState busy/formError sendiri',
  /const \{ busy, formError, setFormError, save, remove \} = useFormSave\(\);/.test(promise) &&
  !/useState\(false\)[^\n]*busy|\[busy, setBusy\]|\[formError, setFormError\]/.test(promise));
ok('simpan lewat save(), lalu kembali', /await save\(async \(\) => \{\s*\n\s*await savePromise\([\s\S]{0,400}router\.back\(\);\s*\n\s*\}\);/.test(promise));
ok('hapus lewat remove() (pesannya "gagal menghapus"), dialog konfirmasi tetap ditutup apa pun hasilnya',
  /await remove\(async \(\) => \{\s*\n\s*await deletePromise\(user\.uid, editId\);\s*\n\s*router\.back\(\);\s*\n\s*\}\);\s*\n\s*setConfirmDelete\(false\);/.test(promise));
ok('validasi "tulis dulu janjinya" tetap sebelum simpan',
  /setFormError\('Tulis dulu janji Tuhan yang kamu pegang\.'\);\s*\n\s*return;/.test(promise));
// 16 Sep 2026: LOAD_ERROR pun pindah ke dalam useLive, jadi layar ini tidak
// mengimpor lib/messages sama sekali.
ok('SAVE_ERROR/DELETE_ERROR/LOAD_ERROR tak lagi diimpor (semua di dalam hook)',
  !/SAVE_ERROR|DELETE_ERROR|LOAD_ERROR/.test(promise) &&
  /useLive<HisPromise\[\]>\(subscribePromises, \{ onError: setError \}\)/.test(promise));

console.log('\n=== Sermon 🎙️: simpan lewat hook, hapus tetap ke ScreenError ===');
ok('memakai hook + setBusy-nya untuk hapus',
  /const \{ busy, setBusy, formError, setFormError, save \} = useFormSave\(\);/.test(sermon));
ok('simpan lewat save(); catatan baru tetap kembali ke daftar',
  /await save\(async \(\) => \{\s*\n\s*await saveSermon\([\s\S]{0,500}if \(mulaiKosong\) router\.back\(\);\s*\n\s*\}\);/.test(sermon));
ok('hapus TIDAK berubah: pesannya ke layar (setError DELETE_ERROR), busy padam di catch saja',
  /catch \{\s*\n\s*setError\(DELETE_ERROR\);\s*\n\s*setBusy\(false\);\s*\n\s*setConfirmDelete\(false\);/.test(sermon) &&
  !/SAVE_ERROR/.test(sermon));

console.log('\n=== Baca Alkitab 📖: simpan & lewati ===');
ok('memakai hook; pesan gagalnya tetap bernama `error` (JSX tidak disentuh)',
  /const \{ busy, formError: error, save \} = useFormSave\(\);/.test(bible) &&
  /<FormError message=\{error\} \/>/.test(bible) && !/setBusy|setError\(/.test(bible));
ok('simpan lewat save(): tulis bacaan → naikkan streak → ke arsip',
  /await save\(async \(\) => \{\s*\n\s*await saveBibleReading\([\s\S]{0,300}await bumpBibleStreaks\([\s\S]{0,1400}router\.replace\(\{\s*\n\s*pathname: '\/walk',\s*\n\s*params: \{ tab: 'bible', session \},\s*\n\s*\}\);\s*\n\s*\}\);/.test(bible));
ok('lewati lewat save() juga (pesannya memang SAVE_ERROR dulu)',
  /await save\(async \(\) => \{\s*\n\s*await saveBibleReading\(\s*\n\s*user\.uid,\s*\n\s*dayId,\s*\n\s*session,\s*\n\s*skipped \? '' : BIBLE_SKIPPED,\s*\n\s*\);\s*\n\s*if \(!skipped\) router\.back\(\);\s*\n\s*\}\);/.test(bible));
ok('LOAD_ERROR untuk saran tetap lewat useAsyncData', /useAsyncData\(muatSaran, LOAD_ERROR\)/.test(bible) && !/SAVE_ERROR/.test(bible));

console.log('\n=== Tasks ✅: sheet task ===');
ok('memakai hook + setBusy untuk hapus',
  /const \{ busy, setBusy, formError, setFormError, save \} = useFormSave\(\);/.test(tasks));
ok('simpan sheet lewat save(): baru → addTask, ubah → updateTask (pindah hari)',
  /await save\(async \(\) => \{\s*\n\s*if \(editing === 'new'\) \{\s*\n\s*await addTask\([\s\S]{0,300}setEditing\(null\);\s*\n\s*\}\);/.test(tasks));
ok('hapus task TIDAK berubah: tanpa catch, sheet selalu ditutup di finally',
  /async function handleDelete\(\) \{[\s\S]{0,120}setBusy\(true\);\s*\n\s*try \{\s*\n\s*await deleteTask\(user\.uid, editing\.id\);\s*\n\s*\} finally \{\s*\n\s*setEditing\(null\);\s*\n\s*setBusy\(false\);/.test(tasks));
ok('reminder berulang tetap pesan khususnya sendiri (rBusy/rError)',
  /setRError\('Gagal membuat reminder\. Cek koneksi internet\.'\);/.test(tasks) && /const \[rBusy, setRBusy\]/.test(tasks));
ok('pesan toggle/pindah tetap saveErrorOf & teks khusus', /saveErrorOf\('perubahan'\)/.test(tasks) && !/\bSAVE_ERROR\b/.test(tasks));

console.log('\n=== Turnamen 🏆: buat lewat hook, ubah & hapus tetap ===');
ok('memakai hook + setBusy untuk ubah/hapus',
  /const \{ busy, setBusy, formError, setFormError, save \} = useFormSave\(\);/.test(turnamen));
ok('buat turnamen lewat save(): simpan → tutup sheet → buka turnamennya',
  /await save\(async \(\) => \{\s*\n\s*const t = createTournament\([\s\S]{0,200}setCreateOpen\(false\);\s*\n\s*openTournament\(t\.id\);\s*\n\s*\}\);/.test(turnamen));
ok('ubah turnamen TIDAK berubah: pesannya ke editError',
  /catch \{\s*\n\s*setEditError\(SAVE_ERROR\);\s*\n\s*\} finally \{\s*\n\s*setBusy\(false\);/.test(turnamen));
ok('hapus turnamen TIDAK berubah: pesannya ke layar (DELETE_ERROR)',
  /catch \{\s*\n\s*setError\(DELETE_ERROR\);\s*\n\s*\} finally \{\s*\n\s*setBusy\(false\);/.test(turnamen));

console.log('\n=== Aturan wajib ===');
const semua = promise + sermon + bible + tasks + turnamen;
ok('tidak ada soft-delete yang diselundupkan', !/isDeleted|archived: true/.test(semua));
ok('hapus tetap PERMANEN (deletePromise / deleteSermon / deleteTask / deleteTournament dipanggil)',
  /await deletePromise\(/.test(promise) && /await deleteSermon\(/.test(sermon) &&
  /await deleteTask\(/.test(tasks) && /deleteTournament\(/.test(turnamen));
ok('tidak ada blok busy/try/catch manual yang tersisa untuk SAVE_ERROR di kelima berkas',
  !/setFormError\(SAVE_ERROR\)|setError\(SAVE_ERROR\)/.test(promise + sermon + bible + tasks));

console.log(gagal === 0 ? '\n✅ LULUS — lima berkas pindah ke useFormSave, perilaku sama.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
