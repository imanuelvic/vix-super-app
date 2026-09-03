import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { attentionBorder, AttentionMark } from '@/components/common/Badge';
import { CopyChip, CopyConfirm } from '@/components/common/CopyAction';
import { DateField } from '@/components/common/DateField';
import { EditFooter } from '@/components/common/EditFooter';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useDueJump } from '@/hooks/useDueJump';
import { useFormSave } from '@/hooks/useFormSave';
import {
  addDataPlan,
  daysLeft,
  PLAN_ALERT_DAYS,
  deleteDataPlan,
  deviceMeta,
  isActivePlan,
  quotaLeft,
  quotaRatio,
  renewedPlan,
  updateDataPlan,
  usagePerDay,
  type DataPlan,
  type DeviceKey,
  type PlanInput,
} from '@/lib/device';
import { formatDate, groupDigits, parseAmount, sameMonth } from '@/lib/format';
import { formatRupiah } from '@/lib/transactions';

/** "28" / "1,5" → angka GB. Koma & titik sama-sama diterima. */
function parseGb(text: string): number {
  const n = Number(text.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 28 → "28 GB", 1.5 → "1,5 GB" (koma, seperti kebiasaan tulis di sini). */
export function formatGb(gb: number): string {
  const bulat = Math.round(gb * 10) / 10;
  return `${String(bulat).replace('.', ',')} GB`;
}

// Satu perangkat, satu tab: daftar paket kuota yang pernah & sedang dipakai.
//
// Kartu paling atas adalah paket yang SEDANG berjalan — itu yang biasanya
// dicari saat membuka fitur ini ("sisa berapa, habis kapan"). Sisanya riwayat.
export function PlanTab({
  device,
  plans,
  now,
}: {
  device: DeviceKey;
  plans: DataPlan[];
  now: Date;
}) {
  const { user } = useAuth();
  const meta = deviceMeta(device);
  const milik = plans.filter((p) => p.device === device);

  // Buka sub-tab ini → daftarnya langsung datang ke paket yang menyalakan
  // badge merahnya (aktif & sudah H-1). Ambangnya sama dengan penandanya.
  const { ref: listRef, setRowY, onContentSizeChange } = useDueJump(
    milik.find(
      (p) => isActivePlan(p, now) && daysLeft(p, now) <= PLAN_ALERT_DAYS,
    )?.id ?? null,
  );

  const [editing, setEditing] = useState<DataPlan | 'new' | null>(null);
  const [fName, setFName] = useState('');
  const [fProvider, setFProvider] = useState('');
  const [fQuota, setFQuota] = useState('');
  const [fUsed, setFUsed] = useState('');
  const [fCost, setFCost] = useState('');
  const [fStart, setFStart] = useState(new Date());
  const [fEnd, setFEnd] = useState(new Date());
  const [fNote, setFNote] = useState('');
  const { busy, setBusy, formError, setFormError, save } = useFormSave();
  // Konfirmasi salin — INLINE di dalam modal, bukan modal baru: modal di atas
  // modal tidak muncul di iOS. Pola yang sama dengan tombol 📋 di Finance.
  const [confirmCopy, setConfirmCopy] = useState(false);

  // Total biaya paket yang MULAI bulan ini — angka yang paling sering
  // ditanyakan sendiri: "bulan ini habis berapa buat kuota?"
  const biayaBulanIni = milik
    .filter((p) => sameMonth(p.startDate.toDate(), now))
    .reduce((sum, p) => sum + p.cost, 0);

  /** Isian form apa adanya — dipakai Simpan maupun Salin. */
  function formValues(): PlanInput {
    return {
      device,
      name: fName.trim(),
      provider: fProvider.trim(),
      quotaGb: parseGb(fQuota),
      usedGb: parseGb(fUsed),
      cost: parseAmount(fCost),
      startDate: fStart,
      endDate: fEnd,
      note: fNote.trim(),
    };
  }

  /** Isian yang wajib benar sebelum disimpan — "" kalau sudah beres. */
  function validate(): string {
    if (!fName.trim()) return 'Nama paketnya diisi dulu ya.';
    if (parseGb(fQuota) <= 0) return 'Kuotanya berapa GB? Isi angkanya dulu.';
    if (fEnd.getTime() < fStart.getTime()) {
      return 'Tanggal habisnya tidak boleh sebelum tanggal mulai.';
    }
    return '';
  }

  function openAdd() {
    setEditing('new');
    setConfirmCopy(false);
    setFName('');
    setFProvider('');
    setFQuota('');
    setFUsed('');
    setFCost('');
    setFStart(new Date());
    setFEnd(new Date());
    setFNote('');
    setFormError(null);
  }

  function openEdit(item: DataPlan) {
    setEditing(item);
    setConfirmCopy(false);
    setFName(item.name);
    setFProvider(item.provider);
    setFQuota(String(item.quotaGb).replace('.', ','));
    setFUsed(item.usedGb > 0 ? String(item.usedGb).replace('.', ',') : '');
    setFCost(item.cost > 0 ? groupDigits(String(item.cost)) : '');
    setFStart(item.startDate.toDate());
    setFEnd(item.endDate.toDate());
    setFNote(item.note);
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    const salah = validate();
    if (salah) {
      setFormError(salah);
      return;
    }
    const data = formValues();
    await save(async () => {
      if (editing === 'new') {
        await addDataPlan(user.uid, data);
      } else {
        await updateDataPlan(user.uid, editing.id, data);
      }
      setEditing(null);
    });
  }

  /**
   * Salin paket yang sedang dibuka jadi paket BARU untuk periode berikutnya —
   * dipakai tiap kali paket yang sama diperpanjang. Isinya persis seperti yang
   * tampil di modal, kecuali pemakaiannya kembali 0 & tanggalnya mulai hari ini
   * (lihat renewedPlan di lib/device.ts). Paket aslinya tidak diubah sama
   * sekali — riwayat bulan lalu tetap utuh.
   */
  async function handleCopy() {
    if (!user || !editing || busy) return;
    const salah = validate();
    if (salah) {
      setFormError(salah);
      setConfirmCopy(false);
      return;
    }
    await save(async () => {
      await addDataPlan(user.uid, renewedPlan(formValues(), new Date()));
      setConfirmCopy(false);
      setEditing(null);
    });
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await deleteDataPlan(user.uid, editing.id);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        ref={listRef}
        onContentSizeChange={onContentSizeChange}
        contentContainerStyle={styles.content}>
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            {meta.icon} Paket {meta.label} bulan ini
          </VixText>
          <VixText heading="subheader" additionalStyle={summaryText.value}>
            {formatRupiah(biayaBulanIni)}
          </VixText>
        </SummaryCard>

        <PrimaryButton
          label="Catat Paket / Isi Pulsa"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {milik.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada paket tercatat. Catat paket yang sedang aktif di {meta.label} 📶
          </VixText>
        )}

        {milik.map((p) => {
          const aktif = isActivePlan(p, now);
          const sisaHari = daysLeft(p, now);
          const perHari = usagePerDay(p, now);
          // Penyebab badge-nya — dihitung sekali, dipakai garis merah & titik.
          const perluIsi = aktif && sisaHari <= PLAN_ALERT_DAYS;
          return (
            <PressableScale
              key={p.id}
              style={[
                styles.card,
                aktif && styles.cardActive,
                attentionBorder(perluIsi),
              ]}
              onLayout={(e) => setRowY(p.id, e.nativeEvent.layout.y)}
              onPress={() => openEdit(p)}>
              {/* Paket AKTIF yang sudah H-1 = yang dihitung badge merah tile
                  Device & sub-tabnya (PLAN_ALERT_DAYS). Ambangnya diambil dari
                  lib yang sama supaya tak pernah beda dari angka badge-nya. */}
              {perluIsi && <AttentionMark corner />}
              <View style={styles.cardTop}>
                <VixText heading="bold" additionalStyle={styles.cardTitle}>
                  {p.name}
                </VixText>
                <VixText heading="label" additionalStyle={styles.cardCost}>
                  {formatRupiah(p.cost)}
                </VixText>
              </View>
              {p.provider ? (
                <VixText heading="label">{p.provider}</VixText>
              ) : null}

              {/* Sisa kuota — angka yang dicari duluan tiap kali fitur ini
                  dibuka, jadi ia yang paling besar di kartunya. */}
              <VixText heading="subheader" additionalStyle={styles.quotaLeft}>
                {formatGb(quotaLeft(p))}{' '}
                <VixText heading="label">dari {formatGb(p.quotaGb)}</VixText>
              </VixText>
              <ProgressBar
                value={quotaRatio(p)}
                total={1}
                color={aktif ? Color.MAIN : Color.TEXT_LABEL}
              />

              <View style={styles.cardMeta}>
                <VixText heading="label">
                  📆 {formatDate(p.startDate.toDate())} →{' '}
                  {formatDate(p.endDate.toDate())}
                </VixText>
                {/* Sisa hari & rata-rata pemakaian berdiri berdampingan
                    dengan sengaja: dua-duanya baru berarti kalau dibaca
                    bersama ("sisa 8 GB / 12 hari, sehari 1,2 GB" = kurang). */}
                <VixText
                  heading="label"
                  additionalStyle={aktif ? styles.metaOn : styles.metaOff}>
                  {aktif
                    ? sisaHari === 0
                      ? '⏳ habis hari ini'
                      : `⏳ sisa ${sisaHari} hari`
                    : '🔚 sudah lewat'}
                  {perHari !== null ? ` · ±${formatGb(perHari)}/hari` : ''}
                </VixText>
              </View>
              {p.note ? <VixText heading="label">{p.note}</VixText> : null}
            </PressableScale>
          );
        })}
      </ScrollView>

      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catat Paket' : 'Edit Paket'}
        subtitle={`${meta.icon} ${meta.label}`}
        onClose={() => setEditing(null)}
        headerRight={
          // 📋 hanya saat MENGUBAH paket yang sudah ada — menyalin paket yang
          // belum tersimpan tidak ada gunanya (isinya masih di form).
          editing && editing !== 'new' ? (
            <CopyChip onPress={() => setConfirmCopy(true)} disabled={busy} />
          ) : undefined
        }>
        {confirmCopy && (
          <CopyConfirm
            title="📋 Salin jadi paket baru?"
            busy={busy}
            onCancel={() => setConfirmCopy(false)}
            onConfirm={handleCopy}
          />
        )}
        <FormInput
          style={styles.formGap}
          placeholder="Nama paket (mis. Super Seru Internet)"
          value={fName}
          onChangeText={setFName}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Operator & nomor (opsional)"
          value={fProvider}
          onChangeText={setFProvider}
          editable={!busy}
        />
        <View style={[styles.row, styles.formGap]}>
          <FormInput
            style={styles.rowItem}
            placeholder="Kuota (GB)"
            value={fQuota}
            onChangeText={setFQuota}
            keyboardType="decimal-pad"
            editable={!busy}
          />
          <FormInput
            style={styles.rowItem}
            placeholder="Terpakai (GB)"
            value={fUsed}
            onChangeText={setFUsed}
            keyboardType="decimal-pad"
            editable={!busy}
          />
        </View>
        <MoneyInput
          style={styles.formGap}
          placeholder="Harga paket"
          value={fCost}
          onChangeText={(t) => setFCost(groupDigits(t))}
          editable={!busy}
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Mulai berlaku
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={`s-${editing === 'new' ? 'new' : editing?.id}`}
            value={fStart}
            onChange={setFStart}
          />
        </View>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Habis tanggal
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={`e-${editing === 'new' ? 'new' : editing?.id}`}
            value={fEnd}
            onChange={setFEnd}
          />
        </View>
        <FormInput
          style={styles.formGap}
          placeholder="Catatan (opsional)"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />
        <FormError message={formError} />
        <EditFooter
          editing={editing}
          deleteLabel="Hapus paket ini"
          busy={busy}
          onDelete={handleDelete}
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
  addButton: { marginTop: 12, marginBottom: 12 },
  empty: { textAlign: 'center', marginVertical: 10 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  // Paket yang sedang berjalan diberi garis tepi hijau — bedanya harus
  // kelihatan sebelum tulisannya dibaca.
  cardActive: { borderColor: Color.MAIN, borderWidth: 1.5 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardTitle: { color: Color.TEXT_TITLE, flex: 1 },
  cardCost: { color: Color.FINANCE_EXPENSE_DARK },
  quotaLeft: { color: Color.TEXT_TITLE },
  cardMeta: { gap: 2 },
  metaOn: { color: Color.MAIN_DARK },
  metaOff: { color: Color.TEXT_LABEL },
  row: { flexDirection: 'row', gap: 10 },
  rowItem: { flex: 1 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
});
