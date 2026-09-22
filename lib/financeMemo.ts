import AsyncStorage from '@react-native-async-storage/async-storage';

// Ingatan kecil Finance di HP (AsyncStorage), bukan data: cukup per perangkat
// dan tidak layak dibayar dengan tulisan Firestore.
//
// Quick check 👀 yang sudah kamu jawab "Tetap Tambahkan" untuk sebuah kategori
// TIDAK muncul lagi untuk kategori itu di hari yang sama. Jeda-nya harus
// terasa sekali dan berarti; ditanya ulang tiap transaksi berikutnya cuma
// membuatnya diabaikan.

const QUICK_KEY = 'finance:quickcheck';

type QuickMemo = { dayId: string; keys: string[] };

async function bacaQuick(): Promise<QuickMemo> {
  try {
    const raw = await AsyncStorage.getItem(QUICK_KEY);
    if (!raw) return { dayId: '', keys: [] };
    const v = JSON.parse(raw) as Partial<QuickMemo>;
    return {
      dayId: typeof v.dayId === 'string' ? v.dayId : '',
      keys: Array.isArray(v.keys) ? v.keys.filter((k): k is string => typeof k === 'string') : [],
    };
  } catch {
    return { dayId: '', keys: [] };
  }
}

/** Quick check kategori ini sudah dijawab hari ini? */
export async function quickCheckSeen(dayId: string, categoryKey: string): Promise<boolean> {
  const memo = await bacaQuick();
  return memo.dayId === dayId && memo.keys.includes(categoryKey);
}

/** Catat: kategori ini sudah dijawab hari ini (hari berganti = daftar kosong lagi). */
export async function markQuickCheckSeen(dayId: string, categoryKey: string): Promise<void> {
  try {
    const memo = await bacaQuick();
    const keys = memo.dayId === dayId ? memo.keys : [];
    if (!keys.includes(categoryKey)) keys.push(categoryKey);
    await AsyncStorage.setItem(QUICK_KEY, JSON.stringify({ dayId, keys }));
  } catch {
    // Tidak tersimpan = paling buruk ditanya sekali lagi.
  }
}
