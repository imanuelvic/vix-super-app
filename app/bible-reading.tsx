import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { BibleJourney } from '@/components/spiritual/BibleJourney';
import { useAuth } from '@/contexts/auth';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useFormSave } from '@/hooks/useFormSave';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useNow } from '@/hooks/useNow';
import { BIBLE_CATEGORY } from '@/lib/reward';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';
import {
  BIBLE_SKIPPED,
  BIBLE_VERSION_DEFAULT,
  bibleDayComplete,
  bibleMinutesLeft,
  bibleSessionOf,
  bibleStreakNow,
  bumpBibleStreaks,
  dailyReminder,
  EMPTY_BIBLE_NOTES,
  EMPTY_BIBLE_STREAKS,
  fetchBibleSuggestions,
  isBibleSkipped,
  openYouVersion,
  saveBibleJourney,
  saveBibleReading,
  subscribeBibleReadingToday,
  subscribeBibleStreaks,
  type BibleJourneyFields,
  type BibleReadingNotes,
  type BibleReadingSessions,
  type BibleReadingVersions,
  type BibleStreaks,
} from '@/lib/spiritual';
import { splitBibleRefs } from '@/lib/bible';

// Layar catat bacaan Alkitab 📖 — dibuka dari kartu Morning/Midday/Night
// Bible Reading di Home, dari baris Habits, & dari arsipnya di Walk.
//
// 2 Okt 2026: isinya jadi PERJALANAN lima langkah (lihat
// components/spiritual/BibleJourney.tsx). Layar ini tinggal mengurus DATA —
// langganan, rekomendasi, & penyimpanan — persis seperti pasangan
// app/morning-journey.tsx & components/spiritual/MorningJourney.tsx.
//
// Tetap halaman penuh (bukan modal) karena pemilih kitabnya sendiri sudah
// memakai modal; modal di atas modal tidak andal di iOS.
export default function BibleReadingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { session: sessionParam } = useLocalSearchParams<{ session?: string }>();
  const session = bibleSessionOf(sessionParam);

  // Jam BERJALAN (di-segarkan tiap menit) — untuk hitung mundur jendela baca.
  const { now } = useNow();

  const [today, setToday] = useState<BibleReadingSessions | null>(null);
  const [versions, setVersions] = useState<BibleReadingVersions | null>(null);
  const [notes, setNotes] = useState<BibleReadingNotes>(EMPTY_BIBLE_NOTES);
  const [streaks, setStreaks] = useState<BibleStreaks>(EMPTY_BIBLE_STREAKS);
  // Penanda sibuk + pesan gagal formulir (hook bersama).
  const { busy, formError: error, save } = useFormSave();

  const dayId = dayDocId(new Date());

  useLiveAll(
    (uid) => [
      subscribeBibleReadingToday(uid, dayId, (sessions, versi, catatan) => {
        setToday(sessions);
        setVersions(versi);
        setNotes(catatan);
      }),
      subscribeBibleStreaks(uid, setStreaks),
    ],
    { deps: [dayId] },
  );

  // Sudah pernah diisi hari ini → tampilkan lagi supaya bisa ditambah/dibetulkan.
  const existing = today?.[session] ?? '';
  const skipped = isBibleSkipped(existing);
  const tercatat = !!existing && !skipped;

  // Rekomendasi bacaan berikutnya 💡 — sambungan dari catatan TERAKHIR sesi
  // ini: kemarin Amsal 2, hari ini Amsal 3. Diambil sekali saat layar dibuka.
  // Kalau gagal (mis. sedang offline) layarnya tetap jalan seperti biasa —
  // ini bantuan mengetik, bukan isi, jadi galatnya sengaja tidak ditampilkan.
  //
  // Ketiganya diambil sekaligus & sesinya dipilih SESUDAHNYA, bukan ikut
  // masuk ke dalam kuerinya: riwayat yang dibaca sama persis, jadi memisahnya
  // per sesi cuma menambah kueri tanpa menambah data.
  const muatSaran = useMemo(
    () => (user ? () => fetchBibleSuggestions(user.uid) : null),
    [user],
  );
  const { data: semuaSaran } = useAsyncData(muatSaran, LOAD_ERROR);
  const saran = semuaSaran?.[session] ?? null;

  // Beberapa acuan sekaligus — kalau hari itu baca lebih dari satu kitab.
  // Dipecah dengan pemisah yang sama dengan arsipnya, jadi "Amsal 3:5-6"
  // tetap utuh. Belum tercatat → ikut rekomendasi pasal berikutnya.
  const initialRefs = tercatat ? splitBibleRefs(existing) : [saran?.next ?? ''];

  // Terjemahan yang dibaca ("TB", "BIS", "NIV", …). Belum dicatat hari ini →
  // ikut terjemahan yang dipakai TERAKHIR di sesi ini. Ganti terjemahan itu
  // jarang, jadi menyalin TB terus-menerus padahal sebulan terakhir baca TSI
  // cuma bikin catatannya keliru.
  const versiTersimpan = versions?.[session] ?? BIBLE_VERSION_DEFAULT;
  const initialVersion = tercatat
    ? versiTersimpan
    : (saran?.version ?? versiTersimpan);

  // Keterangan kecil di kartu Bacaan 1: dari mana angka itu datang. Tanpa ini
  // pasal yang tiba-tiba terisi bisa disangka catatan yang sudah tersimpan.
  // Kitab yang tamat tidak disambung sendiri ke kitab berikutnya — memilih
  // kitab baru itu keputusanmu, jadi yang muncul ucapan selamat, bukan tebakan.
  const hint =
    tercatat || !saran
      ? null
      : saran.next
        ? `💡 Lanjutan dari ${saran.last} · ${formatShortDayDate(dayIdToDate(saran.dayId))}`
        : saran.finished
          ? `🎉 ${saran.last}, kitabnya tamat. Pilih kitab baru ya.`
          : null;

  // Jendelanya habis DAN sesi ini masih kosong — bukan "belum dibaca", tapi
  // "terlewat". `!existing` mencakup keduanya sekaligus: belum dicatat dan
  // belum ditandai lewat sendiri. Saat itu Habits sudah menandainya ✗ sendiri
  // (lihat `bibleMirrorState`), jadi tombol lewati tak lagi menawarkan apa pun.
  const minutesLeft = bibleMinutesLeft(session, now);
  const terlewat = !existing && minutesLeft <= 0;

  /**
   * 📖 Read — acuan & terjemahannya tersimpan, streak BELUM naik.
   *
   * Sengaja TANPA `save()` di sini: penanda sibuk & pesan gagalnya milik
   * langkah Read sendiri, supaya perjalanannya tidak maju ke langkah
   * berikutnya kalau tulisannya gagal tersimpan.
   */
  async function handleSaveRead(passage: string, version: string) {
    if (!user || !passage) return;
    await saveBibleReading(user.uid, dayId, session, passage, version);
  }

  /** ✨ Receive & 💛 Verse — tiap langkah menyimpan bagiannya sendiri. */
  async function handleSaveJourney(fields: BibleJourneyFields) {
    if (!user) return;
    await saveBibleJourney(user.uid, dayId, session, fields);
  }

  /**
   * 🕊️ Close — "✅ Sudah baca": pastikan acuannya tersimpan, naikkan streak 🔥,
   * lalu ke arsipnya di sub-tab sesi yang BARUSAN dicatat.
   *
   * `replace`, bukan `push`: perjalanan ini sudah selesai tugasnya, jadi
   * tombol kembali dari arsipnya menuju Home, bukan balik ke langkah penutup
   * yang isinya sudah tersimpan.
   *
   * Sesinya DIOPER apa adanya, bukan diambil ulang dari jam sekarang:
   * mencatat bacaan Siang jam 23.00 itu wajar, dan yang harus terlihat adalah
   * yang barusan kamu tulis — bukan sesi yang kebetulan sedang berjalan.
   */
  async function handleDone(passage: string, version: string) {
    if (!user || !today || !passage) return;
    await save(async () => {
      await saveBibleReading(user.uid, dayId, session, passage, version);
      // "Lengkap" = KETIGA sesi hari ini terisi setelah simpan ini.
      await bumpBibleStreaks(
        user.uid,
        streaks,
        dayId,
        session,
        bibleDayComplete(today, session),
      );
      router.replace({ pathname: '/walk', params: { tab: 'bible', session } });
    });
  }

  /**
   * Lewati sesi hari ini. Kartu reminder di Home berhenti menagih, tapi
   * streak 🔥 SENGAJA tidak dinaikkan — supaya angkanya tetap jujur.
   * Meng-click-nya lagi (saat sudah dilewati) membatalkan status itu.
   */
  async function handleSkip() {
    if (!user) return;
    await save(async () => {
      await saveBibleReading(
        user.uid,
        dayId,
        session,
        skipped ? '' : BIBLE_SKIPPED,
      );
      if (!skipped) router.back();
    });
  }

  /**
   * Story Instagram 9:16 — OPSIONAL. Acuan, ayat, & bunyinya dioper apa adanya
   * lewat parameter (pendek), jadi layar Story tidak perlu membaca Firestore
   * sama sekali. Terjemahannya ikut: yang membaca Story-mu tidak punya cara
   * lain untuk tahu "Amsal 1:4" itu versi yang mana.
   */
  function handleShare(passage: string, version: string) {
    router.push({
      pathname: '/bible-story',
      params: {
        session,
        refs: passage,
        version,
        verse: notes[session].verse,
        verseText: notes[session].verseText,
      },
    });
  }

  return (
    <BibleJourney
      session={session}
      reminder={dailyReminder(dayId, `baca-${session}`)}
      minutesLeft={minutesLeft}
      streak={bibleStreakNow(streaks, session, dayId)}
      initialRefs={initialRefs}
      initialVersion={initialVersion}
      note={notes[session]}
      hint={hint}
      ready={today !== null}
      skipped={skipped}
      canSkip={!terlewat}
      busy={busy}
      error={error}
      onOpenBible={(passage, version) =>
        void openYouVersion(passage || undefined, version)
      }
      onSaveRead={handleSaveRead}
      onSaveJourney={handleSaveJourney}
      onShare={handleShare}
      onDone={handleDone}
      onSkip={() => void handleSkip()}
      onOpenReward={() =>
        router.push({
          pathname: '/reward-category',
          params: { cat: BIBLE_CATEGORY[session] },
        })
      }
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }}
    />
  );
}
