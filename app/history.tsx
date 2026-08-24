import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DualButtons } from '@/components/common/DualButtons';
import { EditButton } from '@/components/common/EditButton';
import { EditDelete } from '@/components/common/EditDelete';
import { FilterChips } from '@/components/common/FilterChips';
import { FormInput } from '@/components/common/FormInput';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SearchBar } from '@/components/common/SearchBar';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useScrollTop } from '@/hooks/useScrollTop';
import {
  ageAtYear,
  historyCategoryMeta,
  HISTORY_CATEGORIES,
  historyYears,
  newHistoryId,
  saveHistory,
  seededHistory,
  SEED_HISTORY,
  subscribeHistory,
  yearLabel,
  type HistoryCategoryKey,
  type HistoryItem,
} from '@/lib/history';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';

// My History 📜 — perjalanan hidup yang sudah dilewati, dikelompokkan per
// tahun. Pasangan dari My Timeline 📍 (rencana ke depan): yang satu melihat ke
// belakang biar tidak lupa, yang satu melihat ke depan biar tidak melantur.
export default function HistoryScreen() {
  const { user } = useAuth();

  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Tampilan: filter kategori, urutan tahun, dan pencarian.
  const [category, setCategory] = useState<HistoryCategoryKey | null>(null);
  const [newestFirst, setNewestFirst] = useState(true);
  const [query, setQuery] = useState('');

  // Tekan chip kategori yang sedang aktif LAGI → daftar balik ke paling atas.
  const { ref: scrollRef, toTop } = useScrollTop();

  // Form tambah/edit.
  const [editing, setEditing] = useState<HistoryItem | 'new' | null>(null);
  const [fYear, setFYear] = useState('');
  const [fEndYear, setFEndYear] = useState('');
  const [fCategory, setFCategory] = useState<HistoryCategoryKey>('ministry');
  const [fMilestone, setFMilestone] = useState('');
  const [fTitle, setFTitle] = useState('');
  const [fDetail, setFDetail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeHistory(
      user.uid,
      (next) => {
        setItems(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user]);

  const all = items ?? [];
  const thisYear = new Date().getFullYear();

  // Saring: kategori + kata kunci (judul / keterangan / milestone / tahun).
  const q = query.trim().toLowerCase();
  const shown = all.filter((i) => {
    if (category && i.category !== category) return false;
    if (!q) return true;
    return `${i.title} ${i.detail} ${i.milestone} ${yearLabel(i)}`
      .toLowerCase()
      .includes(q);
  });
  const years = historyYears(shown, newestFirst);

  function openAdd() {
    setEditing('new');
    setFYear(String(thisYear));
    setFEndYear('');
    setFCategory('ministry');
    setFMilestone('');
    setFTitle('');
    setFDetail('');
    setFormError(null);
  }

  function openEdit(item: HistoryItem) {
    setEditing(item);
    setFYear(String(item.year));
    setFEndYear(item.endYear ? String(item.endYear) : '');
    setFCategory(item.category);
    setFMilestone(item.milestone);
    setFTitle(item.title);
    setFDetail(item.detail);
    setFormError(null);
  }

  async function handleSeed() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await saveHistory(user.uid, seededHistory());
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!user || !items || !editing || busy) return;
    const year = Number(fYear);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      setFormError('Tahun tidak masuk akal — cek lagi.');
      return;
    }
    if (!fTitle.trim()) {
      setFormError('Isi kejadiannya dulu.');
      return;
    }
    const endYear = fEndYear.trim() ? Number(fEndYear) : null;
    if (endYear !== null && (!Number.isInteger(endYear) || endYear < year)) {
      setFormError('Tahun selesai harus sama atau setelah tahun mulai.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: HistoryItem = {
      id: editing === 'new' ? newHistoryId() : editing.id,
      year,
      endYear,
      category: fCategory,
      milestone: fMilestone.trim(),
      title: fTitle.trim(),
      detail: fDetail.trim(),
    };
    const next =
      editing === 'new'
        ? [...items, data]
        : items.map((i) => (i.id === editing.id ? data : i));
    try {
      await saveHistory(user.uid, next);
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !items || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveHistory(
        user.uid,
        items.filter((i) => i.id !== editing.id),
      );
      setEditing(null);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Profile"
        title="My History 📜"
        subtitle="Perjalanan hidup yang sudah kulewati"
      />

      <ScreenError message={error} />

      {items === null ? (
        <LoadingCenter />
      ) : all.length === 0 ? (
        // Belum ada isi → tawarkan mengisi dari catatan lama (sekali tekan).
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.seedCard}>
            <VixText additionalStyle={styles.seedEmoji}>📜</VixText>
            <VixText heading="title" additionalStyle={styles.seedTitle}>
              Belum ada catatan
            </VixText>
            <VixText heading="label" additionalStyle={styles.seedText}>
              Aku sudah menyiapkan {SEED_HISTORY.length} entri dari sheet
              &quot;My Life Journey&quot;-mu — sekolah, gereja, pertobatan,
              pelayanan, kerja, sampai relasi. Semuanya bisa kamu ubah & hapus
              setelah masuk.
            </VixText>
            <PrimaryButton
              label={`📥 Isi dari catatan lamaku (${SEED_HISTORY.length})`}
              busy={busy}
              onPress={handleSeed}
              background={Color.MAIN_DARK}
              additionalStyle={styles.seedButton}
            />
            <PressableScale onPress={openAdd}>
              <VixText heading="bold" additionalStyle={styles.seedLink}>
                Atau mulai dari kosong
              </VixText>
            </PressableScale>
          </View>
        </ScrollView>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
          {/* Ringkasan perjalanan */}
          <SummaryCard style={styles.heroCard}>
            <VixText heading="label" additionalStyle={summaryText.label}>
              Perjalanan hidup
            </VixText>
            <VixText heading="header" additionalStyle={summaryText.value}>
              {all.length}
              <VixText heading="label" additionalStyle={summaryText.label}>
                {' '}
                kejadian tercatat
              </VixText>
            </VixText>
            <VixText heading="label" additionalStyle={summaryText.label}>
              🎂 {Math.min(...all.map((i) => i.year))} –{' '}
              {Math.max(...all.map((i) => i.endYear ?? i.year))} · sekarang umur{' '}
              {ageAtYear(thisYear)}
            </VixText>
          </SummaryCard>

          <View style={styles.searchWrap}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Cari kejadian, orang, tempat…"
            />
          </View>

          <FilterChips
            options={HISTORY_CATEGORIES.map((c) => ({
              key: c.key,
              label: `${c.icon} ${c.label}`,
              count: all.filter((i) => i.category === c.key).length,
            }))}
            value={category}
            onChange={setCategory}
            onRepress={toTop}
          />

          <View style={styles.sortRow}>
            <Chip
              label="🔽 Terbaru dulu"
              active={newestFirst}
              onPress={() => setNewestFirst(true)}
            />
            <Chip
              label="🔼 Dari awal"
              active={!newestFirst}
              onPress={() => setNewestFirst(false)}
            />
          </View>

          {years.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Tidak ada yang cocok dengan pencarian/filter ini.
            </VixText>
          ) : (
            years.map((year, index) => {
              const yearItems = shown.filter((i) => i.year === year);
              const future = year > thisYear;
              return (
                <Animated.View
                  key={year}
                  entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(
                    260,
                  )}
                  style={styles.yearBlock}>
                  <View style={styles.yearHeader}>
                    <View
                      style={[styles.yearPill, future && styles.yearPillFuture]}>
                      <VixText heading="bold" additionalStyle={styles.yearText}>
                        {year}
                      </VixText>
                    </View>
                    <VixText heading="label" additionalStyle={styles.ageText}>
                      {future
                        ? `🔮 rencana · nanti umur ${ageAtYear(year)}`
                        : `umur ${ageAtYear(year)}`}
                    </VixText>
                  </View>

                  {yearItems.map((item) => {
                    const meta = historyCategoryMeta(item.category);
                    return (
                      // Tombol ✏️ jadi SAUDARA area click, bukan anaknya —
                      // Pressable bersarang tidak andal di iOS.
                      <View key={item.id} style={styles.row}>
                        <PressableScale
                          style={styles.rowMain}
                          onPress={() => openEdit(item)}>
                          <VixText heading="bold" additionalStyle={styles.rowTitle}>
                            {meta.icon} {item.title}
                          </VixText>
                          <VixText heading="label" additionalStyle={styles.rowSub}>
                            {yearLabel(item)}
                            {item.milestone ? ` · ${item.milestone}` : ''}
                          </VixText>
                          {item.detail ? (
                            <VixText
                              heading="label"
                              additionalStyle={styles.rowDetail}>
                              {item.detail}
                            </VixText>
                          ) : null}
                        </PressableScale>
                        <EditButton onPress={() => openEdit(item)} />
                      </View>
                    );
                  })}
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* FAB tambah kejadian */}
      {items !== null && all.length > 0 && (
        <PressableScale style={styles.fab} onPress={openAdd}>
          <IconSymbol name="plus" size={24} color={Color.TEXT_REVERSE} />
        </PressableScale>
      )}

      {/* Sheet tambah / edit */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Kejadian' : 'Ubah Kejadian'}
        onClose={() => setEditing(null)}>
        <View style={styles.yearRow}>
          <View style={styles.yearField}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Tahun mulai
            </VixText>
            <FormInput
              placeholder="2026"
              keyboardType="number-pad"
              value={fYear}
              onChangeText={setFYear}
              editable={!busy}
            />
          </View>
          <View style={styles.yearField}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Sampai (opsional)
            </VixText>
            <FormInput
              placeholder="—"
              keyboardType="number-pad"
              value={fEndYear}
              onChangeText={setFEndYear}
              editable={!busy}
            />
          </View>
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Kategori
        </VixText>
        <View style={styles.chipWrap}>
          {HISTORY_CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              label={`${c.icon} ${c.label}`}
              active={fCategory === c.key}
              onPress={() => setFCategory(c.key)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Kejadiannya
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Wisuda S.Kom."
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Bagian hidup (opsional)
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Pekerjaan Utama, Pertobatan, Gerejaku"
          value={fMilestone}
          onChangeText={setFMilestone}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Keterangan (opsional)
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. nama pendeta, kampus, jam"
          value={fDetail}
          onChangeText={setFDetail}
          editable={!busy}
        />

        <ScreenError message={formError} />
        <EditDelete
          editing={editing}
          label="Hapus kejadian ini"
          busy={busy}
          onDelete={handleDelete}
        />
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
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 90 },
  // Kartu ajakan isi otomatis (hanya muncul saat masih kosong).
  seedCard: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    paddingHorizontal: 20,
    paddingVertical: 26,
    marginTop: 20,
  },
  seedEmoji: { fontSize: 44, lineHeight: 54 },
  seedTitle: { color: Color.TEXT_TITLE },
  seedText: { color: Color.TEXT_LABEL, textAlign: 'center' },
  seedButton: { alignSelf: 'stretch', marginTop: 10 },
  seedLink: { color: Color.MAIN, marginTop: 6 },
  // Bentuk & warna kartunya dari <SummaryCard>; di sini cuma selisihnya.
  heroCard: { gap: 2, marginBottom: 12 },
  searchWrap: { marginBottom: 10 },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 10 },
  yearBlock: { marginBottom: 14 },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  yearPill: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  // Tahun yang belum tiba = rencana, bukan kenangan.
  yearPillFuture: {
    backgroundColor: Color.CONTAINER,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
  },
  yearText: { color: Color.ACCENT_DARK },
  ageText: { color: Color.TEXT_LABEL },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    // Garis kiri = "rel" perjalanan, biar terbaca seperti garis waktu.
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN_LIGHT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: Color.TEXT_TITLE },
  rowSub: { color: Color.MAIN_DARK },
  rowDetail: { color: Color.TEXT_LABEL },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearRow: { flexDirection: 'row', gap: 10 },
  yearField: { flex: 1 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
});
