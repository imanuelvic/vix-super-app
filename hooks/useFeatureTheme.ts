import { useRoute } from 'expo-router';

import { featureThemeForRoute, type FeatureTheme } from '@/lib/featureTheme';

/**
 * Warna fitur milik layar yang sedang menggambar komponen ini.
 *
 * Sengaja `useRoute()` (rute layar INI), bukan `usePathname()` (rute yang
 * sedang tampil di app). Bedanya terasa saat menumpuk layar: membuka
 * Achievement dari Spiritual membuat layar Spiritual di baliknya ikut
 * menggambar ulang — dengan `usePathname()` pita headernya sempat berubah jadi
 * warna Achievement selama animasi geser, padahal layar itu belum ke mana-mana.
 */
export function useFeatureTheme(): FeatureTheme {
  const route = useRoute();
  return featureThemeForRoute(route.name);
}
