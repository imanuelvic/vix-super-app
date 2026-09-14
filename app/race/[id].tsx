import { FunEntryScreen } from '@/components/fun/FunEntryScreen';

// Isian satu Race 🏃 — dibuka dari Health › Race. `id` = 'new' untuk menambah.
//
// Pintu ini ada SUPAYA pitanya berwarna Health: warna fitur ditentukan nama
// rutenya (lib/featureTheme.ts → `race: 'health'`), dan Race memang tinggal di
// Health sejak 30 Agu 2026. Layarnya sendiri satu, dipakai bersama app/fun/[id].
export default function RaceEntryScreen() {
  return <FunEntryScreen category="race" />;
}
