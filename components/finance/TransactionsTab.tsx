import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { AddButton } from '@/components/common/AddButton';
import { CopyChip, CopyConfirm } from '@/components/common/CopyAction';
import { Chip } from '@/components/common/Chip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SearchBar } from '@/components/common/SearchBar';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { TypeChips } from '@/components/finance/TypeChips';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useSearchMode } from '@/hooks/useSearchMode';
import {
  budgetKey,
  isFuelTransaction,
  isResidenceTransaction,
  subLabelOf,
  subsOf,
  type BudgetMap,
  type SubcategoryMap,
} from '@/lib/budgets';
import { deleteCarLog, syncFuelLog } from '@/lib/car';
import {
  deleteResidenceLog,
  syncResidenceLog,
  type ResidenceLogType,
} from '@/lib/residence';
import {
  activeCategories,
  categoryOf,
  FINANCE_TYPE_COLOR,
  FINANCE_TYPE_LABEL,
  type FinanceType,
} from '@/lib/categories';
import {
  dayShort,
  formatFullDate,
  groupDigits,
  MONTH_NAMES,
  parseAmount,
  parseDecimal,
} from '@/lib/format';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';
import { openPayApp, payAppForCategory } from '@/lib/payapps';
import {
  addTransaction,
  deleteTransaction,
  formatRupiah,
  updateTransaction,
  type Transaction,
} from '@/lib/transactions';

// Preferensi tampil/sembunyi nominal — disimpan (AsyncStorage) supaya
// pilihannya global & konsisten tiap kali masuk Finance. "1" = disembunyikan.
const AMOUNTS_HIDDEN_KEY = 'finance:amountsHidden';

