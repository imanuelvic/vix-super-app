import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD, CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { deadlineBorder } from '@/components/common/Deadline';
import { EmptyText } from '@/components/common/EmptyText';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SectionRow } from '@/components/common/SectionRow';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  VisitationCardBody,
  VisitationStatus,
} from '@/components/core/VisitationCardBody';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useMonthCursor } from '@/hooks/useMonthCursor';
import {
  subscribeCoreLeaders,
  subscribeExLeaders,
  subscribeMonthlyMeetings,
  subscribeVisitations,
  visitDaysUntil,
  type CoreLeader,
  type MonthlyMeeting,
  type Visitation,
} from '@/lib/core';
import { calendarCells, coreEventsByDay, type CoreEvent } from '@/lib/coreCalendar';
import { deadlineTone } from '@/lib/deadline';
import {
  dayId,
  dayIdToDate,
  formatCompactDateTime,
  formatShortDayDate,
  MONTH_NAMES,
} from '@/lib/format';

// Kalender CORE 📆 — satu bulan sekali lihat: tanggal yang punya jadwal
// (visitasi dari sub-tab Visitation, rapat bulanan dari sub-tab Monthly)
// diberi titik di bawah angkanya; click tanggalnya → rinciannya di bawah
// kalender. Dibuka dari tombol 📆 di kepala sub-tab Visitation & Monthly.
//
// Datanya langganan yang SAMA dengan layar CORE (liveDoc berbagi listener),
// jadi membuka kalender tidak menambah bacaan Firestore.

