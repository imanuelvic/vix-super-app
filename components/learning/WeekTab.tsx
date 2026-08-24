import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { FormError } from '@/components/common/FormError';
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
  bumpLearningStreak,
  canChangeWeekSkill,
  dueStep,
  LEARNING_STEPS,
  learningStreakAlive,
  setLearningNote,
  setLearningStep,
  setSkillDone,
  setTopicDone,
  setWeekSkill,
  skillAreaMeta,
  skillOf,
  skillOfWeek,
  SKILLS,
  stepsDone,
  topicGroupMeta,
  topicsOfWeek,
  weekComplete,
  type LearningStep,
  type LearningWeek,
  type SkillsDone,
  type TopicsDone,
  type WeekStreak,
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
  streak,
}: {
  week: LearningWeek;
  weekId: string;
  now: Date;
  skillsDone: SkillsDone;
  topicsDone: TopicsDone;
  /** Streak minggu tuntas berturut-turut (lastDayId = weekId). */
  streak: WeekStreak;
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
  const topics = topicsOfWeek(now);
  // Ganti topik SENIN saja — lihat alasannya di canChangeWeekSkill.
  const bisaGanti = canChangeWeekSkill(now);
  // Streak yang MASIH hidup: tercatat minggu ini, atau minggu lalu (belum
  // tuntas minggu ini, tapi belum putus juga). Lebih lama dari itu = sudah
  // bolong, jadi angkanya tidak lagi ditampilkan seolah masih berjalan.
  const runningStreak = learningStreakAlive(streak, weekId) ? streak.count : 0;

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
      // Streak mingguan 🔥 naik saat minggu ini TUNTAS — dasar achievement
      // Learning. Sengaja tidak diturunkan lagi kalau centangnya dilepas:
      // minggu itu memang pernah kamu tuntaskan. Naiknya juga maksimal sekali
      // per minggu (dijaga `bumpLearningStreak`).
      if (nowComplete) {
        await bumpLearningStreak(user.uid, streak, weekId);
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

  async function toggleTopic(key: string, checked: boolean) {
    if (!user) return;
    try {
      await setTopicDone(user.uid, key, !checked);
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
            <View style={styles.heroRight}>
              {/* Streak minggu tuntas berturut-turut — angka yang sama
                  dipakai achievement 🎓 Learning. Disembunyikan saat masih 0
                  supaya tidak jadi pengingat kegagalan. */}
              {runningStreak > 0 && (
                <VixText heading="bold" additionalStyle={styles.heroStreak}>
                  🔥 {runningStreak} minggu
                </VixText>
              )}
              <View style={styles.heroCount}>
                <VixText heading="bold" additionalStyle={styles.heroCountText}>
                  {doneCount}/{LEARNING_STEPS.length}
                </VixText>
              </View>
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

          {bisaGanti && (
            <PressableScale
              style={styles.changeButton}
              onPress={() => setPickOpen(true)}>
              <VixText heading="label" additionalStyle={styles.changeText}>
                🔀 Ganti topik minggu ini
              </VixText>
            </PressableScale>
          )}
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
                  {book.author} · {book.chapters.length} bab
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
          Target Minggu Ini
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
                  {/* Jendela jam mengerjakannya (Senin/Rabu/Jumat). Langkah
                      "Ceritakan" tidak punya jam — ia ikut kapan kamu ketemu
                      orangnya, jadi barisnya memang tidak muncul di situ. */}
                  {s.time ? (
                    <VixText heading="label" additionalStyle={styles.stepTime}>
                      {s.time}
                    </VixText>
                  ) : null}
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

        {/* ===== Bahan diskusi minggu ini ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Diskusi Dalam Minggu Ini
        </VixText>

        {/* Bahan utama = ilmu minggu ini. Sengaja TANPA checkbox: "sudah
            diceritakan atau belum" sudah dicatat langkah Minggu (Ceritakan)
            di atas — dua kotak untuk satu hal yang sama cuma bikin bingung. */}
        <View style={styles.mainTopicCard}>
          <VixText heading="bold" additionalStyle={styles.mainTopicTitle}>
            {area.emoji} {skill.title}
          </VixText>
          <VixText heading="label" additionalStyle={styles.mainTopicHint}>
            Ilmu minggu ini — ceritakan pakai bahasamu sendiri, jangan baca
            catatan.
          </VixText>
        </View>

        {/* Tiga topik diskusi giliran minggu ini — pemantik kalau diskusinya
            masih mau lanjut. Dicentang setelah benar-benar diobrolkan.
            Keterangan kelompoknya sengaja TIDAK ditulis di tiap baris: ketiga
            topik biasanya sekelompok, jadi kalimatnya cuma terulang tiga kali
            dan menutupi judul topiknya sendiri. Keterangan itu tetap ada di
            sub-tab Discussion, satu kali di atas daftarnya. */}
        {topics.map((t) => {
          const meta = topicGroupMeta(t.group);
          const checked = !!topicsDone[t.key];
          return (
            <PressableScale
              key={t.key}
              style={[styles.topicCard, checked && styles.topicCardDone]}
              onPress={() => toggleTopic(t.key, checked)}
              haptic={checked ? 'light' : 'success'}>
              <CheckCircle checked={checked} />
              <View style={styles.stepMain}>
                <VixText heading="bold">
                  {meta.emoji} {t.label}
                </VixText>
              </View>
            </PressableScale>
          );
        })}

        <FormError message={error} gap="none" additionalStyle={styles.error} />
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
  // Streak 🔥 + hitungan langkah, berdampingan di ujung kanan hero.
  heroRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroStreak: { color: Color.LEARNING_DARK },
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
  // Jendela jam belajar — sewarna Learning biar kebaca sebagai aturan jadwal,
  // bukan sekadar keterangan tambahan.
  stepTime: { color: Color.LEARNING_DARK },
  stepDue: { color: Color.LEARNING_DARK },
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    marginTop: -2,
    marginBottom: 8,
  },
  // Bahan diskusi utama — warna Learning supaya beda dari topik pemantik di
  // bawahnya, dan langsung kebaca "ini ilmu yang lagi kupelajari".
  mainTopicCard: {
    backgroundColor: Color.LEARNING,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.LEARNING_DARK,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 2,
  },
  mainTopicTitle: { color: Color.LEARNING_DARK },
  mainTopicHint: { color: Color.LEARNING_DARK },
  topicCard: {
    flexDirection: 'row',
    // Isinya tinggal SATU baris (keterangan kelompoknya dibuang), jadi
    // lingkaran centangnya disejajarkan ke tengah — 'flex-start' bikin
    // lingkaran 26 px itu terlihat menggantung di atas judulnya.
    alignItems: 'center',
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
  error: { marginTop: 10 },
});
