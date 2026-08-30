import {
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc, liveList } from './liveDoc';

// Social 🥂 — fitur untuk yang terjadi SAAT bergaul dengan teman.
//
// Dua bagian:
//   • Split Bill — patungan setelah makan bareng: siapa makan apa, berapa
//     bagiannya, siapa yang sudah bayar.
//   • Places     — tempat nongkrong: yang mau dicoba & yang sudah pernah.
//
// Penyimpanannya sengaja BEDA bentuk untuk keduanya:
//   users/{uid}/bills/{id}        → satu dokumen per tagihan (ada foto nota!)
//   users/{uid}/social/places     → SATU dokumen berisi array tempat
// Alasannya batas keras Firestore 1 MB per dokumen: foto nota menumpuk cepat,
// sedangkan daftar tempat cuma teks dan jauh lebih hemat jadi satu dokumen.

// ============================ Split Bill 💸 ============================

/** Satu baris di nota. `price` = harga TOTAL baris itu, bukan harga satuan. */
export type BillItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
  /** id orang yang patungan item ini. Kosong = belum dibagi ke siapa pun. */
  sharedBy: string[];
};

export type BillPerson = {
  id: string;
  name: string;
  /** Sudah menyetor bagiannya. */
  paid: boolean;
};

export type Bill = {
  id: string;
  title: string;
  place: string;
  date: Timestamp;
  items: BillItem[];
  people: BillPerson[];
  /** Pajak (PB1/PPN) dalam persen — dibagi PROPORSIONAL, bukan rata. */
  taxPercent: number;
  /** Service charge dalam persen — juga proporsional. */
  servicePercent: number;
  /** Potongan dalam rupiah — ikut dibagi proporsional. */
  discount: number;
  /**
   * Nota-nya sudah difoto? Fotonya SENDIRI tidak di sini — lihat catatan
   * "Foto nota" di bawah. Penanda ini cukup untuk menampilkan lambang 📸 di
   * daftar tanpa perlu mengunduh gambarnya.
   */
  hasPhoto: boolean;
  note: string;
};

export const newBillId = () => `bill-${Date.now().toString(36)}`;
export const newItemId = () =>
  `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
export const newPersonId = () =>
  `pr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function emptyBill(id: string): Bill {
  return {
    id,
    title: '',
    place: '',
    date: Timestamp.now(),
    items: [],
    people: [],
    taxPercent: 0,
    servicePercent: 0,
    discount: 0,
    hasPhoto: false,
    note: '',
  };
}

function billsCollection(uid: string) {
  return collection(db, 'users', uid, 'bills');
}

function billRef(uid: string, id: string) {
  return doc(db, 'users', uid, 'bills', id);
}

function fromDoc(id: string, data: Record<string, unknown> | undefined): Bill {
  const d = data ?? {};
  return {
    id,
    title: (d.title as string) ?? '',
    place: (d.place as string) ?? '',
    date: (d.date as Timestamp) ?? Timestamp.now(),
    items: (d.items as BillItem[]) ?? [],
    people: (d.people as BillPerson[]) ?? [],
    taxPercent: (d.taxPercent as number) ?? 0,
    servicePercent: (d.servicePercent as number) ?? 0,
    discount: (d.discount as number) ?? 0,
    hasPhoto: d.hasPhoto === true,
    note: (d.note as string) ?? '',
  };
}

