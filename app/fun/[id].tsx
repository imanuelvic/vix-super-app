import { FunEntryScreen } from '@/components/fun/FunEntryScreen';

// Isian satu entri Fun 🎉 (Summit ⛰️ / Rekreasi 🏝️) — dibuka dari layar Fun.
// `id` = 'new' untuk menambah; kategorinya lewat param `?category=`.
//
// Race punya pintunya sendiri (app/race/[id]) supaya berpita Health, bukan Fun.
export default function FunEntryRoute() {
  return <FunEntryScreen />;
}
