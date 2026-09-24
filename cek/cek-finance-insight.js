// Financial Awareness (22 Sep 2026): mesin lib/financeInsight.ts,
// lib/financeFocus.ts, lib/financeCoach.ts & kunci di lib/budgets.ts
// DIJALANKAN SUNGGUHAN atas fixture (fixture cuma di sini; app memakai data
// nyata). Contoh spesifikasi pemilik app dijadikan uji: budget makanan
// 1.500.000, terpakai 1.050.000, sisa 10 hari → 450.000 & 45.000/hari.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-finance-insight');

let lulus = 0;
const gagal = [];
function ok(nama, syarat, info = '') {
  if (syarat) lulus++;
  else gagal.push(nama + (info ? ` — ${info}` : ''));
}

// ---------- compile ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    'npx',
    ['tsc', ...['financeInsight', 'financeFocus', 'financeCoach', 'budgets', 'categories', 'format', 'transactions']
      .map((f) => path.join(ROOT, `lib/${f}.ts`)),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// ---------- stub ----------
const ts = (d) => ({ toDate: () => d, toMillis: () => d.getTime() });
const memo = new Map();
let aiCalls = 0;
let aiJawab = () => ({ headline: 'H', data: ['d1'], interpretasi: ['i1'], saran: ['s1'] });
class AiAnswerError extends Error {}
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({}), setDoc: async () => {}, updateDoc: async () => {},
      getDoc: async () => ({ data: () => undefined }), getDocs: async () => ({ docs: [] }),
      deleteField: () => null, arrayUnion: (v) => ({ __union: v }), documentId: () => '__id__',
      query: () => ({}), where: () => ({}), orderBy: () => ({}), addDoc: async () => ({ id: 'x' }),
      deleteDoc: async () => {},
      Timestamp: { now: () => ts(new Date()), fromDate: (d) => ts(d) },
    };
  }
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req === './residence') return { RESIDENCE_LOG_TYPES: [{ key: 'electric', label: 'Listrik', icon: '⚡' }] };
  if (req.endsWith('assets/style/color')) return { Color: new Proxy({}, { get: (_t, k) => `#${String(k)}` }) };
  if (req === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: { getItem: async (k) => memo.get(k) ?? null, setItem: async (k, v) => { memo.set(k, v); }, removeItem: async (k) => { memo.delete(k); } } };
  }
  if (req === 'firebase/ai') return { Schema: { object: (o) => o, string: () => 's', array: (o) => o } };
  if (req === './gemini') {
    return {
      AiAnswerError, TANDA_PISAH: String.fromCharCode(0x2014),
      stripEmDash: (s) => s.split(String.fromCharCode(0x2014)).join(',').trim(),
      geminiModel: () => ({ generateContent: async () => ({}) }),
      withModelFallback: async (run) => run('model'),
      parseJsonAnswer: () => aiJawab(),
      geminiErrorMessage: (e, umum) => (e instanceof AiAnswerError ? e.message : umum),
    };
  }
  if (req === './aiGuard') return { guardedAiCall: async (_k, run) => { aiCalls++; return run(); } };
  if (/^expo-|^@react-native|^react-native|^react$/.test(req)) return {};
  return asli(req, parent, isMain);
};
const I = require(path.join(OUT, 'financeInsight.js'));
const F = require(path.join(OUT, 'financeFocus.js'));
const C = require(path.join(OUT, 'financeCoach.js'));
const B = require(path.join(OUT, 'budgets.js'));
const K = require(path.join(OUT, 'categories.js'));
Module._load = asli;

// ---------- fixture ----------
let seq = 0;
const tx = (type, category, amount, d, extra = {}) => ({
  id: `t${++seq}`, type, category, sub: '', liters: 0, amount, note: `catatan rahasia ${seq}`, date: ts(d), ...extra,
});
const D = (y, m, d, h = 12) => new Date(y, m, d, h, 0, 0);
const SEP = 8; // September (0-based)
const budget = { 'expense:food-drink': 1_500_000, 'expense:transportation': 600_000, 'expense:residence': 2_000_000,
  'income:ndc-salary': 8_000_000, 'saving:emergency-fund': 500_000, 'saving:car-fund': 300_000, 'investment:home-purchase': 400_000 };
