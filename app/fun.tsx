import { Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { formatShortDayDate } from '@/lib/format';
import {
  EMPTY_FUN,
  funCategoryMeta,
  newFunId,
  saveFun,
  subscribeFun,
  type FunCategory,
  type FunData,
  type FunEntry,
} from '@/lib/fun';

// Tab bawah = kategori arsip. Ikon SF dipetakan di icon-symbol.tsx.
const FUN_TABS: BottomTab<FunCategory>[] = [
  { key: 'summit', label: 'Summit', icon: 'mountain.2.fill' },
  { key: 'race', label: 'Race', icon: 'figure.run' },
  { key: 'reflection', label: 'Refleksi', icon: 'figure.mind.and.body' },
  { key: 'recreation', label: 'Rekreasi', icon: 'beach.umbrella.fill' },
];

// Fitur Fun & Recreation 🎉 — arsip Summit, Race, tempat Refleksi & Rekreasi
// yang sudah dikunjungi. Satu form (SheetModal) dipakai untuk tambah & edit.
export default function FunScreen() {
  const { user } = useAuth();

  // Hook bersama: ganti kategori + scroll ke atas tiap tab ditekan.
  const { tab: category, scrollKey, onTabPress } = useTabScroll<FunCategory>('summit');
  const [data, setData] = useState<FunData>(EMPTY_FUN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form tambah/edit — editingId null = mode tambah.
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [detail, setDetail] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Konfirmasi hapus.
  const [confirmDelete, setConfirmDelete] = useState<FunEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = subscribeFun(
      user.uid,
      (next) => {
        setData(next);
        setError(null);
        setLoading(false);
      },
      () => {
        setError('Gagal memuat data. Cek koneksi internet.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user]);

  const meta = funCategoryMeta(category);

  // Entri kategori terpilih, terbaru di atas.
  const entries = useMemo(
    () =>
      data.entries
        .filter((e) => e.category === category)
        .sort((a, b) => (b.date?.toMillis() ?? 0) - (a.date?.toMillis() ?? 0)),
    [data.entries, category],
  );

  function openAdd() {
    setEditingId(null);
    setTitle('');
    setPlace('');
    setDetail('');
    setNote('');
    setDate(new Date());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(entry: FunEntry) {
    setEditingId(entry.id);
    setTitle(entry.title);
    setPlace(entry.place);
    setDetail(entry.detail);
    setNote(entry.note);
    setDate(entry.date ? entry.date.toDate() : new Date());
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!user || saving) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError(`Isi ${meta.titleLabel.toLowerCase()} dulu.`);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const entry: FunEntry = {
        id: editingId ?? newFunId(),
        category,
        title: trimmed,
        place: place.trim(),
        detail: detail.trim(),
        note: note.trim(),
        date: Timestamp.fromDate(date),
      };
      const nextEntries = editingId
        ? data.entries.map((e) => (e.id === editingId ? entry : e))
        : [...data.entries, entry];
      await saveFun(user.uid, { entries: nextEntries });
      setFormOpen(false);
    } catch {
      setFormError('Gagal menyimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!user || !confirmDelete || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const nextEntries = data.entries.filter((e) => e.id !== confirmDelete.id);
      await saveFun(user.uid, { entries: nextEntries });
    } catch {
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setConfirmDelete(null);
      setDeleteBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Fun & Recreation 🎉"
        subtitle="Arsip petualangan & tempat yang sudah dikunjungi"
      />

      <View style={styles.content} key={scrollKey}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Color.MAIN} />
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            persistentScrollbar
            indicatorStyle="black"
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <PrimaryButton
                  label={`Tambah ${meta.label}`}
                  icon="plus"
                  background={meta.fg}
                  onPress={openAdd}
                />
                {error && (
                  <VixText heading="label" additionalStyle={styles.error}>
                    {error}
                  </VixText>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <VixText heading="label" additionalStyle={styles.emptyText}>
                  Belum ada {meta.label} yang tercatat. Tambahkan di atas 👆
                </VixText>
              </View>
            }
            renderItem={({ item }) => (
              // Tekan kartu untuk mengedit. Border mengikuti warna kategori.
              <PressableScale
                style={[styles.card, { borderColor: meta.fg }]}
                onPress={() => openEdit(item)}>
                <View style={styles.cardTop}>
                  <VixText heading="title">{meta.emoji}</VixText>
                  <View style={styles.cardMain}>
                    <VixText
                      heading="bold"
                      numberOfLines={1}
                      additionalStyle={styles.cardTitle}>
                      {item.title}
                    </VixText>
                    <VixText heading="label" numberOfLines={1}>
                      {[
                        item.place,
                        item.date
                          ? formatShortDayDate(item.date.toDate())
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </VixText>
                  </View>
                  <PressableScale
                    onPress={() => setConfirmDelete(item)}
                    hitSlop={10}>
                    <IconSymbol
                      name="xmark"
                      size={16}
                      color={Color.TEXT_PLACEHOLDER}
                    />
                  </PressableScale>
                </View>
                {item.detail ? (
                  <VixText
                    heading="label"
                    additionalStyle={[styles.cardDetail, { color: meta.fg }]}>
                    {item.detail}
                  </VixText>
                ) : null}
                {item.note ? (
                  <VixText heading="label" additionalStyle={styles.cardNote}>
                    {item.note}
                  </VixText>
                ) : null}
              </PressableScale>
            )}
          />
        )}
      </View>

      {/* Tab bar bawah = kategori arsip */}
      <BottomTabs tabs={FUN_TABS} value={category} onChange={onTabPress} />

      {/* Sheet tambah/edit */}
      <SheetModal
        visible={formOpen}
        title={editingId ? `Edit ${meta.label}` : `Tambah ${meta.label}`}
        subtitle={`${meta.emoji} ${meta.label}`}
        onClose={() => setFormOpen(false)}>
        <FormInput
          placeholder={meta.titleLabel}
          value={title}
          onChangeText={setTitle}
          editable={!saving}
          autoFocus
        />
        <FormInput
          style={styles.inputGap}
          placeholder="Lokasi (opsional)"
          value={place}
          onChangeText={setPlace}
          editable={!saving}
        />
        <FormInput
          style={styles.inputGap}
          placeholder={meta.detailLabel}
          value={detail}
          onChangeText={setDetail}
          editable={!saving}
        />
        <View style={styles.inputGap}>
          <DateField key={editingId ?? 'new'} value={date} onChange={setDate} />
        </View>
        <FormInput
          style={styles.inputGap}
          placeholder="Catatan (opsional)"
          value={note}
          onChangeText={setNote}
          editable={!saving}
        />
        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={saving}
          onCancel={() => setFormOpen(false)}
          onConfirm={handleSave}
        />
      </SheetModal>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        visible={!!confirmDelete}
        title={`Hapus ${meta.label} ini?`}
        detail={confirmDelete ? confirmDelete.title : undefined}
        busy={deleteBusy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyText: { textAlign: 'center', paddingHorizontal: 20 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  listHeader: { marginBottom: 6 },
  error: { color: Color.DANGER, marginTop: 8 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardMain: { flex: 1 },
  cardTitle: { color: Color.TEXT_TITLE },
  cardDetail: { fontWeight: '600' },
  cardNote: { color: Color.TEXT_LABEL },
  inputGap: { marginTop: 8 },
});
