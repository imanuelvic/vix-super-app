import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';

import {
  MorningJourney,
  type ChainLeader,
} from '@/components/spiritual/MorningJourney';
import { useAuth } from '@/contexts/auth';
import { useLiveAll } from '@/hooks/useLiveAll';
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
import {
  isReflectionJournal,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import { setHabitNote, subscribeHabitDay, type HabitDay } from '@/lib/health';
import { intercessionToday } from '@/lib/intercession';
import {
  subscribePrayerNews,
  withWeeklyNews,
  type PrayerNews,
} from '@/lib/prayerNews';
import {
  bumpReviveStreak,
  reviveWritten,
  saveJourneyFields,
  subscribeReviveEntry,
  subscribeReviveStreak,
  type JourneyFields,
  type ReviveEntry,
  type ReviveStreak,
} from '@/lib/spiritual';
import { openWhatsAppChat } from '@/lib/whatsapp';

// Morning Journey 🌅 — halaman PENUH di root stack (di luar tab), jadi
// menutupi seluruh layar termasuk tab bar. Yang mengarahkan ke sini adalah
// <MorningPrayerWatcher/> di app/_layout.tsx, jadi berlaku dari layar mana pun.
// Layar ini cuma mengurus DATA (langganan & simpan); tampilannya di
// components/spiritual/MorningJourney.tsx.
export default function MorningPrayerScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [login, setLogin] = useState<LoginStreak | null>(null);
  const [reviveStreak, setReviveStreak] = useState<ReviveStreak | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [monthlyPrayers, setMonthlyPrayers] = useState<MonthlyPrayers>(
    EMPTY_MONTHLY_PRAYERS,
  );
  // Kliping berita mingguan — hanya DIBACA di sini (yang menyegarkannya Home),
  // supaya syafaat Gereja/Negara pagi hari ikut menyebut kejadian minggu ini.
  const [prayerNews, setPrayerNews] = useState<PrayerNews | null>(null);
  // Revive hari ini — tempat isian 📖 Receive, ❤️ Respond, & 🙏 Pray menumpang.
  // undefined = belum terbaca (jangan menyimpan dulu), null = belum ada.
  const [entry, setEntry] = useState<ReviveEntry | null | undefined>(undefined);
  // Daftar kebiasaan + ceklis hari ini — untuk 💭 Reflect (📓 Daily Reflection
  // Journal). null = belum terbaca.
  const [habits, setHabits] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);

  // Jam BERJALAN (di-segarkan tiap menit), bukan `new Date()` sekali render —
  // dipakai untuk sisa waktu ke jam 09.00 & untuk keluar sendiri saat
  // jendelanya habis.
  const { now, todayId } = useNow();

  useLiveAll((uid) => [
    subscribeLoginStreak(uid, setLogin),
    subscribeReviveStreak(uid, setReviveStreak),
    subscribeCoreLeaders(uid, setLeaders),
    subscribeMonthlyPrayers(uid, setMonthlyPrayers),
    subscribePrayerNews(uid, setPrayerNews),
    subscribeHabitSchedule(uid, setHabits),
  ]);

  // Dokumen harian dipasang ulang saat tanggalnya berganti (tengah malam).
  useLiveAll(
    (uid) => [
      subscribeReviveEntry(uid, todayId, setEntry),
      subscribeHabitDay(uid, todayId, setDay),
    ],
    { deps: [todayId] },
  );

  // Doa Rantai: hanya di hari jadwalnya (Selasa & Kamis) & kalau memang ada CL
  // giliran hari ini. Sumber hitungannya SAMA dengan kartu Dashboard.
  const points = monthlyPointsFor(monthlyPrayers, now);
  const chainLeaders = prayerFollowupLeaders(leaders, points, now);
  const chainDue = isPrayerFollowupDay(now) && chainLeaders.length > 0;
  // Pokok doa tiap CL giliran hari ini, siap ditampilkan LANGSUNG di journey.
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

  // 📓 Daily Reflection Journal hari ini. Barisnya dicari lewat namanya (sama
  // seperti Home & Habits); kalau tidak ada, langkah Reflect tetap tampil
  // tanpa kolom tulis.
  const journalHabit = habits?.find(isReflectionJournal) ?? null;
  const journal =
    habits === null || day === null
      ? null
      : {
          text: journalHabit ? (day.notes[journalHabit.id] ?? '') : '',
          available: journalHabit !== null,
        };

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

  /**
   * Simpan isian journey ke Revive hari ini. Kalau lewat isian ini Revive-nya
   * jadi UTUH (judul, bacaan, rhema, aplikasi), streak Revive 🔥 naik — persis
   * seperti menyimpan dari editor Revive.
   */
  async function handleSaveRevive(fields: JourneyFields) {
    if (!user) return;
    const current = entry ?? null;
    await saveJourneyFields(user.uid, todayId, current, fields, new Date());
    const gabung = {
      title: current?.title ?? '',
      passage: current?.passage ?? '',
      rhema: current?.rhema ?? '',
      reflection: current?.reflection ?? '',
      ...fields,
    };
    if (reviveWritten(gabung)) {
      await bumpReviveStreak(user.uid, reviveStreak, todayId);
    }
  }

  async function handleSaveReflect(text: string) {
    if (!user || !journalHabit) return;
    await setHabitNote(user.uid, todayId, journalHabit.id, text);
  }

  async function handleConfirm() {
    // Tandai LOKAL dulu, sebelum pindah halaman. Inilah yang menghilangkan bug
    // "harus konfirmasi 2×": tulisan ke Firestore butuh sesaat untuk kembali
    // sebagai snapshot, dan tanpa penanda ini Home masih membaca data lama lalu
    // melempar balik ke sini. Tulisannya sendiri tetap fire-and-forget
    // supaya tidak menggantung saat sinyal jelek.
    markPrayerHandled(new Date());
    if (user) {
      recordDailyPrayer(user.uid, login, new Date()).catch(() => {});
    }
    router.replace('/');
  }

  function handleSkip() {
    // Pagi yang tidak memungkinkan: streak mulai dari awal, hari ini ditandai
    // selesai supaya layar ini tidak muncul lagi hari ini, lalu ke Home.
    markPrayerHandled(new Date());
    if (user) {
      skipDailyPrayer(user.uid, login, new Date()).catch(() => {});
    }
    router.replace('/');
  }

  // CEK LANGSUNG tiap kali layar ini digambar: kalau pagi ini ternyata sudah
  // ditutup — di HP ini maupun HP lain — atau jam 09.00 sudah lewat, layar ini
  // tidak ditampilkan sama sekali. Karena `login` datang dari langganan
  // Firestore yang hidup, "Mulai Hariku" di HP A menutup layar ini di HP B
  // dalam hitungan detik, tanpa disentuh.
  if (!prayerGateDue(login, now)) {
    return <Redirect href="/" />;
  }

  return (
    <MorningJourney
      todayId={todayId}
      entry={entry ?? null}
      reviveReady={entry !== undefined}
      journal={journal}
      chainDue={chainDue}
      chainLeft={chainLeft}
      chainLeaders={chainRows}
      topic={withWeeklyNews(intercessionToday(now), prayerNews)}
      minutesLeft={prayerMinutesLeft(now)}
      onSaveRevive={handleSaveRevive}
      onSaveReflect={handleSaveReflect}
      onPrayLeader={handlePrayLeader}
      onConfirm={handleConfirm}
      onSkip={handleSkip}
    />
  );
}
