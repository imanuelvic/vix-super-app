import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { openNdcMinistry, openYouVersion } from '@/lib/spiritual';

/**
 * App luar yang dituju tombolnya — sengaja BEDA per layar, karena
 * keperluannya memang beda:
 *   ndc        → renungan harian NDC, bahan Tulis Revive ✍️
 *   youversion → Alkitabnya sendiri, yang dibuka saat Baca Alkitab 📖
 */
const APPS = {
  ndc: { label: '📱 Buka NDC Ministry', open: openNdcMinistry },
  youversion: { label: '📖 Buka YouVersion', open: openYouVersion },
};

// Pembuka layar rohani: satu kalimat reminder yang diundi per hari, lalu
// tombol ke app luar. Dipakai bersama oleh Tulis Revive ✍️ dan Baca
// Alkitab 📖 — dulu blok ini cuma ada di Revive dan disalin manual.
export function SpiritualIntro({
  reminder,
  app = 'ndc',
}: {
  reminder: string;
  app?: keyof typeof APPS;
}) {
  const tujuan = APPS[app];
  return (
    <>
      <View style={styles.reminderCard}>
        <VixText heading="label" additionalStyle={styles.reminderLabel}>
          🕊️ Reminder
        </VixText>
        <VixText heading="paragraph" additionalStyle={styles.reminderText}>
          {reminder}
        </VixText>
      </View>
      <PressableScale style={styles.appButton} onPress={tujuan.open}>
        <View style={styles.appButtonMain}>
          <VixText heading="bold" additionalStyle={styles.appButtonText}>
            {tujuan.label}
          </VixText>
        </View>
        <IconSymbol name="chevron.right" size={20} color={Color.TEXT_REVERSE} />
      </PressableScale>
    </>
  );
}

const styles = StyleSheet.create({
  reminderCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.SPIRITUAL_DARK,
    padding: 14,
    gap: 4,
    marginBottom: 14,
  },
  reminderLabel: { color: Color.SPIRITUAL_DARK },
  reminderText: { color: Color.TEXT_TITLE },
  appButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Color.SPIRITUAL_DARK,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
  },
  appButtonMain: { flex: 1, gap: 1 },
  appButtonText: { color: Color.TEXT_REVERSE },
});
