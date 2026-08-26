// Template chat 💬 — kata-kata siap kirim ke CORE Leader & grup CORE.
//
// Kenapa ada: momen-momen ini datang mendadak (ada yang berduka, ada yang
// sakit, ada yang wisuda) dan justru di situ sering bingung mau nulis apa —
// akhirnya cuma "turut berduka" satu baris, atau malah tidak jadi kirim sama
// sekali. Di sini kata-katanya sudah siap, tinggal pilih A/B/C yang paling
// pas dengan orangnya, lalu langsung dibuka di WhatsApp.
//
// TIDAK ada ucapan ulang tahun di sini — itu sudah punya tempatnya sendiri
// (kartu ulang tahun di sub-tab Follow Up, lengkap dengan doa & undangannya).
// Menyalinnya ke sini justru bikin dua versi yang gampang jadi beda.
//
// Semua teks tersimpan di kode, bukan di Firestore: isinya tidak berubah-ubah
// dan tidak perlu disinkronkan antar-perangkat — jadi nol pembacaan.

/** Kolom yang perlu diisi sebelum teksnya siap kirim. */
export type ChatField = 'nama' | 'gelar';

export type ChatVariant = {
  /** Penanda pilihan — 'A'/'B'/'C', atau nama hari untuk Motivational Words. */
  key: string;
  text: string;
};

export type ChatCategory = {
  key: string;
  title: string;
  /** Satu baris penjelas: kapan kategori ini dipakai. */
  hint: string;
  fields: ChatField[];
  /**
   * Pilihannya per HARI, bukan A/B/C. Layar akan menyorot hari ini supaya
   * tidak perlu mencari sendiri tiap pagi.
   */
  byDay?: boolean;
  variants: ChatVariant[];
};

/** Nama hari, urut sesuai `Date.getDay()` (0 = Minggu). */
export const DAY_NAMES = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

