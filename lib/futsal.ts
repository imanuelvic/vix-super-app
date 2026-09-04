import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { dayId, dayIdToDate, formatDayDate, formatFullDate } from './format';
import { liveDoc } from './liveDoc';
import { formatRupiah } from './transactions';

// Futsal ⚽ — pengurus futsal rutin (lihat components/friends/FutsalTab.tsx).
//
// Ini bukan sekadar catatan olahraga: ini alat seorang MANAGER. Yang membuat
// futsal rutin bubar hampir selalu tiga hal yang sama, dan ketiganya diurus di
// sini:
//   1. Jadwalnya tidak pernah dibuat → "kapan main lagi?" mengambang di grup.
//   2. Uangnya bocor → yang menalangi lapangan lupa siapa yang belum setor.
//   3. Tidak ada yang seru untuk dikenang → mainnya jadi terasa sia-sia.
// Karena itu tiap sesi memuat jadwal + lokasi, daftar setoran per orang, dan
// score tiap game.
//
// Penyimpanan: SATU dokumen (users/{uid}/social/sport) berisi anggota &
// seluruh sesi. Sesinya cuma teks & angka — dua geng × 2 kali sebulan ≈ 50
// sesi setahun, jauh di bawah batas 1 MB per dokumen. Sekali baca, langsung
// hidup, dan tidak perlu composite index.

/** Geng yang rutin main bareng. */
export type FutsalGangKey = 'core' | 'f3';

export type FutsalGang = {
  key: FutsalGangKey;
  label: string;
  emoji: string;
  /** Kepanjangan / siapa mereka — muncul di bawah nama gengnya. */
  desc: string;
  /**
   * Jarak hari ke pertemuan berikutnya, dipakai tombol "🔁 Ulangi".
   * F3 memang dijadwalkan dua mingguan; CORE dipakai mingguan sebagai
   * ancang-ancang — tanggalnya tetap bisa kamu geser sebelum disimpan.
   */
  repeatDays: number;
};

export const FUTSAL_GANGS: FutsalGang[] = [
  {
    key: 'core',
    label: 'CORE',
    emoji: '⛪',
    desc: 'MCL Imanuel Victory',
    repeatDays: 30,
  },
  {
    key: 'f3',
    label: 'NDC F3',
    emoji: '⚽',
    desc: 'Fulltimer Fun Futsal',
    repeatDays: 14,
  },
];

/**
 * Tulisan jam sesi: "18.00" atau "18.00–20.00" kalau jam selesainya diisi.
 *
 * Satu penyusun untuk SEMUA tempat jam itu tampil (kartu sesi, kartu ringkas,
 * kepala layar sesi, pengumuman WhatsApp) — kalau tidak, sesi yang sama
 * terbaca beda jam-jamnya tergantung kamu sedang berdiri di layar mana.
 */
export function sessionTimeRange(s: FutsalSession): string {
  return s.endTime ? `${s.time}–${s.endTime}` : s.time;
}

export function gangMeta(key: FutsalGangKey): FutsalGang {
  return FUTSAL_GANGS.find((g) => g.key === key) ?? FUTSAL_GANGS[0];
}

/** Posisi futsal — 5 pemain, bukan 11. Istilahnya memang beda dari sepak bola. */
export type FutsalPosition = 'kiper' | 'anchor' | 'flank' | 'pivot';

export const FUTSAL_POSITIONS: {
  key: FutsalPosition;
  label: string;
  emoji: string;
  /** Tugasnya di lapangan — biar pembagian tim tidak asal comot. */
  tugas: string;
}[] = [
  { key: 'kiper', label: 'Kiper', emoji: '🧤', tugas: 'Penjaga gawang & pengatur serangan dari belakang' },
  { key: 'anchor', label: 'Anchor', emoji: '🛡️', tugas: 'Bek terakhir, pengatur tempo' },
  { key: 'flank', label: 'Flank', emoji: '⚡', tugas: 'Sayap kiri/kanan, paling banyak lari' },
  { key: 'pivot', label: 'Pivot', emoji: '🎯', tugas: 'Ujung tombak, pemantul bola & pencetak gol' },
];

export function positionMeta(key: FutsalPosition) {
  return FUTSAL_POSITIONS.find((p) => p.key === key) ?? FUTSAL_POSITIONS[1];
}

export type FutsalMember = {
  id: string;
  gang: FutsalGangKey;
  name: string;
  /** Nomor HP — dipakai tombol chat WhatsApp saat menagih. */
  phone: string;
  position: FutsalPosition;
  note: string;
};

