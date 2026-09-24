// Financial Awareness (22 Sep 2026): BENTUK layarnya — Dashboard Finance
// berurut Safe to Spend → Review → Coach → Fokus → Pattern → Health → Recent →
// detail; 👀 Quick Check di form tambah; Budget Lock di Budgeting; kartu Home
// tanpa nominal; route review terdaftar; expo-notifications di-require lazy;
// tak ada bahasa menghakimi. Logikanya diuji di cek-finance-insight.js.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const kodeSaja = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

let lulus = 0;
const gagal = [];
function ok(nama, syarat, info = '') {
  if (syarat) lulus++;
  else gagal.push(nama + (info ? ` — ${info}` : ''));
}
const urut = (s, ...potongan) => {
  let pos = -1;
  for (const p of potongan) {
    const i = s.indexOf(p, pos + 1);
    if (i < 0) return `tak ketemu: ${p}`;
    pos = i;
  }
  return true;
};

const BARU = [
  'lib/financeInsight.ts', 'lib/financeFocus.ts', 'lib/financeCoach.ts', 'lib/financeMemo.ts', 'lib/notify.ts',
  'hooks/useFinanceInsight.ts', 'components/finance/DashboardTab.tsx', 'components/finance/MonthDetails.tsx',
  'components/finance/SafeToSpendHero.tsx', 'components/finance/CoachCard.tsx', 'components/finance/FocusCard.tsx',
  'components/finance/ReviewCard.tsx', 'components/finance/QuickCheckDialog.tsx', 'components/finance/PlanningCard.tsx',
  'components/finance/NotifyCard.tsx', 'components/reminders/FinanceStatusCard.tsx', 'app/finance-review.tsx',
];

// ================= 1. Dashboard: urutan prioritas =================
const dash = kodeSaja(baca('components/finance/DashboardTab.tsx'));
ok('Dashboard: urutan Safe to Spend → Review → Coach → Fokus → 🔔 → Pattern → Health → Recent → detail',
  urut(dash, '<SafeToSpendHero', '<ReviewCard', '<CoachCard', '<FocusCard', '<NotifyCard', 'Spending Pattern', 'Budget Health', 'Recent Transactions', '<MonthDetails') === true,
  String(urut(dash, '<SafeToSpendHero', '<ReviewCard', '<CoachCard', '<FocusCard', '<NotifyCard', 'Spending Pattern', 'Budget Health', 'Recent Transactions', '<MonthDetails')));
