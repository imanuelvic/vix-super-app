import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { daysBetween } from './format';

// Fitur Residence 🏠 — rumah kontrakan Casa Jardin. Mirip fitur Car:
// 1) Air-Listrik: catatan harian isi token listrik & bayar air PAM.
// 2) Log: pengeluaran rumah lain (iuran lingkungan, water heater, wifi,
//    cleaning/disinfektan, dll).
// 3) Info: identitas rumah + pengingat kontrak.

// ===================== Identitas rumah (tetap) =====================

export const RESIDENCE_INFO = {
  name: 'Casa Jardin — No. G5-6',
  owner: 'Dewi Sintia', // pemilik rumah
  address:
    'Jl. Casa Cluster Gladiola Blok G5 No.6, RT.1/RW.4, Kedaung Kali Angke, Cengkareng, Jakarta Barat, 11710',
  wide: '135 m²',
  electricity: '5.500 watt',
  water: 'PAM',
  rentalDate: '1 November 2025', // mulai sewa
  // Iuran lingkungan dibayar per tahun (Jan–Des 2026).
  managementFeePeriod: 'Jan–Des 2026',
  waterHeater: 'Rinnai REU-5CFM',
} as const;

// ===================== Log pengeluaran rumah =====================

export type ResidenceLogType =
  | 'water'
  | 'electric'
  | 'iuran'
  | 'water-heater'
  | 'wifi'
  | 'cleaning'
  | 'lainnya';

// group: 'utility' tampil di tab Air-Listrik, 'log' tampil di tab Log.
export const RESIDENCE_LOG_TYPES: {
  key: ResidenceLogType;
  label: string;
  icon: string;
  group: 'utility' | 'log';
}[] = [
  { key: 'water', label: 'Water PAM', icon: '💧', group: 'utility' },
  { key: 'electric', label: 'Electric Token', icon: '⚡', group: 'utility' },
  { key: 'iuran', label: 'Iuran Lingkungan', icon: '🏘️', group: 'log' },
  { key: 'water-heater', label: 'Water Heater', icon: '👨🏽‍🔧', group: 'log' },
  { key: 'wifi', label: 'Wifi', icon: '🛜', group: 'log' },
  { key: 'cleaning', label: 'Cleaning / Disinfektan', icon: '🪣', group: 'log' },
  { key: 'lainnya', label: 'Lainnya', icon: '🧾', group: 'log' },
];

export type ResidenceLog = {
  id: string;
  type: ResidenceLogType;
  title: string;
  note: string; // catatan tambahan, boleh kosong
  cost: number; // Rp
  date: Timestamp;
};

function residenceLogsCollection(uid: string) {
  return collection(db, 'users', uid, 'houseLogs');
}

export function subscribeResidenceLogs(
  uid: string,
  onChange: (items: ResidenceLog[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(residenceLogsCollection(uid), orderBy('date', 'desc'), limit(300));
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ResidenceLog, 'id'>),
        })),
      );
    },
    onError,
  );
}

export type ResidenceLogInput = {
  type: ResidenceLogType;
  title: string;
  note: string;
  cost: number;
  date: Date;
};

export function addResidenceLog(uid: string, data: ResidenceLogInput) {
  return addDoc(residenceLogsCollection(uid), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function updateResidenceLog(uid: string, id: string, data: ResidenceLogInput) {
  return updateDoc(doc(db, 'users', uid, 'houseLogs', id), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function deleteResidenceLog(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'houseLogs', id));
}

/**
 * Hapus PERMANEN sekumpulan log rumah sekaligus (batch). Dipakai membersihkan
 * log air/listrik lama yang diinput manual — sekarang angka listrik & air
 * dibaca otomatis dari transaksi Finance, bukan lagi dicatat di sini.
 * Ini penghapusan permanen (hard delete), tidak bisa dibatalkan.
 */
export async function deleteResidenceLogs(uid: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) {
      batch.delete(doc(db, 'users', uid, 'houseLogs', id));
    }
    await batch.commit();
  }
}

// ===================== Perawatan & kebersihan berkala 🧽 =====================
// Checklist bersih-bersih rumah per KATEGORI FREKUENSI (mingguan → kuartalan) —
// mirip sparepart Car tapi intervalnya hitungan HARI. Tandai kapan terakhir
// dikerjakan, app hitung kapan waktunya lagi + badge kalau ada yang perlu
// perhatian. Disimpan: users/{uid}/house/chores → { status }.

