// Akar repo, DIHITUNG dari letak berkas ini sendiri.
//
// Dulu tiap suite mengetik jalur absolut komputer pemiliknya. Akibatnya
// suite-nya cuma bisa jalan di satu mesin, dan tidak mungkin ikut
// ter-commit dengan arti yang benar. Sekarang satu berkas ini yang tahu,
// dan ia tahu dengan cara yang tetap benar di mesin mana pun.
//
// Pakai garis miring maju supaya bentuknya persis sama dengan jalur yang
// dulu diketik tangan, jadi semua penggabungan string di suite tetap utuh.
const path = require('path');

module.exports = path.join(__dirname, '..').split(path.sep).join('/');
