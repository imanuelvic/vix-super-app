import { Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  View,
} from 'react-native';
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
import { formatShortDayDate, groupDigits, parseAmount } from '@/lib/format';
import {
  EMPTY_FUN,
  funCategoryMeta,
  newFunId,
  pickCompressedMedal,
  saveFun,
  subscribeFun,
  summitTotal,
  type FunCategory,
  type FunData,
  type FunEntry,
} from '@/lib/fun';
import { formatRupiah } from '@/lib/transactions';

// Tab bawah = kategori arsip. Ikon SF dipetakan di icon-symbol.tsx.
const FUN_TABS: BottomTab<FunCategory>[] = [
  { key: 'summit', label: 'Summit', icon: 'mountain.2.fill' },
  { key: 'race', label: 'Race', icon: 'figure.run' },
  { key: 'reflection', label: 'Refleksi', icon: 'figure.mind.and.body' },
  { key: 'recreation', label: 'Rekreasi', icon: 'beach.umbrella.fill' },
];

/** Format waktu tempuh race: "1j 5m" kalau ≥ 60 menit, selain itu "X menit". */
function formatFinish(min: number): string {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}j ${m}m` : `${m} menit`;
}

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
  // Field khusus Race.
  const [price, setPrice] = useState('');
  const [finishMin, setFinishMin] = useState('');
  const [medalPhoto, setMedalPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  // Field khusus Summit — rincian anggaran pendakian.
  const [costOT, setCostOT] = useState('');
  const [costRent, setCostRent] = useState('');
  const [costTransport, setCostTransport] = useState('');
  const [costOther, setCostOther] = useState('');
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

  // Total anggaran Summit yang sedang diketik — untuk pratinjau live di form.
  const summitBudgetLive =
    parseAmount(costOT) +
    parseAmount(costRent) +
    parseAmount(costTransport) +
    parseAmount(costOther);

  function openAdd() {
    setEditingId(null);
    setTitle('');
    setPlace('');
    setDetail('');
    setNote('');
    setDate(new Date());
    setPrice('');
    setFinishMin('');
    setMedalPhoto(null);
    setCostOT('');
    setCostRent('');
    setCostTransport('');
    setCostOther('');
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
    setPrice(entry.price ? groupDigits(String(entry.price)) : '');
    setFinishMin(entry.finishMinutes ? String(entry.finishMinutes) : '');
    setMedalPhoto(entry.medalPhoto ?? null);
    setCostOT(entry.costOT ? groupDigits(String(entry.costOT)) : '');
    setCostRent(entry.costRent ? groupDigits(String(entry.costRent)) : '');
    setCostTransport(
      entry.costTransport ? groupDigits(String(entry.costTransport)) : '',
    );
    setCostOther(entry.costOther ? groupDigits(String(entry.costOther)) : '');
    setFormError(null);
    setFormOpen(true);
  }

  async function handlePickMedal() {
    if (photoBusy || saving) return;
    setPhotoBusy(true);
    try {
      const photo = await pickCompressedMedal();
      if (photo) setMedalPhoto(photo);
    } catch {
      setFormError('Gagal mengambil foto. Coba lagi.');
    } finally {
      setPhotoBusy(false);
    }
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
      // Field khusus Race — hanya ditulis untuk kategori race supaya tidak ada
      // key undefined yang dikirim ke Firestore pada kategori lain.
      if (category === 'race') {
        entry.price = parseAmount(price);
        entry.finishMinutes = Math.max(0, parseInt(finishMin, 10) || 0);
        entry.medalPhoto = medalPhoto;
      }
      // Field khusus Summit — rincian anggaran (total dihitung otomatis saat
      // ditampilkan, jadi tidak perlu disimpan terpisah).
      if (category === 'summit') {
        entry.costOT = parseAmount(costOT);
        entry.costRent = parseAmount(costRent);
        entry.costTransport = parseAmount(costTransport);
        entry.costOther = parseAmount(costOther);
      }
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
                {/* Rincian anggaran Summit + total (akumulasi otomatis) */}
                {item.category === 'summit' && summitTotal(item) > 0 ? (
                  <View style={styles.budgetBox}>
                    {[
                      { label: '🧭 Jasa OT', val: item.costOT },
                      { label: '🎒 Sewa barang', val: item.costRent },
                      { label: '🚗 Transportasi', val: item.costTransport },
                      { label: '🧾 Lain-lain', val: item.costOther },
                    ].map((row) =>
                      row.val ? (
                        <View key={row.label} style={styles.budgetRow}>
                          <VixText
                            heading="label"
                            additionalStyle={styles.budgetLabel}>
                            {row.label}
                          </VixText>
                          <VixText
                            heading="label"
                            additionalStyle={styles.budgetValue}>
                            {formatRupiah(row.val)}
                          </VixText>
                        </View>
                      ) : null,
                    )}
                    <View style={styles.budgetTotalRow}>
                      <VixText
                        heading="label"
                        additionalStyle={styles.budgetTotalLabel}>
                        💰 Total
                      </VixText>
                      <VixText
                        heading="bold"
                        additionalStyle={styles.budgetTotalValue}>
                        {formatRupiah(summitTotal(item))}
                      </VixText>
                    </View>
                  </View>
                ) : null}
                {/* Info khusus Race: harga pendaftaran & waktu tempuh */}
                {item.category === 'race' &&
                (item.price || item.finishMinutes) ? (
                  <VixText heading="label" additionalStyle={styles.raceStats}>
                    {[
                      item.price ? `💵 ${formatRupiah(item.price)}` : '',
                      item.finishMinutes
                        ? `⏱️ ${formatFinish(item.finishMinutes)}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join('   ·   ')}
                  </VixText>
                ) : null}
                {/* Foto medali (kalau ada) */}
                {item.category === 'race' && item.medalPhoto ? (
                  <Image
                    source={{
                      uri: `data:image/jpeg;base64,${item.medalPhoto}`,
                    }}
                    style={styles.medalThumb}
                    resizeMode="cover"
                  />
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
        {category === 'race' && (
          <>
            <FormInput
              style={styles.inputGap}
              placeholder="Harga pendaftaran (Rp)"
              keyboardType="number-pad"
              value={price}
              onChangeText={(t) => setPrice(groupDigits(t))}
              editable={!saving}
            />
            <FormInput
              style={styles.inputGap}
              placeholder="Waktu tempuh (menit)"
              keyboardType="number-pad"
              value={finishMin}
              onChangeText={(t) => setFinishMin(t.replace(/[^0-9]/g, ''))}
              editable={!saving}
            />
          </>
        )}
        {/* Rincian anggaran khusus Summit — total dihitung otomatis */}
        {category === 'summit' && (
          <>
            <View style={styles.inputGap}>
              <VixText heading="label" additionalStyle={styles.fieldLabel}>
                Rincian anggaran pendakian (Rp)
              </VixText>
            </View>
            <FormInput
              style={styles.inputGap}
              placeholder="Jasa OT (open trip / guide)"
              keyboardType="number-pad"
              value={costOT}
              onChangeText={(t) => setCostOT(groupDigits(t))}
              editable={!saving}
            />
            <FormInput
              style={styles.inputGap}
              placeholder="Sewa barang / alat"
              keyboardType="number-pad"
              value={costRent}
              onChangeText={(t) => setCostRent(groupDigits(t))}
              editable={!saving}
            />
            <FormInput
              style={styles.inputGap}
              placeholder="Transportasi"
              keyboardType="number-pad"
              value={costTransport}
              onChangeText={(t) => setCostTransport(groupDigits(t))}
              editable={!saving}
            />
            <FormInput
              style={styles.inputGap}
              placeholder="Lain-lain"
              keyboardType="number-pad"
              value={costOther}
              onChangeText={(t) => setCostOther(groupDigits(t))}
              editable={!saving}
            />
            <View style={styles.budgetTotalRow}>
              <VixText heading="label" additionalStyle={styles.budgetTotalLabel}>
                💰 Total anggaran
              </VixText>
              <VixText heading="bold" additionalStyle={styles.budgetTotalValue}>
                {formatRupiah(summitBudgetLive)}
              </VixText>
            </View>
          </>
        )}
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
        {category === 'race' && (
          <View style={styles.inputGap}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Foto medali (opsional)
            </VixText>
            <PressableScale
              style={styles.medalPicker}
              onPress={handlePickMedal}
              disabled={photoBusy || saving}>
              {photoBusy ? (
                <ActivityIndicator color={Color.MAIN} />
              ) : medalPhoto ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${medalPhoto}` }}
                  style={styles.medalPreview}
                  resizeMode="cover"
                />
              ) : (
                <VixText heading="label" additionalStyle={styles.medalHint}>
                  🏅{'\n'}Tambah Foto Medali
                </VixText>
              )}
            </PressableScale>
            {medalPhoto && (
              <PressableScale onPress={() => setMedalPhoto(null)} hitSlop={8}>
                <VixText heading="label" additionalStyle={styles.medalRemove}>
                  Hapus foto
                </VixText>
              </PressableScale>
            )}
          </View>
        )}
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
  // Info Race di kartu: harga + waktu tempuh.
  raceStats: { color: Color.TEXT_TITLE, fontWeight: '600' },
  // Kotak rincian anggaran Summit di kartu.
  budgetBox: {
    marginTop: 4,
    backgroundColor: Color.BACKGROUND,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetLabel: { color: Color.TEXT_LABEL },
  budgetValue: { color: Color.TEXT_TITLE },
  budgetTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  budgetTotalLabel: { color: Color.TEXT_TITLE },
  budgetTotalValue: { color: Color.MAIN_DARK },
  // Thumbnail foto medali di kartu.
  medalThumb: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: Color.BORDER,
  },
  inputGap: { marginTop: 8 },
  fieldLabel: { marginBottom: 6 },
  // Kotak pemilih foto medali di form.
  medalPicker: {
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    backgroundColor: Color.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  medalPreview: { width: '100%', height: '100%' },
  medalHint: { textAlign: 'center', color: Color.TEXT_LABEL },
  medalRemove: { color: Color.DANGER, textAlign: 'center', marginTop: 6 },
});