const items = [
  tx('expense', 'food-drink', 600_000, D(2026, SEP, 5)),
  tx('expense', 'food-drink', 450_000, D(2026, SEP, 12)),
  tx('expense', 'transportation', 200_000, D(2026, SEP, 10)),
  tx('income', 'ndc-salary', 8_000_000, D(2026, SEP, 1)),
];
const SENIN = D(2026, SEP, 21, 10); // Senin 21 Sep 2026 → sisa 10 hari (termasuk hari ini)

// ================= 1. Contoh spesifikasi =================
const safe = I.safeToSpend(budget, items, SENIN, 2026, SEP);
const food = safe.rows.find((r) => r.key === 'food-drink');
ok('food: sisa bulan 450.000', food.remainingMonth === 450_000);
ok('food: jatah harian 45.000 (450.000 ÷ 10 hari)', food.dailyAllowance === 45_000);
ok('food: aman hari ini 45.000 (belum ada pengeluaran hari ini)', food.safeToday === 45_000);
ok('rata-rata aman per hari (semua kategori harian) 85.000 untuk 10 hari', safe.avgPerDay === 85_000 && safe.daysLeft === 10 && safe.month === 850_000);
ok('minggu ini: Senin 21 s.d. 28 Sep → budget minggu 315.000 (450.000 ÷ 10 hari × 7)', food.weekBudget === 315_000 && food.remainingWeek === 315_000);
ok('Residence (fixed) TIDAK ikut Safe to Spend; transportation ikut', !safe.rows.some((r) => r.key === 'residence') && safe.rows.some((r) => r.key === 'transportation'));
ok('total hari ini = jumlah kategori harian', safe.today === 45_000 + 400_000 / 10);
ok('status keseluruhan sesuai rencana (70% terpakai, bulan berjalan 70%)', safe.status === 'on-track' && food.status === 'on-track');

// Ada jajan 20.000 hari ini → aman hari ini turun, minggu & bulan ikut.
const items2 = [...items, tx('expense', 'food-drink', 20_000, D(2026, SEP, 21, 9))];
const safe2 = I.safeToSpend(budget, items2, SENIN, 2026, SEP);
const food2 = safe2.rows.find((r) => r.key === 'food-drink');
ok('setelah jajan 20.000 hari ini: aman hari ini 25.000, minggu 295.000, bulan 430.000',
  food2.safeToday === 25_000 && food2.remainingWeek === 295_000 && food2.remainingMonth === 430_000);
ok('rata-rata per hari dihitung dari sisa bulan ÷ hari tersisa (830.000 ÷ 10 = 83.000)', safe2.avgPerDay === 83_000);

// Bulan lampau: acuannya hari terakhir bulan itu.
const lalu = I.safeToSpend(budget, items, D(2026, 9, 15), 2026, SEP);
ok('bulan lampau: isCurrentMonth false & daysLeft 1', lalu.isCurrentMonth === false && lalu.daysLeft === 1);
ok('tanpa budget kategori harian → hasBudget false, status no-budget',
  I.safeToSpend({ 'expense:residence': 1 }, items, SENIN, 2026, SEP).hasBudget === false &&
  I.safeToSpend({}, items, SENIN, 2026, SEP).status === 'no-budget');

// ================= 2. Irama & Budget Health =================
ok('paceStatus: lewat → over', I.paceStatus(1_600_000, 1_500_000, 0.7) === 'over');
ok('paceStatus: ≥ 90% → watch', I.paceStatus(1_350_000, 1_500_000, 0.7) === 'watch');
ok('paceStatus: lebih cepat dari irama bulan (> elapsed + 10 poin) → watch', I.paceStatus(900_000, 1_500_000, 0.4) === 'watch');
ok('paceStatus: dalam irama → on-track', I.paceStatus(600_000, 1_500_000, 0.4) === 'on-track');
ok('paceStatus: tanpa budget → no-budget', I.paceStatus(100, 0, 0.5) === 'no-budget');
const health = I.budgetHealth(budget, [...items, tx('expense', 'snacks', 50_000, D(2026, SEP, 3))], SENIN, 2026, SEP);
ok('budget health: kategori berbudget dulu (urut persen), tanpa budget di belakang',
  health[0].key === 'food-drink' && health.at(-1).key === 'snacks' && health.at(-1).status === 'no-budget');
