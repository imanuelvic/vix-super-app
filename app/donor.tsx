import { Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  daysUntilEligible,
  DONOR_REQUIREMENTS,
  DONOR_TIPS,
  EMPTY_DONOR,
  newDonorScheduleId,
  nextEligibleDate,
  saveDonor,
  scheduleDaysUntil,
  subscribeDonor,
  type DonorData,
  type DonorSchedule,
} from '@/lib/donor';
import { formatFullDate, formatMonthsDays } from '@/lib/format';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import { subscribeHealthProfile, type HealthProfile } from '@/lib/health';

// Donor Darah 🩸 — jadwal & tempat donor, hitung mundur boleh donor lagi,
// catatan pribadi, plus syarat & tips donor.
export default function DonorScreen() {
  const { user } = useAuth();

  const [data, setData] = useState<DonorData | null>(null);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sheet tambah/edit jadwal.
  const [editing, setEditing] = useState<DonorSchedule | 'new' | null>(null);
  const [fDate, setFDate] = useState(new Date());
  const [fLocation, setFLocation] = useState('');
  const [fNote, setFNote] = useState('');
  const [fDone, setFDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Dialog set "donor terakhir".
  const [lastOpen, setLastOpen] = useState(false);
  const [fLast, setFLast] = useState(new Date());

  // Editor catatan.
  const [notesOpen, setNotesOpen] = useState(false);
  const [fNotes, setFNotes] = useState('');

  // Dropdown info (default tertutup).
  const [reqOpen, setReqOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeDonor(
        user.uid,
        (next) => {
          setData(next);
          setError(null);
        },
        fail,
      ),
      subscribeHealthProfile(user.uid, setProfile, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  const today = new Date();
  const d = data ?? EMPTY_DONOR;
  const eligibleDays = daysUntilEligible(d, today);
  const nextDate = nextEligibleDate(d);
  const canDonate = eligibleDays === null || eligibleDays <= 0;

  // Jadwal mendatang (belum lewat & belum selesai) urut terdekat.
  const upcoming = [...d.schedules]
    .filter((s) => !s.done && scheduleDaysUntil(s, today) >= 0)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
  const history = [...d.schedules]
    .filter((s) => s.done || scheduleDaysUntil(s, today) < 0)
    .sort((a, b) => b.date.toMillis() - a.date.toMillis());

  async function persist(next: DonorData) {
    if (!user) return;
    setError(null);
    try {
      await saveDonor(user.uid, next);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  // ---------- Jadwal ----------

  function openAdd() {
    setEditing('new');
    setFDate(new Date());
    setFLocation('');
    setFNote('');
    setFDone(false);
    setFormError(null);
  }

  function openEdit(s: DonorSchedule) {
    setEditing(s);
    setFDate(s.date.toDate());
    setFLocation(s.location);
    setFNote(s.note);
    setFDone(s.done);
    setFormError(null);
  }

  async function handleSaveSchedule() {
    if (!user || !editing || busy) return;
    if (!fLocation.trim()) {
      setFormError('Isi tempat donornya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const item: DonorSchedule = {
      id: editing === 'new' ? newDonorScheduleId() : editing.id,
      date: Timestamp.fromDate(fDate),
      location: fLocation.trim(),
      note: fNote.trim(),
      done: fDone,
    };
    const schedules =
      editing === 'new'
        ? [...d.schedules, item]
        : d.schedules.map((s) => (s.id === editing.id ? item : s));
    // Kalau ditandai selesai, jadikan donor terakhir (yang terbaru menang).
    const lastDonation =
      item.done &&
      (!d.lastDonation || item.date.toMillis() > d.lastDonation.toMillis())
        ? item.date
        : d.lastDonation;
    await persist({ ...d, schedules, lastDonation });
    setBusy(false);
    setEditing(null);
  }

  async function handleDeleteSchedule() {
    if (!editing || editing === 'new' || busy) return;
    setBusy(true);
    await persist({
      ...d,
      schedules: d.schedules.filter((s) => s.id !== editing.id),
    });
    setBusy(false);
    setEditing(null);
  }

  // ---------- Donor terakhir ----------

  function openLast() {
    setFLast(d.lastDonation ? d.lastDonation.toDate() : new Date());
    setLastOpen(true);
  }

  async function handleSaveLast() {
    await persist({ ...d, lastDonation: Timestamp.fromDate(fLast) });
    setLastOpen(false);
  }

  // ---------- Catatan ----------

  function openNotes() {
    setFNotes(d.notes);
    setNotesOpen(true);
  }

  async function handleSaveNotes() {
    await persist({ ...d, notes: fNotes.trim() });
    setNotesOpen(false);
  }

  function renderSchedule(s: DonorSchedule) {
    const days = scheduleDaysUntil(s, today);
    const soon = !s.done && days >= 0 && days <= 7;
    const status = s.done
      ? '✅ Selesai'
      : days === 0
        ? '📍 HARI INI!'
        : days > 0
          ? `${days} hari lagi`
          : '⚠️ Terlewat';
    return (
      <PressableScale
        key={s.id}
        style={[styles.card, soon && styles.cardSoon]}
        onPress={() => openEdit(s)}>
        <View style={styles.cardTop}>
          <VixText heading="bold" additionalStyle={styles.cardTitle}>
            📍 {s.location}
          </VixText>
          <VixText
            heading="label"
            additionalStyle={
              s.done
                ? styles.statusDone
                : days < 0
                  ? styles.statusLate
                  : styles.statusSoon
            }>
            {status}
          </VixText>
        </View>
        <VixText heading="label">📆 {formatFullDate(s.date.toDate())}</VixText>
        {s.note ? <VixText heading="label">📝 {s.note}</VixText> : null}
      </PressableScale>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Health"
        title="Donor Darah 🩸"
        subtitle="Jadwal, tempat & kelayakan donor"
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {data === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* ===== Hero: golongan darah + kelayakan ===== */}
          <View style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={styles.bloodBadge}>
                <VixText heading="header" additionalStyle={styles.bloodText}>
                  {profile?.bloodType ?? '—'}
                </VixText>
              </View>
              <View style={styles.heroInfo}>
                <VixText heading="label" additionalStyle={styles.heroLabel}>
                  🩸 Golongan darah
                </VixText>
                <VixText heading="bold" additionalStyle={styles.heroValue}>
                  {canDonate
                    ? 'Boleh donor sekarang! 🎉'
                    : nextDate
                      ? `${formatMonthsDays(today, nextDate)} lagi`
                      : `${eligibleDays} hari lagi`}
                </VixText>
                <VixText heading="label" additionalStyle={styles.heroLabel}>
                  {d.lastDonation
                    ? `Terakhir: ${formatFullDate(d.lastDonation.toDate())}`
                    : 'Belum ada catatan donor'}
                  {!canDonate && nextDate
                    ? ` · boleh lagi ${formatFullDate(nextDate)}`
                    : ''}
                </VixText>
              </View>
            </View>
            <PressableScale style={styles.heroEdit} onPress={openLast}>
              <IconSymbol name="pencil" size={14} color={Color.TEXT_ON_DARK_MUTED} />
              <VixText heading="label" additionalStyle={styles.heroEditText}>
                Ubah tanggal donor terakhir
              </VixText>
            </PressableScale>
          </View>

          {/* ===== Jadwal donor ===== */}
          <View style={styles.sectionHeader}>
            <VixText heading="title">📅 Jadwal Donor</VixText>
          </View>
          <PrimaryButton
            label="Tambah Jadwal"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addButton}
          />
          {upcoming.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada jadwal. Yuk rencanakan donor berikutnya 🩸
            </VixText>
          ) : (
            upcoming.map(renderSchedule)
          )}

          {history.length > 0 && (
            <>
              <VixText heading="label" additionalStyle={styles.historyLabel}>
                Riwayat
              </VixText>
              {history.map(renderSchedule)}
            </>
          )}

          {/* ===== Catatan pribadi ===== */}
          <View style={styles.sectionHeader}>
            <VixText heading="title">📝 Catatan Donor</VixText>
            <PressableScale onPress={openNotes} hitSlop={8}>
              <VixText heading="bold" additionalStyle={styles.editLink}>
                {d.notes ? 'Ubah' : 'Tambah'}
              </VixText>
            </PressableScale>
          </View>
          <PressableScale style={styles.notesCard} onPress={openNotes}>
            <VixText
              heading="paragraph"
              additionalStyle={d.notes ? styles.notesText : styles.notesEmpty}>
              {d.notes || 'Simpan info penting: no antrean PMI, hasil Hb terakhir, pantangan, dll.'}
            </VixText>
          </PressableScale>

          {/* ===== Syarat donor (dropdown) ===== */}
          <PressableScale
            style={styles.infoHeader}
            onPress={() => setReqOpen((o) => !o)}>
            <VixText heading="title">✅ Syarat Donor</VixText>
            <IconSymbol
              name={reqOpen ? 'chevron.up' : 'chevron.down'}
              size={18}
              color={Color.TEXT_LABEL}
            />
          </PressableScale>
          {reqOpen && (
            <View style={styles.infoCard}>
              {DONOR_REQUIREMENTS.map((r) => (
                <VixText key={r} heading="paragraph" additionalStyle={styles.infoItem}>
                  • {r}
                </VixText>
              ))}
            </View>
          )}

          {/* ===== Tips donor (dropdown) ===== */}
          <PressableScale
            style={styles.infoHeader}
            onPress={() => setTipsOpen((o) => !o)}>
            <VixText heading="title">💡 Tips Donor</VixText>
            <IconSymbol
              name={tipsOpen ? 'chevron.up' : 'chevron.down'}
              size={18}
              color={Color.TEXT_LABEL}
            />
          </PressableScale>
          {tipsOpen && (
            <View style={styles.infoCard}>
              {DONOR_TIPS.map((t) => (
                <VixText key={t} heading="paragraph" additionalStyle={styles.infoItem}>
                  {t}
                </VixText>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Sheet tambah/edit jadwal */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Jadwal Donor' : 'Edit Jadwal'}
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tempat donor
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Tempat Donor"
          value={fLocation}
          onChangeText={setFLocation}
          editable={!busy}
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>
        <FormInput
          style={styles.formGap}
          placeholder="Catatan (opsional)"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />
        {/* Tandai selesai → jadi donor terakhir */}
        <PressableScale style={styles.doneRow} onPress={() => setFDone((v) => !v)}>
          <CheckCircle checked={fDone} />
          <VixText heading="paragraph" additionalStyle={styles.doneText}>
            Sudah donor ✅ (jadikan donor terakhir)
          </VixText>
        </PressableScale>
        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {editing !== 'new' && editing !== null && (
          <InlineDelete
            key={editing.id}
            label="Hapus jadwal ini"
            busy={busy}
            onDelete={handleDeleteSchedule}
          />
        )}
        <DualButtons
          confirmLabel={editing === 'new' ? 'Tambah' : 'Simpan'}
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSaveSchedule}
        />
      </SheetModal>

      {/* Dialog set donor terakhir */}
      <CenterDialog visible={lastOpen} onClose={() => setLastOpen(false)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          Donor Terakhir
        </VixText>
        <VixText heading="label" additionalStyle={styles.modalHint}>
          Dipakai menghitung kapan kamu boleh donor lagi (jeda 3 bulan).
        </VixText>
        <View style={styles.formGap}>
          <DateField key="last" value={fLast} onChange={setFLast} />
        </View>
        <DualButtons
          confirmLabel="Simpan"
          onCancel={() => setLastOpen(false)}
          onConfirm={handleSaveLast}
        />
      </CenterDialog>

      {/* Sheet editor catatan */}
      <SheetModal
        visible={notesOpen}
        title="Catatan Donor"
        onClose={() => setNotesOpen(false)}>
        <FormInput
          style={styles.notesInput}
          placeholder="Tulis info penting soal donor kamu…"
          value={fNotes}
          onChangeText={setFNotes}
          multiline
        />
        <DualButtons
          confirmLabel="Simpan"
          onCancel={() => setNotesOpen(false)}
          onConfirm={handleSaveNotes}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  heroCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    marginBottom: 16,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bloodBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Color.FINANCE_EXPENSE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloodText: { color: Color.DANGER },
  heroInfo: { flex: 1, gap: 2 },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  heroEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  heroEditText: { color: Color.TEXT_ON_DARK_MUTED },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginBottom: 8 },
  historyLabel: { marginTop: 6, marginBottom: 8, color: Color.TEXT_LABEL },
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
    backgroundColor: Color.FINANCE_EXPENSE,
    borderColor: Color.DANGER,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  statusDone: { color: Color.SUCCESS },
  statusLate: { color: Color.WARNING },
  statusSoon: { color: Color.DANGER },
  editLink: { color: Color.MAIN },
  notesCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    marginBottom: 16,
  },
  notesText: { color: Color.TEXT_PARAGRAPH },
  notesEmpty: { color: Color.TEXT_PLACEHOLDER },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 8,
    marginBottom: 6,
  },
  infoItem: { color: Color.TEXT_PARAGRAPH },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  doneText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  notesInput: {
    minHeight: 140,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  modalTitle: { marginBottom: 4 },
  modalHint: { marginBottom: 10 },
});
