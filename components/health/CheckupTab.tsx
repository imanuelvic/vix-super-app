import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { InlineDelete } from '@/components/common/InlineDelete';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import { formatDate } from '@/lib/format';
import {
  addCheckup,
  checkupDaysUntil,
  checkupNextDate,
  CHECKUP_INFO,
  CHECKUP_TYPES,
  deleteCheckup,
  evaluateCheckup,
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

  // Form catat pemeriksaan baru.
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
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
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
        {/* Tombol menuju riwayat sakit, donor darah & info kesehatan */}
        <View style={styles.navRow}>
          <PressableScale
            style={[styles.navButton, styles.navButtonInfo]}
            onPress={() => router.push('/health-info')}>
            <VixText heading="bold" additionalStyle={styles.navTextInfo}>
              💪🏻 Info
            </VixText>
            <VixText heading="label" additionalStyle={styles.navTextInfo}>
              QnA & tips
            </VixText>
          </PressableScale>
          <PressableScale
            style={[styles.navButton, styles.navButtonDonor]}
            onPress={() => router.push('/donor')}>
            <VixText heading="bold" additionalStyle={styles.navTextDonor}>
              🩸 Donor
            </VixText>
            <VixText heading="label" additionalStyle={styles.navTextDonor}>
              Jadwal donor
            </VixText>
          </PressableScale>
          <PressableScale
            style={styles.navButton}
            onPress={() => router.push('/diseases')}>
            <VixText heading="bold" additionalStyle={styles.navText}>
              🤧 Disease
            </VixText>
            <VixText heading="label" additionalStyle={styles.navText}>
              Riwayat sakit
            </VixText>
          </PressableScale>
        </View>

        {/* ===== Informasi penting: pengecekan terakhir per jenis ===== */}
        {CHECKUP_TYPES.map((meta) => (
          <StatusCard
            key={meta.key}
            meta={meta}
            latest={latestByType.get(meta.key)}
            onInfo={() => router.push('/health-info')}
          />
        ))}

        {/* ===== Catat pemeriksaan baru ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Catat Pemeriksaan
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
        <FormInput
          style={styles.formGap}
          placeholder="Hasil pemeriksaan"
          value={value}
          onChangeText={setValue}
          editable={!saving}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Catatan"
          value={note}
          onChangeText={setNote}
          editable={!saving}
        />
        <View style={styles.formGap}>
          <DateField value={date} onChange={setDate} />
        </View>
        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        <PrimaryButton label="Simpan" busy={saving} onPress={handleAdd} />

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
        {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
        <InlineDelete
          key={editing?.id}
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

// Kartu "informasi penting": nilai normal, hasil terakhir + evaluasinya,
// kapan terakhir diperiksa, dan (kalau tidak normal) tips + tombol Info.
function StatusCard({
  meta,
  latest,
  onInfo,
}: {
  meta: (typeof CHECKUP_TYPES)[number];
  latest?: Checkup;
  onInfo: () => void;
}) {
  const info = CHECKUP_INFO[meta.key];
  if (!latest) {
    return (
      <View style={[styles.statusCard, styles.statusWarn]}>
        <VixText heading="bold" additionalStyle={styles.statusTitle}>
          {meta.icon} {meta.label}
        </VixText>
        <VixText heading="label" additionalStyle={styles.normalText}>
          Normal: {info.normal}
        </VixText>
        <VixText heading="label" additionalStyle={styles.warnText}>
          ⚠️ Belum pernah dicatat — segera periksa dan catat di bawah.
        </VixText>
      </View>
    );
  }

  const daysUntil = checkupDaysUntil(latest, new Date());
  const due = daysUntil <= 0;
  const nextDate = checkupNextDate(latest);
  const result = evaluateCheckup(meta.key, latest.value);
  const abnormal = result.status === 'high' || result.status === 'low';
  return (
    <View style={[styles.statusCard, due && styles.statusWarn]}>
      <View style={styles.statusHeader}>
        <VixText heading="bold" additionalStyle={styles.statusTitle}>
          {meta.icon} {meta.label}
        </VixText>
        <VixText heading="subheader" additionalStyle={styles.statusValue}>
          {latest.value}
        </VixText>
      </View>
      <VixText heading="label" additionalStyle={styles.normalText}>
        Normal: {info.normal}
      </VixText>
      {result.label ? (
        <VixText
          heading="bold"
          additionalStyle={result.status === 'normal' ? styles.okText : styles.abnormalText}>
          Hasil terakhir: {result.label}
        </VixText>
      ) : null}
      <VixText heading="label">
        Terakhir dicek: {formatDate(latest.date.toDate())}
      </VixText>
      {/* Kalau hasil terakhir tidak normal → tips + arahkan ke halaman Info */}
      {abnormal && result.tip ? (
        <View style={styles.adviceBox}>
          <VixText heading="label" additionalStyle={styles.adviceText}>
            💡 {result.tip}
          </VixText>
        </View>
      ) : null}
      {due ? (
        <VixText heading="label" additionalStyle={styles.warnText}>
          ⚠️ Waktunya cek lagi! Jadwal 6 bulan ({formatDate(nextDate)}) sudah
          {daysUntil === 0 ? ' tiba hari ini' : ` lewat ${-daysUntil} hari`}.
        </VixText>
      ) : (
        <VixText heading="label" additionalStyle={styles.nextText}>
          🗓️ Cek lagi: {formatDate(nextDate)} · {daysUntil} hari lagi
        </VixText>
      )}
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
    paddingVertical: 12,
    gap: 2,
  },
  navText: { color: Color.ACCENT_DARK },
  navButtonDonor: {
    backgroundColor: Color.FINANCE_EXPENSE,
    borderColor: Color.FINANCE_EXPENSE_DARK,
  },
  navTextDonor: { color: Color.DANGER },
  // Info → biru (warna informasi).
  navButtonInfo: {
    backgroundColor: Color.FINANCE_INVESTMENT,
    borderColor: Color.FINANCE_INVESTMENT_DARK,
  },
  navTextInfo: { color: Color.FINANCE_INVESTMENT_DARK },
  statusCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 10,
    gap: 4,
  },
  statusWarn: {
    backgroundColor: Color.WARNING_TRANSPARENT,
    borderColor: Color.WARNING,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusTitle: { color: Color.TEXT_TITLE },
  statusValue: { color: Color.MAIN_DARK },
  warnText: { color: Color.WARNING },
  nextText: { color: Color.MAIN_DARK },
  normalText: { color: Color.TEXT_LABEL },
  okText: { color: Color.SUCCESS },
  abnormalText: { color: Color.DANGER },
  adviceBox: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 2,
  },
  adviceText: { color: Color.TEXT_PARAGRAPH },
  sectionTitle: { marginTop: 10, marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  chipFlex: { flex: 1 },
  formGap: { marginBottom: 10 },
  error: { color: Color.DANGER, marginBottom: 8 },
  empty: { textAlign: 'center', marginVertical: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowLeft: { flex: 1, gap: 2 },
  rowTitle: { color: Color.TEXT_TITLE },
  rowValue: { color: Color.MAIN_DARK },
});
