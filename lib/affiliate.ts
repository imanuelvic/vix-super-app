import { doc, setDoc, Timestamp, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Affiliate 🤝 — topi kelima di Career: jadi Influencer / Content Creator.
//
// Isinya DUA hal yang sebenarnya satu alur:
//   1. tampungan ide konten — supaya ide yang lewat di kepala tidak hilang,
//   2. catatan affiliate — produk apa, link-nya mana, sudah diposting belum.
//
// Satu dokumen array kecil (pola yang sama dengan visitations & self-reward):
//   users/{uid}/career/affiliate -> { list: ContentIdea[] }
// Idenya puluhan, bukan ribuan, jadi satu dokumen jauh lebih hemat daripada
// koleksi berisi dokumen-dokumen kecil.

export type AffiliatePlatform = 'tiktok' | 'instagram' | 'threads';

export const AFFILIATE_PLATFORMS: {
  key: AffiliatePlatform;
  label: string;
  icon: string;
}[] = [
  { key: 'tiktok', label: 'TikTok', icon: '🎵' },
  { key: 'instagram', label: 'Instagram', icon: '📸' },
  { key: 'threads', label: 'Threads', icon: '🧵' },
];

export function platformMeta(key: string) {
  return (
    AFFILIATE_PLATFORMS.find((p) => p.key === key) ?? {
      key,
      label: key,
      icon: '❓',
    }
  );
}

/**
 * Tiga tahap, sengaja tidak lebih. Lebih banyak tahap terdengar rapi tapi
 * ujungnya cuma bikin ragu mau ditaruh di mana — dan ide yang ragu ditaruh
 * biasanya tidak jadi dikerjakan.
 */
export type IdeaStage = 'idea' | 'making' | 'posted';

export const IDEA_STAGES: { key: IdeaStage; label: string; icon: string }[] = [
  { key: 'idea', label: 'Ide', icon: '💡' },
  { key: 'making', label: 'Digarap', icon: '🎬' },
  { key: 'posted', label: 'Tayang', icon: '✅' },
];

export function stageMeta(key: string) {
  return IDEA_STAGES.find((s) => s.key === key) ?? IDEA_STAGES[0];
}

export type ContentIdea = {
  id: string;
  title: string;
  /** Hook / angle / caption — bebas, ini kotak coret-coretnya. */
  note: string;
  /** Bisa lebih dari satu: konten yang sama sering dipakai ulang lintas app. */
  platforms: AffiliatePlatform[];
  stage: IdeaStage;
  /** Produk affiliate yang dipromosikan (kosong = konten biasa, bukan jualan). */
  product: string;
  /** Link affiliate-nya. */
  link: string;
  createdAt: Timestamp;
};

export function newIdeaId(): string {
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function ref(uid: string) {
  return doc(db, 'users', uid, 'career', 'affiliate');
}

export function subscribeAffiliateIdeas(
  uid: string,
  onChange: (list: ContentIdea[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    ref(uid),
    (snapshot) => onChange((snapshot.data()?.list as ContentIdea[]) ?? []),
    onError,
  );
}

/** Tulis ulang seluruh daftar — tambah, ubah, & HAPUS permanen. */
export function saveAffiliateIdeas(uid: string, list: ContentIdea[]) {
  return setDoc(ref(uid), { list });
}

/**
 * Urutan tampil: yang belum tayang dulu (💡 lalu 🎬), baru yang sudah tayang.
 * Di tiap kelompok, yang terbaru di atas — ide segar biasanya yang paling ingin
 * dikerjakan, dan yang sudah tayang cuma jadi arsip.
 */
export function sortedIdeas(list: ContentIdea[]): ContentIdea[] {
  const urutan: Record<IdeaStage, number> = { idea: 0, making: 1, posted: 2 };
  return [...list].sort((a, b) => {
    const beda = urutan[a.stage] - urutan[b.stage];
    if (beda !== 0) return beda;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });
}

/** Berapa ide yang masih menunggu digarap — angka badge sub-tab Affiliate. */
export function pendingIdeas(list: ContentIdea[]): number {
  return list.filter((i) => i.stage !== 'posted').length;
}

/** Hitungan per tahap, untuk angka di chip saringan. */
export function stageCounts(list: ContentIdea[]): Record<IdeaStage, number> {
  const out: Record<IdeaStage, number> = { idea: 0, making: 0, posted: 0 };
  for (const i of list) out[i.stage] += 1;
  return out;
}
