import { Image, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';

// 🎬 Pembuka app — animasi vix satu layar penuh.
//
// Dipakai layar BOOT (app/_layout.tsx): selama font Inter dimuat & sesi
// tersimpan dicek, yang tampil bukan lagi spinner kecil di tengah layar krem,
// melainkan animasi merek ini. Waktunya memang sama, rasanya yang berbeda.
//
// Berkasnya GIF (assets/gif/vix_splash_animation.gif, 720×1280 ≈ 9:16 persis
// seperti layar iPhone 15). iOS memainkan GIF sendiri lewat <Image>, jadi
// tidak ada pustaka animasi baru & tidak ada modul native tambahan.
//
// Latarnya MAIN_DARK: sudut animasinya memang hijau tergelap itu, dan splash
// bawaan di app.json juga sudah disetel warna yang sama — jadi perpindahan
// dari splash sistem ke animasi ini tidak pernah berkedip putih di tengahnya.
export function VixSplash() {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('@/assets/gif/vix_splash_animation.gif')}
        style={styles.gambar}
        // 'cover': layar mana pun terisi penuh tanpa pita hitam. Bagian yang
        // terpotong cuma tepi atas/bawah, dan di sana memang tidak ada isi.
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Color.MAIN_DARK },
  gambar: { width: '100%', height: '100%' },
});
