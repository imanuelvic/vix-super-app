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
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { daysBetween } from './format';

// Fitur Car 🚗 — Mazda 2 R Skyactiv 2015 (merah):
// 1) Log pengeluaran & perawatan (bensin, servis, parkir, surat) seperti
//    sheet "Car 🚗" lama, plus hitung harga per liter untuk bensin.
// 2) Checklist sparepart/perawatan berkala (mesin, kaki-kaki, interior,
//    eksterior) supaya mobil tidak cepat rusak.
// 3) Identitas mobil + pengingat STNK tahunan.

// ===================== Identitas mobil (tetap) =====================

export const CAR_INFO = {
  name: 'Mazda 2 R Skyactiv 2015',
  color: 'Soul Red ❤️‍🔥',
  plate: 'B 2453 TFT',
  ownerName: 'Rendie Ferdinand Rumayar', // nama di STNK
  productionYear: 'Desember 2015',
  fuel: 'Pertamax (RON 92)',
  handedOver: '26 Desember 2025', // diserahkan ke Imanuel
  // STNK diperpanjang tiap tanggal 8 Maret.
  stnkMonth: 2, // 0–11 seperti Date JS (2 = Maret)
  stnkDay: 8,
} as const;

/** Jatuh tempo STNK berikutnya + berapa hari lagi. */
export function nextStnk(now: Date): { date: Date; daysUntil: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let due = new Date(now.getFullYear(), CAR_INFO.stnkMonth, CAR_INFO.stnkDay);
  if (due < start) {
    due = new Date(now.getFullYear() + 1, CAR_INFO.stnkMonth, CAR_INFO.stnkDay);
  }
  const daysUntil = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  return { date: due, daysUntil };
}

// ===================== Log pengeluaran =====================

export type CarLogType = 'bensin' | 'servis' | 'parkir' | 'surat' | 'lainnya';

export const CAR_LOG_TYPES: {
  key: CarLogType;
  label: string;
  icon: string;
}[] = [
  { key: 'bensin', label: 'Bensin', icon: '⛽' },
  { key: 'servis', label: 'Servis', icon: '🔧' },
  { key: 'parkir', label: 'Parkir', icon: '🅿️' },
  { key: 'surat', label: 'Surat', icon: '📋' },
  { key: 'lainnya', label: 'Lainnya', icon: '🧼' },
];

export type CarLog = {
  id: string;
  type: CarLogType;
  title: string; // produk/kegiatan, mis. "Gasoline (Full)"
  location: string; // lokasi/bengkel, boleh kosong
  note: string; // keterangan, boleh kosong
  cost: number; // Rp (0 diperbolehkan, mis. isi angin gratis)
  liters: number | null; // khusus bensin — untuk hitung Rp/liter
  /** true = lahir otomatis dari transaksi Finance → diubah/hapusnya di sana. */
  fromFinance?: boolean;
  date: Timestamp;
};

function carLogsCollection(uid: string) {
  return collection(db, 'users', uid, 'carLogs');
}

export function subscribeCarLogs(
  uid: string,
  onChange: (items: CarLog[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(carLogsCollection(uid), orderBy('date', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => {
          const data = d.data() as Omit<CarLog, 'id'>;
          return { id: d.id, ...data, liters: data.liters ?? null };
        }),
      );
    },
    onError,
  );
}

export type CarLogInput = {
  type: CarLogType;
  title: string;
  location: string;
  note: string;
  cost: number;
  liters: number | null;
  date: Date;
};

