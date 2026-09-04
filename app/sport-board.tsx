import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { VixText } from '@/components/common/VixText';
import { useSportData } from '@/hooks/useSportData';
import { dayId as toDayId } from '@/lib/format';
import {
    gangMeta,
    gangOf,
    pastSessions,
    SPORT_GANGS,
    topAttendance,
    topScorers,
    type SportGangKey,
} from '@/lib/sport';

// Papan Prestasi 🏅 — dua papan peringkat Fun Sport, satu geng sekali lihat.
//
// Dulu papan top score menumpang di bawah sub-tab Fun Sport, dan di sanalah ia
// paling jarang terbaca: ia berdiri di antara daftar anggota & riwayat main,
// jadi baru kelihatan sesudah menggulung melewati keduanya. Sekarang pintunya
// tombol 🏅 di pojok header, sejajar dengan pintu pencapaian di layar lain.
//
// Gengnya ikut tab yang sedang kamu buka di sana (?gang=), tapi tetap bisa
// ditukar di sini — dua papan yang cuma bisa dibaca bergantian lewat mundur ke
// layar sebelumnya itu pekerjaan yang tidak perlu ada.
//
// Peringkat KEDUA (paling rajin datang) sengaja di bawah top score: yang dicari
// duluan sesudah main memang siapa yang mencetak gol. Aturan hitungannya —
// kenapa anggota baru tidak dihukum karena sesi sebelum ia bergabung — ada di
// `topAttendance` (lib/sport.ts).
export default function SportBoardScreen() {
  const { gang: gangParam } = useLocalSearchParams<{ gang?: string }>();
  const { data, isi, error } = useSportData();
  const [gang, setGang] = useState<SportGangKey>(() => gangOf(gangParam));

  const todayId = toDayId(new Date());
  const meta = gangMeta(gang);
  // Yang belum pernah main DAN belum pernah cetak gol tidak ikut papan score:
  // barisnya cuma "0 gol · 0× main", dan deretan nol tidak memberi tahu apa pun.
  const papan = topScorers(isi, gang).filter((r) => r.goals > 0 || r.caps > 0);
  const rajin = topAttendance(isi, gang, todayId);
  const sesiLewat = pastSessions(isi.sessions, gang, todayId).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Friends"
        title="Papan Prestasi 🏅"
        subtitle="Top score & yang paling rajin datang tiap geng."
      />

      <ScreenError message={error} />

      {data === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView key={gang} contentContainerStyle={styles.content}>
          <SegmentTabs
            tabs={SPORT_GANGS.map((g) => ({
              key: g.key,
              label: `${g.emoji} ${g.label}`,
              sub: `${pastSessions(isi.sessions, g.key, todayId).length} sesi`,
            }))}
            value={gang}
            onChange={setGang}
          />

          {/* ===== Top score ===== */}
          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            🥇 Top Score {meta.label}
          </VixText>
          {papan.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada gol yang tercatat di {meta.label}. Gol dicatat per game
              di layar sesinya.
            </VixText>
          ) : (
            <View style={styles.papan}>
              {papan.map((r, i) => (
                <View key={r.member.id} style={styles.papanRow}>
                  <VixText heading="bold" additionalStyle={styles.papanRank}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.papanNama}>
                    {r.member.name}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.papanCaps}>
                    {r.caps}× main
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.papanGol}>
                    {r.goals} gol
                  </VixText>
                </View>
              ))}
            </View>
          )}

          {/* ===== Paling rajin datang ===== */}
          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            🔥 Paling Rajin Datang
          </VixText>
          {/* Keterangan ini bukan hiasan: tanpa itu "3 dari 3" di atas "18 dari
              20" terbaca seperti salah hitung, padahal memang begitu aturannya. */}
          <VixText heading="label" additionalStyle={styles.catatan}>
            Dihitung sejak sesi pertama ia masuk squad — anggota baru tidak
            dihukum karena sesi sebelum ia bergabung. Sesi yang belum main tidak
            ikut dihitung.
          </VixText>
          {sesiLewat === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada sesi {meta.label} yang sudah lewat.
            </VixText>
          ) : (
            <View style={styles.papan}>
              {rajin.map((r, i) => (
                <View key={r.member.id} style={styles.papanRow}>
                  <VixText heading="bold" additionalStyle={styles.papanRank}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.papanNama}>
                    {r.member.name}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.papanCaps}>
                    {r.present} dari {r.possible} sesi
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.papanGol}>
                    {r.possible > 0 ? `${Math.round(r.rate * 100)}%` : '—'}
                  </VixText>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  sectionTitle: { marginTop: 14, marginBottom: 8 },
  catatan: { color: Color.TEXT_PLACEHOLDER, marginBottom: 8 },
  empty: { textAlign: 'center', marginVertical: 10 },
  // Bentuknya sama persis dengan papan lama di sub-tab Fun Sport — yang pindah
  // cuma tempatnya, bukan rupanya.
  papan: { ...CARD, paddingVertical: 4 },
  papanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  papanRank: { color: Color.FRIENDS_DARK, width: 26, textAlign: 'center' },
  papanNama: { flex: 1, minWidth: 0, color: Color.TEXT_TITLE },
  papanCaps: { color: Color.TEXT_PLACEHOLDER },
  papanGol: { color: Color.FRIENDS_DARK },
});
