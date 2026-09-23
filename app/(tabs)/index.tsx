// ============================================================================
// TODAY (rute "/", tab pertama) — 22 Sep 2026, versi 2.0.
//
// "The app should tell Vix what matters today, not show Vix everything he has."
//
// Dulu layar ini launcher 20 tile + kartu; sekarang satu pertanyaan: apa yang
// penting HARI INI? Urutannya urutan perhatian, bukan urutan fitur:
//   🌅 With God  →  💡 3 hal terpenting (pilihanmu)  →  👥 CORE  →  💼 Work
//   →  🌿 Life  →  📝 Refleksi  →  ▸ Up next  →  ▸ Later (→ Semua Pengingat)
//
// Isinya dihitung Today Engine (lib/today.ts) dari langganan yang SAMA dengan
// Home & Dashboard lama (hooks/useTodayData.ts): tidak ada bacaan Firestore
// tambahan, dan yang tidak butuh perhatian hari ini tidak ikut tampil.
// Seluruh fitur tetap ada — di tab Walk · CORE · Work · Life, dan lewat
// pencarian di Life.
//
// CATATAN: nama file WAJIB "index.tsx" — di expo-router "index" = layar
// bawaan grup (tabs), jadi inilah rute "/".
// ============================================================================
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CONTENT_COLUMN } from '@/assets/style/layout';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { FoldedList } from '@/components/today/FoldedList';
import { GodHero } from '@/components/today/GodHero';
import { PrioritiesBlock } from '@/components/today/PrioritiesBlock';
import { ReflectionBlock } from '@/components/today/ReflectionBlock';
import { TodaySection } from '@/components/today/TodaySection';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useScrollTop } from '@/hooks/useScrollTop';
import { useTodayData } from '@/hooks/useTodayData';
import { OWNER_NAME } from '@/lib/family';
import { formatShortDayDate } from '@/lib/format';

/** Nama panggilan untuk sapaan — kata pertama nama pemilik. */
const NICK = OWNER_NAME.split(' ')[0] ?? OWNER_NAME;

export default function TodayScreen() {
  const router = useRouter();
  const { ref: scrollRef } = useScrollTop();
  const { now, todayId, model, ready, login, priorities, intercession, intercessionDismiss } =
    useTodayData();
  // Kalimat penyegar yang barusan di-click "sudah dibaca" → sembunyikan
  // sampai giliran berikutnya (kalimatnya beda, cukup bandingkan teksnya).
  const [nudgeSeen, setNudgeSeen] = useState<string | null>(null);

  // Selagi status Morning Journey belum termuat → loading singkat, supaya
  // undangan besarnya tidak berkedip dari satu keadaan ke keadaan lain.
  if (login === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadingCenter size="large" />
      </SafeAreaView>
    );
  }

  const core = model.today.filter((i) => i.section === 'core');
  const work = model.today.filter((i) => i.section === 'work');
  const life = model.today.filter((i) => i.section === 'life');
  const god = {
    ...model.god,
    nudge: model.god.nudge && model.god.nudge.text !== nudgeSeen ? model.god.nudge : null,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topRow}>
        <VixText heading="label" additionalStyle={styles.date}>
          {formatShortDayDate(now)}
        </VixText>
        <PressableScale
          style={styles.avatar}
          onPress={() => router.push('/profile')}
          hitSlop={8}>
          <IconSymbol name="person.crop.circle.fill" size={30} color={Color.MAIN_DARK} />
        </PressableScale>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View style={styles.contentInner}>
          <Animated.View entering={FadeInDown.duration(350)}>
            <GodHero
              god={god}
              name={NICK}
              intercession={intercession}
              onDismissIntercession={intercessionDismiss.dismiss}
              onNudgeSeen={() => setNudgeSeen(model.god.nudge?.text ?? null)}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(40).duration(350)}>
            <PrioritiesBlock day={priorities} todayId={todayId} />
          </Animated.View>

          {/* Bagian-bagian baru digambar sesudah semua sumbernya tiba, supaya
              muncul serentak sebagai satu susunan — bukan menetes. */}
          {ready ? (
            <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.sections}>
              <TodaySection
                eyebrow="CORE hari ini"
                accent={Color.CORE_DARK}
                items={core}
                quiet="CORE tenang hari ini"
                openLabel="Buka CORE"
                openHref="/core"
              />
              <TodaySection
                eyebrow="Work hari ini"
                accent={Color.CAREER_DARK}
                items={work}
                quiet="Tidak ada tenggat kerja hari ini"
                openLabel="Buka Work"
                openHref="/work"
              />
              <TodaySection
                eyebrow="Life hari ini"
                accent={Color.MAIN}
                items={life}
                quiet="Hidupmu tenang hari ini"
                openLabel="Buka Life"
                openHref="/life"
              />
              <ReflectionBlock reflection={model.reflection} />
              <View style={styles.folds}>
                <FoldedList label="Up next" items={model.upNext} />
                <FoldedList
                  label="Later"
                  items={model.later}
                  footer={
                    <PressableScale
                      style={styles.allLink}
                      onPress={() => router.push('/reminders')}
                      hitSlop={6}>
                      <VixText heading="label" additionalStyle={styles.allLinkText}>
                        Semua pengingat lengkap →
                      </VixText>
                    </PressableScale>
                  }
                />
              </View>
            </Animated.View>
          ) : (
            <View style={styles.loadingRows}>
              <LoadingCenter />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  topRow: {
    ...CONTENT_COLUMN,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  date: { color: Color.TEXT_LABEL },
  avatar: { padding: 2 },
  content: { paddingBottom: 32, alignItems: 'center' },
  contentInner: { ...CONTENT_COLUMN, paddingHorizontal: 20, gap: CARD_GAP + 2 },
  sections: { gap: CARD_GAP + 2 },
  folds: { marginTop: 4 },
  loadingRows: { paddingVertical: 24 },
  allLink: { paddingVertical: 8, paddingLeft: 6 },
  allLinkText: { color: Color.MAIN, textDecorationLine: 'underline' },
});
