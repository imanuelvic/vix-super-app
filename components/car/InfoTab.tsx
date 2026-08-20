import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { SummaryCard } from '@/components/common/SummaryCard';
import { InfoRow } from '@/components/common/InfoRow';
import { VixText } from '@/components/common/VixText';
import { CAR_INFO, nextStnk } from '@/lib/car';
import { formatDate } from '@/lib/format';

// Tips ala mekanik — hal kecil yang bikin mobil awet.
const TIPS: string[] = [
  '🔥 Skyactiv kompresi tinggi (13:1) — minimal RON 90, idealnya Pertamax RON 92. Jangan Premium.',
  '🌡️ Panaskan mesin cukup 30–60 detik, lalu jalan pelan — idle lama justru boros & buang waktu.',
  '🅿️ Parkir hindari terik langsung terus-menerus — jaga cat Soul Red & karet-karet pintu.',
  '🛞 Cek tekanan ban tiap isi bensin (standar Mazda 2: ±33 psi) — ban kurang angin = boros + cepat aus.',
  '🔋 Mobil jarang dipakai? Panaskan / bawa jalan minimal seminggu sekali biar aki tidak tekor.',
  '💧 Jangan tunda kalau ada bunyi aneh, getaran, atau rembesan — kerusakan kecil murah, telat = mahal.',
];

// Tab Info: identitas mobil + pengingat STNK tahunan + tips perawatan.
export function InfoTab() {
  const { date: stnkDate, daysUntil } = nextStnk(new Date());
  const stnkSoon = daysUntil <= 30;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Kartu identitas mobil */}
      <SummaryCard center>
        <VixText additionalStyle={styles.heroEmoji}>🚗</VixText>
        <VixText heading="subheader" additionalStyle={styles.heroName}>
          {CAR_INFO.name}
        </VixText>
        <VixText heading="label" additionalStyle={styles.heroSub}>
          {CAR_INFO.color} · {CAR_INFO.plate}
        </VixText>
      </SummaryCard>

      {/* Pengingat STNK */}
      <View style={[styles.stnkCard, stnkSoon && styles.stnkSoon]}>
        <VixText heading="bold" additionalStyle={styles.stnkTitle}>
          📋 STNK berikutnya: {formatDate(stnkDate)}
        </VixText>
        <VixText
          heading="label"
          additionalStyle={stnkSoon ? styles.stnkWarnText : undefined}>
          {stnkSoon
            ? `⚠️ Tinggal ${daysUntil} hari lagi — siapkan dananya!`
            : `${daysUntil} hari lagi.`}
        </VixText>
      </View>

      {/* Detail identitas */}
      <View style={styles.detailCard}>
        <InfoRow label="Plat nomor" value={CAR_INFO.plate} />
        <InfoRow label="Nama di STNK" value={CAR_INFO.ownerName} />
        <InfoRow label="Tahun produksi" value={CAR_INFO.productionYear} />
        <InfoRow label="Bahan bakar" value={CAR_INFO.fuel} />
        <InfoRow label="Diserahkan ke Imanuel" value={CAR_INFO.handedOver} />
      </View>

      {/* Tips perawatan */}
      <VixText heading="title" additionalStyle={styles.sectionTitle}>
        Tips Sayang Mobil 🔧❤️
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
  heroEmoji: { fontSize: 44, lineHeight: 54 },
  heroName: { color: Color.TEXT_REVERSE, textAlign: 'center' },
  heroSub: { color: Color.TEXT_ON_DARK_MUTED },
  stnkCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 2,
    marginBottom: 10,
  },
  stnkSoon: {
    backgroundColor: Color.WARNING_TRANSPARENT,
    borderColor: Color.WARNING,
  },
  stnkTitle: { color: Color.TEXT_TITLE },
  stnkWarnText: { color: Color.WARNING },
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
