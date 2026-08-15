import { Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  MEETING_KINDS,
  meetingKindMeta,
  newVisitationId,
  saveVisitations,
  VISIT_TIPS,
  visitDaysUntil,
  type CoreLeader,
  type MeetingKind,
  type Visitation,
} from '@/lib/core';
import { daysBetween, formatFullDate } from '@/lib/format';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';

// Tab Pertemuan 📅: jadwal MCL bertemu CORE para CL (Visitasi / Fellowship) —
// diisi manual, reminder H-3 & hari-H muncul otomatis di Home.
export function VisitationTab({
  visitations,
  leaders,
  editId,
  onEditConsumed,
}: {
  visitations: Visitation[];
  leaders: CoreLeader[];
  // Kalau di-set (dari reminder Dashboard), langsung buka modal pertemuan ini.
  editId?: string;
  // Dipanggil setelah editId dipakai — induk membersihkan param dari URL.
  onEditConsumed?: () => void;
}) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<Visitation | 'new' | null>(null);
  const [fKind, setFKind] = useState<MeetingKind>('visitasi');
  const [fLeaderId, setFLeaderId] = useState('');
  const [fDate, setFDate] = useState(new Date());
  const [fAgenda, setFAgenda] = useState('');
  const [fNote, setFNote] = useState('');
  const [fDone, setFDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Modal tips + filter jadwal (default tanpa filter → tampil semua).
  const [tipsModal, setTipsModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [filterLeaderId, setFilterLeaderId] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<MeetingKind | null>(null);

  const today = new Date();

  // Tanggal visit yang dipilih sesudah hari ini → toggle "Sudah divisit"
  // disembunyikan (tidak mungkin sudah divisit kalau jadwalnya masa depan).
  const futureDate = daysBetween(today, fDate) > 0;

  function leaderOf(v: Visitation): CoreLeader | undefined {
    return leaders.find((l) => l.id === v.leaderId);
  }

  // Mendatang (belum done, belum lewat) urut terdekat; sisanya jadi riwayat.
  const upcoming = visitations
    .filter((v) => !v.done && visitDaysUntil(v, today) >= 0)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());

  // Filter opsional: per CORE Leader dan/atau per jenis pertemuan.
  const hasFilter = filterLeaderId !== null || filterKind !== null;
  const filtered = upcoming.filter(
    (v) =>
      (!filterLeaderId || v.leaderId === filterLeaderId) &&
      (!filterKind || v.kind === filterKind),
  );
  const activeLeader = leaders.find((l) => l.id === filterLeaderId);

  function openAdd() {
    setEditing('new');
    setFKind('visitasi');
    setFLeaderId(leaders[0]?.id ?? '');
    setFDate(new Date());
    setFAgenda('');
    setFNote('');
    setFDone(false);
    setFormError(null);
  }

  const openEdit = useCallback((v: Visitation) => {
    setEditing(v);
    setFKind(v.kind);
    setFLeaderId(v.leaderId);
    setFDate(v.date.toDate());
    setFAgenda(v.agenda);
    setFNote(v.note);
    setFDone(v.done);
    setFormError(null);
  }, []);

  // Auto-buka modal saat dibuka dari reminder Dashboard (?edit=<id>). Setelah
  // dipakai, minta induk membersihkan param (onEditConsumed) supaya modal TIDAK
  // auto-terbuka lagi saat balik ke subtab ini (yang me-mount ulang tab).
  // consumedRef = guard tambahan agar tak dobel dalam satu mount.
  const consumedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!editId || consumedRef.current === editId) return;
    const visit = visitations.find((v) => v.id === editId);
    if (visit) {
      consumedRef.current = editId;
      openEdit(visit);
      onEditConsumed?.();
    }
  }, [editId, visitations, openEdit, onEditConsumed]);

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fLeaderId) {
      setFormError('Pilih CORE Leader-nya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: Visitation = {
      id: editing === 'new' ? newVisitationId() : editing.id,
      kind: fKind,
      leaderId: fLeaderId,
      date: Timestamp.fromDate(fDate),
      agenda: fAgenda.trim(),
      note: fNote.trim(),
      // Jadwal masa depan dipaksa belum divisit — toggle-nya juga disembunyikan.
      done: futureDate ? false : fDone,
    };
    const next =
      editing === 'new'
        ? [...visitations, data]
        : visitations.map((v) => (v.id === editing.id ? data : v));
    try {
      await saveVisitations(user.uid, next);
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
      await saveVisitations(
        user.uid,
        visitations.filter((v) => v.id !== editing.id),
      );
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  // Kartu satu jadwal visitasi.
  function renderCard(v: Visitation) {
    const cl = leaderOf(v);
    const days = visitDaysUntil(v, today);
    const soon = !v.done && days >= 0 && days <= 3; // masuk jendela reminder
    const status = v.done
      ? '✅ Selesai'
      : days === 0
        ? '📍 HARI INI!'
        : days > 0
          ? `${days} hari lagi`
          : '⚠️ Terlewat';
    return (
      // Tekan untuk edit / tandai selesai.
      <PressableScale
        key={v.id}
        style={[styles.card, soon && styles.cardSoon]}
        onPress={() => openEdit(v)}>
        <View style={styles.cardTop}>
          <VixText heading="bold" additionalStyle={styles.cardTitle}>
            {cl ? `${cl.heart} ${cl.name}` : '(CL tidak ditemukan)'}
          </VixText>
          <VixText
            heading="label"
            additionalStyle={
              v.done
                ? styles.statusDone
                : days === 0
                  ? styles.statusToday
                  : days < 0
                    ? styles.statusLate
                    : soon
                      ? styles.statusSoon
                      : undefined
            }>
            {status}
          </VixText>
        </View>
        <VixText heading="label" additionalStyle={styles.kindLine}>
          {meetingKindMeta(v.kind).icon} {meetingKindMeta(v.kind).label}
        </VixText>
        <VixText heading="label">📆 {formatFullDate(v.date.toDate())}</VixText>
        {v.note ? (
          <VixText heading="label">🏷️ Judul: {v.note}</VixText>
        ) : null}
        {/* Agenda bisa panjang & berbaris-baris → labelnya di baris sendiri,
            isinya turun ke bawah supaya tetap terbaca rapi. */}
        {v.agenda ? (
          <View>
            <VixText heading="label">🗒️ Agenda:</VixText>
            <VixText heading="label" additionalStyle={styles.blockText}>
              {v.agenda}
            </VixText>
          </View>
        ) : null}
      </PressableScale>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Jadwalkan Pertemuan"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {/* ===== Jadwal mendatang ===== */}
        <View style={styles.sectionRow}>
          <VixText heading="title" additionalStyle={styles.sectionTitleFlex}>
            📅 Jadwal Mendatang
          </VixText>
          <View style={styles.sectionActions}>
            {/* Tips pertemuan (buka modal) */}
            <EmojiButton emoji="💡" onPress={() => setTipsModal(true)} />
            {/* Filter jadwal (per CL / jenis) — menyala kalau ada filter aktif */}
            <EmojiButton
              emoji="🎚️"
              active={hasFilter}
              onPress={() => setFilterModal(true)}
            />
          </View>
        </View>

        {/* Chip filter yang sedang aktif — ketuk untuk menghapusnya */}
        {hasFilter && (
          <View style={styles.activeFilterRow}>
            {filterLeaderId && (
              <Chip
                label={`${activeLeader ? `${activeLeader.heart} ${activeLeader.name}` : 'CL'} ✕`}
                active
                onPress={() => setFilterLeaderId(null)}
              />
            )}
            {filterKind && (
              <Chip
                label={`${meetingKindMeta(filterKind).icon} ${meetingKindMeta(filterKind).label} ✕`}
                active
                onPress={() => setFilterKind(null)}
              />
            )}
          </View>
        )}

        {filtered.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            {hasFilter
              ? 'Tidak ada jadwal yang cocok dengan filter ini.'
              : 'Belum ada jadwal — CORE mana yang mau kamu temui bulan ini? 😉'}
          </VixText>
        ) : (
          filtered.map(renderCard)
        )}
      </ScrollView>

      {/* Bottom sheet tambah/edit jadwal */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Jadwalkan Pertemuan' : 'Edit Pertemuan'}
        onClose={() => setEditing(null)}>
        {/* Picker: daftar pilihan baru muncul saat baris ini ditekan, jadi
            modal tidak langsung penuh oleh semua jenis & nama CORE. */}
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Jenis pertemuan
        </VixText>
        <View style={styles.formGap}>
          <SelectField
            value={fKind}
            options={MEETING_KINDS.map((k) => ({
              key: k.key,
              label: `${k.icon} ${k.label}`,
            }))}
            onChange={(k) => k && setFKind(k)}
            placeholder="Pilih jenis pertemuan…"
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          CORE-nya siapa?
        </VixText>
        <View style={styles.formGap}>
          <SelectField
            value={fLeaderId}
            options={leaders.map((l) => ({
              key: l.id,
              label: `${l.heart} ${l.name}`,
            }))}
            onChange={(id) => id && setFLeaderId(id)}
            placeholder="Pilih CORE Leader…"
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal pertemuan
        </VixText>
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal reset tiap ganti jadwal */}
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏷️ Judul Pertemuan
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Judul singkat"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🗒️ Agenda pertemuan
        </VixText>
        <FormInput
          style={[styles.textArea, styles.formGap]}
          placeholder="Agenda pertemuan"
          value={fAgenda}
          onChangeText={setFAgenda}
          editable={!busy}
          multiline
        />

        {/* Tandai selesai setelah visit — hanya kalau tanggalnya sudah tiba */}
        {!futureDate && (
          <PressableScale style={styles.doneRow} onPress={() => setFDone((d) => !d)}>
            <CheckCircle checked={fDone} />
            <VixText heading="paragraph" additionalStyle={styles.doneText}>
              Sudah selesai ✅
            </VixText>
          </PressableScale>
        )}

        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
        {editing !== 'new' && editing !== null && (
          <InlineDelete
            key={editing.id}
            label="Hapus jadwal ini"
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

      {/* Modal tips pertemuan */}
      <SheetModal
        visible={tipsModal}
        title="💡 Tips Pertemuan"
        subtitle="Biar pertemuanmu makin berdampak"
        onClose={() => setTipsModal(false)}>
        {VISIT_TIPS.map((tip) => (
          <VixText key={tip} heading="paragraph" additionalStyle={styles.tip}>
            {tip}
          </VixText>
        ))}
      </SheetModal>

      {/* Modal filter jadwal — per CORE Leader dan/atau jenis pertemuan */}
      <SheetModal
        visible={filterModal}
        title="🎚️ Filter Jadwal"
        subtitle="Tampilkan hanya yang cocok"
        onClose={() => setFilterModal(false)}
        footer={
          <View style={styles.filterFooter}>
            <PressableScale
              style={styles.clearBtn}
              onPress={() => {
                setFilterLeaderId(null);
                setFilterKind(null);
              }}>
              <VixText heading="bold" additionalStyle={styles.clearText}>
                Bersihkan
              </VixText>
            </PressableScale>
            <PressableScale
              style={styles.doneBtn}
              onPress={() => setFilterModal(false)}>
              <VixText heading="bold" additionalStyle={styles.doneBtnText}>
                Selesai
              </VixText>
            </PressableScale>
          </View>
        }>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🫶 Per CORE Leader
        </VixText>
        <View style={styles.leaderWrap}>
          {leaders.map((l) => (
            <Chip
              key={l.id}
              label={`${l.heart} ${l.name}`}
              active={filterLeaderId === l.id}
              onPress={() =>
                setFilterLeaderId((cur) => (cur === l.id ? null : l.id))
              }
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏸 Per Jenis Pertemuan
        </VixText>
        <View style={styles.leaderWrap}>
          {MEETING_KINDS.map((k) => (
            <Chip
              key={k.key}
              label={`${k.icon} ${k.label}`}
              active={filterKind === k.key}
              onPress={() =>
                setFilterKind((cur) => (cur === k.key ? null : k.key))
              }
            />
          ))}
        </View>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  addButton: { marginBottom: 6 },
  error: { color: Color.DANGER, marginBottom: 8 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitleFlex: { flex: 1 },
  sectionActions: { flexDirection: 'row', gap: 8 },
  activeFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  empty: { textAlign: 'center', marginBottom: 8 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 3,
  },
  cardSoon: {
    backgroundColor: Color.ACCENT,
    borderColor: Color.ACCENT_DARK,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  kindLine: { color: Color.MAIN },
  // Isi kolom panjang (agenda/catatan) — sedikit menjorok dari labelnya.
  blockText: { color: Color.TEXT_PARAGRAPH, paddingLeft: 2 },
  statusSoon: { color: Color.ACCENT_DARK },
  statusToday: { color: Color.DANGER },
  statusDone: { color: Color.SUCCESS },
  statusLate: { color: Color.WARNING },
  tip: { color: Color.TEXT_PARAGRAPH, marginBottom: 12 },
  // Footer modal filter: dua tombol (Bersihkan / Selesai).
  filterFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },
  clearBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  clearText: { color: Color.TEXT_TITLE },
  doneBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
  },
  doneBtnText: { color: Color.TEXT_REVERSE },
  fieldLabel: { marginBottom: 6 },
  leaderWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  formGap: { marginBottom: 10 },
  textArea: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  doneText: { color: Color.TEXT_TITLE },
});
