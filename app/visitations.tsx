import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { deadlineBorder } from '@/components/common/Deadline';
import { EditFooter } from '@/components/common/EditFooter';
import { FilterChips } from '@/components/common/FilterChips';
import { FormError } from '@/components/common/FormError';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import {
    VisitationCardBody,
    VisitationStatus,
} from '@/components/core/VisitationCardBody';
import { VisitationFormFields } from '@/components/core/VisitationFormFields';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import { useScrollTop } from '@/hooks/useScrollTop';
import { useVisitationForm } from '@/hooks/useVisitationForm';
import {
    MEETING_KINDS,
    saveVisitations,
    subscribeCoreLeaders,
    subscribeExLeaders,
    subscribeVisitations,
    visitDaysUntil,
    type CoreLeader,
    type MeetingKind,
    type Visitation,
} from '@/lib/core';
import { deadlineTone } from '@/lib/deadline';
import { unsubscribeAll } from '@/lib/liveDoc';
import { DELETE_ERROR, LOAD_ERROR } from '@/lib/messages';

// Riwayat Visitasi 🕘 — seluruh jadwal dari dulu sampai mendatang.
// Klik kartu → edit (ubah CL/tanggal/catatan, tandai selesai/belum) atau
// hapus PERMANEN dari Firestore (benar-benar hilang, bukan nonaktif).
export default function VisitationsScreen() {
  const { user } = useAuth();

  const [visitations, setVisitations] = useState<Visitation[] | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  // Ex CORE Leader ikut dibaca — riwayat justru tempat mereka paling sering
  // muncul. Tanpa ini kartunya cuma tertulis "(CL tidak ditemukan)".
  const [exLeaders, setExLeaders] = useState<CoreLeader[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form edit lewat bottom sheet — isian & aturannya dipakai bersama sub-tab
  // Visitation di CORE (lihat hooks/useVisitationForm.ts).
  const [editing, setEditing] = useState<Visitation | null>(null);
  const form = useVisitationForm();
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeVisitations(user.uid, setVisitations, fail),
      subscribeCoreLeaders(user.uid, setLeaders, fail),
      subscribeExLeaders(user.uid, setExLeaders, fail),
    ]);
  }, [user]);

  const today = new Date();
  const all = visitations ?? [];

  // Riwayat = yang SUDAH divisit atau tanggalnya SUDAH lewat.
  // Jadwal visitasi tidak ikut — tempatnya di CORE → tab Visitasi.
  const history = all.filter((v) => v.done || visitDaysUntil(v, today) < 0);

  // Filter jenis visitasi — sama seperti di tab Visitation (null = semua).
  // Filter Thanksgiving ikut menangkap acara yang cuma "sekalian" Thanksgiving.
  const [filterKind, setFilterKind] = useState<MeetingKind | null>(null);
  const matchKind = (v: Visitation, k: MeetingKind) =>
    v.kind === k || (k === 'thanksgiving' && v.thanksgiving);
  const shown = filterKind
    ? history.filter((v) => matchKind(v, filterKind))
    : history;

  const sorted = [...shown].sort(
    (a, b) => b.date.toMillis() - a.date.toMillis(),
  );
  const { setPage, currentPage, pageCount, pageItems } = usePagination(sorted);

  // Tekan chip jenis yang sedang aktif LAGI → daftarnya balik ke paling atas.
  const { ref: scrollRef, toTop } = useScrollTop();

  function openEdit(v: Visitation) {
    setEditing(v);
    form.fill(v);
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (form.leaderIds.length === 0) {
      setFormError('Pilih CORE Leader-nya dulu.');
      return;
    }
    const data: Visitation = {
      id: editing.id,
      ...form.payload(),
      // Catatan kirim PDF milik jadwalnya, bukan formnya — dipertahankan.
      pdfSentDayId: editing.pdfSentDayId,
    };
    await save(async () => {
      await saveVisitations(
        user.uid,
        all.map((v) => (v.id === editing.id ? data : v)),
      );
      setEditing(null);
    });
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
        title="Riwayat Visitasi 🕘"
        subtitle={`${sorted.length} riwayat`}
      />

      <ScreenError message={error} />

      {visitations === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView
          key={currentPage}
          ref={scrollRef}
          contentContainerStyle={styles.content}>
          <FilterChips
            options={MEETING_KINDS.map((k) => ({
              key: k.key,
              label: `${k.icon} ${k.label}`,
              count: history.filter((v) => matchKind(v, k.key)).length,
            }))}
            value={filterKind}
            onChange={setFilterKind}
            onRepress={toTop}
          />

          {sorted.length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada riwayat — visitasi yang sudah selesai atau terlewat
              akan muncul di sini 📅
            </VixText>
          )}
          {pageItems.map((v) => {
            const days = visitDaysUntil(v, today);
            // Warna & label dari aturan bersama (lihat lib/deadline.ts).
            const tone = v.done ? 'unknown' : deadlineTone(days);
            return (
              // Klik → edit status/tanggal/catatan atau hapus permanen.
              <PressableScale
                key={v.id}
                style={[styles.card, deadlineBorder(tone)]}
                onPress={() => openEdit(v)}>
                {/* Bentuk kartunya sama dengan tab Visitation: isinya di kiri,
                    keadaannya di kolom kanan. Di sini kolom kanan cuma berisi
                    status — layar ini memang tidak punya tombol share. */}
                <View style={styles.cardMain}>
                  <VisitationCardBody
                    visitation={v}
                    leaders={[...leaders, ...exLeaders]}
                  />
                </View>
                <VisitationStatus visitation={v} tone={tone} days={days} />
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
        title="Edit Visitasi"
        onClose={() => setEditing(null)}>
        <VisitationFormFields
          form={form}
          leaders={leaders}
          busy={busy}
          dateKey={editing?.id}
          agendaPlaceholder="Apa yang akan dibahas ke mereka…"
        />

        <FormError message={formError} />
        <EditFooter
          editing={editing}
          deleteLabel="Hapus permanen jadwal ini"
          busy={busy}
          onDelete={handleDelete}
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
    // Isi kartu di kiri, status di kanan — jarak antar-barisnya pindah ke
    // `cardMain` supaya angkanya tetap 3 seperti sebelumnya.
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardMain: { flex: 1, gap: 3 },
});
