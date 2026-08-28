import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  MorningPrayerGate,
  type ChainLeader,
} from '@/components/spiritual/MorningPrayerGate';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import {
  markPrayerHandled,
  prayerGateDue,
  prayerMinutesLeft,
  recordDailyPrayer,
  skipDailyPrayer,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/achievements';
import {
  EMPTY_MONTHLY_PRAYERS,
  isPrayerFollowupDay,
  markPrayerFollowed,
  monthlyPointsFor,
  prayerChainMessage,
  prayerFollowupLeaders,
  PRAYER_MORNING_QUOTA,
  subscribeCoreLeaders,
  subscribeMonthlyPrayers,
  type CoreLeader,
  type MonthlyPrayers,
} from '@/lib/core';
import { intercessionToday } from '@/lib/intercession';
import {
  subscribePrayerNews,
  withWeeklyNews,
  type PrayerNews,
} from '@/lib/prayerNews';
import { unsubscribeAll } from '@/lib/liveDoc';
import { reviveHandledToday, subscribeReviveStreak } from '@/lib/spiritual';
import { openWhatsAppChat } from '@/lib/whatsapp';

// Lock screen doa pagi — halaman PENUH di root stack (di luar tab), jadi
// menutupi seluruh layar termasuk tab bar. Yang mengarahkan ke sini adalah
// <MorningPrayerWatcher/> di app/_layout.tsx, jadi berlaku dari layar mana pun.
export default function MorningPrayerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [login, setLogin] = useState<LoginStreak | null>(null);
  const [reviveStreak, setReviveStreak] = useState<LoginStreak | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [monthlyPrayers, setMonthlyPrayers] = useState<MonthlyPrayers>(
    EMPTY_MONTHLY_PRAYERS,
  );
  // Kliping berita mingguan — hanya DIBACA di sini (yang menyegarkannya Home),
  // supaya syafaat Gereja/Negara pagi hari ikut menyebut kejadian minggu ini.
  const [prayerNews, setPrayerNews] = useState<PrayerNews | null>(null);

  useEffect(() => {
    if (!user) return;
    return unsubscribeAll([
      subscribeLoginStreak(user.uid, setLogin),
      subscribeReviveStreak(user.uid, setReviveStreak),
      subscribeCoreLeaders(user.uid, setLeaders),
      subscribeMonthlyPrayers(user.uid, setMonthlyPrayers),
      subscribePrayerNews(user.uid, setPrayerNews),
    ]);
  }, [user]);

  // Jam BERJALAN (di-segarkan tiap menit), bukan `new Date()` sekali render —
  // dipakai untuk hitung mundur ke jam 09.00 & untuk keluar sendiri saat
  // jendelanya habis.
  const { now, todayId } = useNow();

  // Revive hari ini sudah diurus (ditulis ATAU sengaja dilewati) → gate
  // mencentang langkah Revive otomatis. Tanpa memperhitungkan tanda "dilewati",
  // melewati Revive akan mengunci gerbang doa pagi sampai jam 09.00.
  const reviveDone = reviveHandledToday(reviveStreak, todayId);

  // Doa Rantai: hanya di hari jadwalnya (Selasa & Kamis) & kalau memang ada CL
  // giliran hari ini. Sumber hitungannya SAMA dengan kartu Dashboard.
  const points = monthlyPointsFor(monthlyPrayers, now);
  const chainLeaders = prayerFollowupLeaders(leaders, points, now);
  const chainDue = isPrayerFollowupDay(now) && chainLeaders.length > 0;
  // Pokok doa tiap CL giliran hari ini, siap ditampilkan LANGSUNG di gerbang.
  const chainRows: ChainLeader[] = chainLeaders.map((l) => ({
    id: l.id,
    heart: l.heart,
    name: l.name,
    phone: l.phone,
    points: points[l.id] ?? [],
    done: monthlyPrayers.followedDayId[l.id] === todayId,
  }));
  const chainQuota = Math.min(PRAYER_MORNING_QUOTA, chainRows.length);
  const chainDoneCount = chainRows.filter((l) => l.done).length;
  const chainLeft = chainDue ? Math.max(0, chainQuota - chainDoneCount) : 0;

  /**
   * Buka WhatsApp berisi pokok doa CL itu, lalu catat sudah didoakan hari ini.
   * Dicatat SESUDAH WhatsApp terbuka; kalau pencatatannya gagal, pesannya
   * terlanjur terkirim — jadi kegagalannya cukup diabaikan.
   */
  function handlePrayLeader(leader: ChainLeader) {
    if (!leader.phone) return;
    openWhatsAppChat(
      leader.phone,
      prayerChainMessage(leader.name, leader.points),
    );
    if (user && !leader.done) {
      markPrayerFollowed(user.uid, monthlyPrayers, leader.id, now, todayId)
        .catch(() => {});
    }
  }

  async function handleConfirm() {
    // Tandai LOKAL dulu, sebelum pindah halaman. Inilah yang menghilangkan bug
    // "harus konfirmasi 2×": tulisan ke Firestore butuh sesaat untuk kembali
    // sebagai snapshot, dan tanpa penanda ini Home masih membaca data lama lalu
    // melempar balik ke gerbang. Tulisannya sendiri tetap fire-and-forget
    // supaya tidak menggantung saat sinyal jelek.
    markPrayerHandled(new Date());
    if (user) {
      recordDailyPrayer(user.uid, login, new Date()).catch(() => {});
    }
    router.replace('/');
  }

  function handleSkip() {
    // Keadaan mendesak: streak hangus tapi hari ini ditandai selesai supaya
    // gerbang tidak muncul lagi hari ini, lalu langsung ke Home.
    markPrayerHandled(new Date());
    if (user) {
      skipDailyPrayer(user.uid, login, new Date()).catch(() => {});
    }
    router.replace('/');
  }

  // CEK LANGSUNG tiap kali layar ini digambar: kalau doa hari ini ternyata
  // sudah dikonfirmasi — di HP ini maupun HP lain — atau jam 09.00 sudah
  // lewat, gerbangnya tidak ditampilkan sama sekali. Karena `login` datang
  // dari langganan Firestore yang hidup, konfirmasi di HP A menutup layar ini
  // di HP B dalam hitungan detik, tanpa disentuh.
  if (!prayerGateDue(login, now)) {
    return <Redirect href="/" />;
  }

  return (
    <MorningPrayerGate
      streakCount={login?.count ?? 0}
      reviveDone={reviveDone}
      chainDue={chainDue}
      chainLeft={chainLeft}
      chainQuota={chainQuota}
      chainDoneCount={chainDoneCount}
      chainLeaders={chainRows}
      topic={withWeeklyNews(intercessionToday(now), prayerNews)}
      minutesLeft={prayerMinutesLeft(now)}
      onConfirm={handleConfirm}
      onOpenRevive={() => router.push('/revive')}
      onPrayLeader={handlePrayLeader}
      onSkip={handleSkip}
    />
  );
}
