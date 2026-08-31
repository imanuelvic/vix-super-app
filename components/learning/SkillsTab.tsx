import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { BOOKS } from '@/lib/books';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import {
  canChangeWeekSkill,
  setSkillDone,
  setWeekSkill,
  SKILL_AREAS,
  SKILLS,
  skillOf,
  skillOfNote,
  skillOfWeek,
  subscribeLearningNotes,
  type LearningNote,
  type LearningWeek,
  type Skill,
  type SkillsDone,
} from '@/lib/learning';
import { SAVE_ERROR } from '@/lib/messages';

// Sub-tab 🧠 Skills — 22 topik dari daftarmu, dikelompokkan per bidang.
// Sebuah topik otomatis tercentang kalau 4 langkah mingguannya beres; dari sini
// bisa juga ditandai manual atau dijadikan topik minggu ini.
export function SkillsTab({
  week,
  weekId,
  now,
  skillsDone,
}: {
  week: LearningWeek;
  weekId: string;
  now: Date;
  skillsDone: SkillsDone;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const [open, setOpen] = useState<Skill | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arsip rangkuman 📔 — dilangganani HANYA saat modalnya dibuka. Isinya
  // seluruh koleksi minggu, jadi tidak pantas dibaca tiap kali sub-tab ini
  // dibuka padahal jarang dilihat.
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [notes, setNotes] = useState<LearningNote[] | null>(null);

  useEffect(() => {
    if (!user || !archiveOpen) return;
    return subscribeLearningNotes(user.uid, setNotes, () => setNotes([]));
  }, [user, archiveOpen]);

  const current = (week.skillKey ? skillOf(week.skillKey) : null) ?? skillOfWeek(now);
  const doneCount = SKILLS.filter((s) => skillsDone[s.key]).length;
  // Ganti topik minggu ini SENIN saja — aturan yang sama dengan tombol
  // 🔀 di sub-tab Target. Kalau cuma satu yang dibatasi, aturannya bocor
  // lewat pintu satunya.
  const bisaGanti = canChangeWeekSkill(now);

  async function makeCurrent(skill: Skill) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setWeekSkill(user.uid, weekId, skill.key);
      setOpen(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(skill: Skill) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setSkillDone(user.uid, skill.key, skillsDone[skill.key] ? null : weekId);
      setOpen(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const openBook = open?.bookKey
    ? BOOKS.find((b) => b.key === open.bookKey)
    : null;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Kartu ringkasan + pintu ke arsip rangkuman. Tombolnya ditaruh DI
            DALAM kartunya (bukan baris sendiri) supaya tidak menambah tinggi
            layar — ruang kanan kartu ini memang menganggur. */}
        <SummaryCard>
          <View style={styles.summaryRow}>
            <View style={styles.summaryMain}>
              <VixText heading="label" additionalStyle={summaryText.label}>
                Sudah dipelajari
              </VixText>
              <VixText heading="subheader" additionalStyle={summaryText.value}>
                {doneCount}/{SKILLS.length} topik 🎓
              </VixText>
            </View>
            <PressableScale
              style={styles.archiveButton}
              onPress={() => setArchiveOpen(true)}>
              <VixText heading="bold" additionalStyle={styles.archiveText}>
                📔 Arsip
              </VixText>
            </PressableScale>
          </View>
        </SummaryCard>
        <View style={styles.barWrap}>
          <ProgressBar value={doneCount} total={SKILLS.length} color={Color.LEARNING_DARK} />
        </View>

        {SKILL_AREAS.map((area) => {
          const list = SKILLS.filter((s) => s.area === area.key);
          const areaDone = list.filter((s) => skillsDone[s.key]).length;
          return (
            <View key={area.key}>
              <View style={styles.areaHeader}>
                <VixText heading="title">
                  {area.emoji} {area.label}
                </VixText>
                <VixText heading="label" additionalStyle={styles.areaCount}>
                  {areaDone}/{list.length}
                </VixText>
              </View>

              {list.map((s) => {
                const done = !!skillsDone[s.key];
                const isCurrent = s.key === current.key;
                return (
                  <PressableScale
                    key={s.key}
                    style={[
                      styles.row,
                      done && styles.rowDone,
                      isCurrent && styles.rowCurrent,
                    ]}
                    onPress={() => setOpen(s)}>
                    <View style={styles.rowMain}>
                      <VixText
                        heading="bold"
                        additionalStyle={done ? styles.rowTitleDone : undefined}>
                        {done ? '✅ ' : ''}
                        {isCurrent ? '🎯 ' : ''}
                        {s.title}
                      </VixText>
                      <VixText heading="label" additionalStyle={styles.rowWhat}>
                        {s.what}
                      </VixText>
                      {s.book ? (
                        <VixText heading="label" additionalStyle={styles.rowBook}>
                          📚 {s.book}
                          {s.bookKey ? ' · ada di fitur Book' : ''}
                        </VixText>
                      ) : null}
                    </View>
                    <IconSymbol
                      name="chevron.right"
                      size={18}
                      color={Color.TEXT_LABEL}
                    />
                  </PressableScale>
                );
              })}
            </View>
          );
        })}

        <FormError message={error} gap="none" additionalStyle={styles.error} />
      </ScrollView>

      {/* Arsip rangkuman 📔 — semua yang pernah ditulis hari Jumat di sub-tab
          Target, terbaru dulu. BACA saja: mengubahnya tetap di minggunya
          masing-masing, jadi tidak ada dua pintu edit untuk satu tulisan. */}
      <SheetModal
        visible={archiveOpen}
        title="📔 Arsip Rangkuman"
        subtitle="Semua rangkuman Jumat yang pernah kamu tulis"
        onClose={() => setArchiveOpen(false)}>
        {notes === null ? (
          <LoadingCenter />
        ) : notes.length === 0 ? (
          <VixText heading="paragraph" additionalStyle={styles.archiveEmpty}>
            Belum ada rangkuman.
          </VixText>
        ) : (
          notes.map((n) => {
            const s = skillOfNote(n);
            return (
              <View key={n.weekId} style={styles.noteCard}>
                <VixText heading="label" additionalStyle={styles.noteDate}>
                  📅 {formatShortDayDate(dayIdToDate(n.weekId))}
                </VixText>
                <VixText heading="bold" additionalStyle={styles.noteTitle}>
                  {SKILL_AREAS.find((a) => a.key === s.area)?.emoji} {s.title}
                </VixText>
                <VixText heading="paragraph" additionalStyle={styles.noteText}>
                  {n.note}
                </VixText>
              </View>
            );
          })
        )}
      </SheetModal>

      {/* Detail satu topik */}
      <SheetModal
        visible={!!open}
        title={open?.title ?? ''}
        subtitle={open ? SKILL_AREAS.find((a) => a.key === open.area)?.label : undefined}
        onClose={() => setOpen(null)}>
        {open && (
          <>
            <VixText heading="paragraph" additionalStyle={styles.detailWhat}>
              {open.what}
            </VixText>
            {open.extra ? (
              <VixText heading="label" additionalStyle={styles.detailExtra}>
                ➕ {open.extra}
              </VixText>
            ) : null}

            {open.book ? (
              openBook ? (
                <PressableScale
                  style={styles.detailBook}
                  onPress={() => {
                    setOpen(null);
                    router.push({
                      pathname: '/book/[key]',
                      params: { key: openBook.key },
                    });
                  }}>
                  <View style={styles.rowMain}>
                    <VixText heading="bold" additionalStyle={styles.bookTitle}>
                      📚 {openBook.title}
                    </VixText>
                    <VixText heading="label" additionalStyle={styles.rowWhat}>
                      {openBook.author} · {openBook.chapters.length} bab — buka di
                      fitur Book
                    </VixText>
                  </View>
                  <IconSymbol
                    name="chevron.right"
                    size={18}
                    color={Color.MAIN_DARK}
                  />
                </PressableScale>
              ) : (
                <View style={styles.detailBook}>
                  <View style={styles.rowMain}>
                    <VixText heading="bold" additionalStyle={styles.bookTitle}>
                      📚 {open.book}
                    </VixText>
                    <VixText heading="label" additionalStyle={styles.rowWhat}>
                      Belum ada di fitur Book
                    </VixText>
                  </View>
                </View>
              )
            ) : null}

            {skillsDone[open.key] ? (
              <VixText heading="label" additionalStyle={styles.detailDone}>
                ✅ Tuntas minggu{' '}
                {formatShortDayDate(dayIdToDate(skillsDone[open.key]))}
              </VixText>
            ) : null}

            {bisaGanti && open.key !== current.key && (
              <PrimaryButton
                label="🎯 Jadikan Topik Minggu Ini"
                onPress={() => makeCurrent(open)}
                busy={busy}
                background={Color.LEARNING_DARK}
                additionalStyle={styles.detailButton}
              />
            )}
          </>
        )}

        {/* Sengaja anak LANGSUNG SheetModal (bukan di dalam fragment di atas):
            hanya begitu bar Batal/Simpan otomatis dipin di footer modal. */}
        {open && (
          <DualButtons
            confirmLabel={
              skillsDone[open.key] ? 'Batalkan Tuntas' : 'Tandai Sudah Paham'
            }
            danger={!!skillsDone[open.key]}
            busy={busy}
            onCancel={() => setOpen(null)}
            onConfirm={() => toggleDone(open)}
          />
        )}
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  barWrap: { marginTop: -4, marginBottom: 8 },
  areaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  areaCount: { color: Color.TEXT_LABEL },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  // Topik yang sedang dikerjakan minggu ini — dibingkai warna Learning.
  rowCurrent: { borderColor: Color.LEARNING_DARK, borderWidth: 1.5 },
  rowMain: { flex: 1, gap: 2 },
  rowTitleDone: { color: Color.TEXT_LABEL },
  rowWhat: { color: Color.TEXT_LABEL },
  rowBook: { color: Color.MAIN_DARK },
  detailWhat: { color: Color.TEXT_PARAGRAPH, marginBottom: 4 },
  detailExtra: { color: Color.TEXT_LABEL, marginBottom: 4 },
  detailBook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  bookTitle: { color: Color.TEXT_TITLE },
  detailDone: { color: Color.MAIN_DARK, marginTop: 10 },
  detailButton: { marginTop: 14 },
  error: { marginTop: 10 },
  // ---- Kartu ringkasan + tombol arsip ----
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryMain: { flex: 1, gap: 4 },
  // Di atas kartu hijau tua: garis tepi terang, bukan blok warna — supaya
  // terbaca sebagai tombol tanpa menyaingi angka besarnya.
  archiveButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Color.MAIN_LIGHT,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  archiveText: { color: Color.MAIN_LIGHT },
  // ---- Isi modal arsip ----
  archiveEmpty: { color: Color.TEXT_PARAGRAPH },
  noteCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.LEARNING_DARK,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 3,
  },
  noteDate: { color: Color.LEARNING_DARK },
  noteTitle: { color: Color.TEXT_TITLE },
  noteText: { color: Color.TEXT_PARAGRAPH },
});