export function addCarLog(uid: string, data: CarLogInput) {
  return addDoc(carLogsCollection(uid), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function updateCarLog(uid: string, id: string, data: CarLogInput) {
  return updateDoc(doc(db, 'users', uid, 'carLogs', id), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function deleteCarLog(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'carLogs', id));
}

/**
 * Catat/perbarui log BENSIN yang berasal dari transaksi Finance.
 *
 * Id dokumennya sengaja DISAMAKAN dengan id transaksinya → satu transaksi
 * selalu tepat satu catatan (tidak pernah dobel walau disimpan berkali-kali),
 * dan menghapusnya cukup `deleteCarLog(uid, txId)`.
 */
export function syncFuelLog(
  uid: string,
  txId: string,
  data: { title: string; cost: number; liters: number | null; date: Date },
) {
  return setDoc(doc(db, 'users', uid, 'carLogs', txId), {
    type: 'bensin' as CarLogType,
    title: data.title,
    location: '',
    note: '',
    cost: data.cost,
    liters: data.liters,
    fromFinance: true,
    date: Timestamp.fromDate(data.date),
  });
}

export type CarPart = {
  key: string;
  label: string;
  intervalMonths: number;
  tip: string; // kenapa penting — biar paham seperti mekanik
};

export type PartGroup = { key: string; label: string; parts: CarPart[] };

export const PART_GROUPS: PartGroup[] = [
  {
    key: 'mesin',
    label: '🔧 Mesin',
    parts: [
      { key: 'oli-mesin', label: '🛢️ Oli Mesin', intervalMonths: 6, tip: 'Ganti tiap 6 bulan / 10.000 km — nyawa mesin Skyactiv.' },
      { key: 'filter-oli', label: '🛢️ Filter Oli', intervalMonths: 6, tip: 'Ganti bersamaan dengan oli mesin.' },
      { key: 'filter-udara', label: '💨 Filter Udara Mesin', intervalMonths: 12, tip: 'Filter kotor bikin boros bensin & tarikan berat.' },
      { key: 'busi', label: '⚡ Busi', intervalMonths: 24, tip: 'Skyactiv kompresi tinggi — pakai busi iridium sesuai spek.' },
      { key: 'aki', label: '🔋 Aki', intervalMonths: 6, tip: 'Cek tegangan tiap 6 bulan; umur aki biasanya ±2 tahun.' },
      { key: 'coolant', label: '🌡️ Air Radiator (Coolant)', intervalMonths: 24, tip: 'Kuras tiap 2 tahun — jangan pernah isi air keran.' },
      { key: 'v-belt', label: '🔩 V-Belt / Fan Belt', intervalMonths: 12, tip: 'Cek retak/berdecit — putus di jalan = mogok.' },
    ],
  },
  {
    key: 'kaki',
    label: '🛞 Kaki-kaki & Rem',
    parts: [
      { key: 'kampas-rem', label: '🛑 Kampas Rem', intervalMonths: 6, tip: 'Cek ketebalan tiap 6 bulan — keselamatan nomor satu.' },
      { key: 'minyak-rem', label: '💧 Minyak Rem', intervalMonths: 24, tip: 'Ganti tiap 2 tahun — minyak rem menyerap air.' },
      { key: 'ban', label: '🛞 Ban & Tekanan Angin', intervalMonths: 6, tip: 'Rotasi tiap 6 bulan; cek tekanan tiap isi bensin.' },
      { key: 'spooring', label: '⚖️ Spooring & Balancing', intervalMonths: 12, tip: 'Setahun sekali / setelah hantam lubang keras.' },
      { key: 'shock', label: '🪛 Shock Absorber', intervalMonths: 12, tip: 'Cek rembesan oli di tabung shock.' },
      { key: 'tie-rod', label: '🔗 Tie Rod & Ball Joint', intervalMonths: 12, tip: 'Bunyi "kletek" saat belok = tanda mulai aus.' },
    ],
  },
  {
    key: 'interior',
    label: '❄️ Interior & AC',
    parts: [
      { key: 'filter-kabin', label: '❄️ Filter AC / Kabin', intervalMonths: 12, tip: 'Filter kotor = AC bau & kurang dingin.' },
      { key: 'freon', label: '🧊 Freon AC', intervalMonths: 12, tip: 'Cek tekanan freon & kebersihan kondensor.' },
      { key: 'interior', label: '🧽 Detailing Interior', intervalMonths: 6, tip: 'Jok, karpet, dashboard — kabin bersih, nyaman dipakai.' },
    ],
  },
  {
    key: 'eksterior',
    label: '✨ Eksterior',
    parts: [
      { key: 'wiper', label: '🌧️ Karet Wiper', intervalMonths: 12, tip: 'Karet getas bisa baret kaca — ganti setahun sekali.' },
      { key: 'lampu', label: '💡 Lampu-lampu', intervalMonths: 6, tip: 'Cek dekat/jauh, sein, rem, mundur — tilang & keselamatan.' },
      { key: 'cat', label: '✨ Cat & Coating', intervalMonths: 6, tip: 'Wax/poles tiap 6 bulan — jaga Soul Red tetap kinclong.' },
    ],
  },
  {
    key: 'surat',
    label: '📋 Surat & Pajak',
    parts: [
      { key: 'stnk', label: '📋 STNK Tahunan', intervalMonths: 12, tip: 'Perpanjang tiap 8 Maret — jangan sampai telat.' },
    ],
  },
];

/** Tanggal terakhir tiap part dicek/diganti: users/{uid}/car/parts. */
// `note` = catatan pribadi (mis. bengkel mana, merek oli, harga). Sengaja
// TIDAK ditampilkan di daftar — hanya muncul lagi saat modal part ini dibuka.
export type PartStatusMap = Record<
  string,
  { last: Timestamp; note?: string }
>;

export function subscribePartStatus(
  uid: string,
  onChange: (status: PartStatusMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'car', 'parts');
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.status as PartStatusMap) ?? {});
    },
    onError,
  );
}