/** Satu game di dalam sesi. Futsal tarkam: biasanya rompi vs non-rompi. */
export type FutsalGame = {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  /**
   * id anggota pencetak gol — SATU BARIS PER GOL, jadi id yang sama boleh
   * muncul dua kali kalau ia mencetak dua gol. Inilah dasar papan top score.
   */
  scorers: string[];
};

export type FutsalSession = {
  id: string;
  gang: FutsalGangKey;
  /** Tanggal main, "YYYY-MM-DD". */
  dayId: string;
  /** Jam main, mis. "20.00". */
  time: string;
  /**
   * Jam selesai, mis. "20.00". Kosong = sesi lama yang belum punya.
   *
   * Selalu SESUDAH `time` (dijaga formulirnya): satu jam sewa lapangan yang
   * berakhir sebelum ia mulai bukan salah ketik yang lucu — ia ikut ke
   * pengumuman WhatsApp yang dibaca 12 orang.
   */
  endTime?: string;
  venue: string;
  /**
   * Tautan Google Maps lapangannya — ikut di pengumuman WhatsApp.
   *
   * Tinggal di sesi (bukan di daftar lapangan tersendiri) karena ia diwarisi
   * dari sesi terakhir, sama seperti venue & iuran: diketik sekali, lalu
   * terbawa sendiri tiap kali kamu menjadwalkan lagi di lapangan yang sama.
   */
  mapsUrl?: string;
  /** Rekening tujuan setoran, mis. "BCA 5271415860" — ikut diwarisi. */
  bank?: string;
  /** Iuran per orang (Rp). */
  fee: number;
  /** id anggota yang ikut main. */
  squad: string[];
  /** id anggota yang SUDAH setor. Selalu bagian dari `squad`. */
  paid: string[];
  games: FutsalGame[];
  note: string;
};

/** Uang masuk / keluar dari kas geng. */
export type FutsalCashDirection = 'in' | 'out';

/**
 * Satu mutasi kas tim — bentuknya sama dengan Saku 👛 di Finance, tapi uangnya
 * bukan uangmu: ini uang BERSAMA yang kamu pegang sebagai manager. Karena itu
 * tiap barisnya wajib punya judul; "keluar Rp 300.000" tanpa keterangan adalah
 * cara tercepat kehilangan kepercayaan satu geng.
 */
export type FutsalCashEntry = {
  id: string;
  gang: FutsalGangKey;
  /** Tanggal mutasi, "YYYY-MM-DD". */
  dayId: string;
  title: string;
  direction: FutsalCashDirection;
  amount: number;
  note: string;
  /**
   * Sesi asal uang ini — hanya diisi oleh tombol "Setor ke Kas" di layar sesi.
   * Dipakai untuk tahu berapa dari iuran sesi itu yang SUDAH masuk kas, jadi
   * uang yang sama tidak pernah tercatat dua kali.
   */
  sessionId?: string;
};

export type FutsalData = {
  members: FutsalMember[];
  sessions: FutsalSession[];
  cash: FutsalCashEntry[];
};

export const EMPTY_FUTSAL: FutsalData = { members: [], sessions: [], cash: [] };

