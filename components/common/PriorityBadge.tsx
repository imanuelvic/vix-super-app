import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Label prioritas P1/P2/P3 — merah / kuning / abu. Dipakai Career (roadmap
// Fulltime) dan Reminder Prioritas; bentuk & warnanya harus sama di keduanya,
// jadi diatur dari satu tempat.
export function PriorityBadge({ priority }: { priority: 1 | 2 | 3 }) {
  return (
    <View
      style={[
        styles.badge,
        priority === 1 ? styles.p1 : priority === 2 ? styles.p2 : styles.p3,
      ]}>
      <VixText heading="label" additionalStyle={styles.text}>
        P{priority}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  p1: { backgroundColor: Color.DANGER },
  p2: { backgroundColor: Color.WARNING },
  p3: { backgroundColor: Color.TEXT_PLACEHOLDER },
  text: { color: Color.TEXT_REVERSE },
});
