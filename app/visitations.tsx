import { Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FilterChips } from '@/components/common/FilterChips';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import {
  MEETING_KINDS,
  meetingKindMeta,
  saveVisitations,
  subscribeCoreLeaders,
  subscribeVisitations,
  visitDaysUntil,
  type CoreLeader,
  type MeetingKind,
  type Visitation,
} from '@/lib/core';
import { daysBetween, formatFullDate } from '@/lib/format';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';

// Riwayat Pertemuan 🕘 — seluruh jadwal dari dulu sampai mendatang.
// Tap kartu → edit (ubah CL/tanggal/catatan, tandai selesai/belum) atau
// hapus PERMANEN dari Firestore (benar-benar hilang, bukan nonaktif).
export default function VisitationsScreen() {
  const { user } = useAuth();

  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form edit lewat bottom sheet.
  const [editing, setEditing] = useState<Visitation | null>(null);
  const [fKind, setFKind] = useState<MeetingKind>('visitasi');
  const [fLeaderId, setFLeaderId] = useState('');
  const [fDate, setFDate] = useState(new Date());
  const [fAgenda, setFAgenda] = useState('');
  const [fNote, setFNote] = useState('');
  const [fDone, setFDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeVisitations(user.uid, setVisitations, fail),
      subscribeCoreLeaders(user.uid, setLeaders, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const today = new Date();
  const all = visitations ?? [];

  // Riwayat = yang SUDAH divisit atau tanggalnya SUDAH lewat.
  // Jadwal mendatang tidak ikut — tempatnya di CORE → tab Visitasi.
  const history = all.filter((v) => v.done || visitDaysUntil(v, today) < 0);

  // Filter jenis pertemuan — sama seperti di tab Pertemuan (null = semua).
  const [filterKind, setFilterKind] = useState<MeetingKind | null>(null);
  const shown = filterKind
    ? history.filter((v) => v.kind === filterKind)
    : history;

  // Tanggal visit yang dipilih sesudah hari ini → toggle "Sudah divisit"
  // disembunyikan (tidak mungkin sudah divisit kalau jadwalnya masa depan).
  const futureDate = daysBetween(today, fDate) > 0;
  const sorted = [...shown].sort(
    (a, b) => b.date.toMillis() - a.date.toMillis(),
  );
  const { setPage, currentPage, pageCount, pageItems } = usePagination(sorted);

  function openEdit(v: Visitation) {
    setEditing(v);
    setFKind(v.kind);
    setFLeaderId(v.leaderId);
    setFDate(v.date.toDate());
    setFAgenda(v.agenda);
    setFNote(v.note);
    setFDone(v.done);
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fLeaderId) {
      setFormError('Pilih CORE Leader-nya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: Visitation = {
      id: editing.id,
      kind: fKind,
      leaderId: fLeaderId,
      date: Timestamp.fromDate(fDate),
      agenda: fAgenda.trim(),
      note: fNote.trim(),
      // Jadwal masa depan dipaksa belum divisit — toggle-nya juga disembunyikan.
      done: futureDate ? false : fDone,
    };
    try {
      await saveVisitations(
        user.uid,
        all.map((v) => (v.id === editing.id ? data : v)),
      );
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // Hapus PERMANEN: item dibuang dari array lalu dokumen ditulis ulang —
  // datanya benar-benar hilang dari Firestore.
  async function handleDelete() {
    if (!user || !editing || busy) return;
    setBusy(true);
    try {
      await saveVisitations(user.uid, all.filter((v) => v.id !== editing.id));
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="CORE"
        title="Riwayat Pertemuan 🕘"
        subtitle={`${sorted.length} riwayat`}
      />

      <ScreenError message={error} />

      {visitations === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView key={currentPage} contentContainerStyle={styles.content}>
          {/* Filter jenis pertemuan — ketuk lagi untuk melepas filternya */}
          <FilterChips
            options={MEETING_KINDS.map((k) => ({
              key: k.key,
              label: `${k.icon} ${k.label}`,
              count: history.filter((v) => v.kind === k.key).length,
            }))}
            value={filterKind}
            onChange={setFilterKind}
          />

          {sorted.length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada riwayat — pertemuan yang sudah selesai atau terlewat
              akan muncul di sini 📅
            </VixText>
          )}
          {pageItems.map((v) => {
            const cl = leaders.find((l) => l.id === v.leaderId);
            const days = visitDaysUntil(v, today);
            const status = v.done
              ? '✅ Selesai'
              : days === 0
                ? '📍 HARI INI!'
                : days > 0
                  ? `${days} hari lagi`
                  : '⚠️ Terlewat';
            return (
              // Tap → edit status/tanggal/catatan atau hapus permanen.
              <PressableScale
                key={v.id}
                style={styles.card}
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
                        : days < 0
                          ? styles.statusLate
                          : styles.statusUpcoming
                    }>
                    {status}
                  </VixText>
                </View>
                <VixText heading="label" additionalStyle={styles.kindLine}>
                  {meetingKindMeta(v.kind).icon} {meetingKindMeta(v.kind).label}
                </VixText>
                <VixText heading="label">
                  📆 {formatFullDate(v.date.toDate())}
                </VixText>
                {/* Agenda sengaja TIDAK ditampilkan di sini — datanya sama
                    dengan tab Pertemuan, dan di riwayat yang penting hasilnya,
                    bukan rencananya. Tetap bisa dibaca & diubah di modal. */}
                {v.note ? (
                  <VixText heading="label">🏷️ Judul: {v.note}</VixText>
                ) : null}
              </PressableScale>
            );
          })}

          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onChange={setPage}
          />
        </ScrollView>
      )}

      {/* Bottom sheet edit visitasi */}
      <SheetModal
        visible={!!editing}
        title="Edit Pertemuan"
        onClose={() => setEditing(null)}>
        {/* Picker — sama seperti di tab Pertemuan (CORE). */}
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
          <DateField key={editing?.id} value={fDate} onChange={setFDate} />
        </View>

        {/* Urutan & label SAMA PERSIS dengan tab Pertemuan — datanya memang
            satu, cuma ditampilkan dari dua layar. */}
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
          placeholder="Apa yang akan dibahas ke mereka…"
          value={fAgenda}
          onChangeText={setFAgenda}
          editable={!busy}
          multiline
        />

        {/* Toggle sudah selesai / belum — hanya kalau tanggalnya sudah tiba */}
        {!futureDate && (
          <PressableScale style={styles.doneRow} onPress={() => setFDone((d) => !d)}>
            <CheckCircle checked={fDone} />
            <VixText heading="paragraph" additionalStyle={styles.doneText}>
              Sudah selesai ✅
            </VixText>
          </PressableScale>
        )}

        {formError && (
          <VixText heading="label" additionalStyle={styles.sheetError}>
            {formError}
          </VixText>
        )}
        {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
        {editing && (
          <InlineDelete
            key={editing.id}
            label="Hapus permanen jadwal ini"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  kindLine: { color: Color.MAIN },
  statusDone: { color: Color.SUCCESS },
  statusLate: { color: Color.WARNING },
  statusUpcoming: { color: Color.ACCENT_DARK },
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
  sheetError: { color: Color.DANGER, marginBottom: 8 },
});
