// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// 21 Sep 2026: Morning Journey 🌅 menggantikan gerbang doa pagi berbentuk
// daftar centang. Tujuh langkah satu per satu (Arrive → Receive → Reflect →
// Respond → Worship → Pray → Close), tanpa centang, tanpa hitungan "N/7",
// worship boleh dilewati. Isiannya MENUMPANG di data yang sudah ada: Revive
// hari ini (judul, bacaan, rhema, aplikasi, + respons hati & doa pagi) dan
// 📓 Daily Reflection Journal di Habits. Jadwal Doa Syafaat & Doa Rantai
// TIDAK berubah. Kunci pagi (sampai 09.00) & streak 🙏 tetap, kopinya lembut.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-morning-journey');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Dijalankan sungguhan: lib/journey + lib/spiritual ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/journey.ts'), path.join(ROOT, 'lib/spiritual.ts'),
      path.join(ROOT, 'lib/core.ts'), path.join(ROOT, 'lib/format.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// Firestore tiruan: setDoc dicatat, liveDoc menyerahkan callback-nya.
const tulis = [];
const langgananDoc = [];
class Timestamp {
  constructor(d) { this.d = d; }
  static fromDate(d) { return new Timestamp(d); }
  static now() { return new Timestamp(new Date(0)); }
  toDate() { return this.d; }
  toMillis() { return this.d.getTime(); }
}
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return new Proxy({
      Timestamp,
      doc: (_db, ...segs) => ({ path: segs.join('/') }),
      setDoc: async (ref, data, opsi) => { tulis.push({ path: ref.path, data, opsi }); },
    }, { get: (t, k) => (k in t ? t[k] : () => ({})) });
  }
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return {
    liveDoc: (ref, cb) => { langgananDoc.push({ ref, cb }); return () => {}; },
    liveList: () => () => {},
  };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req === './family') return { OWNER_NAME: 'Imanuel Victory Rumayar' };
  if (req === './linking') return { openExternalUrl: async () => undefined };
  if (req === './health') return { dayDocId: (d) => d.toISOString().slice(0, 10), yesterdayId: () => '2026-09-20' };
  if (req === './streak') return { alreadyCounted: () => false, nextStreak: (c, t) => ({ count: 1, lastDayId: t, best: 1, total: 1 }), EMPTY_DAY_STREAK: { count: 0, lastDayId: '', best: 0, total: 0 } };
  if (req === './daypart') return { DAYPART: { morning: '🌅', daytime: '🌤️', night: '🌙' } };
  if (req === './bible') return new Proxy({}, { get: () => () => '' });
  return asli(req, parent, isMain);
};
const J = require(path.join(OUT, 'journey.js'));
const S = require(path.join(OUT, 'spiritual.js'));
Module._load = asli;

console.log('\n=== lib/journey: tujuh langkah, tanpa angka ===');
ok('urutan: arrive → receive → reflect → respond → worship → pray → close',
  J.JOURNEY_STEPS.map((s) => s.key).join(',') === 'arrive,receive,reflect,respond,worship,pray,close');
ok('judul tiap langkah sesuai konsep',
  J.journeyStepMeta('arrive').title === 'Aku hadir' &&
  J.journeyStepMeta('receive').title === 'Apa yang Tuhan mau sampaikan?' &&
  J.journeyStepMeta('reflect').title === 'Apa yang sedang terjadi dalam diriku?' &&
  J.journeyStepMeta('respond').title === 'Apa yang ingin aku bawa hari ini?' &&
  J.journeyStepMeta('worship').title === 'Mau tinggal bersama Tuhan sebentar?' &&
  J.journeyStepMeta('pray').title === 'Apa yang ingin kamu doakan?' &&
  J.journeyStepMeta('close').title === 'Aku menyerahkan hari ini');
ok('sapaan memakai nama depan pemilik', J.JOURNEY_NAME === 'Imanuel');
ok('prompt refleksi: tiga dari permintaan + senada, satu per hari & tetap sepanjang hari',
  J.REFLECT_PROMPTS.includes('Apa yang sedang kamu syukuri hari ini?') &&
  J.REFLECT_PROMPTS.includes('Apa yang sedang kamu takutkan dan ingin kamu serahkan kepada Tuhan?') &&
  J.REFLECT_PROMPTS.includes('Apa yang Tuhan mungkin sedang ajarkan kepadamu melalui keadaanmu saat ini?') &&
  J.reflectPromptOfDay('2026-09-21') === J.reflectPromptOfDay('2026-09-21') &&
  new Set(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].map(J.reflectPromptOfDay)).size >= 2);
