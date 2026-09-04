import { StyleSheet, View } from 'react-native';

import { SegmentTabs } from '@/components/common/SegmentTabs';
import { FUTSAL_GANGS, type FutsalGangKey } from '@/lib/futsal';

// Deretan tab geng Fun Futsal (⛪ CORE / ⚽ NDC F3) yang BERDIRI DI LUAR gulungan.
//
// Dipakai tiga layar: sub-tab Fun Futsal, Jadwal Main, dan Leaderboard. Ketiganya
// menulis blok yang sama persis — sampai jarak kiri-kanannya, yang harus sama
// dengan isi halamannya supaya batas kiri-kanan layar tetap satu garis.
//
// Di luar gulungan, bukan sekadar "dipatok": dua judul yang sama-sama dipatok
// saling mendorong — yang di atas hilang begitu yang bawah tiba. Deretan ini
// harus selalu ada, jadi ia bukan anak ScrollView sama sekali.
//
// Cuma nama klubnya: yang dicari di deretan ini memang cuma "aku sedang di geng
// mana". Halaman Kas sengaja TIDAK memakai komponen ini — tabnya membawa saldo
// tiap geng dan ikut menggulung bersama isinya.
export function GangTabs({
  value,
  onChange,
  gap = 4,
}: {
  value: FutsalGangKey;
  onChange: (gang: FutsalGangKey) => void;
  /** Jarak ke pita header di atasnya — sub-tab Fun Futsal perlu sedikit lebih. */
  gap?: number;
}) {
  return (
    <View style={[styles.bar, { paddingTop: gap }]}>
      <SegmentTabs
        tabs={FUTSAL_GANGS.map((g) => ({
          key: g.key,
          label: `${g.emoji} ${g.label}`,
        }))}
        value={value}
        onChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 20 },
});
