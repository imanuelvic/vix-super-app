import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT, SCREEN_SAFE } from '@/assets/style/layout';
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
import { prayerTopicsLine, responsesLine, tallyResponses } from '@/lib/journey';
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
    prayerTopicsLine(e?.prayerTopics),
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
            {/* ❤️ Respons yang paling sering muncul (2 Okt 2026).
                Dihitung dari SELURUH pagi yang sudah terbaca di layar ini,
                bukan dari halaman yang sedang dibuka — dan karena datanya
                memang sudah dilanggan untuk daftar di bawahnya, kartu ini
                tidak menambah satu pun pembacaan Firestore.

                Disembunyikan selagi mencari: angka "paling sering" yang ikut
                menyusut mengikuti kata kunci bukan menjawab pertanyaan apa
                pun, ia cuma terbaca seperti rekapmu tiba-tiba berubah. */}
            {!q && <ResponsRekap pagi={semua} />}

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
                    <Baris label="🗂️" text={prayerTopicsLine(d.entry?.prayerTopics)} />
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

/**
 * ❤️ Rekap respons hati: mana yang paling sering kamu tandai.
 *
 * Yang di atas bukan sekadar daftar terurut — yang teratas diberi kalimatnya
 * sendiri, karena itulah jawaban dari pertanyaan yang membuat kartu ini ada:
 * "respons apa yang paling sering muncul di hatiku?".
 *
 * Yang BELUM PERNAH ditandai ikut disebut di kaki kartu, dan itu disengaja:
 * daftar yang cuma memajang kemenangan tidak memberi tahu apa pun yang belum
 * kamu sadari.
 */
function ResponsRekap({ pagi }: { pagi: JourneyDay[] }) {
  const rekap = tallyResponses(pagi.map((d) => d.entry?.responses));
  const terpakai = rekap.filter((r) => r.count > 0);
  if (terpakai.length === 0) return null;

  const teratas = terpakai[0];
  const tertinggi = teratas.count;
  const belum = rekap.filter((r) => r.count === 0);

  return (
    <View style={styles.rekap}>
      <VixText heading="label" additionalStyle={styles.rekapLabel}>
        ❤️ Respons Hatimu
      </VixText>
      <VixText heading="bold" additionalStyle={styles.rekapTop}>
        {teratas.emoji} {teratas.label} paling sering, {teratas.count}×
      </VixText>

      {terpakai.map((r) => (
        <View key={r.key} style={styles.rekapRow}>
          <VixText heading="paragraph" additionalStyle={styles.rekapName}>
            {r.emoji} {r.label}
          </VixText>
          {/* Panjang batangnya relatif terhadap yang TERATAS, bukan terhadap
              jumlah pagi: yang ingin terbaca perbandingan antar-respons. */}
          <View style={styles.rekapBarTrack}>
            <View
              style={[
                styles.rekapBar,
                { width: `${Math.max(6, (r.count / tertinggi) * 100)}%` },
              ]}
            />
          </View>
          <VixText heading="label" additionalStyle={styles.rekapCount}>
            {r.count}
          </VixText>
        </View>
      ))}

      {belum.length > 0 ? (
        <VixText heading="label" additionalStyle={styles.rekapBelum}>
          Belum pernah: {belum.map((r) => `${r.emoji} ${r.label}`).join(' · ')}
        </VixText>
      ) : null}
    </View>
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
  safe: { ...SCREEN_SAFE },
  searchWrap: { ...SCREEN_CONTENT, paddingBottom: 6 },
  content: { ...SCREEN_CONTENT, paddingBottom: 40 },
  card: {
    ...PANEL,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  date: { color: Color.TEXT_LABEL },
  title: { color: Color.SPIRITUAL_DARK },
  baris: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  barisText: { flex: 1, color: Color.TEXT_PARAGRAPH },
  // Rekap respons: pastel Spiritual, jadi ia terbaca sebagai ringkasan di atas
  // arsip yang putih, bukan sebagai salah satu kartu hari.
  rekap: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  rekapLabel: { color: Color.SPIRITUAL_DARK },
  rekapTop: { color: Color.SPIRITUAL_DEEP, marginBottom: 2 },
  rekapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Lebar tetap supaya batangnya mulai di garis yang sama untuk semua baris;
  // tanpa itu, batang yang sejajar justru tidak bisa dibandingkan.
  rekapName: { width: 150, color: Color.TEXT_TITLE },
  rekapBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: Color.CONTAINER,
    overflow: 'hidden',
  },
  rekapBar: { height: 8, borderRadius: 999, backgroundColor: Color.SPIRITUAL_DARK },
  rekapCount: { minWidth: 22, textAlign: 'right', color: Color.SPIRITUAL_DARK },
  rekapBelum: { color: Color.SPIRITUAL_DARK, marginTop: 4 },
});
