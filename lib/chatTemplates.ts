// Template chat 💬 — kata-kata siap kirim ke CORE Leader & grup CORE.
//
// Kenapa ada: momen-momen ini datang mendadak (ada yang berduka, ada yang
// sakit, ada yang wisuda) dan justru di situ sering bingung mau nulis apa —
// akhirnya cuma "turut berduka" satu baris, atau malah tidak jadi kirim sama
// sekali. Di sini kata-katanya sudah siap, tinggal pilih A/B/C yang paling
// pas dengan orangnya, lalu langsung dibuka di WhatsApp.
//
// ── Ucapan ulang tahun: DUA tempat, dan itu disengaja (28 Sep 2026) ───────
// Dulu di sini sengaja TIDAK ada ucapan ulang tahun, karena CORE Leader &
// Main Team sudah punya kartu ulang tahunnya sendiri di sub-tab Follow Up
// (lengkap dengan doa & undangan bercerita, lihat lib/core.ts).
//
// Yang tidak terpikir waktu itu: yang ulang tahun bukan cuma CL. Teman kuliah,
// teman kerja, teman seangkatan di gereja — untuk mereka tidak ada apa-apa,
// dan justru ke merekalah ucapan bergaya pelayanan terasa kaku. Jadi kategori
// 🎂 di bawah memang untuk SIAPA SAJA, nadanya jauh lebih santai, dan ia tidak
// menggantikan kartu ulang tahun CL — keduanya punya pembaca yang berbeda.
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

/**
 * 🪞 Hari meminta masukan ke CORE Leader (28 Sep 2026) — SABTU.
 *
 * Kenapa Sabtu, dan bukan hari lain:
 *   • Senin–Jumat mereka sedang di tengah kerja/kuliah; pertanyaan reflektif di
 *     sela itu dijawab seadanya ("baik kok kak"), dan jawaban seadanya justru
 *     lebih buruk daripada tidak bertanya.
 *   • Minggu penuh ibadah & pelayanan.
 *   • Sabtu satu-satunya hari yang di app ini sendiri sudah ditandai sebagai
 *     hari tenang (lihat Motivational Words hari Sabtu: "Ambil waktu untuk
 *     recharge"). Jawaban yang jujur butuh orang yang sedang tidak buru-buru.
 *
 * Angkanya mengikuti `Date.getDay()` (0 = Minggu), jadi 6 = Sabtu.
 */
export const FEEDBACK_DAY = 6;

/** Hari ini hari meminta masukan? */
export function isFeedbackDay(now = new Date()): boolean {
  return now.getDay() === FEEDBACK_DAY;
}

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

/**
 * Urutannya = urutan kartunya di layar, dari atas ke bawah.
 *
 * 🎂 Happy Birthday PALING ATAS (28 Sep 2026). Dulu 🔥 Motivational Words yang
 * di atas karena dikirim tiap pagi, tapi justru itu alasannya dipindah: yang
 * tiap hari sudah hafal di mana tempatnya, sedangkan ulang tahun datang
 * mendadak & harus segera dibalas — dan ia dulu duduk di urutan ke-12, harus
 * digulung jauh dulu. Motivational Words juga punya dua pintu lain yang tidak
 * lewat daftar ini: tombol di modal Follow Up (?cat=motivational) dan penanda
 * "hari ini" di dalam kategorinya.
 */