// 22 Sep 2026: Bersyukur = 💚 (hati hijau), bukan ❤️ yang sudah dipakai jejak Respond.
ok('chip respons: 💚 Bersyukur · 🕊️ Menyerahkan · 💪 Berani melangkah · 🤝 Mengampuni · 🌱 Bertumbuh',
  J.RESPONSE_OPTIONS.map((o) => `${o.emoji} ${o.label}`).join(' · ') ===
    '💚 Bersyukur · 🕊️ Menyerahkan · 💪 Berani melangkah · 🤝 Mengampuni · 🌱 Bertumbuh' &&
  J.responsesLine(['grateful', 'grow']) === '💚 Bersyukur · 🌱 Bertumbuh' && J.responsesLine(undefined) === '');
ok('chip Bersyukur tidak kembar dengan lambang langkah Respond (❤️)',
  J.RESPONSE_OPTIONS.every((o) => o.emoji !== J.JOURNEY_STEPS.find((s) => s.key === 'respond').emoji));
ok('lagu worship: ≥ 20, satu per hari, tautan pencarian YouTube (bukan id video)',
  J.WORSHIP_SONGS.length >= 20 && J.worshipSongOfDay('2026-09-21') === J.worshipSongOfDay('2026-09-21') &&
  /^https:\/\/www\.youtube\.com\/results\?search_query=/.test(J.worshipSongUrl(J.worshipSongOfDay('2026-09-21'))));
ok('penutup: Bapa Kami utuh & kalimat "🌤️ Kamu sudah memulai harimu bersama Tuhan."',
  /^Bapa kami yang di sorga,/.test(J.BAPA_KAMI) && /Amin\.$/.test(J.BAPA_KAMI) &&
  J.JOURNEY_CLOSING === '🌤️ Kamu sudah memulai harimu bersama Tuhan.');

console.log('\n=== lib/spiritual: isian journey menumpang di Revive ===');
ok('reviveWritten = keempat kolom wajib editor terisi',
  S.reviveWritten({ title: 'A', passage: 'Yoh 3', rhema: 'x', reflection: 'y' }) &&
  !S.reviveWritten({ title: '', passage: 'Yoh 3', rhema: 'x', reflection: 'y' }) &&
  !S.reviveWritten({ title: 'A', passage: 'Yoh 3', rhema: 'x', reflection: '  ' }));
tulis.length = 0;
S.saveJourneyFields('u', '2026-09-21', null, { rhema: 'Firman-Nya' }, new Date(2026, 8, 21, 6));
ok('belum ada dokumen → dibuat LENGKAP dengan kolom kosong + date (ikut daftar Revive)',
  tulis.length === 1 && tulis[0].path === 'users/u/revive/2026-09-21' && tulis[0].opsi === undefined &&
  tulis[0].data.title === '' && tulis[0].data.passage === '' && tulis[0].data.verse === '' &&
  tulis[0].data.reflection === '' && tulis[0].data.prayer === '' && JSON.stringify(tulis[0].data.responses) === '[]' &&
  tulis[0].data.rhema === 'Firman-Nya' && tulis[0].data.date instanceof Timestamp, JSON.stringify(tulis[0]));
tulis.length = 0;
S.saveJourneyFields('u', '2026-09-21', { id: '2026-09-21', title: 'Ada' }, { prayer: 'Tolong aku' }, new Date());
ok('sudah ada → merge kolom yang dikirim saja (judul & isian lain tak tersentuh, date tak digeser)',
  tulis.length === 1 && JSON.stringify(tulis[0].data) === '{"prayer":"Tolong aku"}' && tulis[0].opsi?.merge === true);
