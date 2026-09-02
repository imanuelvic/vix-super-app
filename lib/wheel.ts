import {
  doc,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Wheel of Life 🎡 — versi app dari assessment website lama:
// nilai 8 area hidup (1–10) per KUARTAL, lalu pilih minimal 3 area fokus
// dengan target skor + action plan, supaya tetap on track tiap 3 bulan.
//
// Penyimpanan: SATU dokumen per kuartal (users/{uid}/wheel/{2026-Q3}).

export type WheelAreaKey =
  | 'spirituality'
  | 'health'
  | 'family'
  | 'finance'
  | 'ministry'
  | 'career'
  | 'relationship'
  | 'fun';

export const WHEEL_AREAS: {
  key: WheelAreaKey;
  label: string;
  icon: string;
  question: string;
}[] = [
  { key: 'spirituality', label: 'Spirituality', icon: '✝️', question: 'Apakah kamu benar-benar mengasihi Tuhan?' },
  { key: 'health', label: 'Health', icon: '🍎', question: 'Apakah kamu peduli terhadap kesehatanmu?' },
  { key: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦', question: 'Seberapa penting keluarga bagimu?' },
  { key: 'finance', label: 'Finance', icon: '💵', question: 'Seberapa baik kamu mengelola keuanganmu?' },
  { key: 'ministry', label: 'Ministry', icon: '🙏', question: 'Bagaimana kamu menilai pelayananmu?' },
  { key: 'career', label: 'Career', icon: '💼', question: 'Seberapa baik kamu dalam dunia kerja?' },
  { key: 'relationship', label: 'Relationship', icon: '🤝', question: 'Bagaimana hubunganmu dengan orang di sekitarmu?' },
  { key: 'fun', label: 'Fun Recreation', icon: '🎢', question: 'Apakah kamu menikmati hidup? Atau waktumu habis untuk hal yang kurang menyenangkan?' },
];

/** Minimal area fokus per kuartal. */
export const MIN_FOCUS = 3;

// Tips & ide praktis menaikkan skor tiap area — muncul di modal saat kartu
// fokus ditekan. Dibuat singkat & mudah diingat supaya bisa langsung dilakukan.
export const WHEEL_TIPS: Record<WheelAreaKey, string[]> = {
  spirituality: [
    '📖 Saat teduh tiap pagi: baca 1 pasal + doa 10 menit.',
    '⛪ Ibadah & CORE rutin — jangan bolong.',
    '✍️ Revive: catat pergumulan & jawaban Tuhan.',
    '🧠 Hafal 1 ayat tiap minggu.',
    '🙇 Sisihkan waktu puasa/doa khusus 1x sebulan.',
  ],
  health: [
    '😴 Tidur 7–8 jam, jam tidur & bangun yang konsisten.',
    '🏃 Olahraga 3–4x seminggu (min. jalan 30 menit).',
    '💧 Minum ±2L air, kurangi gula & gorengan.',
    '🥗 Ada sayur/buah tiap hari.',
    '🩺 Cek rutin tensi & gula darah.',
  ],
  family: [
    '📞 Kabari / telepon orang tua tiap minggu.',
    '🍽️ Quality time tanpa HP — hadir penuh.',
    '🎁 Ingat & rayakan momen penting mereka.',
    '🤝 Bantu kebutuhan keluarga secara konkret.',
    '🙏 Doakan tiap anggota keluarga secara spesifik.',
  ],
  finance: [
    '🧾 Catat semua pemasukan & pengeluaran (fitur Finance).',
    '💰 Sisihkan 10–20% untuk nabung/investasi di AWAL.',
    '🚨 Punya dana darurat 3–6x pengeluaran bulanan.',
    '💳 Lunasi pinjaman berbunga tinggi lebih dulu.',
    '📊 Review anggaran tiap bulan, potong yang tak perlu.',
  ],
  ministry: [
    '📅 Jadwalkan waktu tetap untuk pelayanan/CORE.',
    '💬 Follow up member/CL secara konsisten.',
    '📝 Siapkan materi/sharing dengan sungguh-sungguh.',
    '🌱 Ajak & muridkan 1 orang baru.',
    '🙏 Evaluasi & doakan pelayananmu tiap minggu.',
  ],
  career: [
    '🎯 Tetapkan target kerja yang jelas tiap minggu.',
    '📚 Belajar 1 skill baru (kursus / buku).',
    '🗣️ Minta feedback dari atasan / rekan.',
    '⏰ Selesaikan deadline tepat waktu, hindari menunda.',
    '🤝 Bangun relasi & network profesional.',
  ],
  relationship: [
    '👋 Sapa & tanya kabar teman dekat secara rutin.',
    '👂 Hadir & dengarkan tanpa menghakimi.',
    '🕊️ Selesaikan konflik cepat, jangan dipendam.',
    '🍿 Luangkan waktu hangout berkualitas.',
    '🌟 Bangun relasi baru yang sehat & positif.',
  ],
  fun: [
    '🎢 Jadwalkan 1 kegiatan seru tiap minggu (fitur Fun).',
    '🎨 Coba hobi / hal baru yang bikin senang.',
    '📵 Ambil jeda dari kerja & HP untuk refreshing.',
    '🏝️ Staycation / liburan kecil sesekali.',
    '😄 Lakukan yang kamu nikmati tanpa rasa bersalah.',
  ],
};

// ===================== Pertanyaan refleksi 💭 =====================
// Satu pertanyaan inti per area (lihat `question` di WHEEL_AREAS) terlalu
// sedikit untuk benar-benar berpikir: "Apakah kamu peduli kesehatanmu?" hampir
// selalu dijawab "ya, peduli" — lalu skornya ditebak.
//
// Yang di bawah ini pertanyaan TAMBAHAN yang muncul selagi kamu menilai:
// masing-masing menagih BUKTI dari satu tips di WHEEL_TIPS di atas, dalam
// bahasa sehari-hari. Urutannya sengaja disamakan dengan urutan tips-nya
// supaya sepasang — pertanyaannya menyadarkan, tips-nya memberi jalan keluar.
//
// Tidak wajib dijawab: memaksa 40 jawaban (8 area × 5) cuma membuat assessment
// ditinggalkan di tengah. Yang wajib tetap satu — skor 1–10.
export const WHEEL_REFLECTIONS: Record<WheelAreaKey, string[]> = {
  spirituality: [
    '📖 Kapan terakhir kamu saat teduh tanpa buru-buru?',
    '⛪ Bulan ini ibadah & CORE-mu bolong berapa kali?',
    '✍️ Pergumulan apa yang belum kamu ceritakan ke Tuhan?',
    '🧠 Ayat apa yang lagi kamu pegang minggu ini?',
    '🙇 Kalau HP-mu diambil sehari, doamu jadi panjang atau hilang?',
  ],
  health: [
    '😴 Jam berapa kamu benar-benar tidur, bukan rebahan sambil scroll?',
    '🏃 Minggu ini badanmu gerak berapa kali?',
    '💧 Hari ini kamu minum air lebih banyak atau minuman manis?',
    '🥗 Kapan terakhir piringmu ada sayur atau buahnya?',
    '🩺 Ada keluhan badan yang kamu tunda cek dari dulu?',
  ],
  family: [
    '📞 Kapan terakhir kamu telepon orang tua, bukan cuma chat?',
    '🍽️ Waktu ngobrol bareng keluarga, HP-mu di tangan atau di meja?',
    '🎁 Momen penting siapa di keluarga yang kamu lupa tahun ini?',
    '🤝 Kebutuhan keluarga apa yang kamu tahu tapi kamu diamkan?',
    '🙏 Siapa anggota keluargamu yang paling jarang kamu doakan?',
  ],
  finance: [
    '🧾 Kamu tahu uangmu habis ke mana bulan ini?',
    '💰 Kamu nabung di AWAL gajian, atau dari sisa?',
    '🚨 Kalau pemasukanmu berhenti hari ini, kamu kuat berapa bulan?',
    '💳 Ada cicilan atau paylater yang diam-diam makan gajimu?',
    '📊 Langganan apa yang kamu bayar tiap bulan tapi jarang dipakai?',
  ],
  ministry: [
    '📅 Pelayanan dapat jadwal tetap, atau cuma sisa waktumu?',
    '💬 CL atau member mana yang belum kamu follow up minggu ini?',
    '📝 Materi sharing terakhir kamu siapkan, atau dadakan?',
    '🌱 Siapa satu orang yang lagi kamu muridkan sekarang?',
    '🙏 Kamu melayani karena cinta, atau karena terlanjur ditugaskan?',
  ],
  career: [
    '🎯 Target kerjamu minggu ini apa — bisa kamu sebut sekarang?',
    '📚 Skill apa yang kamu pelajari 3 bulan terakhir?',
    '🗣️ Kapan terakhir kamu minta feedback jujur soal kerjamu?',
    '⏰ Deadline mana yang kamu tunda sampai mepet?',
    '🤝 Kalau besok cari kerja, siapa yang siap merekomendasikanmu?',
  ],
  relationship: [
    '👋 Siapa teman dekat yang lama tidak kamu sapa?',
    '👂 Ngobrol terakhir, kamu lebih banyak dengar atau menghakimi?',
    '🕊️ Ada yang masih kamu pendam & belum kamu bereskan?',
    '🍿 Hangout terakhirmu nyambung, atau sibuk sendiri-sendiri?',
    '🌟 Relasi mana yang bikin kamu bertumbuh, mana yang menguras?',
  ],
  fun: [
    '🎢 Kapan terakhir kamu senang tanpa mikirin kerjaan?',
    '🎨 Ada hobi yang kamu tinggalkan padahal dulu bikin hidup?',
    '📵 Scroll HP itu istirahat buatmu, atau cuma pelarian?',
    '🏝️ Liburan terakhirmu kapan — beneran libur, bukan pindah tempat kerja?',
    '😄 Kamu masih merasa bersalah tiap kali santai?',
  ],
};

// withReflection & hasReflection DIHAPUS (2 Sep 2026) bersama fitur click
// gelembungnya: keduanya cuma melayani "pertanyaan turun ke kolom catatan",
// dan gelembungnya sekarang baca-saja. Catatan tiap area tetap ada &
// tersimpan seperti biasa — yang hilang cuma jalan pintas mengisinya.

export type WheelFocus = {
  area: WheelAreaKey;
  targetScore: number; // 1–10
  plan: string; // action plan / tolok ukur keberhasilan
};

export type WheelData = {
  scores: Partial<Record<WheelAreaKey, number>>; // 1–10 per area
  notes: Partial<Record<WheelAreaKey, string>>; // alasan penilaian
  focus: WheelFocus[];
  /** Kapan kuartal ini PERTAMA kali diisi. Ditulis sekali, lalu tak berubah. */
  createdAt?: Timestamp;
  updatedAt?: Timestamp; // kapan terakhir diubah (assessment / fokus)
};

// ===================== Bentuk radar (dipakai layar & PDF) =====================

/**
 * Hitungan letak titik radar chart — SATU sumber untuk dua penggambar:
 * <RadarChart/> di layar (react-native-svg) dan SVG mentah di dalam PDF.
 *
 * Dulu rumusnya cuma ada di komponennya. Begitu PDF ikut menggambar roda yang
 * sama, rumus itu harus disalin — dan salinan berarti suatu saat grafik di PDF
 * bisa berbeda bentuk dari yang kamu lihat di layar tanpa ada yang sadar.
 */
export function radarGeometry(size: number, axes: number) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26; // sisakan ruang untuk label emoji
  const angle = (i: number) => ((-90 + (360 / axes) * i) * Math.PI) / 180;
  const at = (i: number, radius: number) => ({
    x: cx + radius * Math.cos(angle(i)),
    y: cy + radius * Math.sin(angle(i)),
  });
  const point = (i: number, radius: number) => {
    const p = at(i, radius);
    return `${p.x},${p.y}`;
  };
  return {
    cx,
    cy,
    r,
    point,
    /** Cincin grid pada pecahan jari-jari (0–1). */
    ring: (frac: number) =>
      Array.from({ length: axes }, (_, i) => point(i, r * frac)).join(' '),
    /** Poligon dari skor 0–10 (di luar rentang itu dijepit). */
    polygon: (values: number[]) =>
      values
        .map((v, i) => point(i, (r * Math.max(0, Math.min(v, 10))) / 10))
        .join(' '),
    /** Letak label emoji, sedikit di luar cincin terluar. */
    labelPos: (i: number) => at(i, r + 15),
  };
}

// ===================== Kuartal =====================

export function quarterOf(d: Date): { year: number; q: number } {
  return { year: d.getFullYear(), q: Math.floor(d.getMonth() / 3) + 1 };
}

/** "2026-Q3" — id dokumen per kuartal. */
export function quarterDocId(year: number, q: number): string {
  return `${year}-Q${q}`;
}

export function quarterLabel(year: number, q: number): string {
  return `Q${q} ${year}`;
}

export function shiftQuarter(
  year: number,
  q: number,
  delta: number,
): { year: number; q: number } {
  const total = year * 4 + (q - 1) + delta;
  return { year: Math.floor(total / 4), q: (total % 4) + 1 };
}

// ===================== Firestore =====================

/**
 * Roda ini punya SIAPA.
 *
 * `null`/tak diisi = punyaku sendiri (users/{uid}/wheel/{qid}) — persis seperti
 * sebelumnya, jadi data lama tetap di tempatnya.
 *
 * Diisi id CORE Leader = roda milik CL itu, disimpan terpisah di
 * users/{uid}/coreWheel/{leaderId}/quarters/{qid}. Tetap di dalam data pemilik
 * app (aturan Firestore `users/{uid}/**` sudah menutupinya), tapi satu CL satu
 * cabang sendiri — jadi tidak mungkin tercampur dengan skorku.
 */
export type WheelOwner = string | null | undefined;

function wheelRef(uid: string, qid: string, owner: WheelOwner) {
  return owner
    ? doc(db, 'users', uid, 'coreWheel', owner, 'quarters', qid)
    : doc(db, 'users', uid, 'wheel', qid);
}

export function subscribeWheel(
  uid: string,
  qid: string,
  onChange: (data: WheelData) => void,
  onError?: (error: FirestoreError) => void,
  owner?: WheelOwner,
) {
  const ref = wheelRef(uid, qid, owner);
  return liveDoc(
    ref,
    (snapshot) => {
      const data = snapshot.data();
      onChange({
        scores: (data?.scores as WheelData['scores']) ?? {},
        notes: (data?.notes as WheelData['notes']) ?? {},
        focus: (data?.focus as WheelFocus[]) ?? [],
        createdAt: (data?.createdAt as Timestamp) ?? undefined,
        updatedAt: (data?.updatedAt as Timestamp) ?? undefined,
      });
    },
    onError,
  );
}

/**
 * Cap waktu tiap penyimpanan.
 *
 * `createdAt` ditulis SEKALI lalu tak pernah berubah: pemanggil mengoper yang
 * sudah ada (dari data yang sedang tampil di layar). Kalau belum ada, saat
 * inilah tanggal lahir kuartal ini. Sengaja tidak memakai transaksi — app ini
 * satu pemilik di satu layar, tidak ada dua penulis berebut.
 */
function stamps(existingCreatedAt?: Timestamp) {
  const now = Timestamp.now();
  return { createdAt: existingCreatedAt ?? now, updatedAt: now };
}

/** Simpan hasil assessment (skor + alasan). merge: fokus tidak tersentuh. */
export function saveWheelScores(
  uid: string,
  qid: string,
  scores: WheelData['scores'],
  notes: WheelData['notes'],
  owner?: WheelOwner,
  createdAt?: Timestamp,
) {
  const ref = wheelRef(uid, qid, owner);
  return setDoc(ref, { scores, notes, ...stamps(createdAt) }, { merge: true });
}

/** Simpan area fokus kuartal. merge: skor tidak tersentuh. */
export function saveWheelFocus(
  uid: string,
  qid: string,
  focus: WheelFocus[],
  owner?: WheelOwner,
  createdAt?: Timestamp,
) {
  const ref = wheelRef(uid, qid, owner);
  return setDoc(ref, { focus, ...stamps(createdAt) }, { merge: true });
}

// ===================== Reminder Home =====================

/** Sudah dinilai (assessment)? True kalau SEMUA area sudah punya skor > 0. */
export function wheelHasScores(data: WheelData): boolean {
  return WHEEL_AREAS.every((a) => (data.scores[a.key] ?? 0) > 0);
}

/** Hari reminder fokus Wheel: Senin (1), Rabu (3), Jumat (5). */
const WHEEL_FOCUS_DAYS = [1, 3, 5];
const WHEEL_START_MINUTE = 9 * 60; // 09.00
const WHEEL_END_MINUTE = 12 * 60 + 30; // 12.30

/** Waktunya reminder fokus Wheel? Senin/Rabu/Jumat, jam 09.00–12.30. */
export function wheelFocusReminderActive(now: Date): boolean {
  if (!WHEEL_FOCUS_DAYS.includes(now.getDay())) return false;
  const minute = now.getHours() * 60 + now.getMinutes();
  return minute >= WHEEL_START_MINUTE && minute <= WHEEL_END_MINUTE;
}

/**
 * Ringkasan tiap area fokus untuk kartu reminder Home: ikon, label, skor
 * sekarang → target, plus SATU tip yang berganti tiap hari (biar tidak bosan
 * & jadi kebiasaan). Tip dipilih deterministik dari nomor hari.
 */
export function wheelFocusReminders(
  data: WheelData,
  now: Date,
): {
  key: WheelAreaKey;
  icon: string;
  label: string;
  current: number;
  target: number;
  tip: string;
}[] {
  const dayNum = Math.floor(now.getTime() / 86_400_000);
  return data.focus.map((f, i) => {
    const meta = WHEEL_AREAS.find((a) => a.key === f.area)!;
    const tips = WHEEL_TIPS[f.area];
    return {
      key: f.area,
      icon: meta.icon,
      label: meta.label,
      current: data.scores[f.area] ?? 0,
      target: f.targetScore,
      tip: tips[(dayNum + i) % tips.length],
    };
  });
}
