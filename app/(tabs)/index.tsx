import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';

// Nama sapaan di Home — ganti di sini kalau mau ubah.
const OWNER_NAME = 'Imanuel Victory Rumayar';

// Daftar fitur di Home. Tambah fitur baru = tambah 1 baris di sini.
const FEATURES: {
  key: string;
  label: string;
  icon: 'checklist';
  route: Href;
}[] = [
  { key: 'tasks', label: 'Task Harian', icon: 'checklist', route: '/tasks' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.brandRow}>
        <VixText heading="header" additionalStyle={styles.brand}>
          vix <VixText heading="label">Super App</VixText>
        </VixText>
        <Pressable onPress={logout} hitSlop={10}>
          <IconSymbol
            name="rectangle.portrait.and.arrow.right"
            size={22}
            color={Color.MAIN}
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.welcomeCard}>
          <VixText heading="paragraph" additionalStyle={styles.welcomeSmall}>
            Selamat datang,
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.welcomeName}>
            {OWNER_NAME.toUpperCase()}
          </VixText>
        </View>

        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          Fitur
        </VixText>
        <View style={styles.grid}>
          {FEATURES.map((feature) => (
            <View key={feature.key} style={styles.gridItem}>
              <Pressable
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
                onPress={() => router.push(feature.route)}>
                <IconSymbol name={feature.icon} size={30} color={Color.TEXT_REVERSE} />
              </Pressable>
              <VixText heading="label" additionalStyle={styles.tileLabel}>
                {feature.label}
              </VixText>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brand: { color: Color.MAIN },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  welcomeCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
  },
  welcomeSmall: { color: Color.TEXT_ON_DARK_MUTED },
  welcomeName: {
    color: Color.TEXT_REVERSE,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  sectionTitle: { marginBottom: 14 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridItem: { width: '21.5%', alignItems: 'center' },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePressed: { backgroundColor: Color.MAIN_DARK },
  tileLabel: { textAlign: 'center', marginTop: 8 },
});
