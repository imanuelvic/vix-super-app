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
import { PlacesTab } from '@/components/social/PlacesTab';
import { SplitBillTab } from '@/components/social/SplitBillTab';
import { SportTab } from '@/components/social/SportTab';
import { useAuth } from '@/contexts/auth';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';
import {
  billUnsettled,
  subscribeBills,
  subscribePlaces,
  type Bill,
  type Place,
} from '@/lib/social';
import {
  EMPTY_SPORT,
  sportAttention,
  subscribeSport,
  type SportData,
} from '@/lib/sport';

type SocialTab = 'sport' | 'bills' | 'places';

// Sport paling kiri DAN jadi bawaan: dari ketiganya, cuma ini yang menuntut
// tindakan berjadwal (booking lapangan, menagih iuran). Split Bill & Places
// dibuka saat dibutuhkan; futsal rutin harus DIINGATKAN, bukan dicari.
const TABS: BottomTab<SocialTab>[] = [
  { key: 'sport', label: 'Sport', icon: 'figure.run' },
  { key: 'bills', label: 'Split Bill', icon: 'receipt.fill' },
  { key: 'places', label: 'Places', icon: 'cup.and.saucer.fill' },
];

// Social 🤝 — yang terjadi saat bergaul dengan teman.
//
// Sport ⚽ mengurus futsal rutin dua geng (CORE & NDC F3): jadwal, lapangan,
// skuad, iuran siapa yang belum setor, dan skor tiap game. Split Bill 💸
// menjawab bagian paling merepotkan setelah makan bareng: siapa makan apa,
// berapa bagiannya setelah pajak & service, dan siapa yang belum setor.
// Places 🍜 menjawab pertanyaan yang selalu paling lama dijawab di grup:
// "besok ngumpul di mana?"
export default function SocialScreen() {
  const { user } = useAuth();
  const { tab, scrollKey, onTabPress } = useTabScroll<SocialTab>('sport');

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
        title="Social 🤝"
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

      {/* Badge tile Social di Home = JUMLAH kedua angka di bawah ini, jadi
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