export type ResidenceChore = {
  key: string;
  label: string; // dengan emoji
  intervalDays: number;
  tip: string; // kenapa penting — biar paham manfaatnya
};

export type ChoreGroup = { key: string; label: string; parts: ResidenceChore[] };

export const CHORE_GROUPS: ChoreGroup[] = [
  {
    key: 'mingguan',
    label: '🗓️ Mingguan',
    parts: [
      { key: 'sisir', label: '🧹 Bersihkan Sisir', intervalDays: 7, tip: 'Minyak, debu & rambut rontok menumpuk bisa bikin kulit kepala berminyak & ketombe.' },
      { key: 'handuk-mandi', label: '🧴 Ganti Handuk Mandi', intervalDays: 7, tip: 'Handuk lembap jadi tempat berkembang bakteri & jamur kalau jarang diganti.' },
      { key: 'kamar-mandi', label: '🚿 Bersihkan Kamar Mandi', intervalDays: 7, tip: 'Area basah gampang berkerak & berjamur — lap wastafel, keran & lantai.' },
    ],
  },
  {
    key: 'dwimingguan',
    label: '🗓️ Dua Mingguan',
    parts: [
      { key: 'gagang-saklar', label: '🚪 Gagang Pintu & Saklar', intervalDays: 14, tip: 'Area yang sering disentuh jadi tempat berkembang bakteri.' },
      { key: 'dapur', label: '🧽 Bersihkan Area Dapur', intervalDays: 14, tip: 'Dapur tempat menyiapkan makanan — kebersihannya cegah kontaminasi & serangga.' },
      { key: 'kipas', label: '🪭 Bersihkan Kipas Angin', intervalDays: 14, tip: 'Debu menempel di kipas menurunkan kualitas udara & bikin alergi.' },
      { key: 'sapu-pel', label: '🧹 Sapu & Pel Semua Ruangan', intervalDays: 14, tip: 'Debu & kotoran menumpuk bisa sebabkan alergi & ruangan terasa kotor.' },
      { key: 'lap-tangan', label: '🧻 Ganti Lap Tangan', intervalDays: 14, tip: 'Lap tangan sering kena kuman dari tangan kotor.' },
    ],
  },
  {
    key: 'bulanan',
    label: '🗓️ Bulanan',
    parts: [
      { key: 'tv-remote', label: '📺 Bersihkan TV & Remote', intervalDays: 30, tip: 'Bakteri menempel di TV & remote yang sering dipegang.' },
      { key: 'sepatu-sandal', label: '👟 Bersihkan Sepatu & Sandal', intervalDays: 30, tip: 'Hilangkan noda & bau di sepatu & sandal.' },
      { key: 'sprei', label: '🛏️ Ganti Sprei & Selimut', intervalDays: 30, tip: 'Sprei & selimut menumpuk debu, keringat & tungau pemicu alergi.' },
      { key: 'kaca-cermin', label: '🪞 Bersihkan Kaca & Cermin', intervalDays: 30, tip: 'Kaca sering kena noda air, sidik jari & debu yang bikin kusam.' },
      { key: 'sofa', label: '🛋️ Bersihkan Sofa', intervalDays: 30, tip: 'Sofa menumpuk debu, kotoran & tungau penyebab alergi.' },
      { key: 'meja-lemari', label: '🗄️ Bersihkan Meja & Lemari', intervalDays: 30, tip: 'Meja & lemari rapi bikin nyaman bekerja & mengurangi debu.' },
      { key: 'toilet', label: '🚽 Bersihkan Toilet & Keran', intervalDays: 30, tip: 'Toilet & keran mudah kena bakteri & kerak air — sikat rutin.' },
    ],
  },
  {
    key: 'dwibulanan',
    label: '🗓️ Dua Bulanan',
    parts: [
      { key: 'jendela-tirai', label: '🪟 Bersihkan Jendela & Tirai', intervalDays: 60, tip: 'Debu dari luar menumpuk di jendela; tirai menyerap debu & bau.' },
      { key: 'kulkas', label: '❄️ Bersihkan Kulkas', intervalDays: 60, tip: 'Cegah sisa makanan basi, kontaminasi bakteri & bunga es di freezer.' },
      { key: 'karpet', label: '🧼 Bersihkan Karpet', intervalDays: 60, tip: 'Karpet menyerap debu, rambut & noda yang sulit terlihat.' },
    ],
  },
  {
    key: 'kuartalan',
    label: '🗓️ Kuartalan (3 Bulan)',
    parts: [
      { key: 'ac-filter', label: '🌬️ Cuci Filter AC / Ventilasi', intervalDays: 90, tip: 'Filter AC kotor menurunkan kualitas udara & bikin AC kurang dingin.' },
      { key: 'sikat-gigi', label: '🪥 Ganti Sikat Gigi', intervalDays: 90, tip: 'Sikat gigi aus tidak efektif membersihkan & menyimpan bakteri.' },
      { key: 'kasur', label: '🛌 Jemur / Vakum Kasur', intervalDays: 90, tip: 'Jemur atau vakum kasur untuk usir tungau & lembap pemicu alergi.' },
    ],
  },
];