ok('budget health: remaining & pct benar', health[0].remaining === 450_000 && Math.round(health[0].pct) === 70);

// ================= 3. Quick check =================
const qc = (amount, cat = 'food-drink', type = 'expense') =>
  I.quickCheck({ type, category: cat, amount, budget, items, now: SENIN, year: 2026, month: SEP });
ok('30.000 (di bawah 1,5× jatah, sisa 28%) → tidak ada jeda', qc(30_000) === null);
ok('75.000 (> 1,5× jatah 45.000 & sisa jadi 25%) → jeda "pace"', qc(75_000)?.reason === 'pace' && qc(75_000).remainingAfter === 375_000);
ok('400.000 (sisa jadi 3%) → jeda "near"', qc(400_000)?.reason === 'near');
ok('500.000 (jadi minus) → jeda "over", sisa sesudah -50.000', qc(500_000)?.reason === 'over' && qc(500_000).remainingAfter === -50_000);
ok('jatah harian sesudahnya ikut dihitung untuk kategori harian', qc(75_000).dailyAfter === 37_500 && qc(75_000).daysLeft === 10);
ok('income / kategori tanpa budget → tidak pernah ada jeda', qc(5_000_000, 'ndc-salary', 'income') === null && qc(1_000_000, 'snacks') === null);
ok('Residence (fixed) 1.900.000 dari 2.000.000: near (sisa 5%), tapi tanpa dailyAfter',
  qc(1_900_000, 'residence')?.reason === 'near' && qc(1_900_000, 'residence').dailyAfter === null);

// ================= 4. Riwayat 3 bulan =================
const bulan = (y, m, food, trans, bud) => ({
  monthId: `${y}-${String(m + 1).padStart(2, '0')}`, year: y, month: m,
  items: [tx('expense', 'food-drink', food, D(y, m, 10)), tx('expense', 'transportation', trans, D(y, m, 12)), tx('income', 'ndc-salary', 8_000_000, D(y, m, 1))],
  budget: bud,
});
const hist = [bulan(2026, 5, 1_200_000, 300_000, { 'expense:food-drink': 1_300_000 }),
  bulan(2026, 6, 1_350_000, 310_000, { 'expense:food-drink': 1_300_000 }),
  bulan(2026, 7, 1_480_000, 290_000, { 'expense:food-drink': 1_300_000 })];
const stats = I.historyStats(hist);
const foodT = stats.byCategory.find((c) => c.key === 'food-drink');
ok('3 bulan berisi → cukup', stats.monthsAvailable === 3 && stats.enough === true);
ok('Food: Jun 1.2jt, Jul 1.35jt, Agu 1.48jt → tren naik', foodT.trend === 'up' && foodT.months.map((m) => m.spent).join() === '1200000,1350000,1480000');
ok('Food: lewat budget 2 dari 3 bulan berbudget', foodT.overCount === 2 && foodT.monthsWithBudget === 3);
ok('kategori paling sering lewat budget = Food; terbesar = Food', stats.mostOverBudget.key === 'food-drink' && stats.biggest.key === 'food-drink');
ok('Transportation ±stabil (300/310/290) → flat', stats.byCategory.find((c) => c.key === 'transportation').trend === 'flat');
ok('rata-rata mingguan Food = total ÷ 92 hari × 7', Math.round(stats.weeklyAvgByKey.get('food-drink')) === Math.round((4_030_000 / 92) * 7));
ok('perubahan bulan terakhir vs sebelumnya (+9,6%)', Math.round(foodT.changePct * 10) / 10 === 9.6);
ok('totalsByMonth berisi income/expense/budget per bulan', stats.totalsByMonth.length === 3 && stats.totalsByMonth[0].income === 8_000_000 && stats.totalsByMonth[0].budget === 1_300_000);
const satu = I.historyStats([bulan(2026, 7, 1_000_000, 100_000, null), { monthId: '2026-07', year: 2026, month: 6, items: [], budget: null }]);
ok('cuma 1 bulan berisi → belum cukup, tren insufficient', satu.enough === false && satu.byCategory[0].trend === 'insufficient');
ok('trendOf: 2 bulan naik > 15% → up; naik tipis → flat', I.trendOf([100, 120]) === 'up' && I.trendOf([100, 105]) === 'flat' && I.trendOf([100]) === 'insufficient');

