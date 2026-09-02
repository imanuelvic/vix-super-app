// Pedoman mengajukan Calon CORE Leader 🧭 — salinan dari lembar pedoman NDC
// milikmu, dipindahkan apa adanya ke dalam app supaya tidak perlu membuka
// spreadsheet lagi tiap kali menimbang seorang calon.
//
// Sengaja STATIS (bukan Firestore): isinya bukan catatan harian yang berubah,
// melainkan acuan tetap — sama sifatnya dengan lib/coreRules & Info Kesehatan.
// Tidak ada satu pun pembacaan Firestore untuk layar ini.
//
// Kalimatnya tidak diubah maknanya. Satu-satunya perbaikan: salah ketik
// "dihakmi" → "dihakimi" di butir pertama 1 Timotius.

/** Visi yang jadi payung seluruh pedoman ini. */
export const NDC_VISION =
  'Menjadikan setiap jemaat murid Yesus dengan cara yang relevan sehingga berdampak bagi lingkungan';

/** Empat nilai NDC — tiap huruf punya warnanya sendiri di lembar aslinya. */
export const NDC_VALUES: { word: string; tone: 'care' | 'open' | 'reach' | 'equip' }[] = [
  { word: 'CARE', tone: 'care' },
  { word: 'OPEN', tone: 'open' },
  { word: 'REACH', tone: 'reach' },
  { word: 'EQUIP', tone: 'equip' },
];

export type CriteriaSection = {
  /** Judul bagian, mis. "1 Timotius 3:1-7". */
  title: string;
  icon: string;
  /** Keterangan kecil di bawah judulnya (opsional). */
  note?: string;
  /**
   * 'warn' = bagian PERINGATAN: kartunya bernuansa merah samar. Yang di sini
   * bukan daftar tugas, melainkan hal yang bisa merugikan CORE kalau
   * dilanggar — jadi tampilannya memang harus beda, bukan sekadar butir ke-43.
   */
  tone?: 'warn';
  points: string[];
};

export const LEADER_CRITERIA: CriteriaSection[] = [
  {
    title: 'Yang Harus Disiapkan',
    icon: '📋',
    note: 'Pertanyaan dari isi form NDC',
    points: [
      'Harus menjadi Main Team minimal sudah 3 bulan (3× mengikuti Mentoring CL MT).',
      'Bisa pelayanan Sharing Firman, WL dan Doa.',
      'Terpandang baik oleh CORE Members.',
      'Aktif di CORE.',
      'Memiliki waktu untuk melakukan Mentoring CL MT, dan di Mentoring MCL CL bulanan.',
      'Kehidupan rohani dan financial yang cukup (tidak berhutang).',
      'Punya hubungan yang baik dengan keluarga.',
      'Punya hubungan berpacaran/pernikahan yang sehat.',
    ],
  },
  {
    title: '1 Timotius 3:1-7',
    icon: '📖',
    points: [
      'Memiliki reputasi yang baik dan bebas dari kritik yang serius (tidak memiliki pelanggaran yang mudah dihakimi).',
      'Setia kepada pasangannya, menunjukkan komitmen dan kesetiaan dalam pernikahan/pacaran (kekudusan).',
      'Memiliki kemampuan untuk mengelola rumah tangganya (keluarga) dengan baik, termasuk menjadi figur otoritas yang baik bagi anak-anaknya.',
      'Tidak baru dalam iman, untuk menghindari kesombongan yang bisa timbul dari promosi yang terlalu cepat.',
      'Dapat diterima oleh orang di luar gereja, sehingga tidak menimbulkan cela bagi komunitas Kristen.',
      'Tidak keras kepala, pemarah, pemabuk, atau serakah.',
    ],
  },
  {
    title: 'Titus 1:1-9',
    icon: '📖',
    points: [
      'Berpegang teguh pada ajaran yang benar, sehingga dia bisa memberi nasihat yang sehat dan membantah mereka yang menentangnya.',
      'Tidak sombong, cepat marah, atau diberikan kepada kebiasaan buruk.',
      'Menunjukkan keramahan, kecintaan terhadap kebaikan, kemampuan untuk mengendalikan diri, dan keadilan.',
      'Memiliki komitmen yang kuat terhadap kebenaran, memungkinkan dia untuk mengajar dengan integritas dan keteguhan.',
    ],
  },
  {
    title: 'Jadilah Pemimpin demi Kristus!',
    icon: '📚',
    note: 'Sen Sendjaya',
    points: ['Pemimpin harus tunduk kepada orang tua dan pemerintah (gereja).'],
  },
  {
    title: '21 Hukum Tak Terbantahkan dalam Kepemimpinan',
    icon: '📚',
    note: 'John C. Maxwell',
    points: [
      'Seorang pemimpin adalah seorang yang mampu mempengaruhi orang lain sehingga mereka mau mengikutinya. Prinsip ini menekankan bahwa kepemimpinan bukan hanya tentang posisi atau gelar, tetapi lebih tentang kemampuan seseorang untuk mempengaruhi orang lain secara positif.',
    ],
  },
  {
    title: 'MCL Imanuel Victory',
    icon: '🫱',
    points: [
      'Terus belajar dan belajar, hidup kita adalah perlombaan iman, dan perlombaan ini adalah perlombaan sendiri-sendiri.',
    ],
  },
];