export type ChoreTone = 'ok' | 'warn' | 'over' | 'unknown';

/** Tanggal terakhir tiap chore dikerjakan: users/{uid}/house/chores. */
// `note` = catatan pribadi (mis. pakai cairan apa, tukang siapa). Sengaja
// TIDAK ditampilkan di daftar — hanya muncul lagi saat modalnya dibuka.
export type ChoreStatusMap = Record<
  string,
  { last: Timestamp; note?: string }
>;

export function subscribeChoreStatus(
  uid: string,
  onChange: (status: ChoreStatusMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'house', 'chores');
  return liveDoc(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.status as ChoreStatusMap) ?? {});
    },
    onError,
  );
}

export function setChoreDate(
  uid: string,
  key: string,
  date: Date,
  note = '',
) {
  const ref = doc(db, 'users', uid, 'house', 'chores');
  // merge: hanya chore ini yang berubah, status lain tetap.
  return setDoc(
    ref,
    { status: { [key]: { last: Timestamp.fromDate(date), note } } },
    { merge: true },
  );
}

/** Label interval enak dibaca: "minggu" / "2 minggu" / "3 bulan". */
export function choreIntervalLabel(days: number): string {
  if (days % 30 === 0) return days === 30 ? 'bulan' : `${days / 30} bulan`;
  if (days % 7 === 0) return days === 7 ? 'minggu' : `${days / 7} minggu`;
  return `${days} hari`;
}

/** Kondisi chore: aman / segera (≤2 hari) / lewat jadwal / belum dicatat. */
export function choreCondition(
  last: Timestamp | undefined,
  intervalDays: number,
  now: Date,
): { tone: ChoreTone; dueDate: Date | null } {
  if (!last) return { tone: 'unknown', dueDate: null };
  const due = new Date(last.toDate().getTime() + intervalDays * 86_400_000);
  // Rumah TIDAK punya peringatan H-1 — langsung "Sekarang" di hari-H saja.
  // (Beda dengan Car yang masih punya aba-aba "Besok".)
  const tone: ChoreTone = daysBetween(now, due) <= 0 ? 'over' : 'ok';
  return { tone, dueDate: due };
}

export type ChoreAttention = {
  key: string;
  label: string;
  tone: ChoreTone;
  dueDate: Date;
};

/**
 * Daftar chore yang PERLU PERHATIAN (segera ≤2 hari / lewat jadwal), urut dari
 * yang paling mendesak. Dipakai untuk kartu reminder Residence di Dashboard.
 * Chore yang belum pernah dicatat tidak diikutkan.
 */
export function residenceAttentionList(
  status: ChoreStatusMap,
  now: Date,
): ChoreAttention[] {
  const out: ChoreAttention[] = [];
  for (const p of CHORE_GROUPS.flatMap((g) => g.parts)) {
    const { tone, dueDate } = choreCondition(
      status[p.key]?.last,
      p.intervalDays,
      now,
    );
    if ((tone === 'warn' || tone === 'over') && dueDate) {
      out.push({ key: p.key, label: p.label, tone, dueDate });
    }
  }
  return out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Jumlah chore yang perlu perhatian — untuk badge merah di tile Residence.
 */
export function countResidenceAttention(status: ChoreStatusMap, now: Date): number {
  return residenceAttentionList(status, now).length;
}
