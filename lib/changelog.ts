// 📱 Riwayat versi aplikasi ini.
//
// Satu tempat untuk menjawab satu pertanyaan: "dulu aku mengubah apa saja?".
// Tampil di layar Version, dengan meng-click kartu versinya.
//
// ── ATURAN YANG MEMBUATNYA TETAP HIDUP ────────────────────────────────────
// Tiap kali ada PERUBAHAN BESAR (fitur baru, fitur dibuang, perubahan yang
// terlihat di layar, atau perapihan yang mengubah cara kerja), tambahkan
// barisnya DI SINI, di entri paling atas. Kalau versi di app.json naik,
// buatkan entri baru di paling atas.
//
// Kenapa ditulis tangan dan bukan dibaca dari git: pesan commit di repo ini
// hampir seluruhnya "Update Version: x.y.z" dan tidak menjelaskan apa pun.
// Riwayat yang berguna harus ditulis saat perubahannya masih segar, bukan
// ditebak-tebak setahun kemudian. Entri v1.0.0 sampai v2.0.0 di bawah memang
// disusun belakangan (1 Okt 2026) dari bukti: berkas apa yang BARU lahir di
// tiap rentang commit, ditambah pesan commit lama yang kebetulan berisi
// keterangan. Jadi ia jujur, tapi ringkas; yang detail ada di komentar kode
// masing-masing fitur.
//
// Bentuk tiap baris, supaya enak dibaca di layar HP:
//   • satu kalimat, satu perubahan, maksimal ±12 kata
//   • lambang di DEPAN, dan lambangnya ikut fiturnya (💰 Finance, 🍽️ Puasa)
//   • tulis APA YANG BERUBAH BAGI PEMAKAINYA, bukan nama berkas atau fungsi
//   • tanpa tanda pisah panjang, tanpa kata "tekan" (pakai "click")

/** Satu versi beserta rangkuman perubahannya. */
export type ReleaseNote = {
  /** Sama persis dengan `version` di app.json, mis. "2.0.1". */
  version: string;
  /** "YYYY-MM-DD" hari terakhir versi itu dikerjakan. */
  date: string;
  /** Rangkuman perubahan, satu kalimat per baris. */
  items: string[];
};

// Tidak ada penanda "butuh build" per entri, dan itu disengaja: policy
// runtimeVersion app ini "appVersion", jadi SETIAP nomor versi yang naik
// otomatis butuh `eas build` baru. Penanda yang nilainya selalu sama bukan
// keterangan, ia cuma baris yang harus ikut dirawat. Aturannya ada di
// RELEASE.md, satu kali, di tempat yang memang dibaca saat mau rilis.

