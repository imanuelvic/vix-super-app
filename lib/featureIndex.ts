import type { TodayHref } from './today';

// 🔎 Indeks pencarian fitur — pintu darurat dari penyederhanaan Today:
// "aku butuh sesuatu yang spesifik". Statis di kode, nol bacaan Firestore.
//
// Tiap entri = satu TUJUAN (layar + sub-tab), bukan satu fitur: "STNK" harus
// mendarat di Car › Info, bukan di Car lalu dicari lagi. Kata kuncinya bebas
// (Indonesia & Inggris, singkatan yang biasa kamu ketik). Menambah layar baru
// = tambah satu entri di sini.

export type FeatureEntry = {
  /** Nama yang tampil di hasil. */
  label: string;
  /** Jalur "Fitur › Sub-tab" — keterangan kecil di bawah nama. */
  path: string;
  emoji: string;
  keywords: string[];
  href: TodayHref;
};

const e = (
  emoji: string,
  label: string,
  path: string,
  href: TodayHref,
  ...keywords: string[]
): FeatureEntry => ({ emoji, label, path, href, keywords });

export const FEATURE_INDEX: FeatureEntry[] = [
  // ✝️ Walk
  e('🌅', 'Morning Journey', 'Walk', { pathname: '/morning-journey' }, 'doa pagi', 'journey', 'pagi', 'saat teduh'),
  e('📖', 'Revive', 'Walk › Revive', { pathname: '/walk', params: { tab: 'revive' } }, 'renungan', 'rhema', 'revive', 'harian'),
  e('🗂️', 'Riwayat Revive', 'Walk › Revive', { pathname: '/revive-history' }, 'riwayat', 'arsip', 'cari revive'),
  e('⛪', 'Catatan Khotbah', 'Walk › Sermon', { pathname: '/walk', params: { tab: 'sermon' } }, 'sermon', 'khotbah', 'minggu', 'ibadah'),
  e('📚', 'Bible Reading', 'Walk › Bible Reading', { pathname: '/walk', params: { tab: 'bible' } }, 'alkitab', 'bible', 'bacaan', 'baca', 'firman'),
  e('✍️', 'Catat bacaan Alkitab', 'Walk › Bible Reading', { pathname: '/bible-reading' }, 'catat bacaan', 'baca alkitab'),
  e('🚩', 'His Promise', 'Walk › Promise', { pathname: '/walk', params: { tab: 'promise' } }, 'janji', 'promise', 'janji tuhan'),
  e('🍽️', 'Puasa', 'Walk › Fasting', { pathname: '/walk', params: { tab: 'fasting' } }, 'puasa', 'fasting'),
  e('🙏', 'Riwayat Syukur', 'Walk', { pathname: '/gratitude' }, 'syukur', 'gratitude', 'bersyukur', '3 hal'),
  e('⏸️', 'Pause & Pray', 'Walk', { pathname: '/pause-pray' }, 'pause', 'pray', 'doa singkat', 'story'),
  e('🖼️', 'Reflection Feed', 'Walk', { pathname: '/reflection-feed' }, 'feed', 'instagram', 'refleksi', 'jurnal gambar'),
  e('🌤️', 'Riwayat Morning Journey', 'Walk', { pathname: '/journey-history' }, 'riwayat journey', 'pagi'),
  e('🕊️', 'Bagikan Reminder', 'Walk', { pathname: '/reminder-share' }, 'reminder', 'bagikan', 'kartu'),

  // 👥 CORE
  e('📅', 'Visitation', 'CORE › Visitation', { pathname: '/core', params: { tab: 'visitation' } }, 'visitasi', 'jadwal', 'pertemuan', 'fellowship', 'gathering', 'thanksgiving', 'christmas', 'charity'),
  e('🗒️', 'Monthly Mentoring', 'CORE › Monthly', { pathname: '/core', params: { tab: 'monthly' } }, 'notulen', 'rapat', 'bulanan', 'monthly', 'mentoring'),
  e('🎯', 'Follow Up', 'CORE › Follow Up', { pathname: '/core', params: { tab: 'followup' } }, 'follow up', 'ulang tahun cl', 'sapa', 'doa rantai'),
  e('👤', 'CORE Leader', 'CORE › Leaders', { pathname: '/core', params: { tab: 'leaders' } }, 'core leader', 'cl', 'leaders', 'main team', 'mt', 'nomor hp', 'data cl'),
  e('🌱', 'Multiplication', 'CORE › Multiplication', { pathname: '/core', params: { tab: 'multiplication' } }, 'multiplikasi', 'pemekaran', 'calon cl'),
  e('📆', 'Kalender CORE', 'CORE', { pathname: '/core-calendar' }, 'kalender', 'calendar'),
  e('📊', 'Rekap Visitasi', 'CORE', { pathname: '/core-recap' }, 'rekap', 'recap', 'tahunan'),
  e('📜', 'Rules & Suggestions', 'CORE', { pathname: '/core-rules' }, 'rules', 'panduan', 'aturan', 'pdf acara'),
  e('💬', 'Template Chat', 'CORE', { pathname: '/chat-templates' }, 'template', 'chat', 'ucapan', 'berduka', 'wisuda'),
  e('🙏', 'Pokok Doa Bulanan', 'CORE', { pathname: '/monthly-prayers' }, 'pokok doa', 'doa bulanan', 'pergumulan'),
  e('🗂️', 'Ex CORE Leader', 'CORE', { pathname: '/ex-leaders' }, 'ex', 'mantan', 'arsip cl'),
  e('📄', 'Pedoman CORE Leader', 'CORE', { pathname: '/leader-criteria' }, 'pedoman', 'kriteria', 'syarat cl', 'tugas cl'),
  e('🕘', 'Riwayat Visitasi', 'CORE', { pathname: '/visitations' }, 'riwayat visitasi', 'semua jadwal'),

  // 💼 Work
  e('🎯', 'Work Focus', 'Work › Focus', { pathname: '/work', params: { tab: 'focus' } }, 'fokus', 'focus', 'kerja hari ini', 'ship'),
  e('💻', 'Fulltime NDC', 'Work › Fulltime', { pathname: '/work', params: { tab: 'fulltime' } }, 'fulltime', 'roadmap', 'ndc', 'prioritas kerja', 'deadline'),
  e('🌐', 'Freelance', 'Work › Freelance', { pathname: '/work', params: { tab: 'freelance' } }, 'freelance', 'proyek', 'client', 'invoice', 'fee'),
  e('📣', 'Affiliate', 'Work › Affiliate', { pathname: '/work', params: { tab: 'affiliate' } }, 'affiliate', 'konten', 'ide konten', 'endorse', 'tiktok'),
  e('🍧', 'Business', 'Work › Business', { pathname: '/work', params: { tab: 'business' } }, 'bisnis', 'business', 'cendol', 'roa'),
  e('✅', 'Reminder harian', 'Work › Tasks', { pathname: '/tasks', params: { tab: 'daily' } }, 'task', 'tugas', 'reminder', 'to do', 'todo', 'daily'),
  e('📌', 'Prioritas P1 P2 P3', 'Work › Tasks', { pathname: '/tasks', params: { tab: 'priority' } }, 'prioritas', 'priority', 'p1', 'p2', 'p3', 'tenggat'),
  e('💡', 'Daily Priority', 'Today', { pathname: '/daily-priority' }, '3 hal', 'top 3', 'prioritas hari ini'),

  // 🌿 Life
  e('📋', 'Habits', 'Life › Habits', { pathname: '/habits' }, 'habits', 'kebiasaan', 'pagi siang malam', 'jurnal', 'refleksi', 'air', 'target berat'),
  e('💰', 'Finance Dashboard', 'Life › Finance', { pathname: '/finance', params: { tab: 'dashboard' } }, 'finance', 'keuangan', 'safe to spend', 'coach', 'uang'),
  e('🧾', 'Transaksi', 'Life › Finance › Transactions', { pathname: '/finance', params: { tab: 'transactions' } }, 'transaksi', 'catat pengeluaran', 'income', 'expense', 'pemasukan'),
  e('📊', 'Budgeting', 'Life › Finance › Budgeting', { pathname: '/finance', params: { tab: 'budgeting' } }, 'budget', 'anggaran', 'alokasi', 'lock budget', 'planning'),
  e('👛', 'Saku', 'Life › Finance', { pathname: '/saku' }, 'saku', 'dompet', 'pocket', 'dana', 'tabungan'),
  e('🤝', 'Pinjaman', 'Life › Finance', { pathname: '/debts' }, 'pinjaman', 'hutang', 'utang', 'cicilan', 'debt'),
  e('📆', 'Monthly Money Review', 'Life › Finance', { pathname: '/finance-review', params: { kind: 'month' } }, 'review', 'mingguan', 'bulanan', 'evaluasi keuangan'),
  e('👣', 'Steps', 'Life › Health › Steps', { pathname: '/health', params: { tab: 'steps' } }, 'langkah', 'steps', 'jalan', 'apple health'),
  e('🏃', 'Race', 'Life › Health › Race', { pathname: '/health', params: { tab: 'race' } }, 'race', 'lomba', 'lari', 'medali', 'marathon'),
  e('🩺', 'Check-up', 'Life › Health › Check-up', { pathname: '/health', params: { tab: 'checkup' } }, 'tensi', 'tekanan darah', 'gula darah', 'check up', 'periksa'),
  e('🤒', 'Riwayat Sakit', 'Life › Health', { pathname: '/diseases' }, 'sakit', 'penyakit', 'diseases'),
  e('🩸', 'Donor Darah', 'Life › Health', { pathname: '/donor' }, 'donor', 'darah', 'pmi'),
  e('ℹ️', 'Info Kesehatan', 'Life › Health', { pathname: '/health-info' }, 'info kesehatan', 'tips sehat'),
  e('💪', 'Fitness Exercise', 'Life › Fitness › Exercise', { pathname: '/fitness', params: { tab: 'exercise' } }, 'fitness', 'gym', 'olahraga', 'latihan', 'workout', 'lari'),
  e('📅', 'Program Latihan', 'Life › Fitness › Program', { pathname: '/fitness', params: { tab: 'program' } }, 'program', 'jadwal latihan'),
  e('📈', 'Progress Fitness', 'Life › Fitness › Progress', { pathname: '/fitness', params: { tab: 'progress' } }, 'progress', 'streak gym'),
  e('📝', 'Notes Fitness', 'Life › Fitness › Notes', { pathname: '/fitness', params: { tab: 'notes' } }, 'notes', 'video latihan'),
  e('👨‍👩‍👧', 'Family', 'Life › Family', { pathname: '/family' }, 'keluarga', 'family', 'silsilah', 'ulang tahun keluarga'),
  e('🎯', 'Learning minggu ini', 'Life › Learning › Target', { pathname: '/learning', params: { tab: 'week' } }, 'learning', 'belajar', 'topik minggu ini', 'skill'),
  e('🧠', 'Skills', 'Life › Learning › Skills', { pathname: '/learning', params: { tab: 'skills' } }, 'skills', 'topik', 'ilmu'),
  e('💬', 'Discussion', 'Life › Learning › Discussion', { pathname: '/learning', params: { tab: 'topics' } }, 'diskusi', 'obrolan', 'bahan percakapan'),
  e('📔', 'Arsip Rangkuman', 'Life › Learning', { pathname: '/learning-archive' }, 'rangkuman', 'arsip belajar'),
  e('🏅', 'Emas', 'Life › Invest › Gold', { pathname: '/investment', params: { tab: 'emas' } }, 'emas', 'gold', 'harga emas'),
  e('₿', 'Bitcoin', 'Life › Invest › Crypto', { pathname: '/investment', params: { tab: 'crypto' } }, 'bitcoin', 'btc', 'crypto', 'kripto'),
  e('📈', 'IHSG', 'Life › Invest › Stocks', { pathname: '/investment', params: { tab: 'saham' } }, 'saham', 'ihsg', 'stocks'),
  e('💵', 'Kurs USD', 'Life › Invest › Forex', { pathname: '/investment', params: { tab: 'forex' } }, 'kurs', 'dollar', 'usd', 'forex'),
  e('📰', 'Berita', 'Life › News', { pathname: '/news', params: { tab: 'news' } }, 'berita', 'news', 'rss'),
  e('🔖', 'Berita Tersimpan', 'Life › News', { pathname: '/news-saved' }, 'tersimpan', 'bookmark'),
  e('🌏', 'Populasi Dunia', 'Life › News › Population', { pathname: '/news', params: { tab: 'population' } }, 'populasi', 'population', 'worldometers'),
  e('📚', 'Book', 'Life › Book', { pathname: '/book' }, 'buku', 'book', 'baca buku', 'bab'),
  e('⛽', 'Log Mobil', 'Life › Car › Log', { pathname: '/car', params: { tab: 'log' } }, 'bensin', 'servis', 'parkir', 'mobil', 'mazda', 'car'),
  e('🔧', 'Parts & Perawatan Mobil', 'Life › Car › Parts', { pathname: '/car', params: { tab: 'parts' } }, 'sparepart', 'oli', 'ban', 'perawatan mobil', 'servis berkala'),
  e('🚗', 'Info Mobil & STNK', 'Life › Car › Info', { pathname: '/car', params: { tab: 'info' } }, 'stnk', 'pajak mobil', 'plat', 'info mobil'),
  e('🧾', 'Log Rumah', 'Life › Residence › Log', { pathname: '/residence', params: { tab: 'log' } }, 'pengeluaran rumah', 'iuran', 'wifi'),
  e('💧', 'Air & Listrik', 'Life › Residence › Utility', { pathname: '/residence', params: { tab: 'utility' } }, 'air', 'pam', 'listrik', 'utility'),
  e('⚡', 'Token Listrik', 'Life › Residence › Token', { pathname: '/residence', params: { tab: 'token' } }, 'token', 'kwh', 'meteran', 'pln'),
  e('🧹', 'Perawatan Rumah', 'Life › Residence › Maintenance', { pathname: '/residence', params: { tab: 'chores' } }, 'bersih-bersih', 'maintenance', 'chores'),
  e('🏠', 'Info Rumah & Kontrak', 'Life › Residence › Info', { pathname: '/residence', params: { tab: 'info' } }, 'kontrak', 'kontrakan', 'casa jardin', 'rumah'),
  e('🧾', 'Pembelian Token', 'Life › Residence', { pathname: '/token-purchases' }, 'beli token', 'riwayat token'),
  e('⛰️', 'Summit', 'Life › Fun › Summit', { pathname: '/fun', params: { tab: 'summit' } }, 'gunung', 'summit', 'mendaki', 'hiking'),
  e('🏔️', 'Gunung di Jawa', 'Life › Fun', { pathname: '/mountains' }, 'daftar gunung', 'jawa'),
  e('🎬', 'Creators', 'Life › Fun › Creators', { pathname: '/fun', params: { tab: 'creators' } }, 'youtube', 'creators', 'video'),
  e('🏝️', 'Recreation', 'Life › Fun › Recreation', { pathname: '/fun', params: { tab: 'recreation' } }, 'rekreasi', 'liburan', 'jalan-jalan', 'fun'),
  e('🎡', 'Wheel of Life', 'Life › Wheel', { pathname: '/wheel' }, 'wheel', 'roda', 'kuartal', 'assessment', '8 area'),
  e('📍', 'Timeline', 'Life › Timeline', { pathname: '/timeline' }, 'timeline', 'wishlist', 'target tahun', 'rencana'),
  e('📜', 'My History', 'Life › History', { pathname: '/history' }, 'history', 'sejarah', 'perjalanan hidup'),
  e('💸', 'Split Bill', 'Life › Friends › Split Bill', { pathname: '/friends', params: { tab: 'bills' } }, 'split bill', 'patungan', 'nota', 'bagi tagihan'),
  e('⚽', 'Fun Futsal', 'Life › Friends › Fun Futsal', { pathname: '/friends', params: { tab: 'futsal' } }, 'futsal', 'bola', 'lapangan', 'iuran'),
  e('💰', 'Kas Tim Futsal', 'Life › Friends', { pathname: '/futsal-cash' }, 'kas', 'kas tim'),
  e('🏅', 'Leaderboard Futsal', 'Life › Friends', { pathname: '/futsal-board' }, 'leaderboard', 'top score'),
  e('🍜', 'Places', 'Life › Friends › Places', { pathname: '/friends', params: { tab: 'places' } }, 'tempat', 'nongkrong', 'places', 'kafe', 'restoran'),
  e('📱', 'Paket Kuota', 'Life › Device › iPhone', { pathname: '/device', params: { tab: 'iphone' } }, 'kuota', 'paket data', 'pulsa', 'iphone', 'device'),
  e('🧾', 'Log Perangkat', 'Life › Device › Log', { pathname: '/device', params: { tab: 'log' } }, 'biaya hp', 'perangkat'),
  e('🏆', 'Tournament', 'Life › Games › Tournament', { pathname: '/games', params: { tab: 'tournament' } }, 'turnamen', 'bracket', 'badminton'),
  e('🐍', 'Snake', 'Life › Games', { pathname: '/games', params: { tab: 'snake' } }, 'snake', 'ular', 'game'),
  e('🧱', 'Tetris', 'Life › Games', { pathname: '/games', params: { tab: 'tetris' } }, 'tetris', 'game'),
  e('🏆', 'Achievement', 'Life › Achievement', { pathname: '/achievements' }, 'achievement', 'pencapaian', 'streak', 'lencana', 'badge'),
  e('🎁', 'Self-Reward', 'Life › Achievement', { pathname: '/achievements' }, 'reward', 'hadiah', 'self reward'),
  e('🗄️', 'Archive Self-Reward', 'Life › Achievement', { pathname: '/reward-archive' }, 'arsip hadiah', 'klaim'),
  e('🪪', 'Profil & Dokumen', 'Life › Profile', { pathname: '/profile', params: { tab: 'profile' } }, 'profil', 'profile', 'nik', 'ktp', 'npwp', 'kk', 'paspor', 'bpjs', 'dokumen'),
  e('🧍', 'Data Tubuh', 'Life › Profile › Body', { pathname: '/profile', params: { tab: 'body' } }, 'berat', 'tinggi', 'bmi', 'lingkar perut', 'data tubuh', 'timbang'),
  e('🧠', 'Personality', 'Life › Profile › Personality', { pathname: '/profile', params: { tab: 'personality' } }, 'mbti', 'disc', 'love language', 'enneagram', 'kepribadian'),
  e('🎌', 'Ikigai', 'Life › Profile › Ikigai', { pathname: '/profile', params: { tab: 'ikigai' } }, 'ikigai'),
  e('📊', 'SWOT', 'Life › Profile › SWOT', { pathname: '/profile', params: { tab: 'swot' } }, 'swot', 'kekuatan', 'kelemahan'),
  e('⚙️', 'System & Pemakaian', 'Life › System', { pathname: '/system' }, 'system', 'pemakaian', 'usage', 'statistik fitur'),
  e('📱', 'Versi Aplikasi & Update', 'Life › System', { pathname: '/app-version' }, 'versi', 'update', 'ota', 'app version'),
  e('📊', 'Semua Pengingat', 'Today', { pathname: '/reminders' }, 'dashboard', 'semua pengingat', 'reminder lengkap'),
  e('💍', 'Married', 'Life › Married', { pathname: '/married' }, 'married', 'menikah', 'pernikahan'),
];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Cari fitur dari ketikan bebas. Semua kata yang diketik harus ketemu (di
 * nama, jalur, atau kata kunci) supaya "token listrik" tidak mengembalikan
 * semua yang mengandung "listrik". Kosong → tidak ada hasil (grid yang tampil).
 */
export function searchFeatures(query: string, limit = 12): FeatureEntry[] {
  const kata = norm(query).split(' ').filter(Boolean);
  if (kata.length === 0) return [];
  const skor = (f: FeatureEntry): number => {
    const nama = norm(f.label);
    const jalur = norm(f.path);
    const kunci = f.keywords.map(norm);
    let total = 0;
    for (const k of kata) {
      if (nama.startsWith(k)) total += 4;
      else if (nama.includes(k)) total += 3;
      else if (kunci.some((x) => x.startsWith(k))) total += 2;
      else if (kunci.some((x) => x.includes(k)) || jalur.includes(k)) total += 1;
      else return 0;
    }
    return total;
  };
  return FEATURE_INDEX.map((f) => ({ f, s: skor(f) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}
