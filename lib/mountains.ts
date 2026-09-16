import type { FunEntry } from './fun';

// Daftar gunung di Jawa 🏔️ yang lazim didaki (Jawa Barat, Jawa Tengah, Jawa
// Timur) — dipakai:
//   • pemilih "Gunung" di isian Summit (provinsi → nama gunung, ketinggian &
//     lokasinya terisi sendiri), dan
//   • halaman "Gunung di Jawa" (app/mountains.tsx): semua gunung + tanda ✓ dan
//     tanggal menaklukkannya, dibaca dari arsip Summit.
//
// STATIK di sini (bukan Firestore): daftarnya tidak berubah-ubah dan gratis.
// Ketinggian dalam mdpl mengikuti angka yang umum dipakai basecamp/BTNG;
// beda beberapa meter antar-sumber itu biasa.
//
// Gunung di luar daftar (luar Jawa, atau bukit yang tak tercantum) tetap bisa
// dicatat lewat pilihan "Lainnya": namanya diketik bebas seperti dulu.

export type MountainProvince = 'jabar' | 'jateng' | 'jatim';

export const MOUNTAIN_PROVINCES: { key: MountainProvince; label: string }[] = [
  { key: 'jabar', label: 'Jawa Barat' },
  { key: 'jateng', label: 'Jawa Tengah' },
  { key: 'jatim', label: 'Jawa Timur' },
];

export type Mountain = {
  /** Kunci tetap (disimpan di entri Summit sebagai `mountainId`). */
  id: string;
  /** Nama tanpa kata "Gunung", mis. "Semeru". */
  name: string;
  province: MountainProvince;
  /** Ketinggian puncak, mdpl. */
  elevation: number;
  /** Kabupaten/daerah & jalur pendakian yang umum. */
  note: string;
};

