import { Timestamp } from 'firebase/firestore';

import {
  type Multiplication,
  type MultiMember,
  type MultiSide,
  type MultiStep,
} from './multiplication';

// Isi awal fitur Multiplikasi 🌱 — SALINAN dari spreadsheet multiplikasi yang
// selama ini kamu pegang (timeline CORE Victor–Cevo, Sarah–Reyki, Theofilus–
// Riky, plus pembagian anggota Febryna–Elvina & Novia–David).
//
// Ditulis di kode, BUKAN diketik ulang di HP: isinya ratusan baris dan
// mengetiknya di layar kecil itu jalan tercepat menuju salah ketik. Begitu
// tersimpan sekali, datanya jadi milik Firestore sepenuhnya — bebas kamu ubah,
// tambah, atau hapus dari dalam app, dan berkas ini tidak pernah menimpanya
// lagi (lihat `seedMultiplications`: hanya jalan kalau daftarnya masih KOSONG).

/** '✅' beres (bawaan) · '❌' batal atau digeser · '⏳' belum dikerjakan. */
type Mark = '❌' | '⏳';

type SeedStep = {
  /** [tahun, bulan 1–12, tanggal] */
  on: [number, number, number];
  title: string;
  mark?: Mark;
  notes?: string[];
};

/** [nama, umur, alasan] */
type SeedMember = [string, number | null, string];

type Seed = {
  id: string;
  fromName: string;
  fromHeart: string;
  toName: string;
  toHeart: string;
  meetingDate?: [number, number, number];
  firstCoreDate?: [number, number, number];
  day?: string;
  place?: string;
  steps?: SeedStep[];
  a?: SeedMember[];
  b?: SeedMember[];
  out?: SeedMember[];
  other?: SeedMember[];
};

