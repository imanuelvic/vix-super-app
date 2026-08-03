// Kategori keuangan vix-super-app.
// Diambil dari sheet "⚙️ Setup" (spreadsheet keuangan lama):
// Income, Saving, Investment, Expense — beserta ikon & status aktifnya.
//
// Mau ubah/tambah kategori? Cukup edit daftar di file ini.
// `active: false` = kategori disembunyikan dari pilihan, tapi transaksi
// lama yang memakainya tetap tampil di riwayat.

import { Color } from '@/assets/style/color';

export type FinanceType = 'income' | 'expense' | 'saving' | 'investment';

export type FinanceCategory = {
  key: string; // id stabil yang disimpan di Firestore — JANGAN diubah setelah dipakai
  label: string;
  icon: string; // emoji
  active: boolean;
};

export const FINANCE_TYPES: FinanceType[] = [
  'income',
  'expense',
  'saving',
  'investment',
];

export const FINANCE_TYPE_LABEL: Record<FinanceType, string> = {
  income: 'Income',
  expense: 'Expense',
  saving: 'Saving',
  investment: 'Investment',
};

// Warna khas tiap jenis — dipakai tombol jenis & border kartu transaksi.
export const FINANCE_TYPE_COLOR: Record<FinanceType, string> = {
  income: Color.FINANCE_INCOME,
  expense: Color.FINANCE_EXPENSE,
  saving: Color.FINANCE_SAVING,
  investment: Color.FINANCE_INVESTMENT,
};

// Versi gelap tiap jenis — dipakai jadi borderColor tombol/kartu Finance.
export const FINANCE_TYPE_COLOR_DARK: Record<FinanceType, string> = {
  income: Color.FINANCE_INCOME_DARK,
  expense: Color.FINANCE_EXPENSE_DARK,
  saving: Color.FINANCE_SAVING_DARK,
  investment: Color.FINANCE_INVESTMENT_DARK,
};

