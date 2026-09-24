import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { EmptyText } from '@/components/common/EmptyText';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SearchBar } from '@/components/common/SearchBar';
import { VixText } from '@/components/common/VixText';
import { useLiveAll } from '@/hooks/useLiveAll';
import { usePagination } from '@/hooks/usePagination';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { isReflectionJournal, subscribeHabitSchedule, type ScheduledHabit } from '@/lib/habits';
import { subscribeHabitNotes, type HabitNotes } from '@/lib/health';
import { responsesLine } from '@/lib/journey';
import { subscribeReviveEntries, type ReviveEntry } from '@/lib/spiritual';

// Riwayat Morning Journey 🌤️ — pagi-pagi sebelumnya, hari terbaru dulu.
//
// Tidak ada koleksinya sendiri: isian journey menumpang di Revive hari itu
// (rhema, aplikasi, respons hati, doa pagi) dan di 📓 Daily Reflection
// Journal (Habits). Layar ini cuma menjahit keduanya per hari, jadi apa pun
// yang ditulis lewat editor Revive atau tab Habits ikut tampil di sini, dan
// sebaliknya. Click satu hari → Revive hari itu.

/** Satu pagi: Revive-nya (kalau ada) + refleksi jurnalnya (kalau ada). */
type JourneyDay = {
  dayId: string;
  entry: ReviveEntry | null;
  reflection: string;
};

/** Pagi yang memang ada isinya (bukan Revive kosong / hari tanpa jurnal). */
function adaIsi(d: JourneyDay): boolean {
  const e = d.entry;
  return (
    d.reflection.trim().length > 0 ||
    (e !== null &&
      (e.rhema.trim().length > 0 ||
        e.reflection.trim().length > 0 ||
        (e.responses ?? []).length > 0 ||
        (e.prayer ?? '').trim().length > 0))
  );
}

/** Semua teks satu pagi jadi satu, untuk pencarian. */
function teksCari(d: JourneyDay): string {
  const e = d.entry;
  return [
    d.reflection,
    e?.title,
    e?.passage,
    e?.rhema,
    e?.reflection,
    e?.prayer,
    responsesLine(e?.responses),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function JourneyHistoryScreen() {
  const router = useRouter();

  const [entries, setEntries] = useState<ReviveEntry[] | null>(null);
  const [habits, setHabits] = useState<ScheduledHabit[] | null>(null);
  const [notes, setNotes] = useState<HabitNotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useLiveAll(
    (uid, fail) => [
      subscribeReviveEntries(uid, setEntries, fail),
      subscribeHabitSchedule(uid, setHabits, fail),
    ],
    { onError: setError },
  );

  // Id barisnya lahir saat baris itu dibuat, jadi dicari dari daftarnya.
  // Dependency-nya ID (string), bukan objek `habits`: tiap snapshot melahirkan
  // objek baru, dan itu akan memasang ulang langganan catatannya tiap kali.
  const journalId = habits?.find(isReflectionJournal)?.id ?? null;
  useLiveAll(
    (uid, fail) => [subscribeHabitNotes(uid, journalId ?? '', setNotes, fail, 90)],
    { onError: setError, deps: [journalId], when: journalId !== null },
  );

  // Barisnya tidak ada → tidak ada catatan yang bisa ditunggu.
  const memuat =
    entries === null || habits === null || (journalId !== null && notes === null);

  const hari = new Map<string, JourneyDay>();
  for (const e of entries ?? []) hari.set(e.id, { dayId: e.id, entry: e, reflection: '' });
  for (const n of notes?.days ?? []) {
    const ada = hari.get(n.dayId);
    if (ada) ada.reflection = n.text;
    else hari.set(n.dayId, { dayId: n.dayId, entry: null, reflection: n.text });
  }
  const q = query.trim().toLowerCase();
  const semua = [...hari.values()]
    .filter(adaIsi)
    .filter((d) => !q || teksCari(d).includes(q))
    .sort((a, b) => b.dayId.localeCompare(a.dayId));

  const { setPage, currentPage, pageCount, pageItems } = usePagination(semua);

  // Ganti kata kunci → balik ke halaman 1.
  useEffect(() => setPage(1), [query, setPage]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Spiritual"
        title="Morning Journey 🌅"
        subtitle="Pagi-pagi bersama Tuhan sebelumnya"
      />
      <ScreenError message={error} />

      {memuat ? (
        <LoadingCenter />
      ) : (
        <>
          <View style={styles.searchWrap}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Cari refleksi, doa, atau judul Revive"
            />
          </View>

          {/* key=currentPage → scroll balik ke atas tiap ganti halaman */}
          <ScrollView key={currentPage} contentContainerStyle={styles.content}>
            {semua.length === 0 ? (
              <EmptyText>
                {q
                  ? 'Tidak ada pagi yang cocok dengan pencarianmu.'
                  : 'Belum ada catatan pagi. Besok pagi, tulis apa yang berbicara kepadamu 🌅'}
              </EmptyText>
            ) : (
              <>
                {pageItems.map((d) => (
                  <PressableScale
                    key={d.dayId}
                    style={styles.card}
                    onPress={() =>
                      router.push({ pathname: '/revive', params: { day: d.dayId } })
                    }>
                    <VixText heading="label" additionalStyle={styles.date}>
                      📆 {formatFullDate(dayIdToDate(d.dayId))}
                    </VixText>
                    {d.entry?.title ? (
                      <VixText heading="bold" additionalStyle={styles.title}>
                        {d.entry.title}
                        {d.entry.passage ? ` · 📖 ${d.entry.passage}` : ''}
                      </VixText>
                    ) : null}
                    <Baris label="✨" text={d.entry?.rhema} />
                    <Baris label="💭" text={d.reflection} />
                    <Baris label="❤️" text={responsesLine(d.entry?.responses)} />
                    <Baris label="🏃🏻‍➡️" text={d.entry?.reflection} />
                    <Baris label="🙏" text={d.entry?.prayer} />
                  </PressableScale>
                ))}
                <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

/** Satu baris isian pagi itu — lambang di kiri, teksnya dipotong 3 baris. */
function Baris({ label, text }: { label: string; text: string | undefined }) {
  if (!text || !text.trim()) return null;
  return (
    <View style={styles.baris}>
      <VixText heading="paragraph">{label}</VixText>
      <VixText heading="paragraph" numberOfLines={3} additionalStyle={styles.barisText}>
        {text}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  searchWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  date: { color: Color.TEXT_LABEL },
  title: { color: Color.SPIRITUAL_DARK },
  baris: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  barisText: { flex: 1, color: Color.TEXT_PARAGRAPH },
});
