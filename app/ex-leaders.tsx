import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  currentAge,
  deleteExLeader,
  restoreCoreLeader,
  subscribeCoreLeaders,
  subscribeExLeaders,
  type CoreLeader,
  type ExLeader,
} from '@/lib/core';
import { dayIdToDate, formatShortDate, MONTH_NAMES } from '@/lib/format';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';

// Arsip Ex CORE Leader 🗂️ — CL yang sudah tidak digembalakan lagi, beserta
// alasan & tanggalnya. Bisa dikembalikan jadi CL aktif atau dihapus permanen.
export default function ExLeadersScreen() {
  const { user } = useAuth();

  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [exLeaders, setExLeaders] = useState<ExLeader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeCoreLeaders(
        user.uid,
        (l) => {
          setLeaders(l);
          setError(null);
        },
        fail,
      ),
      subscribeExLeaders(user.uid, setExLeaders, fail),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user]);

  const today = new Date();

  async function handleRestore(id: string) {
    if (!user || !leaders || !exLeaders || busyId) return;
    setBusyId(id);
    try {
      await restoreCoreLeader(user.uid, leaders, exLeaders, id);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!user || !exLeaders) return;
    try {
      await deleteExLeader(user.uid, exLeaders, id);
    } catch {
      setError(DELETE_ERROR);
    }
  }

  const loading = leaders === null || exLeaders === null;
  // Terbaru dilepas di atas.
  const list = exLeaders
    ? [...exLeaders].sort((a, b) => b.exDayId.localeCompare(a.exDayId))
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Ex CORE Leader 🗂️"
        subtitle="Yang sudah tidak kamu gembalakan"
      />

      <ScreenError message={error} />

      {loading ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {list.length === 0 ? (
            <View style={styles.emptyCard}>
              <VixText additionalStyle={styles.emptyEmoji}>🗂️</VixText>
              <VixText heading="title" additionalStyle={styles.emptyTitle}>
                Belum ada Ex CORE Leader
              </VixText>
              <VixText heading="label" additionalStyle={styles.emptyText}>
                Saat kamu tak lagi memegang seorang CORE Leader, tandai lewat
                “sudah tidak saya pegang” di Edit CORE Leader — mereka pindah ke
                sini beserta alasannya.
              </VixText>
            </View>
          ) : (
            list.map((ex) => (
              <View key={ex.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <VixText additionalStyle={styles.heart}>{ex.heart}</VixText>
                  <View style={styles.info}>
                    <VixText heading="bold" additionalStyle={styles.name}>
                      {ex.name}
                    </VixText>
                    <VixText heading="label">
                      {ex.birthDay} {MONTH_NAMES[ex.birthMonth]} {ex.birthYear} ·{' '}
                      {currentAge(ex, today)} th
                    </VixText>
                    <VixText heading="label" additionalStyle={styles.metaLine}>
                      🗓️ Dilepas {formatShortDate(dayIdToDate(ex.exDayId))}
                    </VixText>
                  </View>
                </View>

                <View style={styles.reasonBox}>
                  <VixText heading="label" additionalStyle={styles.reasonLabel}>
                    Alasan
                  </VixText>
                  <VixText heading="paragraph" additionalStyle={styles.reasonText}>
                    {ex.exReason || '—'}
                  </VixText>
                </View>

                <PressableScale
                  style={[styles.restoreBtn, busyId === ex.id && styles.busy]}
                  disabled={busyId === ex.id}
                  onPress={() => handleRestore(ex.id)}>
                  <VixText heading="bold" additionalStyle={styles.restoreText}>
                    ↩️ Pegang lagi (kembalikan jadi CORE Leader)
                  </VixText>
                </PressableScale>

                <InlineDelete
                  key={ex.id}
                  label="Hapus permanen dari arsip"
                  busy={busyId === ex.id}
                  onDelete={() => handleDelete(ex.id)}
                />
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  emptyCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyEmoji: { fontSize: 52, lineHeight: 64 },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center', color: Color.TEXT_LABEL },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heart: { fontSize: 30, lineHeight: 36 },
  info: { flex: 1, gap: 1 },
  name: { color: Color.TEXT_TITLE },
  metaLine: { color: Color.TEXT_LABEL },
  reasonBox: {
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
  reasonLabel: { color: Color.TEXT_LABEL },
  reasonText: { color: Color.TEXT_PARAGRAPH },
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderWidth: 1,
    borderColor: Color.MAIN,
  },
  restoreText: { color: Color.MAIN_DARK },
  busy: { opacity: 0.6 },
});
