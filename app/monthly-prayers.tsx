import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  EMPTY_MONTHLY_PRAYERS,
  isCurrentMonthPrayers,
  monthDocId,
  MONTHLY_PRAYER_QUESTION,
  saveMonthlyPrayers,
  subscribeCoreLeaders,
  subscribeMonthlyPrayers,
  type CoreLeader,
  type MonthlyPrayers,
} from '@/lib/core';
import { dayIdToDate, formatShortDate, MONTH_NAMES } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';

// Pokok Doa Bulanan 🙏 — kumpulkan pergumulan tiap CORE Leader untuk bulan ini.
// Pokok doa inilah yang menentukan follow up berkala (Sel/Kam/Sab). Poin TIDAK
// dihapus otomatis saat bulan berganti — tetap tersimpan & tampil untuk ditinjau;
// saat bulan baru muncul pengingat memperbaruinya. Tiap kartu bisa dibuka/tutup
// (default tertutup kalau sudah ada poin).
export default function MonthlyPrayersScreen() {
  const { user } = useAuth();

  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [data, setData] = useState<MonthlyPrayers>(EMPTY_MONTHLY_PRAYERS);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Kartu mana yang sedang dibuka — HANYA satu sekaligus (accordion): membuka
  // satu otomatis menutup yang lain. null = tidak ada yang dibuka.
  const [openLeaderId, setOpenLeaderId] = useState<string | null>(null);
  // Konfirmasi hapus 1 pokok doa.
  const [confirmDelete, setConfirmDelete] = useState<{
    leaderId: string;
    idx: number;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeCoreLeaders(
        user.uid,
        (next) => {
          setLeaders(next);
          setError(null);
        },
        fail,
      ),
      subscribeMonthlyPrayers(user.uid, setData, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const now = new Date();
  const monthTitle = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  // Poin SELALU ditampilkan — tidak disembunyikan/dihapus saat bulan berganti.
  const points = data.points;
  const filledCount = (leaders ?? []).filter(
    (l) => (points[l.id]?.length ?? 0) > 0,
  ).length;
  // "Bulan baru": ada poin dari bulan lalu yang belum ditinjau untuk bulan ini.
  const stale = filledCount > 0 && !isCurrentMonthPrayers(data, now);

  // Tulis ulang dokumen dengan monthId bulan ini. Kalau dokumen sebelumnya milik
  // bulan lain, followedDayId ikut direset (mulai bersih untuk bulan baru).
  // changedLeaderId = leader yang poinnya baru diubah → dicap tanggal update-nya.
  async function persist(
    nextPoints: Record<string, string[]>,
    changedLeaderId?: string,
  ) {
    if (!user) return;
    const today = new Date();
    const monthId = monthDocId(today);
    const followedDayId = isCurrentMonthPrayers(data, today)
      ? data.followedDayId
      : {};
    const updatedAt = { ...data.updatedAt };
    if (changedLeaderId) updatedAt[changedLeaderId] = dayDocId(today);
    try {
      await saveMonthlyPrayers(user.uid, {
        monthId,
        points: nextPoints,
        followedDayId,
        updatedAt,
      });
    } catch {
      setError(SAVE_ERROR);
    }
  }

  function addPoint(leaderId: string) {
    const text = (drafts[leaderId] ?? '').trim();
    if (!text) return;
    const next = {
      ...points,
      [leaderId]: [...(points[leaderId] ?? []), text],
    };
    setDrafts((d) => ({ ...d, [leaderId]: '' }));
    persist(next, leaderId);
  }

  function removePoint(leaderId: string, idx: number) {
    const arr = (points[leaderId] ?? []).filter((_, i) => i !== idx);
    const next = { ...points };
    if (arr.length) next[leaderId] = arr;
    else delete next[leaderId];
    persist(next, leaderId);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Pokok Doa Bulanan 🙏"
        subtitle={monthTitle}
      />

      <ScreenError message={error} />

      {leaders === null ? (
        <LoadingCenter />
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={styles.content}>
          {/* Intro: pertanyaan pembuka + info reset + progres pengisian */}
          <View style={styles.introCard}>
            <VixText heading="label" additionalStyle={styles.introQuote}>
              “{MONTHLY_PRAYER_QUESTION}”
            </VixText>
            <VixText heading="bold" additionalStyle={styles.introValue}>
              {filledCount}
              <VixText heading="label" additionalStyle={styles.introLabel}>
                {' '}
                dari {leaders.length} CORE Leader sudah terisi
              </VixText>
            </VixText>
          </View>

          {/* Bulan baru: poin masih dari bulan lalu → ajak tinjau/perbarui */}
          {stale && (
            <View style={styles.staleCard}>
              <VixText heading="bold" additionalStyle={styles.staleText}>
                🔄 Sudah masuk {monthTitle}
              </VixText>
              <VixText heading="label" additionalStyle={styles.staleSub}>
                Pokok doa di bawah masih dari bulan lalu — tinjau & perbarui bila
                perlu. Yang lama tidak dihapus otomatis.
              </VixText>
            </View>
          )}

          {leaders.map((l) => {
            const list = points[l.id] ?? [];
            const hasPoints = list.length > 0;
            // Punya poin → default TERTUTUP (minimize). Kosong → selalu terbuka
            // biar gampang langsung mengisi.
            const open = hasPoints ? openLeaderId === l.id : true;
            const updatedId = data.updatedAt[l.id];
            const updatedLabel =
              hasPoints && updatedId
                ? `🕒 Diperbarui ${formatShortDate(dayIdToDate(updatedId))}`
                : null;
            return (
              <View key={l.id} style={styles.card}>
                <PressableScale
                  style={styles.cardHeader}
                  disabled={!hasPoints}
                  onPress={() =>
                    setOpenLeaderId((cur) => (cur === l.id ? null : l.id))
                  }>
                  <View style={styles.avatar}>
                    <VixText heading="title">{l.heart}</VixText>
                  </View>
                  <View style={styles.headerText}>
                    <VixText heading="bold" additionalStyle={styles.name}>
                      {l.name}
                    </VixText>
                    {updatedLabel && (
                      <VixText
                        heading="label"
                        additionalStyle={styles.updatedText}>
                        {updatedLabel}
                      </VixText>
                    )}
                  </View>
                  {hasPoints && (
                    <View style={styles.countBadge}>
                      <VixText
                        heading="label"
                        additionalStyle={styles.countBadgeText}>
                        {list.length} poin
                      </VixText>
                    </View>
                  )}
                  {hasPoints && (
                    <VixText heading="label" additionalStyle={styles.chevron}>
                      {open ? '▴' : '▾'}
                    </VixText>
                  )}
                </PressableScale>

                {open && (
                  <>
                    {hasPoints ? (
                      list.map((p, i) => (
                        <View key={`${p}-${i}`} style={styles.pointRow}>
                          <VixText
                            heading="paragraph"
                            additionalStyle={styles.pointText}>
                            🙏 {p}
                          </VixText>
                          <PressableScale
                            onPress={() =>
                              setConfirmDelete({ leaderId: l.id, idx: i })
                            }
                            hitSlop={8}>
                            <VixText
                              heading="label"
                              additionalStyle={styles.removeText}>
                              ✕
                            </VixText>
                          </PressableScale>
                        </View>
                      ))
                    ) : (
                      <VixText
                        heading="label"
                        additionalStyle={styles.emptyPoint}>
                        Belum ada pokok doa — tambahkan di bawah 👇
                      </VixText>
                    )}

                    {/* Tambah pokok doa baru */}
                    <View style={styles.addRow}>
                      <FormInput
                        style={styles.addInput}
                        placeholder="Tambah pokok doa…"
                        value={drafts[l.id] ?? ''}
                        onChangeText={(t) =>
                          setDrafts((d) => ({ ...d, [l.id]: t }))
                        }
                        onSubmitEditing={() => addPoint(l.id)}
                        returnKeyType="done"
                      />
                      <PressableScale
                        style={styles.addButton}
                        onPress={() => addPoint(l.id)}>
                        <VixText
                          heading="bold"
                          additionalStyle={styles.addButtonText}>
                          ＋
                        </VixText>
                      </PressableScale>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </KeyboardAwareScrollView>
      )}

      {/* Konfirmasi sebelum menghapus 1 pokok doa */}
      <ConfirmDialog
        visible={!!confirmDelete}
        title="Hapus pokok doa ini?"
        detail={
          confirmDelete
            ? points[confirmDelete.leaderId]?.[confirmDelete.idx]
            : undefined
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) removePoint(confirmDelete.leaderId, confirmDelete.idx);
          setConfirmDelete(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  introCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    marginBottom: 14,
  },
  introQuote: { color: Color.MAIN_LIGHT, fontStyle: 'italic' },
  introValue: { color: Color.TEXT_REVERSE },
  introLabel: { color: Color.TEXT_ON_DARK_MUTED },
  staleCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    marginBottom: 12,
  },
  staleText: { color: Color.ACCENT_DARK },
  staleSub: { color: Color.ACCENT_DARK },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Color.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 1 },
  name: { color: Color.TEXT_TITLE },
  updatedText: { color: Color.TEXT_LABEL },
  countBadge: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: { color: Color.MAIN_DARK },
  chevron: { color: Color.TEXT_LABEL },
  emptyPoint: { color: Color.TEXT_PLACEHOLDER },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Color.BACKGROUND,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pointText: { flex: 1, color: Color.TEXT_TITLE },
  removeText: { color: Color.TEXT_PLACEHOLDER },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  addInput: { flex: 1 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: Color.TEXT_REVERSE, fontSize: 20, lineHeight: 24 },
});