// ==================== Pedoman TUGAS CORE Leader ====================
// Lembar kedua: bukan syarat memilih calon, melainkan pekerjaan yang dipegang
// seorang CORE Leader — urut mengikuti ritme mingguan CORE (sebelum hari-H →
// hari-H → sesudahnya), lalu yang rutin, pelayanan, dan peringatannya.
//
// Salah ketik di lembar aslinya yang dibetulkan (maknanya tidak berubah):
//   "Daftarkkan" → "Daftarkan" · "di rekomendasikan" → "direkomendasikan"

export const LEADER_DUTIES: CriteriaSection[] = [
  {
    title: 'Sebelum Hari Pertemuan CORE',
    icon: '📅',
    note: 'H-3 / H-2 / H-1',
    points: [
      'Persiapan Materi CDG.',
      'Persiapan rundown dan pelayan CORE (musik, konsumsi, lagu P&W, Game/Ice Breaking, Pendoa, Pemimpin Kelompok Diskusi, dll.).',
      'Absensi kehadiran CORE di Group.',
      'Follow-up Jiwa baru (jika ada yang mendaftar / masih buka jiwa baru).',
      'Sounding Fellowship is very important (Discipleship is Relationship).',
      'Cek tanggal ulang tahun anak CORE (jika ada yang ulang tahun dalam minggu itu, rayakan saat CORE).',
    ],
  },
  {
    title: 'Hari Pertemuan CORE',
    icon: '🙏',
    points: [
      'Remind di Group untuk CORE dan absen.',
      'Persiapan Ruangan (cth. rapihkan meja kursi / keluarkan jika tidak pakai).',
      'Persiapan Alat Musik.',
      'Persiapan Konsumsi (Makanan & Minuman).',
      'Follow-up Member yang belum datang CORE by Japri.',
      'Doa Persiapan Hati Pelayan sebelum mulai CORE.',
    ],
  },
  {
    title: 'Setelah Hari Pertemuan CORE',
    icon: '🔁',
    note: 'H+1 / H+2',
    points: [
      'Memetakan Member (usia, asal kota, domisili, kondisi ekonomi, kondisi kerohanian, bekerja / kuliah, sudah pelayanan Ibadah atau belum).',
      'Follow-up Member perihal hasil sharing mereka di CORE.',
      'Comment & like Social Media Member.',
      'Ajak Ibadah bersama.',
      'Ajak Fellowship CORE.',
    ],
  },
  {
    title: 'Rutin',
    icon: '♻️',
    points: [
      'Booking Ruangan CORE.',
      'Doakan Member setiap hari.',
      'Mentoring ke MCL.',
      'Jadwalkan Mementor / Fellowship Main Team.',
    ],
  },
  {
    title: 'Pelayanan NDC',
    icon: '⛪',
    points: [
      'Mengajukan CCL.',
      'Daftarkan RL PM.',
      'Daftarkan Volunteer.',
    ],
  },
  {
    title: 'Lain-lain',
    icon: '🫱',
    points: [
      'Jadwalkan Fellowship CORE.',
      'Ajak pelayanan di Ibadah Minggu.',
      'Ajak kelas M1, M2, M3, M4.',
      'Ajak mengikuti Relationship Level bagi yang pacaran, yang direkomendasikan oleh CORE Leader.',
      'Ajak mengikuti Pre-Marital bagi yang sudah mau menikah, yang direkomendasikan oleh CORE Leader.',
      'Bantu yang membutuhkan pertolongan Diakonia (melalui pelayanan NDC Pusat).',
      'Bantu yang membutuhkan pertolongan Doa atau Konseling (melalui pelayanan NDC Pusat).',
      'Hadiri Momen Sukacita / Dukacita Member (sidang, wisuda, kedukaan, opening usaha, dsb.).',
      'Jika ada Member yang sudah 8× pertemuan tidak hadir CORE, tanyakan komitmen (jika sudah tidak berkomitmen lagi, remove dari Group).',
    ],
  },
  {
    title: 'Peringatan',
    icon: '⚠️',
    note: 'Jangan sampai kelewat',
    tone: 'warn',
    points: [
      'Disarankan jangan ada uang kas CORE.',
      'Jika membuat Event dan melakukan pencarian dana, jangan post ke publik dengan bawa nama CORE / NDC. Pakai nama diri sendiri.',
      'Disarankan Main Team minimal 2 orang.',
      'Jika ada Member yang ingin bervisit ke CORE lain, harus info dulu kepada CORE Leader-nya.',
      'Jangan jadi batu sandungan ke Member — jadilah teladan.',
      'Perhatikan Pertumbuhan Rohani & Sekuler dari Member dan Diri Sendiri.',
      'Doakan, pikirkan, dan persiapkan The Next CORE Leader.',
      'Harus kreatif: rundown dan kegiatan CORE boleh berbeda-beda, yang penting ada 5W CORE — Welcome, Worship, Warmth, Word, Works.',
      'CORE Leader harus berjuang sendiri; MCL memberikan bimbingan sendiri.',
    ],
  },
];

