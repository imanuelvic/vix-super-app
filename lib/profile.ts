import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Profil diri 🪪 — data penting pribadi (identitas WNI) supaya tidak lupa.
// SATU dokumen kecil: users/{uid}/app/profile. Foto base64 kecil ikut di dalam.
//
// ⚠️ SENSITIF: berisi NIK, No. KK, NPWP, dll. Pastikan Firestore Security Rules
// mengunci dokumen ini HANYA untuk pemiliknya (request.auth.uid == uid). Jangan
// hardcode nilai NIK/NPWP asli di source code — isi lewat modal Edit saja, biar
// datanya hanya ada di Firestore pribadimu, bukan ikut ter-commit ke repo.

export type Profile = {
  fullName: string;
  nickname: string;
  birthPlace: string;
  birthDate: string;
  gender: string;
  religion: string;
  bloodType: string;
  maritalStatus: string;
  nationality: string;
  nik: string; // NIK / KTP
  kk: string; // No. Kartu Keluarga
  npwp: string;
  passport: string; // No. Paspor
  bpjs: string; // No. BPJS Kesehatan
  address: string;
  phone: string;
  email: string;
  notes: string; // catatan bebas
  photo: string | null; // JPEG base64 kecil (tanpa prefix data:)
};

// ── Kolom yang jawabannya TERBATAS ───────────────────────────────────────
// Ini bukan sekadar biar cepat mengisi: kolom ketikan bebas membuat isian yang
// sama ditulis beda-beda ("Kristen" / "Protestan" / "Kristen Protestan"), dan
// isi kolom ini nantinya disalin ke formulir resmi — jadi tulisannya memang
// harus baku. Golongan darah TIDAK ditulis ulang di sini: daftarnya sudah ada
// di lib/health (BLOOD_TYPES), dipakai bareng Data Tubuh 🧍.

/** Enam agama yang diakui negara, plus Kepercayaan (boleh di KTP sejak 2017). */
export const RELIGIONS = [
  'Islam',
  'Kristen Protestan',
  'Katolik',
  'Hindu',
  'Buddha',
  'Khonghucu',
  'Kepercayaan',
];

/** Bahasa app ini santai, jadi bukan "Laki-laki / Perempuan". */
export const GENDERS = ['Cowok', 'Cewek'];

/** Empat status di KTP — tulisannya mengikuti yang tercetak di sana. */
export const MARITAL_STATUSES = [
  'Belum kawin',
  'Kawin',
  'Cerai hidup',
  'Cerai mati',
];

// Default aman: hanya isi yang TIDAK sensitif (nama & kewarganegaraan). Data
// identitas (NIK dsb.) sengaja kosong — diisi lewat modal Edit oleh pemiliknya.
export const EMPTY_PROFILE: Profile = {
  fullName: 'Imanuel Victory Rumayar',
  nickname: '',
  birthPlace: '',
  birthDate: '',
  gender: '',
  religion: '',
  bloodType: '',
  maritalStatus: '',
  nationality: 'Indonesia',
  nik: '',
  kk: '',
  npwp: '',
  passport: '',
  bpjs: '',
  address: '',
  phone: '',
  email: '',
  notes: '',
  photo: null,
};

export function subscribeProfile(
  uid: string,
  onChange: (profile: Profile) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'app', 'profile');
  return liveDoc(
    ref,
    (snapshot) => {
      // Dokumen belum ada → pakai default; field tersimpan menimpa default.
      onChange({
        ...EMPTY_PROFILE,
        ...(snapshot.data() as Partial<Profile> | undefined),
      });
    },
    onError,
  );
}

/** Simpan profil (tulis utuh, merge → field yang tak dikirim tetap). */
export function saveProfile(uid: string, data: Profile) {
  return setDoc(doc(db, 'users', uid, 'app', 'profile'), data, { merge: true });
}