// 7 hari terakhir vs rata-rata mingguan.
const semua = [...items, ...hist.flatMap((h) => h.items), tx('expense', 'food-drink', 400_000, D(2026, SEP, 18))];
const cmp = I.weekVsAverage(semua, stats, SENIN);
const cmpFood = cmp.find((c) => c.key === 'food-drink');
ok('7 hari terakhir Food 400.000 vs rata-rata ±306.630 → +30%', cmpFood.last7 === 400_000 && Math.round(cmpFood.pct) === 30);

// ================= 5. Insight lokal =================
const doc0 = { ...B.EMPTY_BUDGET, allocations: budget };
const ins = I.localInsights({ safe, health: I.budgetHealth(budget, semua.filter((t) => t.date.toMillis() >= D(2026, SEP, 1).getTime()), SENIN, 2026, SEP), history: stats, weekCompare: cmp, budgetDoc: doc0, elapsed: 0.7 });
const teksIns = ins.map((i) => i.text).join(' ');
ok('insight lokal ada & tanpa kata menghakimi', ins.length >= 3 && !/\b(boros|gagal|jangan beli|impulsif)\b/i.test(teksIns), teksIns);
ok('menyebut Food 7 hari terakhir 30% lebih tinggi dari rata-rata', /Food Drink 7 hari terakhir 30% lebih tinggi/.test(teksIns));
ok('menyebut tren naik & lewat budget 2 dari 3 bulan', /cenderung naik/.test(teksIns) && /melewati budget di 2 dari 3 bulan/.test(teksIns));
ok('belum dikunci → ajakan mengunci (info)', /belum dikunci/.test(teksIns));
ok('urutan: over/watch dulu, lalu info', ins[0].level === 'watch' || ins[0].level === 'over');
const insKurang = I.localInsights({ safe, health: [], history: satu, weekCompare: [], budgetDoc: B.EMPTY_BUDGET, elapsed: 0.7 });
ok('riwayat 1 bulan → kalimat "belum bisa disimpulkan", bukan kesimpulan pola', /belum bisa disimpulkan/.test(insKurang.map((i) => i.text).join(' ')));
ok('semua aman → kalimat menenangkan jadi headline', I.localInsights({ safe, health: I.budgetHealth(budget, items, SENIN, 2026, SEP), history: stats, weekCompare: [], budgetDoc: { ...doc0, locked: true }, elapsed: 0.7 })[0].level === 'ok');

// ================= 6. Weekly & monthly review =================
const wk = I.weeklyReview({ monday: D(2026, SEP, 14, 0), allItems: semua, monthItems: semua.filter((t) => t.date.toMillis() >= D(2026, SEP, 1).getTime()), budget, history: stats });
ok('weekly 14-20 Sep: total 400.000, 1 transaksi, terbesar Food', wk.totalSpent === 400_000 && wk.txCount === 1 && wk.biggest.category.key === 'food-drink');
ok('weekly: budget bulan terpakai s.d. akhir minggu (1.650.000 dari 4.100.000 = 40%)', Math.round(wk.budgetUsedPct) === 40);
ok('weekly: Food masuk watch (+30%), coachLine & focusLine terisi', wk.watch[0]?.category.key === 'food-drink' && /Food Drink/.test(wk.coachLine) && /Jaga 🍛 Food Drink tetap di bawah/.test(wk.focusLine));
ok('weekly: fokus memakai sisa ÷ hari sesudah minggu (50.000 ÷ 10 = 5.000/hari)', /Rp 5\.000\/hari/.test(wk.focusLine), wk.focusLine);
const mr = I.monthlyReview({ slice: { monthId: '2026-08', year: 2026, month: 7, items: [...hist[2].items, tx('saving', 'emergency-fund', 500_000, D(2026, 7, 2)), tx('investment', 'home-purchase', 400_000, D(2026, 7, 2))], budget: hist[2].budget },
  budgetDoc: { ...B.EMPTY_BUDGET, allocations: { ...hist[2].budget, 'saving:emergency-fund': 500_000, 'investment:home-purchase': 400_000 }, locked: true, unlocks: [{ at: ts(new Date()), reason: 'x' }] },
  prev: hist[1], history: stats });