/** Jumlah butir sebuah lembar pedoman — dipakai subjudul & keterangan tabnya. */
export function criteriaCount(sections: CriteriaSection[]): number {
  return sections.reduce((sum, s) => sum + s.points.length, 0);
}

/** Jumlah seluruh butir — dipakai subjudul layarnya. */
export const LEADER_CRITERIA_COUNT = criteriaCount(LEADER_CRITERIA);
export const LEADER_DUTIES_COUNT = criteriaCount(LEADER_DUTIES);

// ==================== Kedua lembar dalam satu daftar ====================
// SATU sumber untuk judul & isinya, dipakai layarnya maupun PDF-nya. Judul di
// sini juga jadi NAMA BERKAS PDF-nya, jadi mengubahnya di sini otomatis
// mengubah nama berkas yang terkirim ke WhatsApp — tidak ada dua tempat yang
// bisa melenceng.

export type CriteriaSheet = 'calon' | 'tugas';

export const CRITERIA_SHEETS: Record<
  CriteriaSheet,
  { title: string; tab: string; sections: CriteriaSection[]; count: number }
> = {
  calon: {
    title: 'Pedoman Ajuin Calon CORE Leader',
    tab: '📄 Calon CL',
    sections: LEADER_CRITERIA,
    count: LEADER_CRITERIA_COUNT,
  },
  tugas: {
    title: 'Pedoman Tugas CORE Leader',
    tab: '📋 Tugas CL',
    sections: LEADER_DUTIES,
    count: LEADER_DUTIES_COUNT,
  },
};
