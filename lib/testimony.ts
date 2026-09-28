import {
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveList } from './liveDoc';

// Testimony 🪨 — batu peringatan (28 Sep 2026).
//
// "Sampai di sini TUHAN menolong kita." (1 Samuel 7:12)
//
// ── Kenapa fitur ini ada, dan kenapa ia BUKAN fitur yang sudah ada ────────
// Seluruh app ini mengurus hari ini: baris hari ini, streak hari ini, badge
// hari ini. Yang tidak punya tempat sama sekali: hari yang sudah lewat tapi
// tidak boleh dilupakan — mukjizat, hal keren yang terjadi begitu saja, dan
// hari-hari yang dijalani sampai habis padahal berisiko.
//
// Tiga fitur terdekat sudah diperiksa, dan tak satu pun cocok:
//   • His Promise 🚩 melihat KE DEPAN (janji yang dipegang sampai digenapi);
//     ini melihat ke belakang, ke yang SUDAH terjadi.
//   • Timeline 📋 itu wishlist & target per tahun — rencana, bukan kenangan.
//   • Fun 🎉 mencatat tempat & pencapaian (gunung, race), bukan ceritanya.
// Jadi ia berdiri sendiri, dan tinggal di Walk 🕊️ karena yang dicari di sini
// penyertaan Tuhan, bukan prestasi.
//
// Penyimpanan: satu dokumen per catatan di users/{uid}/testimonies/{id},
// pola yang sama dengan His Promise. Alasannya sama juga: catatan ini ditulis
// SEKALI lalu ditengok bertahun-tahun, jadi menulis satu catatan tidak boleh
// menulis ulang seluruh arsipnya.

export type TestimonyKind = 'miracle' | 'fullday' | 'cool' | 'mark';

/**
 * Empat jenis, dan sengaja tidak lebih.
 *
 * Daftar panjang membuat "mencatat" berubah jadi "memilih kategori dulu", dan
 * yang paling sering terjadi sesudah itu: tidak jadi mencatat. Yang keempat
 * (📌 Tanggal Penting) memang penampung — supaya tidak ada kenangan yang
 * dipaksa masuk ke jenis yang salah cuma karena tidak ada tempat lain.
 */
export const TESTIMONY_KINDS: {
  key: TestimonyKind;
  emoji: string;
  label: string;
  /** Kalimat penuntun saat memilih jenisnya. */
  hint: string;
}[] = [
  {
    key: 'miracle',
    emoji: '🙌',
    label: 'Mukjizat',
    hint: 'Tuhan turun tangan, dan tidak ada penjelasan lain yang masuk akal.',
  },
  {
    key: 'fullday',
    emoji: '💪',
    label: 'Hari Niat',
    hint: 'Sehari penuh, berisiko, dijalani sampai habis. Hari yang tidak akan terulang begitu saja.',
  },
  {
    key: 'cool',
    emoji: '✨',
    label: 'Momen Keren',
    hint: 'Hal keren yang terjadi begitu saja, yang bikin kamu berhenti sebentar.',
  },
  {
    key: 'mark',
    emoji: '📌',
    label: 'Tanggal Penting',
    hint: 'Tanggal yang ingin kamu ingat seumur hidup, apa pun bentuknya.',
  },
];

export type Testimony = {
  id: string;
  /** Kapan kejadiannya, "YYYY-MM-DD". Bukan kapan dicatat. */
  dayId: string;
  kind: TestimonyKind;
  /** Satu kalimat: apa yang terjadi. Ini satu-satunya yang wajib. */
  title: string;
  /** Ceritanya selengkapnya (boleh kosong). */
  story: string;
};

export function newTestimonyId(): string {
  return `ts${Date.now().toString(36)}`;
}

/** Jenis yang dikenal; kunci asing jatuh ke 📌 supaya catatannya tidak hilang. */
export function testimonyKindMeta(key: string): (typeof TESTIMONY_KINDS)[number] {
  return (
    TESTIMONY_KINDS.find((k) => k.key === key) ??
    TESTIMONY_KINDS[TESTIMONY_KINDS.length - 1]
  );
}

function testimonyCollection(uid: string) {
  return collection(db, 'users', uid, 'testimonies');
}

/**
 * Semua catatan, yang terbaru di atas.
 *
 * Batas 400: ini arsip seumur hidup, jadi ia memang tidak pernah menyusut —
 * tapi 400 tanggal penting itu jauh lebih banyak daripada yang realistis
 * terkumpul, dan batasnya menjaga biaya bacanya tetap punya langit-langit.
 */
