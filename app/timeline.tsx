import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { EditButton } from '@/components/common/EditButton';
import { EditFooter } from '@/components/common/EditFooter';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormInput } from '@/components/common/FormInput';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PinLock } from '@/components/common/PinLock';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useFormSave } from '@/hooks/useFormSave';
import { useKeyedData } from '@/hooks/useKeyedData';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useOwnerLeader } from '@/hooks/useOwnerLeader';
import { formatDayDate, MONTH_NAMES } from '@/lib/format';
import { LOAD_ERROR, pdfErrorOf, SAVE_ERROR } from '@/lib/messages';
import { PRIVACY_PIN } from '@/lib/pin';
import {
  BIRTH_YEAR,
  fetchTimelineAll,
  newTimelineId,
  saveTimelineYear,
  subscribeTimelineYear,
  timelineGroups,
  timelineLastUpdated,
  timelineTotals,
  TIMELINE_CATEGORIES,
  TIMELINE_CATEGORY_META,
  type TimelineCategoryKey,
  type TimelineItem,
  type TimelineYear,
} from '@/lib/timeline';
import { shareDocToLeader } from '@/lib/shareLeader';
import { shareTimelinePdf } from '@/lib/timelinePdf';
import { WHATSAPP_ERROR } from '@/lib/whatsapp';

// Tahun paling awal = tahun aplikasi dibuat (2026). Tidak ada data sebelumnya,
// jadi navigasi tahun mentok di sini (tidak bisa mundur ke 2025 dan sebelumnya).
const MIN_YEAR = 2026;

