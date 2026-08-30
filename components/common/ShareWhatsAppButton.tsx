import { Color } from '@/assets/style/color';
import { PrimaryButton } from '@/components/common/PrimaryButton';

// Tombol "💬 Share ke WhatsApp" — Catatan Revive 📖 & Catatan Khotbah ⛪.
//
// Dulu ditulis tangan dua kali dengan PressableScale sendiri-sendiri, dan
// keduanya memang sudah berbeda: tingginya 12 di Revive, 14 di Khotbah. Di sini
// ia PrimaryButton biasa yang cuma berganti warna, jadi bentuknya persis sama
// dengan tombol Simpan & Connect ke CORE yang berdiri di sebelahnya.
export function ShareWhatsAppButton({ onPress }: { onPress: () => void }) {
  return (
    <PrimaryButton
      label="💬 Share ke WhatsApp"
      background={Color.WHATSAPP}
      onPress={onPress}
    />
  );
}
