import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { PlacesTab } from '@/components/friends/PlacesTab';
import { SplitBillTab } from '@/components/friends/SplitBillTab';
import { SportTab } from '@/components/friends/SportTab';
import { useAuth } from '@/contexts/auth';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';
import {
  billUnsettled,
  subscribeBills,
  subscribePlaces,
  type Bill,
  type Place,
} from '@/lib/friends';
import {
  EMPTY_SPORT,
  sportAttention,
  subscribeSport,
  type SportData,
} from '@/lib/sport';

type FriendsTab = 'sport' | 'bills' | 'places';

// Fun Sport duduk di TENGAH, tapi tetap jadi BAWAAN: dari ketiganya, cuma ini
// yang menuntut tindakan berjadwal (booking lapangan, menagih iuran). Split
// Bill & Places dibuka saat dibutuhkan; futsal rutin harus DIINGATKAN, bukan
// dicari. Urutan tab dan tab mana yang terbuka duluan memang dua hal berbeda —
// lihat useTabScroll di bawah.
const TABS: BottomTab<FriendsTab>[] = [
  { key: 'bills', label: 'Split Bill', icon: 'receipt.fill' },
  { key: 'sport', label: 'Fun Sport', icon: 'figure.run' },
  { key: 'places', label: 'Places', icon: 'cup.and.saucer.fill' },
];

// Friends 🤝 — yang terjadi saat bergaul dengan teman.
//
// Fun Sport ⚽ mengurus futsal rutin dua geng (CORE & NDC F3): jadwal,
// lapangan, skuad, kas tim, iuran siapa yang belum setor, dan skor tiap game.
// Split Bill 💸
// menjawab bagian paling merepotkan setelah makan bareng: siapa makan apa,
// berapa bagiannya setelah pajak & service, dan siapa yang belum setor.
// Places 🍜 menjawab pertanyaan yang selalu paling lama dijawab di grup:
// "besok ngumpul di mana?"
export default function FriendsScreen() {
  const { user } = useAuth();
  const { tab, scrollKey, onTabPress } = useTabScroll<FriendsTab>('sport');

  const [bills, setBills] = useState<Bill[] | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [sport, setSport] = useState<SportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeBills(user.uid, setBills, fail),
      subscribePlaces(user.uid, setPlaces, fail),
      subscribeSport(user.uid, setSport, fail),
    ]);
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Friends 🤝"
        subtitle="Futsal rutin, patungan & tempat nongkrong"
      />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {bills === null || places === null || sport === null ? (
          <LoadingCenter />
        ) : tab === 'sport' ? (
          <SportTab data={sport} />
        ) : tab === 'bills' ? (
          <SplitBillTab bills={bills} />
        ) : (
          <PlacesTab places={places} />
        )}
      </View>

      {/* Badge tile Friends di Home = JUMLAH kedua angka di bawah ini, jadi
          tile-nya tidak pernah lebih kecil dari apa yang menunggu di dalam.
          Aturannya tinggal di lib masing-masing (billUnsettled &
          sessionNeedsAttention), bukan ditulis ulang di sini. */}
      <BottomTabs
        tabs={withBadge(TABS, {
          bills: (bills ?? []).filter(billUnsettled).length,
          sport: sportAttention(sport ?? EMPTY_SPORT, new Date()),
        })}
        value={tab}
        onChange={onTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { flex: 1 },
});
