import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { checkupSummary } from '@/components/health/CheckupStatusCard';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import { formatDate } from '@/lib/format';
import {
    addCheckup,
    CHECKUP_TYPES,
    deleteCheckup,
    updateCheckup,
    type Checkup,
    type CheckupType,
} from '@/lib/health';
import { SAVE_ERROR } from '@/lib/messages';

const TYPE_META = Object.fromEntries(
  CHECKUP_TYPES.map((t) => [t.key, t]),
) as Record<CheckupType, (typeof CHECKUP_TYPES)[number]>;

// Tab Check-up: kapan terakhir periksa tekanan darah & gula darah,
// plus riwayat lengkap pemeriksaan.
export function CheckupTab({ checkups }: { checkups: Checkup[] }) {
  const router = useRouter();
  const { user } = useAuth();

  // Form catat pemeriksaan baru (muncul di bottom sheet saat tombol ditekan).
  const [addOpen, setAddOpen] = useState(false);
  const [type, setType] = useState<CheckupType>('tensi');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal edit + konfirmasi hapus.
  const [editing, setEditing] = useState<Checkup | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [busy, setBusy] = useState(false);

  // Pemeriksaan terakhir per jenis (list sudah urut tanggal desc).
  const latestByType = useMemo(() => {
    const map = new Map<CheckupType, Checkup>();
    for (const c of checkups) {
      if (!map.has(c.type)) map.set(c.type, c);
    }
    return map;
  }, [checkups]);

  const { setPage, currentPage, pageCount, pageItems } =
    usePagination(checkups);

  async function handleAdd() {
    if (!user || saving) return;
    if (!value.trim()) {
      setFormError('Hasil pemeriksaan wajib diisi.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await addCheckup(user.uid, {
        type,
        value: value.trim(),
        note: note.trim(),
        date,
      });
      setValue('');
      setNote('');
      setDate(new Date());
      setAddOpen(false); // tutup sheet → langsung terlihat masuk ke Riwayat
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  // Buka bottom sheet catat pemeriksaan dengan form yang bersih.
  function openAdd() {
    setType('tensi');
    setValue('');
    setNote('');
    setDate(new Date());
    setFormError(null);
    setAddOpen(true);
  }

  function openEdit(c: Checkup) {
    setEditing(c);
    setEditValue(c.value);
    setEditNote(c.note);
    setEditDate(c.date.toDate());
  }

  async function handleSaveEdit() {
    if (!user || !editing || busy) return;
    if (!editValue.trim()) return;
    setBusy(true);
    try {
      await updateCheckup(user.uid, editing.id, {
        value: editValue.trim(),
        note: editNote.trim(),
        date: editDate,
      });
      setEditing(null);
    } catch {
      // Modal tetap terbuka supaya isian tidak hilang.
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || busy) return;
    setBusy(true);
    try {
      await deleteCheckup(user.uid, editing.id);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {/* Tombol menuju riwayat sakit & donor darah. (Info kesehatan kini ada
            di tombol kanan atas layar Health.) */}
        <View style={styles.navRow}>
          <PressableScale
            style={[styles.navButton, styles.navButtonDonor]}
            onPress={() => router.push('/donor')}>
            <VixText heading="bold" additionalStyle={styles.navTextDonor}>
              🩸 Donor
            </VixText>
          </PressableScale>
          <PressableScale
            style={styles.navButton}
            onPress={() => router.push('/diseases')}>
            <VixText heading="bold" additionalStyle={styles.navText}>
              🤧 Disease
            </VixText>
          </PressableScale>
        </View>

        {/* ===== Hasil terakhir — SATU kotak, dua angka =====
            Dulu dua kartu panjang berjajar ke bawah dan memakan hampir
            seluruh layar: tombol "Catat Pemeriksaan" & riwayatnya harus
            digulung jauh dulu. Sekarang ringkas — keterangan lengkapnya
            (nilai normal, tips, jadwal berikutnya) satu klik di halaman
            sendiri. Titik ⚠️ muncul kalau ada yang di luar normal atau sudah
            waktunya dicek lagi, jadi yang penting tetap terlihat dari sini. */}
        <PressableScale
          style={styles.summaryCard}
          onPress={() => router.push('/checkup-status')}>
          <View style={styles.summaryRow}>
            {CHECKUP_TYPES.map((meta) => {
              const s = checkupSummary(meta.key, latestByType.get(meta.key));
              return (
                <View key={meta.key} style={styles.summaryItem}>
                  <VixText heading="label" additionalStyle={styles.summaryLabel}>
                    {meta.icon} {meta.label}
                    {s.perhatian ? ' ⚠️' : ''}
                  </VixText>
                  <VixText
                    heading="subheader"
                    additionalStyle={
                      s.perhatian ? styles.summaryWarn : styles.summaryValue
                    }>
                    {s.value}
                  </VixText>
                </View>
              );
            })}
          </View>
          <VixText heading="label" additionalStyle={styles.summaryHint}>
            Lihat nilai normal, tips & jadwal cek berikutnya ›
          </VixText>
        </PressableScale>

        {/* ===== Catat pemeriksaan baru → buka bottom sheet ===== */}
        <PrimaryButton
          label="Catat Pemeriksaan"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {/* ===== Riwayat ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Riwayat
        </VixText>
        {checkups.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan pemeriksaan.
          </VixText>
        )}
        {pageItems.map((c) => {
          const meta = TYPE_META[c.type];
          return (
            // Tekan untuk edit/hapus lewat bottom sheet.
            <PressableScale key={c.id} style={styles.row} onPress={() => openEdit(c)}>
              <View style={styles.rowLeft}>
                <VixText heading="bold" additionalStyle={styles.rowTitle}>
                  {meta.icon} {meta.label}
                </VixText>
                <VixText heading="label">
                  {formatDate(c.date.toDate())}
                  {c.note ? ` · ${c.note}` : ''}
                </VixText>
              </View>
              <VixText heading="bold" additionalStyle={styles.rowValue}>
                {c.value}
              </VixText>
            </PressableScale>
          );
        })}

        <Pagination
          page={currentPage}
          pageCount={pageCount}
          onChange={setPage}
        />
      </KeyboardAwareScrollView>

      {/* Bottom sheet catat pemeriksaan baru */}
      <SheetModal
        visible={addOpen}
        title="Catat Pemeriksaan"
        subtitle="Simpan hasil tekanan / gula darah"
        onClose={() => setAddOpen(false)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Jenis pemeriksaan
        </VixText>
        <View style={styles.chipRow}>
          {CHECKUP_TYPES.map((meta) => (
            <Chip
              key={meta.key}
              label={`${meta.icon} ${meta.label}`}
              active={type === meta.key}
              onPress={() => setType(meta.key)}
              additionalStyle={styles.chipFlex}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Hasil pemeriksaan
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder={type === 'tensi' ? 'mis. 120/80' : 'mis. 103'}
          value={value}
          onChangeText={setValue}
          editable={!saving}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Catatan (opsional)
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Catatan"
          value={note}
          onChangeText={setNote}
          editable={!saving}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal
        </VixText>
        <View style={styles.formGap}>
          <DateField value={date} onChange={setDate} />
        </View>

        <FormError message={formError} />
        <DualButtons
          confirmLabel="Simpan"
          busy={saving}
          onCancel={() => setAddOpen(false)}
          onConfirm={handleAdd}
        />
      </SheetModal>

      {/* Bottom sheet edit pemeriksaan */}
      <SheetModal
        visible={!!editing}
        title="Edit Pemeriksaan"
        subtitle={editing ? `${TYPE_META[editing.type].icon} ${TYPE_META[editing.type].label}` : undefined}
        onClose={() => setEditing(null)}>
        <FormInput
          style={styles.formGap}
          placeholder="Hasil pemeriksaan"
          value={editValue}
          onChangeText={setEditValue}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Catatan"
          value={editNote}
          onChangeText={setEditNote}
          editable={!busy}
        />
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal ikut reset tiap ganti item */}
          <DateField key={editing?.id} value={editDate} onChange={setEditDate} />
        </View>
        <EditDelete
          editing={editing}
          label="Hapus pemeriksaan ini"
          busy={busy}
          onDelete={handleDelete}
        />
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSaveEdit}
        />
      </SheetModal>

    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  navRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  navButton: {
    flex: 1,
    backgroundColor: Color.ACCENT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.ACCENT_DARK,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 2,
  },
  navText: { color: Color.ACCENT_DARK },
  navButtonDonor: {
    backgroundColor: Color.FINANCE_EXPENSE,
    borderColor: Color.FINANCE_EXPENSE_DARK,
  },
  navTextDonor: { color: Color.DANGER },
  // Kotak ringkas hasil terakhir — dua angka berdampingan, satu klik ke
  // halaman keterangan lengkapnya.
  summaryCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryItem: { flex: 1, gap: 2 },
  summaryLabel: { color: Color.TEXT_LABEL },
  summaryValue: { color: Color.MAIN_DARK },
  summaryWarn: { color: Color.DANGER },
  summaryHint: { color: Color.TEXT_LABEL },
  sectionTitle: { ...SECTION_SPACE },
  addButton: { marginTop: 4, marginBottom: 4 },
  fieldLabel: { marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  chipFlex: { flex: 1 },
  formGap: { marginBottom: 10 },
  empty: { textAlign: 'center', marginVertical: 10 },
  row: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowTitle: { color: Color.TEXT_TITLE },
  rowValue: { color: Color.MAIN_DARK },
});
