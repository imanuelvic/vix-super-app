import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  DISC_OPTIONS,
  LOVE_LANG_OPTIONS,
  MBTI_TIP,
  MBTI_TYPES,
} from '@/lib/core';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { SAVE_ERROR } from '@/lib/messages';
import {
  ENNEAGRAM_OPTIONS,
  MBTI_NICKNAME,
  saveSelfKnowledge,
  TEMPERAMENT_OPTIONS,
  testDaysLeft,
  type Personality,
} from '@/lib/selfKnowledge';
import { otherTaskDaysUntil, subscribeOtherTasks, type OtherTask } from '@/lib/tasks';

// Subtab Personality 🧠 — hasil tes kepribadian yang gampang lupa: MBTI,
// Love Language, DISC, Enneagram, temperamen, plus kekuatan utama & catatan.
// Tes MBTI & Love Language diingatkan diulang setahun sekali; reminder
// prioritas yang menyebut tes itu ikut ditarik ke sini biar sinkron.
export function PersonalityTab({ data }: { data: Personality }) {
  const { user } = useAuth();
  const now = new Date();
  const todayId = dayDocId(now);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Personality>(data);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reminder prioritas yang menyinggung tes kepribadian — ditarik dari fitur
  // Reminder supaya jadwal tesnya tidak tercatat di dua tempat berbeda.
  const [tasks, setTasks] = useState<OtherTask[]>([]);
  useEffect(() => {
    if (!user) return;
    return subscribeOtherTasks(user.uid, setTasks);
  }, [user]);
  const testTasks = tasks.filter((t) =>
    /mbti|love language|kepribadian|personality|disc/i.test(`${t.title} ${t.note}`),
  );

  const mbtiLeft = testDaysLeft(data.mbtiDayId, now);
  const loveLeft = testDaysLeft(data.loveDayId, now);

  function openEdit() {
    setForm(data);
    setError(null);
    setEditOpen(true);
  }

  async function handleSave() {
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveSelfKnowledge(user.uid, { personality: form });
      setEditOpen(false);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  const love = LOVE_LANG_OPTIONS.find((l) => l.key === data.loveLanguage);
  const disc = DISC_OPTIONS.find((d) => d.key === data.disc);
  const enn = ENNEAGRAM_OPTIONS.find((e) => e.key === data.enneagram);
  const temp = TEMPERAMENT_OPTIONS.find((t) => t.key === data.temperament);

  function set<K extends keyof Personality>(key: K, value: Personality[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Ganti hasil tes → tanggal tesnya otomatis diisi HARI INI supaya hitungan
   * "setahun lagi" mulai dari sekarang. Tetap bisa diubah manual di bawahnya
   * (mis. kalau tesnya sebenarnya dilakukan bulan lalu).
   */
  function setResult(
    valueKey: 'mbti' | 'loveLanguage',
    dateKey: 'mbtiDayId' | 'loveDayId',
    value: string | null,
  ) {
    setForm((prev) => ({
      ...prev,
      [valueKey]: value,
      [dateKey]: value ? (prev[dateKey] ?? todayId) : null,
    }));
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Hero MBTI — huruf besar ala kartu hasil tes */}
      <PressableScale style={styles.hero} onPress={openEdit}>
        <VixText heading="label" additionalStyle={styles.heroLabel}>
          🧩 Tipe MBTI
        </VixText>
        <VixText heading="header" additionalStyle={styles.heroCode}>
          {data.mbti ?? '????'}
        </VixText>
        <VixText heading="bold" additionalStyle={styles.heroNick}>
          {data.mbti ? MBTI_NICKNAME[data.mbti] : 'Belum dites'}
        </VixText>
        {data.mbti && MBTI_TIP[data.mbti] ? (
          <VixText heading="label" additionalStyle={styles.heroTip}>
            {MBTI_TIP[data.mbti]}
          </VixText>
        ) : null}
      </PressableScale>

      {/* Kartu-kartu hasil tes lain */}
      <TraitCard
        emoji="💞"
        title="Love Language"
        value={love?.label ?? null}
        sub={love?.idea}
        bg={Color.WHEEL}
        fg={Color.WHEEL_DARK}
        onPress={openEdit}
      />
      <TraitCard
        emoji="🎯"
        title="DISC"
        value={disc?.label ?? null}
        sub={disc?.chat}
        bg={Color.FINANCE_INVESTMENT}
        fg={Color.FINANCE_INVESTMENT_DARK}
        onPress={openEdit}
      />
      <TraitCard
        emoji="🔢"
        title="Enneagram"
        value={enn?.label ?? null}
        sub={enn?.sub}
        bg={Color.LEARNING}
        fg={Color.LEARNING_DARK}
        onPress={openEdit}
      />
      <TraitCard
        emoji="🌡️"
        title="Temperamen"
        value={temp?.label ?? null}
        sub={temp?.sub}
        bg={Color.FUN}
        fg={Color.FUN_DARK}
        onPress={openEdit}
      />

      {data.strengths ? (
        <View style={styles.noteCard}>
          <VixText heading="title" additionalStyle={styles.noteTitle}>
            💪 Kekuatan Utama
          </VixText>
          <VixText heading="paragraph">{data.strengths}</VixText>
        </View>
      ) : null}
      {data.notes ? (
        <View style={styles.noteCard}>
          <VixText heading="title" additionalStyle={styles.noteTitle}>
            📝 Catatan Tentang Diriku
          </VixText>
          <VixText heading="paragraph">{data.notes}</VixText>
        </View>
      ) : null}

      {/* ===== Jadwal tes ulang (setahun sekali) ===== */}
      <View style={styles.testCard}>
        <VixText heading="title" additionalStyle={styles.testTitle}>
          🔁 Tes Ulang Tahunan
        </VixText>
        <TestRow label="🧩 MBTI" dayId={data.mbtiDayId} left={mbtiLeft} />
        <TestRow label="💞 Love Language" dayId={data.loveDayId} left={loveLeft} />
        {testTasks.length > 0 && (
          <>
            <VixText heading="label" additionalStyle={styles.testHint}>
              Dari Reminder Prioritas:
            </VixText>
            {testTasks.map((t) => {
              const d = otherTaskDaysUntil(t, now);
              return (
                <VixText key={t.id} heading="label" additionalStyle={styles.testTask}>
                  • {t.title}
                  {d != null
                    ? d < 0
                      ? ` — lewat ${Math.abs(d)} hari`
                      : d === 0
                        ? ' — HARI INI'
                        : ` — ${d} hari lagi`
                    : ''}
                </VixText>
              );
            })}
          </>
        )}
      </View>

      <PressableScale style={styles.editButton} onPress={openEdit}>
        <VixText heading="bold" additionalStyle={styles.editText}>
          ✏️ Ubah Data Kepribadian
        </VixText>
      </PressableScale>

      {/* Modal ubah — semua pilihan pakai picker, bukan daftar terbuka */}
      <SheetModal
        visible={editOpen}
        title="Kepribadianku 🧠"
        subtitle="Isi seadanya — bisa dilengkapi kapan saja"
        onClose={() => setEditOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={saving}
            onCancel={() => setEditOpen(false)}
            onConfirm={handleSave}
          />
        }>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🧩 MBTI
        </VixText>
        <SelectField
          value={form.mbti}
          options={MBTI_TYPES.map((m) => ({
            key: m,
            label: `${m} · ${MBTI_NICKNAME[m]}`,
          }))}
          onChange={(v) => setResult('mbti', 'mbtiDayId', v)}
          placeholder="Pilih tipe MBTI…"
          clearable
        />
        <TestDateField
          value={form.mbtiDayId}
          onChange={(id) => set('mbtiDayId', id)}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          💞 Love Language
        </VixText>
        <SelectField
          value={form.loveLanguage}
          options={LOVE_LANG_OPTIONS.map((l) => ({ key: l.key, label: l.label }))}
          onChange={(v) => setResult('loveLanguage', 'loveDayId', v)}
          placeholder="Pilih love language…"
          clearable
        />
        <TestDateField
          value={form.loveDayId}
          onChange={(id) => set('loveDayId', id)}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🎯 DISC
        </VixText>
        <SelectField
          value={form.disc}
          options={DISC_OPTIONS.map((d) => ({ key: d.key, label: d.label }))}
          onChange={(v) => set('disc', v)}
          placeholder="Pilih tipe DISC…"
          clearable
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🔢 Enneagram
        </VixText>
        <SelectField
          value={form.enneagram}
          options={ENNEAGRAM_OPTIONS}
          onChange={(v) => set('enneagram', v)}
          placeholder="Pilih tipe Enneagram…"
          clearable
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🌡️ Temperamen
        </VixText>
        <SelectField
          value={form.temperament}
          options={TEMPERAMENT_OPTIONS}
          onChange={(v) => set('temperament', v)}
          placeholder="Pilih temperamen…"
          clearable
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          💪 Kekuatan utama
        </VixText>
        <FormInput
          style={styles.textArea}
          placeholder="mis. Learner, Achiever, Responsibility…"
          value={form.strengths}
          onChangeText={(t) => set('strengths', t)}
          editable={!saving}
          multiline
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📝 Catatan tentang diriku
        </VixText>
        <FormInput
          style={styles.textArea}
          placeholder="Hal yang kamu sadari tentang dirimu…"
          value={form.notes}
          onChangeText={(t) => set('notes', t)}
          editable={!saving}
          multiline
        />

        <FormError message={error} gap="top" />
      </SheetModal>
    </ScrollView>
  );
}

// Kartu satu hasil tes — warna pastel beda tiap jenis biar gampang dibedakan.
function TraitCard({
  emoji,
  title,
  value,
  sub,
  bg,
  fg,
  onPress,
}: {
  emoji: string;
  title: string;
  value: string | null;
  sub?: string;
  bg: string;
  fg: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      style={[styles.traitCard, { backgroundColor: bg, borderColor: fg }]}
      onPress={onPress}>
      <VixText heading="label" additionalStyle={{ color: fg }}>
        {emoji} {title}
      </VixText>
      <VixText heading="title" additionalStyle={styles.traitValue}>
        {value ?? 'Belum diisi'}
      </VixText>
      {value && sub ? (
        <VixText heading="label" additionalStyle={{ color: fg }}>
          {sub}
        </VixText>
      ) : null}
    </PressableScale>
  );
}

// Tanggal TES TERAKHIR — muncul di bawah tiap pilihan hasil tes. Dari sinilah
// hitungan "tes lagi setahun kemudian" dimulai, jadi bisa diisi tanggal
// sebenarnya (bukan selalu hari ini).
function TestDateField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (dayId: string) => void;
}) {
  if (!value) return null;
  return (
    <View style={styles.testDateWrap}>
      <VixText heading="label" additionalStyle={styles.testDateLabel}>
        Tanggal tes terakhir
      </VixText>
      <DateField
        value={dayIdToDate(value)}
        onChange={(d) => onChange(dayDocId(d))}
      />
    </View>
  );
}