ok('Dashboard: detail bulan (isi lama) di balik toggle "Lihat detail bulan ini"', /detail \? 'Sembunyikan detail bulan ini' : 'Lihat detail bulan ini'/.test(dash) && /\{detail && \(\s*\n\s*<MonthDetails/.test(dash));
ok('Dashboard: semua angka lewat useFinanceInsight (satu sumber)', /const insight = useFinanceInsight\(\{/.test(dash));
ok('Dashboard: "See insight" membuka semua baris Budget Health', /onSeeInsight=\{\(\) => setAllHealth\(true\)\}/.test(dash));
ok('Dashboard: Recent Transactions → sub-tab Transactions; hero tanpa budget → Budgeting',
  /onShowTab\('transactions'\)/.test(dash) && /onSetBudget=\{\(\) => onShowTab\('budgeting'\)\}/.test(dash));
ok('Dashboard: paddingTop 4 (irama pita header) & kartu blok CARD_GAP', /content: \{ paddingHorizontal: 20, paddingTop: 4/.test(dash) && /marginBottom: CARD_GAP/.test(dash));

const md = kodeSaja(baca('components/finance/MonthDetails.tsx'));
ok('MonthDetails: Budget vs Realisasi, Pengeluaran Harian, quote & donat dipertahankan', /Budget vs Realisasi/.test(md) && /Pengeluaran Harian/.test(md) && /QUOTES/.test(md) && /<DonutChart/.test(md));
ok('MonthDetails: rumus budget bersama totalBudgetOf', /planned: totalBudgetOf\(budget, p\.key\)/.test(md) && !/startsWith\(`\$\{p\.key\}:`\)/.test(md));
ok('MonthDetails: cashflow netral, TANPA vonis', /Cashflow Bulan Ini/.test(md) && !/MENANG|BOROS/.test(md));

// ================= 2. Bahasa: tidak menghakimi, istilah app =================
const semuaBaru = BARU.map((f) => [f, baca(f)]);
const teksTampil = (s) => kodeSaja(s);
ok('tak ada "boros/gagal/jangan beli/impulsif" sebagai teks yang tampil di berkas Finance baru',
  semuaBaru.every(([, s]) => !/'[^'\n]*\b(boros|gagal|jangan beli)\b[^'\n]*'|`[^`\n]*\b(boros|gagal|jangan beli)\b[^`\n]*`|>[^<\n]*\b(boros|gagal|jangan beli)\b[^<\n]*</i.test(teksTampil(s).replace(/replace\([^)]*\)/g, '').replace(/KATA_TERLARANG[^\n]*/g, '').replace(/DILARANG[^\n]*/g, ''))),
  semuaBaru.filter(([, s]) => /\b(boros|jangan beli)\b/i.test(teksTampil(s).replace(/replace\([^)]*\)/g, '').replace(/KATA_TERLARANG[^\n]*/g, '').replace(/DILARANG[^\n]*/g, ''))).map(([f]) => f).join(', '));
ok('tak ada "ketuk/tap/tekan" di berkas baru', semuaBaru.every(([, s]) => !/\bketuk|\btap\b|\btekan\b|ditekan|menekan/i.test(s)), semuaBaru.filter(([, s]) => /\bketuk|\btap\b|\btekan\b|ditekan|menekan/i.test(s)).map(([f]) => f).join(', '));
ok('tak ada tanda pisah panjang di string berkas baru (selain lewat TANDA_PISAH)',
  semuaBaru.every(([, s]) => !new RegExp(`['"\`][^'"\`\\n]*${String.fromCharCode(0x2014)}`).test(kodeSaja(s))));
ok('MENANG/BOROS lenyap dari seluruh kode Finance (komentar sejarah boleh)', fs.readdirSync(path.join(ROOT, 'components/finance')).every((f) => !/MENANG|BOROS/.test(kodeSaja(baca(`components/finance/${f}`)))));

// ================= 3. Quick check di form tambah =================
const trx = kodeSaja(baca('components/finance/TransactionsTab.tsx'));
const qcd = kodeSaja(baca('components/finance/QuickCheckDialog.tsx'));
ok('Quick check: dihitung SEBELUM simpan, hanya bulan berjalan, dilewati kalau sudah dijawab hari ini',
  /const bulanIni = now\.getFullYear\(\) === year && now\.getMonth\(\) === month;/.test(trx) &&
  /quickCheck\(\{ type, category: category!, amount: value, budget, items, now, year, month \}\)/.test(trx) &&
  /if \(check && !\(await quickCheckSeen\(dayId\(now\), category!\)\)\) \{\s*\n\s*setQuick\(check\);\s*\n\s*return;/.test(trx));
ok('Quick check: "Tetap Tambahkan" mencatat jawaban lalu menyimpan', /await markQuickCheckSeen\(dayId\(new Date\(\)\), category\);\s*\n\s*setQuick\(null\);\s*\n\s*await simpanBaru\(/.test(trx));
ok('Quick check: "Lihat Budget" → sub-tab Budgeting', /onShowBudget=\{\(\) => \{\s*\n\s*setQuick\(null\);\s*\n\s*onShowBudget\(\);/.test(trx));
ok('Dialog: judul "👀 Quick Check", tiga pilihan Tetap Tambahkan / Batal / Lihat Budget, tanya "Masih sesuai rencanamu?"',
  /👀 Quick Check/.test(qcd) && /label="Tetap Tambahkan"/.test(qcd) && />\s*Batal\s*</.test(qcd) && />\s*Lihat Budget\s*</.test(qcd) && /Masih sesuai rencanamu\?/.test(qcd));
ok('Dialog: menyebut sisa sebelum & sesudah transaksi', /tersisa \{formatRupiah\(check\.remainingBefore\)\}/.test(qcd) && /tersisa \$\{formatRupiah\(after\)\}/.test(qcd));
ok('alur simpan lama tetap utuh (bensin → Car, Residence → Log)', /syncFuelLog\(user\.uid, ref\.id/.test(trx) && /syncResidenceLog\(user\.uid, ref\.id/.test(trx));

// ================= 4. Budget Lock =================
const bt = kodeSaja(baca('components/finance/BudgetingTab.tsx'));
const pc = kodeSaja(baca('components/finance/PlanningCard.tsx'));
const lb = baca('lib/budgets.ts');
ok('lib/budgets: BudgetDoc punya locked/lockedAt/unlocks; lockBudget & unlockBudget (alasan → arrayUnion)',
  /locked: boolean;\s*\n\s*lockedAt: Timestamp \| null;\s*\n\s*unlocks: BudgetUnlock\[\];/.test(lb) &&
  /export function lockBudget\(/.test(lb) && /unlocks: arrayUnion\(\{ at: Timestamp\.now\(\), reason: bersih \}\)/.test(lb));
ok('lib/budgets: salin bulan lalu memakai mergeFields (alokasi diganti utuh, jejak kunci tetap)', /\{ mergeFields: \['allocations', 'copiedFromPrev'\] \}/.test(lb));
ok('lib/budgets: subscribeBudgetRange lewat documentId() (tanpa index baru)', /where\(documentId\(\), '>=', fromMonthId\)/.test(lb));
ok('Budgeting: terkunci → click kategori & salin membuka dialog Unlock, bukan 🎯 Set Budget',
  /function openEdit\(category: FinanceCategory\) \{\s*\n\s*if \(locked\) \{\s*\n\s*setUnlockError\(null\);\s*\n\s*setUnlockOpen\(true\);\s*\n\s*return;/.test(bt) &&
  /function handleCopyPress\(\) \{\s*\n\s*if \(locked\) \{/.test(bt));
ok('Budgeting: unlock butuh alasan ≥ 3 huruf, tersimpan lewat unlockBudget', /unlockReason\.trim\(\)\.length < 3/.test(bt) && /await unlockBudget\(user\.uid, year, month, unlockReason\)/.test(bt));
ok('Budgeting: kunci lewat ConfirmDialog (bukan merah) yang menjelaskan komitmen', /title=\{`Kunci budget \$\{MONTH_NAMES\[month\]\} \$\{year\}\?`\}/.test(bt) && /confirmLabel="Kunci"\s*\n\s*danger=\{false\}/.test(bt));
ok('Budgeting: tak bisa mengunci budget kosong', /Isi budget minimal satu kategori dulu sebelum mengunci\./.test(bt));
ok('Budgeting: chip salin menampilkan 🔒 saat terkunci', /\{locked \? '🔒' : copied \? '✓ 📋' : '📋'\}/.test(bt));
ok('Planning: alur Income → Fixed → Variable → Savings → Emergency → Investment → Flexible dari planRollup + tombol Lock + Unlock',
  /planRollup\(budgetDoc\.allocations, year, month\)/.test(pc) && /label="🔒 Lock Budget Bulan Ini"/.test(pc) && /Unlock Budget \(butuh alasan\)/.test(pc) && /Pernah di-unlock/.test(pc));
ok('Planning: jatah mingguan & harian tampil', /weeklyAllowance/.test(pc) && /dailyAllowance/.test(pc));

// ================= 5. Layar Finance: langganan riwayat & fokus =================
const fin = kodeSaja(baca('app/finance.tsx'));
ok('finance.tsx: budget = dokumen utuh (BudgetDoc) satu langganan', /const \[budgetDoc, setBudgetDoc\] = useState<BudgetDoc>\(EMPTY_BUDGET\);/.test(fin) && /subscribeBudget\(uid, year, month, setBudgetDoc, \(\) => \{\}\),/.test(fin)); // 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).
ok('finance.tsx: riwayat 3 bulan + budget-nya + fokus lewat useLiveAll, hanya setelah PIN (when: unlocked)',
  /subscribeTransactionsRange\(uid, histFrom, new Date\(year, month, 1\), setHistItems/.test(fin) && /subscribeBudgetRange\(/.test(fin) && /subscribeFinanceFocus\(uid, setFocusItems/.test(fin) &&
  /\{ deps: \[year, month, setHistItems\], when: unlocked \}/.test(fin));
ok('finance.tsx: riwayat dikunci ke bulan yang dilihat (useKeyedData) & diiris historySlices', /useKeyedData<string, Transaction\[\]>\(\s*\n?\s*`hist-\$\{year\}-\$\{month\}`/.test(fin) && /historySlices\(histItems \?\? \[\], histBudgets, year, month\)/.test(fin));
ok('finance.tsx: Dashboard/Transactions/Budgeting menerima budgetDoc/history/onShowTab/onShowBudget',
  /<DashboardTab[\s\S]*?budgetDoc=\{budgetDoc\}[\s\S]*?history=\{history\}[\s\S]*?onShowTab=\{onTabPress\}/.test(fin) &&
  /<TransactionsTab[\s\S]*?onShowBudget=\{\(\) => onTabPress\('budgeting'\)\}/.test(fin) && /<BudgetingTab[\s\S]*?budgetDoc=\{budgetDoc\}/.test(fin));
ok('lib/transactions: subscribeTransactionsRange (range + orderBy, tanpa index baru) & per-bulan memakainya',
  /export function subscribeTransactionsRange\(/.test(baca('lib/transactions.ts')) && /return subscribeTransactionsRange\(\s*\n\s*uid,\s*\n\s*new Date\(year, month, 1\)/.test(baca('lib/transactions.ts')));

// ================= 6. Coach: least privilege & on-click =================
const coach = baca('lib/financeCoach.ts');
const cc = kodeSaja(baca('components/finance/CoachCard.tsx'));
ok('financeCoach: tidak pernah menerima Transaction / catatan', !/Transaction\b/.test(coach) && !/\.note\b/.test(coach));
ok('financeCoach: prompt memisahkan DATA / INTERPRETASI / SARAN, melarang label & rekomendasi investasi, menuntut "belum cukup" saat riwayat kurang',
  /DATA \(angka yang ada\), INTERPRETASI/.test(coach) && /DILARANG memakai kata "boros"/.test(coach) && /Jangan memberi rekomendasi investasi/.test(coach) && /riwayat\.cukup = false/.test(coach));
ok('financeCoach: lewat guardedAiCall + withModelFallback + JSON schema (pola app)', /guardedAiCall\(`coach\|/.test(coach) && /withModelFallback\(/.test(coach) && /responseSchema: SKEMA/.test(coach));
ok('financeCoach: tanpa kunci API (hanya lib/gemini)', !/apiKey|API_KEY|AIza/.test(coach));
ok('CoachCard: insight lokal selalu tampil; Gemini hanya saat pertanyaan di-click (askCoach di dalam tanya())',
  /\{headline\.emoji\} \{headline\.text\}/.test(cc) && /async function tanya\(key: CoachQuestionKey\)/.test(cc) && /await askCoach\(key, facts, dayId, day\)/.test(cc) &&
  (cc.match(/askCoach\(/g) ?? []).length === 1 && cc.indexOf('askCoach(') > cc.indexOf('async function tanya('));
ok('CoachCard: jawaban dipisah DATA / INTERPRETASI / SARAN + catatan "keputusan tetap milikmu"', /<Bagian label="DATA"/.test(cc) && /<Bagian label="INTERPRETASI"/.test(cc) && /<Bagian label="SARAN"/.test(cc) && /Keputusan\s*\n?\s*tetap milikmu/.test(cc));
ok('CoachCard: tanpa percobaan ulang otomatis (galat cuma ditampilkan)', /setError\(coachErrorMessage\(e\)\)/.test(cc) && !/retry|coba lagi otomatis/i.test(cc));

// ================= 7. Home: status saja, tanpa nominal =================
// 22 Sep 2026: hitungan & langganannya jadi hooks/useFinanceStatus (dipakai
// kartu Semua Pengingat & Today Engine); kartunya tinggal menggambar.
const home = kodeSaja(baca('hooks/useFinanceStatus.ts')) + kodeSaja(baca('components/reminders/FinanceStatusCard.tsx'));
ok('Home: FinanceStatusCard dipasang di Dashboard utama', /<FinanceStatusCard now=\{now\} \/>/.test(kodeSaja(baca('app/reminders.tsx'))));
ok('Home: kartu TIDAK memakai formatRupiah / "Rp"', !/formatRupiah|Rp/.test(home));
ok('Home: teks dari financeStatusLines (status + fokus + ajakan mencatat), click → /finance (PIN)', /financeStatusLines\(budgetDoc\.allocations, items, progress, now\)/.test(home) && /router\.push\('\/finance'\)/.test(home));
ok('Home: langganan yang sama dengan Finance (ref-count liveDoc)', /subscribeTransactionsByMonth\(uid, year, month, setItems/.test(home) && /subscribeBudget\(uid, year, month, setBudgetDoc/.test(home));

// ================= 8. Review & fokus =================
const rc = kodeSaja(baca('components/finance/ReviewCard.tsx'));
const rv = kodeSaja(baca('app/finance-review.tsx'));
ok('ReviewCard: pengingat Senin/Selasa (weekly) & tanggal 1-5 (monthly), bisa ditutup per periode',
  /now\.getDay\(\) === 1 \|\| now\.getDay\(\) === 2/.test(rc) && /now\.getDate\(\) <= 5/.test(rc) && /useDailyDismiss\('finance:weekly-review', weekKey\)/.test(rc));
ok('ReviewCard → /finance-review (kind week/month)', /pathname: '\/finance-review', params: \{ kind: 'week', day: weekKey \}/.test(rc) && /params: \{ kind: 'month', id: prevId \}/.test(rc));
ok('route finance-review terdaftar (layout, tema finance, typed routes)',
  /<Stack\.Screen name="finance-review" \/>/.test(baca('app/_layout.tsx')) && /'finance-review': 'finance'/.test(baca('lib/featureTheme.ts')) && /finance-review/.test(baca('.expo/types/router.d.ts')));
ok('Review: weekly berisi total, budget used, biggest, watch, coach, fokus; monthly berisi income/spending/saved/invested/emergency, adherence, over/under, tren 3 bulan, 3 poin, fokus',
  /Bagaimana minggu kamu\?/.test(rv) && /Budget used/.test(rv) && /Biggest category/.test(rv) && /⚠️ Watch/.test(rv) && /Fokus minggu depan:/.test(rv) &&
  /Emergency fund contribution/.test(rv) && /Budget adherence/.test(rv) && /Over budget \(/.test(rv) && /3 hal yang terlihat:/.test(rv) && /Fokus bulan depan:/.test(rv));
ok('Review: angka "as of" akhir periode (review minggu lalu tidak berubah oleh minggu ini)', /return real < akhir \? real : new Date\(akhir\.getTime\(\) - 1\);/.test(rv));
ok('Review: "Jadikan fokus minggu depan" dari kategori watch, batas = rata-rata mingguan riwayat', /jadikanFokus/.test(rv) && /weeklyAvgByKey\.get\(watchTop\.category\.key\)/.test(rv));
ok('Review: ringkasan Coach hanya saat di-click (weekly/monthly)', /const q: CoachQuestionKey = kind === 'week' \? 'weekly' : 'monthly';/.test(rv));
const fc = kodeSaja(baca('components/finance/FocusCard.tsx'));
ok('FocusCard: kategori + sub (mis. Gojek) + batas nominal/jumlah kali; hapus = hard delete dari array',
  /placeholder="Sub-kategori \(opsional, mis\. Gojek\)"/.test(fc) && /Batas nominal per minggu/.test(fc) && /Batas jumlah kali per minggu/.test(fc) && /items\.filter\(\(f\) => f\.id !== id\)/.test(fc));
ok('lib/financeFocus: satu dokumen app/financeFocus, saveFinanceFocus setDoc utuh', /doc\(db, 'users', uid, 'app', 'financeFocus'\)/.test(baca('lib/financeFocus.ts')) && /return setDoc\(focusRef\(uid\), \{ items \}\);/.test(baca('lib/financeFocus.ts')));

// ================= 9. Notifikasi lokal =================
const nf = baca('lib/notify.ts');
ok('expo-notifications terpasang & plugin di app.json', /"expo-notifications"/.test(baca('package.json')) && /"expo-notifications",\s*\n\s*\{\s*\n\s*"color": "#0B3D36"/.test(baca('app.json')));
ok('notify: modul di-require LAZY (aman di build lama), bukan import statis',
  /require\('expo-notifications'\)/.test(nf) && !/^import .* from 'expo-notifications'/m.test(nf) &&
  ['app', 'components', 'lib', 'hooks'].every((d) => !fs.readdirSync(path.join(ROOT, d), { recursive: true }).some((f) => /\.tsx?$/.test(String(f)) && /^import .* from 'expo-notifications'/m.test(baca(`${d}/${String(f).replace(/\\/g, '/')}`)))));
ok('notify: pengingat Finance tetap dua (07.30 status & 20.30 catat), trigger DAILY, id tersimpan & dibatalkan saat sinkron ulang',
  /id: 'finance-morning',[\s\S]{0,160}hour: 7,\s*\n\s*minute: 30,/.test(nf) && /id: 'finance-evening',[\s\S]{0,160}hour: 20,\s*\n\s*minute: 30,/.test(nf) && /SchedulableTriggerInputTypes\.DAILY/.test(nf) && /cancelScheduledNotificationAsync/.test(nf) && /AsyncStorage\.setItem\(IDS_KEY/.test(nf));
ok('notify: izin diminta saat dinyalakan; ditolak → "denied"; tanpa modul → "needs-build"', /requestPermissionsAsync\(/.test(nf) && /return 'denied'/.test(nf) && /return 'needs-build'/.test(nf));
ok('notify: teks Finance dari status tanpa nominal', /body: finance\s*\n?\s*\? gabung\(finance\.lines, 2\)/.test(nf) && !/formatRupiah/.test(nf));
ok('Today menyinkronkan notifikasi hanya saat isinya berubah', /syncNotifications\(model, finance, todayId\)/.test(baca('hooks/useTodayData.ts')) && /if \(sidik === terakhir\) return;/.test(nf));
ok('sakelar pengingat jujur soal build baru & izin, & tinggal SATU tempat (app/notifications.tsx)', /Butuh build app baru/.test(baca('app/notifications.tsx')) && /Izin notifikasi ditolak/.test(baca('app/notifications.tsx')) && /Butuh build app baru/.test(baca('components/finance/NotifyCard.tsx')) && !/setNotifyEnabled/.test(baca('components/finance/NotifyCard.tsx')));

// ================= 10. Kategori & memo =================
ok('lib/categories: atribut pace (daily/fixed) + dailyPaceCategories/isDailyPace', /pace\?: CategoryPace;/.test(baca('lib/categories.ts')) && /export function dailyPaceCategories\(\)/.test(baca('lib/categories.ts')));
ok('lib/financeMemo: quick check diingat per hari & kategori (AsyncStorage, bukan Firestore)', /quickCheckSeen/.test(baca('lib/financeMemo.ts')) && /AsyncStorage/.test(baca('lib/financeMemo.ts')) && !/firebase/.test(baca('lib/financeMemo.ts')));

// ---------- hasil ----------
if (gagal.length) {
  console.log('GAGAL:');
  gagal.forEach((g) => console.log('  ✗ ' + g));
  process.exitCode = 1;
} else {
  console.log(`LULUS: ${lulus} / ${lulus}`);
}
