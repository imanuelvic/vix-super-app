import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { formatDayMonth, MONTH_NAMES } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import {
  addRecurringTasks,
  addTask,
  completeTasks,
  deleteTask,
  generateRecurringDays,
  MAX_RECURRING,
  rolloverTasks,
  setTaskDone,
  subscribeTasks,
  TASK_CATEGORIES,
  updateTask,
  type Task,
  type TaskCategory,
} from '@/lib/tasks';

// Task ✅ — planner harian: semua tanggal sebulan tampil berurutan,
// task menempel di harinya. Task kemarin yang belum selesai otomatis
// pindah ke hari ini (rollover), jadi bulan lalu selalu kosong.
export default function TasksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // Inset bawah Android/iOS — biar FAB tidak tabrakan tombol navigasi HP.
  const insets = useSafeAreaInsets();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<TaskCategory>('personal');
  const [error, setError] = useState<string | null>(null);

  // Bulan yang dilihat — tidak bisa mundur sebelum bulan berjalan.
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0–11

  // Sheet tambah/edit task.
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fDate, setFDate] = useState(new Date());
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // FAB speed-dial ⋯: submenu bulat kecil muncul di atas tombolnya.
  const [fabOpen, setFabOpen] = useState(false);
  // Sheet cari / task berulang (satu modal, ganti isi — iOS tidak bisa
  // modal bertumpuk).
  const [sheetView, setSheetView] = useState<'search' | 'recur' | null>(null);
  const [query, setQuery] = useState('');
  const [rTitle, setRTitle] = useState('');
  const [rFreq, setRFreq] = useState<'weekly' | 'monthly'>('weekly');
  const [rStart, setRStart] = useState(new Date());
  const [rEnd, setREnd] = useState(new Date());
  const [rError, setRError] = useState<string | null>(null);
  const [rBusy, setRBusy] = useState(false);

  // Hari ini sebagai state + dicek tiap menit: begitu tanggal berganti,
  // tanggal lama hilang dari tampilan dan rollover langsung berjalan —
  // walau app dibiarkan terbuka semalaman.
  const [todayId, setTodayId] = useState(() => dayDocId(now));
  const rolling = useRef(false); // cegah rollover dobel saat batch berjalan

  useEffect(() => {
    const timer = setInterval(() => {
      const current = dayDocId(new Date());
      setTodayId((prev) => (prev === current ? prev : current));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeTasks(
      user.uid,
      (next) => {
        setTasks(next);
        setError(null);
        setLoading(false);
      },
      () => {
        setError('Gagal memuat task. Cek koneksi internet.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user]);

  // Beres-beres harian: task lama yang belum selesai → pindah ke hari ini;
  // yang sudah selesai & tanggalnya lewat → dihapus otomatis.
  useEffect(() => {
    if (!user || rolling.current) return;
    const past = tasks.filter((t) => t.dayId < todayId);
    if (past.length === 0) return;
    const toMove = past.filter((t) => !t.done);
    const toDelete = past.filter((t) => t.done);
    rolling.current = true;
    rolloverTasks(user.uid, toMove, toDelete, todayId)
      .catch(() => setError('Gagal membereskan task lama. Coba buka ulang.'))
      .finally(() => {
        rolling.current = false;
      });
  }, [user, tasks, todayId]);

  const atMinMonth =
    year === now.getFullYear() && month === now.getMonth();

  function shiftMonth(delta: number) {
    // Mundur ke bulan sebelum bulan berjalan tidak ada artinya —
    // semua task lama sudah rollover ke hari ini.
    if (delta < 0 && atMinMonth) return;
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const shown = tasks.filter((t) => t.category === category);
  const remaining = shown.filter((t) => !t.done).length;
  const activeMeta = TASK_CATEGORIES.find((c) => c.key === category)!;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  async function handleToggle(item: Task) {
    if (!user) return;
    setError(null);
    try {
      await setTaskDone(user.uid, item.id, !item.done);
    } catch {
      setError('Gagal menyimpan perubahan. Coba lagi.');
    }
  }

  function openAdd(date: Date) {
    setEditing('new');
    setFTitle('');
    setFDate(date);
    setFormError(null);
  }

  function openEdit(item: Task) {
    setEditing(item);
    setFTitle(item.title);
    // dayId "YYYY-MM-DD" → Date lokal.
    const [y, m, d] = item.dayId.split('-').map(Number);
    setFDate(new Date(y, m - 1, d));
    setFormError(null);
  }

  async function handleSaveSheet() {
    if (!user || !editing || busy) return;
    const title = fTitle.trim();
    if (!title) {
      setFormError('Isi task-nya dulu ya.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editing === 'new') {
        await addTask(user.uid, title, category, dayDocId(fDate));
      } else {
        // Ganti tanggal = pindah hari (pengganti drag & drop).
        await updateTask(user.uid, editing.id, {
          title,
          dayId: dayDocId(fDate),
        });
      }
      setEditing(null);
    } catch {
      setFormError('Gagal menyimpan. Cek koneksi internet.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await deleteTask(user.uid, editing.id);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  function dayIdToDate(dayId: string): Date {
    const [y, m, d] = dayId.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function openRecur() {
    setRTitle('');
    setRFreq('weekly');
    const start = new Date();
    setRStart(start);
    // Default rentang: satu bulan ke depan.
    setREnd(new Date(start.getFullYear(), start.getMonth() + 1, start.getDate()));
    setRError(null);
    setSheetView('recur');
  }

  // Hasil pencarian: semua kategori & tanggal, maksimal 20 teratas.
  const results = query.trim()
    ? tasks
        .filter((t) =>
          t.title.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .slice(0, 20)
    : [];

  const recurDays = generateRecurringDays(rStart, rEnd, rFreq);

  async function handleCreateRecurring() {
    if (!user || rBusy) return;
    if (!rTitle.trim()) {
      setRError('Isi task-nya dulu ya.');
      return;
    }
    if (recurDays.length === 0) {
      setRError('Rentang tanggalnya tidak valid.');
      return;
    }
    if (recurDays.length > MAX_RECURRING) {
      setRError(`Maksimal ${MAX_RECURRING} task — persempit rentangnya.`);
      return;
    }
    setRBusy(true);
    setRError(null);
    try {
      await addRecurringTasks(user.uid, rTitle, category, recurDays);
      setSheetView(null);
    } catch {
      setRError('Gagal membuat task. Cek koneksi internet.');
    } finally {
      setRBusy(false);
    }
  }

  function openTaskFromSearch(t: Task) {
    setSheetView(null);
    // Tunggu sheet menutup dulu — iOS tidak suka modal berganti seketika.
    setTimeout(() => openEdit(t), 350);
  }

  // Sapu bersih: semua task HARI INI (semua kategori) ditandai selesai.
  async function handleCompleteToday() {
    if (!user) return;
    setFabOpen(false);
    const todays = tasks.filter((t) => t.dayId === todayId && !t.done);
    if (todays.length === 0) return;
    try {
      await completeTasks(user.uid, todays);
    } catch {
      setError('Gagal menandai selesai. Coba lagi.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
        {/* Navigasi bulan — mentok di bulan berjalan */}
        <View style={styles.monthRow}>
          <Pressable
            onPress={() => shiftMonth(-1)}
            hitSlop={10}
            disabled={atMinMonth}>
            <IconSymbol
              name="chevron.left"
              size={20}
              color={atMinMonth ? Color.BORDER : Color.MAIN}
            />
          </Pressable>
          <VixText heading="bold" additionalStyle={styles.monthText}>
            {MONTH_NAMES[month]} {year}
          </VixText>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={10}>
            <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
          </Pressable>
          <VixText heading="label" additionalStyle={styles.remainingText}>
            {remaining} belum selesai
          </VixText>
        </View>
      </View>

      {/* Ganti kategori = ganti to-do list */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}>
        {TASK_CATEGORIES.map((c) => {
          // Badge: task kategori ini yang belum selesai HARI INI saja —
          // task tanggal depan belum jadi "utang", jangan bikin panik.
          const count = tasks.filter(
            (t) => t.category === c.key && !t.done && t.dayId === todayId,
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
                  <VixText heading="label" additionalStyle={styles.chipBadgeText}>
                    {count > 9 ? '9+' : count}
                  </VixText>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

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
        <ScrollView contentContainerStyle={styles.listContent}>
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(year, month, i + 1);
            const dayId = dayDocId(date);
            // Tanggal yang sudah terlewat langsung hilang dari tampilan.
            if (dayId < todayId) return null;
            const isToday = dayId === todayId;
            // Urutan dalam satu hari: yang dibuat duluan di atas.
            const dayTasks = shown
              .filter((t) => t.dayId === dayId)
              .reverse();
            return (
              <View
                key={dayId}
                style={[styles.dayBlock, isToday && styles.dayBlockToday]}>
                <View style={styles.dayHeader}>
                  <VixText
                    heading="bold"
                    additionalStyle={isToday ? styles.dayTitleToday : styles.dayTitle}>
                    {formatDayMonth(date)}
                    {isToday ? ' • HARI INI' : ''}
                  </VixText>
                  <Pressable onPress={() => openAdd(date)} hitSlop={10}>
                    <IconSymbol name="plus" size={18} color={Color.MAIN} />
                  </Pressable>
                </View>
                {dayTasks.map((item) => (
                  <View key={item.id} style={styles.taskRow}>
                    <Pressable
                      style={styles.taskMain}
                      onPress={() => handleToggle(item)}>
                      <CheckCircle checked={item.done} size={22} />
                      <VixText
                        heading="paragraph"
                        additionalStyle={[
                          styles.taskText,
                          item.done && styles.taskTextDone,
                        ]}>
                        {item.title}
                      </VixText>
                    </Pressable>
                    {/* Tap ✎ → edit / pindah hari / hapus */}
                    <Pressable onPress={() => openEdit(item)} hitSlop={10}>
                      <IconSymbol
                        name="pencil"
                        size={16}
                        color={Color.TEXT_PLACEHOLDER}
                      />
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Backdrop transparan: tap di luar menutup speed-dial */}
      {fabOpen && (
        <Pressable
          style={styles.fabBackdrop}
          onPress={() => setFabOpen(false)}
        />
      )}

      {/* FAB speed-dial ⋯ — submenu bulat kecil muncul di atasnya.
          bottom dinaikkan sesuai inset HP biar tidak ketiban tombol back Android. */}
      <View
        style={[styles.fabArea, { bottom: insets.bottom + 24 }]}
        pointerEvents="box-none">
        {fabOpen && (
          <>
            <FabAction
              label="Beres semua hari ini"
              icon="checkmark"
              onPress={handleCompleteToday}
            />
            <FabAction
              label="Task berulang"
              icon="repeat"
              onPress={() => {
                setFabOpen(false);
                openRecur();
              }}
            />
            <FabAction
              label="Cari task"
              icon="magnifyingglass"
              onPress={() => {
                setFabOpen(false);
                setQuery('');
                setSheetView('search');
              }}
            />
            <FabAction
              label="Tambah hari ini"
              icon="plus"
              onPress={() => {
                setFabOpen(false);
                openAdd(new Date());
              }}
            />
          </>
        )}
        <Pressable style={styles.fab} onPress={() => setFabOpen((o) => !o)}>
          <IconSymbol
            name={fabOpen ? 'xmark' : 'ellipsis'}
            size={26}
            color={Color.TEXT_REVERSE}
          />
        </Pressable>
      </View>

      {/* Sheet cari / task berulang */}
      <SheetModal
        visible={sheetView !== null}
        title={sheetView === 'search' ? 'Cari Task 🔍' : 'Task Berulang 🔁'}
        onClose={() => setSheetView(null)}>
        {sheetView === 'search' && (
          <>
            <FormInput
              style={styles.formGap}
              placeholder="Cari Task"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            <ScrollView
              style={styles.searchList}
              keyboardShouldPersistTaps="handled">
              {results.map((t) => {
                const meta = TASK_CATEGORIES.find((c) => c.key === t.category);
                return (
                  <Pressable
                    key={t.id}
                    style={styles.searchRow}
                    onPress={() => openTaskFromSearch(t)}>
                    <VixText
                      heading="bold"
                      numberOfLines={1}
                      additionalStyle={styles.searchTitle}>
                      {t.done ? '✅ ' : ''}
                      {t.title}
                    </VixText>
                    <VixText heading="label">
                      {meta?.icon} {meta?.label} ·{' '}
                      {formatDayMonth(dayIdToDate(t.dayId))}
                    </VixText>
                  </Pressable>
                );
              })}
              {query.trim() !== '' && results.length === 0 && (
                <VixText heading="label" additionalStyle={styles.searchEmpty}>
                  Tidak ada task dengan judul itu.
                </VixText>
              )}
            </ScrollView>
          </>
        )}

        {sheetView === 'recur' && (
          <>
            <FormInput
              style={styles.formGap}
              placeholder={`Task`}
              value={rTitle}
              onChangeText={setRTitle}
              editable={!rBusy}
            />
            <View style={styles.freqRow}>
              <Chip
                label="🗓️ Mingguan"
                active={rFreq === 'weekly'}
                onPress={() => setRFreq('weekly')}
                additionalStyle={styles.freqChip}
              />
              <Chip
                label="📅 Bulanan"
                active={rFreq === 'monthly'}
                onPress={() => setRFreq('monthly')}
                additionalStyle={styles.freqChip}
              />
            </View>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Mulai dari
            </VixText>
            <View style={styles.formGap}>
              <DateField key="r-start" value={rStart} onChange={setRStart} />
            </View>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              Sampai
            </VixText>
            <View style={styles.formGap}>
              <DateField key="r-end" value={rEnd} onChange={setREnd} />
            </View>
            {/* Pratinjau: berapa task yang akan dibuat */}
            <VixText heading="label" additionalStyle={styles.recurPreview}>
              {recurDays.length === 0
                ? 'Rentang tanggal belum valid.'
                : recurDays.length > MAX_RECURRING
                  ? `Lebih dari ${MAX_RECURRING} task — persempit rentangnya.`
                  : `Akan membuat ${recurDays.length} task pada ${activeMeta.label} ${activeMeta.icon}.`}
            </VixText>
            {rError && (
              <VixText heading="label" additionalStyle={styles.sheetError}>
                {rError}
              </VixText>
            )}
            <PrimaryButton
              label="Buat Task Berulang"
              busy={rBusy}
              onPress={handleCreateRecurring}
            />
          </>
        )}
      </SheetModal>

      {/* Sheet tambah/edit task */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Task' : 'Edit Task'}
        subtitle={`${activeMeta.icon} ${activeMeta.label}`}
        onClose={() => setEditing(null)}>
        <FormInput
          style={styles.formGap}
          placeholder={`Task`}
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal
        </VixText>
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal reset tiap ganti task */}
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>
        {formError && (
          <VixText heading="label" additionalStyle={styles.error}>
            {formError}
          </VixText>
        )}
        {/* Konfirmasi hapus inline — iOS tidak bisa modal di atas modal */}
        {editing !== 'new' && editing !== null && (
          <InlineDelete
            key={editing.id}
            label="Hapus task ini"
            busy={busy}
            onDelete={handleDelete}
          />
        )}
        <DualButtons
          confirmLabel="Tambah"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSaveSheet}
        />
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  backText: { color: Color.MAIN },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  title: { color: Color.MAIN },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  monthText: { minWidth: 130 },
  remainingText: { marginLeft: 'auto' },
  // Tinggi eksplisit — ScrollView horizontal Android tidak bisa dipercaya
  // mengukur tinggi kontennya sendiri (chip pernah terpotong). Dibuat lega
  // (60) karena emoji di Android bikin chip lebih tinggi dari teks biasa.
  chipScroll: { flexGrow: 0, height: 60, marginBottom: 8 },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  // Ruang badge ditaruh di pembungkus chip (bukan padding ScrollView) —
  // ScrollView horizontal di Android suka salah hitung tinggi kontennya.
  chipHolder: { paddingTop: 6 },
  chipBadge: {
    position: 'absolute',
    top: 0,
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
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 },
  dayBlock: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Color.BORDER,
    gap: 6,
  },
  dayBlockToday: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 12,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderBottomWidth: 0,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dayTitle: { color: Color.TEXT_TITLE },
  dayTitleToday: { color: Color.MAIN_DARK },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  taskTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  fabBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fabArea: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fabMini: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  fabLabel: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fabLabelText: { color: Color.TEXT_TITLE },
  searchList: { maxHeight: 380 },
  searchRow: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 1,
  },
  searchTitle: { color: Color.TEXT_TITLE },
  searchEmpty: { textAlign: 'center', marginTop: 10 },
  freqRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  freqChip: { flex: 1 },
  recurPreview: { marginBottom: 10 },
  sheetError: { color: Color.DANGER, marginBottom: 8 },
});

// Satu tombol kecil speed-dial: label pill + lingkaran ikon.
function FabAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: 'plus' | 'magnifyingglass' | 'repeat' | 'checkmark';
  onPress: () => void;
}) {
  return (
    <View style={styles.fabActionRow}>
      <View style={styles.fabLabel}>
        <VixText heading="label" additionalStyle={styles.fabLabelText}>
          {label}
        </VixText>
      </View>
      <Pressable style={styles.fabMini} onPress={onPress}>
        <IconSymbol name={icon} size={20} color={Color.MAIN} />
      </Pressable>
    </View>
  );
}
