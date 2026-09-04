import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { GangTabs } from '@/components/friends/GangTabs';
import { VixText } from '@/components/common/VixText';
import { useSportData } from '@/hooks/useSportData';
import { dayId as toDayId } from '@/lib/format';
import {
    gangMeta,
    gangOf,
    pastSessions,
    topAttendance,
    topScorers,
    type SportGangKey,
} from '@/lib/sport';

// Leaderboard 🏅 — dua papan peringkat Fun Sport, satu geng sekali lihat.
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
// Berapa nama yang ditampilkan tiap papan.
//
// Sepuluh, dan itu bukan angka asal: papan peringkat dibaca untuk tahu siapa
// yang DI ATAS. Dengan 19 anggota, sisanya cuma deretan panjang yang tak pernah
// dibaca sampai habis — dan ekor sepanjang itu justru mendorong papan kedua
// keluar layar. Yang tidak masuk sepuluh besar tetap disebut jumlahnya, supaya
// papannya tidak terlihat seolah anggotanya cuma sepuluh.
const PAPAN_MAKS = 10;

export default function SportBoardScreen() {
  const { gang: gangParam } = useLocalSearchParams<{ gang?: string }>();
  const { data, isi, error } = useSportData();
  const [gang, setGang] = useState<SportGangKey>(() => gangOf(gangParam));

  const todayId = toDayId(new Date());
  const meta = gangMeta(gang);
  // Yang belum pernah main DAN belum pernah cetak gol tidak ikut papan score:
  // barisnya cuma "0 gol · 0× main", dan deretan nol tidak memberi tahu apa pun.
  const papanPenuh = topScorers(isi, gang).filter((r) => r.goals > 0 || r.caps > 0);
  const rajinPenuh = topAttendance(isi, gang, todayId);
  const papan = papanPenuh.slice(0, PAPAN_MAKS);
  const rajin = rajinPenuh.slice(0, PAPAN_MAKS);
  const sesiLewat = pastSessions(isi.sessions, gang, todayId).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Friends"
        title="Leaderboard 🏅"
        subtitle="Top score & yang paling rajin datang tiap geng."
      />

      <ScreenError message={error} />

      {/* Tab geng berdiri DI LUAR gulungan: ia tak ikut bergerak sama sekali,
          jadi membandingkan dua geng cukup satu klik dari mana pun kamu
          berhenti membaca papannya. */}
      <GangTabs value={gang} onChange={setGang} />

      {data === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView key={gang} contentContainerStyle={styles.content}>
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
          {papanPenuh.length > PAPAN_MAKS && (
            <VixText heading="label" additionalStyle={styles.sisa}>
              +{papanPenuh.length - PAPAN_MAKS} nama lain tidak masuk sepuluh besar.
            </VixText>
          )}

          {/* ===== Paling rajin datang ===== */}
          <VixText heading="title" additionalStyle={styles.sectionTitle}>
            🔥 Kehadiran Anggota
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
          {rajinPenuh.length > PAPAN_MAKS && (
            <VixText heading="label" additionalStyle={styles.sisa}>
              +{rajinPenuh.length - PAPAN_MAKS} nama lain tidak masuk sepuluh besar.
            </VixText>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  sectionTitle: { ...SECTION_SPACE },
  empty: { textAlign: 'center', marginVertical: 10 },
  sisa: { color: Color.TEXT_PLACEHOLDER, marginTop: 6 },
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