const SEEDS: Seed[] = [
  // ==================== ❤️ CORE Victor & CORE Cevo ====================
  // Hati CORE Cevo belum pernah kamu sebut, jadi sengaja dikosongkan —
  // tinggal diisi lewat tombol ubah di kartunya.
  {
    id: 'multi-victor-cevo',
    fromName: 'Victor',
    fromHeart: '❤️',
    toName: 'Cevo',
    toHeart: '',
    firstCoreDate: [2026, 2, 6],
    steps: [
      { on: [2025, 10, 17], title: 'Last Visitation Ps. Ery ke CORE Victor' },
      { on: [2025, 10, 18], title: 'Charity CORE Victor' },
      {
        on: [2025, 10, 31],
        title: 'CORE Gabungan',
        notes: ['Announce CL Victor move to NBB'],
      },
      {
        on: [2025, 11, 1],
        title: 'Discuss about Multiplication Plan (Imanuel, Victor, and Cevo)',
      },
      {
        on: [2025, 11, 15],
        title: 'Mentoring MCL CL',
        notes: ['Announce CL Victor last Mentoring on 6 December 2025'],
      },
      {
        on: [2025, 11, 28],
        title: 'Last Visitation CORE Victor as MCL',
        notes: ['Sharing Firman dan Doa Syafaat'],
      },
      {
        on: [2025, 12, 1],
        title: 'Last Meeting Kelompok “Men of Light” (CCL Cevo)',
      },
      {
        on: [2025, 12, 6],
        title: 'Mentoring MCL CL bulan Desember',
        notes: ['Last CL Victor Mentoring', 'Cevo & Reyki can join'],
      },
      {
        on: [2025, 12, 9],
        title: 'Move sistem CL Victor to CORE Under MCL Steven Gunawan',
        notes: [
          'Victor left WAG MCL Imanuel',
          'Victor join WAG MCL Steven',
          'Imanuel left WAG CORE Victor',
          'Steven join WAG CORE Victor',
        ],
      },
      {
        on: [2025, 12, 13],
        title: 'Christmas Dinner CORE Victor',
        notes: ['Announce tanggal GCORE & Multiplikasi Cevo'],
      },
      {
        on: [2025, 12, 14],
        title: 'Victor start followup CM',
        notes: ['Deadline on 6 January 2026'],
      },
      { on: [2026, 1, 6], title: 'Fix Grouping All CORE Member' },
      {
        on: [2026, 1, 9],
        title: 'Announce CORE Member Victor & CORE Cevo at CORE Victor',
      },
      {
        on: [2026, 1, 16],
        title: 'Last Fellowship CORE Victor with Cevo (Libur Isra’ Mi’raj)',
      },
      {
        on: [2026, 1, 23],
        title: 'GCORE Victor (Bandung)',
        notes: ['Jumat–Minggu, 23–25 Januari 2026'],
      },
      { on: [2026, 1, 30], title: 'Last Cevo at CORE Victor', mark: '⏳' },
      {
        on: [2026, 2, 3],
        title: 'Ko Steven email CORE Pusat',
        mark: '⏳',
        notes: [
          '31 Januari CL Cevo buka sistem di app',
          'Bubar WAG CORE Victor',
          'Bubar WAG CL MT CORE Victor',
          'Buat WAG CORE Victor (new) — Invite MCL Steven Gunawan',
          'Buat WAG CORE Cevo — Invite MCL Steven Gunawan',
        ],
      },
      {
        on: [2026, 2, 4],
        title:
          'Cevo buka sistem CORE under MCL Steven Gunawan / Victor Nathanael',
        mark: '⏳',
        notes: ['Di catatanmu tertulis “Rabu, 4 Jan” — Rabu-nya jatuh 4 Februari'],
      },
      { on: [2026, 2, 6], title: 'CORE Perdana CL Cevo', mark: '⏳' },
    ],
  },

  // ==================== 🧡 CORE Sarah & CORE Reyki 🖤 ====================
  {
    id: 'multi-sarah-reyki',
    fromName: 'Sarah',
    fromHeart: '🧡',
    toName: 'Reyki',
    toHeart: '🖤',
    meetingDate: [2025, 11, 13],
    firstCoreDate: [2026, 1, 28],
    day: 'Rabu',
    place: 'Ruang Meeting Kecil, NDC Soho Capital',
    steps: [
      { on: [2025, 11, 1], title: 'Training Calon CORE Leader Sesi 1 & 2' },
      { on: [2025, 11, 8], title: 'Training Calon CORE Leader Sesi 3 & 4' },
      {
        on: [2025, 11, 13],
        title: 'Discuss about Multiplication Plan (Imanuel, Sarah, and Reyki)',
      },
      { on: [2025, 12, 6], title: 'Mentoring MCL CL bulan Desember' },
      { on: [2025, 12, 17], title: 'Last CORE tahun 2025' },
      {
        on: [2025, 12, 20],
        title: 'Christmas Dinner CORE Sarah',
        notes: [
          'Announce tanggal Fellowship CORE ke Kepulauan Seribu',
          'Announce tanggal Multiplikasi CORE Reyki',
        ],
      },
      {
        on: [2025, 12, 21],
        title: 'Sarah start followup CM',
        notes: ['Deadline: 4 Januari 2026'],
      },
      { on: [2026, 1, 3], title: 'Mentoring MCL CL bulan Januari' },
      { on: [2026, 1, 4], title: 'Fix Grouping All CORE Member' },
      {
        on: [2026, 1, 7],
        title: 'First CORE tahun 2026',
        notes: [
          'Announce Fix CORE Member Sarah & CORE Member Reyki',
          'Announcement dilakukan di CORE & WAG CORE Sarah',
        ],
      },
      {
        on: [2026, 1, 9],
        title: 'Reyki Last Meeting CL MT CORE Sarah',
        mark: '❌',
        notes: ['Digeser ke Senin, 26 Januari 2026'],
      },
      {
        on: [2026, 1, 10],
        title: 'Meeting Perdana CL MT CORE Reyki',
        mark: '❌',
        notes: ['Digeser ke Senin, 26 Januari 2026'],
      },
      {
        on: [2026, 1, 11],
        title: 'Reyki Last Ibadah with CORE Sarah',
        mark: '❌',
        notes: ['Digeser ke Minggu, 18 Januari 2026'],
      },
      {
        on: [2026, 1, 17],
        title: 'Reyki Last Fellowship CORE Sarah (Kepulauan Seribu)',
        mark: '❌',
        notes: ['Batal — diganti di R. Tifara, NDC Central Park'],
      },
      {
        on: [2026, 1, 17],
        title: 'Reyki Last Fellowship CORE Sarah (R. Tifara, NDC Central Park)',
      },
      { on: [2026, 1, 18], title: 'Reyki Last Ibadah with CORE Sarah' },
      {
        on: [2026, 1, 19],
        title: 'Imanuel email CORE Pusat',
        mark: '❌',
        notes: ['Digeser ke Kamis, 22 Januari 2026'],
      },
      { on: [2026, 1, 21], title: 'Last CORE Reyki at CORE Sarah' },
      {
        on: [2026, 1, 22],
        title: 'Imanuel email CORE Pusat · CL Reyki buka sistem di app',
        notes: [
          'Bubar WAG CORE Sarah',
          'Bubar WAG CL MT CORE Sarah',
          'Buat WAG CORE Sarah (new)',
          'Buat WAG CORE Reyki',
        ],
      },
      {
        on: [2026, 1, 26],
        title: 'Reyki Last Meeting CL MT CORE Sarah',
        notes: ['Meeting Perdana CL MT CORE Reyki'],
      },
      { on: [2026, 1, 28], title: 'CORE Perdana Reyki' },
    ],
    a: [
      ['Sarah Lucia Dolorosa Zega', 27, 'CORE Leader'],
      ['Angelita Febriani Debora Regar', 22, 'Main Team'],
      ['Tanaya Widi Taneksie', 22, 'Ingin CORE Leadernya cewek'],
      ['Jordan Yussac Haryanto', 23, 'Main Team'],
      ['Billy Waworuntu', 24, 'Lebih dekat dengan Sarah'],
      ['Jonathan (Jojo)', 24, 'Lebih cocok dengan Sarah'],
      ['Sofia Maspaitella', 25, 'Lebih dekat dengan Sarah'],
      ['Yofita', 25, 'Umur lebih cocok dengan Sarah'],
      ['Daniel', 26, 'Umur lebih cocok dengan Sarah'],
      ['Valeri Violeta', 26, 'Pasangannya Wilson'],
      ['Wilson Kusnadi', 26, 'Lebih cocok dengan Sarah'],
      ['Cindy', 27, 'Umur lebih cocok dengan Sarah'],
      ['Christofer Julio', 20, 'Jika tidak jadi pindah, tetap di CORE'],
      ['Kayla Keira Walewangko', 21, 'Pindah dari CORE Lanemey'],
    ],
    b: [
      ['Gede Reyki Astika', 23, 'CORE Leader'],
      ['Rafli Dwi Putra', 23, 'Dekat dengan Leonardus'],
      ['Tommy Prayitno', 23, 'Kesempatan utk grow up pelayanan'],
      ['Vaneza Angelica Citra', 23, 'Pasangannya Rafli'],
      ['Chelsea M', 24, 'Bantu melayani'],
      ['Leonardus', 24, 'Main Team'],
      ['Thessa Lonika', 24, 'Dekat dengan Meidi'],
      ['Juhari VS', 25, 'Bantu melayani jadi WL'],
      ['Meidiana Mega', 25, 'Bantu melayani, bagian keuangan'],
      ['Victorius Hermawan', 25, 'Support Reyki'],
      ['Theresia Aloina', 26, 'Main Team'],
    ],
  },

  // ================= 🩵 CORE Theofilus & CORE Riky 🤎 =================
  {
    id: 'multi-theofilus-riky',
    fromName: 'Theofilus',
    fromHeart: '🩵',
    toName: 'Riky',
    toHeart: '🤎',
    meetingDate: [2026, 4, 21],
    firstCoreDate: [2026, 6, 24],
    day: 'Rabu',
    place: 'Ruang 1, NDC Kids, NDC Central Park',
    steps: [
      { on: [2026, 4, 8], title: 'Training Calon CORE Leader Sesi 1' },
      { on: [2026, 4, 11], title: 'Mentoring MCL CL bulan April' },
      { on: [2026, 4, 15], title: 'Training Calon CORE Leader Sesi 2' },
      {
        on: [2026, 4, 21],
        title:
          'Discuss about Multiplication Plan (Imanuel, Theofilus, and Riky)',
      },
      { on: [2026, 4, 22], title: 'Training Calon CORE Leader Sesi 3' },
      { on: [2026, 4, 29], title: 'Training Calon CORE Leader Sesi 4' },
      { on: [2026, 5, 8], title: 'Meeting CL MT CORE Theofilus' },
      { on: [2026, 5, 9], title: 'Mentoring MCL CL bulan Mei' },
      { on: [2026, 5, 13], title: 'Announce tanggal Multiplikasi CORE Riky' },
      {
        on: [2026, 5, 14],
        title: 'Theofilus start followup CM',
        notes: ['Deadline: 2 Juni 2026'],
      },
      {
        on: [2026, 6, 3],
        title: 'Fix Grouping All CORE Member',
        notes: [
          'Announce Fix CORE Member Theofilus & CORE Member Riky',
          'Announcement dilakukan di CORE & WAG CORE Theofilus',
        ],
      },
      {
        on: [2026, 6, 10],
        title: 'Pastor & MCL Visitation CORE Theofilus',
        mark: '❌',
      },
      { on: [2026, 6, 13], title: 'Mentoring MCL CL bulan Juni with Ps. Ery' },
      {
        on: [2026, 6, 14],
        title: 'Riky Last Meeting CL MT CORE Theofilus',
        notes: ['Meeting Perdana CL MT CORE Riky'],
      },
      { on: [2026, 6, 17], title: 'Last CORE Riky at CORE Theofilus' },
      {
        on: [2026, 6, 18],
        title: 'Imanuel email CORE Pusat',
        notes: ['CL Riky buka sistem di app'],
      },
      {
        on: [2026, 6, 20],
        title: 'Riky Last Fellowship CORE Theofilus',
        notes: ['Moment Multiplication CORE'],
      },
      {
        on: [2026, 6, 21],
        title: 'Bubar & buat WAG',
        notes: [
          'Bubar WAG CORE Theofilus',
          'Bubar WAG CL MT CORE Theofilus',
          'Buat WAG CORE Theofilus (new)',
          'Buat WAG CORE Riky',
        ],
      },
      { on: [2026, 6, 24], title: 'CORE Perdana Riky' },
      {
        on: [2026, 7, 18],
        title: 'CORE Leader Meeting',
        mark: '⏳',
        notes: ['Riky dilantik'],
      },
      {
        on: [2026, 8, 1],
        title: 'Riky pulang ke Ketapang, Kalimantan Barat',
        mark: '⏳',
        notes: ['Di catatanmu: “Week 1, Agustus 2026” — tanggal pastinya belum ada'],
      },
      { on: [2026, 9, 16], title: 'Riky kembali CORE', mark: '⏳' },
    ],
    a: [
      ['Theofilus Teguh Prasetya', 29, 'CORE Leader'],
      ['Mikha', 24, 'Tempat CORE dekat dgn kantor'],
      ['Samel Basyayev', 24, 'Lebih cocok dengan Theo'],
      ['Felix Rizki Tanusa', 25, 'Main Team'],
      ['Ika', 25, 'Anak baru join CORE Theo'],
      ['Michael Marcello Tuwanakotta', 25, 'Lebih cocok dengan Theo'],
      ['Cynthia Amanda', 26, 'Anak baru join CORE Theo'],
      ['Gabriella Gloria Lasut', 26, 'Teman dekat dengan Cynthia'],
      ['Tia JPN', 27, 'Main Team'],
      ['Jessica', 28, 'Lebih cocok dengan Theo'],
      ['Michael Jeremiah Valentino', 28, 'Main Team'],
      ['Handy Hintoro', 33, 'Umur lebih cocok dengan Theo'],
    ],
    b: [
      ['Riky Lesmana Theseru', 25, 'CORE Leader'],
      ['Chintya Carissa Manurung', 23, 'Teman dekat dengan Stella'],
      ['Chrestella Ignacia Tanadi', 23, 'Main Team'],
      ['Della Puspita', 23, 'Main Team'],
      ['Jesusha Glory', 24, 'Bantu melayani jadi WL'],
      ['Nathania Joyce Irene', 24, 'Teman dekat dengan Stella'],
      ['Albert Dicky Pratama', 25, 'Pasangannya Della'],
      ['Jeremia Timotius Kaligis', 27, 'Tempat CORE dekat dgn kantor'],
      ['Jesse Lumbantobing', 27, 'Bantu melayani jadi Pemusik'],
      ['Debri Luky', 28, 'Pasangannya Jesse'],
    ],
  },

  // ================= 💛 CORE Febryna & CORE Elvina 🤍 =================
  // Timeline-nya tidak ada di catatan yang kamu kirim — yang tercatat baru dua
  // tonggaknya. Sisanya tinggal ditambah lewat tombol “Tambah langkah”.
  {
    id: 'multi-febryna-elvina',
    fromName: 'Febryna',
    fromHeart: '💛',
    toName: 'Elvina',
    toHeart: '🤍',
    meetingDate: [2024, 11, 5],
    firstCoreDate: [2025, 1, 10],
    day: 'Jumat',
    place: 'Ruang 1, NDC Central Park',
    steps: [
      { on: [2024, 11, 5], title: 'Multiplication Meeting' },
      { on: [2025, 1, 10], title: 'CORE Perdana Elvina' },
    ],
    a: [
      ['Wellington Wilson', 28, 'Lebih dekat dengan Febryna'],
      ['Yafet Agustinus', 26, 'Main Team'],
      ['Febryna Sembiring', 25, 'CORE Leader'],
      ['Valensia Tedjanegara', 25, 'Entar lagi pindah Gereja, karena menikah'],
      ['Yuriska Marcella', 25, 'Lebih dekat dengan Febryna'],
      ['Bela Meilinda Phangestu', 24, 'Pasangannya Yafet'],
      ['Clearesta Jesslyn Wiyono', 24, 'Pisah dari Aileen'],
      ['Vincent Andian', 24, 'Tantang jika ingin next level'],
      ['Richie', 23, 'Main Team'],
      ['Michelle Angelia', 23, 'Pasangannya Richie'],
      ['Natalia', 23, 'Lebih dekat dengan Febryna'],
      ['Kanaya Fasa', 23, 'Lebih dekat dengan Febryna'],
      ['Julia Irina Ruru', 23, 'Ekspektasi akan keluar'],
      ['Axel Pratama', 22, 'Ingin di Febryna'],
      ['Elga Ribka Lavenia', 21, 'Bantu sebagai Main Team'],
      ['Elvaret', 21, 'Dekat dengan Richie'],
      ['Yonatan Dwi Putra', 20, 'Adiknya Yafet'],
      ['Kenneth Johanis Alexander Longdong', 19, 'Umur lebih cocok dengan Febryna'],
    ],
    b: [
      ['Elvina Simanungkalit', 28, 'CORE Leader'],
      ['Han Christian', 26, 'Diarahkan ke Elvina'],
      ['Feby Yola Wijaya', 26, 'Umur lebih cocok dengan Elvina'],
      ['David Partogi Nauli Sitohang', 25, 'Bantu sebagai Main Team'],
      ['Margareta', 25, 'Diarahkan ke Elvina'],
      ['Kevin Kurnia Hermawan', 25, 'Umur lebih cocok dengan Elvina'],
      ['Tommy Hotmas Siahaan', 25, 'Umur lebih cocok dengan Elvina'],
      ['Felicia Claudianita', 23, 'Pasangannya Grady'],
      ['Grady Ferdinand', 22, 'Main Team'],
      ['Aileen Yen', 22, 'Pisah dari Lales'],
      ['Sonia Sandra', 22, 'Tidak ingin bersama Axel'],
      ['Thalia Ribka Marinada Simaremare', 22, 'Bantu melayani'],
      ['Diana', 21, 'Terserah'],
    ],
    out: [
      ['Ribka Emmanauli', 24, 'Pindah ke CORE Jean (Rabu)'],
      ['Deo Sunday', 22, 'Pindah tetap di Kaltim'],
    ],
    other: [
      ['Reka', 28, 'Pindah ke Jakarta Barat'],
      ['Gideon Wijaya', 30, 'Ingin pindah CORE'],
    ],
  },

  // ================== 💜 CORE Novia & CORE David 💙 ==================
  // Judul sheet-nya tertulis “CORE JEAN”, tapi baris CORE Leader-nya Novia
  // Tanasia — dan di daftar CL app-mu yang berhati 💜 memang Novia. Dipakai
  // “Novia”; kalau ternyata keliru, tinggal diganti lewat tombol ubah.
  {
    id: 'multi-novia-david',
    fromName: 'Novia',
    fromHeart: '💜',
    toName: 'David',
    toHeart: '💙',
    meetingDate: [2024, 11, 7],
    firstCoreDate: [2025, 1, 8],
    day: 'Rabu',
    place: 'NDC Soho Capital',
    steps: [
      { on: [2024, 11, 7], title: 'Multiplication Meeting' },
      { on: [2025, 1, 8], title: 'CORE Perdana David' },
    ],
    a: [
      ['Cindy Elviyany', 30, 'Lebih dekat dengan Hansel'],
      ['Laurent Nathan Guslan', 28, 'Terserah'],
      ['Eunice Ananda', 27, 'Ingin di Novia'],
      ['Novia Tanasia', 26, 'CORE Leader'],
      ['Descrian Samuel Pranata', 26, 'Lebih dekat dengan Marcella'],
      ['Sonia Sitompul', 26, 'Lebih dekat dengan Novia'],
      ['Alnov Fryan Maduwu', 26, 'Tidak cocok dengan David'],
      ['Enim Lestari Simbolon', 25, 'Main Team'],
      ['Farel Tiovijay Dededaka', 25, 'Main Team'],
      ['Grant Hansel', 25, 'Main Team'],
      ['Lourent Maria Oktavia', 25, 'Lebih dekat dengan Marcella'],
      ['Steven Leo', 25, 'Lebih dekat dengan Novia'],
      ['Jovan Maurel Bastian', 24, 'Bantu melayani'],
      ['Marcella Novira Hosea', 23, 'Main Team'],
      ['Angela Stefanie', 23, 'Terserah'],
      ['Stacia Andani', 23, 'Ikut Angela'],
      ['Siska Angelina', 22, 'Tantang next level'],
      ['Azaria Claresta', 22, 'Lebih dekat dengan Novia'],
    ],
    b: [
      ['David Adi Dharma', 26, 'CORE Leader'],
      ['Marco Febriadi Kokasih', 25, 'Tantang next level'],
      ['Tresa Tanes', 24, 'Bantu melayani WL'],
      ['Andreas Antonius', 24, 'Bantu melayani'],
      ['Valentine', 24, 'Bantu melayani Games'],
      ['Christania Febrina Paat', 24, 'Terserah'],
      ['Stecy Holie', 23, 'Main Team'],
      ['Stephanie', 23, 'Tantang next level'],
      ['Ananda Yosephine Jalimun', 21, 'Tantang next level'],
      ['Christanael Fellyandro Paath', 18, 'Ikut Tania'],
    ],
    out: [
      ['Natanael Samuel', 25, 'Jauh di Depok'],
      ['Reynaldo Hosanna', 25, 'Mungkin pindah'],
      ['Maria Resita Octavia', 24, 'Pindah ke CORE Lanemey'],
    ],
    other: [
      ['Arnold Rudi Jakub', 24, 'Ingin CL cowok'],
      ['Kezia Aurelia Kawulur', 21, 'CORE Campaign'],
      ['Valerie Tjundawan', 18, 'CORE Campaign'],
    ],
  },
];