export const MOUNTAINS: Mountain[] = [
  // ---------- Jawa Barat ----------
  { id: 'ciremai', name: 'Ciremai', province: 'jabar', elevation: 3078, note: 'Kuningan/Majalengka · via Apuy, Palutungan, Linggarjati' },
  { id: 'pangrango', name: 'Pangrango', province: 'jabar', elevation: 3019, note: 'TN Gede Pangrango · via Cibodas' },
  { id: 'gede', name: 'Gede', province: 'jabar', elevation: 2958, note: 'TN Gede Pangrango · via Cibodas, Gunung Putri, Selabintana' },
  { id: 'cikuray', name: 'Cikuray', province: 'jabar', elevation: 2821, note: 'Garut · via Pemancar, Bayongbong' },
  { id: 'papandayan', name: 'Papandayan', province: 'jabar', elevation: 2665, note: 'Garut · via Cisurupan, ramah pemula' },
  { id: 'kendang', name: 'Kendang', province: 'jabar', elevation: 2608, note: 'Garut/Bandung · via Cibodas Kertasari' },
  { id: 'patuha', name: 'Patuha', province: 'jabar', elevation: 2434, note: 'Ciwidey · kawasan Kawah Putih' },
  { id: 'malabar', name: 'Malabar', province: 'jabar', elevation: 2343, note: 'Pangalengan' },
  { id: 'guntur', name: 'Guntur', province: 'jabar', elevation: 2249, note: 'Garut · via Citiis' },
  { id: 'puntang', name: 'Puntang', province: 'jabar', elevation: 2222, note: 'Bandung Selatan · via Cimaung' },
  { id: 'salak', name: 'Salak', province: 'jabar', elevation: 2211, note: 'Bogor/Sukabumi · via Cidahu, Pasir Reungit' },
  { id: 'bukit-tunggul', name: 'Bukit Tunggul', province: 'jabar', elevation: 2209, note: 'Bandung Utara' },
  { id: 'talaga-bodas', name: 'Talaga Bodas', province: 'jabar', elevation: 2201, note: 'Garut' },
  { id: 'artapela', name: 'Artapela', province: 'jabar', elevation: 2194, note: 'Pangalengan · via Sukapura' },
  { id: 'wayang', name: 'Wayang', province: 'jabar', elevation: 2181, note: 'Pangalengan' },
  { id: 'galunggung', name: 'Galunggung', province: 'jabar', elevation: 2167, note: 'Tasikmalaya · tangga ke kawah' },
  { id: 'tangkuban-parahu', name: 'Tangkuban Parahu', province: 'jabar', elevation: 2084, note: 'Subang/Bandung Barat' },
  { id: 'burangrang', name: 'Burangrang', province: 'jabar', elevation: 2050, note: 'Purwakarta/Bandung Barat · via Legok Haji' },
  { id: 'halimun', name: 'Halimun', province: 'jabar', elevation: 1929, note: 'TN Gunung Halimun Salak · via Cikaniki' },
  { id: 'rakutak', name: 'Rakutak', province: 'jabar', elevation: 1922, note: 'Bandung · via Sukapura, jalur naga' },
  { id: 'manglayang', name: 'Manglayang', province: 'jabar', elevation: 1818, note: 'Bandung Timur · via Batu Kuda' },
  { id: 'kencana', name: 'Kencana', province: 'jabar', elevation: 1803, note: 'Puncak, Bogor' },
  { id: 'sawal', name: 'Sawal', province: 'jabar', elevation: 1764, note: 'Ciamis' },
  { id: 'tampomas', name: 'Tampomas', province: 'jabar', elevation: 1684, note: 'Sumedang · via Narimbang' },
  { id: 'putri-lembang', name: 'Putri (Lembang)', province: 'jabar', elevation: 1587, note: 'Lembang · trek pendek' },
  { id: 'sanggabuana', name: 'Sanggabuana', province: 'jabar', elevation: 1291, note: 'Karawang' },
  { id: 'munara', name: 'Munara', province: 'jabar', elevation: 1119, note: 'Rumpin, Bogor · batu-batu besar' },
  { id: 'bongkok', name: 'Bongkok', province: 'jabar', elevation: 975, note: 'Purwakarta · tetangga Gunung Parang' },
  { id: 'parang', name: 'Parang', province: 'jabar', elevation: 963, note: 'Purwakarta · via ferrata' },
  { id: 'batu-jonggol', name: 'Batu (Jonggol)', province: 'jabar', elevation: 875, note: 'Bogor · pendakian singkat' },
  { id: 'lembu', name: 'Lembu', province: 'jabar', elevation: 792, note: 'Purwakarta · pemandangan Waduk Jatiluhur' },

  // ---------- Jawa Tengah ----------
  { id: 'slamet', name: 'Slamet', province: 'jateng', elevation: 3428, note: 'Purbalingga/Banyumas · via Bambangan, Guci' },
  { id: 'sumbing', name: 'Sumbing', province: 'jateng', elevation: 3371, note: 'Wonosobo/Temanggung · via Garung, Butuh' },
  { id: 'lawu', name: 'Lawu', province: 'jateng', elevation: 3265, note: 'Karanganyar, batas Jatim · via Cemoro Kandang, Cemoro Sewu' },
  { id: 'sindoro', name: 'Sindoro', province: 'jateng', elevation: 3153, note: 'Temanggung/Wonosobo · via Kledung' },
  { id: 'merbabu', name: 'Merbabu', province: 'jateng', elevation: 3145, note: 'Boyolali/Magelang · via Selo, Suwanting, Wekas' },
  { id: 'merapi', name: 'Merapi', province: 'jateng', elevation: 2930, note: 'Boyolali, batas DIY · via Selo (sampai Pasar Bubrah)' },
  { id: 'prau', name: 'Prau', province: 'jateng', elevation: 2590, note: 'Dieng · via Patak Banteng, Dieng, Wates' },
  { id: 'pakuwaja', name: 'Pakuwaja', province: 'jateng', elevation: 2395, note: 'Dieng, Wonosobo' },
  { id: 'bismo', name: 'Bismo', province: 'jateng', elevation: 2365, note: 'Dieng, Wonosobo · via Sikunang' },
  { id: 'kembang', name: 'Kembang', province: 'jateng', elevation: 2320, note: 'Wonosobo · via Blembem' },
  { id: 'sikunir', name: 'Sikunir', province: 'jateng', elevation: 2263, note: 'Dieng · golden sunrise, trek pendek' },
  { id: 'rogojembangan', name: 'Rogojembangan', province: 'jateng', elevation: 2177, note: 'Pekalongan/Banjarnegara' },
  { id: 'ungaran', name: 'Ungaran', province: 'jateng', elevation: 2050, note: 'Semarang · via Mawar, Promasan' },
  { id: 'telomoyo', name: 'Telomoyo', province: 'jateng', elevation: 1894, note: 'Magelang/Semarang · bisa naik motor' },
  { id: 'andong', name: 'Andong', province: 'jateng', elevation: 1726, note: 'Magelang · via Sawit, ramah pemula' },
  { id: 'muria', name: 'Muria', province: 'jateng', elevation: 1602, note: 'Kudus/Jepara/Pati' },

  // ---------- Jawa Timur ----------
  { id: 'semeru', name: 'Semeru', province: 'jatim', elevation: 3676, note: 'Lumajang/Malang · via Ranu Pani, atap Pulau Jawa' },
  { id: 'raung', name: 'Raung', province: 'jatim', elevation: 3344, note: 'Banyuwangi/Bondowoso · via Kalibaru, jalur ekstrem' },
  { id: 'arjuno', name: 'Arjuno', province: 'jatim', elevation: 3339, note: 'Malang/Pasuruan · via Tretes, Lawang, Purwosari' },
  { id: 'welirang', name: 'Welirang', province: 'jatim', elevation: 3156, note: 'Mojokerto/Pasuruan · via Tretes' },
  { id: 'argopuro', name: 'Argopuro', province: 'jatim', elevation: 3088, note: 'Probolinggo/Jember · via Baderan, Bremi, trek terpanjang di Jawa' },
  { id: 'butak', name: 'Butak', province: 'jatim', elevation: 2868, note: 'Malang/Blitar · via Panderman, Sirah Kencong' },
  { id: 'kawi', name: 'Kawi', province: 'jatim', elevation: 2651, note: 'Malang' },
  { id: 'ranti', name: 'Ranti', province: 'jatim', elevation: 2601, note: 'Banyuwangi · tetangga Ijen' },
  { id: 'wilis', name: 'Wilis', province: 'jatim', elevation: 2563, note: 'Kediri/Madiun/Nganjuk' },
  { id: 'batok', name: 'Batok', province: 'jatim', elevation: 2470, note: 'Probolinggo · kawasan Bromo' },
  { id: 'ijen', name: 'Ijen', province: 'jatim', elevation: 2443, note: 'Banyuwangi/Bondowoso · via Paltuding, blue fire' },
  { id: 'bromo', name: 'Bromo', province: 'jatim', elevation: 2329, note: 'Probolinggo · via Cemoro Lawang' },
  { id: 'anjasmoro', name: 'Anjasmoro', province: 'jatim', elevation: 2277, note: 'Mojokerto/Jombang' },
  { id: 'panderman', name: 'Panderman', province: 'jatim', elevation: 2045, note: 'Batu · via Toyomerto, ramah pemula' },
  { id: 'kelud', name: 'Kelud', province: 'jatim', elevation: 1731, note: 'Kediri/Blitar' },
  { id: 'penanggungan', name: 'Penanggungan', province: 'jatim', elevation: 1653, note: 'Mojokerto/Pasuruan · via Tamiajeng, situs purbakala' },
  { id: 'lemongan', name: 'Lemongan', province: 'jatim', elevation: 1651, note: 'Lumajang/Probolinggo' },
  { id: 'pundak', name: 'Pundak', province: 'jatim', elevation: 1585, note: 'Mojokerto · via Tahura, ramah pemula' },
  { id: 'baluran', name: 'Baluran', province: 'jatim', elevation: 1247, note: 'Situbondo · TN Baluran' },
];

