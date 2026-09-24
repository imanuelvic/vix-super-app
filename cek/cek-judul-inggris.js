// 23 Sep 2026 (malam) — permintaan pemilik:
//   1. "Semua Pengingat" jadi "All Reminder", tanggalnya tidak boleh terpotong
//   2. SEMUA judul layar & sub-tab berbahasa Inggris, ISINYA tetap Indonesia
//   3. Judul & label kolom: Huruf Besar Tiap Kata + lambang di depannya
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

const berkas = [];
(function sisir(rel) {
  for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const anak = rel + '/' + e.name;
    if (e.isDirectory()) sisir(anak);
    else if (/\.tsx$/.test(e.name)) berkas.push(anak);
  }
})('app');
(function sisir(rel) {
  for (const e of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
    const anak = rel + '/' + e.name;
    if (e.isDirectory()) sisir(anak);
    else if (/\.tsx$/.test(e.name)) berkas.push(anak);
  }
})('components');

const lambangDepan = (t) => {
  const cp = [...t][0]?.codePointAt(0) ?? 0;
  return (
    (cp >= 0x231a && cp <= 0x23ff) ||
    (cp >= 0x1f000 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0x2b00 && cp <= 0x2bff)
  );
};
// Kata sambung yang memang tetap huruf kecil di tengah judul, seperti bahasa
// Inggris membiarkan "of"/"the": ini judul, bukan kalimat.
const SAMBUNG = new Set(['di', 'ke', 'dari', 'dan', 'atau', 'yang', 'per', 'untuk', 'pada', 'by', 'in', 'to', 'of']);
/** Huruf Besar Tiap Kata, dengan kelonggaran yang memang disengaja. */
function besarTiapKata(teks) {
  const kepala = teks
    .split(',')[0]
    .replace(/\{[^}]*\}/g, '') // bagian yang diisi data
    .replace(/\([^)]*\)/g, '') // keterangan dalam kurung
    .replace(/^[^\p{L}]+/u, '');
  return kepala
    .split(/[\s/·]+/)
    .filter((k) => /\p{L}/u.test(k))
    .every((k, i) =>
      // Kata sambung di tengah boleh kecil; satuan (kWh, km) dikenali dari
      // huruf besar di dalamnya.
      (SAMBUNG.has(k.toLowerCase()) && i > 0) || /\p{Lu}/u.test(k.replace(/^[^\p{L}]*/u, '')[0] ?? '') || /\p{Lu}/u.test(k),
    );
}
// Kata Indonesia yang tidak boleh lagi muncul di JUDUL (isinya tetap boleh).
const KATA_ID = /\b(semua|tambah|ubah|hapus|catat|catatan|pilih|kirim|bagikan|jadwal|riwayat|arsip|pokok|langkah|kaki|pinjaman|multiplikasi|pedoman|pembelian|rekap|gunung|darah|kesehatan|pemeriksaan|kalender|orang|acara|keterangan|dilewati|olahraga|minggu|bulanan|turnamen|profil|mutasi|visitasi|khotbah|diskusi|urutan)\b/i;

console.log('\n=== 1. All Reminder: judul & tanggalnya ===');
{
  const r = baca('app/reminders.tsx');
  // Komentar kode boleh menyebut nama lamanya (itu sejarahnya); yang dijaga
  // TULISAN yang tampil.
  const tampil = r.replace(/^\s*\/\/.*$/gm, '');
  ok('judulnya "All Reminder 📊"', /All Reminder 📊/.test(tampil) && !/Semua Pengingat/.test(tampil));
  ok('tanggalnya tidak bisa terpotong lagi (judul mengalah, tanggal tidak)',
    /headerTitle: \{ color: Color\.MAIN, flexShrink: 1 \}/.test(r) &&
    /headerDate: \{ color: Color\.TEXT_LABEL, flexShrink: 0/.test(r) &&
    /numberOfLines=\{1\}\s*\n\s*adjustsFontSizeToFit/.test(r));
  ok('tanggalnya tetap ada di kepala layar', /📆 \{formatShortDayDate\(new Date\(\)\)\}/.test(r));
}

console.log('\n=== 2. Judul layar & sheet: Inggris ===');
{
  const sisa = [];
  for (const f of berkas) {
    const isi = baca(f);
    const re = /(^|[^a-zA-Z])title="([^"{]+)"/g;
    let m;
    while ((m = re.exec(isi))) {
      const t = m[2];
      if (t.endsWith('?')) continue; // pertanyaan konfirmasi = kalimat, bukan judul
      if (KATA_ID.test(t)) sisa.push(`${f} :: ${t}`);
    }
  }
  ok('tak ada judul layar/sheet yang masih berbahasa Indonesia', sisa.length === 0, sisa.slice(0, 6).join(' · '));
  ok('judul layar tetap berlambang di BELAKANG (bentuk versi 2.0)',
    /title="Work 💼"/.test(baca('app/(tabs)/work.tsx')) && /title="Reward 🏆"/.test(baca('app/reward.tsx')));
  ok('beberapa judul yang diterjemahkan memang sudah dipakai',
    /title="Day by Day 🍽️"/.test(baca('app/fasting-days.tsx')) &&
    /title="Blood Donor 🩸"/.test(baca('app/donor.tsx')) &&
    /title="Visitation Recap 📊"/.test(baca('app/core-recap.tsx')) &&
    /title="Monthly Prayer 🙏"/.test(baca('app/monthly-prayers.tsx')));
  ok('pertanyaan konfirmasi SENGAJA tetap Indonesia (itu kalimat, bukan judul)',
    /title="Hapus janji ini\?"/.test(baca('app/promise.tsx')));
}

