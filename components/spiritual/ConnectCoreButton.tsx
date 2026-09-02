import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { FormError } from '@/components/common/FormError';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  meetingKindMeta,
  meetingLeaderNames,
  subscribeCoreLeaders,
  subscribeMonthlyMeetings,
  subscribeVisitations,
  type CoreLeader,
  type MonthlyMeeting,
  type Visitation,
} from '@/lib/core';
import {
  isNoteLinked,
  saveCoreNoteLinks,
  subscribeCoreNoteLinks,
  toggleNoteLink,
  type CoreNoteLinks,
  type NoteKind,
} from '@/lib/coreNotes';
import { formatFullDate } from '@/lib/format';
import { unsubscribeAll } from '@/lib/liveDoc';
import { SAVE_ERROR } from '@/lib/messages';

// Tombol 🔗 Connect ke CORE di layar Catatan Revive 📖 & Catatan Khotbah ⛪.
//
// Gunanya: bahan yang kamu dapat hari ini ditempelkan ke acara CORE yang
// AKAN datang — visitasi atau rapat bulanan — supaya nanti saat membuka
// acaranya, bahannya sudah menunggu di sana. Tidak ada isi yang disalin: yang
// disimpan cuma penunjuknya (lihat lib/coreNotes.ts).
//
// Yang bisa dipilih SENGAJA cuma yang belum lewat. Menyambungkan bahan ke acara
// yang sudah selesai tidak ada gunanya — bahannya tidak akan terbawa ke mana-mana.
export function ConnectCoreButton({
  kind,
  noteId,
  title,
}: {
  kind: NoteKind;
  /** dayId catatannya. */
  noteId: string;
  /** Judul catatannya — ikut disimpan supaya daftarnya bisa langsung tampil. */
  title: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<CoreNoteLinks | null>(null);
  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [meetings, setMeetings] = useState<MonthlyMeeting[] | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Dilanggan HANYA selagi modalnya terbuka — pola yang sama dengan arsip
  // rangkuman di Learning. Layar catatan tidak perlu tahu apa-apa soal CORE
  // sampai tombolnya benar-benar ditekan, jadi tidak ada baca Firestore
  // tambahan untuk yang cuma membaca catatannya.
  useEffect(() => {
    if (!user || !open) return;
    return unsubscribeAll([
      subscribeCoreNoteLinks(user.uid, setLinks),
      subscribeVisitations(user.uid, setVisitations),
      subscribeMonthlyMeetings(user.uid, setMeetings),
      subscribeCoreLeaders(user.uid, setLeaders),
    ]);
  }, [user, open]);

  const now = new Date();
  const awalHariIni = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  // "Belum lewat" = harinya hari ini atau sesudahnya, dan (untuk visitasi)
  // belum ditandai selesai. Terdekat dulu — yang paling mungkin dituju.
  const pilihan = [
    ...(visitations ?? [])
      .filter((v) => !v.done && v.date.toDate().getTime() >= awalHariIni)
      .map((v) => ({
        id: v.id,
        waktu: v.date.toDate(),
        emoji: meetingKindMeta(v.kind).icon,
        judul: meetingLeaderNames(v, leaders) || meetingKindMeta(v.kind).label,
        sub: `${meetingKindMeta(v.kind).label} · Visitation`,
      })),
    ...(meetings ?? [])
      .filter((m) => m.date.toDate().getTime() >= awalHariIni)
      .map((m) => ({
        id: m.id,
        waktu: m.date.toDate(),
        emoji: '🗒️',
        judul: m.title,
        sub: 'Monthly',
      })),
  ].sort((a, b) => a.waktu.getTime() - b.waktu.getTime());

  const memuat = links === null || visitations === null || meetings === null;
  const tersambung = links
    ? pilihan.filter((p) => isNoteLinked(links, p.id, kind, noteId)).length
    : 0;

  async function toggle(coreId: string) {
    if (!user || !links) return;
    setError(null);
    try {
      await saveCoreNoteLinks(
        user.uid,
        toggleNoteLink(links, coreId, { kind, noteId, title }),
      );
    } catch {
      setError(SAVE_ERROR);
    }
  }

  return (
    <>
      <PressableScale style={styles.button} onPress={() => setOpen(true)}>
        <VixText heading="bold" additionalStyle={styles.buttonText}>
          🔗 Connect ke CORE
        </VixText>
      </PressableScale>

      <SheetModal
        visible={open}
        title="🔗 Connect ke CORE"
        subtitle="Pilih acara yang akan memakai bahan ini"
        onClose={() => setOpen(false)}>
        <FormError message={error} />
        {memuat ? (
          <LoadingCenter />
        ) : pilihan.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada Visitation atau Monthly yang akan datang. Jadwalkan dulu
            di fitur CORE 🙏
          </VixText>
        ) : (
          pilihan.map((p) => {
            const dipilih = isNoteLinked(links!, p.id, kind, noteId);
            return (
              <PressableScale
                key={p.id}
                style={[styles.row, dipilih && styles.rowOn]}
                onPress={() => toggle(p.id)}
                haptic={dipilih ? 'light' : 'success'}>
                <CheckCircle checked={dipilih} />
                <View style={styles.rowMain}>
                  <VixText heading="bold">
                    {p.emoji} {p.judul}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.rowSub}>
                    {p.sub} · {formatFullDate(p.waktu)}
                  </VixText>
                </View>
              </PressableScale>
            );
          })
        )}
        {!memuat && tersambung > 0 && (
          <VixText heading="label" additionalStyle={styles.foot}>
            🔗 Tersambung ke {tersambung} acara. Buka acaranya di CORE — tombol
            🔗-nya membuka catatan ini.
          </VixText>
        )}
      </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Color.FINANCE_INVESTMENT,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Color.FINANCE_INVESTMENT_DARK,
    paddingVertical: 12,
    alignItems: 'center',
    // Tanpa marginTop sendiri — jaraknya dipegang <ActionStack/> di layar yang
    // memakainya (Catatan Revive & Catatan Khotbah), sama seperti tombol lain
    // di tumpukan yang sama.
  },
  buttonText: { color: Color.FINANCE_INVESTMENT_DARK },
  row: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rowOn: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  rowMain: { flex: 1, gap: 2 },
  rowSub: { color: Color.TEXT_LABEL },
  empty: { textAlign: 'center', marginVertical: 10 },
  foot: { color: Color.TEXT_LABEL, marginTop: 4 },
});