export function subscribeBills(
  uid: string,
  onChange: (list: Bill[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index. Dibatasi 60 seperti
  // notulen CORE: fotonya ikut terbawa tiap kali daftarnya dibaca.
  const q = query(billsCollection(uid), orderBy('date', 'desc'), limit(60));
  return liveList<Bill>(q, onChange, onError, (d) => fromDoc(d.id, d.data()));
}

/** Satu tagihan saja — dipakai layar rinciannya (hemat, tidak menarik semua). */
export function subscribeBill(
  uid: string,
  id: string,
  onChange: (bill: Bill | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    billRef(uid, id),
    (snapshot) =>
      onChange(snapshot.exists() ? fromDoc(snapshot.id, snapshot.data()) : null),
    onError,
  );
}

/** Simpan/timpa seluruh tagihan. `id` tidak ikut ditulis (sudah jadi nama doc). */
export function saveBill(uid: string, bill: Bill) {
  const { id, ...data } = bill;
  return setDoc(billRef(uid, id), data);
}

// ===================== Foto nota =====================
//
// Fotonya sengaja disimpan di DOKUMEN TERPISAH, bukan di dalam tagihannya.
//
// Alasannya biaya & kecepatan: daftar tagihan ditarik 60 sekaligus — di layar
// Split Bill DAN di Home (untuk badge "belum lunas"). Kalau foto base64 ikut
// menempel di tiap tagihan, sekali buka Home bisa mengunduh belasan megabyte
// lewat kuota, tiap kali. Dipisah begini, dokumen tagihannya tinggal beberapa
// ratus byte dan fotonya hanya diambil saat layar rinciannya benar-benar
// dibuka — itu pun lewat liveDoc, jadi ikut ter-cache di HP.

function billPhotoRef(uid: string, id: string) {
  return doc(db, 'users', uid, 'bills', id, 'media', 'photo');
}

/** Foto nota satu tagihan. null = memang belum difoto. */
export function subscribeBillPhoto(
  uid: string,
  id: string,
  onChange: (photo: string | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    billPhotoRef(uid, id),
    (snapshot) => onChange((snapshot.data()?.photo as string) ?? null),
    onError,
  );
}

export function saveBillPhoto(uid: string, id: string, photo: string) {
  return setDoc(billPhotoRef(uid, id), { photo });
}

/**
 * Hapus PERMANEN — tidak ada arsip, sesuai aturan hapus di app ini.
 * Fotonya ikut dibuang: Firestore TIDAK menghapus sub-koleksi otomatis, jadi
 * kalau tidak disebut di sini fotonya akan menggantung selamanya & tetap
 * menghabiskan penyimpanan.
 */
export async function deleteBill(uid: string, id: string) {
  await deleteDoc(billPhotoRef(uid, id));
  await deleteDoc(billRef(uid, id));
}

// ===================== Hitungan patungan =====================
//
// Aturannya satu: tiap orang membayar APA YANG DIA MAKAN, lalu pajak, service
// charge, & diskon dibagi PROPORSIONAL menurut besar bagiannya — bukan dibagi
// rata. Yang cuma pesan es teh tidak ikut menanggung pajak steak orang lain.

/** Jumlah harga semua item (sebelum pajak, service, & diskon). */
export function billSubtotal(bill: Bill): number {
  return bill.items.reduce((sum, i) => sum + i.price, 0);
}

/** Total yang benar-benar dibayar di kasir. */
export function billTotal(bill: Bill): number {
  const sub = billSubtotal(bill);
  const tambahan = (sub * (bill.taxPercent + bill.servicePercent)) / 100;
  return Math.max(0, Math.round(sub + tambahan - bill.discount));
}

/** Item yang belum ditandai siapa yang makan — ini yang bikin totalnya bocor. */
export function unsharedItems(bill: Bill): BillItem[] {
  return bill.items.filter((i) => i.sharedBy.length === 0);
}

/** Bagian MENTAH tiap orang (baru harga item, belum pajak/service/diskon). */
function itemShares(bill: Bill): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of bill.people) out[p.id] = 0;
  for (const item of bill.items) {
    if (item.sharedBy.length === 0) continue;
    const per = item.price / item.sharedBy.length;
    for (const id of item.sharedBy) {
      // Orang yang sudah dihapus tapi masih tertinggal di item diabaikan.
      if (out[id] !== undefined) out[id] += per;
    }
  }
  return out;
}

export type BillShare = {
  person: BillPerson;
  /** Harga item yang dia makan saja. */
  items: number;
  /** Bagian pajak + service − diskon yang jadi tanggungannya. */
  extra: number;
  /** Yang harus dia setor: items + extra, sudah dibulatkan ke rupiah. */
  total: number;
};

/**
 * Berapa yang harus disetor tiap orang.
 *
 * Pembulatan dilakukan PER ORANG, jadi jumlah semuanya bisa meleset satu-dua
 * rupiah dari total kasir. Itu memang tak terhindarkan saat satu angka dibagi
 * tiga; yang penting tidak ada yang merasa dicurangi.
 */
