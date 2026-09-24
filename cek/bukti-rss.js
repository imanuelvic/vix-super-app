// Bukti bahwa alamat RSS-nya BENAR-BENAR mengembalikan berita — bukan cuma
// lolos regex di kode. Menjalankan permintaan yang sama persis dengan yang
// dipakai app (lib/world.ts & lib/prayerNews.ts).
const feed = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(
    `${q} when:7d`,
  )}&hl=id&gl=ID&ceid=ID:id`;

const URLS = {
  'News → Indonesia':
    'https://news.google.com/rss/headlines/section/topic/NATION?hl=id&gl=ID&ceid=ID:id',
  'Doa syafaat → Gereja ⛪': feed(
    'Indonesia (gereja OR "umat kristen" OR "kerukunan umat beragama" OR "rumah ibadah" OR misionaris)',
  ),
  'Doa syafaat → Negara 🇮🇩': feed(
    'Indonesia (presiden OR pemerintah OR ekonomi OR bencana OR "harga pangan" OR korupsi)',
  ),
};

function judul(xml) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocks.map((b) => {
    const m = b.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    const raw = (m ? m[1] : '')
      .replace(/^<!\[CDATA\[/, '')
      .replace(/\]\]>$/, '')
      .replace(/&amp;/g, '&')
      .trim();
    const cut = raw.lastIndexOf(' - ');
    return cut > 20 && cut > raw.length - 40 ? raw.slice(0, cut) : raw;
  });
}

let gagal = 0;
(async () => {
  for (const [nama, url] of Object.entries(URLS)) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/rss+xml' },
      });
      const titles = judul(await res.text());
      if (!res.ok || titles.length === 0) {
        gagal++;
        console.log(`  ❌ ${nama} — HTTP ${res.status}, ${titles.length} berita`);
        continue;
      }
      console.log(`  ✅ ${nama} — ${titles.length} berita`);
      titles.slice(0, 4).forEach((t) => console.log(`       • ${t}`));
    } catch (e) {
      gagal++;
      console.log(`  ❌ ${nama} — ${e.message}`);
    }
  }
  console.log(
    gagal === 0 ? '\n✅ LULUS — ketiga feed hidup.' : `\n❌ ${gagal} feed bermasalah.`,
  );
  process.exit(gagal === 0 ? 0 : 1);
})();
