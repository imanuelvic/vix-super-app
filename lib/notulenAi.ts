import { Schema } from 'firebase/ai';

import { guardedAiCall } from './aiGuard';
import { GAYA_BAHASA } from './aiStyle';
import {
  AiAnswerError,
  geminiErrorMessage,
  geminiModel,
  parseJsonAnswer,
  stripEmDash,
  withModelFallback,
} from './gemini';

// ✨ Rapihkan notulen dengan AI: lima bagian notulen rapat bulanan CORE apa
// adanya (tulisan cepat saat rapat) → lima bagian yang sama dalam BENTUK yang
// sudah dipakai pemiliknya sendiri:
//
//   • 5 - ⛪CORE & Leaders Meeting #3
//   🗓️ Sabtu, 24 Oktober 2026 🕙 10.30-12.00
//   📍 R. Megasa, NDC Central Park
//
// Bentuk itu yang diajarkan ke model lewat SYSTEM di bawah (23 Sep 2026,
// permintaan pemilik). Sebelumnya notulen sengaja DIBUAT TANPA LAMBANG karena
// ikut dicetak ke PDF; sekarang lambangnya justru bagian dari bentuknya, jadi
// penyaring tanpaEmoji() dilepas dari langkah finalisasi.
//
// Gemini lewat Firebase AI Logic (kuota gratis paket Spark); model, pagar
// biaya, dan pemetaan galatnya di lib/gemini.ts & lib/aiGuard.ts.

export type NotulenPoints = Record<string, string>;

// Lima bagian template notulen, urutan & kuncinya sama dengan
// MONTHLY_AGENDA_POINTS di lib/core.ts.
const KUNCI = ['mentorship', 'leadersMessage', 'ndcInfo', 'core', 'events'] as const;
type Kunci = (typeof KUNCI)[number];

// Batas panjang tiap bagian. Notulen rapat bulanan tak pernah sepanjang ini;
// batasnya cuma pagar supaya satu panggilan tak bisa menelan kuota besar.
export const MAX_CHARS_PER_SECTION = 4000;

const SYSTEM = `Kamu merapikan notulen rapat bulanan pemimpin komunitas gereja (CORE, NDC) yang ditulis cepat saat rapat berlangsung.

Tugasmu: tulis ulang tiap bagian menjadi kesimpulan yang rapi, ringkas, dan jelas, dalam bahasa Indonesia yang baik tapi tetap hangat (bukan bahasa birokrasi).

BENTUK yang WAJIB diikuti (ini bentuk notulen yang sudah dipakai pemiliknya):

• 1 - 🎓Judul poinnya
• 2 - ⛪Judul poin berikutnya
🗓️ Sabtu, 24 Oktober 2026 🕙 10.30-12.00
📍 R. Megasa, NDC Central Park

Jadi:
1. Tiap poin dimulai "• " lalu nomor urut, lalu " - ", lalu SATU lambang yang cocok dengan isinya, lalu judul poinnya. Nomornya mulai dari 1 di tiap bagian.
2. Tanggal, jam, dan tempat TIDAK ditulis di dalam judul: masing-masing turun ke barisnya sendiri di bawah judul itu, dengan lambang di depannya (🗓️ tanggal, 🕙 jam, 📍 tempat). Tanggal & jam boleh satu baris kalau memang sepasang.
3. Rincian lain (poin turunan) ditulis sebagai baris "- " di bawah judulnya.
4. Satu baris kosong antar poin, supaya enak dibaca ulang.

Aturan isi:
5. JANGAN menambah fakta, nama, tanggal, jam, angka, atau keputusan yang tidak ada di tulisan aslinya. JANGAN membuang fakta yang ada. Kalau ragu, pertahankan.
6. Rangkaian pertanyaan singkat (mis. "Absen? Peraturan? Gaya hidup?") dibiarkan sebagai deretan hal yang perlu diperhatikan, jangan dijadikan kalimat panjang.
7. Singkatan gaul dirapikan: "hati2" menjadi "hati-hati", "yg" menjadi "yang", "dgn" menjadi "dengan", "pk." menjadi "pukul".
8. Bagian yang kosong tetap kosong (kembalikan string kosong). Jangan mengisi bagian kosong dengan apa pun.
9. Panjang wajar: satu poin asli tetap satu poin rapi. Ini merapikan, bukan menjabarkan.

Lambangnya dipilih yang memang menggambarkan isinya, satu saja per judul, misalnya: 🎓 kelas/materi · ⛪ ibadah/meeting · 🎄 natal · 🏃 lari · ⚽ futsal · 🥾 hiking · 💝 relationship · 💍 pre-marital · 🎁 volunteer · 🎾 turnamen · 🎤 worship · 📣 pengumuman · 💵 biaya.

${GAYA_BAHASA}

CONTOH (perhatikan bentuknya, bukan isinya):
Tulisan asli:
"5. CORE & Leaders Meeting #3 sabtu 24 okt 2026 jam 10.30-12.00 di R. Megasa NDC Central Park"
Hasil rapi:
• 5 - ⛪CORE & Leaders Meeting #3
🗓️ Sabtu, 24 Oktober 2026 🕙 10.30-12.00
📍 R. Megasa, NDC Central Park`;

