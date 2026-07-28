import { useCallback, useState } from 'react';

// Hook bersama untuk tab bar bawah (BottomTabs) di SEMUA layar fitur.
//
// Cara pakai (seragam di semua layar):
//   const { tab, setTab, scrollKey, onTabPress } = useTabScroll<MyTab>('default');
//   ...
//   <View style={styles.content} key={scrollKey}>{isi tab}</View>
//   <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
//
// `scrollKey` naik SETIAP tombol tab ditekan (termasuk tab yang sedang aktif).
// Karena dipakai sebagai `key` pembungkus konten, konten otomatis re-mount →
// selalu mulai dari paling atas. Satu mekanisme, tanpa ref di tiap tab, dan
// tanpa tambahan baca Firestore (data tetap dilangganani di level layar).
export function useTabScroll<T extends string>(initial: T) {
  const [tab, setTab] = useState<T>(initial);
  const [scrollKey, setScrollKey] = useState(0);

  const onTabPress = useCallback((next: T) => {
    setTab(next);
    setScrollKey((n) => n + 1); // naikkan tiap ditekan → konten re-mount ke atas
  }, []);

  return { tab, setTab, scrollKey, onTabPress };
}