ok('monthly Agu: income/expense/saving/investment/emergency benar', mr.income === 8_000_000 && mr.expense === 1_770_000 && mr.saving === 500_000 && mr.investment === 400_000 && mr.emergency === 500_000);
ok('monthly: adherence 136% (1.770.000 dari 1.300.000), Food over, terbesar Food', Math.round(mr.adherencePct) === 136 && mr.over[0].key === 'food-drink' && mr.biggest.key === 'food-drink');
ok('monthly: vs Jul +6,6%; 3 poin; fokus menyebut Food; unlock 1×', Math.round(mr.vsPrevPct * 10) / 10 === 6.6 && mr.points.length <= 3 && mr.points.length >= 1 && /Food Drink/.test(mr.focus) && mr.unlocks === 1 && mr.locked === true);
ok('monthly: target saving tercapai jadi salah satu poin', mr.points.some((p) => /Target saving & investment tercapai/.test(p)));

// ================= 7. Monthly planning =================
const plan = I.planRollup(budget, 2026, SEP);
ok('planning: income 8jt, fixed 2jt (residence), variable 2,1jt, saving 300rb, emergency 500rb, investment 400rb',
  plan.income === 8_000_000 && plan.fixed === 2_000_000 && plan.variable === 2_100_000 && plan.saving === 300_000 && plan.emergency === 500_000 && plan.investment === 400_000);
ok('planning: flexible = income − alokasi (2,7jt), persen dari income sendiri', plan.flexible === 2_700_000 && Math.round(plan.groups.find((g) => g.key === 'fixed').pct) === 25);
ok('planning: jatah harian & mingguan dari variable (70.000/hari, 490.000/minggu)', plan.dailyAllowance === 70_000 && plan.weeklyAllowance === 490_000);
ok('planning tanpa income → pct null', I.planRollup({ 'expense:food-drink': 1 }, 2026, SEP).groups[1].pct === null);

// ================= 8. Fokus mingguan =================
const fokus = [{ id: 'f1', category: 'transportation', sub: 'gojek', limitAmount: 150_000, limitCount: 4 }, { id: 'f2', category: 'snacks', sub: '', limitAmount: 100_000, limitCount: 0 }];
const trxFokus = [tx('expense', 'transportation', 40_000, D(2026, SEP, 21, 8), { sub: 'gojek' }), tx('expense', 'transportation', 50_000, D(2026, SEP, 22, 8), { sub: 'gojek' }),
  tx('expense', 'transportation', 90_000, D(2026, SEP, 22, 9), { sub: 'bensin' }), tx('expense', 'snacks', 95_000, D(2026, SEP, 20)), tx('expense', 'snacks', 30_000, D(2026, SEP, 22))];
const prog = F.focusProgress(trxFokus, fokus, D(2026, SEP, 22, 10), (f) => (f.sub ? 'Gojek' : ''), (n) => `Rp${n}`);
ok('fokus Gojek: hanya sub gojek dihitung (90.000, 2×), bensin tidak', prog[0].spent === 90_000 && prog[0].count === 2 && prog[0].subLabel === 'Gojek');
ok('fokus Gojek: status on-track (60% & 2 dari 4×), sisa "Rp60000 lagi · 2× lagi"', prog[0].status === 'on-track' && prog[0].leftText === 'Rp60000 lagi · 2× lagi');
ok('fokus Snacks: minggu ini saja (30.000; yang 20 Sep minggu lalu) → on-track', prog[1].spent === 30_000 && prog[1].status === 'on-track');
ok('fokus lewat → over & "lewat Rp…"', F.focusProgress([tx('expense', 'snacks', 130_000, D(2026, SEP, 22))], [fokus[1]], D(2026, SEP, 22), () => '', (n) => `Rp${n}`)[0].leftText === 'lewat Rp30000');
ok('focusValid butuh kategori + minimal satu batas', F.focusValid({ category: 'snacks', limitAmount: 0, limitCount: 2 }) && !F.focusValid({ category: 'snacks', limitAmount: 0, limitCount: 0 }) && !F.focusValid({ category: '', limitAmount: 1, limitCount: 0 }));

