import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import {
  SKILL_AREAS,
  skillOfNote,
  subscribeLearningNotes,
  type LearningNote,
} from '@/lib/learning';

// Arsip Rangkuman 📔 — semua rangkuman Jumat yang pernah ditulis, terbaru
// dulu.
//
// Dulu ini sebuah modal di dalam sub-tab Skills. Isinya bertambah satu tiap
// minggu dan tak pernah menyusut, sedangkan sheet tidak punya tempat untuk
// nomor halaman — jadi satu-satunya cara membaca tulisan tahun lalu adalah
// menggulung melewati semua yang sesudahnya. Sebagai halaman sendiri ia dapat
// pagination, dan alamatnya bisa dituju dari mana pun.
//
// BACA saja: mengubah rangkuman tetap di minggunya masing-masing (Learning ›
// Target), jadi tidak pernah ada dua pintu edit untuk satu tulisan.
export default function LearningArchiveScreen() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<LearningNote[] | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeLearningNotes(user.uid, setNotes, () => setNotes([]));
  }, [user]);

  const { currentPage, pageCount, pageItems, setPage } = usePagination(
    notes ?? [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Learning"
        title="Arsip Rangkuman 📔"
        subtitle="Semua rangkuman Jumat yang pernah kamu tulis"
      />

      {notes === null ? (
        <LoadingCenter />
      ) : (
        // Ganti halaman → daftarnya mulai lagi dari atas, bukan berhenti di
        // tengah tulisan halaman sebelumnya.
        <ScrollView key={currentPage} contentContainerStyle={styles.content}>
          {notes.length === 0 ? (
            <VixText heading="paragraph" additionalStyle={styles.empty}>
              Belum ada rangkuman. Tulis yang pertama tiap Jumat di Learning ›
              Target 📝
            </VixText>
          ) : (
            <>
              {pageItems.map((n) => {
                const s = skillOfNote(n);
                return (
                  <View key={n.weekId} style={styles.noteCard}>
                    <VixText heading="label" additionalStyle={styles.noteDate}>
                      📅 {formatShortDayDate(dayIdToDate(n.weekId))}
                    </VixText>
                    <VixText heading="bold" additionalStyle={styles.noteTitle}>
                      {SKILL_AREAS.find((a) => a.key === s.area)?.emoji}{' '}
                      {s.title}
                    </VixText>
                    <VixText
                      heading="paragraph"
                      additionalStyle={styles.noteText}>
                      {n.note}
                    </VixText>
                  </View>
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  empty: { color: Color.TEXT_PARAGRAPH, textAlign: 'center', marginTop: 20 },
  noteCard: {
    ...CARD,
    borderLeftWidth: 3,
    borderLeftColor: Color.LEARNING_DARK,
    marginBottom: 8,
    gap: 3,
  },
  noteDate: { color: Color.LEARNING_DARK },
  noteTitle: { color: Color.TEXT_TITLE },
  noteText: { color: Color.TEXT_PARAGRAPH },
});
