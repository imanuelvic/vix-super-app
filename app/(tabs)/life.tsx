// ============================================================================
// LIFE ☰ (tab kelima, 22 Sep 2026) — "semua area kehidupan yang lain".
//
// Inilah tempat fitur-fitur tinggal, bukan berebut perhatian: Finance, Health,
// Habits, Fitness, Family, Learning, Invest, News, Book, Car, Residence, Fun,
// Wheel, Friends, Device, Games, Reward, Profile, System. Yang
// perlu perhatian HARI INI sudah disebut di Today; di sini tinggal gridnya.
//
// Di atas grid ada pencarian — pintu darurat dari penyederhanaan Today:
// "STNK" → Car › Info, "budget" → Finance › Budgeting, "CL" → CORE › Leaders.
// Indeksnya statis (lib/featureIndex.ts), nol bacaan Firestore.
// ============================================================================
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD, CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CONTENT_COLUMN } from '@/assets/style/layout';
import { EmptyText } from '@/components/common/EmptyText';
import { PressableScale } from '@/components/common/PressableScale';
import { SearchBar } from '@/components/common/SearchBar';
import { VixText } from '@/components/common/VixText';
import { todayHref } from '@/components/today/todayLink';
import { IconGlyph } from '@/components/ui/icon-glyph';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useScrollTop } from '@/hooks/useScrollTop';
import { searchFeatures } from '@/lib/featureIndex';
import { LIFE_FEATURES } from '@/lib/featureGrid';
import { logFeatureUse } from '@/lib/usage';

export default function LifeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { ref: scrollRef } = useScrollTop();
  const [query, setQuery] = useState('');
  const hasil = searchFeatures(query);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <VixText heading="header" additionalStyle={styles.title}>
            Life 🌿
          </VixText>
          <PressableScale onPress={logout} hitSlop={10}>
            <IconSymbol name="rectangle.portrait.and.arrow.right" size={22} color={Color.MAIN} />
          </PressableScale>
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Cari fitur…" />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <View style={styles.contentInner}>
          {query.trim() ? (
            hasil.length === 0 ? (
              <EmptyText>Tidak ketemu. Coba kata lain, mis. token atau visitasi.</EmptyText>
            ) : (
              <View style={styles.results}>
                {hasil.map((f) => (
                  <PressableScale
                    key={`${f.label}-${f.path}`}
                    style={styles.result}
                    onPress={() => {
                      Keyboard.dismiss();
                      router.push(todayHref(f.href));
                    }}>
                    <VixText additionalStyle={styles.resultEmoji}>{f.emoji}</VixText>
                    <View style={styles.resultMain}>
                      <VixText heading="bold">{f.label}</VixText>
                      <VixText heading="label">{f.path}</VixText>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={Color.TEXT_PLACEHOLDER} />
                  </PressableScale>
                ))}
              </View>
            )
          ) : (
            <View style={styles.grid}>
              {LIFE_FEATURES.map((feature, index) => (
                <Animated.View
                  key={feature.key}
                  entering={FadeInDown.delay(index * 30).duration(280)}
                  style={styles.gridItem}>
                  <PressableScale
                    style={[styles.tile, { backgroundColor: feature.bg }]}
                    onPress={() => {
                      // Catat pemakaian fitur (throttled) untuk laporan System.
                      if (user) logFeatureUse(user.uid, feature.key, feature.label);
                      router.push(feature.route);
                    }}>
                    {feature.glyph ? (
                      <IconGlyph name={feature.glyph} size={30} color={feature.fg} />
                    ) : feature.icon ? (
                      <IconSymbol name={feature.icon} size={30} color={feature.fg} />
                    ) : null}
                  </PressableScale>
                  <View style={[styles.tileLabelPill, { backgroundColor: feature.bg }]}>
                    <VixText
                      heading="label"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      additionalStyle={[styles.tileLabel, { color: feature.fg }]}>
                      {feature.label}
                    </VixText>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  header: {
    ...CONTENT_COLUMN,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: CARD_GAP,
    gap: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: Color.MAIN_DARK },
  content: { paddingBottom: 32, alignItems: 'center' },
  contentInner: { ...CONTENT_COLUMN, paddingHorizontal: 20 },
  results: { gap: 8 },
  result: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultEmoji: { fontSize: 20, lineHeight: 26, width: 28, textAlign: 'center' },
  resultMain: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 16,
    rowGap: 14,
  },
  gridItem: { width: '21.5%', alignItems: 'center' },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabelPill: {
    marginTop: -12,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
  },
  tileLabel: { textAlign: 'center' },
});
