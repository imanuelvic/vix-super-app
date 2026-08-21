import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { InfoRow } from '@/components/common/InfoRow';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { openExternalUrl } from '@/lib/linking';
import { RESIDENCE_INFO } from '@/lib/residence';

// Tips ringan biar rumah kontrakan awet & nyaman.
const TIPS: string[] = [
  '⚡ Daya 5.500 watt — aman untuk AC + water heater, tapi hindari nyalakan alat berat bersamaan biar tidak jeglek.',
  '💧 Catat token & meteran air tiap isi ulang — biar kelihatan pola pemakaian & tidak kaget di akhir bulan.',
  '👨🏽‍🔧 Water heater Rinnai REU-5CFM: servis/cek berkala biar awet & aman dari gas.',
  '🏘️ Iuran lingkungan dibayar per tahun — sisihkan dananya dari awal.',
  '🧾 Simpan bukti bayar (sewa, iuran, servis) — memudahkan saat perpanjang kontrak.',
];

// Tab Info: identitas rumah kontrakan + kontrak + tips.
export function InfoTab() {
  function openMaps() {
    openExternalUrl(RESIDENCE_INFO.mapsUrl);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Kartu identitas rumah */}
      <View style={styles.heroCard}>
        <VixText additionalStyle={styles.heroEmoji}>🏠</VixText>
        <VixText heading="subheader" additionalStyle={styles.heroName}>
          {RESIDENCE_INFO.name}
        </VixText>
        <VixText heading="label" additionalStyle={styles.heroSub}>
          Pemilik: {RESIDENCE_INFO.owner}
        </VixText>
      </View>

      {/* Alamat — seluruh kartunya bisa ditekan untuk membuka titik rumah di
          Google Maps (buka aplikasi Maps kalau terpasang, kalau tidak lewat
          browser — diurus openExternalUrl). */}
      <PressableScale style={styles.addressCard} onPress={openMaps}>
        <VixText heading="bold" additionalStyle={styles.addressTitle}>
          📍 Alamat
        </VixText>
        <VixText heading="label" additionalStyle={styles.addressText}>
          {RESIDENCE_INFO.address}
        </VixText>
        {/* Penanda bahwa kartu ini bisa ditekan — tanpa ini orang tidak tahu */}
        <VixText heading="bold" additionalStyle={styles.addressLink}>
          🗺️ Buka di Google Maps →
        </VixText>
      </PressableScale>

      {/* Detail rumah */}
      <View style={styles.detailCard}>
        <InfoRow label="Luas" value={RESIDENCE_INFO.wide} />
        <InfoRow label="Listrik" value={RESIDENCE_INFO.electricity} />
        <InfoRow label="Air" value={RESIDENCE_INFO.water} />
        <InfoRow label="Mulai sewa" value={RESIDENCE_INFO.rentalDate} />
        <InfoRow label="Iuran lingkungan" value={RESIDENCE_INFO.managementFeePeriod} />
      </View>

      {/* Tips */}
      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        Tips Rumah 🏠✨
      </VixText>
      <View style={styles.tipsCard}>
        {TIPS.map((tip) => (
          <VixText key={tip} heading="paragraph" additionalStyle={styles.tip}>
            {tip}
          </VixText>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  heroCard: {
    backgroundColor: Color.HOUSE_DARK,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  heroEmoji: { fontSize: 44, lineHeight: 54 },
  heroName: { color: Color.TEXT_REVERSE, textAlign: 'center' },
  heroSub: { color: Color.TEXT_ON_DARK_MUTED },
  addressCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 4,
    marginBottom: 10,
  },
  addressTitle: { color: Color.TEXT_TITLE },
  addressText: { color: Color.TEXT_PARAGRAPH },
  // Baris ajakan buka Maps — warna utama biar jelas ini yang bisa ditekan.
  addressLink: { color: Color.MAIN, marginTop: 2 },
  detailCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 14,
  },
  sectionTitle: { marginBottom: 10 },
  tipsCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 10,
  },
  tip: { color: Color.TEXT_PARAGRAPH },
});