/** Senin dulu — irama minggu yang sama dengan Habits & Health. */
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export default function CoreCalendarScreen() {
  const router = useRouter();

  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [meetings, setMeetings] = useState<MonthlyMeeting[] | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [exLeaders, setExLeaders] = useState<CoreLeader[]>([]);
  const [error, setError] = useState<string | null>(null);

  useLiveAll(
    (uid, fail) => [
      subscribeVisitations(uid, setVisitations, fail),
      subscribeMonthlyMeetings(uid, setMeetings, fail),
      subscribeCoreLeaders(uid, setLeaders, fail),
      subscribeExLeaders(uid, setExLeaders, fail),
    ],
    { onError: setError },
  );

  const today = new Date();
  const todayId = dayId(today);
  const { year, month, shiftMonth, goNow } = useMonthCursor(today);
  // Tanggal yang sedang dilihat rinciannya — mulai dari hari ini.
  const [selectedId, setSelectedId] = useState(todayId);

  const perHari = useMemo(
    () => coreEventsByDay(visitations ?? [], meetings ?? []),
    [visitations, meetings],
  );
  const cells = useMemo(() => calendarCells(year, month), [year, month]);
  const terpilih = perHari.get(selectedId) ?? [];
  const semuaLeader = [...leaders, ...exLeaders];

  // Jumlah jadwal di bulan yang sedang dilihat — keterangan kecil di kepala.
  const bulanIni = cells.filter((c) => c.inMonth).reduce(
    (n, c) => n + (perHari.get(c.dayId)?.length ?? 0),
    0,
  );

  function bukaJadwal(e: CoreEvent) {
    if (e.kind === 'visitation') {
      router.push({
        pathname: '/core',
        params: { tab: 'visitation', edit: e.visitation.id },
      });
    } else {
      router.push({ pathname: '/core/monthly/[id]', params: { id: e.meeting.id } });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Kalender CORE 📆"
        subtitle="Visitasi & rapat bulanan dalam sebulan"
      />
      <ScreenError message={error} />

      {visitations === null || meetings === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.calendar}>
            {/* Navigasi bulan — click nama bulannya = balik ke bulan ini */}
            <View style={styles.monthRow}>
              <PressableScale onPress={() => shiftMonth(-1)} hitSlop={10}>
                <IconSymbol name="chevron.left" size={22} color={Color.CORE_DARK} />
              </PressableScale>
              <PressableScale onPress={goNow} hitSlop={10} style={styles.monthMain}>
                <VixText heading="title" additionalStyle={styles.monthText}>
                  {MONTH_NAMES[month]} {year}
                </VixText>
                <VixText heading="label">
                  {bulanIni > 0 ? `${bulanIni} jadwal` : 'Belum ada jadwal'}
                </VixText>
              </PressableScale>
              <PressableScale onPress={() => shiftMonth(1)} hitSlop={10}>
                <IconSymbol name="chevron.right" size={22} color={Color.CORE_DARK} />
              </PressableScale>
            </View>

            <View style={styles.week}>
              {HARI.map((h) => (
                <VixText key={h} heading="label" additionalStyle={styles.weekDay}>
                  {h}
                </VixText>
              ))}
            </View>

            {/* 6 baris × 7 hari; tinggi tetap supaya tidak melompat antar bulan */}
            {Array.from({ length: 6 }, (_, baris) => (
              <View key={baris} style={styles.week}>
                {cells.slice(baris * 7, baris * 7 + 7).map((c) => {
                  const jadwal = perHari.get(c.dayId) ?? [];
                  const hariIni = c.dayId === todayId;
                  const dipilih = c.dayId === selectedId;
                  return (
                    <PressableScale
                      key={c.dayId}
                      style={styles.cell}
                      onPress={() => setSelectedId(c.dayId)}>
                      <View
                        style={[
                          styles.day,
                          hariIni && styles.dayToday,
                          dipilih && !hariIni && styles.daySelected,
                        ]}>
                        <VixText
                          heading={hariIni || dipilih ? 'bold' : 'paragraph'}
                          additionalStyle={[
                            styles.dayText,
                            !c.inMonth && styles.dayOutside,
                            hariIni && styles.dayTodayText,
                          ]}>
                          {c.date.getDate()}
                        </VixText>
                      </View>
                      {/* Titik jadwal: biru = visitasi, emas = rapat bulanan */}
                      <View style={styles.dots}>
                        {jadwal.slice(0, 3).map((e, i) => (
                          <View
                            key={i}
                            style={[
                              styles.dot,
                              e.kind === 'monthly' ? styles.dotMonthly : styles.dotVisit,
                            ]}
                          />
                        ))}
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            ))}

            <View style={styles.legend}>
              <View style={[styles.dot, styles.dotVisit]} />
              <VixText heading="label">Visitasi</VixText>
              <View style={[styles.dot, styles.dotMonthly, styles.legendGap]} />
              <VixText heading="label">Rapat bulanan</VixText>
            </View>
          </View>

          {/* ===== Rincian tanggal yang di-click ===== */}
          <SectionRow
            title={`📆 ${formatShortDayDate(dayIdToDate(selectedId))}`}
            right={
              terpilih.length > 0 ? (
                <VixText heading="label">{terpilih.length} jadwal</VixText>
              ) : undefined
            }
          />
          {terpilih.length === 0 ? (
            <EmptyText>Tidak ada jadwal CORE di tanggal ini.</EmptyText>
          ) : (
            terpilih.map((e) =>
              e.kind === 'visitation' ? (
                <VisitationCard
                  key={`v-${e.visitation.id}`}
                  visitation={e.visitation}
                  leaders={semuaLeader}
                  today={today}
                  onPress={() => bukaJadwal(e)}
                />
              ) : (
                <PressableScale
                  key={`m-${e.meeting.id}`}
                  style={styles.card}
                  onPress={() => bukaJadwal(e)}>
                  <VixText heading="bold" additionalStyle={styles.cardTitle}>
                    📋 {e.meeting.title || 'Rapat bulanan'}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.kindLine}>
                    🗓️ Rapat bulanan CORE
                  </VixText>
                  <VixText heading="label">
                    📆 {formatCompactDateTime(e.meeting.date.toDate())}
                  </VixText>
                  {e.meeting.place ? (
                    <VixText heading="label">📍 {e.meeting.place}</VixText>
                  ) : null}
                </PressableScale>
              ),
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Kartu visitasi — isi & status yang sama dengan sub-tab Visitation. */
function VisitationCard({
  visitation: v,
  leaders,
  today,
  onPress,
}: {
  visitation: Visitation;
  leaders: CoreLeader[];
  today: Date;
  onPress: () => void;
}) {
  const days = visitDaysUntil(v, today);
  const tone = v.done ? 'unknown' : deadlineTone(days);
  return (
    <PressableScale style={[styles.card, styles.cardRow, deadlineBorder(tone)]} onPress={onPress}>
      <View style={styles.cardMain}>
        <VisitationCardBody visitation={v} leaders={leaders} />
      </View>
      <VisitationStatus visitation={v} tone={tone} days={days} />
    </PressableScale>
  );
}

/** Ukuran lingkaran angka tanggal. */
const DAY = 34;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },
  // Kartu besar (sudut 20 seperti kartu ringkasan), bukan kartu daftar:
  // isinya grid 7 kolom yang butuh tepi sempit.
  calendar: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginBottom: CARD_GAP,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  monthMain: { alignItems: 'center' },
  monthText: { color: Color.CORE_DARK },
  week: { flexDirection: 'row' },
  weekDay: { flex: 1, textAlign: 'center', paddingVertical: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  day: {
    width: DAY,
    height: DAY,
    borderRadius: DAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: { backgroundColor: Color.CORE_DARK },
  daySelected: { borderWidth: 1.5, borderColor: Color.CORE_DARK },
  dayText: { color: Color.TEXT_TITLE },
  dayOutside: { color: Color.TEXT_PLACEHOLDER },
  dayTodayText: { color: Color.TEXT_REVERSE },
  // Baris titik SELALU ada (tinggi tetap) supaya angka tanggalnya sejajar,
  // ada jadwal atau tidak.
  dots: { flexDirection: 'row', gap: 3, height: 8, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotVisit: { backgroundColor: Color.CORE_DARK },
  dotMonthly: { backgroundColor: Color.ACCENT_DARK },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  legendGap: { marginLeft: 10 },
  card: { ...CARD, gap: 3, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  cardMain: { flex: 1, gap: 3 },
  cardTitle: { color: Color.TEXT_TITLE },
  kindLine: { color: Color.MAIN },
});
