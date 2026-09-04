import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { attentionBorder, AttentionMark } from '@/components/common/Badge';
import { Chip } from '@/components/common/Chip';
import { deadlineBorder } from '@/components/common/Deadline';
import { EditFooter } from '@/components/common/EditFooter';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormError } from '@/components/common/FormError';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SearchBar } from '@/components/common/SearchBar';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { StickyTop } from '@/components/common/StickyTop';
import { VixText } from '@/components/common/VixText';
import { LinkedNotesButton } from '@/components/core/LinkedNotesButton';
import {
    VisitationCardBody,
    VisitationStatus,
} from '@/components/core/VisitationCardBody';
import { VisitationFormFields } from '@/components/core/VisitationFormFields';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useEditParam } from '@/hooks/useEditParam';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import { useSearchMode } from '@/hooks/useSearchMode';
import { useVisitationForm } from '@/hooks/useVisitationForm';
import {
    markVisitationPdfSent,
    MEETING_KINDS,
    meetingKindLabels,
    meetingKindMeta,
    meetingLeaderNames,
    needsPdfShare,
    newVisitationId,
    saveVisitations,
    VISIT_TIPS,
    visitDaysUntil,
    type CoreLeader,
    type MeetingKind,
    type Visitation,
} from '@/lib/core';
import {
    EMPTY_CORE_NOTE_LINKS,
    subscribeCoreNoteLinks,
    type CoreNoteLinks,
} from '@/lib/coreNotes';
import { subscribeCoreRules, type CoreRule } from '@/lib/coreRules';
import { deadlineTone } from '@/lib/deadline';
import { formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR } from '@/lib/messages';
import { shareVisitationPdf } from '@/lib/visitationPdf';

