import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmojiButton } from '@/components/common/EmojiButton';
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
import { unsubscribeAll } from '@/lib/liveDoc';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';

// Arsip Ex CORE Leader 🗂️ — CL yang sudah tidak digembalakan lagi, beserta
// alasan & tanggalnya. Bisa dikembalikan jadi CL aktif atau dihapus permanen.
export default function ExLeadersScreen() {
  const { user } = useAuth();

  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [exLeaders, setExLeaders] = useState<ExLeader[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Ex CL yang tombol ✕-nya ditekan — dialog konfirmasi hapus permanen.
  const [confirmDelete, setConfirmDelete] = useState<ExLeader | null>(null);
  // Konfirmasi kembalikan jadi CL. Bukan aksi merusak, tapi sekali ditekan
  // orangnya langsung masuk lagi ke daftar gembalaan & jadwal follow up
  // mingguan — jadi jangan sampai kepencet tanpa sengaja.
  const [confirmRestore, setConfirmRestore] = useState<ExLeader | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeCoreLeaders(
        user.uid,
        (l) => {
          setLeaders(l);
          setError(null);
        },
        fail,
      ),
      subscribeExLeaders(user.uid, setExLeaders, fail),
    ]);
  }, [user]);

  const today = new Date();

  async function handleRestore() {
    if (!user || !leaders || !exLeaders || !confirmRestore || busyId) return;
    setBusyId(confirmRestore.id);
    try {
      await restoreCoreLeader(user.uid, leaders, exLeaders, confirmRestore.id);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setConfirmRestore(null);
      setBusyId(null);
    }
  }

  // Hapus PERMANEN dari arsip — dokumennya benar-benar hilang dari Firestore,
  // makanya harus lewat dialog konfirmasi dulu.
  async function handleDelete() {
    if (!user || !exLeaders || !confirmDelete || busyId) return;
    setBusyId(confirmDelete.id);
    try {
      await deleteExLeader(user.uid, exLeaders, confirmDelete.id);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setConfirmDelete(null);
      setBusyId(null);
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
                  {/* Hapus permanen ✕ — dipindah ke pojok kanan atas supaya
                      tidak memakan satu baris sendiri di bawah, dan tidak
                      bersaing dengan tombol kembalikan. Ditempel ke ATAS
                      (alignSelf) walau nama & tanggalnya jadi beberapa baris. */}
                  <View style={styles.deleteCorner}>
                    {/* Merah penuh, tidak ikut warna fitur: hapus PERMANEN
                        harus terbaca sama bahayanya di layar mana pun. */}
                    <EmojiButton
                      icon="xmark"
                      danger
                      onPress={() => setConfirmDelete(ex)}
                      busy={busyId === ex.id}
                      disabled={busyId !== null}
                    />
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
                  onPress={() => setConfirmRestore(ex)}>
                  <VixText heading="bold" additionalStyle={styles.restoreText}>
                    ↩️ Kembali jadi CORE Leader
                  </VixText>
                </PressableScale>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Konfirmasi hapus permanen — layar ini bukan modal, jadi dialog
          tengah aman dipakai (tidak ada modal bertumpuk). */}
      {/* Konfirmasi kembalikan jadi CL — bukan aksi merusak, jadi tombolnya
          bukan merah. Yang dicegah: kepencet tanpa sengaja lalu orangnya
          mendadak muncul lagi di jadwal follow up mingguan. */}
      <ConfirmDialog
        visible={confirmRestore !== null}
        title={`Kembalikan ${confirmRestore?.name ?? ''} jadi CORE Leader?`}
        detail={`${confirmRestore?.name ?? 'Dia'} akan masuk lagi ke daftar CORE Leader..`}
        confirmLabel="Ya, kembalikan"
        danger={false}
        busy={busyId !== null && busyId === confirmRestore?.id}
        onCancel={() => setConfirmRestore(null)}
        onConfirm={handleRestore}
      />

      <ConfirmDialog
        visible={confirmDelete !== null}
        title="Hapus permanen dari arsip?"
        detail={`Data ${confirmDelete?.name ?? ''} akan hilang selamanya.`}
        confirmLabel="Hapus permanen"
        busy={busyId !== null && busyId === confirmDelete?.id}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />
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
  // Kartu ex CL. Padding & jarak dilonggarkan (16→18 / 12→14) supaya kotak
  // "Alasan" di dalamnya tidak terasa menempel ke tepi kartu.
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 18,
    gap: 14,
    marginBottom: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heart: { fontSize: 30, lineHeight: 36 },
  info: { flex: 1, gap: 1 },
  name: { color: Color.TEXT_TITLE },
  metaLine: { color: Color.TEXT_LABEL },
  // Tombol ✕ menempel ke ATAS baris, bukan ikut ketengah bersama hati & nama.
  deleteCorner: { alignSelf: 'flex-start' },
  reasonBox: {
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    padding: 14,
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
