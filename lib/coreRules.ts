import {
  collection,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { MEETING_KINDS } from './core';
import { db } from './firebase';
import { liveList } from './liveDoc';

// ===================== Rules & Suggestions 📜 =====================
// Panduan resmi kegiatan CORE — dokumen yang dikirim ke setiap CORE Leader
// begitu ada reminder acaranya. Isinya panjang & jarang berubah, jadi SATU
// DOKUMEN PER TOPIK (bukan satu array besar):
//   users/{uid}/coreRules/{kind} → { icon, title, credit, version, updated, body }
//
// `kind` BIASANYA sebuah MeetingKind, supaya panduan & jadwal acaranya tidak
// pernah lepas kaitan. Tapi tidak semua panduan itu jenis pertemuan —
// "fundraising" misalnya sebuah topik kebijakan, bukan acara yang dijadwalkan.
// Karena itu tipenya string, bukan MeetingKind.

export type CoreRule = {
  /** Sekaligus id dokumen Firestore — satu panduan per topik. */
  kind: string;
  /** Emoji dokumen. Disimpan sendiri (bukan diambil dari MEETING_KINDS) supaya
      topik yang bukan jenis pertemuan tetap punya ikon, dan supaya kamu bebas
      memilih ikon yang beda dari ikon jadwalnya. */
  icon: string;
  title: string;
  /** Baris kredit penyusun, mis. "~ Arahan utama oleh Ps. Ery…". */
  credit: string;
  /** Nomor versi apa adanya, mis. "V.1.0.3". Boleh kosong. */
  version: string;
  /** Tanggal pembaruan sebagai TEKS, mis. "Selasa, 26 Mei 2026". Sengaja
      bukan Timestamp: ini bagian dari kop dokumen yang kamu tulis sendiri. */
  updated: string;
  body: string;
};

/** Panduan kosong — bentuk awal dokumen baru. */
export function emptyCoreRule(kind: string): CoreRule {
  const meta = MEETING_KINDS.find((k) => k.key === kind);
  return {
    kind,
    icon: meta?.icon ?? '📜',
    title: meta?.label ?? '',
    credit: '',
    version: '',
    updated: '',
    body: '',
  };
}

/** Ikon + judul dokumen, mis. "🔥 Visitasi CORE". */
export function ruleFullTitle(rule: CoreRule): string {
  return `${rule.icon} ${rule.title}`.trim();
}

// ---------------------------------------------------------------- Firestore

function rulesCollection(uid: string) {
  return collection(db, 'users', uid, 'coreRules');
}

export function subscribeCoreRules(
  uid: string,
  onChange: (list: CoreRule[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // Tanpa orderBy: urutannya mengikuti MEETING_KINDS (lihat sortCoreRules),
  // supaya sama persis dengan urutan jenis acara di layar Pertemuan.
  return liveList<CoreRule>(rulesCollection(uid), onChange, onError, (d) => {
    const data = d.data();
    return {
      kind: d.id,
      // Dokumen lama belum punya `icon` → ambil dari jenis acaranya.
      icon:
        (data.icon as string) ??
        MEETING_KINDS.find((k) => k.key === d.id)?.icon ??
        '📜',
      title: (data.title as string) ?? '',
      credit: (data.credit as string) ?? '',
      version: (data.version as string) ?? '',
      updated: (data.updated as string) ?? '',
      body: (data.body as string) ?? '',
    };
  });
}

export function saveCoreRule(uid: string, rule: CoreRule) {
  const { kind, ...data } = rule;
  return setDoc(doc(db, 'users', uid, 'coreRules', kind), data);
}

/** Hapus PERMANEN satu dokumen panduan dari Firestore. */
export function deleteCoreRule(uid: string, kind: string) {
  return deleteDoc(doc(db, 'users', uid, 'coreRules', kind));
}

/**
 * Tulis dokumen bawaan yang BELUM ada di Firestore.
 *
 * Dipanggil sekali saat layar Rules dibuka. Hanya menulis yang benar-benar
 * belum ada, jadi hasil suntinganmu TIDAK PERNAH tertimpa — dan kalau kamu
 * sengaja menghapus satu dokumen bawaan, ia akan kembali saat layar dibuka
 * lagi (itu memang gunanya "bawaan").
 *
 * Mengembalikan jumlah dokumen yang ditulis (0 = tidak ada tulisan sama
 * sekali, jadi tidak ada biaya Firestore yang terbuang).
 */
export function seedCoreRules(uid: string, existing: CoreRule[]) {
  const ada = new Set(existing.map((r) => r.kind));
  const kurang = CORE_RULE_SEEDS.filter((r) => !ada.has(r.kind));
  if (kurang.length === 0) return Promise.resolve(0);
  const batch = writeBatch(db);
  for (const { kind, ...data } of kurang) {
    batch.set(doc(db, 'users', uid, 'coreRules', kind), data);
  }
  return batch.commit().then(() => kurang.length);
}

/** Urutkan panduan mengikuti urutan dokumen bawaan; sisanya jatuh ke bawah. */
export function sortCoreRules(list: CoreRule[]): CoreRule[] {
  const urutan = CORE_RULE_SEEDS.map((r) => r.kind);
  const rank = (k: string) => {
    const i = urutan.indexOf(k);
    return i < 0 ? 99 : i;
  };
  return [...list].sort(
    (a, b) => rank(a.kind) - rank(b.kind) || a.title.localeCompare(b.title),
  );
}

// ------------------------------------------------------- Pembaca isi dokumen

export type RuleLineKind =
  | 'sep' // garis pemisah
  | 'head' // judul bagian
  | 'warn' // blok ⚠️ Penting
  | 'bullet' // poin daftar
  | 'num' // poin bernomor
  | 'text' // paragraf biasa
  | 'blank'; // jeda

export type RuleLine = {
  type: RuleLineKind;
  text: string;
  /** Nomor asli dari dokumen untuk baris 'num' — dipertahankan apa adanya
      supaya penomoran tiap bagian tidak dihitung ulang & jadi meleset. */
  marker?: string;
  /** Isi blok ⚠️ Penting: baris-baris di bawahnya sampai baris kosong. */
  children?: RuleLine[];
};

const SEP_CHARS = /^[━➖─=\-_]{3,}$/;
const BULLET = /^[*\-•]\s+/;
const NUMBERED = /^(\d+)\.\s+/;

/**
 * Ubah isi dokumen jadi baris-baris bertipe, supaya LAYAR dan PDF menampilkan
 * struktur yang sama persis dari satu penafsiran — bukan dua aturan berbeda.
 *
 * Teksnya kamu tulis bebas (hasil salin dari WhatsApp), jadi strukturnya
 * ditebak dari bentuk barisnya. Kalau tebakannya meleset, baris itu jatuh jadi
 * paragraf biasa — tetap terbaca, tidak pernah hilang.
 */
export function parseRuleBody(body: string): RuleLine[] {
  const raw = body.split('\n');
  // Judul bagian bergaya biasa ("Fundraising", "CORE Bersama") cuma dikenali
  // kalau didahului baris kosong — tanpa syarat itu, kalimat pendek di tengah
  // paragraf ikut terangkat jadi judul dan blok ⚠️ jadi terpotong.
  const flat = raw.map((line, i) =>
    classifyLine(line, i === 0 || raw[i - 1].trim() === ''),
  );
  const out: RuleLine[] = [];
  for (let i = 0; i < flat.length; i++) {
    const line = flat[i];
    if (line.type !== 'warn') {
      out.push(line);
      continue;
    }
    // Di dokumen aslinya "⚠️Penting:" diikuti poin-poin miliknya lalu baris
    // kosong. Poin itu ditarik MASUK ke dalam blok — kalau tidak, kotak
    // peringatannya cuma berisi label dan isinya tercecer di luar.
    const children: RuleLine[] = [];
    while (
      i + 1 < flat.length &&
      !['blank', 'sep', 'head', 'warn'].includes(flat[i + 1].type)
    ) {
      children.push(flat[++i]);
    }
    out.push(children.length > 0 ? { ...line, children } : line);
  }
  return out;
}

/**
 * Tebak jenis satu baris dari bentuknya.
 * `prevBlank` = baris sebelumnya kosong (atau ini baris pertama).
 */
function classifyLine(raw: string, prevBlank: boolean): RuleLine {
  const line = raw.trim();
  if (!line) return { type: 'blank', text: '' };
  if (SEP_CHARS.test(line)) return { type: 'sep', text: '' };
  if (line.startsWith('⚠️')) {
    return { type: 'warn', text: line.replace(/^⚠️\s*/, '') };
  }
  // "#Thrifting" — penanda judul gaya tagar yang dipakai di dokumen Fundraising.
  if (line.startsWith('#')) {
    return { type: 'head', text: line.replace(/^#+\s*/, '') };
  }
  if (BULLET.test(line)) {
    return { type: 'bullet', text: line.replace(BULLET, '') };
  }
  const num = NUMBERED.exec(line);
  // "1. Kemuliaan nama Tuhan Yesus" — tapi JANGAN tangkap "1.5jt" dsb.
  if (num && line.length > num[0].length) {
    return { type: 'num', text: line.slice(num[0].length), marker: num[1] };
  }
  const mulaiEmoji = !/^[\x20-\x7E]/.test(line);
  const kalimat = /[.?!]$/.test(line);
  if (
    // Diawali emoji & pendek & bukan kalimat: "🤝 1. PENYAMBUTAN"
    (mulaiEmoji && line.length <= 60 && !kalimat) ||
    // Baris pengantar yang diakhiri titik dua: "Waktu [Ontime]:"
    (line.endsWith(':') && line.length <= 50) ||
    // Judul biasa yang berdiri sendiri sesudah baris kosong: "Fundraising"
    (prevBlank && !kalimat && line.length <= 40)
  ) {
    return { type: 'head', text: line };
  }
  return { type: 'text', text: line };
}

// ------------------------------------------------------------ Dokumen bawaan

const VISITASI_BODY = `Waktu [Ontime]:
⏱️ Mulai: 19.30
🛑 Selesai: 21.30

━━━━━━━━━━━━━━━━━━
🤝 1. PENYAMBUTAN
* Sambut Ps. Ery & Ci Maria dengan salam hangat (CL, MT & CM).
* CL membuka CORE & menyapa semua member.
* Apresiasi yang ontime.
* Welcoming MCL / Ps. Ery dengan jelas & antusias.

⚠️Penting:
* Bangun suasana hangat & penuh kerinduan untuk bertumbuh.
* Tidak perlu ada jiwa baru saat visitation, boleh atur waktu ke minggu depannya, karena menyambut mereka juga penting, agar merasa disambut juga oleh CORE.

👥 2. TIM PELAYAN
* Berikan apresiasi untuk semua yang melayani.
* Perkenalkan tim pelayan: WL, Pemusik, Sharing CDG.
* Tidak perlu games / ice breaking.

🎶 3. PUJIAN & PENYEMBAHAN
* Persilahkan WL untuk memulai dengan doa buka.
* Durasi penyembahan lebih panjang.

⚠️Penting:
* Pastikan nada & alur lagu sinkron.
* Pelayan sudah latihan dan menguasai lagu yang dimainkan, dan cocok dengan nada cowok dan cewek
* WL beri kode jelas, pemusik fokus ke WL.

💬 4. SHARING LIFE UPDATE
Fokus: apa yang disyukuri / kesaksian minggu ini.
Tujuan: Pastor tahu kondisi & kesibukan member.

⚠️Penting:
* Setiap member sharing singkat (2-3 orang, kalau masih ada waktu boleh lebih).
* Jika perlu, MT sudah dipersiapkan bahan sharing Life Update, yang bisa menginspirasi dan kesaksian hidup
* CL dapat menggali/memancing CM lebih dalam, jika CL mengetahui ada hal penting yang CM nya dapat sharingkan (biasanya anggota tidak terpikirkan atau gugup, jadi perlu dipancing oleh CL/MT)

📖 5. SHARING MATERI CDG

⏱️ Durasi ±20 menit (karena ada sharing lanjutan).

Disampaikan oleh Sharing Firman dengan:
* Persiapan matang (baca berulang).
* Sebaiknya yang Sharing adalah CL
* Gunakan ilustrasi / cerita / kesaksian.
* Interaktif (tidak hanya membaca).
* Libatkan pendengar utk baca ayat / tanya jawab ringan.

⚠️Penting: Tidak makan saat CDG berlangsung

🧠 6. DISCUSSION
* Berikan 1 pertanyaan diskusi.
* Dijawab oleh 1–2 orang saja (singkat saja & fokus)

CL mengakhiri sharing dengan:
* Ucapkan terima kasih.
* Rangkum Firman 2-3 kalimat saja (pendek, bukan mini khotbah).
* Sampaikan pokok doa (jika ada).

⚠️Penting: Jam 20.45 sudah serahkan ke MCL

🙏 7. PENUTUPAN
* MCL sharing 1-2 poin saja, kemudian serahkan ke Ps. Ery
* Ps. Ery sharing, kemudian memimpin penyembahan & doa.
* Pemusik siap mengiringi.
* Pengumuman, absen, foto & pulang

⚠️Penting: Target jam 21.30 sudah harus selesai

━━━━━━━━━━━━━━━━━━
📝 CATATAN TAMBAHAN

✨ Peran MCL, CL & MT
* Sebelum CORE, buat pemetaan pokok doa setiap anggota.
* Saat CORE bawa suasana: hangat, cair, & menyenangkan.
* Fokus pada CORE, jangan main HP.

🎧 Worship Team
* Latihan sebelumnya, jangan datang terlambat (wajib).
* Pastikan nada cocok dengan WL.
* Pemusik sering lihat WL (stay connected).
* Lebih baik pelayan yang sudah berpengalaman, bukan yang baru

🍱 Konsumsi
* Siapkan dari awal (makanan, minuman, gelas, tisu, plastik sampah).
* Bawa wadah untuk dibungkus, karena biasanya jika potluck pasti ada sisa, dan bisa dibagi rata kepada anggota
* Utamakan satpam & OB terlebih dahulu.

⚠️Penting:
* Tidak makan saat CDG berlangsung
* Makan hanya sebelum / sesudah CORE

👮🏻‍♂️ Satpam & OB
* Menyapa satpam dan OB saat datang dan pulang CORE
* Berterima kasih dan memberkati mereka, bilang Gbu.

🔥 Tujuan CORE
* Suasana hangat & terbuka
* Member merasa diperhatikan
* Firman tersampaikan dengan jelas
* Pelayanan rapi & mengalir

⚠️Penting:
Fokus pada 3 pilar CORE
1. Praise & Worship
2. Sharing Firman
3. Doa Bersama`;

const CHARITY_BODY = `➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖

🔴 RULES
Ini bukan pilihan — ini fondasi. Kalau ini dilanggar, acaranya bisa kehilangan arah sepenuhnya.

🎯 Prioritas Utama Charity
Sebelum CL memilih Ketua Charity kemudian ngurusin acara, konsumsi, transportasi — pahami dulu kenapa kalian ngadain ini. Urutan prioritasnya:

1. Kemuliaan nama Tuhan Yesus
Bukan nama NDC, CORE, CL, ataupun nama panitia. Semua yang kalian lakukan harus bisa dipertanggungjawabkan ke Tuhan dulu. Apakah ini memuliakan Dia?

2. Pertumbuhan CORE Member
Target yang terutama bukan tempat yang dikunjungi — tapi kalian sendiri. Pengalaman berbagi, melayani, empati dan keluar dari zona nyaman itu yang bikin kita bertumbuh. Isi acara Firman perlu banyak kontribusi CORE Member.

3. Pertumbuhan & Kesatuan Panitia
Panitia bukan sekadar "yang repot." Kalian lagi belajar bikin event rohani yang berkesan. INGAT: lebih baik acaranya sederhana tapi panitia kompak dan bahagia, daripada acaranya mewah tapi di balik layar penuh drama dan konflik.

4. Berkat untuk Tempat yang Dikunjungi
Mereka menerima banyak kunjungan dari berbagai lembaga dan gereja. Tapi kehadiran kalian tetap harus meninggalkan kesan yang baik — bukan sekadar datang, berbagi, foto, konten, pulang.

⚠️ Penting banget dipahami:
- Charity ≠ Penginjilan. Charity adalah berbagi kasih dan sukacita. Momen ini tidak bisa dijadikan sebagai sesi penginjilan atau pengajaran berat pada orang-orang di tempat tujuan.
- CORE adalah tempat pemuridan, bukan lembaga sosial atau kebersihan. Skala event harus realistis dan sesuai kapasitas dan kapabilitas CORE. Tidak perlu sampai anggaran yang berpuluh juta, atau mengunjungi tempat yang beresiko, seperti panti rehabilitasi, penjara, panti transgender, atau rumah sakit jiwa. Atau membuat project besar seperti membersihkan danau, penanaman pohon, pemasangan panel surya.

➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖

📢 Aturan Publikasi
Sebelum posting apapun ke medsos atau grup, pastikan kedua poin ini sudah dipenuhi:

❌ Jangan mencantumkan nomor rekening di poster atau caption manapun.
❓Kenapa? Karena ini bukan kampanye donasi publik. Begitu ada rekening di poster, orang akan melihat ini sebagai penggalangan dana — dan itu bukan tujuannya.
👟Solusi: Cantumkan Contact Person jika ada yang ingin bertanya lebih lanjut mengenai Charity.

❌ Jangan membuat kesan seolah sedang meminta-minta.
❓Kenapa? Karena tujuan utama dari publikasi Charity adalah menaikkan semangat dan antusias CORE Member mengikuti acara ini, juga menginformasikan bahwa Charity menerima sumbangan.
👟Solusi: Buat caption "Kami menerima sumbangan seperti: Sembako, Uang Tunai…"

✅ Setelah kedua poin di atas dipenuhi, bisa dishare-share ke:
- Media sosial pribadi
- Grup WA CL–MT
- Grup WA MCL–CL
- Grup WA Pastor–MCL

➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖

💵 Aturan Keuangan
Uang itu sensitif. Bukan berarti harus ditakuti, tapi harus dikelola dengan transparan, jujur, dan jelas. Seluruh kegiatan CORE jika ada uang yang masuk ke event ini (dari dalam maupun luar CORE):

✅ Buat Laporan Keuangan yang mencakup garis besar pemasukan dan pengeluaran — diselesaikan segera setelah acara berakhir (maks. 3 hari).
✅ Laporan harus diketahui dan disetujui oleh: Ketua Acara, CL, dan MCL.
ℹ️ Laporan ini tidak perlu diserahkan ke Pastor — cukup sampai ke MCL.

❓Kenapa? Supaya tidak ada ruang untuk salah sangka, konflik, atau rasa tidak percaya di antara kalian. Transparansi adalah bentuk kasih juga.

➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖

🟡 SUGGESTIONS
Ini bukan perintah, bukan kebenaran mutlak — tapi bimbingan dari pengalaman dan sudut pandang yang lebih luas. Kalian bebas mempertimbangkan dan mendiskusikannya.

🎁 Soal Jumlah Sumbangan
Disarankan total akumulasi sumbangan CORE (dalam bentuk sembako, konsumsi, uang tunai atau transfer) ke tempat Charity tidak melebihi angka level tempat kunjungan, dan selalu gunakan angka yang bulat.

❓Kenapa? Karena tujuan Charity bukan membuktikan seberapa banyak uang yang bisa kalian kumpulkan. Kalau terlalu besar, fokus bisa bergeser ke "prestasi donasi" atau "prestasi fundraising" — padahal yang paling penting adalah kehadiran dan kasih yang kalian bawa.

🏡 Level Tempat Kunjungan
- 🟢 Kecil — 15–30 jiwa — Rp1.5-3jt (Cukup sembako + snack + cash kecil)
- 🟡 Sedang — 31–60 jiwa — Rp3-5jt (Sembako + konsumsi makan siang + cash)
- 🟠 Besar — 61–100 jiwa — Rp5-8jt (Koordinasi lebih matang, bagi tugas jelas, rekom untuk CORE yang sudah dewasa)
- 🔴 Sangat Besar — 100+ jiwa — Rp8-12jt (⚠️Pertimbangkan ulang — ini terlalu besar untuk satu CORE)

✅ Rekomendasi:
Paling ideal adalah level Sedang (🟡) — panti 31–60, sumbangan Rp 3–5jt terasa bermakna buat mereka dan tidak membebani CORE. Dan skalanya juga pas, interaksi lebih personal — CM bisa ngobrol, main, dan punya momen nyata dengan anak-anak di sana.

Level Sangat Besar (🔴) tidak disarankan — bukan karena salah, tapi karena CORE bisa "tenggelam" di sana dan kehilangan momen pertumbuhan personalnya. Kalau mau adakan Charity Gabungan.

➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖

💸 Soal Sisa Dana
Kalau ada sisa dana setelah acara selesai dan laporan keuangan sudah beres — pertimbangkan untuk memberikannya sebagai persembahan ke NDC Ministry, baik itu ke dana pembangunan (building fund) atau ke diakonia.

NDC sudah sangat banyak membantu dan memfasilitasi CORE kalian — dari tempat hingga dukungan pastoral. Ini salah satu cara kita ikut ambil bagian dalam visi gereja secara nyata.

➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖

📋 Soal Konsep Acara
- Buat sesi yang interaktif dan melibatkan CM secara aktif — bukan cuma nonton atau duduk. Bikin mereka ngerasa jadi bagian dari cerita, bukan penonton.
- Charity yang paling berkesan bukan yang paling banyak sumbangnya, tapi yang paling autentik. Satu momen tulus lebih berbekas dari satu jam program yang kaku.
- Adakan refleksi singkat setelah acara — bisa di perjalanan pulang atau di CORE minggu berikutnya. Apa yang kalian rasakan? Apa yang Tuhan ajarkan hari itu? Ini yang bikin Charity jadi pengalaman rohani, bukan sekadar program wajib atau tahunan.

➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖

🤝 Soal Panitia & Peserta
- Briefing panitia bukan cuma soal teknis — tapi juga soal hati. Pastikan semua orang tahu kenapa mereka ada di sana.
- Lebih baik peserta hanya seluruh CORE Member saja, tidak perlu mengajak atau mengundang non member, kecuali dia adalah calon CORE Member.
- Kalau ada konflik internal di panitia, selesaikan sebelum hari-H. Jangan bawa luka ke lapangan.

Disarankan jumlah Peserta CORE dan Peserta dari tempat tujuan, yaitu 1 banding 3 (1:3).
- cth. 15 orang dari CORE, 45 dari tempat tujuan`;

/**
 * Dokumen bawaan yang ditulis ke Firestore saat pertama kali layar Rules
 * dibuka. Setelah masuk Firestore, yang berlaku adalah versi di sana — daftar
 * ini cuma benih awal, bukan sumber kebenaran.
 */
// Empat dokumen di bawah ini masih DRAF — sebagian isinya sengaja dibiarkan
// apa adanya ("aaa", kalimat yang terputus) karena itu memang yang ada di
// sumbernya. Melengkapinya sendiri berarti mengarang arahan gembala, jadi
// tidak dilakukan; tinggal disunting dari layar Rules kalau sudah final.

/** Baris kredit yang sama persis dipakai empat dokumen sekaligus. */
const ARAHAN_PS_ERY =
  '~ Arahan utama oleh Ps. Ery Pratignjo, dengan penyusunan dan perapihan oleh MCL Imanuel Victory';

const THANKSGIVING_BODY = `Anniversary / Thanksgiving
- aaa

📝 Catatan Tambahan
- Jangan kasih nama Anniversary, kenapa? Karena banyak yang akan ricuh, CORE tidak perlu sampan di sebar2kan menjadi sebuah brand khusus dengan`;

const FUNDRAISING_BODY = `Fundraising
- Tidak mencantumkan nomor rekening untuk pengumpulan dana pada poster.
- Penggalangan dana hanya boleh dilakukan di lingkungan internal CORE setempat, grup-grup CORE.
- Tidak boleh mempublikasikan kegiatan penggalangan dana di media sosial, termasuk akun pribadi mengatasnamakan CORE.
- Dana yang dikumpulkan cukup berasal dari internal CORE. Semampu CORE saja.
- Jangan berusaha atau memaksa untuk menggalang dana besar (hingga puluhan juta).
- MASIH diperbolehkan untuk menjual barang dalam grup internal CORE dan MCL.

#Penggalangan Dana dari Luar CORE:
- Jika ada bantuan dari orang luar, itu harus terjadi melalui komunikasi informal, bukan sebagai upaya mencari dana secara terbuka.
- Menjaga agar CORE tidak melakukan penggalangan dana ke luar sangat penting, karena hal ini dapat menimbulkan potensi masalah, termasuk penyalahgunaan dana yang dapat berdampak pada gereja.

#Thrifting

Ide-ide cari dana

📝 Catatan Tambahan
- CORE bukan lembaga sosial, melainkan wadah PEMURIDAN di NDC.
- Kegiatan Charity dan Fundraising, diperbolehkan hanya jika dilakukan di dalam lingkungan internal CORE atau paling besar di grup MCL.`;

const GATHERING_BODY = `GCORE / Staycation / Retret
- aaa

📝 Catatan Tambahan
- Hati-hati jangan`;

const CORE_X_CORE_BODY = `CORE Bersama
- aaa

📝 Catatan Tambahan
- aaa

➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖

🤔 Bahan Pertimbangan

tujuan apa:
- ini dibuat cuma buat seru2an / bonding?
- member saling kenal antar core?
- bangun iman lewat kesaksian & worship?

jadi tujuannya bisa clear dulu, agar flow acaranya jg jelas

terus dari POV member juga bisa dipikirkan:
- mereka nanti liat siapa sebagai gembala mereka di moment itu?
- takutnya jadi bingung, karena biasanya mereka terbiasa dengan CL masing2

mmg secara keuntungan, core gabungan begini ada manfaatnya kurleb
- bisa bikin suasana fresh, ga monoton
- member bisa kenal orang baru, buka relasi
- bisa saling dikuatkan dan diperkaya lewat kesaksian member lain

namun ada konsekuensinya jg yg perlu dipikirkan
- kedalaman rohani bisa jadi lebih tipis (karena ga ada discuss & lebih event feel)
- member bisa jadi "penonton" aja, bukan ikut terlibat sharing
- arah gembalaannya jadi kurang jelas kalau ga di-define dari awal

jadi utk acara ini mau lebih ke event / experience, atau tetap core yang ada arah rohaninya, dan siapa yang "pegang" secara rohani di malam itu`;

export const CORE_RULE_SEEDS: CoreRule[] = [
  {
    kind: 'visitasi',
    icon: '🔥',
    title: 'Visitasi CORE',
    credit:
      '~ Arahan utama oleh Ps. Ery Pratignjo, dengan penyusunan dan perapihan oleh MCL Imanuel Victory',
    version: 'V.1.0.3',
    updated: 'Selasa, 26 Mei 2026',
    body: VISITASI_BODY,
  },
  {
    kind: 'charity',
    icon: '💌',
    title: 'Charity CORE',
    credit:
      '~ Arahan utama oleh Pastor CORE Ery Pratignjo, disusun dan dirapihkan oleh MCL Imanuel Victory',
    version: 'V.1.0.0',
    updated: 'Kamis, 7 Mei 2026',
    body: CHARITY_BODY,
  },
  {
    kind: 'thanksgiving',
    icon: '🎉',
    title: 'CORE Thanksgiving',
    credit: ARAHAN_PS_ERY,
    version: '',
    updated: 'Kamis, 23 Apr 2026',
    body: THANKSGIVING_BODY,
  },
  {
    // Bukan jenis pertemuan — ini topik kebijakan, jadi id-nya berdiri sendiri
    // dan TIDAK muncul sebagai pilihan saat menjadwalkan pertemuan.
    kind: 'fundraising',
    icon: '💸',
    title: 'CORE Fundraising',
    credit: ARAHAN_PS_ERY,
    version: '',
    updated: 'Kamis, 23 April 2026',
    body: FUNDRAISING_BODY,
  },
  {
    kind: 'gathering',
    icon: '🏡',
    title: 'Gathering CORE',
    credit: ARAHAN_PS_ERY,
    version: '',
    updated: 'Kamis, 23 Apr 2026',
    body: GATHERING_BODY,
  },
  {
    kind: 'coreGabungan',
    icon: '✨',
    title: 'CORE x CORE',
    credit: '~ Arahan utama oleh MCL Imanuel Victory',
    version: '',
    updated: 'Kamis, 23 Apr 2026',
    body: CORE_X_CORE_BODY,
  },
];
