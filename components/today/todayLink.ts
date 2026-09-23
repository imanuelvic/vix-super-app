import type { Href } from 'expo-router';

import type { TodayHref } from '@/lib/today';

/**
 * Tujuan click baris Today → Href expo-router. Mesinnya (lib/today.ts)
 * menulis rute sebagai string polos supaya tetap murni & bisa diuji tanpa
 * expo-router; pemetaannya ke Href bertipe cukup dilakukan sekali di sini.
 */
export function todayHref(h: TodayHref): Href {
  return (h.params ? { pathname: h.pathname, params: h.params } : h.pathname) as Href;
}
