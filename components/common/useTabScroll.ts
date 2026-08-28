import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

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
//
// `repress` = tekanan barusan mengenai tab yang SUDAH aktif (jadi tekanan
// kedua). Tab yang daftarnya bertenggat memakainya untuk langsung melompat ke
// baris yang jatuh tempo — pola yang sama dengan tab sesi di Habits. Karena
// kontennya memang re-mount tiap tekan, nilai ini terbaca saat mount: tidak
// perlu isyarat tambahan.
//
// ── Membuka sub-tab tertentu lewat ?tab=… ────────────────────────────────
// Enam layar (Profile, Career, CORE, Learning, News, Spiritual) bisa dituju
// langsung ke sub-tabnya dari reminder Dashboard / kartu Home. Dulu keenamnya
// menulis blok yang sama: baca param, satu fungsi penjaga "ini tab yang sah?",
// nilai awal, lalu satu efek penyelaras. Empat penjaganya bahkan berbunyi
// sama persis (`TABS.some((t) => t.key === value)`) dan dua sisanya menyalin
// daftar kuncinya dengan tangan — yang berarti menambah sub-tab baru bisa
// diam-diam tidak ikut bisa dituju.
//
// Sekarang cukup mengoper daftar TABS yang memang sudah dirender layarnya:
//
//   const { tab, … } = useTabScroll<MyTab>('default', { tabs: TABS });
//
// Daftar tab yang sah = daftar tab yang tampil. Mustahil beda lagi.
export function useTabScroll<T extends string>(
  initial: T,
  options?: {
    /**
     * Daftar tab yang sah — dioper apa adanya dari TABS layarnya. Ada = layar
     * ini boleh dituju lewat `?tab=…`; kosong = param diabaikan sama sekali.
     */
    tabs: readonly { key: T }[];
    /**
     * true = param dibersihkan sesudah dipakai.
     *
     * Perlu untuk layar TAB yang tidak pernah dilepas dari memori (Profile):
     * kalau parameternya dibiarkan menempel, kunjungan berikutnya lewat tombol
     * tab bawah akan terus dipaksa balik ke sub-tab yang sama.
     */
    clearParam?: boolean;
  },
) {
  const router = useRouter();
  const { tab: param } = useLocalSearchParams<{ tab?: string }>();
  const clearParam = options?.clearParam ?? false;
  // Param yang SAH saja; selain itu (termasuk tanpa `tabs`) dianggap tidak ada.
  const fromParam =
    options && options.tabs.some((t) => t.key === param) ? (param as T) : null;

  const [tab, setTab] = useState<T>(fromParam ?? initial);
  const [scrollKey, setScrollKey] = useState(0);
  const [repress, setRepress] = useState(false);

  // Datang LAGI ke layar yang masih hidup dengan param berbeda → ikut pindah.
  // Tanpa ini, reminder Dashboard cuma bekerja saat layarnya baru dibuka.
  //
  // `set-state-in-effect` sengaja dimatikan DI SATU TEMPAT INI. Alasannya:
  // paramnya harus disalin ke state, karena begitu dipakai ia dilepas lagi
  // (`clearParam`) — kalau tabnya diturunkan langsung dari paramnya, melepas
  // param berarti tabnya melompat balik ke bawaannya seketika. Menurunkannya
  // tanpa melepas param juga tidak bisa: Profile itu layar tab yang tak pernah
  // mati, dan paramnya akan terus memaksa sub-tab yang sama tiap kunjungan.
  //
  // Blok ini sebelumnya ada di ENAM layar dan tidak pernah ditegur — bukan
  // karena lebih benar, tapi karena `setTab`-nya datang lewat batas hook
  // sehingga aturannya tidak mengenalinya. Sekarang jadi satu tempat, dan
  // pengecualiannya terlihat.
  useEffect(() => {
    if (!fromParam) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(fromParam);
    if (clearParam) router.setParams({ tab: '' });
  }, [fromParam, clearParam, router]);

  const onTabPress = useCallback(
    (next: T) => {
      setRepress(next === tab);
      setTab(next);
      setScrollKey((n) => n + 1); // naikkan tiap ditekan → konten re-mount ke atas
    },
    [tab],
  );

  return { tab, setTab, scrollKey, repress, onTabPress };
}
