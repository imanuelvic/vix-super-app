import { useLocalSearchParams } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatFullDate } from '@/lib/format';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
    deleteMultiplication,
    membersOf,
    multiProgress,
    multiStatus,
    multiStatusLabel,
    newMemberId,
    newStepId,
    nextStep,
    saveMultiplication,
    SIDE_META,
    sideLabel,
    stepsByMonth,
    subscribeMultiplications,
    type MultiMember,
    type Multiplication,
    type MultiSide,
    type MultiStep,
} from '@/lib/multiplication';

type DetailTab = 'timeline' | 'members';

/** Tiga keadaan langkah — sama lambangnya dengan yang kamu pakai di sheet. */
const STEP_MARKS: { key: 'done' | 'todo' | 'cancel'; label: string }[] = [
  { key: 'done', label: '✅ Beres' },
  { key: 'todo', label: '⏳ Belum' },
  { key: 'cancel', label: '❌ Batal' },
];

function markOf(step: MultiStep): 'done' | 'todo' | 'cancel' {
  return step.cancelled ? 'cancel' : step.done ? 'done' : 'todo';
}

// Detail satu multiplikasi CORE 🌱 — timeline langkahnya & pembagian
// anggotanya. Dibuka dari kartu di CORE › Multiplication.
export default function MultiplicationDetailScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [list, setList] = useState<Multiplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('timeline');
  const [side, setSide] = useState<MultiSide>('a');

  // Sheet ubah/tambah langkah.
  const [editStep, setEditStep] = useState<MultiStep | 'new' | null>(null);
  const [sDate, setSDate] = useState(new Date());
  const [sTitle, setSTitle] = useState('');
  const [sNotes, setSNotes] = useState('');
  const [sMark, setSMark] = useState<'done' | 'todo' | 'cancel'>('todo');

  // Sheet ubah/tambah anggota.
  const [editMember, setEditMember] = useState<MultiMember | 'new' | null>(null);
  const [mName, setMName] = useState('');
  const [mAge, setMAge] = useState('');
  const [mReason, setMReason] = useState('');
  const [mSide, setMSide] = useState<MultiSide>('a');

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeMultiplications(user.uid, setList, () =>
      setError(LOAD_ERROR),
    );
  }, [user]);

  const m = list?.find((x) => x.id === id) ?? null;

  /** Simpan seluruh dokumennya — satu tulis untuk perubahan apa pun. */
  async function save(next: Multiplication) {
    if (!user) return;
    setError(null);
    try {
      await saveMultiplication(user.uid, next);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  // ---------- Langkah ----------

  function openAddStep() {
    setEditStep('new');
    setSDate(new Date());
    setSTitle('');
    setSNotes('');
    setSMark('todo');
    setFormError(null);
  }

  function openEditStep(step: MultiStep) {
    setEditStep(step);
    setSDate(step.date.toDate());
    setSTitle(step.title);
    setSNotes(step.notes.join('\n'));
    setSMark(markOf(step));
    setFormError(null);
  }

  async function handleSaveStep() {
    if (!m || !editStep || busy) return;
    if (!sTitle.trim()) {
      setFormError('Isi nama langkahnya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: MultiStep = {
      id: editStep === 'new' ? newStepId() : editStep.id,
      date: Timestamp.fromDate(sDate),
      title: sTitle.trim(),
      // Satu baris = satu poin; baris kosong dibuang.
      notes: sNotes
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean),
      done: sMark === 'done',
      cancelled: sMark === 'cancel',
    };
    await save({
      ...m,
      steps:
        editStep === 'new'
          ? [...m.steps, data]
          : m.steps.map((s) => (s.id === editStep.id ? data : s)),
    });
    setBusy(false);
    setEditStep(null);
  }

  /** Hapus PERMANEN: langkahnya dibuang dari array lalu dokumen ditulis ulang. */
  async function handleDeleteStep() {
    if (!m || !editStep || editStep === 'new' || busy) return;
    setBusy(true);
    await save({ ...m, steps: m.steps.filter((s) => s.id !== editStep.id) });
    setBusy(false);
    setEditStep(null);
  }

  /** Klik lingkaran status → ✅ ⇄ ⏳ (yang ❌ batal tidak ikut, harus lewat sheet). */
  function toggleStep(step: MultiStep) {
    if (!m || step.cancelled) return;
    save({
      ...m,
      steps: m.steps.map((s) =>
        s.id === step.id ? { ...s, done: !s.done } : s,
      ),
    });
  }

  // ---------- Anggota ----------

  function openAddMember() {
    setEditMember('new');
    setMName('');
    setMAge('');
    setMReason('');
    setMSide(side);
    setFormError(null);
  }

  function openEditMember(member: MultiMember) {
    setEditMember(member);
    setMName(member.name);
    setMAge(member.age === null ? '' : String(member.age));
    setMReason(member.reason);
    setMSide(member.side);
    setFormError(null);
  }

  async function handleSaveMember() {
    if (!m || !editMember || busy) return;
    if (!mName.trim()) {
      setFormError('Isi namanya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const umur = Number(mAge.replace(/\D/g, ''));
    const data: MultiMember = {
      id: editMember === 'new' ? newMemberId() : editMember.id,
      name: mName.trim(),
      age: umur > 0 ? umur : null,
      reason: mReason.trim(),
      side: mSide,
    };
    await save({
      ...m,
      members:
        editMember === 'new'
          ? [...m.members, data]
          : m.members.map((x) => (x.id === editMember.id ? data : x)),
    });
    setBusy(false);
    setEditMember(null);
  }

  async function handleDeleteMember() {
    if (!m || !editMember || editMember === 'new' || busy) return;
    setBusy(true);
    await save({
      ...m,
      members: m.members.filter((x) => x.id !== editMember.id),
    });
    setBusy(false);
    setEditMember(null);
  }

  /** Hapus seluruh multiplikasi — dokumennya benar-benar dibuang. */
  async function handleDeleteAll() {
    if (!user || !m || busy) return;
    setBusy(true);
    try {
      await deleteMultiplication(user.uid, m.id);
      // Layarnya menutup sendiri: `m` jadi null setelah snapshot masuk.
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  if (list === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader backLabel="CORE" title="Multiplikasi 🌱" />
        <LoadingCenter />
      </SafeAreaView>
    );
  }

  if (!m) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader backLabel="CORE" title="Multiplikasi 🌱" />
        <VixText heading="label" additionalStyle={styles.empty}>
          Multiplikasi ini sudah tidak ada.
        </VixText>
      </SafeAreaView>
    );
  }

  const { done, total } = multiProgress(m);
  const status = multiStatus(m);
  const upcoming = nextStep(m);
  const groups = stepsByMonth(m);
  const shownMembers = membersOf(m, side);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="CORE"
        title="Multiplikasi 🌱"
        subtitle={`${m.fromHeart} CORE ${m.fromName} → ${m.toHeart} CORE ${m.toName}`}
      />

      <ScreenError message={error} />

      <KeyboardAwareScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan: dua tonggak tanggalnya + kemajuan langkah */}
        <SummaryCard>
          <VixText heading="subheader" additionalStyle={summaryText.value}>
            {m.fromHeart} {m.fromName} → {m.toHeart} {m.toName}
          </VixText>
          {m.meetingDate && (
            <VixText heading="label" additionalStyle={summaryText.label}>
              🗓️ Multiplication Meeting:{' '}
              {formatFullDate(m.meetingDate.toDate())}
            </VixText>
          )}
          {m.firstCoreDate && (
            <VixText heading="label" additionalStyle={summaryText.label}>
              🎉 CORE Perdana: {formatFullDate(m.firstCoreDate.toDate())}
            </VixText>
          )}
          {(m.day || m.place) && (
            <VixText heading="label" additionalStyle={summaryText.label}>
              📍 {[m.day, m.place].filter(Boolean).join(' · ')}
            </VixText>
          )}
          <View style={styles.heroBar}>
            <ProgressBar
              value={done}
              total={total}
              color={Color.TEXT_REVERSE}
              track={Color.MAIN}
            />
          </View>
          <VixText heading="label" additionalStyle={summaryText.label}>
            {multiStatusLabel(status)} · {done}/{total} langkah
          </VixText>
        </SummaryCard>

        {/* Langkah berikutnya — supaya tidak perlu menyusuri timeline dulu
            untuk tahu "sekarang giliran apa". */}
        {upcoming && (
          <View style={styles.nextCard}>
            <VixText heading="label" additionalStyle={styles.nextLabel}>
              ⏭️ Langkah berikutnya
            </VixText>
            <VixText heading="bold" additionalStyle={styles.nextTitle}>
              {upcoming.title}
            </VixText>
            <VixText heading="label" additionalStyle={styles.nextLabel}>
              📆 {formatFullDate(upcoming.date.toDate())}
            </VixText>
          </View>
        )}

        <SegmentTabs
          tabs={[
            { key: 'timeline', label: '📆 Timeline', sub: `${done}/${total}` },
            {
              key: 'members',
              label: '👥 Anggota',
              sub: `${m.members.length} orang`,
            },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'timeline' ? (
          <>
            <PressableScale style={styles.addRow} onPress={openAddStep}>
              <VixText heading="bold" additionalStyle={styles.addText}>
                ➕ Tambah langkah
              </VixText>
            </PressableScale>

            {groups.length === 0 ? (
              <VixText heading="label" additionalStyle={styles.empty}>
                Timeline-nya masih kosong. Mulai dari langkah pertama —
                mis. “Training Calon CORE Leader Sesi 1” 🌱
              </VixText>
            ) : (
              groups.map((g) => (
                <View key={g.key}>
                  <VixText heading="title" additionalStyle={styles.monthTitle}>
                    {g.label}
                  </VixText>
                  {g.steps.map((step, i) => {
                    const mark = markOf(step);
                    const isNext = upcoming?.id === step.id;
                    return (
                      <Animated.View
                        key={step.id}
                        entering={FadeInDown.delay(Math.min(i, 6) * 30).duration(
                          260,
                        )}>
                        <View
                          style={[
                            styles.step,
                            mark === 'done' && styles.stepDone,
                            mark === 'cancel' && styles.stepCancel,
                            isNext && styles.stepNext,
                          ]}>
                          {/* Klik lambangnya = tandai beres / batalkan */}
                          <PressableScale
                            onPress={() => toggleStep(step)}
                            disabled={mark === 'cancel'}
                            hitSlop={8}
                            haptic={mark === 'done' ? 'light' : 'success'}>
                            <VixText additionalStyle={styles.stepMark}>
                              {mark === 'done'
                                ? '✅'
                                : mark === 'cancel'
                                  ? '❌'
                                  : '⏳'}
                            </VixText>
                          </PressableScale>
                          <PressableScale
                            style={styles.stepMain}
                            onPress={() => openEditStep(step)}>
                            <VixText
                              heading="label"
                              additionalStyle={styles.stepDate}>
                              📆 {formatFullDate(step.date.toDate())}
                            </VixText>
                            <VixText
                              heading="bold"
                              additionalStyle={[
                                styles.stepTitle,
                                mark === 'cancel' && styles.stepTitleCancel,
                              ]}>
                              {step.title}
                            </VixText>
                            {step.notes.map((n, k) => (
                              <VixText
                                key={`${k}-${n}`}
                                heading="label"
                                additionalStyle={styles.stepNote}>
                                • {n}
                              </VixText>
                            ))}
                          </PressableScale>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {/* Kelompok anggota — angkanya ikut jumlah tiap sisi */}
            <View style={styles.sideRow}>
              {SIDE_META.map((s) => (
                <Chip
                  key={s.key}
                  label={`${sideLabel(m, s.key)} ${membersOf(m, s.key).length}`}
                  active={side === s.key}
                  onPress={() => setSide(s.key)}
                />
              ))}
            </View>

            <PressableScale style={styles.addRow} onPress={openAddMember}>
              <VixText heading="bold" additionalStyle={styles.addText}>
                ➕ Tambah anggota
              </VixText>
            </PressableScale>

            {shownMembers.length === 0 ? (
              <VixText heading="label" additionalStyle={styles.empty}>
                Belum ada yang masuk kelompok ini.
              </VixText>
            ) : (
              shownMembers.map((p) => (
                <PressableScale
                  key={p.id}
                  style={styles.member}
                  onPress={() => openEditMember(p)}>
                  <View style={styles.memberTop}>
                    <VixText
                      heading="bold"
                      numberOfLines={1}
                      additionalStyle={styles.memberName}>
                      {p.name}
                    </VixText>
                    <VixText heading="label" additionalStyle={styles.memberAge}>
                      {p.age === null ? '—' : `${p.age} th`}
                    </VixText>
                  </View>
                  {p.reason ? (
                    <VixText heading="label">{p.reason}</VixText>
                  ) : null}
                </PressableScale>
              ))
            )}
          </>
        )}

        <InlineDelete
          key={m.id}
          label="Hapus multiplikasi ini"
          busy={busy}
          onDelete={handleDeleteAll}
        />
      </KeyboardAwareScrollView>

      {/* ===== Sheet langkah ===== */}
      <SheetModal
        visible={!!editStep}
        title={editStep === 'new' ? 'Tambah Langkah' : 'Ubah Langkah'}
        onClose={() => setEditStep(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📆 Tanggal
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={editStep === 'new' ? 'new' : (editStep?.id ?? '')}
            value={sDate}
            onChange={setSDate}
          />
        </View>
        <FormInput
          style={styles.formGap}
          placeholder="Langkahnya apa?"
          value={sTitle}
          onChangeText={setSTitle}
          editable={!busy}
        />
        <FormInput
          style={[styles.formGap, styles.notesInput]}
          placeholder={'Catatan'}
          value={sNotes}
          onChangeText={setSNotes}
          editable={!busy}
          multiline
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Status
        </VixText>
        <View style={styles.markRow}>
          {STEP_MARKS.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              active={sMark === s.key}
              onPress={() => setSMark(s.key)}
              additionalStyle={styles.markChip}
            />
          ))}
        </View>

        <FormError message={formError} />
        <EditDelete
          editing={editStep}
          label="Hapus langkah ini"
          busy={busy}
          onDelete={handleDeleteStep}
        />
        <PrimaryButton label="Simpan" onPress={handleSaveStep} busy={busy} />
      </SheetModal>

      {/* ===== Sheet anggota ===== */}
      <SheetModal
        visible={!!editMember}
        title={editMember === 'new' ? 'Tambah Anggota' : 'Ubah Anggota'}
        onClose={() => setEditMember(null)}>
        <FormInput
          style={styles.formGap}
          placeholder="Nama"
          value={mName}
          onChangeText={setMName}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Umur"
          keyboardType="number-pad"
          value={mAge}
          onChangeText={setMAge}
          editable={!busy}
        />
        <FormInput
          style={styles.formGap}
          placeholder="Alasan ditempatkan)"
          value={mReason}
          onChangeText={setMReason}
          editable={!busy}
          multiline
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Masuk kelompok
        </VixText>
        <View style={styles.markRow}>
          {SIDE_META.map((s) => (
            <Chip
              key={s.key}
              label={sideLabel(m, s.key)}
              active={mSide === s.key}
              onPress={() => setMSide(s.key)}
            />
          ))}
        </View>

        <FormError message={formError} />
        <EditDelete
          editing={editMember}
          label="Hapus anggota ini"
          busy={busy}
          onDelete={handleDeleteMember}
        />
        <PrimaryButton label="Simpan" onPress={handleSaveMember} busy={busy} />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  empty: { textAlign: 'center', marginTop: 20, marginBottom: 12 },
  heroBar: { marginTop: 8, marginBottom: 2 },
  // Kartu "langkah berikutnya" — warna Spiritual biar beda jelas dari timeline.
  nextCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    marginBottom: 12,
  },
  nextLabel: { color: Color.SPIRITUAL_DARK },
  nextTitle: { color: Color.SPIRITUAL_DARK },
  // Timeline
  monthTitle: { marginTop: 14, marginBottom: 8 },
  step: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  stepDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  // Batal/digeser — sengaja tetap kelihatan, cuma diredupkan.
  stepCancel: { opacity: 0.6 },
  stepNext: { borderColor: Color.MAIN_DARK, borderWidth: 1.5 },
  stepMark: { fontSize: 18, lineHeight: 24 },
  stepMain: { flex: 1, gap: 2 },
  stepDate: { color: Color.TEXT_PLACEHOLDER },
  stepTitle: { color: Color.TEXT_TITLE },
  stepTitleCancel: { textDecorationLine: 'line-through' },
  stepNote: { color: Color.TEXT_LABEL },
  // Anggota
  sideRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  member: {
    ...CARD,
    marginBottom: 8,
    gap: 2,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  memberName: { flex: 1, color: Color.TEXT_TITLE },
  memberAge: { color: Color.TEXT_LABEL },
  // Tombol tambah (garis putus-putus, sama seperti "Tambah kebiasaan").
  addRow: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Color.MAIN_LIGHT,
    marginTop: 12,
    marginBottom: 4,
  },
  addText: { color: Color.MAIN },
  // Form
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  notesInput: { minHeight: 88, textAlignVertical: 'top' },
  markRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  markChip: { flex: 1 },
});
