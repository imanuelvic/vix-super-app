import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import { formatDate } from '@/lib/format';
import {
  addDisease,
  deleteDisease,
  subscribeDiseases,
  updateDisease,
  type Disease,
} from '@/lib/health';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';

/** Lama sakit dalam hari (minimal 1). Belum sembuh → dihitung sampai hari ini. */
function sickDays(d: Disease): number {
  const end = d.recover ? d.recover.toDate().getTime() : Date.now();
  return Math.max(1, Math.round((end - d.start.toDate().getTime()) / 86_400_000));
}

// Riwayat sakit — versi app dari sheet "Disease 🤧" lama:
// kapan kena, penyakit apa, penyebab, obat/penanganan, kapan sembuh.
export default function DiseasesScreen() {
  const { user } = useAuth();

  const [items, setItems] = useState<Disease[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form tambah/edit lewat bottom sheet. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<Disease | 'new' | null>(null);
  const [fName, setFName] = useState('');
  const [fCause, setFCause] = useState('');
  const [fTreatment, setFTreatment] = useState('');
  const [fStart, setFStart] = useState(new Date());
  const [fRecovered, setFRecovered] = useState(false);
  const [fRecoverDate, setFRecoverDate] = useState(new Date());
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeDiseases(
      user.uid,
      (next) => {
        setItems(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
    return unsubscribe;
  }, [user]);

  const { setPage, currentPage, pageCount, pageItems } = usePagination(
    items ?? [],
  );

  function openAdd() {
    setEditing('new');
    setFName('');
    setFCause('');
    setFTreatment('');
    setFStart(new Date());
    setFRecovered(false);
    setFRecoverDate(new Date());
    setFormError(null);
  }

  function openEdit(d: Disease) {
    setEditing(d);
    setFName(d.name);
    setFCause(d.cause);
    setFTreatment(d.treatment);
    setFStart(d.start.toDate());
    setFRecovered(!!d.recover);
    setFRecoverDate(d.recover ? d.recover.toDate() : new Date());
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fName.trim() || !fCause.trim()) {
      setFormError('Nama penyakit dan penyebab wajib diisi.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data = {
      name: fName.trim(),
      cause: fCause.trim(),
      treatment: fTreatment.trim(),
      start: fStart,
      recover: fRecovered ? fRecoverDate : null,
    };
    try {
      if (editing === 'new') {
        await addDisease(user.uid, data);
      } else {
        await updateDisease(user.uid, editing.id, data);
      }
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
      await deleteDisease(user.uid, editing.id);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Health"
        title="Disease 🤧"
        subtitle="Riwayat sakit — biar tahu pola & penyebabnya"
      />

      <ScrollView key={currentPage} contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Catat Sakit"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        <FormError message={error} />

        {items === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={Color.MAIN} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <VixText heading="label">
              Belum ada catatan. Semoga sehat terus! 🙏
            </VixText>
          </View>
        ) : (
          <>
          {pageItems.map((d) => {
            const ongoing = !d.recover;
            return (
              // Tekan untuk edit / tandai sembuh / hapus.
              <PressableScale key={d.id} style={styles.card} onPress={() => openEdit(d)}>
                <View style={styles.cardTop}>
                  <VixText
                    heading="bold"
                    numberOfLines={1}
                    additionalStyle={styles.cardTitle}>
                    {d.name}
                  </VixText>
                  <View style={[styles.badge, ongoing && styles.badgeOngoing]}>
                    <VixText
                      heading="label"
                      additionalStyle={ongoing ? styles.badgeOngoingText : styles.badgeText}>
                      {ongoing ? 'Masih sakit' : 'Sembuh ✓'}
                    </VixText>
                  </View>
                </View>
                <VixText heading="label">
                  {formatDate(d.start.toDate())} →{' '}
                  {d.recover ? formatDate(d.recover.toDate()) : 'sekarang'} ·{' '}
                  {sickDays(d)} hari
                </VixText>
                <VixText heading="paragraph" additionalStyle={styles.cardText}>
                  Penyebab: {d.cause}
                </VixText>
                {d.treatment ? (
                  <VixText heading="paragraph" additionalStyle={styles.cardText}>
                    Obat: {d.treatment}
                  </VixText>
                ) : null}
              </PressableScale>
            );
          })}
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onChange={setPage}
          />
          </>
        )}
      </ScrollView>

      {/* Bottom sheet tambah/edit */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catat Sakit' : 'Edit Catatan'}
        onClose={() => setEditing(null)}>
        <FormInput
          style={styles.formGap}
          placeholder="Nama penyakit"
          value={fName}
          onChangeText={setFName}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Penyebab"
          value={fCause}
          onChangeText={setFCause}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Obat / penanganan (opsional)"
          value={fTreatment}
          onChangeText={setFTreatment}
          editable={!busy}
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal mulai sakit
        </VixText>
        <View style={styles.formGap}>
          <DateField value={fStart} onChange={setFStart} />
        </View>

        {/* Toggle sudah sembuh + tanggal sembuh */}
        <PressableScale
          style={styles.recoverRow}
          onPress={() => setFRecovered((r) => !r)}>
          <CheckCircle checked={fRecovered} />
          <VixText heading="paragraph" additionalStyle={styles.cardText}>
            Sudah sembuh
          </VixText>
        </PressableScale>
        {fRecovered && (
          <View style={styles.formGap}>
            <DateField value={fRecoverDate} onChange={setFRecoverDate} />
          </View>
        )}

        <FormError message={formError} />
        <EditDelete
          editing={editing}
          label="Hapus catatan ini"
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  addButton: { marginBottom: 14 },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  cardText: { color: Color.TEXT_PARAGRAPH },
  badge: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeOngoing: { backgroundColor: Color.WARNING_TRANSPARENT },
  badgeText: { color: Color.MAIN },
  badgeOngoingText: { color: Color.WARNING },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 4 },
  recoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
});
