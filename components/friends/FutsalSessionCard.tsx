import { StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { attentionBorder, AttentionMark } from '@/components/common/Badge';
import { EditButton } from '@/components/common/EditButton';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import {
    sessionNeedsAttention,
    sessionScoreLine,
    sessionTimeRange,
    sessionUnpaidCount,
    type FutsalSession,
} from '@/lib/futsal';

// Kartu satu sesi main — dipakai sub-tab Fun Futsal & halaman Jadwal Main.
//
// Berkasnya sendiri (bukan di dalam FutsalTab) karena dua alasan: komponen yang
// dibuat DI DALAM komponen lain berganti identitas tiap render — React
// membongkar-pasang seluruh kartunya alih-alih memperbaruinya, dan React
// Compiler menolaknya — dan sekarang memang ada dua layar yang memakainya.
export function FutsalSessionCard({
  s,
  now,
  onOpen,
  onEdit,
}: {
  s: FutsalSession;
  now: Date;
  onOpen: (s: FutsalSession) => void;
  /** Tanpa ini tombol pensilnya tidak muncul (mis. di halaman Jadwal Main). */
  onEdit?: (s: FutsalSession) => void;
}) {
  const belum = sessionUnpaidCount(s);
  const score = sessionScoreLine(s);
  const perlu = sessionNeedsAttention(s, now);
  return (
    <View style={[styles.sesiCard, attentionBorder(perlu)]}>
      {/* Titik merah = sesi INI yang menyalakan badge Fun Futsal: mau main ≤ 2
          hari lagi, atau sudah lewat tapi masih ada yang belum setor.
          Syaratnya dipanggil dari lib yang sama dengan angka badge-nya. */}
      {perlu && <AttentionMark corner />}
      <PressableScale style={styles.sesiMain} onPress={() => onOpen(s)}>
        <VixText heading="bold" additionalStyle={styles.sesiTanggal}>
          🗓️ {formatShortDayDate(dayIdToDate(s.dayId))} · {sessionTimeRange(s)}
        </VixText>
        <VixText heading="label" additionalStyle={styles.sesiVenue}>
          📍 {s.venue || 'Lapangan belum ditentukan'}
        </VixText>
        <View style={styles.pilRow}>
          <View style={styles.pil}>
            <VixText heading="label" additionalStyle={styles.pilText}>
              👥 {s.squad.length} main
            </VixText>
          </View>
          {belum > 0 ? (
            <View style={[styles.pil, styles.pilDue]}>
              <VixText heading="label" additionalStyle={styles.pilDueText}>
                💸 {belum} belum setor
              </VixText>
            </View>
          ) : s.squad.length > 0 ? (
            <View style={[styles.pil, styles.pilOk]}>
              <VixText heading="label" additionalStyle={styles.pilOkText}>
                ✅ Lunas semua
              </VixText>
            </View>
          ) : null}
          {score ? (
            <View style={[styles.pil, styles.pilSkor]}>
              <VixText heading="label" additionalStyle={styles.pilSkorText}>
                ⚽ {score}
              </VixText>
            </View>
          ) : null}
        </View>
      </PressableScale>
      {onEdit ? <EditButton onPress={() => onEdit(s)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sesiCard: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  sesiMain: { flex: 1, minWidth: 0, gap: 3 },
  sesiTanggal: { color: Color.TEXT_TITLE },
  sesiVenue: { color: Color.TEXT_LABEL },
  pilRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  pil: {
    borderRadius: 999,
    backgroundColor: Color.CONTRAST_CONTAINER,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pilText: { color: Color.TEXT_LABEL },
  pilDue: { backgroundColor: Color.DANGER_TRANSPARENT },
  pilDueText: { color: Color.DANGER },
  pilOk: { backgroundColor: Color.MAIN_TRANSPARENT },
  pilOkText: { color: Color.SUCCESS },
  pilSkor: { backgroundColor: Color.FRIENDS },
  pilSkorText: { color: Color.FRIENDS_DARK },
});