export const CHAT_CATEGORIES: ChatCategory[] = [
  {
    key: 'motivational',
    title: '🔥 Motivational Words',
    hint: 'Satu untuk tiap hari — kirim ke grup CORE Leaders tiap pagi',
    fields: ['nama'],
    byDay: true,
    variants: [
      {
        key: 'Senin',
        text: `Pagiiiii Semangat kerja di minggu baru, tetapp kuattt dan teguhhh!!! Bisa yokkk

📖 Yosua 1:9
Bukankah telah Kuperintahkan kepadamu: kuatkan dan teguhkanlah hatimu? Janganlah kecut dan tawar hati, sebab TUHAN, Allahmu, menyertai engkau, ke mana pun engkau pergi.

➡️ Apapun yang kamu hadapi minggu ini, ingat: Tuhan jalan bareng kamu. Be strong, let's go! 💪`,
      },
      {
        key: 'Selasa',
        text: `Pagi <nama>! 🌱 Hal kecil yang dirimu lakukan hari ini bisa berdampak besar ke depan. Sooo.. semangatttttt mengerjakan hal2 yg terlihat kecilll

📖 Lukas 16:10
Barangsiapa setia dalam perkara-perkara kecil, ia setia juga dalam perkara-perkara besar. Dan barangsiapa tidak benar dalam perkara-perkara kecil, ia tidak benar juga dalam perkara-perkara besar.

➡️ Tuhan lihat kesetiaanmu, bahkan yang tidak dilihat orang. Tetap lakukan dengan hati yang benar 🙌`,
      },
      {
        key: 'Rabu',
        text: `Selamat pagi <nama>! 🔥 Midweek biasanya mulai capek, tapi justru di sini kita dilatih untuk tetap konsisten. menyalaaaa Burn and Blaze!🔥

📖 Mazmur 28:7
TUHAN adalah kekuatanku dan perisaiku; kepada-Nya hatiku percaya. Aku tertolong sebab itu beria-ria hatiku, dan dengan nyanyianku aku bersyukur kepada-Nya.

➡️ Kamu bukan orang yang lemah. Ada kuasa Tuhan dalam dirimu. Stay strong & keep going!`,
      },
      {
        key: 'Kamis',
        text: `Pagiii!! Hari ini jangan cuma jalanin sbg rutinitas, tapi jalani dengan purpose!!

📖 Kolose 3:23
Apapun juga yang kamu perbuat, perbuatlah dengan segenap hatimu seperti untuk Tuhan dan bukan untuk manusia.

➡️ Apa yang kamu lakukan hari ini, lakukan untuk Tuhan. Itu yang membuat hidupmu berbeda ✨`,
      },
      {
        key: 'Jumat',
        text: `Selamat pagi! ☀️ uda mo akhir minggu, mangatsss finish strong!

📖 Ibrani 12:11
Memang tiap-tiap ganjaran pada waktu ia diberikan tidak mendatangkan sukacita, tetapi dukacita. Tetapi kemudian ia menghasilkan buah kebenaran yang memberikan damai kepada mereka yang dilatih olehnya.

➡️ Proses mungkin gak enak, tapi hasilnya pasti indah. Jangan berhenti di tengah jalan 🙏`,
      },
      {
        key: 'Sabtu',
        text: `Pagi yang tenang 🌿 Ambil waktu untuk recharge, bukan cuma fisik tapi juga roh.

📖 Mazmur 62:2
Hanya dekat Allah saja aku tenang, dari pada-Nyalah keselamatanku.

➡️ Di tengah kesibukan, balik lagi ke Tuhan. Di situ kamu dipulihkan 🕊️`,
      },
      {
        key: 'Minggu',
        text: `Selamat hari Minggu! 🙏 Hari untuk kembali diingatkan siapa sumber hidup kita. Semangatt meng Restoring Energy🔋⚡

📖 Matius 11:28
Marilah kepada-Ku, semua yang letih lesu dan berbeban berat, Aku akan memberi kelegaan kepadamu.

➡️ Datang ke Tuhan hari ini, bawa semua bebanmu. Dia siap memulihkan dan menguatkanmu kembali 🤍`,
      },
    ],
  },
  {
    key: 'duka',
    title: '🕊️ Kedukaan',
    hint: 'Saat ada yang kehilangan orang terkasih',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: 'Turut berdukacita ya <nama>, semoga kamu & keluarga dikuatkan serta dihiburkan oleh Tuhan Yesus 🙏💛💜💚🤍💙🧡🩵🖤',
      },
      {
        key: 'B',
        text: 'Ikut berdukacita <nama>, kiranya kasih & damai sejahtera Tuhan melingkupi keluarga besar. Stay strong yaa 🙏✨',
      },
      {
        key: 'C',
        text: 'So sorry for your loss, <nama> 🤍 Tuhan beri kekuatan & penghiburan yang sempurna di tengah keluarga 🙏',
      },
    ],
  },
  {
    key: 'sakit',
    title: '🍀 Get Well Soon',
    hint: 'Saat ada yang sakit atau lagi dirawat',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: 'Cepat sembuh <nama> 💪✨ Tuhan pulihkan dan sembuhkan segera. Semangat terusss! 🙏 Jehova Rapha!',
      },
      {
        key: 'B',
        text: 'Get well soon bestieee <nama> 🌸 jangan lupa istirahat cukup yaa, biar bisa balik aktif & seru lagi bareng2! 💕',
      },
      {
        key: 'C',
        text: "Semoga cepet pulih ya <nama> 🥺🤍 Tuhan kasih kekuatan & kesehatan penuh. We're pray for youuu! 💪🙌 Jehova Rapha!",
      },
    ],
  },
  {
    key: 'wisuda',
    title: '🎓 Happy Graduation',
    hint: 'Mis. S.Kom.',
    fields: ['nama', 'gelar'],
    variants: [
      {
        key: 'A',
        text: 'Selamatt wisuda <nama>, <gelar>! 🎓🎉 Skripsi, revisi, begadang — kebayar semua hari ini. Bangga bangett sama kamu! Tuhan buka pintu-pintu berikutnya yaa 🙏✨',
      },
      {
        key: 'B',
        text: 'Congratsss <nama>, <gelar>! 🎓🔥 Gelarnya udah nempel, sekarang waktunya bikin dampak. Semoga langkah berikutnya makin dituntun Tuhan. Proud of youuu! 💛',
      },
      {
        key: 'C',
        text: 'Akhirnyaaa <nama>, <gelar>! 🎓🥳 Bukan cuma lulus, tapi lulus lewat proses yang bikin kamu bertumbuh. Sukses terus buat babak selanjutnya 🙌🙏',
      },
    ],
  },
  {
    key: 'wedding',
    title: '💍 Happy Wedding',
    hint: 'Saat ada yang menikah',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: 'Selamat menempuh hidup baru <nama>! 💍✨ Semoga rumah tangganya penuh kasih, sabar, dan ketawa bareng terus. Tuhan Yesus yang jadi pusatnya yaa 🙏💛',
      },
      {
        key: 'B',
        text: 'Happy weddingggg <nama> 🥳💍 Welcome to the next level! Semoga makin kompak, makin saling menguatkan, dan jadi keluarga yang jadi berkat buat banyak orang 🙌',
      },
      {
        key: 'C',
        text: 'Congrats <nama> & pasangan! 💒🤍 Doaku: cintanya awet, komunikasinya sehat, dan Tuhan selalu jadi dasar rumah tangga kalian. Bahagia terusss 🙏✨',
      },
    ],
  },
  {
    key: 'bisnis',
    title: '💼 Sukses Bisnis Baru',
    hint: 'Saat ada yang mulai usaha atau buka toko',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: 'Selamat yaa <nama> buat bisnis barunya! 💼🔥 Semoga lancar, rezekinya ngalir, dan jadi berkat buat banyak orang. Tuhan yang buka pintunya 🙏✨',
      },
      {
        key: 'B',
        text: 'Wihh keren <nama>, akhirnya jalan juga usahanya! 🚀 Semangat terus, jatuh bangun itu bagian prosesnya. Tuhan kasih hikmat & pelanggan yang tepat 🙌',
      },
      {
        key: 'C',
        text: 'Congrats buat usaha barunya <nama>! 💼🌱 Mulai dari kecil gapapa, yang penting setia. Semoga bertumbuh besar dan Tuhan yang cukupkan segalanya 🙏',
      },
    ],
  },
  {
    key: 'kerja',
    title: '🧑‍💻 Kerja Baru / Promosi',
    hint: 'Saat ada yang diterima kerja atau naik jabatan',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: 'Selamat buat kerjaan barunya <nama>! 🎉💼 Semoga betah, timnya asik, dan kamu jadi terang di tempat itu. All the best yaa 🙏✨',
      },
      {
        key: 'B',
        text: 'Congrats <nama> atas promosinya! 🔥📈 Tanggung jawab makin besar, tapi aku yakin kamu mampu. Tuhan kasih hikmat & kekuatan tiap hari 💪🙏',
      },
      {
        key: 'C',
        text: 'Wahh selamat <nama>! 🙌 Babak baru, tantangan baru. Kerjain dengan segenap hati kayak untuk Tuhan yaa — pasti kelihatan bedanya ✨',
      },
    ],
  },
  {
    key: 'newborn',
    title: '👶 Kelahiran Anak',
    hint: 'Saat ada yang baru punya bayi',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: 'Selamat atas kelahiran buah hatinya <nama>! 👶💕 Semoga sehat terus ibu & bayinya, tumbuh jadi anak yang takut akan Tuhan 🙏✨',
      },
      {
        key: 'B',
        text: 'Congratss <nama>, welcome to parenthood! 🍼🥳 Siap-siap begadang tapi bahagia hehe. Tuhan berkati keluarga kecilnya 💛',
      },
      {
        key: 'C',
        text: 'Selamat yaa <nama>! 👶🤍 Anugerah Tuhan yang paling manis. Semoga dimampukan jadi orang tua yang penuh kasih & sabar 🙏',
      },
    ],
  },
  {
    key: 'berat',
    title: '🫂 Lagi Berat',
    hint: 'Saat ada yang down, kecewa, atau butuh dikuatkan',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: '<nama>, aku tau lagi berat banget yaa 🫂 Gapapa kalau hari ini cuma bisa bertahan. Kamu gak sendirian, aku doain terus 🙏💛',
      },
      {
        key: 'B',
        text: 'Hei <nama>, jangan dipendam sendiri yaa. Kalau mau cerita aku siap dengerin, kapan pun 🤍 Tuhan gak pernah ninggalin kamu, sekalipun rasanya sepi 🙏',
      },
      {
        key: 'C',
        text: '<nama>, badai ini gak selamanya. Pelan-pelan aja, satu hari satu langkah. Aku percaya Tuhan lagi kerjain sesuatu di balik ini 🙌✨',
      },
    ],
  },
  {
    key: 'apresiasi',
    title: '🙌 Terima Kasih & Apresiasi',
    hint: 'Saat mau menghargai pelayanan & kesetiaan mereka',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: 'Makasih banyak yaa <nama> buat pelayanannya 🙌 Kelihatan banget kamu kerjain dengan hati. Tuhan yang balas semua lelahmu 🙏💛',
      },
      {
        key: 'B',
        text: '<nama>, aku appreciate banget kesetiaanmu selama ini ✨ Yang orang gak lihat, Tuhan lihat semua. Proud punya CL kayak kamu 🔥',
      },
      {
        key: 'C',
        text: 'Thank you <nama>! 🤍 Kehadiranmu bikin CORE makin hidup. Semangat terus yaa, jangan capek berbuat baik 🙏',
      },
    ],
  },
  {
    key: 'ajakan',
    title: '📣 Ajakan Datang CORE',
    hint: 'Untuk dikirim ke grup — mengingatkan & memanggil pulang',
    fields: [],
    variants: [
      {
        key: 'A',
        text: 'Halooo semuaa 👋 Jangan lupa CORE kita nanti yaa! Datang, bawa cerita minggu ini, kita saling menguatkan 🔥🙏',
      },
      {
        key: 'B',
        text: 'Reminder CORE yaa gengs 📣 Yuk sempatkan hadir, walau lagi capek. Justru di situ kita di-recharge lagi 🔋✨',
      },
      {
        key: 'C',
        text: 'Guysss, ditunggu di CORE yaa! 🙌 Gak perlu datang dalam keadaan sempurna — datang aja apa adanya, Tuhan yang kerjain sisanya 🤍',
      },
    ],
  },
];

/**
 * Ganti penanda `<nama>` & `<gelar>` dengan isian yang sudah diketik.
 *
 * Yang belum diisi DIBIARKAN apa adanya — jadi penandanya masih kelihatan di
 * WhatsApp dan tinggal diketik di sana. Ini disengaja: lebih baik terlihat
 * "masih ada yang harus diisi" daripada terkirim jadi kalimat rumpang.
 */
export function fillTemplate(
  text: string,
  values: Partial<Record<ChatField, string>>,
): string {
  let out = text;
  for (const field of ['nama', 'gelar'] as ChatField[]) {
    const value = values[field]?.trim();
    if (value) out = out.split(`<${field}>`).join(value);
  }
  return out;
}

/** Masih ada penanda yang belum diisi? Untuk peringatan halus di layar. */
export function hasPlaceholder(text: string): boolean {
  return /<nama>|<gelar>/.test(text);
}

/** Nama hari ini — untuk menyorot Motivational Words yang pas. */
export function todayName(now = new Date()): string {
  return DAY_NAMES[now.getDay()];
}
