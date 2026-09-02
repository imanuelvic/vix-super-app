import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { AttentionMark } from '@/components/common/Badge';
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
import { useDueJump } from '@/hooks/useDueJump';
import { BOOKS } from '@/lib/books';
import {
  bumpLearningStreak,
  canChangeWeekSkill,
  dueStep,
  LEARNING_STEPS,
  learningNoteDone,
  learningStreakAlive,
  NOTE_DRIVEN_STEP,
  setLearningNote,
  setLearningStep,
  setSkillDone,
  setWeekSkill,
  skillAreaMeta,
  overdueSteps,
  skillOf,
  skillOfWeek,
  SKILLS,
  stepsDone,
  weekComplete,
  type LearningStep,
  type LearningWeek,
  type SkillsDone,
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
  streak,
}: {
  week: LearningWeek;
  weekId: string;
  now: Date;
  skillsDone: SkillsDone;
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
  // Semua yang tertagih (bukan cuma yang terdepan) — sumber angka badge-nya.
  const terlambat = overdueSteps(week.steps, now);

  // Buka sub-tab ini → daftarnya langsung datang ke langkah tertagih pertama,
  // yaitu isi badge merahnya. Kartu ringkasan di atasnya tetap bisa digulung
  // balik ke atas seperti biasa.
  const { ref: listRef, setRowY, onContentSizeChange } = useDueJump(
    terlambat[0]?.key ?? null,
  );
  // Ganti topik SENIN saja — lihat alasannya di canChangeWeekSkill.
  const bisaGanti = canChangeWeekSkill(now);
  // Streak yang MASIH hidup: tercatat minggu ini, atau minggu lalu (belum
  // tuntas minggu ini, tapi belum putus juga). Lebih lama dari itu = sudah
  // bolong, jadi angkanya tidak lagi ditampilkan seolah masih berjalan.
  const runningStreak = learningStreakAlive(streak, weekId) ? streak.count : 0;

  /**
   * Setel satu langkah + efek sampingnya. DUA jalan masuk memakainya: click
   * centang biasa, dan langkah Rangkum yang centangnya datang dari tulisannya
   * sendiri — jadi efek sampingnya (tanda skill selesai & streak) mustahil
   * ikut di satu jalan tapi terlewat di jalan lain.
   */
  async function applyStep(step: LearningStep, done: boolean) {
    if (!user || !!week.steps[step] === done) return;
    const next = { ...week.steps, [step]: done };
    await setLearningStep(user.uid, weekId, step, done);
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
  }

  async function toggleStep(step: LearningStep) {
    if (!user) return;
    setError(null);
    try {
      await applyStep(step, !week.steps[step]);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  /**
   * Simpan rangkuman — SEKALIGUS menentukan centang langkah "Rangkum".
   * Terisi cukup panjang → tercentang sendiri; dikosongkan lagi → centangnya
   * ikut lepas. `week.steps` tetap satu-satunya sumber angka, jadi hitungan
   * 4 langkah & streak-nya tidak mungkin berbeda dari yang terlihat.
   */
  async function saveNote(text: string) {
    if (!user) return;
    setError(null);
    try {
      await setLearningNote(user.uid, weekId, text);
      await applyStep(NOTE_DRIVEN_STEP, learningNoteDone(text));
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

  return (
    <View style={styles.flex}>
      <ScrollView
        ref={listRef}
        onContentSizeChange={onContentSizeChange}
        contentContainerStyle={styles.content}>
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
          // Tertagih = harinya sudah tiba & belum dicentang. Inilah yang
          // dihitung badge merah tile Learning & sub-tab Week — `due` cuma
          // yang PALING depan, jadi kalau dua langkah kelewat, menandai `due`
          // saja masih menyisakan satu yang tak terjelaskan.
          const tertagih = terlambat.some((x) => x.key === s.key);
          // Langkah Rangkum: centangnya ditentukan tulisannya, jadi
          // lingkarannya dikunci — mencentang tanpa merangkum itu bohong.
          const dariTulisan = s.key === NOTE_DRIVEN_STEP;
          return (
            <View
              key={s.key}
              onLayout={(e) => setRowY(s.key, e.nativeEvent.layout.y)}>
              <View
                style={[
                  styles.stepRow,
                  checked && styles.stepRowDone,
                  isDue && styles.stepRowDue,
                ]}>
                <PressableScale
                  onPress={() => toggleStep(s.key)}
                  disabled={dariTulisan}
                  hitSlop={8}
                  haptic={checked ? 'light' : 'success'}>
                  <CheckCircle checked={checked} locked={dariTulisan} />
                  {tertagih && <AttentionMark size={8} style={styles.stepMark} />}
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
                  {/* Lingkarannya dikunci, jadi harus ada yang memberi tahu
                      kenapa — tanpa ini click yang tidak terjadi apa-apa cuma
                      terasa rusak. */}
                  {dariTulisan && !checked && (
                    <VixText heading="label" additionalStyle={styles.stepLocked}>
                      🔒 Tercentang sendiri begitu kotak di bawah terisi
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

        {/* Bahan diskusi minggu ini DIPINDAH ke sub-tab 💬 Discussion —
            tempatnya memang di situ (satu daftar topik, satu tempat), dan
            sub-tab ini jadi kembali fokus ke empat langkah mingguannya.
            Badge-nya ikut pindah. */}

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
    flexWrap: 'wrap',
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
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    marginBottom: 12,
  },
  bookMain: { flex: 1, gap: 2 },
  bookTitle: { color: Color.TEXT_TITLE },
  bookSub: { color: Color.TEXT_LABEL },
  sectionTitle: { marginTop: 4, marginBottom: 8 },
  stepMark: { position: 'absolute', top: 3, right: 3 },
  stepRow: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
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
  stepLocked: { color: Color.TEXT_PLACEHOLDER },
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    marginTop: -2,
    marginBottom: 8,
  },
  error: { marginTop: 10 },
});
