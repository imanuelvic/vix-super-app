import { Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DeadlineTag, deadlineBorder } from '@/components/common/Deadline';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  deadlineDaysUntil,
  invoiceTotal,
  newCareerId,
  saveFreelance,
  type FreelanceProject,
  type InvoiceItem,
} from '@/lib/career';
import { formatDate, groupDigits, parseAmount } from '@/lib/format';
import { INVOICE_PRESETS, shareInvoicePdf } from '@/lib/invoice';
import { deadlineLabel, deadlineTone } from '@/lib/deadline';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';
import { formatRupiah } from '@/lib/transactions';

// Draft item invoice — qty & harga sebagai string supaya enak diedit di input.
type ItemDraft = { desc: string; qty: string; price: string };

// Tab Freelance 🌐: proyek website & aplikasi — siapa client-nya,
// deadline kapan, requirement apa, dan fee-nya berapa.
export function FreelanceTab({
  projects,
  editId,
  onEditConsumed,
}: {
  projects: FreelanceProject[];
  // Kalau di-set (dari reminder Home), langsung buka modal edit proyek ini.
  editId?: string;
  // Dipanggil setelah editId dipakai — induk membersihkan param dari URL.
  onEditConsumed?: () => void;
}) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<FreelanceProject | 'new' | null>(null);
  const [fName, setFName] = useState('');
  const [fClient, setFClient] = useState('');
  const [fRequirement, setFRequirement] = useState('');
  const [fFee, setFFee] = useState('');
  const [fDeadline, setFDeadline] = useState(new Date());
  const [fDone, setFDone] = useState(false);
  const [fItems, setFItems] = useState<ItemDraft[]>([]);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const today = new Date();
  // Aktif urut deadline terdekat; yang selesai di bawah.
  const sorted = [...projects].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.deadline.toMillis() - b.deadline.toMillis();
  });
  const active = projects.filter((p) => !p.done);
  const activeFee = active.reduce((sum, p) => sum + p.fee, 0);

  function openAdd() {
    setEditing('new');
    setFName('');
    setFClient('');
    setFRequirement('');
    setFFee('');
    setFDeadline(new Date());
    setFDone(false);
    setFItems([]);
    setFormError(null);
  }

  const openEdit = useCallback((p: FreelanceProject) => {
    setEditing(p);
    setFName(p.name);
    setFClient(p.client);
    setFRequirement(p.requirement);
    setFFee(p.fee > 0 ? groupDigits(String(p.fee)) : '');
    setFDeadline(p.deadline.toDate());
    setFDone(p.done);
    setFItems(
      (p.invoiceItems ?? []).map((it) => ({
        desc: it.desc,
        qty: String(it.qty),
        price: it.price > 0 ? groupDigits(String(it.price)) : '',
      })),
    );
    setFormError(null);
  }, []);

  // Auto-buka modal edit saat dibuka dari reminder Home (?edit=<id>). Setelah
  // dipakai, minta induk membersihkan param (onEditConsumed) supaya modal TIDAK
  // auto-terbuka lagi saat balik ke subtab ini (yang me-mount ulang tab).
  // consumedRef = guard tambahan agar tak dobel dalam satu mount.
  const consumedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!editId || consumedRef.current === editId) return;
    const proj = projects.find((p) => p.id === editId);
    if (proj) {
      consumedRef.current = editId;
      openEdit(proj);
      onEditConsumed?.();
    }
  }, [editId, projects, openEdit, onEditConsumed]);

  // ===== Rincian biaya (invoice) =====
  function addPresetItem(desc: string) {
    setFItems((prev) => [...prev, { desc, qty: '1', price: '' }]);
  }
  function addManualItem() {
    setFItems((prev) => [...prev, { desc: '', qty: '1', price: '' }]);
  }
  function updateItem(idx: number, field: keyof ItemDraft, value: string) {
    setFItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    );
  }
  function removeItem(idx: number) {
    setFItems((prev) => prev.filter((_, i) => i !== idx));
  }
  // Draft → item bersih (qty minimal 1; item tanpa deskripsi diabaikan).
  function toInvoiceItems(): InvoiceItem[] {
    return fItems
      .filter((it) => it.desc.trim())
      .map((it) => ({
        desc: it.desc.trim(),
        qty: Math.max(1, parseInt(it.qty, 10) || 1),
        price: parseAmount(it.price),
      }));
  }

  // Buat PDF invoice dari isian form saat ini lalu buka share sheet (WA/Files).
  async function handleGenerateInvoice() {
    if (!editing || invoiceBusy) return;
    if (!fName.trim()) {
      setFormError('Isi nama proyek dulu untuk invoice.');
      return;
    }
    const items = toInvoiceItems();
    if (items.length === 0) {
      setFormError('Isi minimal 1 rincian biaya untuk membuat invoice.');
      return;
    }
    setFormError(null);
    setInvoiceBusy(true);
    try {
      await shareInvoicePdf({
        id: editing === 'new' ? newCareerId() : editing.id,
        name: fName.trim(),
        client: fClient.trim(),
        requirement: fRequirement.trim(),
        fee: parseAmount(fFee),
        deadline: Timestamp.fromDate(fDeadline),
        done: fDone,
        invoiceItems: items,
      });
    } catch {
      setFormError('Gagal membuat invoice. Coba lagi.');
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fName.trim()) {
      setFormError('Nama proyeknya diisi dulu.');
      return;
    }
    if (!fClient.trim()) {
      setFormError('Siapa client-nya?');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: FreelanceProject = {
      id: editing === 'new' ? newCareerId() : editing.id,
      name: fName.trim(),
      client: fClient.trim(),
      requirement: fRequirement.trim(),
      fee: parseAmount(fFee),
      deadline: Timestamp.fromDate(fDeadline),
      done: fDone,
      invoiceItems: toInvoiceItems(),
    };
    const next =
      editing === 'new'
        ? [...projects, data]
        : projects.map((p) => (p.id === editing.id ? data : p));
    try {
      await saveFreelance(user.uid, next);
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveFreelance(user.uid, projects.filter((p) => p.id !== editing.id));
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan usaha freelance */}
        <View style={styles.heroCard}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            🌐 Website & App Developer — Freelance
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {active.length}{' '}
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              proyek aktif · nilai {formatRupiah(activeFee)}
            </VixText>
          </VixText>
        </View>

        <PrimaryButton
          label="Tambah Proyek"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        <FormError message={error} />

        {sorted.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada proyek — catat proyek client pertamamu di sini 🚀
          </VixText>
        )}

        {sorted.map((p) => {
          const days = deadlineDaysUntil(p, today);
          // Warna & label dari aturan bersama (lihat lib/deadline.ts).
          const tone = p.done ? 'unknown' : deadlineTone(days);
          return (
            // Tekan untuk edit / tandai selesai.
            <PressableScale
              key={p.id}
              style={[styles.card, deadlineBorder(tone)]}
              onPress={() => openEdit(p)}>
              <View style={styles.cardTop}>
                <VixText
                  heading="bold"
                  numberOfLines={1}
                  additionalStyle={styles.cardTitle}>
                  {p.name}
                </VixText>
                {p.fee > 0 && (
                  <VixText heading="bold" additionalStyle={styles.feeText}>
                    {formatRupiah(p.fee)}
                  </VixText>
                )}
              </View>
              <VixText heading="label">
                👤 {p.client} · 📆 {formatDate(p.deadline.toDate())}
              </VixText>
              {p.requirement ? (
                <VixText heading="label" numberOfLines={2}>
                  📋 {p.requirement}
                </VixText>
              ) : null}
              {p.done ? (
                <VixText heading="label" additionalStyle={styles.statusDone}>
                  ✅ Selesai
                </VixText>
              ) : (
                <DeadlineTag tone={tone} label={deadlineLabel(days)} />
              )}
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Sheet tambah/edit proyek */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Proyek' : 'Edit Proyek'}
        scroll={false}
        onClose={() => setEditing(null)}>
        <ScrollView
          style={styles.formScroll}
          keyboardShouldPersistTaps="handled">
          <FormInput
            style={styles.formGap}
            placeholder="Nama proyek"
            value={fName}
            onChangeText={setFName}
            editable={!busy}
          />
          <FormInput
            style={styles.formGap}
            placeholder="Client — siapa pemesannya"
            value={fClient}
            onChangeText={setFClient}
            editable={!busy}
          />
          <FormInput
            style={styles.reqInput}
            placeholder="Requirement — fitur/halaman yang diminta"
            value={fRequirement}
            onChangeText={setFRequirement}
            multiline
            editable={!busy}
          />
          <MoneyInput
            style={styles.formGap}
            placeholder="Fee (opsional)"
            value={fFee}
            onChangeText={(t) => setFFee(groupDigits(t))}
            editable={!busy}
          />
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Deadline
          </VixText>
          <View style={styles.formGap}>
            {/* key = id supaya state picker internal reset tiap ganti proyek */}
            <DateField
              key={editing === 'new' ? 'new' : editing?.id}
              value={fDeadline}
              onChange={setFDeadline}
            />
          </View>
          {/* Tandai selesai */}
          <PressableScale style={styles.doneRow} onPress={() => setFDone((d) => !d)}>
            <CheckCircle checked={fDone} />
            <VixText heading="paragraph" additionalStyle={styles.doneText}>
              Proyek selesai ✅
            </VixText>
          </PressableScale>

          {/* ===== Rincian Biaya → Invoice PDF ===== */}
          <View style={styles.invoiceSection}>
            <VixText heading="bold" additionalStyle={styles.invoiceHeader}>
              🧾 Rincian Biaya (Invoice)
            </VixText>
            <VixText heading="label" additionalStyle={styles.invoiceHint}>
              Ketuk preset untuk menambah cepat, lalu isi qty & harganya.
            </VixText>
            <View style={styles.presetWrap}>
              {INVOICE_PRESETS.map((desc) => (
                <Chip
                  key={desc}
                  label={`+ ${desc}`}
                  active={false}
                  onPress={() => addPresetItem(desc)}
                />
              ))}
            </View>

            {fItems.map((it, idx) => (
              <View key={idx} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <FormInput
                    style={styles.itemDesc}
                    placeholder="Deskripsi item"
                    value={it.desc}
                    onChangeText={(t) => updateItem(idx, 'desc', t)}
                    editable={!invoiceBusy}
                  />
                  <PressableScale onPress={() => removeItem(idx)} hitSlop={8}>
                    <VixText heading="bold" additionalStyle={styles.itemRemove}>
                      ✕
                    </VixText>
                  </PressableScale>
                </View>
                <View style={styles.itemBottomRow}>
                  <FormInput
                    style={styles.itemQty}
                    placeholder="Qty"
                    keyboardType="number-pad"
                    value={it.qty}
                    onChangeText={(t) =>
                      updateItem(idx, 'qty', t.replace(/[^0-9]/g, ''))
                    }
                    editable={!invoiceBusy}
                  />
                  <MoneyInput
                    style={styles.itemPrice}
                    placeholder="Harga satuan"
                    value={it.price}
                    onChangeText={(t) => updateItem(idx, 'price', groupDigits(t))}
                    editable={!invoiceBusy}
                  />
                </View>
                <VixText heading="label" additionalStyle={styles.itemSub}>
                  Subtotal:{' '}
                  {formatRupiah(
                    Math.max(1, parseInt(it.qty, 10) || 1) *
                      parseAmount(it.price),
                  )}
                </VixText>
              </View>
            ))}

            <PressableScale style={styles.addManual} onPress={addManualItem}>
              <VixText heading="bold" additionalStyle={styles.addManualText}>
                ＋ Item manual
              </VixText>
            </PressableScale>

            <View style={styles.invoiceTotalRow}>
              <VixText heading="bold" additionalStyle={styles.invoiceTotalLabel}>
                Total
              </VixText>
              <VixText heading="bold" additionalStyle={styles.invoiceTotalValue}>
                {formatRupiah(invoiceTotal(toInvoiceItems()))}
              </VixText>
            </View>

            <PressableScale
              style={styles.invoiceButton}
              onPress={handleGenerateInvoice}
              disabled={invoiceBusy}>
              <VixText heading="bold" additionalStyle={styles.invoiceButtonText}>
                {invoiceBusy ? 'Menyiapkan…' : '📄 Buat & Bagikan Invoice PDF'}
              </VixText>
            </PressableScale>
          </View>

          <FormError message={formError} />
          <EditDelete
            editing={editing}
            label="Hapus proyek ini"
            busy={busy}
            onDelete={handleDelete}
          />
        </ScrollView>
        {/* DualButtons di luar ScrollView → otomatis dipin di footer SheetModal */}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  heroCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 4,
    marginBottom: 10,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  feeText: { color: Color.MAIN_DARK },
  statusDone: { color: Color.SUCCESS },
  formScroll: { flexShrink: 1 },
  formGap: { marginBottom: 10 },
  reqInput: {
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  fieldLabel: { marginBottom: 6 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  doneText: { color: Color.TEXT_TITLE },
  // Rincian biaya → invoice
  invoiceSection: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    gap: 8,
  },
  invoiceHeader: { color: Color.TEXT_TITLE },
  invoiceHint: { color: Color.TEXT_LABEL },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemCard: {
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 10,
    gap: 8,
  },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemDesc: { flex: 1 },
  itemRemove: { color: Color.DANGER, paddingHorizontal: 4 },
  itemBottomRow: { flexDirection: 'row', gap: 8 },
  itemQty: { width: 72 },
  itemPrice: { flex: 1 },
  itemSub: { color: Color.MAIN_DARK, textAlign: 'right' },
  addManual: { alignSelf: 'flex-start', paddingVertical: 6 },
  addManualText: { color: Color.MAIN_DARK },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    paddingTop: 8,
    marginTop: 2,
  },
  invoiceTotalLabel: { color: Color.TEXT_TITLE },
  invoiceTotalValue: { color: Color.MAIN_DARK },
  invoiceButton: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  invoiceButtonText: { color: Color.TEXT_REVERSE },
});