// Baris jadwal tes ulang.
function TestRow({
  label,
  dayId,
  left,
}: {
  label: string;
  dayId: string | null;
  left: number | null;
}) {
  const due = left != null && left <= 0;
  return (
    <View style={styles.testRow}>
      <View style={styles.testMain}>
        <VixText heading="bold" additionalStyle={styles.testLabel}>
          {label}
        </VixText>
        <VixText heading="label">
          {dayId
            ? `Terakhir: ${formatFullDate(dayIdToDate(dayId))}`
            : 'Belum pernah dites'}
        </VixText>
      </View>
      <VixText heading="bold" additionalStyle={due ? styles.testDue : styles.testOk}>
        {left == null ? '—' : due ? 'Waktunya!' : `${left} hari`}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  hero: {
    backgroundColor: Color.SPIRITUAL_DARK,
    borderRadius: 22,
    padding: 20,
    gap: 3,
    marginBottom: 12,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroCode: { color: Color.TEXT_REVERSE, letterSpacing: 3 },
  heroNick: { color: Color.TEXT_REVERSE },
  heroTip: { color: Color.TEXT_ON_DARK_MUTED, marginTop: 4 },
  traitCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 2,
    marginBottom: 10,
  },
  traitValue: { color: Color.TEXT_TITLE },
  noteCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 4,
    marginBottom: 10,
  },
  noteTitle: { marginBottom: 2 },
  testCard: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.MAIN_LIGHT,
    padding: 16,
    marginBottom: 12,
  },
  testTitle: { color: Color.MAIN_DARK, marginBottom: 4 },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  testMain: { flex: 1, gap: 1 },
  testLabel: { color: Color.TEXT_TITLE },
  testOk: { color: Color.MAIN_DARK },
  testDue: { color: Color.DANGER },
  testHint: { marginTop: 6 },
  testTask: { color: Color.TEXT_PARAGRAPH },
  editButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Color.MAIN,
  },
  editText: { color: Color.MAIN_DARK },
  fieldLabel: { marginTop: 12, marginBottom: 6 },
  testDateWrap: { marginTop: 8 },
  testDateLabel: { color: Color.TEXT_LABEL, marginBottom: 6 },
  textArea: { minHeight: 84, textAlignVertical: 'top' },
});
