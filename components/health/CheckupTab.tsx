import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatDate } from '@/lib/format';
import {
  addCheckup,
  CHECKUP_DUE_DAYS,
  CHECKUP_TYPES,
  deleteCheckup,
  updateCheckup,
  type Checkup,
  type CheckupType,
} from '@/lib/health';

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
      setFormError('Gagal menyimpan. Cek koneksi internet.');
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
      <ScrollView contentContainerStyle={styles.content}>
        {/* Tombol menuju riwayat sakit & info kesehatan */}
        <View style={styles.navRow}>
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
          <PressableScale
            style={styles.navButton}
            onPress={() => router.push('/health-info')}>
            <VixText heading="bold" additionalStyle={styles.navText}>
              💊 Info
            </VixText>
            <VixText heading="label" additionalStyle={styles.navText}>
              QnA & tips sehat
            </VixText>
          </PressableScale>
        </View>

        {/* ===== Informasi penting: pengecekan terakhir per jenis ===== */}
        {CHECKUP_TYPES.map((meta) => (
          <StatusCard
            key={meta.key}
            meta={meta}
            latest={latestByType.get(meta.key)}
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
        {checkups.map((c) => {
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
      </ScrollView>

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

// Kartu "informasi penting": kapan terakhir jenis ini diperiksa.
function StatusCard({
  meta,
  latest,
}: {
  meta: (typeof CHECKUP_TYPES)[number];
  latest?: Checkup;
}) {
  if (!latest) {
    return (
      <View style={[styles.statusCard, styles.statusWarn]}>
        <VixText heading="bold" additionalStyle={styles.statusTitle}>
          {meta.icon} {meta.label}
        </VixText>
        <VixText heading="label" additionalStyle={styles.warnText}>
          ⚠️ Belum pernah dicatat — segera periksa dan catat di bawah.
        </VixText>
      </View>
    );
  }

  const days = Math.max(
    0,
    Math.floor((Date.now() - latest.date.toDate().getTime()) / 86_400_000),
  );
  const due = days > CHECKUP_DUE_DAYS;
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
      <VixText heading="label">
        Terakhir dicek: {formatDate(latest.date.toDate())} · {days} hari lalu
      </VixText>
      {due && (
        <VixText heading="label" additionalStyle={styles.warnText}>
          ⚠️ Sudah lebih dari {CHECKUP_DUE_DAYS} hari — waktunya cek lagi.
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  navText: { color: Color.ACCENT_DARK },
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