export const CHAT_CATEGORIES: ChatCategory[] = [
  {
    // 🎂 Ulang tahun UMUM — untuk teman, bukan khusus CL/Main Team.
    //
    // Gaya bahasanya sengaja jauh lebih santai daripada ucapan di kartu Follow
    // Up: tidak ada doa panjang, tidak ada "semakin dewasa rohani". Yang dikirim
    // ke teman seangkatan harus terdengar seperti dirimu waktu ngobrol, bukan
    // seperti sambutan.
    //
    // Empat pilihan supaya tidak semua orang menerima kalimat yang sama persis
    // — dan itu penting: ucapan yang jelas hasil salin-tempel terasa lebih
    // dingin daripada tidak mengucapkan sama sekali.
    key: 'ulangtahun',
    title: '🎂 Happy Birthday',
    hint: 'Untuk siapa saja, bukan cuma CL atau Main Team',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: 'HAPPY BIRTHDAY <nama>!! 🎉🎂 Wishing you all the best yaa, sehat terus, rezekinya ngalir, dan semua yang lagi diusahain jadi kenyataan. Tuhan Yesus berkati selaluu 🤍',
      },
      {
        key: 'B',
        text: 'Hbd <nama>! 🥳 Semoga tahun ini lebih banyak hal baik daripada hal yang bikin pusing wkwk. Sukses terus yaa, jangan lupa istirahat, dan tetap jadi orang baik 🙌✨',
      },
      {
        key: 'C',
        text: '<nama> ulang tahunnn 🎈 Selamat yaa! Makin bertambah umur, makin bertambah juga hikmat & damai sejahteranya. Semoga apa yang kamu doain diam-diam, Tuhan jawab tahun ini 🙏🎂',
      },
      {
        key: 'D',
        text: 'Happy birthday <nama>! 🎊 Thankyou udah jadi orang yang enak buat diajak cerita. Semoga tahun ini kamu dapet banyak kejutan yang bikin senyum. Gbu alwaysss 💛',
      },
    ],
  },
  {
    key: 'motivational',
    title: '🔥 Motivational Words',
    hint: 'Satu untuk tiap hari, kirim ke grup CORE Leaders tiap pagi',
    fields: ['nama'],
    byDay: true,
    variants: [
      {
        key: 'Senin',
        text: `Pagiiiii Semangat kerja di minggu baru, tetapp kuattt dan teguhhh!!! Bisa yokkk

📖 Yosua 1:9
Bukankah telah Kuperintahkan kepadamu: kuatkan dan teguhkanlah hatimu? Janganlah kecut dan tawar hati, sebab TUHAN, Allahmu, menyertai engkau, ke mana pun engkau pergi.`,
      },
      {
        key: 'Selasa',
        text: `Pagi <nama>! 🌱 Hal kecil yang dirimu lakukan hari ini bisa berdampak besar ke depan. Sooo.. semangatttttt mengerjakan hal2 yg terlihat kecilll

📖 Lukas 16:10
Barangsiapa setia dalam perkara-perkara kecil, ia setia juga dalam perkara-perkara besar. Dan barangsiapa tidak benar dalam perkara-perkara kecil, ia tidak benar juga dalam perkara-perkara besar.`,
      },
      {
        key: 'Rabu',
        text: `Selamat pagi <nama>! 🔥 Midweek biasanya mulai capek, tapi justru di sini kita dilatih untuk tetap konsisten. menyalaaaa Burn and Blaze!🔥

📖 Mazmur 28:7
TUHAN adalah kekuatanku dan perisaiku; kepada-Nya hatiku percaya. Aku tertolong sebab itu beria-ria hatiku, dan dengan nyanyianku aku bersyukur kepada-Nya.`,
      },
      {
        key: 'Kamis',
        text: `Pagiii!! Hari ini jangan cuma jalanin sbg rutinitas, tapi jalani dengan purpose!!

📖 Kolose 3:23
Apapun juga yang kamu perbuat, perbuatlah dengan segenap hatimu seperti untuk Tuhan dan bukan untuk manusia.`,
      },
      {
        key: 'Jumat',
        text: `Selamat pagi! ☀️ uda mo akhir minggu, mangatsss finish strong!

📖 Ibrani 12:11
Memang tiap-tiap ganjaran pada waktu ia diberikan tidak mendatangkan sukacita, tetapi dukacita. Tetapi kemudian ia menghasilkan buah kebenaran yang memberikan damai kepada mereka yang dilatih olehnya.`,
      },
      {
        key: 'Sabtu',
        text: `Pagi yang tenang 🌿 Ambil waktu untuk recharge, bukan cuma fisik tapi juga roh.

📖 Mazmur 62:2
Hanya dekat Allah saja aku tenang, dari pada-Nyalah keselamatanku.`,
      },
      {
        key: 'Minggu',
        text: `Selamat hari Minggu! 🙏 Hari untuk kembali diingatkan siapa sumber hidup kita. Semangatt meng Restoring Energy🔋⚡

📖 Matius 11:28
Marilah kepada-Ku, semua yang letih lesu dan berbeban berat, Aku akan memberi kelegaan kepadamu.`,
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
        text: 'Selamatt wisuda <nama>, <gelar>! 🎓🎉 Skripsi, revisi, begadang, kebayar semua hari ini. Bangga bangett sama kamu! Tuhan buka pintu-pintu berikutnya yaa 🙏✨',
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
        text: 'Wahh selamat <nama>! 🙌 Babak baru, tantangan baru. Kerjain dengan segenap hati kayak untuk Tuhan yaa, pasti kelihatan bedanya ✨',
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
    // 🪞 Minta masukan — SATU-SATUNYA kategori yang arahnya masuk, bukan
    // keluar: semua kategori lain kamu yang menguatkan orang lain, yang ini
    // kamu yang minta dikoreksi.
    //
    // Kenapa ini ada: kamu menggembalakan sepuluh CORE Leader, dan merekalah
    // satu-satunya orang yang benar-benar melihat cara kamu memimpin dari
    // dekat. Kalau tidak pernah diminta, masukan itu tidak akan datang sendiri
    // — bukan karena tidak ada, tapi karena sungkan.
    //
    // Nadanya sengaja membuka pintu selebar-lebarnya (menyebut "jujur aja",
    // "gak bakal baper", memberi contoh hal konkret yang boleh dikritik).
    // Pertanyaan "ada masukan?" yang polos hampir selalu dijawab "aman kok".
    key: 'feedback',
    title: '🪞 Minta Masukan',
    hint: 'Minta koreksi dari CORE Leader soal caramu memimpin & menggembalakan',
    fields: ['nama'],
    variants: [
      {
        key: 'A',
        text: '<nama>, boleh minta tolong satu hal? 🙏 Aku mau minta masukan soal caraku menggembalakan kalian. Apa yang menurutmu udah oke, dan apa yang sebaiknya aku perbaiki? Jujur aja, aku gak bakal baper, justru aku butuh banget 🤍',
      },
      {
        key: 'B',
        text: 'Halo <nama>! 😄 Aku lagi evaluasi diri nih sebagai leader. Menurut kamu, aku kurangnya di mana ya? Entah cara chat, cara bawa CORE, atau pas follow up. Sekecil apa pun bantu banget buat aku bertumbuh 🌱',
      },
      {
        key: 'C',
        text: '<nama>, aku boleh nanya serius? 🤔 Kalau kamu jadi aku, apa satu hal yang kamu ubah dari cara aku mimpin CORE? Aku beneran mau denger, bukan basa-basi. Makasih yaa udah mau jujur 🙌',
      },
      {
        key: 'D',
        text: 'Hai <nama> 👋 Aku manusia biasa dan pasti banyak salahnya. Kalau ada sikap atau ucapanku yang pernah bikin kamu gak nyaman, tolong kasih tau yaa. Aku mau memperbaiki, bukan membela diri 🙏',
      },
    ],
  },
  {
    key: 'ajakan',
    title: '📣 Ajakan Datang CORE',
    hint: 'Untuk dikirim ke grup, mengingatkan & memanggil pulang',
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
        text: 'Guysss, ditunggu di CORE yaa! 🙌 Gak perlu datang dalam keadaan sempurna, datang aja apa adanya, Tuhan yang kerjain sisanya 🤍',
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