/** Id baru — jam + acak, cukup unik untuk daftar sepanjang ini. */
export function newFutsalId(now: Date): string {
  return `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ===================== Hitungan uang =====================

/** Total iuran yang HARUS terkumpul dari sesi ini. */
export function sessionTotal(s: FutsalSession): number {
  return s.fee * s.squad.length;
}

/**
 * Uang yang SUDAH masuk — dari SIAPA PUN yang menyetor.
 *
 * Termasuk yang tidak ikut main kali ini. Berhalangan datang bukan berarti
 * tidak ikut patungan: yang sudah janji main lalu batal sering tetap membayar
 * supaya lapangannya tidak nombok, dan uang itu memang ada di tanganmu. Dulu
 * setoran orang di luar squad tidak dihitung sama sekali — angkanya rapi, tapi
 * bohong: kasnya melaporkan lebih sedikit dari yang benar-benar terkumpul.
 */
export function sessionPaidTotal(s: FutsalSession): number {
  return s.fee * s.paid.length;
}

/**
 * Sisa yang belum masuk — ini angka yang bikin manager rugi diam-diam.
 *
 * Dihitung dari yang MAIN dan belum setor, bukan "total dikurangi yang masuk".
 * Bedanya baru terasa saat ada yang tidak ikut main tapi tetap membayar:
 * dengan pengurangan, sisanya bisa jadi MINUS dan terbaca seperti salah hitung,
 * padahal yang terjadi cuma uang lebih. Yang perlu kamu tagih tetap sama: orang
 * yang ikut main tapi belum setor.
 */
export function sessionDueTotal(s: FutsalSession): number {
  return s.fee * sessionUnpaidCount(s);
}

/** Berapa orang yang belum setor — yang IKUT MAIN saja; itu yang ditagih. */
export function sessionUnpaidCount(s: FutsalSession): number {
  return s.squad.filter((id) => !s.paid.includes(id)).length;
}

// ===================== Kas tim =====================

/** Mutasi kas satu geng, TERBARU dulu. */
export function gangCash(
  data: FutsalData,
  gang: FutsalGangKey,
): FutsalCashEntry[] {
  return data.cash
    .filter((c) => c.gang === gang)
    .sort((a, b) => b.dayId.localeCompare(a.dayId) || b.id.localeCompare(a.id));
}

/** Saldo kas satu geng: yang masuk dikurangi yang keluar. */
export function cashBalance(data: FutsalData, gang: FutsalGangKey): number {
  return data.cash.reduce(
    (n, c) =>
      c.gang === gang ? n + (c.direction === 'in' ? c.amount : -c.amount) : n,
    0,
  );
}

/** Kas SELURUH geng dijumlahkan — angka yang dicari saat buka halaman kas. */
export function cashTotal(data: FutsalData): number {
  return FUTSAL_GANGS.reduce((n, g) => n + cashBalance(data, g.key), 0);
}

/**
 * Berapa rupiah dari iuran sesi ini yang SUDAH disetor ke kas.
 *
 * Dipakai supaya uang yang sama tak pernah masuk dua kali — dan supaya yang
 * telat setor tetap bisa disusulkan: tombol setornya cuma menawarkan SELISIH
 * antara yang sudah terkumpul di sesi dan yang sudah tercatat di kas.
 */
export function sessionCashIn(data: FutsalData, sessionId: string): number {
  return data.cash.reduce(
    (n, c) =>
      c.sessionId === sessionId && c.direction === 'in' ? n + c.amount : n,
    0,
  );
}

// ===================== Anggota =====================

/**
 * Anggota satu geng, URUT ABJAD nama.
 *
 * Urutan tambah-nya sendiri tidak berarti apa-apa buat siapa pun; yang kamu
 * lakukan di daftar ini selalu "cari si Anu", dan itu cuma cepat kalau
 * urutannya bisa ditebak. `localeCompare` dengan locale id + sensitivity base
 * → huruf besar/kecil & aksen tidak memisahkan nama yang sama.
 */
export function gangMembers(
  data: FutsalData,
  gang: FutsalGangKey,
): FutsalMember[] {
  return data.members
    .filter((m) => m.gang === gang)
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
}

/**
 * Urutan baris "Squad & Setoran": sudah setor di ATAS, tidak ikut main di BAWAH.
 *
 * Daftar itu bukan sekadar daftar nama, melainkan daftar KERJA — yang tersisa
 * buat manager cuma menagih orang yang ikut main tapi belum setor. Dengan yang
 * sudah beres naik ke atas dan yang tidak ikut main turun ke dasar, sisa
 * kerjanya berkumpul jadi satu blok di tengah, bukan berselang-seling di antara
 * baris yang tak perlu disentuh lagi.
 *
 * Di dalam tiap kelompok urutannya TIDAK diacak: sort JavaScript stabil, jadi
 * urutan yang masuk — abjad nama, lewat `gangMembers` — tetap terjaga. Itu yang
 * membuat "cari si Anu" tetap bisa ditebak: kelompoknya yang berpindah, bukan
 * namanya yang berloncatan.
 */
export function squadOrder(
  members: FutsalMember[],
  s: FutsalSession,
): FutsalMember[] {
  // Urutannya = urutan KERJAMU, dari yang masih harus dikejar sampai yang
  // sudah tak ada urusannya lagi:
  //   0 ikut main, belum setor  → ini yang harus ditagih, jadi paling atas
  //   1 ikut main & sudah setor → beres
  //   2 tidak ikut tapi setor   → beres juga; ia tetap patungan walau absen
  //   3 tidak ikut & tidak setor → tak ada yang perlu dikerjakan
  const peringkat = (m: FutsalMember) => {
    const ikut = s.squad.includes(m.id);
    const lunas = s.paid.includes(m.id);
    if (ikut) return lunas ? 1 : 0;
    return lunas ? 2 : 3;
  };
  return [...members].sort((a, b) => peringkat(a) - peringkat(b));
}

// ===================== Jadwal =====================

/** SEMUA sesi yang belum lewat, paling dekat dulu. */
export function upcomingSessions(
  sessions: FutsalSession[],
  gang: FutsalGangKey,
  todayId: string,
): FutsalSession[] {
  return sessions
    .filter((s) => s.gang === gang && s.dayId >= todayId)
    .sort((a, b) => a.dayId.localeCompare(b.dayId));
}

/**
 * Sesi BERIKUTNYA satu geng — yang tanggalnya hari ini atau sesudahnya, paling
 * dekat. `null` = belum dijadwalkan sama sekali.
 */
export function nextSession(
  sessions: FutsalSession[],
  gang: FutsalGangKey,
  todayId: string,
): FutsalSession | null {
  return upcomingSessions(sessions, gang, todayId)[0] ?? null;
}

/** Sesi yang sudah lewat, terbaru dulu. */
export function pastSessions(
  sessions: FutsalSession[],
  gang: FutsalGangKey,
  todayId: string,
): FutsalSession[] {
  return sessions
    .filter((s) => s.gang === gang && s.dayId < todayId)
    .sort((a, b) => b.dayId.localeCompare(a.dayId));
}

/** Sesi terakhir geng ini (lewat maupun akan datang) — acuan tombol Ulangi. */
export function lastSession(
  sessions: FutsalSession[],
  gang: FutsalGangKey,
): FutsalSession | null {
  return (
    sessions
      .filter((s) => s.gang === gang)
      .sort((a, b) => b.dayId.localeCompare(a.dayId))[0] ?? null
  );
}

/** Tanggal pertemuan berikutnya = tanggal ini + jarak rutin gengnya. */
export function repeatDayId(from: string, gang: FutsalGangKey): string {
  const d = dayIdToDate(from);
  d.setDate(d.getDate() + gangMeta(gang).repeatDays);
  return dayId(d);
}

/** Berapa hari lagi sampai sesi ini (negatif = sudah lewat). */
export function daysToSession(s: FutsalSession, now: Date): number {
  const target = dayIdToDate(s.dayId);
  return Math.round(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
}

// ===================== Score & papan pencetak gol =====================

/** "12 – 9" dari seluruh game di satu sesi. */
export function sessionScoreLine(s: FutsalSession): string {
  if (s.games.length === 0) return '';
  const a = s.games.reduce((n, g) => n + g.scoreA, 0);
  const b = s.games.reduce((n, g) => n + g.scoreB, 0);
  return `${a} – ${b}`;
}

export type ScorerRow = { member: FutsalMember; goals: number; caps: number };

/**
 * Papan top score satu geng: gol terbanyak dulu, lalu yang paling rajin datang.
 *
 * `caps` (berapa kali ikut main) sengaja ikut dihitung — tanpa itu, yang jarang
 * datang tapi sekali cetak 3 gol terlihat lebih hebat daripada yang tidak
 * pernah absen. Buat seorang manager, yang RAJIN DATANG justru yang bikin
 * kegiatannya tetap jalan.
 */
export function topScorers(
  data: FutsalData,
  gang: FutsalGangKey,
): ScorerRow[] {
  const sesi = data.sessions.filter((s) => s.gang === gang);
  return data.members
    .filter((m) => m.gang === gang)
    .map((member) => ({
      member,
      goals: sesi.reduce(
        (n, s) =>
          n + s.games.reduce((g, game) =>
            g + game.scorers.filter((id) => id === member.id).length, 0),
        0,
      ),
      caps: sesi.filter((s) => s.squad.includes(member.id)).length,
    }))
    .sort((a, b) => b.goals - a.goals || b.caps - a.caps);
}

export type AttendanceRow = {
  member: FutsalMember;
  /** Berapa kali ia benar-benar ikut main. */
  present: number;
  /** Berapa sesi yang BISA ia hadiri (lihat aturan "sejak" di bawah). */
  possible: number;
  /** present ÷ possible — 0 kalau belum pernah sekali pun masuk squad. */
  rate: number;
};

/**
 * Papan paling rajin datang: yang persentase kehadirannya paling tinggi dulu,
 * lalu yang paling banyak datang.
 *
 * DUA aturan di sini yang kelihatan kecil tapi menentukan angkanya benar atau
 * menyesatkan:
 *
 * 1. Cuma sesi yang SUDAH LEWAT yang dihitung. Squad sesi baru diisi SELURUH
 *    anggota geng (lihat FutsalTab) lalu yang berhalangan dicoret — jadi
 *    menghitung sesi yang belum main sama saja menganggap semua orang sudah
 *    hadir di pertandingan yang belum terjadi.
 *
 * 2. Hitungannya mulai dari sesi PERTAMA ia muncul di squad, bukan dari sesi
 *    pertama gengnya. Anggota yang baru masuk bulan ini tidak pernah punya
 *    kesempatan hadir di sesi tahun lalu; menghitungnya sebagai bolos membuat
 *    tiap orang baru langsung mendarat di dasar papan dan butuh berbulan-bulan
 *    untuk naik — papannya jadi soal "siapa yang paling lama bergabung", bukan
 *    "siapa yang paling rajin".
 *
 * Yang belum pernah masuk squad sama sekali tetap ditampilkan dengan 0 dari 0,
 * bukan disembunyikan: anggota terdaftar yang tak pernah datang itu justru
 * kabar yang perlu dilihat seorang manager.
 */
export function topAttendance(
  data: FutsalData,
  gang: FutsalGangKey,
  todayId: string,
): AttendanceRow[] {
  const sesi = data.sessions
    .filter((s) => s.gang === gang && s.dayId < todayId)
    .sort((a, b) => a.dayId.localeCompare(b.dayId));
  return gangMembers(data, gang)
    .map((member) => {
      const mulai = sesi.findIndex((s) => s.squad.includes(member.id));
      const sejak = mulai === -1 ? [] : sesi.slice(mulai);
      const present = sejak.filter((s) => s.squad.includes(member.id)).length;
      return {
        member,
        present,
        possible: sejak.length,
        rate: sejak.length > 0 ? present / sejak.length : 0,
      };
    })
    .sort((a, b) => b.rate - a.rate || b.present - a.present);
}

// ===================== Badge =====================

/** Berapa hari sebelum hari-H sesinya mulai ditagih di badge. */
export const FUTSAL_ALERT_DAYS = 2;

/**
 * Angka badge Fun Futsal — dua hal yang benar-benar menuntut tindakanmu:
 *   • sesi yang tinggal ≤ 2 hari lagi (pastikan pemainnya cukup & lapangannya
 *     sudah dibooking), dan
 *   • sesi yang SUDAH LEWAT tapi masih ada yang belum setor.
 *
 * Sesi jauh di depan tidak dihitung: menagih dua minggu sebelumnya cuma
 * membuat badge-nya menyala terus dan akhirnya diabaikan.
 */
export function futsalAttention(data: FutsalData, now: Date): number {
  return data.sessions.filter((s) => sessionNeedsAttention(s, now)).length;
}

/** Sesi INI yang menyalakan badge? Dipakai titik & garis merah di daftarnya. */
export function sessionNeedsAttention(s: FutsalSession, now: Date): boolean {
  const sisa = daysToSession(s, now);
  return sisa >= 0 ? sisa <= FUTSAL_ALERT_DAYS : sessionUnpaidCount(s) > 0;
}

/**
 * Baris reminder Fun Futsal untuk Dashboard — SESI YANG SESUNGGUHNYA, bukan
 * kalimat umum.
 *
 * Kartu ini dulu cuma menjelaskan APA yang membuat badge-nya menyala ("futsal
 * yang tinggal ≤ 2 hari lagi, atau iuran yang belum masuk"). Kalimat itu benar,
 * tapi tak pernah menjawab pertanyaan yang sebenarnya kamu bawa ke Dashboard:
 * "yang mana, kapan?" — jadi tiap kali tetap harus membuka fiturnya untuk tahu.
 * Sekarang tiap sesi jadi satu barisnya sendiri, memakai kosakata yang sama
 * dengan kartu di dalam fiturnya (🗓️ tanggal · jam, 💸 sisa setoran).
 *
 * Urutannya: yang AKAN DATANG dulu, paling dekat di atas — itu yang masih bisa
 * kamu urus. Sesi lewat yang setorannya belum lunas menyusul di bawahnya,
 * terbaru dulu; ia perlu ditagih, tapi tak ada lagi yang bisa dibatalkan.
 */
export function futsalReminders(
  data: FutsalData,
  now: Date,
): { id: string; text: string }[] {
  const perlu = data.sessions.filter((s) => sessionNeedsAttention(s, now));
  const nanti = perlu
    .filter((s) => daysToSession(s, now) >= 0)
    .sort((a, b) => a.dayId.localeCompare(b.dayId));
  const lewat = perlu
    .filter((s) => daysToSession(s, now) < 0)
    .sort((a, b) => b.dayId.localeCompare(a.dayId));
  return [...nanti, ...lewat].map((s) => {
    const meta = gangMeta(s.gang);
    const sisa = daysToSession(s, now);
    // "2 hari lagi" jauh lebih cepat dibaca daripada menghitung sendiri dari
    // tanggalnya — tapi tanggalnya tetap ditulis, karena itu yang kamu salin
    // ke grup saat mengabari orang.
    const kapan =
      sisa === 0
        ? 'HARI INI'
        : sisa === 1
          ? 'BESOK'
          : sisa > 1
            ? `${sisa} hari lagi`
            : `lewat ${-sisa} hari`;
    const belum = sessionUnpaidCount(s);
    return {
      id: s.id,
      text: `${meta.emoji} ${meta.label} · 🗓️ ${formatDayDate(dayIdToDate(s.dayId))} · ${s.time} — ${kapan}${belum > 0 ? ` · 💸 ${belum} belum setor` : ''}`,
    };
  });
}

/**
 * Pengumuman satu sesi, siap tempel ke grup WhatsApp — jadwal, lokasi, iuran,
 * rekening, dan daftar yang ikut main lengkap dengan tanda siapa yang sudah
 * setor.
 *
 * Disusun DI SINI, bukan di layarnya: isinya adalah aturan (siapa yang masuk
 * daftar, tanda apa yang dipakai), dan aturan yang tinggal di dalam JSX tidak
 * pernah bisa diuji tanpa menggambar layarnya dulu.
 *
 * Baris yang datanya kosong DIHILANGKAN, bukan dikirim sebagai baris kosong
 * atau "—": ini pesan yang dibaca orang lain di grup.
 */
export function sessionRecap(data: FutsalData, s: FutsalSession): string {
  const meta = gangMeta(s.gang);
  const ikut = gangMembers(data, s.gang).filter((m) => s.squad.includes(m.id));
  const baris = [
    meta.label,
    '',
    `📅 ${formatFullDate(dayIdToDate(s.dayId))}`,
    // Jam ditulis dengan titik dua di pesan keluar ("18:00–20:00"),
    // sedangkan di dalam app tetap gaya Indonesia ("18.00–20.00").
    `🕐 ${sessionTimeRange(s).replace(/\./g, ':')}`,
    `📍 ${s.venue || 'Lapangan menyusul'}`,
  ];
  if (s.mapsUrl) baris.push(s.mapsUrl);
  baris.push('');
  if (s.fee > 0) baris.push(`${formatRupiah(s.fee)} per orang`);
  if (s.bank) baris.push(s.bank);
  if (s.fee > 0 || s.bank) baris.push('');

  baris.push('Ikut main:');
  ikut.forEach((m, i) => {
    baris.push(`${i + 1}. ${m.name}${s.paid.includes(m.id) ? '✅' : ''}`);
  });
  if (ikut.length === 0) baris.push('(belum ada yang ikut)');
  baris.push('', '✅ = Sudah setor');
  return baris.join('\n');
}

// ===================== Firestore =====================

// ⚠️ Nama dokumennya TETAP 'sport' walau fiturnya kini bernama Fun Futsal:
// itu alamat data yang sudah ada di Firestore. Mengubahnya = seluruh anggota,
// jadwal & kas hilang dari app (pindah ke dokumen baru yang kosong).
const futsalRef = (uid: string) => doc(db, 'users', uid, 'social', 'sport');

export function subscribeFutsal(
  uid: string,
  onChange: (data: FutsalData) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    futsalRef(uid),
    (snapshot) => {
      const d = snapshot.data() as Partial<FutsalData> | undefined;
      onChange({
        members: d?.members ?? [],
        sessions: d?.sessions ?? [],
        // Dokumen yang ditulis sebelum kas ada belum punya kolom ini.
        cash: d?.cash ?? [],
      });
    },
    onError,
  );
}

/** Tulis ulang seluruhnya. Hapus = tulis ulang tanpa barisnya (PERMANEN). */
export function saveFutsal(uid: string, data: FutsalData) {
  return setDoc(futsalRef(uid), data);
}