export function billShares(bill: Bill): BillShare[] {
  const sub = billSubtotal(bill);
  const shares = itemShares(bill);
  const tambahan = (sub * (bill.taxPercent + bill.servicePercent)) / 100;
  const bersih = tambahan - bill.discount;
  return bill.people.map((person) => {
    const items = shares[person.id] ?? 0;
    // Proporsional: yang bagiannya separuh nota, menanggung separuh pajaknya.
    const extra = sub > 0 ? (bersih * items) / sub : 0;
    return {
      person,
      items: Math.round(items),
      extra: Math.round(extra),
      total: Math.max(0, Math.round(items + extra)),
    };
  });
}

/** Berapa orang yang belum menyetor — angka badge & penagih di daftar. */
export function unpaidCount(bill: Bill): number {
  return bill.people.filter((p) => !p.paid).length;
}

/** Total rupiah yang masih ditunggu dari semua tagihan. */
export function outstandingTotal(bills: Bill[]): number {
  let out = 0;
  for (const bill of bills) {
    for (const s of billShares(bill)) {
      if (!s.person.paid) out += s.total;
    }
  }
  return out;
}

/** Tagihan yang masih ada orang belum bayar — ditaruh paling atas di daftar. */
export function billUnsettled(bill: Bill): boolean {
  return bill.people.length > 0 && unpaidCount(bill) > 0;
}

/** Urutan tampil: yang belum lunas dulu, lalu yang terbaru. */
export function sortedBills(bills: Bill[]): Bill[] {
  return [...bills].sort((a, b) => {
    const beda = Number(billUnsettled(b)) - Number(billUnsettled(a));
    if (beda !== 0) return beda;
    return b.date.toMillis() - a.date.toMillis();
  });
}

// ============================== Places 🍜 ==============================

export const PLACE_KINDS: { key: string; label: string; icon: string }[] = [
  { key: 'cafe', label: 'Cafe', icon: '☕' },
  { key: 'resto', label: 'Resto', icon: '🍽️' },
  { key: 'streetfood', label: 'Kaki Lima', icon: '🍢' },
  { key: 'dessert', label: 'Dessert', icon: '🍰' },
  { key: 'activity', label: 'Aktivitas', icon: '🎳' },
];

export function placeKindMeta(key: string) {
  return (
    PLACE_KINDS.find((k) => k.key === key) ?? {
      key,
      label: 'Lainnya',
      icon: '📍',
    }
  );
}

export type Place = {
  id: string;
  name: string;
  kind: string;
  /** Daerahnya, mis. "Pakuwon" — biar gampang memilih yang dekat. */
  area: string;
  /** Perkiraan habis per orang (rupiah). 0 = belum tahu. */
  pricePerPerson: number;
  /** Sudah pernah ke sini? false = masih masuk daftar "mau coba". */
  visited: boolean;
  /** 0 = belum dinilai, 1–5 = bintang. Hanya untuk yang sudah pernah. */
  rating: number;
  note: string;
};

export const newPlaceId = () => `pl-${Date.now().toString(36)}`;

function placesRef(uid: string) {
  return doc(db, 'users', uid, 'social', 'places');
}

export function subscribePlaces(
  uid: string,
  onChange: (list: Place[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    placesRef(uid),
    (snapshot) => onChange((snapshot.data()?.list as Place[]) ?? []),
    onError,
  );
}

/** Tulis ulang seluruh daftar — tambah, ubah, & HAPUS permanen. */
export function savePlaces(uid: string, list: Place[]) {
  return setDoc(placesRef(uid), { list });
}

/** Urutan: yang belum pernah didatangi dulu (itu yang perlu diputuskan). */
export function sortedPlaces(list: Place[]): Place[] {
  return [...list].sort((a, b) => {
    if (a.visited !== b.visited) return a.visited ? 1 : -1;
    // Sudah pernah → yang paling disuka di atas. Belum pernah → urut nama.
    if (a.visited && b.visited && a.rating !== b.rating) {
      return b.rating - a.rating;
    }
    return a.name.localeCompare(b.name);
  });
}