export function setPartDate(
  uid: string,
  partKey: string,
  date: Date,
  note = '',
) {
  const ref = doc(db, 'users', uid, 'car', 'parts');
  // merge: hanya part ini yang berubah, status part lain tetap.
  return setDoc(
    ref,
    { status: { [partKey]: { last: Timestamp.fromDate(date), note } } },
    { merge: true },
  );
}

export type PartTone = 'ok' | 'warn' | 'over' | 'unknown';

/** Kondisi part: aman / segera (≤30 hari) / lewat jadwal / belum dicatat. */
export function partCondition(
  last: Timestamp | undefined,
  intervalMonths: number,
  now: Date,
): { tone: PartTone; dueDate: Date | null } {
  if (!last) return { tone: 'unknown', dueDate: null };
  const due = last.toDate();
  due.setMonth(due.getMonth() + intervalMonths);
  // 'warn' = tinggal H-1 ("Besok"), 'over' = hari-H atau lewat ("Sekarang").
  // Dulu peringatan mulai 30 hari sebelumnya; sekarang sengaja mepet supaya
  // labelnya jujur & Dashboard tidak penuh reminder yang masih jauh.
  const daysLeft = daysBetween(now, due);
  const tone: PartTone = daysLeft <= 0 ? 'over' : daysLeft <= 1 ? 'warn' : 'ok';
  return { tone, dueDate: due };
}

export type CarAttention = {
  key: string;
  label: string;
  tone: PartTone;
  dueDate: Date;
};

/**
 * Daftar part yang PERLU PERHATIAN (segera ≤30 hari / lewat jadwal), urut dari
 * yang paling mendesak. Dipakai untuk kartu reminder Car di Dashboard. Part
 * yang belum pernah dicatat tidak diikutkan (belum ada patokan tanggalnya).
 */
export function carAttentionList(
  status: PartStatusMap,
  now: Date,
): CarAttention[] {
  const out: CarAttention[] = [];
  for (const p of PART_GROUPS.flatMap((g) => g.parts)) {
    const { tone, dueDate } = partCondition(
      status[p.key]?.last,
      p.intervalMonths,
      now,
    );
    if ((tone === 'warn' || tone === 'over') && dueDate) {
      out.push({ key: p.key, label: p.label, tone, dueDate });
    }
  }
  return out.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Jumlah part yang perlu perhatian — untuk badge merah di tile Car pada Home.
 */
export function countCarAttention(status: PartStatusMap, now: Date): number {
  return carAttentionList(status, now).length;
}
