import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  addTask,
  deleteTask,
  setTaskDone,
  subscribeTasks,
  type Task,
} from '@/lib/tasks';

export default function TasksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
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
      await addTask(user.uid, value);
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

  const remaining = tasks.filter((t) => !t.done).length;

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
            Task
          </VixText>
          <VixText heading="label">
            {remaining} belum selesai · {tasks.length} total
          </VixText>
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Tambah task baru…"
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
            data={tasks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <VixText heading="label">Belum ada task. Tambahkan di atas 👆</VixText>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => handleToggle(item)}>
                  <View style={[styles.circle, item.done && styles.circleDone]}>
                    {item.done && (
                      // Mint terang butuh ikon gelap agar kontras.
                      <IconSymbol name="checkmark" size={16} color={Color.MAIN_DARK} />
                    )}
                  </View>
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
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  title: { color: Color.MAIN },
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
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Color.MAIN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: Color.MAIN_LIGHT },
  taskText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  taskTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  center: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
});
