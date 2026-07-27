import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';
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
import {
  newCareerId,
  ROADMAP_STATUS,
  roadmapDaysUntil,
  saveRoadmap,
  type RoadmapItem,
  type RoadmapStatus,
} from '@/lib/career';
import { formatDate } from '@/lib/format';

// Deadline default untuk prioritas baru: seminggu dari sekarang.
function defaultDeadline(): Date {
  return new Date(Date.now() + 7 * 86_400_000);
}

const STATUS_META = Object.fromEntries(
  ROADMAP_STATUS.map((s) => [s.key, s]),
) as Record<RoadmapStatus, (typeof ROADMAP_STATUS)[number]>;

// Urutan tampil: yang sedang dikerjakan dulu, lalu rencana, terakhir selesai.
const STATUS_ORDER: Record<RoadmapStatus, number> = {
  progress: 0,
  todo: 1,
  done: 2,
};

// Tab Fulltime 💻: roadmap prioritas kerja sebagai Software Engineer /
// Mobile Developer di NDC — biar jelas mana yang dikerjakan duluan.
export function FulltimeTab({ items }: { items: RoadmapItem[] }) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<RoadmapItem | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fNote, setFNote] = useState('');
  const [fPriority, setFPriority] = useState<1 | 2 | 3>(2);
  const [fStatus, setFStatus] = useState<RoadmapStatus>('todo');
  const [fDeadline, setFDeadline] = useState(defaultDeadline());
  const [formError, setFormError] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => {
    if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) {
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    }
    return a.priority - b.priority;
  });
  const doneCount = items.filter((i) => i.status === 'done').length;

  function openAdd() {
    setEditing('new');
    setFTitle('');
    setFNote('');
    setFPriority(2);
    setFStatus('todo');
    setFDeadline(defaultDeadline());
    setFormError(null);
  }

  function openEdit(item: RoadmapItem) {
    setEditing(item);
    setFTitle(item.title);
    setFNote(item.note);
    setFPriority(item.priority);
    setFStatus(item.status);
    setFDeadline(item.deadline ? item.deadline.toDate() : defaultDeadline());
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Isi judul pekerjaannya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: RoadmapItem = {
      id: editing === 'new' ? newCareerId() : editing.id,
      title: fTitle.trim(),
      note: fNote.trim(),
      priority: fPriority,
      status: fStatus,
      deadline: Timestamp.fromDate(fDeadline),
    };
    const next =
      editing === 'new'
        ? [...items, data]
        : items.map((i) => (i.id === editing.id ? data : i));
    try {
      await saveRoadmap(user.uid, next);
      setEditing(null);
    } catch {
      setFormError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveRoadmap(user.uid, items.filter((i) => i.id !== editing.id));
    } catch {
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  function priorityStyle(p: 1 | 2 | 3) {
    return p === 1
      ? styles.p1
      : p === 2
        ? styles.p2
        : styles.p3;
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan roadmap */}
        <View style={styles.heroCard}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            💻 Software Engineer · Mobile Developer NDC
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {doneCount}{' '}
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              dari {items.length} prioritas selesai
            </VixText>
          </VixText>
        </View>

        <PrimaryButton
          label="Tambah Prioritas"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {sorted.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada roadmap — tulis prioritas kerjamu minggu ini 💪
          </VixText>
        )}

        {sorted.map((item) => {
          const meta = STATUS_META[item.status];
          // Info deadline: berapa hari lagi & apakah mendesak (belum selesai
          // dan tinggal ≤ 3 hari / sudah lewat).
          const dl = item.deadline
            ? roadmapDaysUntil(item.deadline, new Date())
            : null;
          const dlWhen =
            dl === null
              ? ''
              : dl === 0
                ? 'HARI INI'
                : dl > 0
                  ? `${dl} hari lagi`
                  : `lewat ${-dl} hari`;
          const dlUrgent = item.status !== 'done' && dl !== null && dl <= 3;
          return (
            // Tekan untuk edit status/prioritas.
            <PressableScale
              key={item.id}
              style={[styles.card, item.status === 'done' && styles.cardDone]}
              onPress={() => openEdit(item)}>
              <View style={styles.cardTop}>
                <View style={[styles.priorityBadge, priorityStyle(item.priority)]}>
                  <VixText heading="label" additionalStyle={styles.priorityText}>
                    P{item.priority}
                  </VixText>
                </View>
                <VixText
                  heading="bold"
                  numberOfLines={2}
                  additionalStyle={styles.cardTitle}>
                  {item.title}
                </VixText>
                <VixText heading="label">
                  {meta.icon} {meta.label}
                </VixText>
              </View>
              {item.note ? (
                <VixText heading="label" numberOfLines={2}>
                  {item.note}
                </VixText>
              ) : null}
              {item.deadline ? (
                <VixText
                  heading="label"
                  additionalStyle={dlUrgent ? styles.deadlineUrgent : styles.deadline}>
                  🗓️ {formatDate(item.deadline.toDate())} · {dlWhen}
                </VixText>
              ) : null}
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Sheet tambah/edit */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Prioritas' : 'Edit Prioritas'}
        onClose={() => setEditing(null)}>
        <FormInput
          style={styles.formGap}
          placeholder="Pekerjaan"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Catatan/konteks (opsional)"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Prioritas (P1 = paling penting)
        </VixText>
        <View style={styles.chipRow}>
          {([1, 2, 3] as const).map((p) => (
            <Chip
              key={p}
              label={`P${p}`}
              active={fPriority === p}
              onPress={() => setFPriority(p)}
              additionalStyle={styles.chipFlex}
            />
          ))}
        </View>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Status
        </VixText>
        <View style={styles.chipRow}>
          {ROADMAP_STATUS.map((s) => (
            <Chip
              key={s.key}
              label={`${s.icon} ${s.label}`}
              active={fStatus === s.key}
              onPress={() => setFStatus(s.key)}
              additionalStyle={styles.chipFlex}
            />
          ))}
        </View>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Deadline
        </VixText>
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal reset tiap ganti item */}
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDeadline}
            onChange={setFDeadline}
          />
        </View>
        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
        {editing !== 'new' && editing !== null && (
          <InlineDelete
            key={editing.id}
            label="Hapus prioritas ini"
            busy={busy}
            onDelete={handleDelete}
          />
        )}
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
  error: { color: Color.DANGER, marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  cardDone: { opacity: 0.55 },
  deadline: { color: Color.TEXT_LABEL },
  deadlineUrgent: { color: Color.DANGER },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  priorityBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  p1: { backgroundColor: Color.DANGER },
  p2: { backgroundColor: Color.WARNING },
  p3: { backgroundColor: Color.TEXT_PLACEHOLDER },
  priorityText: { color: Color.TEXT_REVERSE },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chipFlex: { flex: 1 },
});