function stamp([y, m, d]: [number, number, number]): Timestamp {
  return Timestamp.fromDate(new Date(y, m - 1, d));
}

function buildSteps(id: string, list: SeedStep[] = []): MultiStep[] {
  return list.map((s, i) => ({
    id: `${id}-s${i}`,
    date: stamp(s.on),
    title: s.title,
    notes: s.notes ?? [],
    done: s.mark === undefined,
    cancelled: s.mark === '❌',
  }));
}

function buildMembers(
  id: string,
  side: MultiSide,
  list: SeedMember[] = [],
): MultiMember[] {
  return list.map(([name, age, reason], i) => ({
    id: `${id}-${side}${i}`,
    name,
    age,
    reason,
    side,
  }));
}

/**
 * Isi awal, siap ditulis ke Firestore. `createdAt` diurut supaya multiplikasi
 * yang paling baru (Theofilus–Riky) muncul paling atas di daftar.
 */
export function seedMultiplications(now: Date): Multiplication[] {
  return SEEDS.map((s) => {
    const first = s.firstCoreDate ? stamp(s.firstCoreDate) : null;
    return {
      id: s.id,
      fromName: s.fromName,
      fromHeart: s.fromHeart,
      toName: s.toName,
      toHeart: s.toHeart,
      meetingDate: s.meetingDate ? stamp(s.meetingDate) : null,
      firstCoreDate: first,
      day: s.day ?? '',
      place: s.place ?? '',
      steps: buildSteps(s.id, s.steps),
      members: [
        ...buildMembers(s.id, 'a', s.a),
        ...buildMembers(s.id, 'b', s.b),
        ...buildMembers(s.id, 'out', s.out),
        ...buildMembers(s.id, 'other', s.other),
      ],
      // Urutan daftar = urutan CORE Perdana-nya; yang belum bertanggal
      // memakai jam sekarang supaya tetap punya tempat yang pasti.
      createdAt: first ? first.toMillis() : now.getTime(),
    };
  });
}
