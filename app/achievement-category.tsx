import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BadgeTile, badgeGrid } from '@/components/common/BadgeTile';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { useAchievementStats } from '@/hooks/useAchievementStats';
import {
  achievementCategoryOf,
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  categoryNow,
} from '@/lib/achievements';

// Rincian SATU kategori pencapaian — grid lencana ala papan Awards Duolingo.
//
// Halaman, bukan modal, dan itu bukan sekadar selera bentuk: isinya bertingkat
// sampai sepuluh lencana plus satu kartu rincian, dan modal harus memilih
// antara tinggi yang dipatok (isinya digulung DI DALAM kotak yang juga
// menggulung — dua gulungan bersarang) atau menutupi hampir seluruh layar
// sampai tak ada bedanya lagi dengan halaman. Sebagai halaman ia juga punya
// alamatnya sendiri, jadi pil 🔥 di Habits & Spiritual bisa menuju LANGSUNG ke
// kategorinya, bukan ke daftar lalu membuka modal.
export default function AchievementCategoryScreen() {
  const { cat } = useLocalSearchParams<{ cat?: string }>();
  const { stats, error } = useAchievementStats();

  // Lencana yang sedang di-klik (null = belum ada yang dipilih).
  const [pickedId, setPickedId] = useState<string | null>(null);

  // Nama kategorinya datang dari URL, jadi ia disaring — bukan dipercaya.
  const key = achievementCategoryOf(cat);
  const meta = ACHIEVEMENT_CATEGORIES.find((c) => c.key === key);
  const daftar = key ? ACHIEVEMENTS.filter((a) => a.category === key) : [];
  const sekarang = key ? categoryNow(key, stats) : null;
  const picked = daftar.find((a) => a.id === pickedId) ?? null;

  if (!meta) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader backLabel="Achievement" title="Achievement 🏆" />
        <VixText heading="label" additionalStyle={styles.empty}>
          Kategori pencapaian ini sudah tidak ada.
        </VixText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Achievement"
        title={`${meta.icon} ${meta.label}`}
        subtitle={meta.desc}
        // Angka SEKARANG kategori ini, di pojok kanan atas. Tanpa ini, "sudah
        // sampai berapa?" cuma bisa ditebak dari lencana mana yang setengah
        // terisi — padahal itu justru pertanyaan pertama yang dibawa ke sini.
        right={
          sekarang ? (
            <View style={styles.nowPill}>
              <VixText heading="subheader" additionalStyle={styles.nowValue}>
                {sekarang.text.split(' ')[0]}
              </VixText>
              <VixText heading="label" additionalStyle={styles.nowUnit}>
                {sekarang.text.split(' ').slice(1).join(' ')}
              </VixText>
            </View>
          ) : undefined
        }
      />

      <ScreenError message={error} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Grid lencana — tiga kolom. Bentuk daftar memanjang yang dulu dipakai
            memaksa menggulung jauh untuk melihat "sudah dapat berapa dari
            berapa"; sebagai grid, seluruh tangganya terbaca sekali pandang.

            Rinciannya (keterangan + tanggal + batang kemajuan) tidak hilang: ia
            pindah ke kartu di bawah grid, muncul saat lencananya di-klik. */}
        <View style={badgeGrid.grid}>
          {daftar.map((a) => {
            const value = a.of(stats);
            const done = value >= a.target;
            const dipilih = pickedId === a.id;
            return (
              <BadgeTile
                key={a.id}
                icon={a.icon}
                tag={String(a.fmt ? a.fmt(a.target) : a.target)}
                title={a.title}
                unlocked={done}
                onPress={() => setPickedId(dipilih ? null : a.id)}>
                <VixText
                  heading="label"
                  additionalStyle={done ? styles.doneText : styles.lockText}>
                  {done
                    ? '✅ terbuka'
                    : a.fmt
                      ? `${a.fmt(Math.min(value, a.target))}/${a.fmt(a.target)}`
                      : `${Math.min(value, a.target)}/${a.target}`}
                </VixText>
              </BadgeTile>
            );
          })}
        </View>

        {/* Rincian lencana yang sedang di-klik. Satu kartu, bukan satu per
            lencana: yang dicari saat mengklik memang cuma satu. */}
        {picked ? (
          <View style={styles.pickedCard}>
            <View style={styles.catTop}>
              <VixText heading="bold" additionalStyle={styles.rowTitle}>
                {picked.icon} {picked.title}
              </VixText>
              <VixText
                heading="bold"
                additionalStyle={
                  picked.of(stats) >= picked.target
                    ? styles.doneText
                    : styles.lockText
                }>
                {picked.fmt
                  ? `${picked.fmt(Math.min(picked.of(stats), picked.target))}/${picked.fmt(picked.target)}`
                  : `${Math.min(picked.of(stats), picked.target)}/${picked.target}`}
              </VixText>
            </View>
            <VixText heading="label">{picked.desc}</VixText>
            {picked.detail?.(stats) ? (
              <VixText heading="label" additionalStyle={styles.detailText}>
                {picked.detail(stats)}
              </VixText>
            ) : null}
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min((picked.of(stats) / picked.target) * 100, 100)}%`,
                  },
                  picked.of(stats) >= picked.target && styles.barFillDone,
                ]}
              />
            </View>
          </View>
        ) : (
          <VixText heading="label" additionalStyle={styles.gridHint}>
            Klik lencananya untuk lihat keterangan & kemajuannya.
          </VixText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  empty: { textAlign: 'center', marginVertical: 10 },

  // Angka sekarang di pojok kanan atas — dua baris, angkanya yang besar.
  nowPill: { alignItems: 'flex-end' },
  nowValue: { color: Color.MAIN_DARK },
  nowUnit: { color: Color.TEXT_LABEL },

  gridHint: { textAlign: 'center', marginTop: 16, color: Color.TEXT_PLACEHOLDER },

  // ===== Kartu rincian lencana terpilih =====
  pickedCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 12,
    marginTop: 16,
    gap: 4,
  },
  catTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: { color: Color.TEXT_TITLE },
  detailText: { color: Color.MAIN_DARK },
  doneText: { color: Color.SUCCESS },
  lockText: { color: Color.TEXT_PLACEHOLDER },
  barTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: Color.MAIN_LIGHT },
  barFillDone: { backgroundColor: Color.MAIN },
});
