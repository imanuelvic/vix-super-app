import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  subscribeCoreLeaders,
  subscribeVisitations,
  visitDaysUntil,
  type CoreLeader,
  type Visitation,
} from '@/lib/core';
import { formatFullDate } from '@/lib/format';

// Riwayat Visitasi 🕘 — seluruh jadwal visitasi CORE dari dulu sampai
// yang akan datang. Kelola/edit tetap lewat CORE → tab Visitasi.
export default function VisitationsScreen() {
  const { user } = useAuth();

  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError('Gagal memuat data. Cek koneksi internet.');
    const unsubs = [
      subscribeVisitations(user.uid, setVisitations, fail),
      subscribeCoreLeaders(user.uid, setLeaders, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const today = new Date();
  const sorted = [...(visitations ?? [])].sort(
    (a, b) => b.date.toMillis() - a.date.toMillis(),
  );
  const doneCount = sorted.filter((v) => v.done).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Riwayat Visitasi 🕘"
        subtitle={`${sorted.length} jadwal · ${doneCount} selesai`}
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {visitations === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Color.MAIN} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {sorted.length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada visitasi — jadwalkan lewat CORE → tab Visitasi 📅
            </VixText>
          )}
          {sorted.map((v) => {
            const cl = leaders.find((l) => l.id === v.leaderId);
            const days = visitDaysUntil(v, today);
            const status = v.done
              ? '✅ Selesai'
              : days === 0
                ? '📍 HARI INI!'
                : days > 0
                  ? `${days} hari lagi`
                  : '⚠️ Terlewat';
            return (
              <View key={v.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <VixText heading="bold" additionalStyle={styles.cardTitle}>
                    {cl ? `${cl.heart} ${cl.name}` : '(CL tidak ditemukan)'}
                  </VixText>
                  <VixText
                    heading="label"
                    additionalStyle={
                      v.done
                        ? styles.statusDone
                        : days < 0
                          ? styles.statusLate
                          : styles.statusUpcoming
                    }>
                    {status}
                  </VixText>
                </View>
                <VixText heading="label">
                  📆 {formatFullDate(v.date.toDate())}
                </VixText>
                {v.note ? (
                  <VixText heading="label">📝 {v.note}</VixText>
                ) : null}
              </View>
            );
          })}
          <VixText heading="label" additionalStyle={styles.hint}>
            Ubah / tandai selesai lewat CORE → tab Visitasi.
          </VixText>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  statusDone: { color: Color.SUCCESS },
  statusLate: { color: Color.WARNING },
  statusUpcoming: { color: Color.ACCENT_DARK },
  hint: { textAlign: 'center', marginTop: 8 },
});
