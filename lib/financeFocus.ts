import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { categoryOf, type FinanceCategory } from './categories';
import { db } from './firebase';
import { addDays, mondayOf, type PaceStatus } from './financeInsight';
import { liveDoc } from './liveDoc';
import type { Transaction } from './transactions';

// 🎯 Fokus mingguan Finance (22 Sep 2026): batas yang KAMU tetapkan sendiri
// untuk pengeluaran yang rawan impulsif, per minggu (Senin s.d. Minggu), mis.
// "🚗 Transportation › Gojek ≤ Rp150.000 dan ≤ 4× seminggu" atau "🍟 Snacks
// ≤ Rp100.000". Progresnya dihitung otomatis dari transaksi (nominal &
// jumlah kali), jadi ini checklist yang mengisi dirinya sendiri: tampil di
// Dashboard Finance (dengan angka) dan di Home (status saja).
//
// Berlaku terus tiap minggu sampai dihapus (hard delete dari array). SATU
// dokumen kecil: users/{uid}/app/financeFocus → { items: FocusItem[] }.

export type FocusItem = {
  id: string;
  category: string;
  /** Key sub-kategori; "" = seluruh kategori. */
  sub: string;
  /** Batas rupiah per minggu; 0 = tidak dibatasi nominalnya. */
  limitAmount: number;
  /** Batas jumlah transaksi per minggu; 0 = tidak dibatasi jumlahnya. */
  limitCount: number;
};

export type FocusProgress = {
  item: FocusItem;
  category: FinanceCategory;
  /** Nama sub (kosong kalau seluruh kategori). Diisi pemanggil lewat subLabel. */
  subLabel: string;
  spent: number;
  count: number;
  status: PaceStatus;
  /** "Rp80.000 lagi · 2× lagi" (kosong kalau tak ada batas). */
  leftText: string;
};

export function newFocusId(): string {
  return `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Fokus ini sah? Minimal satu batas yang terisi. */
export function focusValid(item: Pick<FocusItem, 'category' | 'limitAmount' | 'limitCount'>): boolean {
  return !!item.category && (item.limitAmount > 0 || item.limitCount > 0);
}

/**
 * Progres tiap fokus untuk minggu yang memuat `now`. `subLabel(item)` memberi
 * nama sub-nya (butuh peta sub-kategori dari lib/budgets, jadi dioper).
 */
export function focusProgress(
  items: Transaction[],
  focus: FocusItem[],
  now: Date,
  subLabel: (item: FocusItem) => string,
  formatAmount: (n: number) => string,
): FocusProgress[] {
  const from = mondayOf(now).getTime();
  const to = addDays(mondayOf(now), 7).getTime();
  return focus.map((item) => {
    let spent = 0;
    let count = 0;
    for (const t of items) {
      if (t.type !== 'expense' || t.category !== item.category) continue;
      if (item.sub && t.sub !== item.sub) continue;
      const ms = t.date.toMillis();
      if (ms < from || ms >= to) continue;
      spent += t.amount;
      count++;
    }
    const overAmount = item.limitAmount > 0 && spent > item.limitAmount;
    const overCount = item.limitCount > 0 && count > item.limitCount;
    const nearAmount = item.limitAmount > 0 && spent >= item.limitAmount * 0.8;
    const nearCount = item.limitCount > 0 && count >= item.limitCount;
    const status: PaceStatus =
      overAmount || overCount ? 'over' : nearAmount || nearCount ? 'watch' : 'on-track';
    const parts: string[] = [];
    if (item.limitAmount > 0) {
      const sisa = item.limitAmount - spent;
      parts.push(sisa >= 0 ? `${formatAmount(sisa)} lagi` : `lewat ${formatAmount(-sisa)}`);
    }
    if (item.limitCount > 0) {
      const sisa = item.limitCount - count;
      parts.push(sisa >= 0 ? `${sisa}× lagi` : `lewat ${-sisa}×`);
    }
    return {
      item,
      category: categoryOf('expense', item.category),
      subLabel: subLabel(item),
      spent,
      count,
      status,
      leftText: parts.join(' · '),
    };
  });
}

function focusRef(uid: string) {
  return doc(db, 'users', uid, 'app', 'financeFocus');
}

export function subscribeFinanceFocus(
  uid: string,
  onChange: (items: FocusItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    focusRef(uid),
    (snapshot) => {
      const raw = snapshot.data()?.items;
      const list: FocusItem[] = [];
      if (Array.isArray(raw)) {
        for (const r of raw as Partial<FocusItem>[]) {
          if (typeof r?.id !== 'string' || typeof r.category !== 'string') continue;
          list.push({
            id: r.id,
            category: r.category,
            sub: typeof r.sub === 'string' ? r.sub : '',
            limitAmount: typeof r.limitAmount === 'number' ? r.limitAmount : 0,
            limitCount: typeof r.limitCount === 'number' ? r.limitCount : 0,
          });
        }
      }
      onChange(list);
    },
    onError,
  );
}

/** Ganti seluruh daftar fokus (yang dihapus benar-benar hilang dari array). */
export function saveFinanceFocus(uid: string, items: FocusItem[]) {
  return setDoc(focusRef(uid), { items });
}
