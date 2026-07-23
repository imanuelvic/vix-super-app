import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  newVisitationId,
  saveVisitations,
  VISIT_TIPS,
  visitDaysUntil,
  type CoreLeader,
  type Visitation,
} from '@/lib/core';
import { formatFullDate } from '@/lib/format';

// Tab Visitasi 📅: jadwal MCL mengunjungi CORE para CL — diisi manual,
// reminder H-3 & hari-H muncul otomatis di Home.
export function VisitationTab({
  visitations,
  leaders,
}: {
  visitations: Visitation[];
  leaders: CoreLeader[];
}) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<Visitation | 'new' | null>(null);
  const [fLeaderId, setFLeaderId] = useState('');
  const [fDate, setFDate] = useState(new Date());
  const [fNote, setFNote] = useState('');
  const [fDone, setFDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const today = new Date();

  function leaderOf(v: Visitation): CoreLeader | undefined {
    return leaders.find((l) => l.id === v.leaderId);
  }

  // Mendatang (belum done, belum lewat) urut terdekat; sisanya jadi riwayat.
  const upcoming = visitations
    .filter((v) => !v.done && visitDaysUntil(v, today) >= 0)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
  const history = visitations
    .filter((v) => v.done || visitDaysUntil(v, today) < 0)
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());

  function openAdd() {
    setEditing('new');
    setFLeaderId(leaders[0]?.id ?? '');
    setFDate(new Date());
    setFNote('');
    setFDone(false);
    setFormError(null);
  }

  function openEdit(v: Visitation) {
    setEditing(v);
    setFLeaderId(v.leaderId);
    setFDate(v.date.toDate());
    setFNote(v.note);
    setFDone(v.done);
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fLeaderId) {
      setFormError('Pilih CORE Leader yang mau divisit.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: Visitation = {
      id: editing === 'new' ? newVisitationId() : editing.id,
      leaderId: fLeaderId,
      date: Timestamp.fromDate(fDate),
      note: fNote.trim(),
      done: fDone,
    };
    const next =
      editing === 'new'
        ? [...visitations, data]
        : visitations.map((v) => (v.id === editing.id ? data : v));
    try {
      await saveVisitations(user.uid, next);
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
      await saveVisitations(
        user.uid,
        visitations.filter((v) => v.id !== editing.id),
      );
    } catch {
      setError('Gagal menghapus. Coba lagi.');
    } finally {
      setConfirmDelete(false);
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
      <Pressable
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
        <VixText heading="label">📆 {formatFullDate(v.date.toDate())}</VixText>
        {v.note ? <VixText heading="label">📝 {v.note}</VixText> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Jadwalkan Visitasi"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />
        <VixText heading="label" additionalStyle={styles.hintTop}>
          Reminder otomatis muncul di Home mulai H-3 sampai hari-H 📍
        </VixText>

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {/* ===== Jadwal mendatang ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          📅 Jadwal Mendatang
        </VixText>
        {upcoming.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada jadwal — CORE mana yang mau kamu kunjungi bulan ini? 😉
          </VixText>
        ) : (
          upcoming.map(renderCard)
        )}

        {/* ===== Riwayat ===== */}
        {history.length > 0 && (
          <>
            <VixText heading="title" additionalStyle={styles.sectionTitle}>
              🗂️ Riwayat
            </VixText>
            {history.map(renderCard)}
          </>
        )}

        {/* ===== Tips visitasi ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          💡 Tips Visitasi
        </VixText>
        <View style={styles.tipsCard}>
          {VISIT_TIPS.map((tip) => (
            <VixText key={tip} heading="paragraph" additionalStyle={styles.tip}>
              {tip}
            </VixText>
          ))}
        </View>
      </ScrollView>

      {/* Bottom sheet tambah/edit jadwal */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Jadwalkan Visitasi' : 'Edit Visitasi'}
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          CORE yang divisit
        </VixText>
        <View style={styles.leaderWrap}>
          {leaders.map((l) => (
            <Chip
              key={l.id}
              label={`${l.heart} ${l.name}`}
              active={fLeaderId === l.id}
              onPress={() => setFLeaderId(l.id)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal visit
        </VixText>
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal reset tiap ganti jadwal */}
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>

        <FormInput
          style={styles.formGap}
          placeholder="Catatan — tempat / agenda (opsional)"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />

        {/* Tandai selesai setelah visit */}
        <Pressable style={styles.doneRow} onPress={() => setFDone((d) => !d)}>
          <CheckCircle checked={fDone} />
          <VixText heading="paragraph" additionalStyle={styles.doneText}>
            Sudah divisit ✅
          </VixText>
        </Pressable>

        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {editing !== 'new' && editing !== null && (
          <Pressable onPress={() => setConfirmDelete(true)} disabled={busy}>
            <VixText heading="bold" additionalStyle={styles.deleteText}>
              Hapus jadwal ini
            </VixText>
          </Pressable>
        )}
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        visible={confirmDelete}
        title="Hapus jadwal visitasi?"
        detail="Jadwal ini akan dihapus permanen."
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  addButton: { marginBottom: 6 },
  hintTop: { textAlign: 'center', marginBottom: 8 },
  error: { color: Color.DANGER, marginBottom: 8 },
  sectionTitle: { marginTop: 10, marginBottom: 10 },
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
  statusSoon: { color: Color.ACCENT_DARK },
  statusToday: { color: Color.DANGER },
  statusDone: { color: Color.SUCCESS },
  statusLate: { color: Color.WARNING },
  tipsCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 10,
  },
  tip: { color: Color.TEXT_PARAGRAPH },
  fieldLabel: { marginBottom: 6 },
  leaderWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  formGap: { marginBottom: 10 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  doneText: { color: Color.TEXT_TITLE },
  deleteText: { color: Color.DANGER, textAlign: 'center', marginTop: 6 },
});
