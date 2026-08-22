import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { KeyboardAwareScrollView } from '@/components/common/KeyboardAwareScrollView';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import { formatGreetingDate } from '@/lib/format';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  EMPTY_PRIORITY,
  PRIORITY_COUNT,
  priorityDone,
  priorityFilled,
  savePriorityDay,
  subscribePriorityDay,
  type PriorityItem,
} from '@/lib/priority';

// Daily Priority 💡 — tiga hal terpenting hari ini.
//
// Diisi pagi, dicoret sepanjang hari, dan KOSONG LAGI lewat tengah malam
// karena catatannya memang milik hari itu (satu dokumen per tanggal). Tidak
// ada tombol reset & tidak ada tugas latar: `todayId` dari useNow berganti
// sendiri saat hari berganti, dan dokumen hari baru memang belum ada isinya.
export default function DailyPriorityScreen() {
  const { user } = useAuth();
  const { now, todayId } = useNow();

  // null = belum termuat (biar kolomnya tidak berkedip dari kosong ke terisi).
  const [items, setItems] = useState<PriorityItem[] | null>(null);
  // Tulisan yang sedang diketik. Dipisah dari `items` supaya kursornya tidak
  // melompat tiap snapshot Firestore datang balik di tengah mengetik.
  const [drafts, setDrafts] = useState<string[]>(() =>
    EMPTY_PRIORITY.map((i) => i.text),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribePriorityDay(user.uid, todayId, setItems, () =>
      setError(LOAD_ERROR),
    );
  }, [user, todayId]);

  // Isi draft SEKALI per hari: saat datanya pertama datang, dan lagi kalau
  // harinya berganti. Kalau disamakan tiap snapshot, tulisan yang sedang
  // diketik akan ditimpa balik oleh gemanya sendiri.
  const loadedDay = useRef<string | null>(null);
  useEffect(() => {
    if (!items || loadedDay.current === todayId) return;
    loadedDay.current = todayId;
    setDrafts(items.map((i) => i.text));
  }, [items, todayId]);

  const stored = items ?? EMPTY_PRIORITY;
  // Keadaan yang SEDANG terlihat = centang dari Firestore + tulisan terbaru.
  const list: PriorityItem[] = stored.map((it, i) => ({
    text: drafts[i] ?? it.text,
    done: it.done,
  }));
  const filled = priorityFilled(list);
  const doneCount = priorityDone(list);
  const allDone = filled > 0 && doneCount === filled;

  /** Timpa dokumen hari ini — satu tulis untuk ketiga barisnya. */
  function save(next: PriorityItem[]) {
    if (!user) return;
    setError(null);
    savePriorityDay(user.uid, todayId, next).catch(() => setError(SAVE_ERROR));
  }

  // Disimpan saat selesai mengetik (onBlur), bukan tiap huruf — hemat tulis
  // Firestore & tidak tersendat waktu sinyal jelek.
  function commit() {
    save(list);
  }

  // …dan sekali lagi saat layarnya ditutup, kalau-kalau tombol Back ditekan
  // sebelum kolomnya sempat kehilangan fokus. `latest` selalu berisi keadaan
  // terakhir; efek pembersihnya sengaja hanya jalan saat unmount.
  const latest = useRef<{ list: PriorityItem[]; stored: PriorityItem[] }>({
    list,
    stored,
  });
  latest.current = { list, stored };
  useEffect(() => {
    return () => {
      const { list: end, stored: saved } = latest.current;
      const berubah = end.some((it, i) => it.text !== saved[i].text);
      if (berubah && user) {
        savePriorityDay(user.uid, todayId, end).catch(() => undefined);
      }
    };
  }, [user, todayId]);

  /**
   * Coret / batalkan coret. Baris kosong tidak bisa dicoret — mencentang yang
   * belum ditulis cuma bikin angkanya bagus tanpa isi.
   */
  function toggle(index: number) {
    if (!list[index].text.trim()) return;
    save(
      list.map((it, i) => (i === index ? { ...it, done: !it.done } : it)),
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Daily Priority 💡"
        subtitle="Tiga hal terpenting hari ini"
      />

      {items === null ? (
        <LoadingCenter />
      ) : (
        <KeyboardAwareScrollView contentContainerStyle={styles.content}>
          {/* Ringkasan hari ini + kemajuannya */}
          <Animated.View entering={FadeInDown.duration(280)} style={styles.hero}>
            <VixText heading="label" additionalStyle={styles.heroSub}>
              📅 {formatGreetingDate(now)}
            </VixText>
            <VixText heading="subheader" additionalStyle={styles.heroValue}>
              {doneCount}/{filled || PRIORITY_COUNT}{' '}
              <VixText heading="label" additionalStyle={styles.heroSub}>
                prioritas beres
              </VixText>
            </VixText>
            <ProgressBar
              value={doneCount}
              total={filled || PRIORITY_COUNT}
              color={allDone ? Color.MAIN_LIGHT : Color.ACCENT}
              track={Color.MAIN}
            />
            <VixText heading="label" additionalStyle={styles.heroSub}>
              {filled === 0
                ? 'Isi pagi ini — pilih yang benar-benar penting, bukan yang paling gampang.'
                : allDone
                  ? '🎉 Semuanya beres. Sisa harimu bonus.'
                  : '🌙 Kosong lagi sendiri lewat tengah malam.'}
            </VixText>
          </Animated.View>

          <FormError message={error} />

          {list.map((item, i) => {
            const empty = !item.text.trim();
            return (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(60 + i * 50).duration(280)}
                style={[styles.row, item.done && styles.rowDone]}>
                <PressableScale
                  onPress={() => toggle(i)}
                  disabled={empty}
                  hitSlop={8}
                  haptic={item.done ? 'light' : 'success'}>
                  <CheckCircle checked={item.done} locked={empty} />
                </PressableScale>
                <View style={styles.rowMain}>
                  <VixText heading="label" additionalStyle={styles.rowNumber}>
                    Prioritas {i + 1}
                  </VixText>
                  <FormInput
                    style={[styles.input, item.done && styles.inputDone]}
                    placeholder="Apa yang harus beres hari ini?"
                    value={drafts[i] ?? ''}
                    onChangeText={(text) =>
                      setDrafts((prev) =>
                        prev.map((t, k) => (k === i ? text : t)),
                      )
                    }
                    onBlur={commit}
                    multiline
                  />
                </View>
              </Animated.View>
            );
          })}

          <VixText heading="label" additionalStyle={styles.footNote}>
            💡 Tiga saja — kalau semuanya prioritas, berarti tidak ada yang
            prioritas. Yang tidak muat ke sini tempatnya di Reminder 🔔.
          </VixText>
        </KeyboardAwareScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    marginBottom: 14,
  },
  heroSub: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  // Sudah dicoret — hijau samar, sama seperti baris tercentang di Habits.
  rowDone: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN_LIGHT,
  },
  rowMain: { flex: 1, gap: 2 },
  rowNumber: { color: Color.TEXT_LABEL },
  input: { minHeight: 46, textAlignVertical: 'top' },
  inputDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  footNote: { color: Color.TEXT_LABEL, marginTop: 4 },
});