console.log('\n=== 3. Sub-tab: semuanya Inggris ===');
{
  const sisa = [];
  for (const f of berkas) {
    const isi = baca(f);
    const re = /label: '([^']+)', icon:/g;
    let m;
    while ((m = re.exec(isi))) if (KATA_ID.test(m[1])) sisa.push(`${f} :: ${m[1]}`);
  }
  ok('tak ada label sub-tab berbahasa Indonesia', sisa.length === 0, sisa.join(' · '));
  ok('sub-tab CORE & Work memang bahasa Inggris',
    /label: 'Visitation'/.test(baca('app/(tabs)/core.tsx')) &&
    /label: 'Follow Up'/.test(baca('app/(tabs)/core.tsx')) &&
    /label: 'Fulltime'/.test(baca('app/(tabs)/work.tsx')));
}

console.log('\n=== 4. Label kolom: Huruf Besar + lambang di depan ===');
{
  const sisa = [];
  for (const f of berkas) {
    const isi = baca(f);
    for (const re of [
      /additionalStyle=\{styles\.fieldLabel\}>\s*([^\s<{][^<]*?)\s*<\/VixText>/g,
      /<JourneyFieldLabel>\s*([^\s<{][^<]*?)\s*<\/JourneyFieldLabel>/g,
    ]) {
      let m;
      while ((m = re.exec(isi))) {
        const t = m[1].replace(/\s+/g, ' ').trim();
        // Kalimat panjang (pertanyaan jurnal pagi) memang bukan label.
        if (t.split(/\s+/).length > 6) continue;
        if (!lambangDepan(t) || !besarTiapKata(t)) sisa.push(`${f} :: ${t}`);
      }
    }
  }
  ok('tiap label kolom berlambang di depan & Huruf Besar Tiap Kata', sisa.length === 0, sisa.slice(0, 8).join(' · '));
  ok('contoh yang diminta pemilik memang sudah begitu',
    /📆 Tanggal Visitasi/.test(baca('components/core/VisitationFormFields.tsx')) &&
    /📖 Bacaan Alkitab/.test(baca('app/revive.tsx')) &&
    /💡 Ide Pendekatan/.test(baca('components/core/FollowupTab.tsx')));
  ok('label kolom Profile ikut berlambang',
    /label: '🎂 Tanggal Lahir'/.test(baca('app/profile.tsx')) &&
    /label: '📱 No\. HP'/.test(baca('app/profile.tsx')));
}

console.log('\n=== 5. ISINYA tetap bahasa Indonesia ===');
{
  ok('keterangan di bawah judul layar tetap Indonesia',
    /subtitle="Kerjakan segenap hati, hasilnya menyusul"/.test(baca('app/(tabs)/work.tsx')) &&
    /subtitle="Gembalakan & muridkan CORE Leader-mu"/.test(baca('app/(tabs)/core.tsx')));
  ok('kalimat di dalam layar tetap Indonesia',
    /Belum ada hadiah\./.test(baca('app/reward.tsx')));
  ok('pengingat HP tetap Indonesia', /Sebelum yang lain ramai/.test(baca('lib/notifyCopy.ts')));
}

console.log(gagal === 0 ? '\n✅ LULUS — judul Inggris, isi Indonesia.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
