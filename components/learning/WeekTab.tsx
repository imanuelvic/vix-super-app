import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { BOOKS } from '@/lib/books';
import {
  dueStep,
  LEARNING_STEPS,
  setLearningNote,
  setLearningStep,
  setSkillDone,
  setTopicDone,
  setWeekSkill,
  SKILLS,
  skillAreaMeta,
  skillOf,
  skillOfWeek,
  stepsDone,
  topicGroupMeta,
  topicOfWeek,
  weekComplete,
  WEEK_MINUTES,
  type LearningStep,
  type LearningWeek,
  type SkillsDone,
  type TopicsDone,
} from '@/lib/learning';
import { SAVE_ERROR } from '@/lib/messages';
import { formatWeekRange } from '@/lib/usage';

// Sub-tab 🎯 Minggu Ini — inti fitur Learning.
// Satu topik per minggu, dicicil 4 langkah kecil di hari yang jadwalmu lowong.
// Topiknya diputar otomatis supaya kamu tidak perlu memilih tiap minggu
// (memilih itu sendiri sering jadi alasan menunda), tapi tetap boleh diganti.
export function WeekTab({
  week,
  weekId,
  now,
  skillsDone,
  topicsDone,
}: {
  week: LearningWeek;
  weekId: string;
  now: Date;
  skillsDone: SkillsDone;
  topicsDone: TopicsDone;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const [pickOpen, setPickOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Topik minggu ini: hasil rotasi otomatis, KECUALI kalau sudah diganti manual.
  const skill = (week.skillKey ? skillOf(week.skillKey) : null) ?? skillOfWeek(now);
  const area = skillAreaMeta(skill.area);
  const book = skill.bookKey ? BOOKS.find((b) => b.key === skill.bookKey) : null;

  const doneCount = stepsDone(week.steps);
  const complete = weekComplete(week.steps);
  const due = dueStep(week.steps, now);
  const topic = topicOfWeek(now);
  const topicGroup = topicGroupMeta(topic.group);
  const topicChecked = !!topicsDone[topic.key];

  async function toggleStep(step: LearningStep) {
    if (!user) return;
    setError(null);
    const next = { ...week.steps, [step]: !week.steps[step] };
    try {
      await setLearningStep(user.uid, weekId, step, !week.steps[step]);
      // Empat langkah beres = skill-nya masuk daftar "sudah dipelajari".
      // Kalau centangnya dilepas lagi, tandanya ikut dicabut — biar daftar
      // Skills selalu jujur.
      const wasComplete = weekComplete(week.steps);
      const nowComplete = weekComplete(next);
      if (nowComplete !== wasComplete) {
        await setSkillDone(user.uid, skill.key, nowComplete ? weekId : null);
      }
    } catch {
      setError(SAVE_ERROR);
    }
  }

  async function saveNote(text: string) {
    if (!user) return;
    try {
      await setLearningNote(user.uid, weekId, text);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  async function pickSkill(key: string) {
    if (!user) return;
    try {
      await setWeekSkill(user.uid, weekId, key);
      setPickOpen(false);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  async function toggleTopic() {
    if (!user) return;
    try {
      await setTopicDone(user.uid, topic.key, !topicChecked);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* ===== Topik minggu ini ===== */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <VixText heading="label" additionalStyle={styles.heroWeek}>
              📅 {formatWeekRange(now)}
            </VixText>
            <View style={styles.heroCount}>
              <VixText heading="bold" additionalStyle={styles.heroCountText}>
                {doneCount}/{LEARNING_STEPS.length}
              </VixText>
            </View>
          </View>

          <VixText heading="subheader" additionalStyle={styles.heroTitle}>
            {area.emoji} {skill.title}
          </VixText>
          <VixText heading="label" additionalStyle={styles.heroWhat}>
            {skill.what}
          </VixText>
          {skill.extra ? (
            <VixText heading="label" additionalStyle={styles.heroWhat}>
              ➕ {skill.extra}
            </VixText>
          ) : null}

          <View style={styles.heroBar}>
            {/* Warna gelap: isian bar harus kontras di atas kartu periwinkle. */}
            <ProgressBar
              value={doneCount}
              total={LEARNING_STEPS.length}
              color={complete ? Color.MAIN_DARK : Color.LEARNING_DARK}
            />
          </View>

          {complete && (
            <VixText heading="bold" additionalStyle={styles.heroDone}>
              🎉 Minggu ini tuntas — satu ilmu baru masuk kantong
            </VixText>
          )}

          <PressableScale style={styles.changeButton} onPress={() => setPickOpen(true)}>
            <VixText heading="label" additionalStyle={styles.changeText}>
              🔀 Ganti topik minggu ini
            </VixText>
          </PressableScale>
        </View>

        {/* ===== Buku rujukan ===== */}
        {skill.book ? (
          book ? (
            <PressableScale
              style={styles.bookCard}
              onPress={() =>
                router.push({ pathname: '/book/[key]', params: { key: book.key } })
              }>
              <View style={styles.bookMain}>
                <VixText heading="bold" additionalStyle={styles.bookTitle}>
                  📚 {book.title}
                </VixText>
                <VixText heading="label" additionalStyle={styles.bookSub}>
                  {book.author} · {book.chapters.length} bab — ketuk untuk baca &
                  centang babnya
                </VixText>
              </View>
              <IconSymbol name="chevron.right" size={18} color={Color.MAIN_DARK} />
            </PressableScale>
          ) : (
            <View style={styles.bookCard}>
              <View style={styles.bookMain}>
                <VixText heading="bold" additionalStyle={styles.bookTitle}>
                  📚 {skill.book}
                </VixText>
                <VixText heading="label" additionalStyle={styles.bookSub}>
                  Belum ada di fitur Book — pakai sumber lain dulu (artikel/video)
                </VixText>
              </View>
            </View>
          )
        ) : null}

        {/* ===== 4 langkah ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Langkah minggu ini
        </VixText>

        {LEARNING_STEPS.map((s) => {
          const checked = !!week.steps[s.key];
          const isDue = due?.key === s.key;
          return (
            <View key={s.key}>
              <View
                style={[
                  styles.stepRow,
                  checked && styles.stepRowDone,
                  isDue && styles.stepRowDue,
                ]}>
                <PressableScale
                  onPress={() => toggleStep(s.key)}
                  hitSlop={8}
                  haptic={checked ? 'light' : 'success'}>
                  <CheckCircle checked={checked} />
                </PressableScale>
                <View style={styles.stepMain}>
                  <VixText
                    heading="bold"
                    additionalStyle={checked ? styles.stepTitleDone : undefined}>
                    {s.emoji} {s.day} — {s.label}
                    <VixText heading="label"> · {s.minutes} mnt</VixText>
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.stepHow}>
                    {s.how}
                  </VixText>
                  {isDue && !checked && (
                    <VixText heading="label" additionalStyle={styles.stepDue}>
                      👉 Ini giliranmu sekarang
                    </VixText>
                  )}
                </View>
              </View>

              {/* Kotak rangkuman menempel di langkah "Rangkum" */}
              {s.key === 'summarize' && (
                <NoteBox
                  key={weekId}
                  value={week.note}
                  onSave={saveNote}
                />
              )}
            </View>
          );
        })}

        {/* ===== Topik obrolan minggu ini ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Bahan ngobrol minggu ini
        </VixText>
        <PressableScale
          style={[styles.topicCard, topicChecked && styles.topicCardDone]}
          onPress={toggleTopic}
          haptic={topicChecked ? 'light' : 'success'}>
          <CheckCircle checked={topicChecked} />
          <View style={styles.stepMain}>
            <VixText heading="bold">
              {topicGroup.emoji} {topic.label}
            </VixText>
            <VixText heading="label" additionalStyle={styles.stepHow}>
              {topicGroup.hint}
            </VixText>
          </View>
        </PressableScale>

        {/* ===== Kenapa jadwalnya begini ===== */}
        <View style={styles.whyCard}>
          <VixText heading="bold" additionalStyle={styles.whyTitle}>
            💡 Kenapa jadwalnya Senin · Rabu · Jumat · Minggu?
          </VixText>
          <VixText heading="label" additionalStyle={styles.whyText}>
            • Selasa & Kamis sudah kepakai Doa Rantai CL, Sabtu penuh gereja —
            jadi belajarnya ditaruh di hari yang memang lowong.
          </VixText>
          <VixText heading="label" additionalStyle={styles.whyText}>
            • Jeda 2 hari antar langkah itu disengaja. Otak lebih kuat mengingat
            kalau diulang BERJARAK, bukan dihabiskan sekali duduk.
          </VixText>
          <VixText heading="label" additionalStyle={styles.whyText}>
            • Waktu terbaik: JAM MAKAN SIANG. Pagimu sudah 20 kebiasaan, dan
            malam ada Phone Away 21.30 + tidur 22.00 — dua-duanya jangan diganggu.
          </VixText>
          <VixText heading="label" additionalStyle={styles.whyText}>
            • Total cuma {WEEK_MINUTES} menit seminggu. Kecil, tapi setahun jadi
            52 ilmu baru.
          </VixText>
        </View>

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}
      </ScrollView>

      {/* Sheet ganti topik */}
      <SheetModal
        visible={pickOpen}
        title="Ganti Topik Minggu Ini"
        subtitle="Rotasi otomatis akan ditimpa, khusus minggu ini saja"
        onClose={() => setPickOpen(false)}>
        <SelectField
          value={skill.key}
          options={SKILLS.map((s) => ({
            key: s.key,
            label: `${skillsDone[s.key] ? '✅ ' : ''}${s.title}`,
            sub: skillAreaMeta(s.area).label,
          }))}
          onChange={(key) => key && pickSkill(key)}
        />
      </SheetModal>
    </View>
  );
}

// Kotak rangkuman 3 poin. Disimpan saat selesai mengetik (onBlur) — bukan tiap
// huruf, biar hemat tulis Firestore.
function NoteBox({
  value,
  onSave,
}: {
  value: string;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(value);
  return (
    <FormInput
      style={styles.noteInput}
      placeholder={'1. …\n2. …\n3. …'}
      value={text}
      onChangeText={setText}
      onBlur={() => {
        if (text.trim() !== value) onSave(text.trim());
      }}
      multiline
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  hero: {
    backgroundColor: Color.LEARNING,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Color.LEARNING_DARK,
    padding: 16,
    gap: 4,
    marginBottom: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroWeek: { color: Color.LEARNING_DARK },
  heroCount: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  heroCountText: { color: Color.LEARNING_DARK },
  heroTitle: { color: Color.LEARNING_DARK },
  heroWhat: { color: Color.LEARNING_DARK },
  heroBar: { marginTop: 6 },
  heroDone: { color: Color.LEARNING_DARK, marginTop: 2 },
  changeButton: {
    alignSelf: 'flex-start',
    backgroundColor: Color.CONTAINER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 6,
  },
  changeText: { color: Color.LEARNING_DARK },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  bookMain: { flex: 1, gap: 2 },
  bookTitle: { color: Color.TEXT_TITLE },
  bookSub: { color: Color.TEXT_LABEL },
  sectionTitle: { marginTop: 4, marginBottom: 8 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  stepRowDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  // Langkah yang harinya sudah tiba tapi belum dikerjakan — ditandai tegas.
  stepRowDue: { borderColor: Color.LEARNING_DARK, borderWidth: 1.5 },
  stepMain: { flex: 1, gap: 2 },
  stepTitleDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  stepHow: { color: Color.TEXT_LABEL },
  stepDue: { color: Color.LEARNING_DARK },
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    marginTop: -2,
    marginBottom: 8,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  topicCardDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  whyCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
    padding: 14,
    gap: 4,
  },
  whyTitle: { color: Color.ACCENT_DARK },
  whyText: { color: Color.ACCENT_DARK },
  error: { color: Color.DANGER, marginTop: 10 },
});
