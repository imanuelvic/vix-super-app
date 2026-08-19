import { Timestamp } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DeadlineTag, deadlineBorder } from '@/components/common/Deadline';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SearchBar } from '@/components/common/SearchBar';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import {
  isMultiLeaderKind,
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
import { subscribeCoreRules, type CoreRule } from '@/lib/coreRules';
import { deadlineLabel, deadlineTone } from '@/lib/deadline';
import { daysBetween, formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';
import { shareVisitationPdf } from '@/lib/visitationPdf';

// Tab Pertemuan 📅: jadwal MCL bertemu CORE para CL (Visitasi / Fellowship) —
// diisi manual, reminder H-3 & hari-H muncul otomatis di Home.
export function VisitationTab({
  visitations,
  leaders,
  editId,
  onEditConsumed,
}: {
  visitations: Visitation[];
  leaders: CoreLeader[];
  // Kalau di-set (dari reminder Dashboard), langsung buka modal pertemuan ini.
  editId?: string;
  // Dipanggil setelah editId dipakai — induk membersihkan param dari URL.
  onEditConsumed?: () => void;
}) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form tambah/edit. 'new' = sedang menambah baru.
  const [editing, setEditing] = useState<Visitation | 'new' | null>(null);
  const [fKind, setFKind] = useState<MeetingKind>('visitasi');
  const [fLeaderIds, setFLeaderIds] = useState<string[]>([]);
  const [fThanksgiving, setFThanksgiving] = useState(false);
  const [fDate, setFDate] = useState(new Date());
  const [fAgenda, setFAgenda] = useState('');
  const [fNote, setFNote] = useState('');
  const [fDone, setFDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Modal tips + filter jadwal (default tanpa filter → tampil semua).
  const [tipsModal, setTipsModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [filterLeaderId, setFilterLeaderId] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<MeetingKind | null>(null);
  // Mode cari (dibuka dari FAB 🔍) — mencari di SELURUH pertemuan, termasuk
  // yang sudah lewat & selesai, karena yang biasanya dicari justru arsipnya.
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');

  // Panduan acara ikut ditempel ke notulen pertemuan PDF, jadi didengarkan di sini.
  const [rules, setRules] = useState<CoreRule[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeCoreRules(user.uid, setRules, () => undefined);
  }, [user]);

  const today = new Date();
  const todayId = dayDocId(today);

  // Tanggal visit yang dipilih sesudah hari ini → toggle "Sudah divisit"
  // disembunyikan (tidak mungkin sudah divisit kalau jadwalnya masa depan).
  const futureDate = daysBetween(today, fDate) > 0;

  // Acara gabungan → CORE-nya boleh dicentang lebih dari satu.
  const multiLeader = isMultiLeaderKind(fKind);

  // Mendatang (belum done, belum lewat) urut terdekat; sisanya jadi riwayat.
  const upcoming = visitations
    .filter((v) => !v.done && visitDaysUntil(v, today) >= 0)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());

  // Filter opsional: per CORE Leader dan/atau per jenis pertemuan. Filter
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

  // Halaman jadwal mendatang — sama seperti daftar panjang lain di app ini.
  const { currentPage, pageCount, pageItems, setPage } = usePagination(filtered);

  // Hasil pencarian: cocok kalau SETIAP kata yang kamu ketik muncul di judul,
  // agenda, catatan, atau nama CL-nya. Jadi "rules reyki" tetap ketemu walau
  // urutan katanya beda dari yang tertulis. Terbaru di atas.
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results =
    words.length === 0
      ? []
      : visitations
          .filter((v) => {
            const hay = `${v.note} ${v.agenda} ${meetingLeaderNames(
              v,
              leaders,
            )} ${meetingKindLabels(v)}`.toLowerCase();
            return words.every((w) => hay.includes(w));
          })
          .sort((a, b) => b.date.toMillis() - a.date.toMillis());

  function toggleSearch() {
    setSearchMode((on) => !on);
    setQuery('');
  }

  function openAdd() {
    setEditing('new');
    setFKind('visitasi');
    setFLeaderIds(leaders[0] ? [leaders[0].id] : []);
    setFThanksgiving(false);
    setFDate(new Date());
    setFAgenda('');
    setFNote('');
    setFDone(false);
    setFormError(null);
  }

  const openEdit = useCallback((v: Visitation) => {
    setEditing(v);
    setFKind(v.kind);
    setFLeaderIds(v.leaderIds);
    setFThanksgiving(v.thanksgiving);
    setFDate(v.date.toDate());
    setFAgenda(v.agenda);
    setFNote(v.note);
    setFDone(v.done);
    setFormError(null);
  }, []);

  /**
   * Ganti jenis acara. Kalau pindah dari jenis gabungan ke jenis biasa, sisakan
   * SATU CORE saja — kalau tidak, pilihan ganda ikut tersimpan diam-diam
   * padahal pemilihnya sudah kembali jadi tunggal.
   */
  function changeKind(k: MeetingKind) {
    setFKind(k);
    if (!isMultiLeaderKind(k)) setFLeaderIds((ids) => ids.slice(0, 1));
  }

  /** Centang / hapus centang satu CORE Leader (mode gabungan). */
  function toggleLeader(id: string) {
    setFLeaderIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  // Auto-buka modal saat dibuka dari reminder Dashboard (?edit=<id>). Setelah
  // dipakai, minta induk membersihkan param (onEditConsumed) supaya modal TIDAK
  // auto-terbuka lagi saat balik ke subtab ini (yang me-mount ulang tab).
  // consumedRef = guard tambahan agar tak dobel dalam satu mount.
  const consumedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!editId || consumedRef.current === editId) return;
    const visit = visitations.find((v) => v.id === editId);
    if (visit) {
      consumedRef.current = editId;
      openEdit(visit);
      onEditConsumed?.();
    }
  }, [editId, visitations, openEdit, onEditConsumed]);

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (fLeaderIds.length === 0) {
      setFormError('Pilih CORE Leader-nya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const data: Visitation = {
      id: editing === 'new' ? newVisitationId() : editing.id,
      kind: fKind,
      leaderIds: fLeaderIds,
      // Kalau jenisnya memang Thanksgiving, penanda tambahannya tak perlu.
      thanksgiving: fKind === 'thanksgiving' ? false : fThanksgiving,
      date: Timestamp.fromDate(fDate),
      agenda: fAgenda.trim(),
      note: fNote.trim(),
      // Jadwal masa depan dipaksa belum divisit — toggle-nya juga disembunyikan.
      done: futureDate ? false : fDone,
      // Catatan kirim PDF milik jadwalnya, bukan formnya — dipertahankan.
      pdfSentDayId: editing === 'new' ? null : editing.pdfSentDayId,
    };
    const next =
      editing === 'new'
        ? [...visitations, data]
        : visitations.map((v) => (v.id === editing.id ? data : v));
    try {
      await saveVisitations(user.uid, next);
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Cetak pertemuan + panduan acaranya jadi PDF, buka share sheet, lalu catat
   * bahwa hari ini sudah dikirim supaya badge remindernya padam.
   */
  async function handleShare(v: Visitation) {
    if (!user || sharingId) return;
    setSharingId(v.id);
    setError(null);
    try {
      await shareVisitationPdf(
        v,
        leaders,
        rules.find((r) => r.kind === v.kind),
      );
      // Dicatat SESUDAH share sheet terbuka. Kalau pencatatannya gagal, PDF
      // sudah terlanjur terkirim — jadi kegagalannya cukup diabaikan, badge
      // menyala sehari lagi jauh lebih baik daripada pesan error palsu.
      if (v.pdfSentDayId !== todayId) {
        markVisitationPdfSent(user.uid, visitations, v.id, todayId).catch(
          () => undefined,
        );
      }
    } catch {
      setError('Gagal membuat notulen pertemuan. Coba lagi.');
    } finally {
      setSharingId(null);
    }
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
      <View key={v.id} style={[styles.card, deadlineBorder(tone)]}>
      <View style={styles.cardRow}>
      {/* Tekan bagian ini untuk edit / tandai selesai. Tombol share sengaja
          jadi SAUDARA, bukan anak — Pressable bersarang di iOS bikin ketukan
          tombolnya ikut membuka modal edit. */}
      <PressableScale style={styles.cardTapArea} onPress={() => openEdit(v)}>
        <View style={styles.cardTop}>
          <VixText heading="bold" additionalStyle={styles.cardTitle}>
            {meetingLeaderNames(v, leaders)}
          </VixText>
          {v.done ? (
            <VixText heading="label" additionalStyle={styles.statusDone}>
              ✅ Selesai
            </VixText>
          ) : (
            <DeadlineTag tone={tone} label={deadlineLabel(days)} />
          )}
        </View>
        <VixText heading="label" additionalStyle={styles.kindLine}>
          {meetingKindLabels(v)}
        </VixText>
        {/* Acara gabungan: perjelas berapa CORE yang ikut */}
        {v.leaderIds.length > 1 ? (
          <VixText heading="label" additionalStyle={styles.kindLine}>
            🤝 {v.leaderIds.length} CORE gabung
          </VixText>
        ) : null}
        <VixText heading="label">📆 {formatFullDate(v.date.toDate())}</VixText>
        {v.note ? (
          <VixText heading="label">🏷️ Judul: {v.note}</VixText>
        ) : null}
        {/* Agenda bisa panjang & berbaris-baris → labelnya di baris sendiri,
            isinya turun ke bawah supaya tetap terbaca rapi. */}
        {v.agenda ? (
          <View>
            <VixText heading="label">🗒️ Agenda:</VixText>
            <VixText heading="label" additionalStyle={styles.blockText}>
              {v.agenda}
            </VixText>
          </View>
        ) : null}
      </PressableScale>

      {/* Kirim pertemuan + panduan acaranya ke CORE Leader lewat WhatsApp.
          Cuma emoji di pojok kanan atas supaya tidak makan tempat. Latarnya
          menyala hijau pada hari pengingat (H-3, atau H-14/7/3/2/1 untuk acara
          besar); badge di Home & Dashboard tetap yang menagih. */}
      <EmojiButton
        emoji="📤"
        active={perluKirim}
        onPress={() => handleShare(v)}
        busy={sharingId === v.id}
        disabled={sharingId !== null}
      />
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
              placeholder="Cari judul atau agenda rapat…"
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
              Tidak ada pertemuan yang cocok dengan “{query.trim()}”.
            </VixText>
          ) : (
            <>
              <VixText heading="label" additionalStyle={styles.searchCount}>
                {results.length} pertemuan ditemukan
              </VixText>
              {results.map(renderCard)}
            </>
          )}
        </ScrollView>
      ) : (
        // key = halaman → balik ke atas tiap ganti halaman (pola yang sama
        // dipakai Riwayat Pertemuan & daftar panjang lainnya).
        <ScrollView key={currentPage} contentContainerStyle={styles.content}>
          <PrimaryButton
            label="Jadwalkan Pertemuan"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addButton}
          />

          <FormError message={error} />

          {/* ===== Jadwal mendatang ===== */}
          <View style={styles.sectionRow}>
            <VixText heading="title" additionalStyle={styles.sectionTitleFlex}>
              📅 Jadwal Mendatang
            </VixText>
            <View style={styles.sectionActions}>
              {/* Tips pertemuan (buka modal) */}
              <EmojiButton emoji="💡" onPress={() => setTipsModal(true)} />
              {/* Filter jadwal (per CL / jenis) — menyala kalau ada filter aktif */}
              <EmojiButton
                emoji="🎚️"
                active={hasFilter}
                onPress={() => setFilterModal(true)}
              />
            </View>
          </View>

          {/* Chip filter yang sedang aktif — ketuk untuk menghapusnya */}
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
        title={editing === 'new' ? 'Jadwalkan Pertemuan' : 'Edit Pertemuan'}
        onClose={() => setEditing(null)}>
        {/* Picker: daftar pilihan baru muncul saat baris ini ditekan, jadi
            modal tidak langsung penuh oleh semua jenis & nama CORE. */}
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Jenis pertemuan
        </VixText>
        <View style={styles.formGap}>
          <SelectField
            value={fKind}
            options={MEETING_KINDS.map((k) => ({
              key: k.key,
              label: `${k.icon} ${k.label}`,
            }))}
            onChange={(k) => k && changeKind(k)}
            placeholder="Pilih jenis pertemuan…"
          />
        </View>

        {/* Thanksgiving itu penanda TAMBAHAN — acara apa pun bisa sekalian
            jadi Thanksgiving. Disembunyikan kalau jenisnya memang Thanksgiving
            supaya tidak menanyakan hal yang sama dua kali. */}
        {fKind !== 'thanksgiving' && (
          <PressableScale
            style={styles.doneRow}
            onPress={() => setFThanksgiving((t) => !t)}>
            <CheckCircle checked={fThanksgiving} />
            <VixText heading="paragraph" additionalStyle={styles.doneText}>
              🎉 Sekalian Thanksgiving
            </VixText>
          </PressableScale>
        )}

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          {multiLeader ? 'CORE mana saja yang gabung?' : 'CORE-nya siapa?'}
        </VixText>
        {multiLeader ? (
          // Acara gabungan → centang sebanyak-banyaknya.
          <View style={styles.leaderWrap}>
            {leaders.map((l) => (
              <Chip
                key={l.id}
                label={`${l.heart} ${l.name}`}
                active={fLeaderIds.includes(l.id)}
                onPress={() => toggleLeader(l.id)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.formGap}>
            <SelectField
              value={fLeaderIds[0] ?? ''}
              options={leaders.map((l) => ({
                key: l.id,
                label: `${l.heart} ${l.name}`,
              }))}
              onChange={(id) => id && setFLeaderIds([id])}
              placeholder="Pilih CORE Leader…"
            />
          </View>
        )}

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal pertemuan
        </VixText>
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal reset tiap ganti jadwal */}
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏷️ Judul Pertemuan
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Judul singkat"
          value={fNote}
          onChangeText={setFNote}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🗒️ Agenda pertemuan
        </VixText>
        <FormInput
          style={[styles.textArea, styles.formGap]}
          placeholder="Agenda pertemuan"
          value={fAgenda}
          onChangeText={setFAgenda}
          editable={!busy}
          multiline
        />

        {/* Tandai selesai setelah visit — hanya kalau tanggalnya sudah tiba */}
        {!futureDate && (
          <PressableScale style={styles.doneRow} onPress={() => setFDone((d) => !d)}>
            <CheckCircle checked={fDone} />
            <VixText heading="paragraph" additionalStyle={styles.doneText}>
              Sudah selesai ✅
            </VixText>
          </PressableScale>
        )}

        <FormError message={formError} />
        <EditDelete
          editing={editing}
          label="Hapus jadwal ini"
          busy={busy}
          onDelete={handleDelete}
        />
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>

      {/* Modal tips pertemuan */}
      <SheetModal
        visible={tipsModal}
        title="💡 Tips Pertemuan"
        subtitle="Biar pertemuanmu makin berdampak"
        onClose={() => setTipsModal(false)}>
        {VISIT_TIPS.map((tip) => (
          <VixText key={tip} heading="paragraph" additionalStyle={styles.tip}>
            {tip}
          </VixText>
        ))}
      </SheetModal>

      {/* Modal filter jadwal — per CORE Leader dan/atau jenis pertemuan */}
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
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🫶 Per CORE Leader
        </VixText>
        <View style={styles.leaderWrap}>
          {leaders.map((l) => (
            <Chip
              key={l.id}
              label={`${l.heart} ${l.name}`}
              active={filterLeaderId === l.id}
              onPress={() =>
                setFilterLeaderId((cur) => (cur === l.id ? null : l.id))
              }
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏸 Per Jenis Pertemuan
        </VixText>
        <View style={styles.leaderWrap}>
          {MEETING_KINDS.map((k) => (
            <Chip
              key={k.key}
              label={`${k.icon} ${k.label}`}
              active={filterKind === k.key}
              onPress={() =>
                setFilterKind((cur) => (cur === k.key ? null : k.key))
              }
            />
          ))}
        </View>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // paddingBottom disisakan lega supaya kartu terakhir tidak tertutup FAB.
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 90 },
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
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
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
  // Isi kartu (area ketuk) + tombol kirim PDF di kanan ATAS-nya.
  // 'flex-start' menahan tombolnya tetap di ujung atas walau kartunya
  // memanjang karena agenda yang berbaris-baris.
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTapArea: { flex: 1 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: { flex: 1, color: Color.TEXT_TITLE },
  kindLine: { color: Color.MAIN },
  // Isi kolom panjang (agenda/catatan) — sedikit menjorok dari labelnya.
  blockText: { color: Color.TEXT_PARAGRAPH, paddingLeft: 2 },
  statusDone: { color: Color.SUCCESS },
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
  leaderWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  formGap: { marginBottom: 10 },
  textArea: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  doneText: { color: Color.TEXT_TITLE },
});
