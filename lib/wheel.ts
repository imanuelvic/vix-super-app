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
  { key: 'ministry', label: 'Ministry', icon: '🙏', question: 'Apakah kamu melayani? Bagaimana kamu menilai pelayananmu?' },
  { key: 'career', label: 'Career', icon: '💼', question: 'Seberapa baik kamu dalam dunia kerja?' },
  { key: 'relationship', label: 'Relationship', icon: '🤝', question: 'Bagaimana hubunganmu dengan orang-orang di sekitarmu?' },
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

export type WheelFocus = {
  area: WheelAreaKey;
  targetScore: number; // 1–10
  plan: string; // action plan / tolok ukur keberhasilan
};

export type WheelData = {
  scores: Partial<Record<WheelAreaKey, number>>; // 1–10 per area
  notes: Partial<Record<WheelAreaKey, string>>; // alasan penilaian
  focus: WheelFocus[];
  updatedAt?: Timestamp; // kapan terakhir diubah (assessment / fokus)
};

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
        updatedAt: (data?.updatedAt as Timestamp) ?? undefined,
      });
    },
    onError,
  );
}

/** Simpan hasil assessment (skor + alasan). merge: fokus tidak tersentuh. */
export function saveWheelScores(
  uid: string,
  qid: string,
  scores: WheelData['scores'],
  notes: WheelData['notes'],
  owner?: WheelOwner,
) {
  const ref = wheelRef(uid, qid, owner);
  return setDoc(ref, { scores, notes, updatedAt: Timestamp.now() }, { merge: true });
}

/** Simpan area fokus kuartal. merge: skor tidak tersentuh. */
export function saveWheelFocus(
  uid: string,
  qid: string,
  focus: WheelFocus[],
  owner?: WheelOwner,
) {
  const ref = wheelRef(uid, qid, owner);
  return setDoc(ref, { focus, updatedAt: Timestamp.now() }, { merge: true });
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