/** Label provinsi untuk manusia. */
export function provinceLabel(key: MountainProvince): string {
  return MOUNTAIN_PROVINCES.find((p) => p.key === key)?.label ?? key;
}

/** Gunung satu provinsi, yang tertinggi di atas. */
export function mountainsOf(province: MountainProvince): Mountain[] {
  return MOUNTAINS.filter((m) => m.province === province).sort(
    (a, b) => b.elevation - a.elevation,
  );
}

export function mountainOf(id: string | null | undefined): Mountain | null {
  return id ? (MOUNTAINS.find((m) => m.id === id) ?? null) : null;
}

/** "3.145 mdpl" — ribuan bertitik gaya Indonesia. */
export function elevationLabel(mdpl: number): string {
  return `${String(mdpl).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} mdpl`;
}

/** Nama untuk disimpan di entri Summit: "Gunung Merbabu". */
export function mountainTitle(m: Mountain): string {
  return `Gunung ${m.name}`;
}

/**
 * Nama gunung yang diketik → bentuk banding: huruf kecil, tanpa "Gunung"/"Gn."/
 * "Mt.", tanpa isi kurung ("(Ranu Kumbolo)"), tanpa tanda baca.
 * "Gunung Semeru (Ranu Kumbolo)" → "semeru".
 */
export function normalizeMountainName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(gunung|gn\.?|mt\.?|mount)\b/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cocokkan entri Summit LAMA (yang namanya diketik bebas, belum punya
 * `mountainId`) dengan daftar: nama bandingnya sama persis, atau nama
 * gunungnya berdiri sebagai kata di dalamnya ("merbabu via selo" → Merbabu).
 * null kalau tak ada yang cocok.
 */
export function matchMountain(title: string): Mountain | null {
  const t = normalizeMountainName(title);
  if (!t) return null;
  const persis = MOUNTAINS.find((m) => normalizeMountainName(m.name) === t);
  if (persis) return persis;
  const kata = t.split(' ');
  return (
    MOUNTAINS.find((m) => {
      const n = normalizeMountainName(m.name);
      return !n.includes(' ') && kata.includes(n);
    }) ?? null
  );
}

/** Gunung milik satu entri Summit: dari `mountainId`, atau ditebak dari namanya. */
export function mountainOfEntry(e: Pick<FunEntry, 'mountainId' | 'title'>): Mountain | null {
  return mountainOf(e.mountainId) ?? matchMountain(e.title);
}

/**
 * Gunung yang SUDAH ditaklukkan → tanggal pertama kali (yang paling awal),
 * dibaca dari arsip Summit. Entri tanpa tanggal tetap dihitung taklukan
 * (tanggalnya null).
 */
export function conqueredMountains(
  entries: FunEntry[],
): Map<string, { date: Date | null; entryId: string }> {
  const peta = new Map<string, { date: Date | null; entryId: string }>();
  for (const e of entries) {
    if (e.category !== 'summit') continue;
    const m = mountainOfEntry(e);
    if (!m) continue;
    const d = e.date ? e.date.toDate() : null;
    const ada = peta.get(m.id);
    if (!ada || (d && (!ada.date || d.getTime() < ada.date.getTime()))) {
      peta.set(m.id, { date: d, entryId: e.id });
    }
  }
  return peta;
}
