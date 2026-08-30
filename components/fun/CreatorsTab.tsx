import { useCallback, useRef, useState } from 'react';
import { Image, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { ChipRow } from '@/components/common/ChipRow';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useNow } from '@/hooks/useNow';
import { openExternalUrl } from '@/lib/linking';
import {
  CREATOR_KINDS,
  fetchCreatorFeed,
  videoAge,
  YOUTUBE_ERROR,
  type CreatorKind,
} from '@/lib/youtube';

// Tab Creators 🎬 — video TERBARU dari kanal hiburan & game yang diikuti
// (MrBeast, Dude Perfect, Markiplier, dst).
//
// Judul + sampul + tautan saja; videonya sendiri dibuka di YouTube, karena
// itulah milik pembuatnya. Tidak ada API key sama sekali — sumbernya feed
// publik tiap kanal (lihat catatan panjangnya di lib/youtube.ts).
export function CreatorsTab() {
  const { now } = useNow();
  const [kind, setKind] = useState<CreatorKind>('all');
  const listRef = useRef<ScrollView>(null);

  const load = useCallback(() => fetchCreatorFeed(), []);
  const {
    data: videos,
    loading: busy,
    error,
    reload,
  } = useAsyncData(load, YOUTUBE_ERROR, false);

  const tampil = (videos ?? []).filter(
    (v) => kind === 'all' || v.kind === kind,
  );

  /** Chip yang SUDAH aktif ditekan lagi = muat ulang & balik ke atas. */
  function pilih(key: CreatorKind) {
    if (key !== kind) {
      setKind(key);
      return;
    }
    reload();
    listRef.current?.scrollTo({ y: 0, animated: true });
  }

  return (
    <View style={styles.flex}>
      <ChipRow fit="wrap" contentStyle={styles.kindRow}>
        {CREATOR_KINDS.map((k) => (
          <Chip
            key={k.key}
            label={k.label}
            active={k.key === kind}
            onPress={() => pilih(k.key)}
          />
        ))}
      </ChipRow>

      {videos === null && busy ? (
        <LoadingCenter />
      ) : error ? (
        <View style={styles.center}>
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
          <PrimaryButton
            label="Coba lagi"
            icon="arrow.triangle.2.circlepath"
            onPress={() => reload()}
          />
        </View>
      ) : (
        <ScrollView
          ref={listRef}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => reload()}
              tintColor={Color.FUN_DARK}
            />
          }>
          {tampil.length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada video yang masuk. Tarik ke bawah untuk muat ulang 🎬
            </VixText>
          )}

          {tampil.map((v) => (
            <PressableScale
              key={v.id}
              style={styles.card}
              onPress={() => openExternalUrl(v.link)}>
              {/* Sampulnya 16:9 — ukuran asli YouTube, jadi tidak pernah
                  terpotong aneh berapa pun lebar layarnya. */}
              <Image
                source={{ uri: v.thumb }}
                style={styles.thumb}
                resizeMode="cover"
              />
              <View style={styles.cardBody}>
                <VixText
                  heading="bold"
                  numberOfLines={2}
                  additionalStyle={styles.title}>
                  {v.title}
                </VixText>
                <View style={styles.metaRow}>
                  <VixText heading="label" additionalStyle={styles.channel}>
                    {v.emoji} {v.channel}
                  </VixText>
                  <VixText heading="label">{videoAge(v.publishedAt, now)}</VixText>
                </View>
              </View>
            </PressableScale>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  kindRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  center: { alignItems: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 20 },
  error: { textAlign: 'center', color: Color.DANGER },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    overflow: 'hidden',
    marginBottom: 12,
  },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: Color.BORDER },
  cardBody: { paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  title: { color: Color.TEXT_TITLE },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  channel: { color: Color.FUN_DARK },
});