// ================= 9. Status tanpa angka (Home & notifikasi) =================
const st = I.financeStatusLines(budget, items2, prog, D(2026, SEP, 21, 20));
ok('status Home: ada baris status, baris fokus, dan ajakan mencatat malam hari', st.statusLines.length >= 1 && st.focusLines.length === 2 && st.lines.some((l) => /Belum ada transaksi tercatat hari ini/.test(l)) === false);
const stMalam = I.financeStatusLines(budget, items, prog, D(2026, SEP, 21, 20));
ok('malam tanpa transaksi hari ini → ajakan mencatat', stMalam.lines.some((l) => /Belum ada transaksi tercatat hari ini/.test(l)));
ok('TIDAK ada "Rp" di baris status/fokus/ajakan', !/Rp/.test([...st.lines, ...stMalam.lines].join(' ')), [...st.lines, ...stMalam.lines].join(' | '));
ok('fokus di Home = jumlah kali & persen jatah', /2\/4× minggu ini · 60% jatah minggu ini/.test(st.focusLines[0]));
ok('financeStatus tanpa budget → no-budget', I.financeStatus(I.safeToSpend({}, items, SENIN, 2026, SEP), []).level === 'no-budget');

// ================= 10. Irisan riwayat & kunci budget =================
const slices = I.historySlices(hist.flatMap((h) => h.items), { '2026-07': { ...B.EMPTY_BUDGET, allocations: { 'expense:food-drink': 1 } } }, 2026, SEP);
ok('historySlices: 3 bulan (Jun, Jul, Agu) urut lama → baru, transaksi terpisah per bulan', slices.map((s) => s.monthId).join() === '2026-06,2026-07,2026-08' && slices[0].items.length === 3 && slices[2].items.length === 3);
ok('historySlices: budget bulan yang tidak ada → null', slices[0].budget === null && slices[1].budget['expense:food-drink'] === 1);
ok('HISTORY_MONTHS = 3', I.HISTORY_MONTHS === 3);
const nb = B.normalizeBudget(undefined);
ok('dokumen budget lama/kosong → belum dikunci, tanpa jejak unlock', nb.locked === false && nb.lockedAt === null && nb.unlocks.length === 0 && Object.keys(nb.allocations).length === 0);
const nb2 = B.normalizeBudget({ allocations: { a: 1 }, locked: true, lockedAt: ts(new Date()), unlocks: [{ at: ts(new Date()), reason: 'x' }, { bukan: 1 }, { at: 'salah' }] });
ok('normalizeBudget: hanya jejak unlock yang sah yang dibaca', nb2.locked === true && nb2.lockedAt !== null && nb2.unlocks.length === 1 && nb2.unlocks[0].reason === 'x');
ok('pace kategori: 7 harian (food, transportation, snacks, groceries, fun, personal, shopping)',
  K.dailyPaceCategories().map((c) => c.key).sort().join() === 'food-drink,fun-recreation,groceries,personal-services,shopping,snacks,transportation' &&
  K.categoryOf('expense', 'residence').pace === 'fixed' && K.categoryOf('expense', 'tidak-ada').pace === undefined);
ok('semua kategori expense punya pace', K.FINANCE_CATEGORIES.expense.every((c) => c.pace === 'daily' || c.pace === 'fixed'));

