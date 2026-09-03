import { useRouter } from 'expo-router';

import { ReminderCard } from '@/components/common/ReminderCard';
import { HOME_FEATURES } from '@/lib/homeGrid';

// Kartu reminder untuk badge yang BELUM punya kartunya sendiri di Dashboard.
//
// Aturannya satu: tiap badge merah yang menyala harus ada kartunya di
// Dashboard. Kalau tidak, angka merah di Home menyuruhmu masuk ke suatu fitur
// sementara Dashboard — tempat kamu membaca "apa yang harus dikerjakan hari
// ini" — diam saja soal itu. Split Bill & Device dulu persis begitu: badge-nya
// menyala berhari-hari tanpa pernah disebut sekali pun di Dashboard.
//
// Fitur yang SUDAH punya kartu/bagiannya sendiri sengaja TIDAK masuk daftar
// ini, supaya tidak ada dua kartu untuk hal yang sama:
//   tasks · career · core · spiritual · car · residence · fitness ·
//   learning · finance · family
//
// Menambah fitur berbadge baru → tambah satu baris di sini (atau buat kartu
// khususnya sendiri di dashboard.tsx). Warna & tujuannya tidak perlu ditulis
// lagi: keduanya ikut HOME_FEATURES, jadi kartunya otomatis sewarna tile-nya
// di Home.

type Nota = {
  emoji: string;
  /** Apa yang membuat badge-nya menyala. */
  apa: string;
  /** Apa yang harus dilakukan supaya padam. */
  aksi: string;
};

const TANPA_KARTU: Record<string, Nota> = {
  friends: {
    emoji: '🤝',
    apa: 'Futsal yang tinggal ≤ 2 hari lagi, atau iuran (futsal / patungan) yang belum masuk.',
    aksi: 'Pastikan lapangannya sudah dibooking & pemainnya cukup, lalu tagih yang belum setor.',
  },
  device: {
    emoji: '📱',
    apa: 'Paket kuota yang habis besok atau hari ini.',
    aksi: 'Isi ulang paketnya sebelum kuotanya benar-benar habis.',
  },
};

export function BadgeReminders({ counts }: { counts: Record<string, number> }) {
  const router = useRouter();
  return (
    <>
      {HOME_FEATURES.map((f) => {
        const nota = TANPA_KARTU[f.key];
        const jumlah = counts[f.key] ?? 0;
        if (!nota || jumlah <= 0) return null;
        return (
          <ReminderCard
            key={f.key}
            bg={f.bg}
            fg={f.fg}
            title={`${nota.emoji} Reminder ${f.label} — ${jumlah} hal`}
            texts={[nota.apa, nota.aksi]}
            onPress={() => router.push(f.route)}
          />
        );
      })}
    </>
  );
}

/** Ada badge yang perlu kartunya? Dipakai `hasActionReminder` di Dashboard. */
export function anyBadgeReminder(counts: Record<string, number>): boolean {
  return Object.keys(TANPA_KARTU).some((key) => (counts[key] ?? 0) > 0);
}