// Jawaban dipaksa JSON dengan tepat lima kunci string (structured output),
// jadi tidak ada penguraian teks bebas yang bisa meleset.
const SKEMA = Schema.object({
  properties: {
    mentorship: Schema.string(),
    leadersMessage: Schema.string(),
    ndcInfo: Schema.string(),
    core: Schema.string(),
    events: Schema.string(),
  },
});

function model(nama: string) {
  return geminiModel(nama, {
    systemInstruction: SYSTEM,
    generationConfig: {
      // Menyalin tulisan orang ke kesimpulan itu tugas setia, bukan kreatif.
      temperature: 0.3,
      // Lima bagian ≤ 4000 huruf masing-masing, dan sejak bentuk barunya satu
      // poin bisa jadi tiga baris (judul, tanggal-jam, tempat) — jadi ruangnya
      // dinaikkan. Sisanya untuk "berpikir" modelnya, yang di Gemini 3 ikut
      // dihitung di sini.
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      responseSchema: SKEMA,
    },
  });
}

/**
 * Rapikan masukan: hanya lima kunci, di-trim, dibatasi panjangnya. Melempar
 * AiAnswerError kalau kosong semua atau ada yang kepanjangan.
 */
export function normalizeNotulenPoints(points: NotulenPoints): Record<Kunci, string> {
  const bersih = { mentorship: '', leadersMessage: '', ndcInfo: '', core: '', events: '' };
  for (const k of KUNCI) {
    const v = points[k];
    if (typeof v !== 'string') continue;
    if (v.length > MAX_CHARS_PER_SECTION) {
      throw new AiAnswerError(`Bagian ${k} terlalu panjang (maks ${MAX_CHARS_PER_SECTION} huruf).`);
    }
    bersih[k] = v.trim();
  }
  if (KUNCI.every((k) => bersih[k] === '')) {
    throw new AiAnswerError('Semua bagian kosong, tidak ada yang bisa dirapikan.');
  }
  return bersih;
}

/**
 * Pagar terakhir atas jawaban model: bagian yang aslinya kosong tetap kosong,
 * tanda pisah panjang diganti koma, spasi ujung dibuang. Jawaban yang bukan
 * objek lima string → AiAnswerError.
 */
export function finalizeNotulenAnswer(
  asli: Record<Kunci, string>,
  jawaban: unknown,
): Record<Kunci, string> {
  if (!jawaban || typeof jawaban !== 'object') {
    throw new AiAnswerError('Jawaban AI tidak terbaca. Coba lagi.');
  }
  const hasil = { ...asli };
  for (const k of KUNCI) {
    const v = (jawaban as Record<string, unknown>)[k];
    if (asli[k] === '') {
      hasil[k] = '';
      continue;
    }
    if (typeof v !== 'string') throw new AiAnswerError('Jawaban AI tidak lengkap. Coba lagi.');
    hasil[k] = stripEmDash(v);
  }
  return hasil;
}

export async function rapikanNotulen(points: NotulenPoints): Promise<NotulenPoints> {
  const bersih = normalizeNotulenPoints(points);
  return guardedAiCall(JSON.stringify(bersih), () =>
    withModelFallback(async (nama) => {
      const hasil = await model(nama).generateContent(
        'Rapikan notulen berikut. Kembalikan kelima bagian dengan kunci yang sama.\n\n' +
          JSON.stringify(bersih, null, 2),
      );
      return finalizeNotulenAnswer(bersih, parseJsonAnswer(hasil));
    }),
  );
}

export function notulenAiErrorMessage(e: unknown): string {
  return geminiErrorMessage(e, 'Gagal merapikan notulen. Coba lagi.');
}