tulis.length = 0;
S.saveReviveEntry('u', '2026-09-21', { title: 'A', passage: 'B', verse: '', rhema: 'C', reflection: 'D', date: new Date() });
ok('editor Revive menyimpan dengan merge → respons hati & doa pagi tidak terhapus',
  tulis[0].opsi?.merge === true && tulis[0].data.title === 'A');
langgananDoc.length = 0;
let terbaca;
S.subscribeReviveEntry('u', '2026-09-21', (e) => { terbaca = e; });
langgananDoc[0].cb({ exists: () => true, id: '2026-09-21', data: () => ({ prayer: 'Doa' }) });
ok('dokumen yang cuma berisi isian journey dibaca dengan semua kolom teks PASTI string',
  terbaca.title === '' && terbaca.passage === '' && terbaca.rhema === '' && terbaca.reflection === '' &&
  terbaca.prayer === 'Doa' && JSON.stringify(terbaca.responses) === '[]' && typeof terbaca.date.toDate === 'function');
langgananDoc[0].cb({ exists: () => false, id: '2026-09-21', data: () => undefined });
ok('belum ada dokumen → null', terbaca === null);

console.log('\n=== Layar: satu langkah pada satu waktu, tanpa centang ===');
const layar = baca('components/spiritual/MorningJourney.tsx');
const steps = baca('components/spiritual/journey/JourneySteps.tsx');
const kartu = baca('components/spiritual/journey/JourneyCard.tsx');
const trail = baca('components/spiritual/journey/JourneyTrail.tsx');
const rute = baca('app/morning-journey.tsx');
ok('gerbang lama sudah tidak ada & tak ada yang menunjuknya',
  !fs.existsSync(path.join(ROOT, 'components/spiritual/MorningPrayerGate.tsx')) &&
  !/MorningPrayerGate/.test(rute + baca('app/_layout.tsx')));
