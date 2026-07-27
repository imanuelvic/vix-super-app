import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { OtherTaskTab } from '@/components/tasks/OtherTaskTab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { dayIdToDate, formatDayMonth, MONTH_NAMES } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import {
  addRecurringTasks,
  addTask,
  completeTasks,
  deleteTask,
  generateRecurringDays,
  MAX_RECURRING,
  pruneOrphanTasks,
  rolloverTasks,
  setTaskDone,
  subscribeOtherTasks,
  subscribeTasks,
  TASK_CATEGORIES,
  updateTask,
  type OtherTask,
  type Task,
  type TaskCategory,
} from '@/lib/tasks';

type MainTab = 'harian' | 'other';

// Persegi target drop (koordinat window). key = "cat:<kategori>" atau
// "day:<dayId>" supaya satu daftar bisa memuat chip kategori & blok hari.
type DropRect = { key: string; x: number; y: number; w: number; h: number };

// Tab bar bawah layar Task — Harian (planner) & Prioritas (catatan penting).
const MAIN_TABS: BottomTab<MainTab>[] = [
  { key: 'harian', label: 'Harian', icon: 'calendar' },
  { key: 'other', label: 'Prioritas', icon: 'flag.fill' },
];

// Task ✅ — planner harian: semua tanggal sebulan tampil berurutan,
// task menempel di harinya. Task kemarin yang belum selesai otomatis
// pindah ke hari ini (rollover), jadi bulan lalu selalu kosong.
export default function TasksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // ?category=... dari kartu Task Hari Ini di Home → buka kategori itu.
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();
  const validCategory = TASK_CATEGORIES.some((c) => c.key === categoryParam)
    ? (categoryParam as TaskCategory)
    : null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [otherTasks, setOtherTasks] = useState<OtherTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<TaskCategory>(
    validCategory ?? 'personal',
  );
  const [error, setError] = useState<string | null>(null);

  // Tab utama: planner harian atau catatan prioritas (Other).
  const [mainTab, setMainTab] = useState<'harian' | 'other'>('harian');

  // Param kategori berubah (mis. tap task lain di Home) → pindah kategori.
  useEffect(() => {
    if (validCategory) {
      setCategory(validCategory);
      setMainTab('harian');
    }
  }, [validCategory]);

  // Drag & drop: task yang sedang diseret + posisi jari (window coords).
  const [dragTask, setDragTask] = useState<Task | null>(null);
  // Target (kategori/hari) yang sedang dilewati jari → disorot agar jelas
  // task akan pindah ke situ. "cat:<key>" / "day:<id>" / null.
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  // Ref tiap chip kategori & tiap blok hari — diukur SEKALI saat mulai
  // menyeret (scroll dimatikan saat drag → posisi stabil) lalu dipakai ulang
  // untuk deteksi hover & saat dilepas.
  const catRefs = useRef<Record<string, View | null>>({});
  const dayRefs = useRef<Record<string, View | null>>({});
  const dropRects = useRef<DropRect[]>([]);
  const draggingTaskRef = useRef<Task | null>(null);

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
  // Ikon FAB ikut berputar saat menu dibuka/ditutup.
  const fabSpin = useSharedValue(0);
  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabSpin.value * 90}deg` }],
  }));
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
  const pruned = useRef(false); // bersihkan task kategori lama sekali saja

  useEffect(() => {
    const timer = setInterval(() => {
      const current = dayDocId(new Date());
      setTodayId((prev) => (prev === current ? prev : current));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fabSpin.value = withTiming(fabOpen ? 1 : 0, { duration: 200 });
  }, [fabOpen, fabSpin]);

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

  useEffect(() => {
    if (!user) return;
    return subscribeOtherTasks(user.uid, setOtherTasks, () =>
      setError('Gagal memuat catatan. Cek koneksi internet.'),
    );
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

  // Sekali saja: hapus PERMANEN task dari kategori lama yang sudah dihapus
  // (mis. 'fun' & 'relax') — biar Firestore ikut bersih.
  useEffect(() => {
    if (!user || pruned.current || loading || tasks.length === 0) return;
    pruned.current = true;
    pruneOrphanTasks(user.uid, tasks).catch(() => {});
  }, [user, tasks, loading]);

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

  // Tekan label bulan di tengah → langsung balik ke bulan berjalan.
  function goNow() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
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

  // ===== Drag & drop =====
  // Ukur posisi (window) semua target: chip kategori + tiap blok hari.
  const measureTargets = useCallback(() => {
    const rectOf = (key: string, node: View | null) =>
      new Promise<DropRect | null>((resolve) => {
        if (!node) return resolve(null);
        node.measureInWindow((x, y, w, h) => resolve({ key, x, y, w, h }));
      });
    const jobs = [
      ...TASK_CATEGORIES.map((c) =>
        rectOf(`cat:${c.key}`, catRefs.current[c.key]),
      ),
      ...Object.keys(dayRefs.current).map((k) =>
        rectOf(`day:${k}`, dayRefs.current[k]),
      ),
    ];
    return Promise.all(jobs).then((list) =>
      list.filter((r): r is DropRect => r !== null),
    );
  }, []);

  // Mulai menyeret: catat task-nya & ukur semua target untuk deteksi hover.
  const beginDrag = useCallback(
    (t: Task) => {
      draggingTaskRef.current = t;
      setDragTask(t);
      setHoverKey(null);
      measureTargets().then((rects) => {
        dropRects.current = rects;
      });
    },
    [measureTargets],
  );

  // Selama jari bergerak: sorot target yang sedang dilewati (kalau memang akan
  // memindahkan — bukan kategori/hari asalnya). Worklet hanya mengoper angka
  // (aman untuk iOS); pencocokan rect dilakukan di sisi JS ini.
  const updateHover = useCallback((x: number, y: number) => {
    const t = draggingTaskRef.current;
    if (!t) return;
    const hit =
      dropRects.current.find(
        (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h,
      ) ?? null;
    const key =
      hit && hit.key !== `cat:${t.category}` && hit.key !== `day:${t.dayId}`
        ? hit.key
        : null;
    setHoverKey((prev) => (prev === key ? prev : key));
  }, []);

  // Dilepas: pindahkan ke target di bawah jari (pakai rect yang sudah diukur).
  const handleDrop = useCallback(
    async (t: Task, x: number, y: number) => {
      const rects = dropRects.current.length
        ? dropRects.current
        : await measureTargets();
      const hit =
        rects.find(
          (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h,
        ) ?? null;
      setDragTask(null);
      setHoverKey(null);
      draggingTaskRef.current = null;
      dropRects.current = [];
      if (!user || !hit) return;
      if (hit.key.startsWith('cat:')) {
        const key = hit.key.slice(4) as TaskCategory;
        if (key !== t.category) {
          try {
            await updateTask(user.uid, t.id, { category: key });
          } catch {
            setError('Gagal memindahkan kategori. Coba lagi.');
          }
        }
      } else if (hit.key.startsWith('day:')) {
        const dayId = hit.key.slice(4);
        if (dayId !== t.dayId) {
          try {
            await updateTask(user.uid, t.id, { dayId });
          } catch {
            setError('Gagal memindahkan tanggal. Coba lagi.');
          }
        }
      }
    },
    [user, measureTargets],
  );

  // Ghost mengikuti jari saat menyeret. dragX/dragY = koordinat window (absolut
  // dari pojok layar), dan ghost ini anak absolute dari SafeAreaView yang juga
  // mulai dari pojok layar — jadi TIDAK perlu koreksi inset.
  //
  // Ukuran ghost diukur (onLayout) supaya kotaknya PAS di tengah jari — jari =
  // titik tengah kotak DAN titik yang dipakai untuk deteksi drop. Jadi cukup
  // arahkan tengah kotak ke target: "yang kamu lihat = yang kamu jatuhkan".
  const ghostW = useSharedValue(0);
  const ghostH = useSharedValue(0);
  const ghostStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value - ghostW.value / 2 },
      { translateY: dragY.value - ghostH.value / 2 },
    ],
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <PressableScale style={styles.backRow} onPress={() => router.back()} hitSlop={8}>
        <IconSymbol name="chevron.left" size={22} color={Color.MAIN} />
        <VixText heading="bold" additionalStyle={styles.backText}>
          Home
        </VixText>
      </PressableScale>

      <View style={styles.header}>
        <VixText heading="header" additionalStyle={styles.title}>
          Task ✅
        </VixText>
        {/* Navigasi bulan — khusus tab Harian, mentok di bulan berjalan */}
        {mainTab === 'harian' && (
          <View style={styles.monthRow}>
            <PressableScale
              onPress={() => shiftMonth(-1)}
              hitSlop={10}
              disabled={atMinMonth}>
              <IconSymbol
                name="chevron.left"
                size={20}
                color={atMinMonth ? Color.BORDER : Color.MAIN}
              />
            </PressableScale>
            {/* Tekan label bulan → balik ke bulan berjalan */}
            <PressableScale onPress={goNow} hitSlop={10}>
              <VixText heading="bold" additionalStyle={styles.monthText}>
                {MONTH_NAMES[month]} {year}
              </VixText>
            </PressableScale>
            <PressableScale onPress={() => shiftMonth(1)} hitSlop={10}>
              <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
            </PressableScale>
            <VixText heading="label" additionalStyle={styles.remainingText}>
              {remaining} belum selesai
            </VixText>
          </View>
        )}
      </View>

      <View style={styles.body}>
      {mainTab === 'other' ? (
        <OtherTaskTab items={otherTasks} />
      ) : (
        <>
          {/* Ganti kategori = ganti to-do list. Ref tiap chip untuk drop drag. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipRow}>
            {TASK_CATEGORIES.map((c) => {
              const count = tasks.filter(
                (t) => t.category === c.key && !t.done && t.dayId === todayId,
              ).length;
              const target = dragTask && dragTask.category !== c.key;
              const hovered = hoverKey === `cat:${c.key}`;
              return (
                <View
                  key={c.key}
                  ref={(r) => {
                    catRefs.current[c.key] = r;
                  }}
                  style={[
                    styles.chipHolder,
                    target && styles.chipTarget,
                    hovered && styles.chipHovered,
                  ]}>
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
                  {/* Cincin sorot muncul (fade-in) saat jari melewati chip ini */}
                  {hovered && (
                    <Animated.View
                      pointerEvents="none"
                      entering={FadeIn.duration(140)}
                      style={styles.chipHoverRing}
                    />
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Petunjuk muncul saat menyeret task */}
          {dragTask && (
            <VixText heading="label" additionalStyle={styles.dragHint}>
              ✋ Lepas di kategori (atas) atau di tanggal untuk memindahkan
            </VixText>
          )}

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
            // Scroll dimatikan saat menyeret biar posisi target stabil.
            <ScrollView
              style={styles.listScroll}
              scrollEnabled={dragTask === null}
              contentContainerStyle={styles.listContent}>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const date = new Date(year, month, i + 1);
                const dayId = dayDocId(date);
                // Tanggal yang sudah terlewat langsung hilang dari tampilan.
                if (dayId < todayId) return null;
                const isToday = dayId === todayId;
                const hovered = hoverKey === `day:${dayId}`;
                // Urutan dalam satu hari: yang dibuat duluan di atas.
                const dayTasks = shown.filter((t) => t.dayId === dayId).reverse();
                return (
                  <View
                    key={dayId}
                    ref={(r) => {
                      dayRefs.current[dayId] = r;
                    }}
                    style={[
                      styles.dayBlock,
                      isToday && styles.dayBlockToday,
                      dragTask ? styles.dayBlockDrop : null,
                    ]}>
                    <View style={styles.dayHeader}>
                      <VixText
                        heading="bold"
                        additionalStyle={
                          isToday ? styles.dayTitleToday : styles.dayTitle
                        }>
                        {formatDayMonth(date)}
                        {isToday ? ' • HARI INI' : ''}
                      </VixText>
                      <PressableScale onPress={() => openAdd(date)} hitSlop={10}>
                        <IconSymbol name="plus" size={18} color={Color.MAIN} />
                      </PressableScale>
                    </View>
                    {dayTasks.map((item) => (
                      <DraggableTaskRow
                        key={item.id}
                        item={item}
                        dragging={dragTask?.id === item.id}
                        dragX={dragX}
                        dragY={dragY}
                        onStart={beginDrag}
                        onDrop={handleDrop}
                        onMove={updateHover}
                        onToggle={handleToggle}
                        onEdit={openEdit}
                      />
                    ))}
                    {/* Sorotan (fade-in) saat jari melewati hari ini */}
                    {hovered && (
                      <Animated.View
                        pointerEvents="none"
                        entering={FadeIn.duration(140)}
                        style={styles.dayHoverRing}
                      />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
      </View>

      {/* Tab bar bawah: Harian (planner) / Prioritas (catatan penting) */}
      <BottomTabs tabs={MAIN_TABS} value={mainTab} onChange={setMainTab} />

      {/* Ghost task yang mengikuti jari saat menyeret */}
      {dragTask && (
        <Animated.View
          pointerEvents="none"
          onLayout={(e) => {
            ghostW.value = e.nativeEvent.layout.width;
            ghostH.value = e.nativeEvent.layout.height;
          }}
          style={[styles.dragGhost, ghostStyle]}>
          <VixText
            heading="bold"
            numberOfLines={1}
            additionalStyle={styles.dragGhostText}>
            {dragTask.title}
          </VixText>
        </Animated.View>
      )}

      {/* Backdrop transparan: tap di luar menutup speed-dial.
          Sengaja Pressable biasa — area penutup tidak perlu animasi tekan. */}
      {mainTab === 'harian' && fabOpen && (
        <Pressable
          style={styles.fabBackdrop}
          onPress={() => setFabOpen(false)}
        />
      )}

      {/* FAB speed-dial ⋯ — hanya di tab Harian, di atas tab bar bawah. */}
      <View
        style={[styles.fabArea, mainTab !== 'harian' && styles.hidden]}
        pointerEvents={mainTab === 'harian' ? 'box-none' : 'none'}>
        {/* `order` = jarak dari FAB (0 = paling dekat) — dipakai untuk
            stagger: keluar dari bawah ke atas, masuk dari atas ke bawah. */}
        {fabOpen && (
          <>
            <FabAction
              order={3}
              label="Cari task"
              icon="magnifyingglass"
              onPress={() => {
                setFabOpen(false);
                setQuery('');
                setSheetView('search');
              }}
            />
            <FabAction
              order={2}
              label="Beres semua hari ini"
              icon="checkmark"
              onPress={handleCompleteToday}
            />
            <FabAction
              order={1}
              label="Task berulang"
              icon="repeat"
              onPress={() => {
                setFabOpen(false);
                openRecur();
              }}
            />
            <FabAction
              order={0}
              label="Tambah hari ini"
              icon="plus"
              onPress={() => {
                setFabOpen(false);
                openAdd(new Date());
              }}
            />
          </>
        )}
        <PressableScale style={styles.fab} onPress={() => setFabOpen((o) => !o)}>
          <Animated.View style={fabIconStyle}>
            <IconSymbol
              name={fabOpen ? 'xmark' : 'ellipsis'}
              size={26}
              color={Color.TEXT_REVERSE}
            />
          </Animated.View>
        </PressableScale>
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
                  <PressableScale
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
                  </PressableScale>
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
            {/* Textarea, sama seperti modal tambah/edit task */}
            <FormInput
              style={styles.taskInput}
              placeholder={`Task`}
              value={rTitle}
              onChangeText={setRTitle}
              multiline
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
        {/* Textarea: Enter bikin baris baru, jadi task bisa ditulis paragraf */}
        <FormInput
          style={styles.taskInput}
          placeholder={`Task`}
          value={fTitle}
          onChangeText={setFTitle}
          multiline
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
          confirmLabel={editing === 'new' ? 'Tambah' : 'Ganti'}
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
  body: { flex: 1 },
  listScroll: { flex: 1 },
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
  // Task bisa multi-baris → rata atas biar ceklis sejajar baris pertama.
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  taskMain: { flex: 1 },
  taskText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  taskTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  taskRowDragging: { opacity: 0.35 }, // baris yang sedang diseret diredupkan
  // Sorotan target saat drag aktif
  chipTarget: { transform: [{ scale: 1.04 }] },
  // Chip yang sedang dilewati jari — membesar sedikit lebih menonjol.
  chipHovered: { transform: [{ scale: 1.12 }] },
  // Cincin sorot di atas chip yang di-hover (muncul fade-in).
  chipHoverRing: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Color.MAIN,
    backgroundColor: Color.MAIN_TRANSPARENT,
  },
  // Cincin sorot menutupi blok hari yang di-hover (muncul fade-in).
  dayHoverRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Color.MAIN,
    backgroundColor: Color.MAIN_TRANSPARENT,
  },
  dragHint: {
    color: Color.MAIN_DARK,
    textAlign: 'center',
    backgroundColor: Color.MAIN_TRANSPARENT,
    marginHorizontal: 20,
    borderRadius: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  dayBlockDrop: { borderRadius: 12, borderStyle: 'dashed', borderWidth: 1 },
  // Ghost task yang mengikuti jari
  dragGhost: {
    position: 'absolute',
    top: 0,
    left: 0,
    maxWidth: 240,
    backgroundColor: Color.MAIN,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 8,
    zIndex: 50,
  },
  dragGhostText: { color: Color.TEXT_REVERSE },
  hidden: { opacity: 0 },
  formGap: { marginBottom: 10 },
  // Kotak isian task berbentuk textarea — muat beberapa baris sekaligus.
  taskInput: {
    marginBottom: 10,
    minHeight: 120,
    textAlignVertical: 'top',
  },
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
    bottom: 78, // di atas tab bar bawah
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

// Satu baris task yang bisa DISERET (tahan ±0,2 detik lalu geser). Identitas
// komponen sengaja di module-scope agar node Reanimated tidak remount (iOS).
// Lepas di chip kategori → ganti kategori; di blok hari → pindah tanggal.
function DraggableTaskRow({
  item,
  dragging,
  dragX,
  dragY,
  onStart,
  onDrop,
  onMove,
  onToggle,
  onEdit,
}: {
  item: Task;
  dragging: boolean;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  onStart: (t: Task) => void;
  onDrop: (t: Task, x: number, y: number) => void;
  onMove: (x: number, y: number) => void;
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
}) {
  const pan = useMemo(() => {
    // PENTING (fix crash iOS): `item` mengandung Timestamp (Firestore). Kalau
    // dikirim sebagai argumen runOnJS, Reanimated mencoba serialize objek itu
    // ke worklet → crash di iOS. Jadi `item` DITANGKAP di sisi JS (closure di
    // bawah), worklet hanya mengoper angka (koordinat) — tidak menyentuh item.
    const startDrag = () => onStart(item);
    const dropDrag = (x: number, y: number) => onDrop(item, x, y);
    return Gesture.Pan()
      .activateAfterLongPress(220)
      .onStart((e) => {
        dragX.value = e.absoluteX;
        dragY.value = e.absoluteY;
        runOnJS(startDrag)();
      })
      .onUpdate((e) => {
        dragX.value = e.absoluteX;
        dragY.value = e.absoluteY;
        // Sorot target yang dilewati — hanya angka yang dioper (aman iOS).
        runOnJS(onMove)(e.absoluteX, e.absoluteY);
      })
      .onEnd((e) => {
        runOnJS(dropDrag)(e.absoluteX, e.absoluteY);
      });
  }, [item, dragX, dragY, onStart, onDrop, onMove]);

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.taskRow, dragging && styles.taskRowDragging]}>
        {/* Hanya lingkaran ini yang menandai selesai */}
        <PressableScale onPress={() => onToggle(item)} hitSlop={8}>
          <CheckCircle checked={item.done} size={22} />
        </PressableScale>
        {/* Tekan teksnya → edit; tahan lalu geser → pindah */}
        <PressableScale style={styles.taskMain} onPress={() => onEdit(item)}>
          <VixText
            heading="paragraph"
            additionalStyle={[
              styles.taskText,
              item.done && styles.taskTextDone,
            ]}>
            {item.title}
          </VixText>
        </PressableScale>
      </View>
    </GestureDetector>
  );
}

const FAB_ACTIONS = 4; // jumlah tombol speed-dial (untuk hitung stagger)

// Satu tombol kecil speed-dial: label pill + lingkaran ikon.
// Naik mulus sekali dari arah FAB (tanpa mantul), lalu turun kembali saat
// ditutup — yang paling dekat FAB (order 0) keluar duluan & masuk paling akhir.
function FabAction({
  order,
  label,
  icon,
  onPress,
}: {
  order: number;
  label: string;
  icon: 'plus' | 'magnifyingglass' | 'repeat' | 'checkmark';
  onPress: () => void;
}) {
  return (
    <Animated.View
      style={styles.fabActionRow}
      entering={FadeInDown.duration(180).delay(order * 45)}
      exiting={FadeOutDown.duration(150).delay((FAB_ACTIONS - 1 - order) * 30)}>
      <View style={styles.fabLabel}>
        <VixText heading="label" additionalStyle={styles.fabLabelText}>
          {label}
        </VixText>
      </View>
      <PressableScale style={styles.fabMini} onPress={onPress}>
        <IconSymbol name={icon} size={20} color={Color.MAIN} />
      </PressableScale>
    </Animated.View>
  );
}