export function subscribeTestimonies(
  uid: string,
  onChange: (list: Testimony[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(testimonyCollection(uid), orderBy('dayId', 'desc'), limit(400));
  return liveList<Testimony>(q, onChange, onError, (d) => {
    const data = d.data();
    return {
      id: d.id,
      dayId: String(data.dayId ?? ''),
      kind: testimonyKindMeta(String(data.kind ?? '')).key,
      title: String(data.title ?? ''),
      story: String(data.story ?? ''),
    };
  });
}

export function saveTestimony(uid: string, t: Testimony) {
  const { id, ...data } = t;
  return setDoc(doc(testimonyCollection(uid), id), data);
}

/** Hapus PERMANEN — dokumennya benar-benar hilang, bukan ditandai. */
export function deleteTestimony(uid: string, id: string) {
  return deleteDoc(doc(testimonyCollection(uid), id));
}

// ===================== Dikelompokkan per tahun =====================

export type TestimonyYear = { year: number; items: Testimony[] };

/**
 * Catatan dikelompokkan per tahun, tahun terbaru di atas.
 *
 * Pengelompokan inilah isi fiturnya: satu daftar panjang cuma menjawab "apa
 * saja", sedangkan per tahun menjawab pertanyaan yang sebenarnya dicari —
 * "tahun itu Tuhan menolong lewat apa saja?".
 *
 * Tahunnya dibaca dari empat huruf pertama dayId, bukan lewat `new Date`:
 * membentuk Date dari teks tanggal bisa bergeser sehari mengikuti zona waktu,
 * dan pergeseran itu memindahkan catatan 1 Januari ke tahun sebelumnya.
 */
export function testimonyYears(list: Testimony[]): TestimonyYear[] {
  const peta = new Map<number, Testimony[]>();
  for (const t of list) {
    const tahun = Number(t.dayId.slice(0, 4));
    if (!Number.isFinite(tahun) || tahun === 0) continue;
    const isi = peta.get(tahun);
    if (isi) isi.push(t);
    else peta.set(tahun, [t]);
  }
  return [...peta.entries()]
    .map(([year, items]) => ({
      year,
      items: [...items].sort((a, b) => b.dayId.localeCompare(a.dayId)),
    }))
    .sort((a, b) => b.year - a.year);
}

/** Berapa catatan per jenis — untuk kartu ringkasannya. */
export function testimonyCounts(list: Testimony[]): Record<TestimonyKind, number> {
  const hasil = { miracle: 0, fullday: 0, cool: 0, mark: 0 };
  for (const t of list) hasil[testimonyKindMeta(t.kind).key] += 1;
  return hasil;
}

/** "🙌 2 · 💪 4" — jenis yang jumlahnya nol tidak ikut disebut. */
export function testimonyCountLine(list: Testimony[]): string {
  const n = testimonyCounts(list);
  return TESTIMONY_KINDS.filter((k) => n[k.key] > 0)
    .map((k) => `${k.emoji} ${n[k.key]}`)
    .join(' · ');
}

// ===================== Empat catatan pertama =====================
//
// Keempatnya didiktekan pemilik app sendiri (28 Sep 2026) sebagai contoh
// "hari niat": hari penuh, berisiko, dan tetap dijalani sampai habis.
//
// Kenapa ia jadi TOMBOL, bukan langsung ditulis ke Firestore: data pemilik app
// bukan milik kodenya, jadi app ini tidak boleh menaruh apa pun di sana tanpa
// dia yang meng-click. Tombolnya juga cuma muncul saat arsipnya masih kosong.
//
// Id-nya sengaja bukan acak melainkan turunan tanggalnya: meng-click tombolnya
// dua kali menimpa catatan yang sama, bukan melahirkan empat kembarannya.

export const TESTIMONY_SEED: Testimony[] = [
  {
    id: 'seed-2026-05-03',
    dayId: '2026-05-03',
    kind: 'fullday',
    title: 'Turun Gunung Merbabu, langsung doa persembahan NCH 7',
    story:
      'Selesai mendaki Gunung Merbabu, hari itu juga langsung membawakan doa persembahan di NCH 7. Badan capek, pelayanan tetap jalan.',
  },
  {
    id: 'seed-2026-05-17',
    dayId: '2026-05-17',
    kind: 'fullday',
    title: 'Khotbah di NDC Youth, langsung berangkat ke Bali',
    story:
      'Selesai khotbah di NDC Youth, hari itu juga langsung berangkat ke Bali. Satu hari, dua hal besar.',
  },
  {
    id: 'seed-2026-08-02',
    dayId: '2026-08-02',
    kind: 'fullday',
    title: 'Turun Ranu Kumbolo, langsung doa persembahan NCH 7',
    story:
      'Pulang dari Ranu Kumbolo, langsung melayani doa persembahan di NCH 7.',
  },
  {
    id: 'seed-2026-09-13',
    dayId: '2026-09-13',
    kind: 'fullday',
    title: 'Milo Run, fellowship CORE Elvina, doa persembahan NCH 7',
    story:
      'Pagi lomba Milo Run (tercatat juga di Fitness, kategori Race), siangnya fellowship sehari penuh bersama CORE Elvina, malamnya langsung doa persembahan di NCH 7. Satu hari, tiga babak.',
  },
];

/** Tulis keempat catatan awal sekaligus (satu batch, jadi tidak setengah jadi). */
export function seedTestimonies(uid: string) {
  const batch = writeBatch(db);
  for (const t of TESTIMONY_SEED) {
    const { id, ...data } = t;
    batch.set(doc(testimonyCollection(uid), id), data);
  }
  return batch.commit();
}