/** Terbaru DI ATAS. Entri baru selalu disisipkan di awal daftar ini. */
export const CHANGELOG: ReleaseNote[] = [
  {
    version: '2.0.1',
    date: '2026-10-03',
    items: [
      '🔔 Jam reminder kini di kanan baris, sejajar judulnya',
      '💰 Sesudah salin transaksi, layar pindah ke bulan berjalan tanpa mode cari',
      '🔔 Tombol Tambah Reminder di Daily dihapus, cukup + di tiap tanggal',
      '📌 Deadline Priority tampil di atas Daily mulai hari-H sampai dicentang',
      '📌 Badge Priority kini menghitung deadline yang sudah tiba atau lewat',
      '📌 Deadline yang terlewat tertulis "sudah lewat N hari"',
      '⚖️ Pengingat timbang membuka isian berat, bukan Check-up',
      '📈 Berat badan kini tercatat riwayatnya, grafiknya di Fitness Progress',
      '👣 Steps: target 10.000 langkah sehari menggantikan patokan jarak lari',
      '🗓️ Rekap bulan, kuartal, & tahun di Steps jadi satu kartu',
      '🎯 Steps cukup satu target mingguan, anjuran umum pindah ke Fitness',
      '🩺 Tombol Catat Pemeriksaan menempel di atas, ikon Info jadi 📋',
      '🏃 Hasil lari yang diketik & yang direkam kini satu daftar',
      '🏋️ Kemajuan beban tiap gerakan tercatat, terlihat di Progress',
      '📊 Progress: ringkasan minggu ini & konsistensi 8 minggu terakhir',
      '📅 Tab Program pindah ke Pick Exercise, gerakan paketnya bisa diintip',
      '⏱️ Timer istirahat antar set di kartu gerakan beban',
      '🏁 Race mendatang dihitung mundur, program menyarankan blok C menjelang hari-H',
      '👣 Tombol Tambah & Perbarui di kartu langkah jadi tulisan putih',
      '🌤️ Riwayat Morning Journey dihapus, isinya tetap ada di Revive History',
      '⏰ Reminder bisa diberi jam, HP berbunyi tepat di jam itu',
      '📝 Reminder punya kotak catatan untuk detailnya',
      '🔔 Angka di samping bulan kini menghitung bulan yang tampil saja',
      '⏱️ Record: stopwatch olahraga baru, di tengah kaki layar Fitness',
      '🏃 Sesudah lari atau jalan, isi jarak, lama, & lokasinya',
      '💬 Bagikan sesinya ke grup keluarga: kartu sapaan & kata penyemangat',
      '📜 Riwayat olahraga di pojok kanan atas Fitness, per sesi',
      '🙏 Follow up CORE: ganti pertanyaan jadi 🔀 di kanan, kartunya lebih lega',
      '❤️ Respons hati pagi bertambah: Percaya, Bertobat, Berharap, Ditenangkan, Mengasihi',
      '💬 Respons paginya bisa dibagikan ke WhatsApp sebelum lanjut ke Worship',
      '📖 Baca Alkitab jadi perjalanan lima langkah, satu layar satu pertanyaan',
      '✨ Apa yang kamu dapat & ayat yang memberkati ikut tersimpan di arsip',
      '🌅 Warna layar bacanya ikut sesi: pagi hangat, siang teduh, malam gelap',
      '📸 Bagikan ayatnya ke Instagram jadi tawaran di akhir, bebas dilewati',
      '📤 Laporan keuangan PDF, bisa ditarik 1, 3, 6, atau 12 bulan sekaligus',
      '🤖 Rekomendasi Budget AI dari realisasi 3 bulan terakhir, tinggal disetujui',
      '🔒 Budget terkunci sekarang boleh dilihat, Unlock cuma untuk mengubah',
      '✨ Analysis pasar pindah ke tiap sub-tab Investment, jawabannya tidak terpotong lagi',
      '📈 Grafik harga bisa dibuka layar penuh lalu dicubit untuk memperbesar',
      '🍽️ Puasa: tanda berhasil & gagal di daftar, catatan terkunci tinggal dibaca',
      '🚗 Kartu kilometer mobil menggantikan kartu kondisi perawatan',
      '📆 Wishlist bulan berjalan ditagih tiap Senin sampai dicentang',
      '📋 Tombol salin di mutasi Saku, tombol ✗ kecil di riwayat pembayaran Lending',
      '🔴 Angka di ikon app = jumlah badge yang kelihatan di dalam app',
      '🎢 Fitur Rekreasi dihapus total',
      '💼 Sub-tab Focus & Affiliate di Work dihapus, langsung ke Fulltime',
      '📋 Financial Review: rekap bulanan sejak 2015 masuk ke dalam app',
      '🖨️ Rekap setahun bisa dibagikan jadi PDF mendatar, berkolom bulan',
      '🤝 Tombol Lending & Saku cuma muncul di sub-tab Transactions',
      '📊 Budget Recap: rencana & kenyataan setahun penuh, ditukar satu click',
      '🚨 Emergency Fund: target dihitung sendiri, kurangnya & berapa bulan lagi',
      '🔀 Budgeting & Dashboard bertukar tempat, Budgeting jadi yang pertama',
      '✂️ Kalimat penjelasan di Finance dipendekkan',
      '📱 Riwayat versi ini sendiri, dibuka dari kartu versi di layar Version',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-09-30',
    items: [
      '🏠 Today OS: Home jadi "apa yang penting hari ini", bukan deretan tile',
      '🗂️ Lima tab utama: Today, Walk, CORE, Work & Life',
      '🔔 Pengingat HP: 13 kelompok, kalimatnya berganti tiap hari',
      '🌙 Night Prayer & doa syafaat malam',
      '📖 God’s Story & Testimony masuk tab Walk',
      '🏆 Achievement jadi Reward, fitur Married dihapus',
      '📦 Ekspor seluruh data jadi satu berkas JSON',
      '🛡️ App Check dipasang, syarat wajib AI mulai 2 November 2026',
      '📈 Analysis AI pasar: emas, Bitcoin, IHSG & kurs Dolar',
      '🍽️ Puasa baru lewat perjalanan tiga langkah, bukan formulir kosong',
      '🔎 Pencarian fitur, pintu darurat kalau Today terlalu ringkas',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-09-22',
    items: [
      '💰 Financial Awareness: pace tiap kategori, bukan cuma sisa budget',
      '🔒 Kunci budget bulanan, membukanya harus pakai alasan & tercatat',
      '🧠 Vix Financial Coach, membaca angka bulananmu lalu menjawab singkat',
      '👀 Quick Check saat transaksi hampir melewati budget kategorinya',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-09-21',
    items: [
      '🤖 AI Gemini gratis masuk app: notulen CORE, refleksi harian, Wheel of Life',
      '🚧 Pagar pemakaian AI: jeda, batas harian, berhenti sendiri saat kuota penuh',
      '🌅 Morning Journey tujuh langkah menggantikan gerbang doa pagi',
      '🙏 CORE: kalender, rekap visitasi, notulen bulanan & PDF per leader',
      '⛰️ Mountains & 🏁 Race masuk fitur Fun',
      '🔐 PIN privasi untuk layar yang isinya pribadi',
      '🧾 Riwayat pembelian token listrik',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-09-08',
    items: [
      '🚩 His Promise: mencatat janji Tuhan & kapan digenapi',
      '📚 Arsip Learning, catatan belajar yang lewat tidak hilang',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-09-04',
    items: [
      '⚽ Papan Sport untuk mengatur jadwal & pemain',
      '🙌 Gratitude, catatan syukur harian',
      '📞 Nomor penting tersimpan di satu tempat',
    ],
  },
  {
    version: '1.3.2',
    date: '2026-09-03',
    items: [
      '📱 Version pindah jadi layarnya sendiri, tidak lagi terkubur di System',
      '🩺 Checkup kesehatan & 📟 catatan perangkat',
      '🍽️ Puasa Hari per Hari, dicentang tiap malam',
      '📰 Berita tersimpan & 📿 Pause and Pray',
      '🏃 Sport & 📺 Creators YouTube',
      '🎁 Kartu pengingat bisa dibagikan jadi gambar',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-26',
    items: [
      '⬆️ Pindah ke Expo SDK 57 (React Native 0.86, arsitektur baru)',
      '💬 Template chat siap pakai',
      '🗂️ Project & sub-tugasnya',
      '📖 Catatan Khotbah jadi layar sendiri',
      '🎡 Wheel of Life bisa dicetak jadi PDF',
    ],
  },
  {
    version: '1.2.1',
    date: '2026-08-22',
    items: [
      '🎯 Daily Priority: tiga hal yang harus selesai hari ini',
      '🌱 Multiplication, memuridkan langkah per langkah',
      '📸 Foto dikecilkan dulu sebelum disimpan, biar hemat kuota',
      '🙏 Doa syafaat dari berita',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-19',
    items: [
      '📊 Dashboard & ✅ Habits jadi tab utama',
      '📖 Bible Reading tiga sesi sehari',
      '🍽️ Puasa, 🏅 streak, 😴 catatan tidur',
      '🎮 Games & 🌍 World',
      '📚 Learning, catatan belajar mingguan',
      '⚡ Pindah layar jadi lebih cepat & lebih hemat kuota',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-08-10',
    items: [
      '🏆 Tournament jadi tab utama',
      '👥 Daftar ex-leader CORE',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-10',
    items: [
      '💰 Finance naik jadi tab utama',
      '👤 Profile & 👣 catatan langkah harian',
      '📈 Harga pasar (emas) masuk app',
      '📊 Catatan pemakaian tiap fitur',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-08-04',
    items: [
      '📈 Investment: harga emas beserta grafiknya',
      '🏠 House berganti nama jadi Residence, plus perawatan berkala',
      '🔍 Cari & saring transaksi',
      '🧹 Pesan galat & tampilan memuat kini seragam di semua layar',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-08-03',
    items: [
      '📕 Book, daftar bacaan & kemajuannya',
      '🏠 House, catatan rumah',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-07-28',
    items: [
      '🎉 Fun & 💪 Fitness',
      '🩸 Blood Donor',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-07-27',
    items: [
      '✨ Tampilan & animasinya dirombak jadi lebih modern',
      '🤝 Lending, catatan pinjam-meminjam',
      '🌅 Doa pagi',
    ],
  },
  {
    version: '1.0.2',
    date: '2026-07-24',
    items: [
      '👨‍👩‍👧 Family & 💼 Career',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-07-23',
    items: [
      '✝️ Spiritual, 🏥 Health, 🙏 CORE, 🎡 Wheel of Life, 🚗 Car & 🪙 Trading',
      '🏆 Reward, lencana dari kebiasaan yang dijalani',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-22',
    items: [
      '🎂 Hari lahir aplikasi ini',
      '💰 Finance: transaksi, budget & Saku',
      '✅ Reminder',
      '🔥 Firebase, masuk dengan akun sendiri',
    ],
  },
];

/** Berapa perubahan yang pernah dicatat, seluruh versi digabung. */
export function changelogTotal(): number {
  return CHANGELOG.reduce((a, r) => a + r.items.length, 0);
}
