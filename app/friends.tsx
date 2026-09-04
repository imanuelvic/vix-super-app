import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { PlacesTab } from '@/components/friends/PlacesTab';
import { SplitBillTab } from '@/components/friends/SplitBillTab';
import { FutsalTab } from '@/components/friends/FutsalTab';
import { useAuth } from '@/contexts/auth';
import { useFutsalGang } from '@/contexts/futsalGang';
import {
  billUnsettled,
  subscribeBills,
  subscribePlaces,
  type Bill,
  type Place,
} from '@/lib/friends';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';
import {
  EMPTY_FUTSAL,
  futsalAttention,
  subscribeFutsal,
  type FutsalData,
} from '@/lib/futsal';

type FriendsTab = 'futsal' | 'bills' | 'places';

// Fun Futsal duduk di TENGAH, tapi tetap jadi BAWAAN: dari ketiganya, cuma ini
// yang menuntut tindakan berjadwal (booking lapangan, menagih iuran). Split
// Bill & Places dibuka saat dibutuhkan; futsal rutin harus DIINGATKAN, bukan
// dicari. Urutan tab dan tab mana yang terbuka duluan memang dua hal berbeda —
// lihat useTabScroll di bawah.
const TABS: BottomTab<FriendsTab>[] = [
  { key: 'bills', label: 'Split Bill', icon: 'receipt.fill' },
  { key: 'futsal', label: 'Fun Futsal', icon: 'soccerball' },
  { key: 'places', label: 'Places', icon: 'cup.and.saucer.fill' },
];

// Friends 🤝 — yang terjadi saat bergaul dengan teman.
//
// Fun Futsal ⚽ mengurus futsal rutin dua geng (CORE & NDC F3): jadwal,
// lapangan, squad, kas tim, iuran siapa yang belum setor, dan score tiap game.
// Split Bill 💸
// menjawab bagian paling merepotkan setelah makan bareng: siapa makan apa,
// berapa bagiannya setelah pajak & service, dan siapa yang belum setor.
// Places 🍜 menjawab pertanyaan yang selalu paling lama dijawab di grup:
// "besok ngumpul di mana?"
export default function FriendsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { tab, scrollKey, onTabPress } = useTabScroll<FriendsTab>('futsal');

  // Geng yang sedang dibuka — nilai BERSAMA seluruh app (contexts/futsalGang),
  // jadi Kas Tim, Jadwal Main & Leaderboard selalu membuka geng yang sama, dan
  // menekan back mengembalikanmu ke geng itu juga.
  const { gang, setGang } = useFutsalGang();

  const [bills, setBills] = useState<Bill[] | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [futsal, setFutsal] = useState<FutsalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribeBills(user.uid, setBills, fail),
      subscribePlaces(user.uid, setPlaces, fail),
      subscribeFutsal(user.uid, setFutsal, fail),
    ]);
  }, [user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Friends 🤝"
        subtitle="Kegiatan yang menyenangkan bersama teman-teman"
        right={
          /* Dua pintu yang dipakai tiap minggu: kas tim & papan peringkat.
             Keduanya di pojok header, bukan kartu di dalam daftar — daftarnya
             sudah panjang, dan pintu yang ikut menggulung itu pintu yang
             dicari-cari. Kas ada di kiri: uang lebih sering dibuka. */
          tab === 'futsal' ? (
            <>
              <EmojiButton emoji="💰" onPress={() => router.push('/futsal-cash')} />
              <EmojiButton emoji="🏅" onPress={() => router.push('/futsal-board')} />
            </>
          ) : undefined
        }
      />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {bills === null || places === null || futsal === null ? (
          <LoadingCenter />
        ) : tab === 'futsal' ? (
          <FutsalTab data={futsal} gang={gang} onGangChange={setGang} />
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
          futsal: futsalAttention(futsal ?? EMPTY_FUTSAL, new Date()),
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
