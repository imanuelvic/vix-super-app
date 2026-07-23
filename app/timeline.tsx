import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { MONTH_NAMES } from '@/lib/format';
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

// My Timeline 📍 — wishlist & target hidup per tahun: panggilan hidup,
// pekerjaan, pelayanan, dll. Item bisa nempel di bulan atau jadi target
// tahunan, dan dicentang kalau tercapai.
export default function TimelineScreen() {
  const { user } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [items, setItems] = useState<TimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<TimelineItem | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fCategory, setFCategory] = useState<TimelineCategoryKey>('future');
  const [fMonth, setFMonth] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setItems(null); // tampilkan loading saat ganti tahun
    const unsubscribe = subscribeTimelineYear(
      user.uid,
      year,
      (next) => {
        setItems(next);
        setError(null);
      },
      () => setError('Gagal memuat data. Cek koneksi internet.'),
    );
    return unsubscribe;
  }, [user, year]);

  const age = year - BIRTH_YEAR; // ulang tahun 1 Januari → pas per tahun
  const doneCount = items?.filter((i) => i.done).length ?? 0;
  const total = items?.length ?? 0;
  const isThisYear = year === now.getFullYear();

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
      setError('Gagal menyimpan. Coba lagi.');
    }
  }

  async function handleSave() {
    if (!user || !items || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Wishlist wajib diisi.');
      return;
    }
    setBusy(true);
    setFormError(null);
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
    try {
      await saveTimelineYear(user.uid, year, next);
      setEditing(null);
    } catch {
      setFormError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setBusy(false);
    }
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
        <Pressable style={styles.itemMain} onPress={() => handleToggle(item)}>
          <CheckCircle checked={item.done} size={22} />
          <VixText
            heading="paragraph"
            additionalStyle={[styles.itemText, item.done && styles.itemTextDone]}>
            {meta.icon} {item.title}
          </VixText>
        </Pressable>
        <Pressable onPress={() => openEdit(item)} hitSlop={10}>
          <IconSymbol name="pencil" size={16} color={Color.TEXT_PLACEHOLDER} />
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="My Timeline 📍"
        subtitle="Wishlist & panggilan hidupmu">
        {/* Navigasi tahun + umur */}
        <View style={styles.yearRow}>
          <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={10}>
            <IconSymbol name="chevron.left" size={20} color={Color.MAIN} />
          </Pressable>
          <VixText heading="bold" additionalStyle={styles.yearText}>
            {year}
          </VixText>
          <Pressable onPress={() => setYear((y) => y + 1)} hitSlop={10}>
            <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
          </Pressable>
          <View style={styles.ageChip}>
            <VixText heading="bold" additionalStyle={styles.ageText}>
              🎂 Umur {age}
            </VixText>
          </View>
        </View>
      </ScreenHeader>

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={Color.MAIN} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Progress tahun ini */}
          <View style={styles.progressCard}>
            <VixText heading="label" additionalStyle={styles.progressLabel}>
              Wishlist {year}
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.progressValue}>
              {doneCount}{' '}
              <VixText heading="label" additionalStyle={styles.progressLabel}>
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
            <VixText heading="label" additionalStyle={styles.progressLabel}>
              {total === 0
                ? 'Belum ada wishlist tahun ini — mulai isi impianmu ✨'
                : doneCount === total
                  ? 'Semua tercapai — luar biasa! 🎉'
                  : 'Kejar terus panggilanmu 💪'}
            </VixText>
          </View>

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

          {/* 12 bulan */}
          {MONTH_NAMES.map((name, m) => {
            const monthItems = items.filter((i) => i.month === m);
            const current = isThisYear && m === now.getMonth();
            return (
              <View
                key={name}
                style={[styles.monthCard, current && styles.monthCurrent]}>
                <View style={styles.monthHeader}>
                  <VixText heading="bold" additionalStyle={styles.monthTitle}>
                    {name}
                    {current && (
                      <VixText heading="label" additionalStyle={styles.nowText}>
                        {'  '}• bulan ini
                      </VixText>
                    )}
                  </VixText>
                  <Pressable onPress={() => openAdd(m)} hitSlop={10}>
                    <IconSymbol name="plus" size={18} color={Color.MAIN} />
                  </Pressable>
                </View>
                {monthItems.length === 0 ? (
                  <VixText heading="label" additionalStyle={styles.emptyMonth}>
                    —
                  </VixText>
                ) : (
                  monthItems.map(renderItem)
                )}
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

        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
        {editing !== 'new' && editing !== null && (
          <InlineDelete
            key={editing.id}
            label="Hapus wishlist ini"
            busy={busy}
            onDelete={handleDelete}
          />
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
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
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  progressCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    marginBottom: 12,
  },
  progressLabel: { color: Color.TEXT_ON_DARK_MUTED },
  progressValue: { color: Color.TEXT_REVERSE },
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
    alignItems: 'center',
  },
  monthTitle: { color: Color.TEXT_TITLE },
  nowText: { color: Color.MAIN },
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
