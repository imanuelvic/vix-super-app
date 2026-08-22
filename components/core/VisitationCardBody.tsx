import { StyleSheet } from 'react-native';

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

// Isi kartu satu visitasi: nama CORE → jenis acara → penanda acara gabungan →
// tanggal → judul.
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
// Status/hitung mundurnya juga BUKAN di sini — lihat <VisitationStatus> di
// bawah: tempatnya di kolom kanan kartu, di bawah tombol share.
//
// Agenda sengaja tidak ikut ditampilkan — isinya bisa belasan baris dan satu
// jadwal saja bisa memenuhi layar. Tetap utuh di modal & PDF-nya.
export function VisitationCardBody({
  visitation: v,
  leaders,
}: {
  visitation: Visitation;
  /** CL aktif + ex-CL, supaya nama yang sudah diarsipkan tetap terbaca. */
  leaders: CoreLeader[];
}) {
  return (
    <>
      <VixText heading="bold" additionalStyle={styles.cardTitle}>
        {meetingLeaderNames(v, leaders)}
      </VixText>
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

/**
 * Keadaan satu visitasi: ✅ Selesai, atau hitung mundur bertenggat
 * (🔴 hari ini · 🟡 besok · 🟢 sekian hari lagi · ⚠️ sudah lewat).
 *
 * Berdiri sendiri karena tempatnya di KOLOM KANAN kartu — di bawah tombol
 * share, bukan lagi sebaris dengan nama CORE-nya.
 */
export function VisitationStatus({
  visitation: v,
  tone,
  days,
}: {
  visitation: Visitation;
  tone: DeadlineTone;
  /** Sisa hari menuju tanggalnya — negatif berarti sudah lewat. */
  days: number;
}) {
  return v.done ? (
    <VixText heading="label" additionalStyle={styles.statusDone}>
      ✅ Selesai
    </VixText>
  ) : (
    <DeadlineTag tone={tone} label={deadlineLabel(days)} />
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: Color.TEXT_TITLE },
  kindLine: { color: Color.MAIN },
  statusDone: { color: Color.SUCCESS },
});