// 22 Sep 2026 (versi 2.0): gerbang pagi jadi LUNAK — diundang otomatis sekali
// per hari (AsyncStorage gate:shown), "Nanti dulu" tanpa hukuman, journey
// tetap bisa dijalani sesudah 09.00; yang menutup layarnya cuma "sudah
// dijalani hari ini". featureTheme tetap.
ok('gerbang lunak: undangan otomatis sekali per hari, push (bukan replace), keluar hanya kalau sudah dijalani',
  /<Stack\.Screen name="morning-journey" \/>/.test(baca('app/_layout.tsx')) &&
  /const GATE_SHOWN_KEY = 'gate:shown';/.test(baca('components/spiritual/MorningJourneyGate.tsx')) &&
  /if \(atGate \|\| shownDay\.current === todayId\) return;/.test(baca('components/spiritual/MorningJourneyGate.tsx')) &&
  /router\.push\(GATE_PATH\);/.test(baca('components/spiritual/MorningJourneyGate.tsx')) &&
  /if \(atGate && prayerDoneToday\(login, now\)\) router\.replace\('\/'\);/.test(baca('components/spiritual/MorningJourneyGate.tsx')) &&
  /if \(prayerDoneToday\(login, now\)\) \{\s*return <Redirect href="\/" \/>;/.test(rute) &&
  /onLater=\{handleLater\}/.test(rute) &&
  /'morning-journey': 'spiritual',/.test(baca('lib/featureTheme.ts')));
ok('"Nanti dulu" ada di kaki journey; "Lewati" hanya selagi jendela pagi terbuka',
  /<PressableScale style=\{styles\.skipButton\} onPress=\{onLater\}>/.test(layar) &&
  /\{stillOpen && \(\s*<PressableScale\s+style=\{styles\.skipButton\}\s+onPress=\{\(\) => setSkipConfirm\(true\)\}>/.test(layar));
ok('ketujuh langkah dirender lewat step === …, key={step} supaya kartunya lahir baru',
  ['arrive', 'receive', 'reflect', 'respond', 'worship', 'pray'].every((k) => new RegExp(`step === '${k}' \\? \\(`).test(layar)) &&
  /<CloseStep onConfirm=\{handleConfirm\} busy=\{busy\} \/>/.test(layar) && /<View key=\{step\}>/.test(layar));
ok('jejak 🌅→📖→💭→❤️→🎵→🙏→🌤️ tanpa angka; yang sudah dilalui bisa di-click untuk kembali',
  /<JourneyTrail current=\{step\} onJump=\{setStep\} \/>/.test(layar) &&
  /disabled=\{!passed\}/.test(trail) && /emojiFuture: \{ opacity: 0\.35 \}/.test(trail) &&
  // (komentar penjelas boleh menyebut "3/7"; kodenya yang tidak boleh)
  !/\d+\s*\/\s*\d+|%/.test(trail.replace(/^\s*(\/\/|\*|\/\*\*).*$/gm, '')));
ok('TIDAK ada CheckCircle, "completed", "Selesaikan N langkah", atau persen di journey',
  !/CheckCircle|completed|Selesaikan \{|\d+%/.test(layar + steps + kartu + trail));
ok('kartu peringatan oranye hitung mundur dihapus; sisa waktu jadi satu baris tenang, hanya ≤ 60 menit',
  !/warnCard|Color\.ACCENT/.test(layar) &&
  /const closingSoon = minutesLeft > 0 && minutesLeft <= 60;/.test(layar) &&
  /\{closingSoon && \(\s*<VixText heading="label" additionalStyle=\{styles\.footerText\}>\s*Jendela pagi ini tersisa \{minutesLeft\} menit\./.test(layar));
ok('lewati: kalimat tenang + dialog TIDAK merah, tanpa kata "hangus"; skipDailyPrayer tetap yang dipanggil',
  /Pagi ini tidak memungkinkan\? Lewati untuk hari ini/.test(layar) && /danger=\{false\}/.test(layar) &&
  !/hangus/.test(layar + steps) && /skipDailyPrayer\(user\.uid, login, new Date\(\)\)/.test(rute));
ok('"Mulai Hariku" = recordDailyPrayer + markPrayerHandled + ke Home (streak 🙏 & Reward tak berubah)',
  /<JourneyNext label="Mulai Hariku" onPress=\{onConfirm\} busy=\{busy\} \/>/.test(steps) &&
  /markPrayerHandled\(new Date\(\)\);\s*if \(user\) \{\s*recordDailyPrayer\(user\.uid, login, new Date\(\)\)/.test(rute) &&
  /router\.replace\('\/'\)/.test(rute));
ok('lagu, prompt, ayat, & reminder dibekukan sekali seumur layar',
  /const \[song\] = useState\(\(\) => worshipSongOfDay\(todayId\)\);/.test(layar) &&
  /const \[prompt\] = useState\(\(\) => reflectPromptOfDay\(todayId\)\);/.test(layar) &&
  /const \[passage\] = useState\(\(\) => worshipPassageOfDay\(todayId\)\);/.test(layar) &&
  /const \[reminder\] = useState\(\(\) => dailyReminder\(todayId\)\);/.test(layar));
ok('keyboard iOS tidak menutupi isian (KeyboardAvoidingView + keyboardShouldPersistTaps)',
  /<KeyboardAvoidingView\s+style=\{styles\.flex\}\s+behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}>/.test(layar) &&
  /keyboardShouldPersistTaps="handled"/.test(layar));
ok('tepi: edges top + paddingTop 4 + paddingBottom 40, latar SPIRITUAL_DARK (gaya fitur yang sama)',
  /edges=\{\['top'\]\}/.test(layar) && /content: \{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 \}/.test(layar) &&
  /safe: \{ flex: 1, backgroundColor: Color\.SPIRITUAL_DARK \}/.test(layar));

console.log('\n=== Kata-kata tiap langkah (sesuai konsep) ===');
ok('🌅 Arrive: "Selamat pagi, Imanuel." + tenangkan hati + CTA "Aku siap"',
  /Selamat pagi, \{JOURNEY_NAME\}\./.test(steps) && /Sebelum memulai harimu, mari tenangkan hati sejenak/.test(steps) &&
  /<JourneyNext label="Aku siap" onPress=\{onNext\} \/>/.test(steps));
ok('📖 Receive: renungan Revive (SpiritualIntro: reminder + NDC) + "Apa yang paling berbicara kepadamu pagi ini?" + Lanjut',
  /<SpiritualIntro reminder=\{reminder\} \/>/.test(steps) && /Apa yang paling berbicara kepadamu pagi ini\?/.test(steps) &&
  /onSave\(\{ title: title\.trim\(\), passage: passage\.trim\(\), rhema: rhema\.trim\(\) \}\)/.test(steps));
ok('💭 Reflect: prompt harian + isian → 📓 jurnal Habits; tanpa baris = renungkan dalam hati, tetap bisa Lanjut',
  /<JourneyQuestion>\{prompt\}<\/JourneyQuestion>/.test(steps) && /if \(!bisaTulis\) return onNext\(\);/.test(steps) &&
  /tambahkan\s*\n?\s*baris 📓 Daily Reflection Journal di Habits/.test(steps));
ok('❤️ Respond: Chip pilih-banyak dari RESPONSE_OPTIONS + "satu hal yang ingin kamu bawa" → aplikasi Revive',
  /RESPONSE_OPTIONS\.map\(\(o\) => \(\s*<Chip/.test(steps) &&
  /cur\.includes\(key\) \? cur\.filter\(\(k\) => k !== key\) : \[\.\.\.cur, key\]/.test(steps) &&
  /apa satu hal yang ingin kamu bawa ke\s*\n?\s*dalam harimu\?/.test(steps) &&
  /onSave\(\{ responses, reflection: carry\.trim\(\) \}\)/.test(steps));
ok('🎵 Worship: satu lagu + "Mulai Worship" + "Skip untuk sekarang", tanpa centang',
  /\{song\.title\}/.test(steps) && /\{song\.artist\}/.test(steps) &&
  /<JourneyNext label="Mulai Worship" onPress=\{mulai\} \/>/.test(steps) &&
  /<JourneyLink label="Skip untuk sekarang" onPress=\{onNext\} \/>/.test(steps));
ok('🙏 Pray: Doa Syafaat hari ini TETAP (topik + poin), Doa Rantai CL tetap (WA + ✅ dari data), + doa pribadi → "Berdoa"',
  /Doa Syafaat · \{topic\.emoji\} \{topic\.label\}/.test(steps) && /\{topic\.points\.map\(\(p\) => \(/.test(steps) &&
  /💬 Doakan lewat WhatsApp/.test(steps) && /\{l\.done \? '✅ ' : ''\}/.test(steps) &&
  /Hal apa yang ingin kamu serahkan kepada Tuhan pagi ini\?/.test(steps) &&
  /onSave\(\{ prayer: prayer\.trim\(\) \}\)/.test(steps) && /<JourneyNext label="Berdoa"/.test(steps));
ok('Doa Rantai tidak lagi menahan penutup: chainLeft cuma jadi keterangan lembut',
  /Masih ada \$\{chainLeft\} CORE Leader yang menunggu didoakan pagi ini\./.test(steps) &&
  !/chainLeft === 0 &&|const chainDone|chainDone &&/.test(layar + steps));
ok('🌤️ Close: Bapa Kami + penutup + "Mulai Hariku"',
  /\{BAPA_KAMI\}/.test(steps) && /\{JOURNEY_CLOSING\}/.test(steps));

console.log('\n=== Data: reuse, tanpa koleksi baru ===');
ok('tidak ada koleksi baru: tak ada collection/doc "journey" di Firestore',
  !/'journey'/.test(baca('lib/spiritual.ts') + baca('lib/journey.ts') + rute));
ok('rute melanggan Revive hari ini (satu dokumen), jadwal kebiasaan, & ceklis hari ini',
  /subscribeReviveEntry\(uid, todayId, setEntry\)/.test(rute) &&
  /subscribeHabitSchedule\(uid, setHabits\)/.test(rute) &&
  /subscribeHabitDay\(uid, todayId, setDay\)/.test(rute));
ok('Receive/Respond/Pray → saveJourneyFields; Revive jadi utuh → bumpReviveStreak (seperti editor)',
  /await saveJourneyFields\(user\.uid, todayId, current, fields, new Date\(\)\);/.test(rute) &&
  /if \(reviveWritten\(gabung\)\) \{\s*await bumpReviveStreak\(user\.uid, reviveStreak, todayId\);/.test(rute));
ok('Reflect → setHabitNote pada baris 📓 (isReflectionJournal), sama dengan Home & Habits',
  /const journalHabit = habits\?\.find\(isReflectionJournal\) \?\? null;/.test(rute) &&
  /await setHabitNote\(user\.uid, todayId, journalHabit\.id, text\);/.test(rute));
ok('tipe ReviveEntry punya responses?: string[] & prayer?: string',
  /responses\?: string\[\];/.test(baca('lib/spiritual.ts')) && /prayer\?: string;/.test(baca('lib/spiritual.ts')));

console.log('\n=== Pembaca Revive ikut mengerti dokumen yang belum utuh ===');
const spiritual = baca('app/(tabs)/walk.tsx');
const revive = baca('app/revive.tsx');
ok('Spiritual: "Revive hari ini" & perbaikan streak hanya menghitung Revive UTUH',
  /entries\?\.find\(\(e\) => e\.id === todayId && reviveWritten\(e\)\) \?\? null/.test(spiritual) &&
  /entries\.filter\(reviveWritten\)\.map\(\(e\) => e\.id\)/.test(spiritual));
ok('editor Revive: dokumen belum utuh tidak dikunci arsip; blok ❤️ Respons hati & 🙏 Doa pagi tampil (baca saja)',
  /const arsip = exists && reviveWritten\(entry\) && targetDay !== todayId;/.test(revive) &&
  /<BacaBlok label="❤️ Respons hati" text=\{responsesLine\(entry\.responses\)\} \/>/.test(revive) &&
  /<BacaBlok label="🙏 Doa pagi" text=\{entry\.prayer \?\? ''\} \/>/.test(revive) &&
  (revive.match(/<JourneyBlocks entry=\{entry\} \/>/g) ?? []).length === 2);
ok('riwayat Revive: hari yang cuma berisi journey tetap tampil ("🌤️ Morning Journey"), doa ikut dicari',
  /\{e\.title \|\| '🌤️ Morning Journey'\}/.test(baca('app/revive-history.tsx')) &&
  /\$\{e\.prayer \?\? ''\}/.test(baca('app/revive-history.tsx')));

console.log('\n=== Riwayat Morning Journey ===');
const riwayat = baca('app/journey-history.tsx');
ok('kartu "🌤️ Morning Journey" di sub-tab Revive → /journey-history; rute & tema terdaftar',
  /🌤️ Morning Journey/.test(spiritual) && /router\.push\('\/journey-history'\)/.test(spiritual) &&
  /<Stack\.Screen name="journey-history" \/>/.test(baca('app/_layout.tsx')) &&
  /'journey-history': 'spiritual',/.test(baca('lib/featureTheme.ts')) &&
  /journey-history/.test(baca('.expo/types/router.d.ts')));
ok('layar riwayat menjahit Revive + catatan jurnal per hari, hanya hari yang ada isinya, terbaru dulu, bisa dicari',
  /subscribeReviveEntries\(uid, setEntries, fail\)/.test(riwayat) &&
  /subscribeHabitNotes\(uid, journalId \?\? '', setNotes, fail, 90\)/.test(riwayat) &&
  /when: journalId !== null/.test(riwayat) &&
  /\.filter\(adaIsi\)/.test(riwayat) && /b\.dayId\.localeCompare\(a\.dayId\)/.test(riwayat) &&
  /<SearchBar/.test(riwayat) && /usePagination\(semua\)/.test(riwayat));
ok('click satu hari → Revive hari itu', /pathname: '\/revive', params: \{ day: d\.dayId \}/.test(riwayat));

console.log('\n=== Istilah ===');
const semuaBaru = [layar, steps, kartu, trail, rute, riwayat, baca('lib/journey.ts')].join('\n');
ok('tanpa tekan/ketuk/tap/klik', !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik)\b/i.test(semuaBaru));
ok('tanpa tanda pisah panjang di string/JSX (komentar boleh)',
  !/["'`][^"'`\n]*\u2014[^"'`\n]*["'`]/.test(semuaBaru.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')));
ok('"Streak" di awal kalimat, "streak" di tengah', /Streak 🙏 akan mulai lagi dari awal/.test(layar) && !/Rentetan/.test(semuaBaru));

console.log(gagal === 0 ? '\n✅ LULUS — Morning Journey menggantikan gerbang centang.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
