import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// 🔔 Notifikasi lokal Finance (expo-notifications, 22 Sep 2026): dua
// pengingat harian yang DIJADWALKAN DI HP (tanpa server, tanpa push token):
//   • pagi  07.30 → "Safe to Spend hari ini": status budget & fokus mingguan
//   • malam 20.30 → "Catat pengeluaran hari ini"
//
// Isinya TANPA nominal (muncul di lock screen; Finance sendiri dikunci PIN).
// Notifikasi terjadwal itu statis: teksnya = keadaan saat terakhir disinkronkan
// (tiap Home membaca data Finance), jadi selalu "per status terakhir".
//
// Modulnya native → BUTUH build EAS baru. Di build lama / Expo Go modulnya
// tidak ada; di-require lazy (pola lib/healthkit.ts) supaya JS-nya tetap aman
// dipasang lewat `eas update`: fiturnya diam saja, app tidak crash saat start.

type NotifModule = typeof import('expo-notifications');

let cached: NotifModule | null | undefined;

function getModule(): NotifModule | null {
  if (cached !== undefined) return cached;
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (inExpoGo) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotifModule;
    // Saat app terbuka, notifikasinya tetap tampil sebagai banner (bukan
    // diam-diam), tanpa bunyi & tanpa angka badge.
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    cached = null;
  }
  return cached;
}

export type NotifyStatus = 'ok' | 'needs-build' | 'denied';

const PREF_KEY = 'finance:notify'; // "1" = aktif
const IDS_KEY = 'finance:notify:ids'; // id notifikasi terjadwal milik Finance

export const NOTIFY_MORNING = { hour: 7, minute: 30 };
export const NOTIFY_EVENING = { hour: 20, minute: 30 };

/** Bisa dipakai di build ini? (modul native ada) */
export function notifyAvailable(): boolean {
  return getModule() !== null;
}

export async function financeNotifyEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) === '1';
  } catch {
    return false;
  }
}

/**
 * Nyalakan (minta izin dulu) / matikan (batalkan jadwal). Mengembalikan
 * statusnya supaya layar bisa bilang "butuh build baru" atau "izin ditolak".
 */
export async function setFinanceNotifyEnabled(on: boolean): Promise<NotifyStatus> {
  const mod = getModule();
  if (!mod) return 'needs-build';
  if (!on) {
    await batalkanJadwal(mod);
    await AsyncStorage.setItem(PREF_KEY, '0').catch(() => {});
    return 'ok';
  }
  let izin = await mod.getPermissionsAsync();
  if (!izin.granted) {
    izin = await mod.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
  }
  if (!izin.granted) return 'denied';
  await AsyncStorage.setItem(PREF_KEY, '1').catch(() => {});
  return 'ok';
}

async function batalkanJadwal(mod: NotifModule): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    for (const id of ids) await mod.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(IDS_KEY);
  } catch {
    // Jadwal lama tak terbaca = paling buruk ada notifikasi ganda sekali.
  }
}

let terakhir = '';

/**
 * Jadwalkan ulang dua pengingat harian dengan teks terbaru (tanpa nominal).
 * Tidak melakukan apa-apa kalau preferensinya mati, modulnya tak ada, atau
 * teksnya sama dengan yang terakhir dijadwalkan (hemat tulisan ke sistem).
 */
export async function syncFinanceNotifications(teks: { pagi: string; malam: string }): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  if (!(await financeNotifyEnabled())) return;
  const sidik = `${teks.pagi}\n${teks.malam}`;
  if (sidik === terakhir) return;
  terakhir = sidik;
  try {
    await batalkanJadwal(mod);
    const DAILY = mod.SchedulableTriggerInputTypes.DAILY;
    const pagi = await mod.scheduleNotificationAsync({
      content: { title: '💰 Safe to Spend hari ini', body: teks.pagi },
      trigger: { type: DAILY, ...NOTIFY_MORNING },
    });
    const malam = await mod.scheduleNotificationAsync({
      content: { title: '📝 Catat pengeluaran hari ini', body: teks.malam },
      trigger: { type: DAILY, ...NOTIFY_EVENING },
    });
    await AsyncStorage.setItem(IDS_KEY, JSON.stringify([pagi, malam]));
  } catch {
    terakhir = '';
  }
}

/** Dua kalimat notifikasi dari baris status Home (tanpa nominal). */
export function notifyTexts(lines: string[], focusLines: string[]): { pagi: string; malam: string } {
  const pagi = [lines[0] ?? 'Cek Safe to Spend sebelum pengeluaran yang tidak direncanakan.', ...focusLines.slice(0, 2)]
    .join(' ')
    .slice(0, 200);
  const malam = [
    'Ada jajan atau ojek hari ini? Catat sekarang supaya Safe to Spend besok akurat.',
    ...focusLines.slice(0, 1),
  ]
    .join(' ')
    .slice(0, 200);
  return { pagi, malam };
}
