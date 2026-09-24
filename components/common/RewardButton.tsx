import { useRouter } from 'expo-router';

import { EmojiButton } from '@/components/common/EmojiButton';
import type { RewardCategoryKey } from '@/lib/reward';

// Tombol 🔥 di pojok kanan atas header layar → buka Reward 🏆 dengan
// modal kategori MILIK LAYAR INI sudah terbuka sejak render pertama.
//
// Bedanya dengan <StreakPill/>: pil itu menampilkan ANGKA streak (jadi cuma
// cocok untuk layar yang memang punya streak harian, mis. Habits), sedangkan
// tombol ini cuma pintu — dipakai layar yang pencapaiannya berupa rekor atau
// hitungan minggu, yang tak punya satu angka streak untuk dipamerkan.
// Bentuknya sengaja EmojiButton, sama persis dengan tombol pojok kanan lain
// (🗄️ arsip, 📖 riwayat, 👣 rekor langkah).
export function RewardButton({
  category,
}: {
  category: RewardCategoryKey;
}) {
  const router = useRouter();
  return (
    <EmojiButton
      emoji="🔥"
      onPress={() =>
        router.push({ pathname: '/reward-category', params: { cat: category } })
      }
    />
  );
}