export const FINANCE_CATEGORIES: Record<FinanceType, FinanceCategory[]> = {
  income: [
    { key: 'ndc-salary', label: 'NDC Salary', icon: '⛪', active: true },
    { key: 'ndc-incentive', label: 'NDC Incentive', icon: '💸', active: true },
    { key: 'agent-commissions', label: 'Agent Commissions', icon: '👨🏻‍💼', active: false },
    { key: 'preloved', label: 'Preloved', icon: '🎒', active: true },
    { key: 'trading-crypto', label: 'Trading Cryptocurrency', icon: '🪙', active: true },
    { key: 'ndc-bonus', label: 'NDC Bonus', icon: '🧧', active: true },
  ],
  expense: [
    { key: 'food-drink', label: 'Food Drink', icon: '🍛', active: true },
    { key: 'transportation', label: 'Transportation', icon: '🚗', active: true },
    { key: 'travel', label: 'Travel', icon: '✈️', active: true },
    { key: 'snacks', label: 'Snacks', icon: '🍟', active: true },
    { key: 'groceries', label: 'Groceries', icon: '🍗', active: true },
    { key: 'fun-recreation', label: 'Fun Recreation', icon: '🎢', active: true },
    { key: 'personal-services', label: 'Personal Services', icon: '👤', active: true },
    { key: 'shopping', label: 'Shopping', icon: '🛍️', active: true },
    { key: 'mobile-data-admin', label: 'Mobile, Data & Administration', icon: '📱', active: true },
    { key: 'insurance', label: 'Insurance', icon: '☂️', active: true },
    { key: 'parents', label: 'Parents', icon: '👨🏻', active: true },
    { key: 'gathering-core', label: 'Gathering CORE', icon: '💚', active: true },
    { key: 'rent', label: 'Rent', icon: '🏘️', active: true },
    { key: 'electricity', label: 'Electricity', icon: '⚡', active: true },
    { key: 'water', label: 'Water', icon: '💧', active: true },
    { key: 'wifi', label: 'Wifi', icon: '📶', active: true },
    { key: 'maintenance', label: 'Maintenance', icon: '⚙️', active: true },
  ],
  saving: [
    { key: 'emergency-fund', label: 'Emergency Fund', icon: '🚨', active: true },
    { key: 'car-fund', label: 'Car Fund', icon: '🚗', active: true },
    { key: 'sinking-fund', label: 'Sinking Fund', icon: '💧', active: true },
    { key: 'vacation-fund', label: 'Vacation Fund', icon: '🛩️', active: true },
    { key: 'self-reward-fund', label: 'Self-Reward Fund', icon: '🏆', active: true },
    { key: 'impulsive-fund', label: 'Impulsive Fund', icon: '🤑', active: true },
    { key: 'learning-fund', label: 'Learning Fund', icon: '📚', active: true },
    { key: 'health-fund', label: 'Health Fund', icon: '🩺', active: true },
    { key: 'giving-fund', label: 'Giving Fund', icon: '💌', active: true },
    { key: 'core-fund', label: 'CORE Fund', icon: '🏡', active: true },
    { key: 'birthday-fund', label: 'Birthday Fund', icon: '🎂', active: true },
    { key: 'unexpected-fund', label: 'Unexpected Fund', icon: '⚠️', active: true },
    { key: 'resita-birthday', label: "Resita's Birthday", icon: '💎', active: true },
    { key: 'mamse-birthday', label: "Mamse's Birthday", icon: '👗', active: true },
    { key: 'papse-birthday', label: "Papse's Birthday", icon: '👔', active: true },
    { key: 'engagement-jogjakarta', label: 'Engagement in Jogjakarta', icon: '💍', active: true },
    { key: 'medical-check-up-2026', label: 'Medical Check Up 2026', icon: '🏥', active: true },
    { key: 'vaccination-2026', label: 'Vaccination 2026', icon: '💉', active: true },
    { key: 'christmas-gifts', label: 'Christmas Gifts', icon: '🎅🏻', active: true },
    { key: 'business-capital', label: 'Business Capital', icon: '💰', active: true },
    { key: 'laptop-mining', label: 'Laptop Mining', icon: '💻', active: true },
    { key: 'nvidia-rtx-3080', label: 'NVIDIA RTX 3080', icon: '🪙', active: true },
  ],
  investment: [
    { key: 'home-purchase', label: 'Home Purchase', icon: '🏡', active: true },
    { key: 'car-purchase', label: 'Car Purchase', icon: '🚗', active: true },
    { key: 'rent-apartment', label: 'Rent Apartment', icon: '🏠', active: true },
    { key: 'wedding-savings', label: 'Wedding Savings', icon: '💍', active: true },
    { key: 'birth-fund', label: 'Birth Fund', icon: '🍼', active: true },
    { key: 'childrens-education', label: "Children's Education", icon: '🏫', active: true },
    { key: 'honeymoon', label: 'Honeymoon', icon: '💕', active: true },
    { key: 'thailand', label: 'Thailand', icon: '🇹🇭', active: true },
    { key: 'skydiving-freefall', label: 'Skydiving Freefall', icon: '🪂', active: true },
    { key: 'uae', label: 'UAE', icon: '🇦🇪', active: true },
    { key: 'japan', label: 'Japan', icon: '🇯🇵', active: true },
    { key: 'turkey', label: 'Turkey', icon: '🇹🇷', active: true },
    { key: 'greece', label: 'Greece', icon: '🇬🇷', active: true },
    { key: 'pension-fund', label: 'Pension Fund', icon: '🪑', active: true },
    { key: 'harmony-fund', label: 'Harmony Fund', icon: '🕊️', active: true },
    { key: 'heirs-savings', label: 'Heirs Savings', icon: '👑', active: true },
  ],
};

/** Kategori yang tampil di pilihan saat menambah transaksi. */
export function activeCategories(type: FinanceType): FinanceCategory[] {
  return FINANCE_CATEGORIES[type].filter((c) => c.active);
}

/** Cari kategori dari key tersimpan — fallback kalau kategori sudah dihapus. */
export function categoryOf(type: FinanceType, key: string): FinanceCategory {
  return (
    FINANCE_CATEGORIES[type].find((c) => c.key === key) ?? {
      key,
      label: key,
      icon: '❓',
      active: false,
    }
  );
}
