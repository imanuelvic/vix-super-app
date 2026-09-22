import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { ReminderCard } from '@/components/common/ReminderCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useDailyDismiss } from '@/hooks/useDailyDismiss';
import { addDays, mondayOf } from '@/lib/financeInsight';
import { dayId, formatWeekRange, MONTH_NAMES, monthId } from '@/lib/format';

// 📅 Pintu ke Weekly & Monthly Review (app/finance-review.tsx).
//
// Otomatis: Senin & Selasa muncul kartu pengingat "Weekly Money Review minggu
// lalu siap" (bisa ditutup, kembali minggu depan); tanggal 1 s.d. 5 muncul
// pengingat Monthly Review bulan lalu. Di luar itu keduanya tetap bisa dibuka
// dari dua baris di bawahnya, jadi review lama tak pernah hilang.
export function ReviewCard({ now }: { now: Date }) {
  const router = useRouter();
  const lastMonday = addDays(mondayOf(now), -7);
  const weekKey = dayId(lastMonday);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevId = monthId(prev.getFullYear(), prev.getMonth());
  const weeklyDue = now.getDay() === 1 || now.getDay() === 2;
  const monthlyDue = now.getDate() <= 5;
  const weekly = useDailyDismiss('finance:weekly-review', weekKey);
  const monthly = useDailyDismiss('finance:monthly-review', prevId);

  const bukaMinggu = () =>
    router.push({ pathname: '/finance-review', params: { kind: 'week', day: weekKey } });
  const bukaBulan = () =>
    router.push({ pathname: '/finance-review', params: { kind: 'month', id: prevId } });

  return (
    <>
      {weeklyDue && !weekly.dismissed && (
        <ReminderCard
          bg={Color.FINANCE}
          fg={Color.FINANCE_DARK}
          title="📅 Weekly Money Review siap"
          texts={[`Bagaimana minggu kamu? (${formatWeekRange(lastMonday)})`]}
          onPress={bukaMinggu}
          onClose={weekly.dismiss}
          corner="→"
        />
      )}
      {monthlyDue && !monthly.dismissed && (
        <ReminderCard
          bg={Color.FINANCE}
          fg={Color.FINANCE_DARK}
          title={`📆 Monthly Review ${MONTH_NAMES[prev.getMonth()]} siap`}
          texts={['Total, budget adherence, kategori yang lewat, dan fokus bulan ini.']}
          onPress={bukaBulan}
          onClose={monthly.dismiss}
          corner="→"
        />
      )}
      <View style={styles.card}>
        <Baris label="📅 Weekly Money Review" sub={formatWeekRange(lastMonday)} onPress={bukaMinggu} />
        <View style={styles.sep} />
        <Baris
          label="📆 Monthly Review"
          sub={`${MONTH_NAMES[prev.getMonth()]} ${prev.getFullYear()}`}
          onPress={bukaBulan}
        />
      </View>
    </>
  );
}

function Baris({ label, sub, onPress }: { label: string; sub: string; onPress: () => void }) {
  return (
    <PressableScale style={styles.row} onPress={onPress}>
      <View style={styles.rowMain}>
        <VixText heading="bold" additionalStyle={styles.rowLabel}>
          {label}
        </VixText>
        <VixText heading="label">{sub}</VixText>
      </View>
      <IconSymbol name="chevron.right" size={18} color={Color.TEXT_LABEL} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: CARD_GAP,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowMain: { flex: 1, gap: 1 },
  rowLabel: { color: Color.TEXT_TITLE },
  sep: { height: 1, backgroundColor: Color.BORDER },
});