// Tab Visitation 📅: jadwal MCL bertemu CORE para CL (Visitasi / Fellowship) —
// diisi manual, reminder H-3 & hari-H muncul otomatis di Home.
export function VisitationTab({
  visitations,
  leaders,
  pastLeaders,
  editId,
  onEditConsumed,
}: {
  visitations: Visitation[];
  leaders: CoreLeader[];
  /**
   * Ex CORE Leader — HANYA untuk membaca nama di visitasi lama & pencarian.
   * Sengaja dipisah dari `leaders`: mereka tidak boleh muncul di pemilih saat
   * menjadwalkan visitasi baru maupun di filter jadwal visitasi.
   */
  pastLeaders: CoreLeader[];
  // Kalau di-set (dari reminder Dashboard), langsung buka modal pertemuan ini.
  editId?: string;
  // Dipanggil setelah editId dipakai — induk membersihkan param dari URL.
  onEditConsumed?: () => void;
}) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  // Catatan Revive/Khotbah yang disambungkan ke visitasi — untuk tombol 🔗.
  // Dokumennya SATU dan liveDoc menggabungkan langganan dokumen yang sama,
  // jadi sub-tab Monthly yang juga membacanya tidak menambah biaya baca.
  const [noteLinks, setNoteLinks] = useState<CoreNoteLinks>(
    EMPTY_CORE_NOTE_LINKS,
  );
  useEffect(() => {
    if (!user) return;
    return subscribeCoreNoteLinks(user.uid, setNoteLinks);
  }, [user]);

  // Form tambah/edit ('new' = sedang menambah baru). Isian & aturannya dipakai
  // bersama layar Riwayat Visitasi (lihat hooks/useVisitationForm.ts).
  const [editing, setEditing] = useState<Visitation | 'new' | null>(null);
  const form = useVisitationForm();
  // Modal tips + filter jadwal (default tanpa filter → tampil semua).
  const [tipsModal, setTipsModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [filterLeaderId, setFilterLeaderId] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<MeetingKind | null>(null);
  // Mode cari (dibuka dari FAB 🔍) — mencari di SELURUH visitasi, termasuk
  // yang sudah lewat & selesai, karena yang biasanya dicari justru arsipnya.
  const { searchMode, query, setQuery, toggleSearch } = useSearchMode();

  // Panduan acara ikut ditempel ke notulen visitasi PDF, jadi didengarkan di sini.
  const [rules, setRules] = useState<CoreRule[]>([]);
  // Visitasi yang PDF-nya sedang dibuat (null = tidak ada).
  const pdf = useBusyTask();

  useEffect(() => {
    if (!user) return;
    return subscribeCoreRules(user.uid, setRules, () => undefined);
  }, [user]);

  const today = new Date();
  const todayId = dayDocId(today);

  // Mendatang (belum done, belum lewat) urut terdekat; sisanya jadi riwayat.
  const upcoming = visitations
    .filter((v) => !v.done && visitDaysUntil(v, today) >= 0)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());

  // Filter opsional: per CORE Leader dan/atau per jenis visitasi. Filter
  // Thanksgiving ikut menangkap acara yang cuma "sekalian" Thanksgiving.
  const hasFilter = filterLeaderId !== null || filterKind !== null;
  const filtered = upcoming.filter(
    (v) =>
      (!filterLeaderId || v.leaderIds.includes(filterLeaderId)) &&
      (!filterKind ||
        v.kind === filterKind ||
        (filterKind === 'thanksgiving' && v.thanksgiving)),
  );
  const activeLeader = leaders.find((l) => l.id === filterLeaderId);

  // Halaman jadwal visitasi — sama seperti daftar panjang lain di app ini.
  const { currentPage, pageCount, pageItems, setPage } = usePagination(filtered);

  // Hasil pencarian: cocok kalau SETIAP kata yang kamu ketik muncul di judul,
  // agenda, nama CL-nya, jenis acaranya, ATAU tanggalnya. Jadi "rules reyki"
  // tetap ketemu walau urutan katanya beda dari yang tertulis.
  //
  // Dua hal yang dulu bikin hasilnya "hilang" padahal ada di daftar:
  // 1. Nama CL yang sudah diarsipkan tak bisa dibaca (namanya cuma ada di
  //    daftar Ex CORE Leader) → sekarang `namaLeaders` memuat keduanya.
  // 2. Tanggal tampil di kartu tapi tidak ikut dicari → sekarang ikut, jadi
  //    "agustus", "21 agustus", bahkan "jumat" pun bisa dipakai mencari.
  const namaLeaders = [...leaders, ...pastLeaders];
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results =
    words.length === 0
      ? []
      : visitations
          .filter((v) => {
            const hay = `${v.note} ${v.agenda} ${meetingLeaderNames(
              v,
              namaLeaders,
            )} ${meetingKindLabels(v)} ${formatFullDate(
              v.date.toDate(),
            )}`.toLowerCase();
            return words.every((w) => hay.includes(w));
          })
          // Urutan: yang tanggalnya PALING DEKAT dengan hari ini di atas —
          // dua arah, jadi visitasi minggu depan menang atas yang tahun depan,
          // dan yang baru lewat kemarin menang atas yang lewat setahun lalu.
          // (Dulu murni tanggal terbesar dulu, jadi jadwal paling jauh justru
          // nangkring di atas — persis yang bikin bingung saat mencari.)
          .sort((a, b) => {
            const da = visitDaysUntil(a, today);
            const db = visitDaysUntil(b, today);
            const jarak = Math.abs(da) - Math.abs(db);
            // Sama-sama berjarak N hari → yang MENDATANG didahulukan.
            return jarak !== 0 ? jarak : db - da;
          });

  function openAdd() {
    setEditing('new');
    form.reset(leaders[0]?.id);
    setFormError(null);
  }

  const openEdit = useCallback(
    (v: Visitation) => {
      setEditing(v);
      form.fill(v);
      setFormError(null);
    },
    // form berisi setState yang identitasnya stabil; sengaja tidak jadi
    // dependency supaya openEdit tidak dibuat ulang tiap ketikan di form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Auto-buka modal saat dibuka dari reminder Dashboard (?edit=<id>).
  // Aturannya milik bersama — lihat hooks/useEditParam.ts.
  useEditParam(visitations, openEdit, editId, onEditConsumed);

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (form.leaderIds.length === 0) {
      setFormError('Pilih CORE Leader-nya dulu.');
      return;
    }
    const data: Visitation = {
      id: editing === 'new' ? newVisitationId() : editing.id,
      ...form.payload(),
      // Catatan kirim PDF milik jadwalnya, bukan formnya — dipertahankan.
      pdfSentDayId: editing === 'new' ? null : editing.pdfSentDayId,
    };
    const next =
      editing === 'new'
        ? [...visitations, data]
        : visitations.map((v) => (v.id === editing.id ? data : v));
    await save(async () => {
      await saveVisitations(user.uid, next);
      setEditing(null);
    });
  }

  /**
   * Cetak visitasi + panduan acaranya jadi PDF, buka share sheet, lalu catat
   * bahwa hari ini sudah dikirim supaya badge remindernya padam.
   */
  function handleShare(v: Visitation) {
    if (!user) return;
    const uid = user.uid;
    return pdf.run({
      key: v.id,
      start: () => setError(null),
      task: async () => {
        await shareVisitationPdf(
          v,
          // Ikut ex-CL: PDF visitasi lama tetap menyebut namanya, bukan "CORE".
          namaLeaders,
          rules.find((r) => r.kind === v.kind),
        );
        // Dicatat SESUDAH share sheet terbuka. Kalau pencatatannya gagal, PDF
        // sudah terlanjur terkirim — jadi kegagalannya cukup diabaikan, badge
        // menyala sehari lagi jauh lebih baik daripada pesan error palsu.
        if (v.pdfSentDayId !== todayId) {
          markVisitationPdfSent(uid, visitations, v.id, todayId).catch(
            () => undefined,
          );
        }
      },
      fail: () => setError('Gagal membuat notulen visitasi. Coba lagi.'),
    });
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await saveVisitations(
        user.uid,
        visitations.filter((v) => v.id !== editing.id),
      );
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  // Kartu satu jadwal visitasi.
  function renderCard(v: Visitation) {
    const days = visitDaysUntil(v, today);
    // Nada & warnanya dari aturan bersama — sama dengan Pinjaman, sparepart
    // mobil, & perawatan rumah: 🔴 hari-H/terlewat · 🟡 besok · 🟢 masih aman.
    const tone = v.done ? 'unknown' : deadlineTone(days);
    const perluKirim = needsPdfShare(v, today, todayId);
    return (
      <View
        key={v.id}
        style={[styles.card, deadlineBorder(tone), attentionBorder(perluKirim)]}>
      {/* Acara yang panduannya perlu dikirim hari ini = yang dihitung badge
          merah tile CORE & sub-tab Visitation (needsPdfShare). Aturannya
          dipanggil dari lib yang sama dengan badge-nya. */}
      {perluKirim && <AttentionMark corner />}
      <View style={styles.cardRow}>
      {/* Tekan bagian ini untuk edit / tandai selesai. Tombol share sengaja
          jadi SAUDARA, bukan anak — Pressable bersarang di iOS bikin klik
          tombolnya ikut membuka modal edit. */}
      <PressableScale style={styles.cardTapArea} onPress={() => openEdit(v)}>
        <VisitationCardBody visitation={v} leaders={namaLeaders} />
      </PressableScale>

      {/* Kolom kanan: tombol share di pojok kanan ATAS, hitung mundurnya jatuh
          ke pojok kanan BAWAH kartu. Dulu tenggatnya sebaris dengan nama CORE —
          nama yang panjang jadi terjepit; lalu sempat menggantung persis di
          bawah tombol share, jadi mengambang di tengah kartu yang tinggi. */}
      <View style={styles.cardSide}>
        {/* Kedua tombol aksi kartu ini BERSEBELAHAN, bukan bertumpuk — dulu
            keduanya bertumpuk, dan kartunya jadi tinggi sendiri hanya karena
            ada bahan tersambung. Yang tersambung di KIRI, kirim di kanan:
            membaca bahannya mendahului mengirimnya. */}
        <View style={styles.cardActions}>
          {/* Tombol bahan muncul HANYA kalau ada Catatan Revive / Khotbah yang
              kamu sambungkan ke acara ini dari fitur Spiritual — jadi ia
              benar-benar berarti "ada bahan di dalam sini". */}
          <LinkedNotesButton links={noteLinks} coreId={v.id} />
          {/* Kirim visitasi + panduan acaranya ke CORE Leader lewat WhatsApp.
              Latarnya menyala hijau pada hari pengingat (H-3, atau
              H-14/7/3/2/1 untuk acara besar); badge di Home & Dashboard tetap
              yang menagih. */}
          <EmojiButton
            icon="square.and.arrow.up"
            active={perluKirim}
            onPress={() => handleShare(v)}
            busy={pdf.busy === v.id}
            disabled={pdf.busy !== null}
          />
        </View>
        <VisitationStatus visitation={v} tone={tone} days={days} />
      </View>
      </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* Mode cari 🔍 — yang berganti hanya ISI layarnya; semuanya tetap di
          dalam pohon yang sama. Dulu bagian ini `return` sendiri lebih awal,
          akibatnya modal di bawah tidak ikut terpasang: menekan hasil
          pencarian memang menyetel jadwal yang mau diedit, tapi sheet-nya
          tak pernah muncul. Sekarang satu modal dipakai kedua mode. */}
      {searchMode ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.searchWrap}>
            {/* Langsung terfokus begitu FAB 🔍 ditekan */}
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Cari nama, judul, agenda, atau tanggal…"
              autoFocus
            />
          </View>

          {words.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Ketik kata yang kamu ingat dari judul atau agendanya — urutan kata
              tidak harus sama 🔍
            </VixText>
          ) : results.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Tidak ada visitasi yang cocok dengan “{query.trim()}”.
            </VixText>
          ) : (
            <>
              <VixText heading="label" additionalStyle={styles.searchCount}>
                {results.length} visitasi ditemukan
              </VixText>
              {results.map(renderCard)}
            </>
          )}
        </ScrollView>
      ) : (
        <>
          {/* Dipatok di atas: tombol jadwalkan selalu terjangkau, tidak ikut
              hilang ke atas saat daftar jadwalnya digulung ke bawah. */}
          <StickyTop>
            <PrimaryButton
              label="Jadwalkan Visitasi"
              icon="plus"
              onPress={openAdd}
              additionalStyle={styles.addButton}
            />
          </StickyTop>

          {/* key = halaman → balik ke atas tiap ganti halaman (pola yang sama
              dipakai Riwayat Visitasi & daftar panjang lainnya). */}
          <ScrollView
            key={currentPage}
            contentContainerStyle={[styles.content, styles.contentPinned]}>
            <FormError message={error} />

            {/* ===== Jadwal visitasi ===== */}
            <View style={styles.sectionRow}>
              <VixText heading="title" additionalStyle={styles.sectionTitleFlex}>
                📅 Jadwal Visitasi
              </VixText>
              <View style={styles.sectionActions}>
                {/* Tips visitasi (buka modal) */}
                <EmojiButton emoji="💡" onPress={() => setTipsModal(true)} />
                {/* Filter jadwal (per CL / jenis) — nyala kalau ada filter aktif */}
                <EmojiButton
                  emoji="🎚️"
                  active={hasFilter}
                  onPress={() => setFilterModal(true)}
                />
              </View>
            </View>

            {hasFilter && (
              <View style={styles.activeFilterRow}>
                {filterLeaderId && (
                  <Chip
                    label={`${activeLeader ? `${activeLeader.heart} ${activeLeader.name}` : 'CL'} ✕`}
                    active
                    onPress={() => setFilterLeaderId(null)}
                  />
                )}
                {filterKind && (
                  <Chip
                    label={`${meetingKindMeta(filterKind).icon} ${meetingKindMeta(filterKind).label} ✕`}
                    active
                    onPress={() => setFilterKind(null)}
                  />
                )}
              </View>
            )}

            {filtered.length === 0 ? (
              <VixText heading="label" additionalStyle={styles.empty}>
                {hasFilter
                  ? 'Tidak ada jadwal yang cocok dengan filter ini.'
                  : 'Belum ada jadwal — CORE mana yang mau kamu temui bulan ini? 😉'}
              </VixText>
            ) : (
              <>
                {pageItems.map(renderCard)}
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* FAB mengambang (sama seperti Transaksi di Finance): buka & tutup
          mode cari 🔍 */}
      <PressableScale style={styles.fab} onPress={toggleSearch}>
        <IconSymbol
          name={searchMode ? 'xmark' : 'magnifyingglass'}
          size={24}
          color={Color.TEXT_REVERSE}
        />
      </PressableScale>

      {/* Bottom sheet tambah/edit jadwal */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Jadwalkan Visitasi' : 'Edit Visitasi'}
        onClose={() => setEditing(null)}>
        <VisitationFormFields
          form={form}
          leaders={leaders}
          busy={busy}
          dateKey={editing === 'new' ? 'new' : editing?.id}
          agendaPlaceholder="Agenda visitasi"
        />

        <FormError message={formError} />
        <EditFooter
          editing={editing}
          deleteLabel="Hapus jadwal ini"
          busy={busy}
          onDelete={handleDelete}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>

      {/* Modal tips visitasi */}
      <SheetModal
        visible={tipsModal}
        title="💡 Tips Visitasi"
        subtitle="Biar visitasimu makin berdampak"
        onClose={() => setTipsModal(false)}>
        {VISIT_TIPS.map((tip) => (
          <VixText key={tip} heading="paragraph" additionalStyle={styles.tip}>
            {tip}
          </VixText>
        ))}
      </SheetModal>

      {/* Modal filter jadwal — per CORE Leader dan/atau jenis visitasi */}
      <SheetModal
        visible={filterModal}
        title="🎚️ Filter Jadwal"
        subtitle="Tampilkan hanya yang cocok"
        onClose={() => setFilterModal(false)}
        footer={
          <View style={styles.filterFooter}>
            <PressableScale
              style={styles.clearBtn}
              onPress={() => {
                setFilterLeaderId(null);
                setFilterKind(null);
              }}>
              <VixText heading="bold" additionalStyle={styles.clearText}>
                Bersihkan
              </VixText>
            </PressableScale>
            <PressableScale
              style={styles.doneBtn}
              onPress={() => setFilterModal(false)}>
              <VixText heading="bold" additionalStyle={styles.doneBtnText}>
                Selesai
              </VixText>
            </PressableScale>
          </View>
        }>
        {/* Picker, bukan deretan chip: 10 CORE + 9 jenis visitasi bikin modal
            langsung penuh. Bentuknya sama persis dengan modal "Jadwalkan
            Visitasi" — daftarnya baru terbentang saat kolomnya ditekan.
            `clearable` = pilih ulang yang sedang aktif → filternya lepas. */}
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🫶 Per CORE Leader
        </VixText>
        <View style={styles.filterField}>
          <SelectField
            value={filterLeaderId}
            options={leaders.map((l) => ({
              key: l.id,
              label: `${l.heart} ${l.name}`,
            }))}
            onChange={setFilterLeaderId}
            placeholder="Semua CORE Leader"
            clearable
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏸 Per Jenis Visitasi
        </VixText>
        <View style={styles.filterField}>
          <SelectField
            value={filterKind}
            options={MEETING_KINDS.map((k) => ({
              key: k.key,
              label: `${k.icon} ${k.label}`,
            }))}
            onChange={setFilterKind}
            placeholder="Semua jenis visitasi"
            clearable
          />
        </View>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // paddingBottom disisakan lega supaya kartu terakhir tidak tertutup FAB.
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 90 },
  // Daftar jadwal: jarak atasnya sudah dipegang StickyTop (tombol Jadwalkan).
  // Mode cari 🔍 tidak pakai ini — di sana kolom carinya yang butuh jarak atas.
  contentPinned: { paddingTop: 0 },
  // Mode cari 🔍
  searchWrap: { marginBottom: 10 },
  searchCount: { color: Color.TEXT_LABEL, marginBottom: 8 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: { marginBottom: 6 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    ...SECTION_SPACE,
  },
  sectionTitleFlex: { flex: 1 },
  sectionActions: { flexDirection: 'row', gap: 8 },
  activeFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  empty: { textAlign: 'center', marginBottom: 8 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 3,
  },
  // Isi kartu (area klik) + tombol kirim PDF di kanan ATAS-nya.
  // 'flex-start' menahan tombolnya tetap di ujung atas walau kartunya
  // memanjang karena agenda yang berbaris-baris.
  // 'stretch' → kolom kanan setinggi kartunya, jadi isinya bisa dipisah:
  // tombol share menempel di ATAS, hitung mundurnya di BAWAH.
  cardRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  cardTapArea: { flex: 1 },
  // Kolom kanan: tombol share di pojok kanan ATAS, tenggatnya turun ke pojok
  // kanan BAWAH kartu — bukan menggantung persis di bawah tombolnya. Dulu
  // keduanya menempel di atas, jadi tulisan "8 hari lagi" mengambang di tengah
  // kartu yang tinggi. Rata kanan supaya tulisan sepanjang apa pun tetap
  // sejajar dengan tombolnya.
  cardSide: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 },
  // Dua tombol aksi berdampingan (bahan tersambung 🔗 lalu kirim).
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tip: { color: Color.TEXT_PARAGRAPH, marginBottom: 12 },
  // Footer modal filter: dua tombol (Bersihkan / Selesai).
  filterFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },
  clearBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  clearText: { color: Color.TEXT_TITLE },
  doneBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
  },
  doneBtnText: { color: Color.TEXT_REVERSE },
  fieldLabel: { marginBottom: 6 },
  // Jarak bawah tiap picker filter — sama dengan jarak antar-kolom di modal
  // "Jadwalkan Visitasi" (formGap), jadi kedua modal terasa satu keluarga.
  filterField: { marginBottom: 10 },
});
