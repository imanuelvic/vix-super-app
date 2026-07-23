import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  addTask,
  deleteTask,
  setTaskDone,
  subscribeTasks,
  TASK_CATEGORIES,
  type Task,
  type TaskCategory,
} from '@/lib/tasks';

export default function TasksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('personal');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Real-time: perubahan dari perangkat lain langsung muncul di sini.
    const unsubscribe = subscribeTasks(
      user.uid,
      (next) => {
        setTasks(next);
        setError(null);
        setLoading(false);
      },
      () => {
        // Listener gagal (offline / ditolak rules) — beri tahu user,
        // jangan biarkan loading berputar selamanya.
        setError('Gagal memuat task. Cek koneksi internet.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user]);

  async function handleAdd() {
    const value = title.trim();
    if (!value || !user) return;
    setTitle('');
    setError(null);
    try {
      // Task baru masuk ke kategori yang sedang aktif.
      await addTask(user.uid, value, category);
    } catch {
      setTitle(value); // kembalikan teks kalau gagal
      setError('Gagal menambah task. Coba lagi.');
    }
  }

  async function handleToggle(item: Task) {
    if (!user) return;
    setError(null);
    try {
      await setTaskDone(user.uid, item.id, !item.done);
    } catch {
      setError('Gagal menyimpan perubahan. Coba lagi.');
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    setError(null);
    try {
      await deleteTask(user.uid, id);
    } catch {
      setError('Gagal menghapus task. Coba lagi.');
    }
  }

  // Satu listener untuk semua task; filter kategori cukup di sisi app.
  const shown = tasks.filter((t) => t.category === category);
  const remaining = shown.filter((t) => !t.done).length;
  const activeMeta = TASK_CATEGORIES.find((c) => c.key === category)!;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={8}>
          <IconSymbol name="chevron.left" size={22} color={Color.MAIN} />
          <VixText heading="bold" additionalStyle={styles.backText}>
            Home
          </VixText>
        </Pressable>

        <View style={styles.header}>
          <VixText heading="header" additionalStyle={styles.title}>
            Task ✅
          </VixText>
          <VixText heading="label">
            {remaining} belum selesai · {shown.length} total
          </VixText>
        </View>

        {/* Ganti kategori = ganti to-do list (geser untuk lihat semua) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}>
          {TASK_CATEGORIES.map((c) => {
            // Badge: jumlah task kategori ini yang belum selesai.
            const count = tasks.filter(
              (t) => t.category === c.key && !t.done,
            ).length;
            return (
              <View key={c.key} style={styles.chipHolder}>
                <Chip
                  label={`${c.icon} ${c.label}`}
                  active={category === c.key}
                  onPress={() => setCategory(c.key)}
                />
                {count > 0 && (
                  <View style={styles.chipBadge}>
                    <VixText
                      heading="label"
                      additionalStyle={styles.chipBadgeText}>
                      {count > 9 ? '9+' : count}
                    </VixText>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={`Tambah task ${activeMeta.label}…`}
            placeholderTextColor={Color.TEXT_PLACEHOLDER}
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable style={styles.addButton} onPress={handleAdd}>
            <IconSymbol name="plus" size={24} color={Color.TEXT_REVERSE} />
          </Pressable>
        </View>

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Color.MAIN} />
          </View>
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <VixText heading="label">
                  Belum ada task {activeMeta.icon} {activeMeta.label}. Tambahkan
                  di atas 👆
                </VixText>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => handleToggle(item)}>
                  <CheckCircle checked={item.done} />
                  <VixText
                    heading="paragraph"
                    additionalStyle={[styles.taskText, item.done && styles.taskTextDone]}>
                    {item.title}
                  </VixText>
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  hitSlop={10}>
                  <IconSymbol name="xmark" size={18} color={Color.TEXT_PLACEHOLDER} />
                </Pressable>
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  flex: { flex: 1 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  backText: { color: Color.MAIN },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  title: { color: Color.MAIN },
  chipScroll: { flexGrow: 0, marginBottom: 12 },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 6, // ruang untuk badge yang menonjol di atas chip
  },
  chipHolder: {},
  chipBadge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: Color.DANGER,
    borderWidth: 2,
    borderColor: Color.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipBadgeText: { color: Color.TEXT_REVERSE },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Color.TEXT_TITLE,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  addButton: {
    width: 48,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 8 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 12,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  taskTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
});
