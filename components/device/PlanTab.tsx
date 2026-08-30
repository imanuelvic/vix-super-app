import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
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
import { useFormSave } from '@/hooks/useFormSave';
import {
  addDataPlan,
  daysLeft,
  deleteDataPlan,
  deviceMeta,
  isActivePlan,
  quotaLeft,
  quotaRatio,
  updateDataPlan,
  usagePerDay,
  type DataPlan,
  type DeviceKey,
} from '@/lib/device';
import { formatDate, groupDigits, parseAmount } from '@/lib/format';
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

  // Total biaya paket yang MULAI bulan ini — angka yang paling sering
  // ditanyakan sendiri: "bulan ini habis berapa buat kuota?"
  const biayaBulanIni = milik
    .filter((p) => {
      const d = p.startDate.toDate();
      return (
        d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      );
    })
    .reduce((sum, p) => sum + p.cost, 0);

  function openAdd() {
    setEditing('new');
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
    if (!fName.trim()) {
      setFormError('Nama paketnya diisi dulu ya.');
      return;
    }
    if (parseGb(fQuota) <= 0) {
      setFormError('Kuotanya berapa GB? Isi angkanya dulu.');
      return;
    }
    if (fEnd.getTime() < fStart.getTime()) {
      setFormError('Tanggal habisnya tidak boleh sebelum tanggal mulai.');
      return;
    }
    const data = {
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
    await save(async () => {
      if (editing === 'new') {
        await addDataPlan(user.uid, data);
      } else {
        await updateDataPlan(user.uid, editing.id, data);
      }
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
      <ScrollView contentContainerStyle={styles.content}>
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
          return (
            <PressableScale
              key={p.id}
              style={[styles.card, aktif && styles.cardActive]}
              onPress={() => openEdit(p)}>
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
        onClose={() => setEditing(null)}>
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