// ================= 11. AI Coach: least privilege & cache =================
const facts = C.buildCoachFacts({ safe, health: I.budgetHealth(budget, items, SENIN, 2026, SEP), history: stats, weekCompare: cmp, budgetDoc: doc0, focus: prog, year: 2026, month: SEP, ref: SENIN });
const factsTeks = JSON.stringify(facts);
ok('fakta Coach TIDAK memuat catatan transaksi / id transaksi', !/catatan rahasia|"t\d+"|note/.test(factsTeks), factsTeks.slice(0, 200));
ok('fakta Coach: hanya kunci yang terdaftar', Object.keys(facts).sort().join() === 'budget_terkunci,bulan,fokus_mingguan,hari_ke,hari_tersisa,jumlah_hari,kategori,pernah_unlock,riwayat,safe_to_spend');
ok('fakta Coach: kategori berisi budget/terpakai/sisa/tren/per_bulan, tanpa nominal transaksi satuan',
  facts.kategori[0].nama === 'Food Drink' && facts.kategori[0].per_bulan.length === 3 && facts.kategori[0].tren_riwayat === 'up' && facts.riwayat.cukup === true);
ok('fakta Coach: fokus mingguan ikut (nama sub, batas, terpakai)', facts.fokus_mingguan[0].nama === 'Transportation › Gojek' && facts.fokus_mingguan[0].terpakai_kali === 2);
let lempar = null;
try { C.assertFactsSafe({ ...facts, ekstra: 'x' }); } catch (e) { lempar = e; }
ok('assertFactsSafe menolak field di luar daftar', lempar instanceof AiAnswerError);
lempar = null;
try { C.assertFactsSafe({ ...facts, bulan: 'a'.repeat(80) }); } catch (e) { lempar = e; }
ok('assertFactsSafe menolak teks panjang (≥ 60 huruf)', lempar instanceof AiAnswerError);
ok('finalizeCoachAnswer: kata terlarang dihaluskan, tanda pisah dibuang',
  C.finalizeCoachAnswer({ headline: `Kamu boros ${String.fromCharCode(0x2014)} ya`, data: ['a'], interpretasi: [], saran: ['gagal total'] }).headline === 'Kamu lebih tinggi dari rencana , ya' &&
  C.finalizeCoachAnswer({ headline: 'x', data: [], interpretasi: [], saran: ['gagal total'] }).saran[0] === 'belum tercapai total');
(async () => {
  const day0 = C.EMPTY_COACH_DAY;
  const r1 = await C.askCoach('kondisi', facts, '2026-09-21', day0);
  ok('askCoach: panggilan pertama memanggil model (1×), jatah berkurang', aiCalls === 1 && r1.fromCache === false && r1.day.calls === 1 && r1.answer.headline === 'H');
  const r2 = await C.askCoach('kondisi', facts, '2026-09-21', r1.day);
  ok('askCoach: pertanyaan + angka sama → dari cache, TANPA memanggil model', aiCalls === 1 && r2.fromCache === true && r2.day.calls === 1);
  const r3 = await C.askCoach('kondisi', { ...facts, hari_ke: 22 }, '2026-09-21', r2.day);
  ok('askCoach: angka berubah → panggil lagi', aiCalls === 2 && r3.fromCache === false);
  let habis = null;
  try { await C.askCoach('safe', facts, '2026-09-21', { calls: C.COACH_DAILY_CAP, answers: {} }); } catch (e) { habis = e; }
  ok(`askCoach: jatah ${C.COACH_DAILY_CAP}/hari habis → ditolak sebelum menyentuh model`, habis instanceof AiAnswerError && aiCalls === 2 && /jatah Coach/i.test(habis.message));
  ok('COACH_DAILY_CAP di bawah pagar umum 30 & 7 pertanyaan preset', C.COACH_DAILY_CAP <= 10 && C.COACH_QUESTIONS.length === 7);
  await C.saveCoachDay('2026-09-21', r3.day);
  const muat = await C.loadCoachDay('2026-09-21');
  ok('cache Coach tersimpan & terbaca per hari', muat.calls === 2 && muat.answers.kondisi.answer.headline === 'H');
  ok('hash fakta stabil & berubah saat angka berubah', C.factsHash(facts) === C.factsHash(JSON.parse(factsTeks)) && C.factsHash(facts) !== C.factsHash({ ...facts, hari_ke: 23 }));

  // ---------- hasil ----------
  if (gagal.length) {
    console.log('GAGAL:');
    gagal.forEach((g) => console.log('  ✗ ' + g));
    process.exitCode = 1;
  } else {
    console.log(`LULUS: ${lulus} / ${lulus}`);
  }
})();