// Tab Transaction Log: ringkasan bulan, form tambah, daftar transaksi,
// modal edit (nominal/catatan/tanggal), dan konfirmasi hapus.
// `budget` (alokasi per kategori bulan ini) dipakai untuk mewarnai pilihan
// kategori: kuning saat pemakaian ≥75%, merah saat ≥100% (over budget).
export function TransactionsTab({
  items,
  budget,
  subcats,
}: {
  items: Transaction[];
  budget: BudgetMap;
  subcats: SubcategoryMap;
}) {
  const { user } = useAuth();

  // Ringkasan dikecilkan by default. Nominal default TAMPIL — pilihan
  // sembunyi/tampil disimpan & dimuat lagi tiap masuk (tidak tergantung
  // buka/tutup ringkasan).
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [amountsHidden, setAmountsHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Muat preferensi tersimpan sekali di awal.
  useEffect(() => {
    AsyncStorage.getItem(AMOUNTS_HIDDEN_KEY).then((v) => {
      if (v != null) setAmountsHidden(v === '1');
    });
  }, []);

  // Sembunyikan / tampilkan nominal + simpan pilihannya.
  function toggleAmountsHidden() {
    setAmountsHidden((hidden) => {
      const next = !hidden;
      AsyncStorage.setItem(AMOUNTS_HIDDEN_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }

  // Form tambah transaksi.
  const [type, setType] = useState<FinanceType>('expense');
  // Kategori SELALU default kosong (empty pick) — tidak diingat lintas sesi.
  const [category, setCategory] = useState<string | null>(null);
  // Sub-kategori (opsional) — pilihannya baru muncul kalau kategori terpilih
  // memang punya sub-budget (diatur di sub-menu Budgeting).
  const [sub, setSub] = useState<string | null>(null);
  // Liter — hanya dipakai saat sub "⛽ Bensin" dipilih (ikut ke fitur Car).
  const [liters, setLiters] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false); // sheet pilih kategori
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Mode cari (dibuka via FAB 🔍): cari kata + urutkan terbesar/terkecil.
  // listRef → lompat ke paling atas saat mode cari dibuka/ditutup.
  const listRef = useRef<FlatList<Transaction>>(null);
  const [sort, setSort] = useState<'recent' | 'high' | 'low'>('recent');
  // Buka/tutup mode cari. Tutup = reset kata & urutan. Lalu langsung ke paling
  // atas — sama seperti menekan ulang sub-tab Transaksi.
  const { searchMode, query, setQuery, toggleSearch } = useSearchMode({
    onClose: () => setSort('recent'),
    onToggle: () => listRef.current?.scrollToOffset({ offset: 0, animated: false }),
  });

  // Modal edit transaksi.
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSub, setEditSub] = useState<string | null>(null);
  const [editLiters, setEditLiters] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // Salin transaksi (📋 di modal edit) — konfirmasinya INLINE di dalam modal,
  // karena iOS tidak mendukung modal bertumpuk (sama seperti InlineDelete).
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [copying, setCopying] = useState(false);

  // Modal konfirmasi hapus.
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const totals = useMemo(() => {
    const t: Record<FinanceType, number> = {
      income: 0,
      expense: 0,
      saving: 0,
      investment: 0,
    };
    for (const item of items) {
      if (t[item.type] !== undefined) t[item.type] += item.amount;
    }
    return t;
  }, [items]);

  // Sisa = pemasukan dikurangi semua alokasi keluar bulan ini.
  const remaining =
    totals.income - totals.expense - totals.saving - totals.investment;

  // Realisasi per "jenis:kategori" bulan ini (untuk warna pilihan kategori).
  const realization = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of items) {
      const key = budgetKey(t.type, t.category);
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }
    return map;
  }, [items]);

  // Daftar transaksi: disaring jenis (TypeChips), lalu — saat mode cari aktif —
  // disaring kata (catatan/kategori) & diurutkan (terbesar/terkecil).
  const filtered = useMemo(() => {
    let list = items.filter((t) => t.type === type);
    if (searchMode) {
      const q = query.trim().toLowerCase();
      if (q) {
        list = list.filter((t) => {
          const cat = categoryOf(t.type, t.category);
          const subName = subLabelOf(subcats, t.type, t.category, t.sub);
          return `${cat.label} ${subName} ${t.note}`.toLowerCase().includes(q);
        });
      }
      if (sort === 'high') list = [...list].sort((a, b) => b.amount - a.amount);
      else if (sort === 'low') list = [...list].sort((a, b) => a.amount - b.amount);
    }
    return list;
  }, [items, type, searchMode, query, sort, subcats]);

  // Sub-kategori milik kategori yang sedang dipilih di form tambah.
  const categorySubs = category ? subsOf(subcats, type, category) : [];
  // Sedang mencatat pengisian bensin? → muncul kolom Liter & otomatis
  // tersalin ke fitur Car 🚗 (Log) begitu disimpan.
  const isFuel = !!category && isFuelTransaction(type, category, sub ?? undefined);
  const isResidence =
    !!category && isResidenceTransaction(type, category, sub ?? undefined);

  // Warna latar pilihan kategori sesuai pemakaian budget-nya: kuning ≥75%,
  // biru pas 100% (budget habis persis), merah kalau MELEBIHI 100% (over
  // budget).
  //
  // Kategori TANPA budget (belum diatur / 0) kini abu-abu gelap, bukan putih
  // polos seperti dulu. Dulu ia tak bisa dibedakan dari kategori yang
  // budget-nya masih longgar — dua keadaan yang sangat berbeda tampil sama.
  function categoryBudgetStyle(key: string): ViewStyle | undefined {
    const allocated = budget[budgetKey(type, key)] ?? 0;
    if (allocated <= 0) {
      return {
        backgroundColor: Color.DISABLED,
        borderColor: Color.DISABLED_DARK,
      };
    }
    const percent =
      ((realization.get(budgetKey(type, key)) ?? 0) / allocated) * 100;
    if (percent > 100)
      return {
        backgroundColor: Color.FINANCE_EXPENSE,
        borderColor: Color.FINANCE_EXPENSE_DARK,
      };
    if (percent >= 100)
      return {
        backgroundColor: Color.FINANCE_INVESTMENT,
        borderColor: Color.FINANCE_INVESTMENT_DARK,
      };
    if (percent >= 75)
      return {
        backgroundColor: Color.FINANCE_SAVING,
        borderColor: Color.FINANCE_SAVING_DARK,
      };
    return undefined;
  }

  // Teks nominal — disamarkan saat mode sembunyi angka aktif.
  function displayAmount(n: number): string {
    return amountsHidden ? 'Rp ••••••' : formatRupiah(n);
  }

  function validate(value: number, noteText: string): string | null {
    if (!value) return 'Isi nominalnya dulu.';
    if (!noteText.trim()) return 'Isi catatannya dulu — biar tahu ini buat apa.';
    return null;
  }

  async function handleAdd() {
    if (!user || saving) return;
    const value = parseAmount(amount);
    const invalid = !category
      ? 'Pilih kategorinya dulu.'
      : validate(value, note);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    const fuelLiters = isFuel ? parseDecimal(liters) : 0;
    try {
      const ref = await addTransaction(user.uid, {
        type,
        category: category!,
        sub: sub ?? '',
        liters: fuelLiters,
        amount: value,
        note: note.trim(),
      });
      // Bensin → sekalian tercatat di fitur Car (id log = id transaksi).
      if (isFuel) {
        await syncFuelLog(user.uid, ref.id, {
          title: note.trim() || 'Bensin',
          cost: value,
          liters: fuelLiters > 0 ? fuelLiters : null,
          date: new Date(),
        });
      }
      // Pengeluaran rumah → sekalian tercatat di Residence › Log, pola yang
      // sama persis dengan bensin di atas.
      if (isResidence) {
        await syncResidenceLog(user.uid, ref.id, {
          type: sub as ResidenceLogType,
          title: note.trim() || subLabelOf(subcats, type, category!, sub!),
          cost: value,
          date: new Date(),
        });
      }
      // Reset SEMUA ke default setelah menyimpan: kategori, sub, catatan, nominal.
      setCategory(null);
      setSub(null);
      setLiters('');
      setAmount('');
      setNote('');
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item: Transaction) {
    setEditing(item);
    setEditAmount(groupDigits(String(item.amount)));
    setEditNote(item.note);
    setEditSub(item.sub || null);
    setEditLiters(item.liters ? String(item.liters) : '');
    setEditDate(item.date ? item.date.toDate() : new Date());
    setEditError(null);
    setConfirmCopy(false);
  }

  /**
   * Salin transaksi yang sedang dibuka jadi DATA BARU — isinya persis seperti
   * yang tampil di modal (nominal, catatan, sub, liter), kecuali TANGGALNYA
   * yang otomatis jadi hari ini (saat tombol Salin ditekan). Transaksi aslinya
   * tidak diubah sama sekali.
   */
  async function handleCopy() {
    if (!user || !editing || copying) return;
    const value = parseAmount(editAmount);
    const invalid = validate(value, editNote);
    if (invalid) {
      setEditError(invalid);
      setConfirmCopy(false);
      return;
    }
    setEditError(null);
    setCopying(true);
    const nowFuel = isFuelTransaction(
      editing.type,
      editing.category,
      editSub ?? undefined,
    );
    const copyLiters = nowFuel ? parseDecimal(editLiters) : 0;
    try {
      // addTransaction selalu memakai Timestamp.now() → tanggalnya otomatis
      // hari ini, persis seperti menambah lewat form biasa.
      const ref = await addTransaction(user.uid, {
        type: editing.type,
        category: editing.category,
        sub: editSub ?? '',
        liters: copyLiters,
        amount: value,
        note: editNote.trim(),
      });
      // Bensin → salinannya ikut tercatat di fitur Car 🚗 (Log), sama seperti
      // transaksi bensin yang ditambah manual.
      if (nowFuel) {
        await syncFuelLog(user.uid, ref.id, {
          title: editNote.trim() || 'Bensin',
          cost: value,
          liters: copyLiters > 0 ? copyLiters : null,
          date: new Date(),
        });
      }
      // Begitu juga salinan pengeluaran rumah → Residence › Log.
      if (isResidenceTransaction(editing.type, editing.category, editSub ?? undefined)) {
        await syncResidenceLog(user.uid, ref.id, {
          type: editSub as ResidenceLogType,
          title:
            editNote.trim() ||
            subLabelOf(subcats, editing.type, editing.category, editSub!),
          cost: value,
          date: new Date(),
        });
      }
      setConfirmCopy(false);
      setEditing(null);
      // Salinan bertanggal hari ini → posisinya paling atas daftar. Langsung
      // digulir ke atas biar hasilnya kelihatan tanpa perlu scroll manual.
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch {
      setEditError(SAVE_ERROR);
    } finally {
      setCopying(false);
    }
  }

  async function handleSaveEdit() {
    if (!user || !editing || editSaving) return;
    const value = parseAmount(editAmount);
    const invalid = validate(value, editNote);
    if (invalid) {
      setEditError(invalid);
      return;
    }
    setEditError(null);
    setEditSaving(true);
    const nowFuel = isFuelTransaction(
      editing.type,
      editing.category,
      editSub ?? undefined,
    );
    const wasFuel = isFuelTransaction(editing.type, editing.category, editing.sub);
    const nowResidence = isResidenceTransaction(
      editing.type,
      editing.category,
      editSub ?? undefined,
    );
    const wasResidence = isResidenceTransaction(
      editing.type,
      editing.category,
      editing.sub,
    );
    const editLitersValue = nowFuel ? parseDecimal(editLiters) : 0;
    try {
      await updateTransaction(user.uid, editing.id, {
        amount: value,
        note: editNote.trim(),
        sub: editSub ?? '',
        liters: editLitersValue,
        date: editDate,
      });
      // Log di fitur Car ikut menyesuaikan: diperbarui kalau (masih) bensin,
      // dihapus kalau sub bensin-nya dilepas.
      if (nowFuel) {
        await syncFuelLog(user.uid, editing.id, {
          title: editNote.trim() || 'Bensin',
          cost: value,
          liters: editLitersValue > 0 ? editLitersValue : null,
          date: editDate,
        });
      } else if (wasFuel) {
        await deleteCarLog(user.uid, editing.id);
      }
      // Log Residence ikut menyesuaikan: diperbarui kalau (masih) pengeluaran
      // rumah, dihapus kalau sub-nya dilepas.
      if (nowResidence) {
        await syncResidenceLog(user.uid, editing.id, {
          type: editSub as ResidenceLogType,
          title:
            editNote.trim() ||
            subLabelOf(subcats, editing.type, editing.category, editSub!),
          cost: value,
          date: editDate,
        });
      } else if (wasResidence) {
        await deleteResidenceLog(user.uid, editing.id);
      }
      setEditing(null);
    } catch {
      setEditError(SAVE_ERROR);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!user || !confirmDelete || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteTransaction(user.uid, confirmDelete.id);
      // Bensin → catatan kembarannya di fitur Car ikut dihapus permanen.
      if (
        isFuelTransaction(
          confirmDelete.type,
          confirmDelete.category,
          confirmDelete.sub,
        )
      ) {
        await deleteCarLog(user.uid, confirmDelete.id);
      }
      // Begitu juga catatan kembarannya di Residence › Log.
      if (
        isResidenceTransaction(
          confirmDelete.type,
          confirmDelete.category,
          confirmDelete.sub,
        )
      ) {
        await deleteResidenceLog(user.uid, confirmDelete.id);
      }
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setConfirmDelete(null);
      setDeleteBusy(false);
    }
  }

  function renderHeader() {
    // App tujuan (deeplink) sesuai kategori terpilih — muncul di bawah nominal.
    const payApp = category ? payAppForCategory(category) : null;
    return (
      // key beda dengan header mode cari → React benar-benar melepas/memasang
      // ulang isinya saat mode berganti (bukan sekadar menambal), jadi
      // `autoFocus` di kotak cari pasti jalan tiap kali mode cari dibuka.
      <View key="add-header">
        {/* Hari & tanggal hari ini */}
        <VixText heading="label" additionalStyle={styles.todayText}>
          📆 {formatFullDate(new Date())}
        </VixText>

        {/* Ringkasan bulan — bisa diminimize seperti dropdown */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            {/* Kiri: perbesar / kecilkan ringkasan (tidak mengubah visibilitas) */}
            <PressableScale
              style={styles.summaryHeaderMain}
              onPress={() => setSummaryOpen((o) => !o)}>
              <VixText heading="label" additionalStyle={styles.summaryLabel}>
                Ringkasan bulan
              </VixText>
              <View style={styles.summaryToggle}>
                <VixText heading="label" additionalStyle={styles.summaryLabel}>
                  {summaryOpen ? 'Kecilkan' : 'Perbesar'}
                </VixText>
                <IconSymbol
                  name={summaryOpen ? 'chevron.up' : 'chevron.down'}
                  size={16}
                  color={Color.TEXT_ON_DARK_MUTED}
                />
              </View>
            </PressableScale>
            {/* Kanan: sembunyikan / tampilkan nominal (pilihan tersimpan) */}
            <PressableScale onPress={toggleAmountsHidden} hitSlop={10}>
              <IconSymbol
                name={amountsHidden ? 'eye.slash' : 'eye'}
                size={20}
                color={Color.TEXT_ON_DARK_MUTED}
              />
            </PressableScale>
          </View>

          {summaryOpen ? (
            <View>
              <VixText heading="label" additionalStyle={styles.summaryLabel}>
                Sisa bulan ini
              </VixText>
              <VixText
                heading="subheader"
                additionalStyle={styles.summaryRemaining}>
                {displayAmount(remaining)}
              </VixText>
              {/* Keempat jenisnya lengkap, dua baris @2 kolom. Sebelumnya cuma
                  Income & Expense — padahal Saving & Investment juga ikut
                  mengurangi "Sisa bulan ini", jadi angkanya tampak tidak cocok
                  dengan dua kolom di bawahnya. */}
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <VixText heading="label" additionalStyle={styles.summaryLabel}>
                    Income
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.summaryValue}>
                    {displayAmount(totals.income)}
                  </VixText>
                </View>
                <View style={styles.summaryItem}>
                  <VixText heading="label" additionalStyle={styles.summaryLabel}>
                    Expense
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.summaryValue}>
                    {displayAmount(totals.expense)}
                  </VixText>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <VixText heading="label" additionalStyle={styles.summaryLabel}>
                    Saving
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.summaryValue}>
                    {displayAmount(totals.saving)}
                  </VixText>
                </View>
                <View style={styles.summaryItem}>
                  <VixText heading="label" additionalStyle={styles.summaryLabel}>
                    Investment
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.summaryValue}>
                    {displayAmount(totals.investment)}
                  </VixText>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.collapsedRow}>
              <VixText heading="bold" additionalStyle={styles.summaryValue}>
                Sisa: {displayAmount(remaining)}
              </VixText>
            </View>
          )}
        </View>

        {/* Pilih jenis */}
        <TypeChips
          value={type}
          onChange={(next) => {
            setType(next);
            // Ganti jenis → kategori & sub dikosongkan lagi (selalu empty pick).
            setCategory(null);
            setSub(null);
          }}
        />

        {/* Pilih kategori — buka sheet, tidak perlu scroll ke samping */}
        <PressableScale
          style={styles.categoryField}
          onPress={() => setPickerOpen(true)}>
          <VixText
            heading="paragraph"
            additionalStyle={
              selectedCategory
                ? styles.categoryValue
                : styles.categoryPlaceholder
            }>
            {selectedCategory
              ? `${selectedCategory.icon} ${selectedCategory.label}`
              : 'Pilih kategori'}
          </VixText>
          <IconSymbol name="chevron.down" size={18} color={Color.TEXT_LABEL} />
        </PressableScale>

        {/* Sub-kategori — HANYA muncul kalau kategori terpilih punya sub.
            Opsional: tekan pilihan yang aktif untuk mengosongkannya lagi. */}
        {categorySubs.length > 0 && (
          <View style={styles.subField}>
            <SelectField
              value={sub}
              options={categorySubs.map((s) => ({ key: s.key, label: s.label }))}
              onChange={setSub}
              placeholder="Pilih sub-kategori (opsional)"
              disabled={saving}
              clearable
            />
          </View>
        )}

        {/* Catatan, nominal & tombol + BARU muncul setelah kategori dipilih —
            satu paket, sama seperti pilihan sub-kategori di atasnya. Sebelum
            kategori dipilih form-nya sengaja ringkas: jenis → kategori saja.
            Catatan dulu, lalu nominal — urutan sama seperti Saku. */}
        {category && (
          <>
            <FormInput
              placeholder="Catatan"
              value={note}
              onChangeText={setNote}
              editable={!saving}
            />
            <View style={[styles.inputRow, styles.inputGap]}>
              <MoneyInput
                style={styles.flexInput}
                placeholder="Nominal"
                value={amount}
                onChangeText={(t) => setAmount(groupDigits(t))}
                onSubmitEditing={handleAdd}
                returnKeyType="done"
                editable={!saving}
              />
              {/* Liter — khusus bensin, dipakai menghitung Rp/liter di Car */}
              {isFuel && (
                <FormInput
                  style={styles.literInput}
                  placeholder="Liter"
                  keyboardType="decimal-pad"
                  value={liters}
                  onChangeText={setLiters}
                  editable={!saving}
                />
              )}
              <AddButton busy={saving} onPress={handleAdd} />
            </View>
          </>
        )}

        {/* Tombol deeplink ke app tujuan (warna brand) — hanya kalau kategori
            terpilih punya app terkait. Buka vix → isi data → lompat ke app. */}
        {payApp && (
          <PressableScale
            style={[
              styles.payButton,
              styles.inputGap,
              { backgroundColor: payApp.color },
            ]}
            onPress={() => openPayApp(payApp)}>
            <VixText heading="bold" additionalStyle={{ color: payApp.fg }}>
              💳 Buka {payApp.label}
            </VixText>
            <IconSymbol name="chevron.right" size={18} color={payApp.fg} />
          </PressableScale>
        )}

        {isFuel && (
          <VixText heading="label" additionalStyle={styles.fuelHint}>
            ⛽ Otomatis tercatat juga di fitur Car → Log. Isi liter supaya harga
            per liter terhitung.
          </VixText>
        )}

        <FormError message={error} gap="top" />
      </View>
    );
  }

  // Header saat mode cari aktif: cari kata + urutkan (terbesar/terkecil).
  // Hanya mencari transaksi bulan yang sedang dibuka (data `items`).
  function renderSearchHeader() {
    const q = query.trim();
    return (
      <View key="search-header">
        <VixText heading="label" additionalStyle={styles.todayText}>
          🔍 Cari transaksi bulan ini
        </VixText>
        <TypeChips
          value={type}
          onChange={(next) => {
            setType(next);
            setCategory(null);
            setSub(null);
          }}
        />
        <View style={styles.searchWrap}>
          {/* Langsung terfokus + keyboard native terbuka begitu FAB 🔍 ditekan */}
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Cari catatan / kategori…"
            autoFocus
          />
        </View>
        <View style={styles.sortRow}>
          <Chip
            label="🕒 Terbaru"
            active={sort === 'recent'}
            onPress={() => setSort('recent')}
          />
          <Chip
            label="🔺 Terbesar"
            active={sort === 'high'}
            onPress={() => setSort('high')}
          />
          <Chip
            label="🔻 Terkecil"
            active={sort === 'low'}
            onPress={() => setSort('low')}
          />
        </View>
        <VixText heading="label" additionalStyle={styles.searchCount}>
          {filtered.length} transaksi {FINANCE_TYPE_LABEL[type].toLowerCase()}
          {q ? ` cocok “${q}”` : ''}
        </VixText>
      </View>
    );
  }

  const selectedCategory = category ? categoryOf(type, category) : null;
  const editingCategory = editing
    ? categoryOf(editing.type, editing.category)
    : null;
  const editingSubs = editing
    ? subsOf(subcats, editing.type, editing.category)
    : [];
  const deletingCategory = confirmDelete
    ? categoryOf(confirmDelete.type, confirmDelete.category)
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        persistentScrollbar
        indicatorStyle="black"
        ListHeaderComponent={searchMode ? renderSearchHeader() : renderHeader()}
        ListEmptyComponent={
          <View style={styles.center}>
            <VixText heading="label" additionalStyle={styles.transactionLogLabel}>
              {searchMode
                ? query.trim()
                  ? 'Tidak ada transaksi yang cocok 🔍'
                  : `Belum ada transaksi ${FINANCE_TYPE_LABEL[type]} bulan ini.`
                : `Belum ada transaksi ${FINANCE_TYPE_LABEL[type]} bulan ini. Tambahkan di atas 👆`}
            </VixText>
          </View>
        }
        renderItem={({ item }) => {
          const cat = categoryOf(item.type, item.category);
          const subName = subLabelOf(subcats, item.type, item.category, item.sub);
          const isIncome = item.type === 'income';
          const d = item.date ? item.date.toDate() : null;
          // Nama hari 3 huruf di samping tanggal, mis. "Sel, 14 Jul".
          const dateLabel = d
            ? `${dayShort(d)}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`
            : '';
          return (
            // Tekan baris untuk mengedit. Border mengikuti warna jenis.
            <PressableScale
              style={[styles.row, { borderColor: FINANCE_TYPE_COLOR[item.type] }]}
              onPress={() => openEdit(item)}>
              <View style={styles.rowIcon}>
                <VixText heading="title">{cat.icon}</VixText>
              </View>
              <View style={styles.rowMain}>
                <VixText
                  heading="bold"
                  numberOfLines={1}
                  additionalStyle={styles.rowLabel}>
                  {cat.label}
                  {subName ? ` › ${subName}` : ''}
                </VixText>
                <VixText heading="label" numberOfLines={1}>
                  {dateLabel ? `${dateLabel}` : ''}
                  {item.note ? ` · ${item.note}` : ''}
                </VixText>
              </View>
              <View style={styles.rowRight}>
                <VixText
                  heading="bold"
                  additionalStyle={
                    isIncome ? styles.amountIncome : styles.amountOut
                  }>
                  {amountsHidden
                    ? 'Rp ••••••'
                    : `${isIncome ? '+' : '-'}${formatRupiah(item.amount)}`}
                </VixText>
                <PressableScale onPress={() => setConfirmDelete(item)} hitSlop={10}>
                  <IconSymbol
                    name="xmark"
                    size={16}
                    color={Color.TEXT_PLACEHOLDER}
                  />
                </PressableScale>
              </View>
            </PressableScale>
          );
        }}
      />

      {/* Sheet pilih kategori */}
      <SheetModal
        visible={pickerOpen}
        title={`Kategori ${FINANCE_TYPE_LABEL[type]}`}
        onClose={() => setPickerOpen(false)}>
        <ScrollView style={styles.pickerScroll}>
          <View style={styles.pickerWrap}>
            {activeCategories(type).map((c) => (
              <Chip
                key={c.key}
                label={`${c.icon} ${c.label}`}
                active={category === c.key}
                additionalStyle={categoryBudgetStyle(c.key)}
                onPress={() => {
                  setCategory(c.key);
                  // Ganti kategori → sub lama tidak berlaku lagi.
                  setSub(null);
                  setPickerOpen(false);
                }}
              />
            ))}
          </View>
        </ScrollView>
      </SheetModal>

      {/* Bottom sheet: edit transaksi */}
      <SheetModal
        visible={!!editing}
        title="Edit Transaksi"
        subtitle={
          editing && editingCategory
            ? `${editingCategory.icon} ${editingCategory.label} · ${FINANCE_TYPE_LABEL[editing.type]}`
            : undefined
        }
        onClose={() => setEditing(null)}
        headerRight={
          // 📋 = salin jadi transaksi baru bertanggal hari ini (sama seperti
          // tombol 📋 di sub-menu Budgeting & di Edit Paket fitur Device).
          <CopyChip
            onPress={() => setConfirmCopy(true)}
            disabled={copying || editSaving}
          />
        }>
        {/* Konfirmasi salin — inline (bukan modal baru) supaya muncul di iOS */}
        {confirmCopy && (
          <CopyConfirm
            title="📋 Salin jadi transaksi baru?"
            busy={copying}
            onCancel={() => setConfirmCopy(false)}
            onConfirm={handleCopy}
          />
        )}
        <MoneyInput
          placeholder="Nominal"
          value={editAmount}
          onChangeText={(t) => setEditAmount(groupDigits(t))}
          editable={!editSaving}
        />
        <FormInput
          style={styles.inputGap}
          placeholder="Catatan"
          value={editNote}
          onChangeText={setEditNote}
          editable={!editSaving}
        />
        {/* Sub-kategori transaksi ini — muncul kalau kategorinya punya sub */}
        {editingSubs.length > 0 && (
          <View style={styles.inputGap}>
            <SelectField
              key={editing?.id}
              value={editSub}
              options={editingSubs.map((s) => ({ key: s.key, label: s.label }))}
              onChange={setEditSub}
              placeholder="Pilih sub-kategori (opsional)"
              disabled={editSaving}
              clearable
            />
          </View>
        )}
        {/* Liter bensin — perubahannya ikut ke catatan di fitur Car */}
        {editing &&
          isFuelTransaction(
            editing.type,
            editing.category,
            editSub ?? undefined,
          ) && (
            <FormInput
              style={styles.inputGap}
              placeholder="Liter"
              keyboardType="decimal-pad"
              value={editLiters}
              onChangeText={setEditLiters}
              editable={!editSaving}
            />
          )}
        <View style={styles.inputGap}>
          <DateField key={editing?.id} value={editDate} onChange={setEditDate} />
        </View>
        <FormError message={editError} gap="top" />
        <DualButtons
          confirmLabel="Simpan"
          busy={editSaving}
          onCancel={() => setEditing(null)}
          onConfirm={handleSaveEdit}
        />
      </SheetModal>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        visible={!!confirmDelete}
        title="Hapus transaksi ini?"
        detail={
          confirmDelete && deletingCategory
            ? `${deletingCategory.icon} ${deletingCategory.label} · ${formatRupiah(confirmDelete.amount)}${confirmDelete.note ? `\n${confirmDelete.note}` : ''}`
            : undefined
        }
        busy={deleteBusy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* FAB mengambang (seperti fitur Task): buka/tutup mode cari 🔍 */}
      <PressableScale style={styles.fab} onPress={toggleSearch}>
        <IconSymbol
          name={searchMode ? 'xmark' : 'magnifyingglass'}
          size={24}
          color={Color.TEXT_REVERSE}
        />
      </PressableScale>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  todayText: { marginBottom: 8 },
  summaryCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  summaryHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryToggle: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  summaryLabel: { color: Color.TEXT_ON_DARK_MUTED },
  summaryRemaining: { color: Color.TEXT_REVERSE, marginTop: 2, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', marginTop: 6 },
  summaryItem: { flex: 1 },
  summaryValue: { color: Color.TEXT_REVERSE },
  collapsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  categoryField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    marginBottom: 8,
  },
  categoryValue: { color: Color.TEXT_TITLE },
  categoryPlaceholder: { color: Color.TEXT_PLACEHOLDER },
  // Pilihan sub-kategori — jaraknya disamakan dengan kotak kategori di atasnya.
  subField: { marginBottom: 8 },
  pickerScroll: { maxHeight: 400 },
  pickerWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  inputRow: { flexDirection: 'row', gap: 10 },
  inputGap: { marginTop: 8 },
  // Tombol 📋 & kotak konfirmasinya sekarang komponen bersama
  // (components/common/CopyAction.tsx) — bentuknya ditulis sekali di sana.
  flexInput: { flex: 1 },
  // Kolom Liter di samping Nominal (hanya saat mencatat bensin).
  literInput: { width: 84 },
  fuelHint: { color: Color.TEXT_LABEL, marginTop: 8 },
  // Tombol deeplink ke app tujuan — warna latar diisi warna brand app-nya.
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 88 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
    gap: 10,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Color.CONTRAST_CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1 },
  rowLabel: { color: Color.TEXT_TITLE },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  amountIncome: { color: Color.SUCCESS },
  amountOut: { color: Color.TEXT_TITLE },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 30 },
  transactionLogLabel: { alignItems: 'center' },
  // Mode cari
  searchWrap: { marginBottom: 8 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  searchCount: { color: Color.TEXT_LABEL, marginBottom: 4 },
  // FAB mengambang (seperti Task).
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
