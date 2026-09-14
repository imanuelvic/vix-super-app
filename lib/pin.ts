// PIN privasi — SATU angka untuk semua gerbang di app ini: layar Finance, dan
// Wheel/Timeline milik CORE Leader (dibuka dari sub-tab Leaders).
//
// Dulu angkanya cuma ada di app/finance.tsx. Begitu Wheel & Timeline CL ikut
// dikunci (14 Sep 2026), angkanya ditaruh di sini supaya ketiganya mustahil
// beda: satu PIN yang diingat, bukan tiga yang bisa selisih.
//
// CATATAN: ini kunci privasi dari orang iseng yang pegang HP-mu, BUKAN
// pengamanan data. PIN-nya ikut terbundel di aplikasi. Data tetap dijaga
// login Firebase + Security Rules.
export const PRIVACY_PIN = '9811';
