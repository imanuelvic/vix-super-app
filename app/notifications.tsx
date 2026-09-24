import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CONTENT_COLUMN } from '@/assets/style/layout';
import { Chip } from '@/components/common/Chip';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import {
  groupEnabled,
  notifyAvailable,
  notifyEnabled,
  NOTIFY_GROUPS,
  setGroupEnabled,
  setNotifyEnabled,
  type NotifyGroup,
  type NotifyStatus,
} from '@/lib/notify';
import { jamPengingat, sudahBelajar, type Jam } from '@/lib/notifyTiming';

// 📳 Pengingat di HP — satu layar untuk SELURUH notifikasi lokal app ini.
//
// Isinya bukan pengaturan baru: tiap kelompok memakai perhitungan yang sudah
// dipakai layar Today (lib/today.ts), jadi yang berbunyi di lock screen persis
// yang menunggu di dalam app. Yang bisa diatur di sini cuma: mau dibunyikan
// atau tidak.
export default function NotificationsScreen() {
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState<NotifyStatus | null>(null);
  const [groups, setGroups] = useState<Record<string, boolean>>({});
  // Jam yang sudah dipelajari dari kebiasaan (kosong = masih jam bawaan).
  const [jam, setJam] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const tersedia = notifyAvailable();

  useEffect(() => {
    let hidup = true;
    (async () => {
      const master = await notifyEnabled();
      const pasangan = await Promise.all(
        NOTIFY_GROUPS.map(async (g) => [g.key, await groupEnabled(g.key)] as const),
      );
      const belajar = await Promise.all(
        NOTIFY_GROUPS.map(
          async (g) =>
            [g.key, (await sudahBelajar(g.key)) ? await jamPengingat(g.key) : null] as const,
        ),
      );
      if (!hidup) return;
      setOn(master);
      setGroups(Object.fromEntries(pasangan));
      setJam(
        Object.fromEntries(
          belajar
            .filter((p): p is [NotifyGroup, Jam] => p[1] !== null)
            .map(([k, j]) => [k, `${j.hour}.${String(j.minute).padStart(2, '0')}`]),
        ),
      );
    })();
    return () => {
      hidup = false;
    };
  }, []);

  async function ubahMaster(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const s = await setNotifyEnabled(next);
      setStatus(s);
      setOn(s === 'ok' ? next : false);
    } finally {
      setBusy(false);
    }
  }

  async function ubahGrup(key: NotifyGroup, next: boolean) {
    setGroups((g) => ({ ...g, [key]: next }));
    await setGroupEnabled(key, next);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Pita berwarna tile System di grid Life (grafit), sama dengan layar
          yang membukanya. */}
      <ScreenHeader
        backLabel="Kembali"
        title="Notification 📳"
        subtitle="Satu tempat untuk semua pengingat di HP"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <View style={styles.masterCard}>
            <View style={styles.masterMain}>
              <VixText heading="bold" additionalStyle={styles.masterTitle}>
                Semua pengingat
              </VixText>
              <VixText heading="label">
                {tersedia
                  ? 'Nyalakan sekali; sisanya app yang urus.'
                  : 'Butuh build app baru (expo-notifications belum ada di build ini).'}
              </VixText>
              {status === 'denied' && (
                <VixText heading="label" additionalStyle={styles.warn}>
                  Izin notifikasi ditolak. Nyalakan di Pengaturan iPhone › vix › Notifikasi.
                </VixText>
              )}
            </View>
            <Chip
              label={on ? 'Aktif' : 'Nonaktif'}
              active={on}
              onPress={() => ubahMaster(!on)}
              additionalStyle={!tersedia || busy ? styles.off : undefined}
            />
          </View>

          {NOTIFY_GROUPS.map((g) => (
            <View key={g.key} style={styles.row}>
              <View style={styles.rowMain}>
                <VixText heading="bold" additionalStyle={styles.rowTitle}>
                  {g.emoji} {g.label}
                </VixText>
                <VixText heading="label">
                  {jam[g.key] ? `Jam ${jam[g.key]}, mengikuti kebiasaanmu` : g.when}
                </VixText>
                {/* Ke mana notifikasinya mendarat kalau di-click. */}
                <VixText heading="label" additionalStyle={styles.opens}>
                  Click → {g.opens}
                </VixText>
              </View>
              <Chip
                label={groups[g.key] === false ? 'Mati' : 'Nyala'}
                active={groups[g.key] !== false}
                onPress={() => ubahGrup(g.key, groups[g.key] === false)}
                additionalStyle={!on ? styles.off : undefined}
              />
            </View>
          ))}

          <VixText heading="label" additionalStyle={styles.note}>
            Kelompok yang hari itu tidak punya isi tidak dibunyikan sama sekali, dan angka di ikon
            app mengikuti jumlah baris hari ini di Today. Kalimatnya berganti tiap hari, dan
            jamnya ikut menyesuaikan jam kamu biasa menyelesaikannya.
          </VixText>
          <VixText heading="label" additionalStyle={styles.note}>
            Notifikasi yang menyebut SATU hal membuka layar hal itu persis, lengkap dengan sub-tab
            dan isian yang menunggu. Yang menyebut beberapa hal sekaligus membuka layar induknya.
          </VixText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingBottom: 32, alignItems: 'center' },
  inner: { ...CONTENT_COLUMN, paddingHorizontal: 20, gap: 8 },
  masterCard: { ...CARD, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  masterMain: { flex: 1, gap: 2 },
  masterTitle: { color: Color.MAIN_DARK },
  row: { ...CARD, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: Color.TEXT_TITLE },
  opens: { color: Color.DEVICE_DEEP },
  warn: { color: Color.WARNING },
  off: { opacity: 0.45 },
  note: { marginTop: 4 },
});
