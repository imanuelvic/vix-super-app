import { useLocalSearchParams, useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useDraft } from '@/hooks/useDraft';
import {
    invoiceTotal,
    newCareerId,
    saveFreelance,
    subscribeFreelance,
    type FreelanceProject,
    type InvoiceItem,
} from '@/lib/career';
import { formatShortRupiah, groupDigits, parseAmount } from '@/lib/format';
import { INVOICE_PRESETS, presetPrice } from '@/lib/invoice';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import { formatRupiah } from '@/lib/transactions';

// Draft item invoice — qty & harga sebagai string supaya enak diedit di input.
type ItemDraft = { desc: string; qty: string; price: string };

/** Item tersimpan → draft yang bisa diketik. */
function toDraft(it: InvoiceItem): ItemDraft {
  return {
    desc: it.desc,
    qty: String(it.qty),
    price: it.price > 0 ? groupDigits(String(it.price)) : '',
  };
}

// Layar UBAH PROYEK ✏️ — dibuka dari tombol pensil di daftar Freelance atau
// dari layar rincian proyek. `id` = 'new' berarti sedang menambah proyek baru.
//
// Kenapa layar sendiri, bukan modal seperti dulu: isiannya panjang (nama,
// client, requirement, fee, deadline, plus rincian biaya yang bisa belasan
// baris). Di dalam modal, isian itu berdesakan dengan keyboard dan bagian
// bawahnya susah dijangkau. Di layar penuh semuanya lega.
export default function ProjectEditScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [projects, setProjects] = useState<FreelanceProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeFreelance(user.uid, setProjects, () => setError(LOAD_ERROR));
  }, [user]);

  const project = isNew ? null : (projects?.find((p) => p.id === id) ?? null);

  // Isian form. `useDraft` menyimpan HANYA yang kamu ketik — selama belum
  // disentuh, nilainya ikut data dari Firestore yang datang belakangan. Itu
  // sebabnya tak perlu useEffect yang mengisi state (dilarang React Compiler).
  const [today] = useState(() => new Date());
  const [fName, setFName] = useDraft(project?.name ?? '');
  const [fClient, setFClient] = useDraft(project?.client ?? '');
  const [fRequirement, setFRequirement] = useDraft(project?.requirement ?? '');
  const [fFee, setFFee] = useDraft(
    project && project.fee > 0 ? groupDigits(String(project.fee)) : '',
  );
  const [fDeadline, setFDeadline] = useDraft(
    project ? project.deadline.toDate() : today,
  );
  const [fDone, setFDone] = useDraft(project?.done ?? false);
  const [fItems, setFItems] = useDraft<ItemDraft[]>(
    (project?.invoiceItems ?? []).map(toDraft),
  );

  // ===== Rincian biaya =====
  // Item dari daftar siap-pakai langsung membawa PERKIRAAN harganya, jadi tak
  // perlu mengetik angka dari nol. Tetap bisa diubah di barisnya.
  function addPresetItem(desc: string, price: number) {
    setFItems((prev) => [
      ...prev,
      { desc, qty: '1', price: groupDigits(String(price)) },
    ]);
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
  /** Draft → item bersih (qty minimal 1; item tanpa deskripsi diabaikan). */
  function toInvoiceItems(): InvoiceItem[] {
    return fItems
      .filter((it) => it.desc.trim())
      .map((it) => ({
        desc: it.desc.trim(),
        qty: Math.max(1, parseInt(it.qty, 10) || 1),
        price: parseAmount(it.price),
      }));
  }

  async function handleSave() {
    if (!user || busy) return;
    if (!fName.trim()) {
      setError('Nama proyeknya diisi dulu.');
      return;
    }
    if (!fClient.trim()) {
      setError('Siapa client-nya?');
      return;
    }
    setBusy(true);
    setError(null);
    const list = projects ?? [];
    const data: FreelanceProject = {
      id: isNew ? newCareerId() : id,
      name: fName.trim(),
      client: fClient.trim(),
      requirement: fRequirement.trim(),
      fee: parseAmount(fFee),
      deadline: Timestamp.fromDate(fDeadline),
      done: fDone,
      invoiceItems: toInvoiceItems(),
    };
    try {
      await saveFreelance(
        user.uid,
        isNew ? [...list, data] : list.map((p) => (p.id === id ? data : p)),
      );
      router.back();
    } catch {
      setError(SAVE_ERROR);
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || isNew || busy) return;
    setBusy(true);
    try {
      await saveFreelance(
        user.uid,
        (projects ?? []).filter((p) => p.id !== id),
      );
      // Layar rincian proyek ini ikut hilang — kembali ke daftar Freelance.
      router.dismissTo('/career');
    } catch {
      setError(DELETE_ERROR);
      setBusy(false);
    }
  }

  // Proyek lama: tunggu datanya dulu, kalau tidak isiannya sempat kosong.
  const loading = !isNew && projects === null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Kembali"
        title={isNew ? 'Tambah Proyek' : 'Ubah Proyek'}
        subtitle={isNew ? 'Proyek freelance baru' : fName || 'Proyek freelance'}
      />

      {loading ? (
        <LoadingCenter />
      ) : (
        <>
          <KeyboardAwareScrollView contentContainerStyle={styles.content}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Nama proyek
            </VixText>
            <FormInput
              style={styles.formGap}
              placeholder="Mis. Website Toko Bunga"
              value={fName}
              onChangeText={setFName}
              editable={!busy}
            />
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Client
            </VixText>
            <FormInput
              style={styles.formGap}
              placeholder="Nama orang / perusahaan"
              value={fClient}
              onChangeText={setFClient}
              editable={!busy}
            />
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Requirement
            </VixText>
            <FormInput
              style={styles.reqInput}
              placeholder="Fitur/halaman yang diminta"
              value={fRequirement}
              onChangeText={setFRequirement}
              multiline
              editable={!busy}
            />
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Fee (opsional)
            </VixText>
            <MoneyInput
              style={styles.formGap}
              placeholder="Nilai proyek yang disepakati"
              value={fFee}
              onChangeText={(t) => setFFee(groupDigits(t))}
              editable={!busy}
            />
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Deadline
            </VixText>
            <View style={styles.formGap}>
              <DateField value={fDeadline} onChange={setFDeadline} />
            </View>

            <PressableScale
              style={styles.doneRow}
              onPress={() => setFDone((d) => !d)}>
              <CheckCircle checked={fDone} />
              <VixText heading="paragraph" additionalStyle={styles.doneText}>
                Proyek selesai ✅
              </VixText>
            </PressableScale>

            {/* ===== Rincian Biaya ===== */}
            <View style={styles.invoiceSection}>
              <VixText heading="title">🧾 Rincian Biaya</VixText>
              <VixText heading="label" additionalStyle={styles.invoiceHint}>
                Klik item di bawah — harganya terisi otomatis dari perkiraan,
                tinggal dibetulkan kalau proyeknya beda.
              </VixText>
              <View style={styles.presetWrap}>
                {INVOICE_PRESETS.map((p) => (
                  <Chip
                    key={p.desc}
                    label={`+ ${p.desc} · ${formatShortRupiah(p.price)}`}
                    active={false}
                    onPress={() => addPresetItem(p.desc, p.price)}
                  />
                ))}
              </View>

              {fItems.map((it, idx) => {
                const perkiraan = presetPrice(it.desc);
                const qty = Math.max(1, parseInt(it.qty, 10) || 1);
                return (
                  <View key={idx} style={styles.itemCard}>
                    <View style={styles.itemTopRow}>
                      <FormInput
                        style={styles.itemDesc}
                        placeholder="Deskripsi item"
                        value={it.desc}
                        onChangeText={(t) => updateItem(idx, 'desc', t)}
                        editable={!busy}
                      />
                      <PressableScale
                        onPress={() => removeItem(idx)}
                        hitSlop={8}
                        haptic="warning">
                        <VixText
                          heading="bold"
                          additionalStyle={styles.itemRemove}>
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
                        editable={!busy}
                      />
                      {/* Placeholder-nya menyebut perkiraan harga item itu —
                          jadi kalau kolomnya dikosongkan, ancar-ancarnya tetap
                          kelihatan tanpa perlu membuka daftar di atas lagi. */}
                      <MoneyInput
                        style={styles.itemPrice}
                        placeholder={
                          perkiraan > 0
                            ? `Harga satuan · est. ${formatRupiah(perkiraan)}`
                            : 'Harga satuan'
                        }
                        value={it.price}
                        onChangeText={(t) =>
                          updateItem(idx, 'price', groupDigits(t))
                        }
                        editable={!busy}
                      />
                    </View>
                    <VixText heading="label" additionalStyle={styles.itemSub}>
                      {qty} × {formatRupiah(parseAmount(it.price))} ={' '}
                      {formatRupiah(qty * parseAmount(it.price))}
                    </VixText>
                  </View>
                );
              })}

              <PressableScale style={styles.addManual} onPress={addManualItem}>
                <VixText heading="bold" additionalStyle={styles.addManualText}>
                  ＋ Item manual
                </VixText>
              </PressableScale>

              <View style={styles.invoiceTotalRow}>
                <VixText heading="bold">Total</VixText>
                <VixText
                  heading="bold"
                  additionalStyle={styles.invoiceTotalValue}>
                  {formatRupiah(invoiceTotal(toInvoiceItems()))}
                </VixText>
              </View>
            </View>

            <FormError message={error} />

            {!isNew && (
              <InlineDelete
                label="Hapus proyek ini"
                busy={busy}
                onDelete={handleDelete}
              />
            )}
          </KeyboardAwareScrollView>

          <View style={styles.footer}>
            <DualButtons
              confirmLabel="Simpan"
              busy={busy}
              onCancel={() => router.back()}
              onConfirm={handleSave}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 12 },
  reqInput: { minHeight: 90, textAlignVertical: 'top', marginBottom: 12 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  doneText: { color: Color.TEXT_TITLE },
  invoiceSection: {
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    gap: 8,
  },
  invoiceHint: { color: Color.TEXT_LABEL },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemCard: {
    backgroundColor: Color.CONTAINER,
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
    paddingTop: 10,
  },
  invoiceTotalValue: { color: Color.MAIN_DARK },
  // Tombol Batal/Simpan dipatok di bawah layar — sama seperti footer
  // SheetModal, jadi rasanya tidak berubah dari modal yang dulu.
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    backgroundColor: Color.BACKGROUND,
  },
});
