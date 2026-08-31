import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { EditButton } from '@/components/common/EditButton';
import { EditFooter } from '@/components/common/EditFooter';
import { FormInput } from '@/components/common/FormInput';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { useKeyedData } from '@/hooks/useKeyedData';
import { MONTH_NAMES } from '@/lib/format';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  BIRTH_YEAR,
  newTimelineId,
  saveTimelineYear,
  subscribeTimelineYear,
  TIMELINE_CATEGORIES,
  TIMELINE_CATEGORY_META,
  type TimelineCategoryKey,
  type TimelineItem,
} from '@/lib/timeline';

// Tahun paling awal = tahun aplikasi dibuat (2026). Tidak ada data sebelumnya,
// jadi navigasi tahun mentok di sini (tidak bisa mundur ke 2025 dan sebelumnya).
const MIN_YEAR = 2026;

export default function TimelineScreen() {
  const { user } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  // items = null → loading. Kosong sendiri tiap ganti tahun (lihat useKeyedData).
  const { data: items, set: setItems } = useKeyedData<number, TimelineItem[]>(year);
  const [error, setError] = useState<string | null>(null);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<TimelineItem | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fCategory, setFCategory] = useState<TimelineCategoryKey>('future');
  const [fMonth, setFMonth] = useState<number | null>(null);
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  useEffect(() => {
    if (!user) return;
    return subscribeTimelineYear(
      user.uid,
      year,
      (next) => {
        setItems(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user, year, setItems]);

  const age = year - BIRTH_YEAR; // ulang tahun 1 Januari → pas per tahun
  const doneCount = items?.filter((i) => i.done).length ?? 0;
  const total = items?.length ?? 0;
  const isThisYear = year === now.getFullYear();
  const atMinYear = year <= MIN_YEAR; // mentok 2026 — tidak bisa ke kiri lagi

  // Semua bulan yang sudah lewat (tahun berjalan) digabung jadi SATU dropdown,
  // default tertutup — biar bulan ini & mendatang cepat terlihat.
  const [pastOpen, setPastOpen] = useState(false);
  const currentMonth = now.getMonth();
  const hasPast = isThisYear && currentMonth > 0;
  const pastCount = (items ?? []).filter(
    (i) => i.month !== null && i.month < currentMonth,
  ).length;

  function openAdd(month: number | null) {
    setEditing('new');
    setFTitle('');
    setFCategory('future');
    setFMonth(month);
    setFormError(null);
  }

  function openEdit(item: TimelineItem) {
    setEditing(item);
    setFTitle(item.title);
    setFCategory(item.category);
    setFMonth(item.month);
    setFormError(null);
  }

  async function handleToggle(item: TimelineItem) {
    if (!user || !items) return;
    setError(null);
    const next = items.map((i) =>
      i.id === item.id ? { ...i, done: !i.done } : i,
    );
    try {
      await saveTimelineYear(user.uid, year, next);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  async function handleSave() {
    if (!user || !items || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Wishlist wajib diisi.');
      return;
    }
    const data: TimelineItem = {
      id: editing === 'new' ? newTimelineId() : editing.id,
      title: fTitle.trim(),
      category: fCategory,
      month: fMonth,
      done: editing === 'new' ? false : editing.done,
    };
    const next =
      editing === 'new'
        ? [...items, data]
        : items.map((i) => (i.id === editing.id ? data : i));
    await save(async () => {
      await saveTimelineYear(user.uid, year, next);
      setEditing(null);
    });
  }

  async function handleDelete() {
    if (!user || !items || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveTimelineYear(
        user.uid,
        year,
        items.filter((i) => i.id !== editing.id),
      );
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  // Baris satu item wishlist (dipakai di target tahunan & bulanan).
  function renderItem(item: TimelineItem) {
    const meta = TIMELINE_CATEGORY_META[item.category];
    return (
      <View key={item.id} style={styles.itemRow}>
        <PressableScale style={styles.itemMain} onPress={() => handleToggle(item)}>
          <CheckCircle checked={item.done} size={22} />
          <VixText
            heading="paragraph"
            additionalStyle={[styles.itemText, item.done && styles.itemTextDone]}>
            {meta.icon} {item.title}
          </VixText>
        </PressableScale>
        <EditButton onPress={() => openEdit(item)} />
      </View>
    );
  }

  // Isi satu bulan: header (nama + kuartal + tombol +) lalu daftar wishlist.
  // Dipakai untuk kartu bulan individual & tiap bulan di dalam dropdown lewat.
  function renderMonthSection(m: number) {
    const monthItems = (items ?? []).filter((i) => i.month === m);
    const current = isThisYear && m === now.getMonth();
    const quarter = Math.floor(m / 3) + 1; // Q1–Q4
    return (
      <>
        <View style={styles.monthHeader}>
          <View style={styles.monthHeaderLeft}>
            <VixText heading="bold" additionalStyle={styles.monthTitle}>
              {MONTH_NAMES[m]}
            </VixText>
            <VixText heading="label" additionalStyle={styles.quarterText}>
              • Q{quarter}
            </VixText>
            {current && (
              <VixText heading="label" additionalStyle={styles.nowText}>
                • bulan ini
              </VixText>
            )}
          </View>
          <PressableScale onPress={() => openAdd(m)} hitSlop={10}>
            <IconSymbol name="plus" size={18} color={Color.MAIN} />
          </PressableScale>
        </View>
        {monthItems.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.emptyMonth}>
            —
          </VixText>
        ) : (
          monthItems.map(renderItem)
        )}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="My Timeline 📍"
        subtitle="Wishlist & panggilan hidupku">
        {/* Navigasi tahun + umur */}
        <View style={styles.yearRow}>
          <PressableScale
            onPress={() => setYear((y) => Math.max(MIN_YEAR, y - 1))}
            hitSlop={10}
            disabled={atMinYear}>
            <IconSymbol
              name="chevron.left"
              size={20}
              color={atMinYear ? Color.BORDER : Color.MAIN}
            />
          </PressableScale>
          {/* Tekan tahun → balik ke tahun berjalan */}
          <PressableScale onPress={() => setYear(now.getFullYear())} hitSlop={10}>
            <VixText heading="bold" additionalStyle={styles.yearText}>
              {year}
            </VixText>
          </PressableScale>
          <PressableScale onPress={() => setYear((y) => y + 1)} hitSlop={10}>
            <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
          </PressableScale>
          <View style={styles.ageChip}>
            <VixText heading="bold" additionalStyle={styles.ageText}>
              🎂 Umur {age}
            </VixText>
          </View>
        </View>
      </ScreenHeader>

      <ScreenError message={error} />

      {items === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Progress tahun ini */}
          <SummaryCard style={styles.progressCard}>
            <VixText heading="label" additionalStyle={summaryText.label}>
              Wishlist {year}
            </VixText>
            <VixText heading="subheader" additionalStyle={summaryText.value}>
              {doneCount}{' '}
              <VixText heading="label" additionalStyle={summaryText.label}>
                dari {total} tercapai
              </VixText>
            </VixText>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${total > 0 ? (doneCount / total) * 100 : 0}%` },
                ]}
              />
            </View>
            <VixText heading="label" additionalStyle={summaryText.label}>
              {total === 0
                ? 'Belum ada wishlist tahun ini — mulai isi impianmu ✨'
                : doneCount === total
                  ? 'Semua tercapai — luar biasa! 🎉'
                  : 'Kejar terus panggilanmu 💪'}
            </VixText>
          </SummaryCard>

          <PrimaryButton
            label="Tambah Wishlist"
            icon="plus"
            onPress={() => openAdd(null)}
            additionalStyle={styles.addButton}
          />

          {/* Target tahunan (tanpa bulan) */}
          <View style={styles.yearCard}>
            <VixText heading="title">🎯 Target Tahun {year}</VixText>
            {items.filter((i) => i.month === null).length === 0 ? (
              <VixText heading="label">Belum ada target tahunan.</VixText>
            ) : (
              items.filter((i) => i.month === null).map(renderItem)
            )}
          </View>

          {/* Bulan yang sudah lewat → SATU dropdown gabungan (tahun berjalan) */}
          {hasPast && (
            <View style={styles.monthCard}>
              {/* Tekan header untuk buka/tutup semua bulan lewat sekaligus */}
              <PressableScale
                style={styles.monthHeader}
                onPress={() => setPastOpen((o) => !o)}>
                <View style={styles.monthHeaderLeft}>
                  <VixText heading="bold" additionalStyle={styles.monthTitle}>
                    🕗 {MONTH_NAMES[0]} – {MONTH_NAMES[currentMonth - 1]}
                  </VixText>
                </View>
                <View style={styles.monthHeaderRight}>
                  {!pastOpen && pastCount > 0 && (
                    <View style={styles.countPill}>
                      <VixText
                        heading="label"
                        additionalStyle={styles.countPillText}>
                        {pastCount}
                      </VixText>
                    </View>
                  )}
                  <IconSymbol
                    name={pastOpen ? 'chevron.up' : 'chevron.down'}
                    size={16}
                    color={Color.TEXT_LABEL}
                  />
                </View>
              </PressableScale>
              {pastOpen && (
                <Animated.View
                  entering={FadeIn.duration(150)}
                  style={styles.monthBody}>
                  {Array.from({ length: currentMonth }, (_, m) => (
                    <View key={m} style={styles.pastMonthBlock}>
                      {renderMonthSection(m)}
                    </View>
                  ))}
                </Animated.View>
              )}
            </View>
          )}

          {/* Bulan ini & mendatang → kartu individual, selalu terbuka */}
          {MONTH_NAMES.map((name, m) => {
            if (isThisYear && m < currentMonth) return null; // sudah masuk dropdown
            const current = isThisYear && m === now.getMonth();
            return (
              <View
                key={name}
                style={[styles.monthCard, current && styles.monthCurrent]}>
                {renderMonthSection(m)}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Bottom sheet tambah/edit wishlist */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Wishlist' : 'Edit Wishlist'}
        onClose={() => setEditing(null)}>
        <FormInput
          style={styles.formGap}
          placeholder="Wishlist"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Kategori
        </VixText>
        <View style={styles.chipWrap}>
          {TIMELINE_CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              label={`${c.icon} ${c.label}`}
              active={fCategory === c.key}
              onPress={() => setFCategory(c.key)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Waktu
        </VixText>
        <View style={styles.chipWrap}>
          <Chip
            label="🎯 Tahunan"
            active={fMonth === null}
            onPress={() => setFMonth(null)}
          />
          {MONTH_NAMES.map((name, m) => (
            <Chip
              key={name}
              label={name.slice(0, 3)}
              active={fMonth === m}
              onPress={() => setFMonth(m)}
            />
          ))}
        </View>

        <ScreenError message={formError} />
        <EditFooter
          editing={editing}
          deleteLabel="Hapus wishlist ini"
          busy={busy}
          onDelete={handleDelete}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
  },
  yearText: { minWidth: 60, textAlign: 'center' },
  ageChip: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  ageText: { color: Color.ACCENT_DARK },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  // Bentuk & warna kartunya dari <SummaryCard>; di sini cuma selisihnya.
  progressCard: { gap: 6, marginBottom: 12 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.MAIN,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Color.MAIN_LIGHT,
  },
  addButton: { marginBottom: 12 },
  yearCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  monthCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  monthCurrent: {
    borderColor: Color.MAIN,
    borderWidth: 1.5,
    backgroundColor: Color.MAIN_TRANSPARENT,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  monthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthTitle: { color: Color.TEXT_TITLE },
  quarterText: { color: Color.TEXT_LABEL },
  nowText: { color: Color.MAIN },
  countPill: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countPillText: { color: Color.MAIN_DARK },
  monthBody: { gap: 6, marginTop: 6 },
  // Tiap bulan lewat di dalam dropdown gabungan, dipisah garis tipis.
  pastMonthBlock: {
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    paddingTop: 8,
    gap: 6,
  },
  emptyMonth: { color: Color.TEXT_PLACEHOLDER },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  itemTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
});
