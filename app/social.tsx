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
import { useAuth } from '@/contexts/auth';
import { LOAD_ERROR } from '@/lib/messages';
import {
  billUnsettled,
  subscribeBills,
  subscribePlaces,
  type Bill,
  type Place,
} from '@/lib/social';

type SocialTab = 'bills' | 'places';

const TABS: BottomTab<SocialTab>[] = [
  { key: 'bills', label: 'Split Bill', icon: 'receipt.fill' },
  { key: 'places', label: 'Places', icon: 'cup.and.saucer.fill' },
];

// Social 🥂 — yang terjadi saat bergaul dengan teman.
//
// Split Bill 💸 menjawab bagian paling merepotkan setelah makan bareng: siapa
// makan apa, berapa bagiannya setelah pajak & service, dan siapa yang belum
// setor. Places 🍜 menjawab pertanyaan yang selalu paling lama dijawab di grup:
// "besok ngumpul di mana?"
export default function SocialScreen() {
  const { user } = useAuth();
  const { tab, scrollKey, onTabPress } = useTabScroll<SocialTab>('bills');

  const [bills, setBills] = useState<Bill[] | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeBills(user.uid, setBills, fail),
      subscribePlaces(user.uid, setPlaces, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Social 🥂"
        subtitle="Patungan & tempat nongkrong bareng teman"
      />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {bills === null || places === null ? (
          <LoadingCenter />
        ) : tab === 'bills' ? (
          <SplitBillTab bills={bills} />
        ) : (
          <PlacesTab places={places} />
        )}
      </View>

      {/* Badge = tagihan yang masih ada orang belum setor. Angka yang sama
          dipakai badge tile Social di Home, jadi keduanya tidak mungkin
          berbeda pendapat. */}
      <BottomTabs
        tabs={withBadge(TABS, {
          bills: (bills ?? []).filter(billUnsettled).length,
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
