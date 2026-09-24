// 2 permintaan 15 Sep 2026 siang (sub-tab Token, Residence):
//  1 judul "⚡ Riwayat Pemakaian" = SectionToggle yang DIPATOK (sticky), sama
//    dengan Anggota di Fun Futsal & CL/MT di CORE
//  2 daftar pembelian token pindah ke halaman sendiri lewat tombol 🧾 di pojok
//    header Residence; formulir beli token jadi hook + sheet bersama
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = AKAR + '/';
const KELUAR = path.join(__dirname, 'keluar-token-dua');

let gagal = 0;
function c(nama, ok) {
  console.log((ok ? '  ok  ' : '  GAGAL') + ' ' + nama);
  if (!ok) gagal++;
}
const baca = (f) => fs.readFileSync(ROOT + f, 'utf8');
const ada = (f) => fs.existsSync(ROOT + f);

const tab = baca('components/residence/TokenTab.tsx');

// ================= 1. Judul Riwayat dipatok =================
console.log('1. Judul Riwayat Pemakaian: SectionToggle yang dipatok');
{
  c('memakai SectionToggle bersama (bukan judul buatan sendiri)',
    /import \{ SectionToggle \} from '@\/components\/common\/SectionToggle';/.test(tab) &&
      // "(N hari)" sejak riwayatnya per hari (permintaan sore 15 Sep 2026).
      /<SectionToggle\s+title=\{`⚡ Riwayat Pemakaian \(\$\{riwayat\.length\} hari\)`\}\s+open=\{riwayatOpen\}\s+onToggle=\{\(\) => setRiwayatOpen\(\(v\) => !v\)\}\s*\/>/.test(tab));
  c('judul lama "⚡ Riwayat Pemakaian" sebagai VixText sudah tidak ada',
    !/<VixText[^>]*>\s*⚡ Riwayat Pemakaian\s*<\/VixText>/.test(tab));
  c('terbuka saat dibuka (isi utama layar)', /const \[riwayatOpen, setRiwayatOpen\] = useState\(true\);/.test(tab));
  c('STICKY_HEADERS = [5] di luar komponen & dipasang ke ScrollView',
    /^const STICKY_HEADERS = \[5\];/m.test(tab) && /stickyHeaderIndices=\{STICKY_HEADERS\}/.test(tab));

  // Urutan anak langsung ScrollView harus pas: judulnya anak ke-5.
  const mulai = tab.indexOf('stickyHeaderIndices={STICKY_HEADERS}>');
  const akhir = tab.indexOf('</ScrollView>', mulai);
  const isi = tab.slice(mulai, akhir);
  const urut = [
    /<SummaryCard/, /<View style=\{\[styles\.hero/, /<View>\s*\{tagihan\.due &&/,
    /<View style=\{styles\.buttonRow\}>/, /<View style=\{styles\.bulanIniBox\}>\s*\{bulanIni\.kwh > 0 &&/,
    /<SectionToggle/, /<View>\s*\{riwayatOpen &&/,
  ];
  let pos = 0;
  let rapi = true;
  for (const r of urut) {
    const m = isi.slice(pos).search(r);
    if (m < 0) { rapi = false; break; }
    pos += m + 1;
  }
  c('anak 0-6: ringkas · sisa · <View>{tagihan.due} · tombol · <View bulanIniBox>{bulanIni} · SectionToggle · <View>{riwayatOpen}', rapi);
  c('kartu penjelas badge & pecahan bulan ini dibungkus <View> yang SELALU ada (bukan {syarat && …} telanjang)',
    /<View>\s*\{tagihan\.due && \(/.test(isi) && /<View style=\{styles\.bulanIniBox\}>\s*\{bulanIni\.kwh > 0 && \(/.test(isi) &&
      !/\n\s*\{tagihan\.due && \(\s*\n\s*<PressableScale/.test(isi.replace(/<View>\s*\{tagihan\.due/, '')));
  c('daftar Riwayat hanya saat terbuka; EmptyText & Pagination tetap di dalamnya',
    /\{riwayatOpen &&\s*\(riwayat\.length === 0 \? \(\s*<EmptyText>/.test(isi) && /<Pagination\s+page=\{currentPage\}/.test(isi));
  c('jarak atas judul = marginBottom pembungkus Bulan ini (SECTION_SPACE.marginTop), bukan margin di judulnya',
    /bulanIniBox: \{ marginBottom: SECTION_SPACE\.marginTop \},/.test(tab) && !/riwayatGap/.test(tab));
  c('suntingan user tetap: "tercatat N×" & hint estimasi sebulan penuh',
    /`tercatat \$\{tagihan\.count\}×`/.test(tab) && /Estimasi sebulan penuh \{rupiah\(bulanIni\.perDay \* 30\)\}/.test(tab));
}

// ================= 2. Pembelian token → halaman sendiri =================
console.log('2. Daftar pembelian token pindah ke halaman sendiri');
{
  c('daftar & judul "🧾 Pembelian token" tidak lagi di sub-tab Token',
    !/🧾 Pembelian token/.test(tab) && !/openBuyEdit|openBuyAdd|editBuy|saveBuy|deleteBuy|bCost|bPlatform/.test(tab));
  c('sub-tab Token memakai hook + sheet bersama; tombol Beli Token → beli.bukaBaru',
    /const beli = useTokenPurchaseForm\(purchases\);/.test(tab) && /<TokenPurchaseSheet form=\{beli\} \/>/.test(tab) &&
      /label="Beli Token"[\s\S]*?onPress=\{beli\.bukaBaru\}/.test(tab));
  c('cuma tersisa satu SheetModal di sub-tab (catat meteran); MoneyInput/TOKEN_PLATFORMS tidak diimpor lagi',
    (tab.match(/<SheetModal/g) || []).length === 1 && !/MoneyInput|TOKEN_PLATFORMS|newPurchaseId|saveTokenPurchases/.test(tab));

  const hook = baca('hooks/useTokenPurchaseForm.ts');
  c('hook: useFormSave, validasi biaya & kWh, simpan lewat save(), tutup saat berhasil',
    /useFormSave\(\)/.test(hook) && /Biaya & kWh-nya diisi dua-duanya/.test(hook) &&
      /await save\(async \(\) => \{\s*await saveTokenPurchases\([\s\S]*?setOpen\(false\);\s*\}\);/.test(hook));
  c('hook: hapus PERMANEN (filter id), lewat remove()',
    /await remove\(async \(\) => \{\s*await saveTokenPurchases\(\s*user\.uid,\s*purchases\.filter\(\(p\) => p\.id !== edit\.id\),\s*\);\s*setOpen\(false\);/.test(hook) &&
      !/isDeleted|archived|deleted:/.test(hook));
  c('hook: bukaBaru mengisi platform default & tanggal hari ini; bukaUbah mengisi dari data',
    /function bukaBaru\(\) \{[\s\S]*?setPlatform\(TOKEN_PLATFORMS\[0\]\)/.test(hook) &&
      /function bukaUbah\(p: TokenPurchase\) \{[\s\S]*?setBiaya\(groupDigits\(String\(p\.cost\)\)\)[\s\S]*?setKwh\(formatDecimal\(p\.kwh\)\)/.test(hook));
  c('hook mengekspor tipe TokenPurchaseForm', /export type TokenPurchaseForm = ReturnType<typeof useTokenPurchaseForm>;/.test(hook));

  const sheet = baca('components/residence/TokenPurchaseSheet.tsx');
  c('sheet: judul Beli Token / Ubah Pembelian, kolom 💰 ⚡ Platform 📆 📝, EditDelete + DualButtons',
    /title=\{form\.edit \? 'Ubah Pembelian' : 'Beli Token'\}/.test(sheet) &&
      /💰 Beli/.test(sheet) && /⚡ kWh/.test(sheet) && /TOKEN_PLATFORMS\.map/.test(sheet) && /📆 Tanggal/.test(sheet) && /📝 Catatan \(opsional\)/.test(sheet) &&
      /<EditDelete\s+editing=\{form\.edit\}\s+label="Hapus pembelian ini"/.test(sheet) && /<DualButtons/.test(sheet));
  c('sheet: hint harga per kWh tetap ada; DateField ber-key per pembelian',
    /Berarti \{formatRupiah\(Math\.round\(biaya \/ kwh\)\)\}\/kWh\./.test(sheet) && /key=\{`b-\$\{form\.edit\?\.id \?\? 'new'\}`\}/.test(sheet));

  const hal = baca('app/token-purchases.tsx');
  c('halaman baru app/token-purchases.tsx: header Token Purchase 🧾, kembali ke Residence',
    /export default function TokenPurchasesScreen/.test(hal) && /backLabel="Residence"/.test(hal) && /title="Token Purchase 🧾"/.test(hal));
  c('halaman: melanggan lewat subscribeTokenPurchases (pendengar bersama liveDoc), LoadingCenter saat null, ScreenError',
    /subscribeTokenPurchases\(\s*uid,/.test(hal) && // 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).
    /purchases === null \? \(\s*<LoadingCenter \/>/.test(hal) && /<ScreenError message=\{error\} \/>/.test(hal));
  c('halaman: terbaru di atas, paginasi, click baris → form.bukaUbah(p), sheet bersama terpasang',
    /sort\(\(a, b\) => b\.date\.toMillis\(\) - a\.date\.toMillis\(\)\)/.test(hal) && /usePagination\(urut\)/.test(hal) &&
      /onPress=\{\(\) => form\.bukaUbah\(p\)\}/.test(hal) && /<TokenPurchaseSheet form=\{form\} \/>/.test(hal));
  c('halaman: kartu ringkas total pembelian + rata-rata Rp/kWh; baris tampil biaya · kWh · tanggal · platform · Rp/kWh',
    /label="Total pembelian"/.test(hal) && /formatRupiah\(Math\.round\(total \/ totalKwh\)\)/.test(hal) &&
      /\{formatRupiah\(p\.cost\)\} · \{formatDecimal\(p\.kwh\)\} kWh/.test(hal) && /formatRupiah\(Math\.round\(ratePerKwh\(p\)\)\)\}\/kWh/.test(hal));

  const res = baca('app/residence.tsx');
  c('header Residence: tombol 🧾 di kanan atas HANYA saat sub-tab Token → /token-purchases',
    /right=\{[\s\S]*?tab === 'token' \? \(\s*<EmojiButton emoji="🧾" onPress=\{\(\) => router\.push\('\/token-purchases'\)\} \/>\s*\) : undefined/.test(res) &&
      /const router = useRouter\(\);/.test(res));
  c('route terdaftar di app/_layout.tsx & di typed routes',
    /<Stack\.Screen name="token-purchases" \/>/.test(baca('app/_layout.tsx')) &&
      ada('.expo/types/router.d.ts') && /token-purchases/.test(baca('.expo/types/router.d.ts')));

  // Warna fitur: halaman baru harus dikenali sebagai milik Residence supaya
  // EmojiButton/SummaryCard-nya memakai palet rumah, bukan warna merek.
  try {
    execFileSync('node', [
      ROOT + 'node_modules/typescript/bin/tsc', '--ignoreConfig', '--outDir', KELUAR,
      '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      ROOT + 'lib/featureTheme.ts',
    ], { stdio: 'ignore' });
  } catch {
    // galat tipe saja
  }
  const Module = require('module');
  const asliLoad = Module._load;
  Module._load = function (request) {
    if (request === '@/assets/style/color') return { Color: new Proxy({}, { get: () => '#000000' }) };
    if (request === '@/lib/featureGrid') return { HOME_FEATURES: [] };
    return asliLoad.apply(this, arguments);
  };
  const ft = require(path.join(KELUAR, 'featureTheme.js'));
  Module._load = asliLoad;
  c('featureKeyForRoute: /token-purchases & token-purchases → "residence" (dijalankan sungguhan)',
    ft.featureKeyForRoute('/token-purchases') === 'residence' && ft.featureKeyForRoute('token-purchases') === 'residence');

  const semua = [tab, hook, sheet, hal, res].join('\n');
  c('istilah: tanpa tekan/ketuk/tap/klik di berkas yang disentuh',
    !/ketuk|tekan|\btap\b|\bklik/i.test(semua));
}

console.log(gagal === 0 ? 'CEK-TOKEN-DUA OK' : gagal + ' gagal');
process.exit(gagal === 0 ? 0 : 1);
