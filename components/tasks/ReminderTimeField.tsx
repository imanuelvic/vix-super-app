import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import { sameDay } from '@/lib/format';
import { groupEnabled, notifyAvailable, notifyEnabled } from '@/lib/notify';

// ⏰ Jam pengingat sebuah reminder (2 Okt 2026). Dipakai sheet tambah/edit
// dan sheet Reminder Berulang, jadi bentuk & kalimatnya sama di keduanya.
//
// Bawaannya TANPA jam: reminder biasa tetap ikut pengingat kelompok seperti
// dulu (ministry 08.30, work 09.30, sisanya 17.30). Baru kalau "Pakai Jam"
// dipilih, HP berbunyi sendiri tepat di jam itu (lib/notify.ts).
//
// Dua keadaan yang membuat jamnya TIDAK berbunyi disebut terus terang di
// bawah rodanya, bukan dibiarkan diam: jamnya sudah lewat hari ini, atau
// pengingat HP-nya sendiri belum menyala.
export function ReminderTimeField({
  on,
  onToggle,
  value,
  onChange,
  day,
  pickerKey,
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
  /** Jam yang dipilih (tanggalnya diabaikan, cuma jam-menitnya). */
  value: Date;
  onChange: (d: Date) => void;
  /** Tanggal reminder-nya — untuk tahu jamnya sudah lewat atau belum. */
  day?: Date;
  /** Kunci roda jam, supaya keadaannya ikut reset tiap reminder berganti. */
  pickerKey: string;
}) {
  const [mati, setMati] = useState(false);

  useEffect(() => {
    if (!on) return;
    let hidup = true;
    (async () => {
      const nyala =
        notifyAvailable() && (await notifyEnabled()) && (await groupEnabled('reminder'));
      if (hidup) setMati(!nyala);
    })();
    return () => {
      hidup = false;
    };
  }, [on]);

  const now = new Date();
  const lewat =
    on &&
    !!day &&
    sameDay(day, now) &&
    value.getHours() * 60 + value.getMinutes() <= now.getHours() * 60 + now.getMinutes();

  return (
    <>
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        ⏰ Jam Pengingat
      </VixText>
      <View style={styles.chipRow}>
        <Chip
          label="🔕 Tanpa Jam"
          active={!on}
          onPress={() => onToggle(false)}
          additionalStyle={styles.chipFlex}
        />
        <Chip
          label="⏰ Pakai Jam"
          active={on}
          onPress={() => onToggle(true)}
          additionalStyle={styles.chipFlex}
        />
      </View>
      {on && (
        <View style={styles.formGap}>
          <TimeField key={pickerKey} value={value} onChange={onChange} />
        </View>
      )}
      {lewat && (
        <VixText heading="label" additionalStyle={styles.hint}>
          ⌛ Jam ini sudah lewat, HP tidak berbunyi lagi hari ini.
        </VixText>
      )}
      {on && mati && (
        <VixText heading="label" additionalStyle={styles.hint}>
          🔕 Pengingat HP belum menyala. Nyalakan di System › Notification 📳.
        </VixText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chipFlex: { flex: 1 },
  formGap: { marginBottom: 10 },
  hint: { color: Color.WARNING, marginBottom: 10 },
});
