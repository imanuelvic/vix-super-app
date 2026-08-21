import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DeadlineTag } from '@/components/common/Deadline';
import { VixText } from '@/components/common/VixText';
import {
  meetingKindLabels,
  meetingLeaderNames,
  type CoreLeader,
  type Visitation,
} from '@/lib/core';
import { deadlineLabel, type DeadlineTone } from '@/lib/deadline';
import { formatFullDate } from '@/lib/format';

// Isi kartu satu visitasi: nama CORE + status → jenis acara → penanda acara
// gabungan → tanggal → judul.
//
// Dipakai DUA layar: sub-tab Visitation (CORE) & Riwayat Visitasi 🕘. Dulu blok
// ini disalin utuh di keduanya — termasuk gayanya — jadi menambah satu baris
// berarti mengubah dua tempat.
//
// Yang TIDAK di sini: bungkus kartunya. Riwayat memakai satu PressableScale
// polos, sedangkan tab Visitation menaruh tombol share sebagai SAUDARA dari
// area ketuk (Pressable bersarang tidak andal di iOS). Jadi bungkusnya tetap
// milik masing-masing layar.
//
// Agenda sengaja tidak ikut ditampilkan — isinya bisa belasan baris dan satu
// jadwal saja bisa memenuhi layar. Tetap utuh di modal & PDF-nya.
export function VisitationCardBody({
  visitation: v,
  leaders,
  tone,
  days,
}: {
  visitation: Visitation;
  /** CL aktif + ex-CL, supaya nama yang sudah diarsipkan tetap terbaca. */
  leaders: CoreLeader[];
  tone: DeadlineTone;
  /** Sisa hari menuju tanggalnya — negatif berarti sudah lewat. */
  days: number;
}) {
  return (
    <>
      <View style={styles.cardTop}>
        <VixText heading="bold" additionalStyle={styles.cardTitle}>
          {meetingLeaderNames(v, leaders)}
        </VixText>
        {v.done ? (
          <VixText heading="label" additionalStyle={styles.statusDone}>
            ✅ Selesai
          </VixText>
        ) : (
          <DeadlineTag tone={tone} label={deadlineLabel(days)} />
        )}
      </View>
      <VixText heading="label" additionalStyle={styles.kindLine}>
        {meetingKindLabels(v)}
      </VixText>
      {/* Acara gabungan: perjelas berapa CORE yang ikut */}
      {v.leaderIds.length > 1 ? (
        <VixText heading="label" additionalStyle={styles.kindLine}>
          🤝 {v.leaderIds.length} CORE gabung
        </VixText>
      ) : null}
      <VixText heading="label">📆 {formatFullDate(v.date.toDate())}</VixText>
      {v.note ? <VixText heading="label">🏷️ Judul: {v.note}</VixText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  kindLine: { color: Color.MAIN },
  statusDone: { color: Color.SUCCESS },
});
