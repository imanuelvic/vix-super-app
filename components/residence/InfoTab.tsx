import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
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

      {/* Alamat */}
      <View style={styles.addressCard}>
        <VixText heading="bold" additionalStyle={styles.addressTitle}>
          📍 Alamat
        </VixText>
        <VixText heading="label" additionalStyle={styles.addressText}>
          {RESIDENCE_INFO.address}
        </VixText>
      </View>

      {/* Detail rumah */}
      <View style={styles.detailCard}>
        <InfoRow label="Luas" value={RESIDENCE_INFO.wide} />
        <InfoRow label="Listrik" value={RESIDENCE_INFO.electricity} />
        <InfoRow label="Air" value={RESIDENCE_INFO.water} />
        <InfoRow label="Mulai sewa" value={RESIDENCE_INFO.rentalDate} />
        <InfoRow label="Iuran lingkungan" value={RESIDENCE_INFO.managementFeePeriod} />
        <InfoRow label="Water heater" value={RESIDENCE_INFO.waterHeater} />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <VixText heading="label">{label}</VixText>
      <VixText heading="bold" additionalStyle={styles.infoValue}>
        {value}
      </VixText>
    </View>
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
  detailCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  infoValue: { color: Color.TEXT_TITLE, flexShrink: 1, textAlign: 'right' },
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
