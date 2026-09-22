import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { VixText } from '@/components/common/VixText';
import {
  financeNotifyEnabled,
  NOTIFY_EVENING,
  NOTIFY_MORNING,
  notifyAvailable,
  setFinanceNotifyEnabled,
  type NotifyStatus,
} from '@/lib/financeNotify';

// 🔔 Sakelar pengingat harian Finance (notifikasi lokal HP, lihat
// lib/financeNotify.ts). Isinya tanpa nominal. Di build yang belum memuat
// expo-notifications, kartunya jujur bilang butuh build baru.
export function NotifyCard() {
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState<NotifyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const tersedia = notifyAvailable();

  useEffect(() => {
    let hidup = true;
    financeNotifyEnabled().then((v) => {
      if (hidup) setOn(v);
    });
    return () => {
      hidup = false;
    };
  }, []);

  async function ubah(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const s = await setFinanceNotifyEnabled(next);
      setStatus(s);
      setOn(s === 'ok' ? next : false);
    } finally {
      setBusy(false);
    }
  }

  const jam = (t: { hour: number; minute: number }) =>
    `${String(t.hour).padStart(2, '0')}.${String(t.minute).padStart(2, '0')}`;

  return (
    <View style={styles.card}>
      <View style={styles.main}>
        <VixText heading="bold" additionalStyle={styles.title}>
          🔔 Pengingat harian di HP
        </VixText>
        <VixText heading="label">
          Pagi {jam(NOTIFY_MORNING)} status jatah hari ini · malam {jam(NOTIFY_EVENING)} catat
          pengeluaran. Tanpa nominal.
        </VixText>
        {!tersedia && (
          <VixText heading="label" additionalStyle={styles.warn}>
            Butuh build app baru (expo-notifications belum ada di build ini).
          </VixText>
        )}
        {status === 'denied' && (
          <VixText heading="label" additionalStyle={styles.warn}>
            Izin notifikasi ditolak. Nyalakan di Pengaturan iPhone › vix › Notifikasi.
          </VixText>
        )}
      </View>
      <Chip
        label={on ? 'Aktif' : 'Nonaktif'}
        active={on}
        onPress={() => ubah(!on)}
        additionalStyle={!tersedia || busy ? styles.off : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: CARD_GAP,
  },
  main: { flex: 1, gap: 2 },
  title: { color: Color.TEXT_TITLE },
  warn: { color: Color.WARNING },
  off: { opacity: 0.45 },
});
