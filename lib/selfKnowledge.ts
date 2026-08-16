import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { dayIdToDate, daysBetween } from './format';

// Mengenal diri 🧠 — Personality (MBTI, Love Language, DISC, dll), Ikigai,
// dan SWOT. Ketiganya jarang berubah & isinya pendek, jadi ditaruh di SATU
// dokumen kecil: users/{uid}/app/selfKnowledge → buka tab Profile = 1 read.
//
// Daftar MBTI / Love Language / DISC sengaja DIPAKAI ULANG dari lib/core
// (dipakai juga untuk mengenali CORE Leader) — satu sumber, jangan dobel.

export type Personality = {
  mbti: string | null;
  mbtiDayId: string | null; // tanggal tes MBTI terakhir ("YYYY-MM-DD")
  loveLanguage: string | null;
  loveDayId: string | null; // tanggal tes Love Language terakhir
  disc: string | null;
  enneagram: string | null;
  temperament: string | null;
  strengths: string; // kekuatan utama (mis. top 5 StrengthsFinder)
  notes: string; // catatan bebas tentang diri sendiri
};

export type Ikigai = {
  love: string; // yang kamu CINTAI
  goodAt: string; // yang kamu KUASAI
  worldNeeds: string; // yang DIBUTUHKAN dunia
  paidFor: string; // yang bisa DIBAYAR
  statement: string; // kalimat ikigai-mu
};

export type Swot = {
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
};

export type SelfKnowledge = {
  personality: Personality;
  ikigai: Ikigai;
  swot: Swot;
};

export const EMPTY_SELF_KNOWLEDGE: SelfKnowledge = {
  personality: {
    mbti: null,
    mbtiDayId: null,
    loveLanguage: null,
    loveDayId: null,
    disc: null,
    enneagram: null,
    temperament: null,
    strengths: '',
    notes: '',
  },
  ikigai: { love: '', goodAt: '', worldNeeds: '', paidFor: '', statement: '' },
  swot: { strengths: '', weaknesses: '', opportunities: '', threats: '' },
};

/** Julukan tiap tipe MBTI — biar hasil tes terasa "kamu banget". */
export const MBTI_NICKNAME: Record<string, string> = {
  INTJ: 'Sang Arsitek', INTP: 'Sang Pemikir', ENTJ: 'Sang Komandan', ENTP: 'Sang Pendebat',
  INFJ: 'Sang Advokat', INFP: 'Sang Mediator', ENFJ: 'Sang Protagonis', ENFP: 'Sang Juru Kampanye',
  ISTJ: 'Sang Ahli Logistik', ISFJ: 'Sang Pembela', ESTJ: 'Sang Eksekutif', ESFJ: 'Sang Konsul',
  ISTP: 'Sang Virtuoso', ISFP: 'Sang Petualang', ESTP: 'Sang Pengusaha', ESFP: 'Sang Penghibur',
};

/** 9 tipe Enneagram — motivasi terdalam, pelengkap MBTI. */
export const ENNEAGRAM_OPTIONS: { key: string; label: string; sub: string }[] = [
  { key: '1', label: 'Tipe 1 · Sang Perfeksionis', sub: 'Ingin benar & berintegritas' },
  { key: '2', label: 'Tipe 2 · Sang Penolong', sub: 'Ingin dibutuhkan & dikasihi' },
  { key: '3', label: 'Tipe 3 · Sang Pencapai', sub: 'Ingin berhasil & diakui' },
  { key: '4', label: 'Tipe 4 · Sang Individualis', sub: 'Ingin autentik & bermakna' },
  { key: '5', label: 'Tipe 5 · Sang Peneliti', sub: 'Ingin paham & mandiri' },
  { key: '6', label: 'Tipe 6 · Sang Setia', sub: 'Ingin aman & punya pegangan' },
  { key: '7', label: 'Tipe 7 · Sang Petualang', sub: 'Ingin bebas & bahagia' },
  { key: '8', label: 'Tipe 8 · Sang Penantang', sub: 'Ingin kuat & memegang kendali' },
  { key: '9', label: 'Tipe 9 · Sang Pendamai', sub: 'Ingin damai & harmonis' },
];

/** 4 temperamen klasik — cara alami merespons keadaan. */
export const TEMPERAMENT_OPTIONS: { key: string; label: string; sub: string }[] = [
  { key: 'sanguinis', label: '🎉 Sanguinis', sub: 'Ceria, spontan, suka orang' },
  { key: 'koleris', label: '🔥 Koleris', sub: 'Tegas, cepat ambil keputusan' },
  { key: 'melankolis', label: '🎨 Melankolis', sub: 'Teliti, mendalam, perfeksionis' },
  { key: 'plegmatis', label: '🌊 Plegmatis', sub: 'Tenang, sabar, pendamai' },
];

// Tes kepribadian sebaiknya diulang SETAHUN sekali — jawabanmu ikut berubah
// seiring musim hidup. Angka ini juga dipakai untuk kartu "waktunya tes lagi".
const TEST_INTERVAL_DAYS = 365;

/**
 * Berapa hari lagi tes ini perlu diulang. null = belum pernah dites.
 * Negatif/0 = sudah waktunya.
 */
export function testDaysLeft(dayId: string | null, now: Date): number | null {
  if (!dayId) return null;
  return TEST_INTERVAL_DAYS - daysBetween(dayIdToDate(dayId), now);
}

function ref(uid: string) {
  return doc(db, 'users', uid, 'app', 'selfKnowledge');
}

export function subscribeSelfKnowledge(
  uid: string,
  onChange: (data: SelfKnowledge) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    ref(uid),
    (snapshot) => {
      const d = snapshot.data() as Partial<SelfKnowledge> | undefined;
      onChange({
        personality: { ...EMPTY_SELF_KNOWLEDGE.personality, ...d?.personality },
        ikigai: { ...EMPTY_SELF_KNOWLEDGE.ikigai, ...d?.ikigai },
        swot: { ...EMPTY_SELF_KNOWLEDGE.swot, ...d?.swot },
      });
    },
    onError,
  );
}

/** Simpan SATU bagian saja (merge — dua bagian lain tidak tersentuh). */
export function saveSelfKnowledge(
  uid: string,
  part: Partial<SelfKnowledge>,
) {
  return setDoc(ref(uid), part, { merge: true });
}