export default function TimelineScreen() {
  const { user } = useAuth();

  // Timeline siapa yang sedang dibuka — bentuknya sama persis dengan Wheel of
  // Life: tanpa param = punyaku sendiri, dengan ?leaderId= = milik CL itu.
  // Satu layar, dua pemilik; tidak ada layar kembar yang harus dirawat dua kali.
  const params = useLocalSearchParams<{
    leaderId?: string;
    name?: string;
    heart?: string;
    birthYear?: string;
    /** '1' = langsung buka rekap semua wishlist (dari modal Follow Up). */
    rekap?: string;
  }>();
  const owner = params.leaderId || null;
  const orang = params.name?.trim() || 'CORE Leader';
  const router = useRouter();
  // Timeline milik CL dikunci PIN — alasan & bentuknya sama dengan Wheel
  // (lihat app/wheel.tsx). Timeline-ku sendiri tidak dikunci.
  const [unlocked, setUnlocked] = useState(owner === null);
  // Umur dihitung dari tahun lahir PEMILIK timeline-nya. Tanpa param (punyaku
  // sendiri) jatuh ke BIRTH_YEAR.
  const birthYear = Number(params.birthYear) || BIRTH_YEAR;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  // items = null → loading. Kosong sendiri tiap ganti tahun (lihat useKeyedData).
  // Kuncinya ikut memuat pemiliknya, jadi wishlist CL A mustahil sempat
  // terlihat di layar CL B walau layarnya kebetulan dipakai ulang.
  const { data: items, set: setItems } = useKeyedData<string, TimelineItem[]>(
    `${owner ?? 'me'}/${year}`,
  );
  const [error, setError] = useState<string | null>(null);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<TimelineItem | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fCategory, setFCategory] = useState<TimelineCategoryKey>('future');
  const [fMonth, setFMonth] = useState<number | null>(null);
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  // Rekap & PDF sama-sama butuh SELURUH tahun, bukan cuma tahun yang sedang
  // dibuka — jadi keduanya memakai satu pengambilan yang sama.
  const tugas = useBusyTask<'pdf' | 'rekap'>();
  const [semua, setSemua] = useState<TimelineYear[] | null>(null);
  // Dibuka dari modal Follow Up dengan ?rekap=1 → rekapnya langsung tampil,
  // isinya dimuat begitu PIN terbuka (lihat efek di bawah).
  const rekapAwal = params.rekap === '1';
  const [rekapOpen, setRekapOpen] = useState(rekapAwal);

  useLiveAll(
    (uid, fail) => [
      subscribeTimelineYear(
        uid,
        year,
        (next) => {
          setItems(next);
          setError(null);
        },
        fail,
        owner,
      ),
    ],
    { onError: setError, deps: [year, owner, setItems], when: unlocked },
  );

  const age = year - birthYear; // ulang tahun 1 Januari → pas per tahun
  const doneCount = items?.filter((i) => i.done).length ?? 0;
  const total = items?.length ?? 0;
  const isThisYear = year === now.getFullYear();
  const atMinYear = year <= MIN_YEAR; // mentok 2026 — tidak bisa ke kiri lagi

  // Semua bulan yang sudah lewat (tahun berjalan) digabung jadi SATU dropdown,
  // default tertutup — biar bulan ini & mendatang cepat terlihat.
  const [pastOpen, setPastOpen] = useState(false);
  const currentMonth = now.getMonth();
  const hasPast = isThisYear && currentMonth > 0;
  const pastCount = (items ?? []).filter(
    (i) => i.month !== null && i.month < currentMonth,
  ).length;

  function openAdd(month: number | null) {
    setEditing('new');
    setFTitle('');
    setFCategory('future');
    setFMonth(month);
    setFormError(null);
  }

  function openEdit(item: TimelineItem) {
    setEditing(item);
    setFTitle(item.title);
    setFCategory(item.category);
    setFMonth(item.month);
    setFormError(null);
  }

  async function handleToggle(item: TimelineItem) {
    if (!user || !items) return;
    setError(null);
    const next = items.map((i) =>
      i.id === item.id ? { ...i, done: !i.done } : i,
    );
    try {
      await saveTimelineYear(user.uid, year, next, owner);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  async function handleSave() {
    if (!user || !items || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Wishlist wajib diisi.');
      return;
    }
    const data: TimelineItem = {
      id: editing === 'new' ? newTimelineId() : editing.id,
      title: fTitle.trim(),
      category: fCategory,
      month: fMonth,
      done: editing === 'new' ? false : editing.done,
    };
    const next =
      editing === 'new'
        ? [...items, data]
        : items.map((i) => (i.id === editing.id ? data : i));
    await save(async () => {
      await saveTimelineYear(user.uid, year, next, owner);
      setEditing(null);
    });
  }

  async function handleDelete() {
    if (!user || !items || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveTimelineYear(
        user.uid,
        year,
        items.filter((i) => i.id !== editing.id),
        owner,
      );
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  /**
   * Ambil seluruh tahun sekali jalan. Dipakai rekap MAUPUN PDF, dan hasilnya
   * disimpan supaya membuka rekap lalu menekan share tidak membaca dua kali.
   *
   * Sengaja diambil ulang tiap ditekan (bukan sekali seumur layar): wishlist
   * yang barusan kamu tambah di tahun ini harus ikut, bukan rekap basi.
   */
  async function muatSemua(): Promise<TimelineYear[]> {
    if (!user) return [];
    const isi = await fetchTimelineAll(user.uid, owner);
    setSemua(isi);
    return isi;
  }

  const pemilik = owner
    ? { name: orang, heart: params.heart ?? '📍', birthYear }
    : null;
  const judulDok = owner ? `Timeline ${params.heart ?? '📍'} ${orang}` : 'My Timeline';

  // Tombol share di header (22 Sep 2026): timeline milik satu CL LANGSUNG ke
  // orangnya, tanpa sheet pilih CL. PDF SELURUH wishlist (tahun berlalu &
  // mendatang) dibuat → share sheet (pilih WhatsApp) → tanggalnya dicatat →
  // chat WA CL itu terbuka (lib/shareLeader.ts). Timeline-ku sendiri (tanpa
  // pemilik) tetap bagikan biasa. Sama dengan Wheel of Life.
  const { leader: ownerLeader, log: shareLog } = useOwnerLeader(owner, unlocked);

  function handleShare() {
    if (!user) return;
    const uid = user.uid;
    void tugas.run({
      key: 'pdf',
      start: () => setError(null),
      task: async () =>
        ownerLeader
          ? shareDocToLeader({
              uid,
              leader: ownerLeader,
              kind: 'timeline',
              doc: judulDok,
              log: shareLog,
              share: async (l, lastShared) =>
                shareTimelinePdf(await muatSemua(), pemilik, {
                  name: l.name,
                  heart: l.heart,
                  lastShared,
                }),
              onWaError: () => setError(WHATSAPP_ERROR),
            })
          : shareTimelinePdf(await muatSemua(), pemilik),
      fail: () => setError(pdfErrorOf('Timeline')),
    });
  }

  function muatRekap() {
    void tugas.run({
      key: 'rekap',
      start: () => setError(null),
      task: async () => {
        await muatSemua();
      },
      fail: () => setError(LOAD_ERROR),
    });
  }

  function openRekap() {
    setRekapOpen(true);
    muatRekap();
  }

  // ?rekap=1: sheet-nya sudah terbuka sejak awal; isinya baru bisa dibaca
  // sesudah PIN terbuka. Sekali saja per pembukaan layar.
  useEffect(() => {
    if (!user || !unlocked || !rekapAwal) return;
    muatRekap();
    // Hanya saat PIN terbuka — muatRekap/tugas sengaja bukan dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, unlocked, rekapAwal]);

  // Baris satu item wishlist (dipakai di target tahunan & bulanan).
  function renderItem(item: TimelineItem) {
    const meta = TIMELINE_CATEGORY_META[item.category];
    return (
      <View key={item.id} style={styles.itemRow}>
        <PressableScale style={styles.itemMain} onPress={() => handleToggle(item)}>
          <CheckCircle checked={item.done} size={22} />
          <VixText
            heading="paragraph"
            additionalStyle={[styles.itemText, item.done && styles.itemTextDone]}>
            {meta.icon} {item.title}
          </VixText>
        </PressableScale>
        <EditButton onPress={() => openEdit(item)} />
      </View>
    );
  }

  // Isi satu bulan: header (nama + kuartal + tombol +) lalu daftar wishlist.
  // Dipakai untuk kartu bulan individual & tiap bulan di dalam dropdown lewat.
  function renderMonthSection(m: number) {
    const monthItems = (items ?? []).filter((i) => i.month === m);
    const current = isThisYear && m === now.getMonth();
    const quarter = Math.floor(m / 3) + 1; // Q1–Q4
    return (
      <>
        <View style={styles.monthHeader}>
          <View style={styles.monthHeaderLeft}>
            <VixText heading="bold" additionalStyle={styles.monthTitle}>
              {MONTH_NAMES[m]}
            </VixText>
            <VixText heading="label" additionalStyle={styles.quarterText}>
              • Q{quarter}
            </VixText>
            {current && (
              <VixText heading="label" additionalStyle={styles.nowText}>
                • bulan ini
              </VixText>
            )}
          </View>
          <PressableScale onPress={() => openAdd(m)} hitSlop={10}>
            <IconSymbol name="plus" size={18} color={Color.MAIN} />
          </PressableScale>
        </View>
        {monthItems.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.emptyMonth}>
            -
          </VixText>
        ) : (
          monthItems.map(renderItem)
        )}
      </>
    );
  }

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <PinLock
          pin={PRIVACY_PIN}
          title={`Timeline ${params.heart ?? '📍'} ${orang} Terkunci`}
          subtitle="Masukkan PIN untuk membuka"
          onUnlock={() => setUnlocked(true)}
          onCancel={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel={owner ? 'CORE' : 'Home'}
        title={
          owner ? `Timeline ${params.heart ?? '📍'} ${orang}` : 'My Timeline 📍'
        }
        subtitle={
          owner
            ? `Wishlist & panggilan hidup ${orang}`
            : 'Wishlist & panggilan hidupku'
        }
        // Selalu ada, tidak menunggu tahun ini terisi: yang dicetak SELURUH
        // tahun, jadi tahun berjalan yang kebetulan kosong bukan berarti tak
        // ada apa-apa untuk dibagikan.
        right={
          <>
            {/* 📋 rekap semua tahun — di header (14 Sep 2026), bukan petak
                kecil di samping "Tambah Wishlist": ia jalan pintas lintas
                tahun, sederajat dengan tombol bagikan di sebelahnya. */}
            <EmojiButton
              emoji="📋"
              onPress={openRekap}
              busy={tugas.busy === 'rekap'}
              disabled={tugas.busy !== null}
            />
            <EmojiButton
              icon="square.and.arrow.up"
              onPress={handleShare}
              busy={tugas.busy === 'pdf'}
              disabled={tugas.busy !== null}
            />
          </>
        }>
        {/* Navigasi tahun + umur */}
        <View style={styles.yearRow}>
          <PressableScale
            onPress={() => setYear((y) => Math.max(MIN_YEAR, y - 1))}
            hitSlop={10}
            disabled={atMinYear}>
            <IconSymbol
              name="chevron.left"
              size={20}
              color={atMinYear ? Color.BORDER : Color.MAIN}
            />
          </PressableScale>
          {/* Tekan tahun → balik ke tahun berjalan */}
          <PressableScale onPress={() => setYear(now.getFullYear())} hitSlop={10}>
            <VixText heading="bold" additionalStyle={styles.yearText}>
              {year}
            </VixText>
          </PressableScale>
          <PressableScale onPress={() => setYear((y) => y + 1)} hitSlop={10}>
            <IconSymbol name="chevron.right" size={20} color={Color.MAIN} />
          </PressableScale>
          <View style={styles.ageChip}>
            <VixText heading="bold" additionalStyle={styles.ageText}>
              🎂 Umur {age}
            </VixText>
          </View>
        </View>
      </ScreenHeader>

      <ScreenError message={error} />

      {items === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Progress tahun ini */}
          <SummaryCard style={styles.progressCard}>
            <VixText heading="label" additionalStyle={summaryText.label}>
              Wishlist {year}
            </VixText>
            <VixText heading="subheader" additionalStyle={summaryText.value}>
              {doneCount}{' '}
              <VixText heading="label" additionalStyle={summaryText.label}>
                dari {total} tercapai
              </VixText>
            </VixText>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${total > 0 ? (doneCount / total) * 100 : 0}%` },
                ]}
              />
            </View>
            <VixText heading="label" additionalStyle={summaryText.label}>
              {total === 0
                ? 'Isi kerinduanmu ✨'
                : doneCount === total
                  ? 'Semua tercapai, kamu luar biasa! 🎉'
                  : 'Kejar terus kerinduanmu! 💪'}
            </VixText>
          </SummaryCard>

          <PrimaryButton
            label="Tambah Wishlist"
            icon="plus"
            onPress={() => openAdd(null)}
            additionalStyle={styles.addButton}
          />

          {/* Target tahunan (tanpa bulan) */}
          <View style={styles.yearCard}>
            <VixText heading="title">🎯 Target Tahun {year}</VixText>
            {items.filter((i) => i.month === null).length === 0 ? (
              <VixText heading="label">Belum ada target tahunan.</VixText>
            ) : (
              items.filter((i) => i.month === null).map(renderItem)
            )}
          </View>

          {/* Bulan yang sudah lewat → SATU dropdown gabungan (tahun berjalan) */}
          {hasPast && (
            <View style={styles.monthCard}>
              {/* Tekan header untuk buka/tutup semua bulan lewat sekaligus */}
              <PressableScale
                style={styles.monthHeader}
                onPress={() => setPastOpen((o) => !o)}>
                <View style={styles.monthHeaderLeft}>
                  <VixText heading="bold" additionalStyle={styles.monthTitle}>
                    🕗 {MONTH_NAMES[0]} - {MONTH_NAMES[currentMonth - 1]}
                  </VixText>
                </View>
                <View style={styles.monthHeaderRight}>
                  {!pastOpen && pastCount > 0 && (
                    <View style={styles.countPill}>
                      <VixText
                        heading="label"
                        additionalStyle={styles.countPillText}>
                        {pastCount}
                      </VixText>
                    </View>
                  )}
                  <IconSymbol
                    name={pastOpen ? 'chevron.up' : 'chevron.down'}
                    size={16}
                    color={Color.TEXT_LABEL}
                  />
                </View>
              </PressableScale>
              {pastOpen && (
                <Animated.View
                  entering={FadeIn.duration(150)}
                  style={styles.monthBody}>
                  {Array.from({ length: currentMonth }, (_, m) => (
                    <View key={m} style={styles.pastMonthBlock}>
                      {renderMonthSection(m)}
                    </View>
                  ))}
                </Animated.View>
              )}
            </View>
          )}

          {/* Bulan ini & mendatang → kartu individual, selalu terbuka */}
          {MONTH_NAMES.map((name, m) => {
            if (isThisYear && m < currentMonth) return null; // sudah masuk dropdown
            const current = isThisYear && m === now.getMonth();
            return (
              <View
                key={name}
                style={[styles.monthCard, current && styles.monthCurrent]}>
                {renderMonthSection(m)}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Bottom sheet tambah/edit wishlist */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Wishlist' : 'Edit Wishlist'}
        onClose={() => setEditing(null)}>
        <FormInput
          style={styles.formGap}
          placeholder="Wishlist"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />

        {/* Kategori & Waktu jadi dropdown — bentuk yang sama dengan modal di
            fitur CORE. Sembilan kategori & tiga belas pilihan waktu sebagai
            chip membuat modalnya penuh duluan sebelum kolom judulnya sempat
            terbaca; dropdown menyisakan pilihan yang panjang di dalam laci. */}
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📚 Kategori
        </VixText>
        <View style={styles.formGap}>
          <SelectField
            value={fCategory}
            options={TIMELINE_CATEGORIES.map((c) => ({
              key: c.key,
              label: `${c.icon} ${c.label}`,
            }))}
            onChange={(k) => k && setFCategory(k)}
            disabled={busy}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🕒 Waktu
        </VixText>
        <View style={styles.formGap}>
          {/* "Tahunan" disimpan sebagai `month: null`, jadi di dropdown ia
              diwakili kunci teks sendiri — SelectField memakai null untuk
              "belum dipilih", dan di sini tak ada keadaan begitu. */}
          <SelectField
            value={fMonth === null ? 'tahunan' : String(fMonth)}
            options={[
              { key: 'tahunan', label: '🎯 Target Tahunan' },
              ...MONTH_NAMES.map((name, m) => ({
                key: String(m),
                label: name,
              })),
            ]}
            onChange={(k) =>
              setFMonth(k === null || k === 'tahunan' ? null : Number(k))
            }
            disabled={busy}
          />
        </View>

        <ScreenError message={formError} />
        <EditFooter
          editing={editing}
          deleteLabel="Hapus wishlist ini"
          busy={busy}
          onDelete={handleDelete}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>

      {/* Rekap semua tahun — daftar cepat "apa saja yang sudah kutulis". */}
      <SheetModal
        visible={rekapOpen}
        title="📋 All Wishlist Recap"
        subtitle={
          owner ? `${params.heart ?? '📍'} ${orang}` : 'Semua tahun yang pernah kamu isi'
        }
        onClose={() => setRekapOpen(false)}>
        {semua === null ? (
          <LoadingCenter />
        ) : semua.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.recapEmpty}>
            Belum ada wishlist yang tercatat di tahun mana pun.
          </VixText>
        ) : (
          <>
            <View style={styles.recapTotal}>
              <View style={styles.recapTotalMain}>
                <VixText heading="subheader" additionalStyle={styles.recapTotalValue}>
                  {timelineTotals(semua).done}
                  <VixText heading="label" additionalStyle={styles.recapTotalLabel}>
                    {' '}
                    dari {timelineTotals(semua).total} tercapai
                  </VixText>
                </VixText>
                <VixText heading="label" additionalStyle={styles.recapTotalLabel}>
                  {semua.length} tahun · {semua[0].year} –{' '}
                  {semua[semua.length - 1].year}
                </VixText>
              </View>
              {/* Kapan terakhir ada yang disentuh (14 Sep 2026). "-" untuk
                  data lama yang belum pernah disimpan lagi sejak capnya ada. */}
              <View style={styles.recapStamp}>
                <VixText heading="label" additionalStyle={styles.recapTotalLabel}>
                  🕒 Terakhir diperbarui
                </VixText>
                <VixText heading="bold" additionalStyle={styles.recapStampValue}>
                  {(() => {
                    const kapan = timelineLastUpdated(semua);
                    return kapan ? formatDayDate(kapan) : '-';
                  })()}
                </VixText>
              </View>
            </View>

            {semua.map((t) => (
              <View key={t.year} style={styles.recapYear}>
                <View style={styles.recapYearHead}>
                  <VixText heading="bold" additionalStyle={styles.recapYearText}>
                    {t.year}
                  </VixText>
                  <VixText heading="label">
                    {t.items.filter((i) => i.done).length}/{t.items.length}
                  </VixText>
                </View>
                {timelineGroups(t.items).map((g) => (
                  <View key={g.month === null ? 'y' : g.month}>
                    <VixText heading="label" additionalStyle={styles.recapMonth}>
                      {g.month === null ? '🎯 Tahunan' : MONTH_NAMES[g.month]}
                    </VixText>
                    {g.items.map((i) => (
                      <VixText
                        key={i.id}
                        heading="paragraph"
                        additionalStyle={[
                          styles.recapItem,
                          i.done && styles.recapItemDone,
                        ]}>
                        {i.done ? '✅' : '⬜'}{' '}
                        {TIMELINE_CATEGORY_META[i.category]?.icon ?? '📍'}{' '}
                        {i.title}
                      </VixText>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </SheetModal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 2,
  },
  yearText: { minWidth: 60, textAlign: 'center' },
  ageChip: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 'auto',
  },
  ageText: { color: Color.ACCENT_DARK },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  // Bentuk & warna kartunya dari <SummaryCard>; di sini cuma selisihnya.
  progressCard: { gap: 6, marginBottom: CARD_GAP },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Color.MAIN,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Color.MAIN_LIGHT,
  },
  addButton: { marginBottom: CARD_GAP },
  yearCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
    padding: 14,
    marginBottom: 12,
    gap: 6,
  },
  monthCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  monthCurrent: {
    borderColor: Color.MAIN,
    borderWidth: 1.5,
    backgroundColor: Color.MAIN_TRANSPARENT,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  monthHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthTitle: { color: Color.TEXT_TITLE },
  quarterText: { color: Color.TEXT_LABEL },
  nowText: { color: Color.MAIN },
  countPill: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  countPillText: { color: Color.MAIN_DARK },
  monthBody: { gap: 6, marginTop: 6 },
  // Tiap bulan lewat di dalam dropdown gabungan, dipisah garis tipis.
  pastMonthBlock: {
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    paddingTop: 8,
    gap: 6,
  },
  emptyMonth: { color: Color.TEXT_PLACEHOLDER },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  itemTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  recapEmpty: { textAlign: 'center', marginVertical: 12 },
  // Kartu ringkasan rekap: angka di kiri, cap "terakhir diperbarui" di kanan.
  recapTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  recapTotalMain: { flex: 1, gap: 2 },
  recapTotalValue: { color: Color.MAIN_DARK },
  recapTotalLabel: { color: Color.TEXT_LABEL },
  recapStamp: { alignItems: 'flex-end', gap: 2 },
  recapStampValue: { color: Color.MAIN_DARK },
  recapYear: {
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    paddingTop: 10,
    marginBottom: 10,
  },
  recapYearHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  recapYearText: { color: Color.MAIN_DARK },
  recapMonth: { color: Color.TEXT_LABEL, marginTop: 6 },
  recapItem: { color: Color.TEXT_TITLE, marginTop: 2 },
  recapItemDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
});
