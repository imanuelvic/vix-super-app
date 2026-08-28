import { Timestamp } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useEditParam } from '@/hooks/useEditParam';
import { useFormSave } from '@/hooks/useFormSave';
import {
  CAREER_REMINDER_DAYS,
  effectiveRoadmap,
  newCareerId,
  ROADMAP_STATUS,
  roadmapDaysUntil,
  saveRoadmap,
  type RoadmapItem,
  type RoadmapStatus,
} from '@/lib/career';
import { daysBetween, formatDate, whenLabel } from '@/lib/format';
import { DELETE_ERROR } from '@/lib/messages';

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
export function FulltimeTab({
  items,
  editId,
  onEditConsumed,
}: {
  items: RoadmapItem[];
  // Kalau di-set (dari reminder Home), langsung buka modal edit item ini.
  editId?: string;
  // Dipanggil setelah editId dipakai — induk membersihkan param dari URL.
  onEditConsumed?: () => void;
}) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<RoadmapItem | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fPic, setFPic] = useState('');
  const [fNote, setFNote] = useState('');
  // Yang KAMU pilih di chip. Nilai efektifnya (setelah aturan H-7) diturunkan
  // di bawah — lihat `fPriority` & `fStatus`.
  const [pickPriority, setFPriority] = useState<1 | 2 | 3>(2);
  const [pickStatus, setFStatus] = useState<RoadmapStatus>('todo');
  const [fDeadline, setFDeadline] = useState(defaultDeadline());
  // menekan dengan tenggat).
  const [fBacklog, setFBacklog] = useState(false);

  // ===== Aturan H-7 (mendesak) =====
  // Deadline tinggal ≤ 7 hari (termasuk yang sudah lewat) & belum selesai →
  // otomatis naik ke P1 dan status "Dikerjakan". Keduanya DIKUNCI (tak bisa
  // diubah) selama masih dalam jendela ini — memang sudah mendesak.
  // Backlog (tanpa deadline) & yang sudah Selesai tidak kena aturan ini.
  const urgent =
    !fBacklog &&
    pickStatus !== 'done' &&
    daysBetween(new Date(), fDeadline) <= CAREER_REMINDER_DAYS;

  // Nilai yang DIPAKAI (tampil di chip & yang disimpan). Dihitung saat render
  // dari pilihanmu + jendela H-7, bukan didorong balik ke state lewat efek.
  //
  // Hasilnya sama persis — `handleSave` memang sudah menegakkan aturan ini
  // sendiri — tapi tanpa efek, aturannya berlaku "SELAMA masih H-7" seperti
  // yang tertulis di atas. Dulu, sekali efeknya jalan, P1-nya menempel walau
  // deadline-nya kamu geser jauh lagi.
  const fPriority: 1 | 2 | 3 = urgent ? 1 : pickPriority;
  const fStatus: RoadmapStatus =
    urgent && pickStatus === 'todo' ? 'progress' : pickStatus;

  // Sudah Selesai → pilihan deadline/backlog disembunyikan (tidak relevan lagi).
  const isDone = fStatus === 'done';

  // Papan ala Trello: satu kolom per status, dipilih lewat segment atas.
  const [board, setBoard] = useState<RoadmapStatus>('progress');

  // Tampilan & urutan memakai prioritas/status EFEKTIF: item yang sudah H-7
  // otomatis tampil P1 & "Dikerjakan" tanpa perlu dibuka & disimpan ulang.
  const today = new Date();
  const sorted = items
    .map((i) => effectiveRoadmap(i, today))
    .sort((a, b) => {
      if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) {
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      }
      return a.priority - b.priority;
    });
  const doneCount = items.filter((i) => i.status === 'done').length;

  // Isi tiap kolom papan + berapa kartu yang sudah mendesak (H-7 / lewat).
  const columnOf = (status: RoadmapStatus) =>
    sorted.filter((i) => i.status === status);
  const urgentIn = (status: RoadmapStatus) =>
    columnOf(status).filter(
      (i) =>
        status !== 'done' &&
        i.deadline != null &&
        roadmapDaysUntil(i.deadline, today) <= CAREER_REMINDER_DAYS,
    ).length;
  const column = columnOf(board);

  function openAdd() {
    setEditing('new');
    setFTitle('');
    setFPic('');
    setFNote('');
    setFPriority(2);
    setFStatus('todo');
    setFDeadline(defaultDeadline());
    setFBacklog(false);
    setFormError(null);
  }

  const openEdit = useCallback((item: RoadmapItem) => {
    setEditing(item);
    setFTitle(item.title);
    setFPic(item.pic ?? '');
    setFNote(item.note);
    setFPriority(item.priority);
    setFStatus(item.status);
    setFDeadline(item.deadline ? item.deadline.toDate() : defaultDeadline());
    setFBacklog(!item.deadline);
    setFormError(null);
    // setFormError datang dari useFormSave. Isinya setter useState (tetap
    // sepanjang hidup komponen), tapi lewat batas hook lint tak bisa
    // memastikannya — jadi disebut saja, tidak ada bedanya saat berjalan.
  }, [setFormError]);

  // Auto-buka modal edit saat dibuka dari reminder Home (?edit=<id>).
  // Aturannya milik bersama — lihat hooks/useEditParam.ts.
  useEditParam(items, openEdit, editId, onEditConsumed);

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Isi judul pekerjaannya dulu.');
      return;
    }
    const data: RoadmapItem = {
      id: editing === 'new' ? newCareerId() : editing.id,
      title: fTitle.trim(),
      pic: fPic.trim(), // string kosong = tanpa PIC (hindari undefined ke Firestore)
      note: fNote.trim(),
      // Sudah termasuk aturan H-7 (lihat penurunannya di atas).
      priority: fPriority,
      status: fStatus,
      deadline: fBacklog ? null : Timestamp.fromDate(fDeadline),
    };
    const next =
      editing === 'new'
        ? [...items, data]
        : items.map((i) => (i.id === editing.id ? data : i));
    await save(async () => {
      await saveRoadmap(user.uid, next);
      setEditing(null);
    });
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveRoadmap(user.uid, items.filter((i) => i.id !== editing.id));
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
        {/* Ringkasan roadmap */}
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            💻 Software Engineer · Mobile Developer NDC
          </VixText>
          <VixText heading="subheader" additionalStyle={summaryText.value}>
            {doneCount}{' '}
            <VixText heading="label" additionalStyle={summaryText.label}>
              dari {items.length} prioritas selesai
            </VixText>
          </VixText>
        </SummaryCard>

        <PrimaryButton
          label="Tambah Kartu"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        <FormError message={error} />

        {/* Papan ala Trello: Rencana · Dikerjakan · Selesai. Angka kecil =
            jumlah kartu, ⚠️ = ada yang deadline-nya sudah H-7. */}
        <SegmentTabs
          tabs={ROADMAP_STATUS.map((s) => {
            const n = columnOf(s.key).length;
            const u = urgentIn(s.key);
            return {
              key: s.key,
              label: `${s.icon} ${s.label}`,
              sub: u > 0 ? `${n} · ⚠️ ${u}` : `${n} kartu`,
            };
          })}
          value={board}
          onChange={setBoard}
        />

        {/* Peringatan: masih di kolom Rencana padahal deadline sudah dekat */}
        {board === 'todo' && urgentIn('todo') > 0 && (
          <View style={styles.warnCard}>
            <VixText heading="bold" additionalStyle={styles.warnText}>
              ⚠️ {urgentIn('todo')} kartu di Rencana sudah H-7 — buka kartunya
              & ubah statusnya jadi Dikerjakan.
            </VixText>
          </View>
        )}

        {column.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            {items.length === 0
              ? 'Belum ada roadmap — tulis prioritas kerjamu minggu ini 💪'
              : `Kolom ${STATUS_META[board].label} masih kosong.`}
          </VixText>
        )}

        {column.map((item) => {
          const meta = STATUS_META[item.status];
          // Info deadline: berapa hari lagi & apakah mendesak (belum selesai
          // dan tinggal ≤ 3 hari / sudah lewat).
          const dl = item.deadline
            ? roadmapDaysUntil(item.deadline, new Date())
            : null;
          const dlWhen = dl === null ? '' : whenLabel(dl);
          const dlUrgent = item.status !== 'done' && dl !== null && dl <= 3;
          // Kartu ini masih di Rencana padahal deadline sudah H-7 → tandai.
          const mustMove =
            item.status === 'todo' &&
            dl !== null &&
            dl <= CAREER_REMINDER_DAYS;
          return (
            // Seluruh kartu ditekan → buka modal edit (di sana status, prioritas
            // & deadline-nya diubah). Tidak ada lagi tombol pindah kolom cepat.
            <PressableScale
              key={item.id}
              style={[
                styles.card,
                item.status === 'done' && styles.cardDone,
                mustMove && styles.cardMustMove,
              ]}
              onPress={() => openEdit(item)}>
              <View>
                <View style={styles.cardTop}>
                  <PriorityBadge priority={item.priority} />
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
                {/* PIC dengan avatar emoji (seperti tab Freelance) */}
                {item.pic ? (
                  <VixText heading="label">👤 {item.pic}</VixText>
                ) : null}
                {/* Catatan/deskripsi sengaja TIDAK ditampilkan di daftar biar
                    ringkas — baru terbaca saat kartunya dibuka (diedit). */}
                {item.deadline ? (
                  <VixText
                    heading="label"
                    additionalStyle={dlUrgent ? styles.deadlineUrgent : styles.deadline}>
                    🗓️ {formatDate(item.deadline.toDate())} · {dlWhen}
                  </VixText>
                ) : (
                  <VixText heading="label" additionalStyle={styles.backlog}>
                    📥 Backlog · PR (tanpa deadline)
                  </VixText>
                )}
              </View>

              {mustMove && (
                <VixText heading="label" additionalStyle={styles.mustMoveText}>
                  ⚠️ Sudah H-7 tapi masih Rencana — harus mulai dikerjakan.
                </VixText>
              )}
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
          placeholder="PIC"
          value={fPic}
          onChangeText={setFPic}
          editable={!busy}
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Deskripsi / catatan (opsional)
        </VixText>
        <FormInput
          style={styles.noteInput}
          placeholder="Jelaskan detail pekerjaan"
          value={fNote}
          onChangeText={setFNote}
          multiline
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
              // H-7 → terkunci di P1, pilihan lain tidak bisa ditekan.
              onPress={urgent ? () => {} : () => setFPriority(p)}
              additionalStyle={[
                styles.chipFlex,
                urgent && fPriority !== p && styles.chipLocked,
              ]}
            />
          ))}
        </View>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Status
        </VixText>
        <View style={styles.chipRow}>
          {ROADMAP_STATUS.map((s) => {
            // H-7 → "Rencana" tidak boleh dipilih lagi (sudah harus dikerjakan).
            const locked = urgent && s.key === 'todo';
            return (
              <Chip
                key={s.key}
                label={`${s.icon} ${s.label}`}
                active={fStatus === s.key}
                onPress={locked ? () => {} : () => setFStatus(s.key)}
                additionalStyle={[
                  styles.chipFlex,
                  locked && styles.chipLocked,
                ]}
              />
            );
          })}
        </View>
        {!isDone && (
          <>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Deadline
            </VixText>
            <View style={styles.chipRow}>
              <Chip
                label="🗓️ Ada deadline"
                active={!fBacklog}
                onPress={() => setFBacklog(false)}
                additionalStyle={styles.chipFlex}
              />
              <Chip
                label="📥 Backlog (PR)"
                active={fBacklog}
                onPress={() => setFBacklog(true)}
                additionalStyle={styles.chipFlex}
              />
            </View>
            {fBacklog ? (
              <VixText heading="label" additionalStyle={styles.backlogHint}>
                Tanpa deadline — masuk backlog, jadi PR yang dikerjakan saat ada
                waktu. Tidak muncul sebagai reminder mendesak di Home.
              </VixText>
            ) : (
              <View style={styles.formGap}>
                {/* key = id supaya state picker internal reset tiap ganti item */}
                <DateField
                  key={editing === 'new' ? 'new' : editing?.id}
                  value={fDeadline}
                  onChange={setFDeadline}
                />
              </View>
            )}
          </>
        )}
        <FormError message={formError} />
        <EditDelete
          editing={editing}
          label="Hapus prioritas ini"
          busy={busy}
          onDelete={handleDelete}
        />
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
  addButton: { marginBottom: 12 },
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
  // Masih di kolom Rencana padahal deadline sudah H-7 → border merah.
  cardMustMove: { borderColor: Color.DANGER, borderWidth: 1.5 },
  mustMoveText: { color: Color.DANGER },
  warnCard: {
    backgroundColor: Color.FINANCE_EXPENSE,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Color.DANGER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  warnText: { color: Color.DANGER },
  deadline: { color: Color.TEXT_LABEL },
  deadlineUrgent: { color: Color.DANGER },
  backlog: { color: Color.CAREER_DARK },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  // Textarea besar untuk deskripsi/catatan — boleh banyak baris.
  noteInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  backlogHint: { color: Color.TEXT_LABEL, marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chipFlex: { flex: 1 },
  // Pilihan yang dikunci saat H-7 — diredupkan biar jelas tak bisa ditekan.
  chipLocked: { opacity: 0.4 },
});
