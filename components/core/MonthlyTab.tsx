import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SearchBar } from '@/components/common/SearchBar';
import { SheetModal } from '@/components/common/SheetModal';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  deleteMonthlyMeeting,
  emptyMonthlyPoints,
  MONTHLY_AGENDA_POINTS,
  newMonthlyMeetingId,
  saveMonthlyMeeting,
  type MonthlyMeeting,
} from '@/lib/core';
import { formatFullDate, formatTime, MONTH_NAMES } from '@/lib/format';
import { shareMonthlyPdf } from '@/lib/monthlyPdf';
import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';

// Sub-tab 🗒️ Monthly — notulen Mentoring Bulanan dari gereja.
// Susunan agendanya selalu 5 poin yang sama (MENTORSHIP · LEADER'S MESSAGE ·
// NDC INFORMATION · CORE · OUR EVENTS), jadi kolomnya sudah disiapkan dan
// tinggal diisi — tidak perlu mengetik ulang judul poinnya tiap rapat.
export function MonthlyTab({ meetings }: { meetings: MonthlyMeeting[] }) {
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kartu yang sedang dibentangkan (rapat lama default tertutup biar ringkas).
  const [openId, setOpenId] = useState<string | null>(null);

  // Mode cari 🔍 — sama seperti sub-tab Pertemuan & Transaksi di Finance.
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');

  // Form tambah/edit.
  const [editing, setEditing] = useState<MonthlyMeeting | 'new' | null>(null);
  const [fTitle, setFTitle] = useState('');
  // Satu objek Date memuat tanggal SEKALIGUS jam mulai: DateField mengubah
  // tanggalnya (jamnya dipertahankan), TimeField mengubah jamnya.
  const [fDate, setFDate] = useState(new Date());
  const [fPlace, setFPlace] = useState('');
  const [fPoints, setFPoints] = useState<Record<string, string>>(
    emptyMonthlyPoints(),
  );
  const [formError, setFormError] = useState<string | null>(null);
  // Notulen yang PDF-nya sedang dibuat (null = tidak ada).
  const [sharingId, setSharingId] = useState<string | null>(null);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown =
    words.length === 0
      ? meetings
      : meetings.filter((m) => {
          const hay = `${m.title} ${MONTHLY_AGENDA_POINTS.map(
            (p) => m.points[p.key] ?? '',
          ).join(' ')}`.toLowerCase();
          return words.every((w) => hay.includes(w));
        });

  function toggleSearch() {
    setSearchMode((on) => !on);
    setQuery('');
  }

  function openAdd() {
    const now = new Date();
    setEditing('new');
    setFTitle(`Mentoring ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`);
    setFDate(now);
    setFPlace('');
    setFPoints(emptyMonthlyPoints());
    setFormError(null);
  }

  function openEdit(m: MonthlyMeeting) {
    setEditing(m);
    setFTitle(m.title);
    setFDate(m.date.toDate());
    setFPlace(m.place);
    setFPoints({ ...emptyMonthlyPoints(), ...m.points });
    setFormError(null);
  }

  /** Cetak notulen jadi PDF lalu buka share sheet (ada WhatsApp di dalamnya). */
  async function handleShare(m: MonthlyMeeting) {
    if (sharingId) return;
    setSharingId(m.id);
    setError(null);
    try {
      await shareMonthlyPdf(m);
    } catch {
      setError('Gagal membuat PDF notulen. Coba lagi.');
    } finally {
      setSharingId(null);
    }
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fTitle.trim()) {
      setFormError('Judul rapat wajib diisi.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await saveMonthlyMeeting(
        user.uid,
        editing === 'new' ? newMonthlyMeetingId() : editing.id,
        {
          title: fTitle.trim(),
          date: fDate,
          place: fPlace.trim(),
          // Rapikan spasi di ujung tiap poin sebelum disimpan.
          points: Object.fromEntries(
            MONTHLY_AGENDA_POINTS.map((p) => [
              p.key,
              (fPoints[p.key] ?? '').trim(),
            ]),
          ),
        },
      );
      setEditing(null);
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editing || editing === 'new' || busy) return;
    setBusy(true);
    try {
      await deleteMonthlyMeeting(user.uid, editing.id);
      setEditing(null);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function renderCard(m: MonthlyMeeting) {
    const expanded = openId === m.id;
    return (
      <View key={m.id} style={styles.card}>
        {/* Ketuk judul untuk buka/tutup isinya; ✏️ untuk mengubah */}
        <PressableScale
          style={styles.cardHeader}
          onPress={() => setOpenId(expanded ? null : m.id)}>
          <View style={styles.cardMain}>
            <VixText heading="bold" additionalStyle={styles.cardTitle}>
              🗒️ {m.title}
            </VixText>
            <VixText heading="label" additionalStyle={styles.cardDate}>
              📆 {formatFullDate(m.date.toDate())} · 🕒{' '}
              {formatTime(m.date.toDate())}
            </VixText>
            {m.place ? (
              <VixText heading="label" additionalStyle={styles.cardDate}>
                📍 {m.place}
              </VixText>
            ) : null}
          </View>
          <IconSymbol
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={18}
            color={Color.TEXT_LABEL}
          />
        </PressableScale>

        {expanded && (
          <View style={styles.cardBody}>
            {MONTHLY_AGENDA_POINTS.map((p) => {
              const text = (m.points[p.key] ?? '').trim();
              return (
                <View key={p.key} style={styles.pointBlock}>
                  <VixText heading="title" additionalStyle={styles.pointLabel}>
                    {p.icon} {p.label}
                  </VixText>
                  <VixText
                    heading="paragraph"
                    additionalStyle={text ? styles.pointText : styles.pointEmpty}>
                    {text || '—'}
                  </VixText>
                </View>
              );
            })}
            <View style={styles.actionRow}>
              <PressableScale style={styles.editRow} onPress={() => openEdit(m)}>
                <IconSymbol name="pencil" size={16} color={Color.MAIN} />
                <VixText heading="bold" additionalStyle={styles.editText}>
                  Ubah notulen
                </VixText>
              </PressableScale>
              {/* Cetak jadi PDF lalu buka share sheet — WhatsApp ada di situ */}
              <PressableScale
                style={styles.shareRow}
                onPress={() => handleShare(m)}
                disabled={sharingId !== null}>
                {sharingId === m.id ? (
                  <ActivityIndicator color={Color.TEXT_REVERSE} />
                ) : (
                  <>
                    <IconSymbol
                      name="square.and.arrow.up"
                      size={16}
                      color={Color.TEXT_REVERSE}
                    />
                    <VixText heading="bold" additionalStyle={styles.shareText}>
                      Share PDF
                    </VixText>
                  </>
                )}
              </PressableScale>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {searchMode ? (
          <View style={styles.searchWrap}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Cari judul atau isi notulen…"
              autoFocus
            />
          </View>
        ) : (
          <PrimaryButton
            label="Tambah Rapat Bulanan"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addButton}
          />
        )}

        <FormError message={error} />

        {shown.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            {words.length > 0
              ? `Tidak ada notulen yang cocok dengan “${query.trim()}”.`
              : 'Belum ada notulen. Catat rapat mentoring bulan ini 🗒️'}
          </VixText>
        ) : (
          shown.map(renderCard)
        )}
      </ScrollView>

      {/* FAB mengambang: buka/tutup mode cari 🔍 */}
      <PressableScale style={styles.fab} onPress={toggleSearch}>
        <IconSymbol
          name={searchMode ? 'xmark' : 'magnifyingglass'}
          size={24}
          color={Color.TEXT_REVERSE}
        />
      </PressableScale>

      {/* Sheet tambah / edit notulen */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catat Rapat Bulanan' : 'Ubah Notulen'}
        subtitle="Isi 5 poin agendanya — boleh dikosongkan kalau tidak dibahas"
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🏷️ Judul rapat
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Mentoring Agustus 2026"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📆 Tanggal rapat
        </VixText>
        <View style={styles.formGap}>
          {/* key = id supaya state picker internal reset tiap ganti rapat */}
          <DateField
            key={editing === 'new' ? 'new' : editing?.id}
            value={fDate}
            onChange={setFDate}
          />
        </View>

        {/* Jam mulai — menempel di objek Date yang sama dengan tanggal di atas,
            jadi keduanya tersimpan sebagai SATU field. */}
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🕒 Jam mulai
        </VixText>
        <View style={styles.formGap}>
          <TimeField
            key={`t-${editing === 'new' ? 'new' : editing?.id}`}
            value={fDate}
            onChange={setFDate}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📍 Tempat
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. Gereja NDC lt. 3"
          value={fPlace}
          onChangeText={setFPlace}
          editable={!busy}
        />

        {MONTHLY_AGENDA_POINTS.map((p) => (
          <View key={p.key}>
            <VixText heading="label" additionalStyle={styles.fieldLabel}>
              {p.icon} {p.label}
            </VixText>
            <FormInput
              style={[styles.textArea, styles.formGap]}
              placeholder={p.hint}
              value={fPoints[p.key] ?? ''}
              onChangeText={(text) =>
                setFPoints((prev) => ({ ...prev, [p.key]: text }))
              }
              editable={!busy}
              multiline
            />
          </View>
        ))}

        <FormError message={formError} />
        <EditDelete
          editing={editing}
          label="Hapus notulen ini"
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // paddingBottom lega supaya kartu terakhir tidak tertutup FAB.
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 90 },
  addButton: { marginBottom: 12 },
  searchWrap: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 10 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardMain: { flex: 1, gap: 2 },
  cardTitle: { color: Color.TEXT_TITLE },
  cardDate: { color: Color.TEXT_LABEL },
  cardBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    gap: 10,
  },
  pointBlock: { gap: 1 },
  pointLabel: { color: Color.MAIN_DARK, marginTop: 10, },
  pointText: { color: Color.TEXT_PARAGRAPH },
  pointEmpty: { color: Color.TEXT_PLACEHOLDER },
  // Dua tombol sejajar di kaki kartu: ubah (garis putus) & share PDF (isi).
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Color.MAIN_LIGHT,
  },
  shareRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
  },
  shareText: { color: Color.TEXT_REVERSE },
  editText: { color: Color.MAIN },
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
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  textArea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
});
