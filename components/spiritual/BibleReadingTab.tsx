import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { BibleRefList } from '@/components/spiritual/BibleRefList';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import { splitBibleRefs, usfmRef } from '@/lib/bible';
import { dayIdToDate, formatFullDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import { DELETE_ERROR } from '@/lib/messages';
import {
    BIBLE_SESSIONS,
    BIBLE_VERSION_DEFAULT,
    bibleHasOther,
    bibleSessionMeta,
    bibleSessionOfClock,
    deleteBibleReading,
    isBibleSkipped,
    openYouVersion,
    saveBibleReading,
    type BibleReadingDay,
    type BibleSession,
} from '@/lib/spiritual';

// Tab Bible Reading 📖 — riwayat bacaan Alkitab harian yang dicatat dari Home.
// Dua sesi (🌅 Pagi & 🌙 Malam) dipisah supaya kelihatan mana yang rutin dan
// mana yang bolong, plus pasal apa saja yang sering dibaca.
// Catatan HARI INI masih bisa dibetulkan/dihapus; hari lalu jadi arsip.
export function BibleReadingTab({
  days,
  openSession,
}: {
  days: BibleReadingDay[];
  /**
   * Sesi yang harus terbuka duluan. Dioper layar Baca Alkitab sesudah menekan
   * "✅ Sudah baca": yang harus terlihat adalah sesi yang BARUSAN dicatat, dan
   * itu belum tentu sesi yang jendelanya sedang berjalan (mencatat bacaan
   * Siang jam 23.00 itu wajar). Kosong = ikut jam sekarang.
   */
  openSession?: BibleSession;
}) {
  const { user } = useAuth();

  // Default: sesi yang dituju; kalau tidak ada, sesi yang JAM SEKARANG
  // termasuk di dalamnya (lihat bibleSessionOfClock — pagi dari jam 1, siang
  // dari 12, malam dari 21). Selalu ada jawabannya, jadi membuka arsip jam
  // 17.00 tidak lagi jatuh ke Pagi.
  const [session, setSession] = useState<BibleSession>(
    () => openSession ?? bibleSessionOfClock(new Date()),
  );

  // Hari yang sedang diedit (hanya hari ini) + isi formulirnya. Acuannya
  // disimpan sebagai DAFTAR, sama seperti layar Baca Alkitab: satu hari boleh
  // berisi beberapa kitab ("Yesaya 5, Amsal 3").
  const [editing, setEditing] = useState<BibleReadingDay | null>(null);
  const [refs, setRefs] = useState<string[]>([]);
  const [version, setVersion] = useState(BIBLE_VERSION_DEFAULT);
  const { busy, setBusy, formError, setFormError, save } = useFormSave();

  // Hari yang sesi ini-nya benar-benar DIBACA (days sudah urut terbaru →
  // terlama). Hari yang sengaja dilewati tidak ditampilkan sama sekali: ini
  // arsip bacaan, bukan daftar absen — barisnya cuma jadi lubang kosong.
  // Penandanya sendiri tetap tersimpan, jadi kartu di Home & badge Habits
  // tetap tahu hari itu sudah diurus dan berhenti menagih.
  const list = days.filter((d) => !!d[session] && !isBibleSkipped(d[session]));
  const meta = bibleSessionMeta(session);
  const todayId = dayDocId(new Date());

  // 10 kartu per halaman — arsip ini menumpuk terus tiap hari, jadi tanpa
  // paginasi daftarnya jadi gulungan tanpa ujung. `key={currentPage}` di
  // ScrollView-nya membuat tiap ganti halaman balik ke atas.
  const { currentPage, pageCount, pageItems, setPage } = usePagination(list);

  // Acuan yang benar-benar terisi — dipakai untuk menyimpan & untuk menjaga
  // tombol Perbarui tidak menyimpan catatan kosong.
  const filled = refs.map((r) => r.trim()).filter(Boolean);

  function openEdit(d: BibleReadingDay) {
    setEditing(d);
    // Yang dilewati tidak pernah masuk daftar, jadi isinya pasti acuan asli —
    // penanda "__skip__" tak mungkin nyasar ke pemilih kitab ini. Dipecah
    // dengan pemisah yang sama dengan kartunya, jadi "Amsal 3:5-6" tetap utuh.
    setRefs(splitBibleRefs(d[session]));
    setVersion(d.versions[session]);
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (filled.length === 0) {
      setFormError('Pilih kitab & pasalnya dulu, atau hapus catatannya.');
      return;
    }
    await save(async () => {
      await saveBibleReading(
        user.uid,
        editing.id,
        session,
        filled.join(', '),
        version.trim() || BIBLE_VERSION_DEFAULT,
      );
      setEditing(null);
    });
  }

  async function handleDelete() {
    if (!user || !editing || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      // Dokumen harinya cuma dihapus kalau tidak ada sesi lain yang terisi.
      await deleteBibleReading(
        user.uid,
        editing.id,
        session,
        bibleHasOther(editing, session),
      );
      setEditing(null);
    } catch {
      setFormError(DELETE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView key={currentPage} contentContainerStyle={styles.content}>
        <SegmentTabs
          tabs={BIBLE_SESSIONS.map((s) => ({
            key: s.key,
            label: `${s.emoji} ${s.label}`,
          }))}
          value={session}
          onChange={setSession}
        />

        {list.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada catatan bacaan {meta.label.toLowerCase()}. Isi lewat kartu
            “{meta.title}” di Home pada jam {meta.fromHour}.00–{meta.toHour}.00
            📖
          </VixText>
        )}

        {pageItems.map((d) => {
          const editable = d.id === todayId;
          return (
            <View key={d.id} style={styles.card}>
              <View style={styles.cardTop}>
                <VixText heading="label" additionalStyle={styles.cardDate}>
                  📆 {formatFullDate(dayIdToDate(d.id))}
                </VixText>
                {/* Hanya catatan HARI INI yang boleh diubah/dihapus */}
                {editable && (
                  <PressableScale onPress={() => openEdit(d)} hitSlop={10}>
                    <VixText heading="label" additionalStyle={styles.editText}>
                      Ubah
                    </VixText>
                  </PressableScale>
                )}
              </View>
              {/* "Amsal 16 (TB)" — acuannya beserta terjemahan yang dibaca.
                  Catatan lama yang belum punya kolom terjemahan tampil (TB),
                  dan itu memang benar: semuanya dibuat dari Terjemahan Baru.

                  Tiap acuan bisa di-klik SENDIRI-SENDIRI → membuka pasal itu
                  di YouVersion. Baris "Yakobus 3, Amsal 14" jadi dua tombol,
                  bukan satu: yang mau dibaca ulang biasanya cuma salah satunya.
                  Terjemahannya ikut, jadi yang terbuka bacaan yang sama persis
                  (selama nomor versinya sudah terdaftar — lihat lib/spiritual). */}
              <View style={styles.refRow}>
                {splitBibleRefs(d[session]).map((acuan, i) => {
                  const versi = d.versions[session] || BIBLE_VERSION_DEFAULT;
                  const bisa = usfmRef(acuan) !== null;
                  return (
                    <PressableScale
                      key={`${d.id}-${i}`}
                      style={[styles.refChip, !bisa && styles.refChipPlain]}
                      onPress={() => void openYouVersion(acuan, versi)}
                      disabled={!bisa}>
                      <VixText
                        heading="paragraph"
                        additionalStyle={bisa ? styles.refChipText : styles.cardText}>
                        {acuan}
                        {bisa ? ' ›' : ''}
                      </VixText>
                    </PressableScale>
                  );
                })}
                <VixText heading="paragraph" additionalStyle={styles.cardVersion}>
                  ({d.versions[session] || BIBLE_VERSION_DEFAULT})
                </VixText>
              </View>
            </View>
          );
        })}

        <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
      </ScrollView>

      {/* Sheet edit/hapus catatan hari ini */}
      <SheetModal
        visible={!!editing}
        title={`${meta.emoji} Edit ${meta.title}`}
        subtitle={editing ? formatFullDate(dayIdToDate(editing.id)) : undefined}
        onClose={() => setEditing(null)}
        footer={
          <DualButtons
            confirmLabel="Perbarui"
            busy={busy}
            onCancel={() => setEditing(null)}
            onConfirm={handleSave}
          />
        }>
        {/* Bentuknya SAMA PERSIS dengan layar Baca Alkitab: pilih kitab dari
            daftar 66, lalu pasal & ayat dari–sampai. Jadi acuan yang tersimpan
            selalu terbaca YouVersion — mengetik "yesaya 5" dengan huruf kecil
            atau salah eja dulu bisa lolos ke sini, dan pil di kartunya berhenti
            bisa di-klik tanpa penjelasan apa pun.

            `inlinePicker` — daftar kitabnya mengembang di tempat, bukan sebagai
            dialog tengah layar: sheet ini sendiri sudah sebuah modal, dan modal
            di atas modal tidak andal di iOS. */}
        <BibleRefList refs={refs} onChange={setRefs} editable={!busy} inlinePicker />

        <View style={styles.versionRow}>
          <VixText heading="label" additionalStyle={styles.versionLabel}>
            Terjemahan
          </VixText>
          <FormInput
            placeholder={BIBLE_VERSION_DEFAULT}
            value={version}
            onChangeText={setVersion}
            editable={!busy}
            autoCapitalize="characters"
            maxLength={12}
            style={styles.versionInput}
          />
        </View>

        <FormError message={formError} gap="top" />

        {/* key per hari+sesi → konfirmasi hapus ikut reset tiap ganti catatan */}
        <InlineDelete
          key={`${editing?.id}-${session}`}
          label="Hapus catatan ini…"
          busy={busy}
          onDelete={handleDelete}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: { color: Color.SPIRITUAL_DARK },
  editText: { color: Color.MAIN },
  cardText: { color: Color.TEXT_TITLE },
  // Acuan yang bisa di-klik tampil sebagai pil ungu muda — beda jelas dari
  // teks biasa, jadi kelihatan mana yang membuka YouVersion dan mana yang
  // cuma tulisan (kitab yang namanya tidak dikenali tetap tampil apa adanya).
  refRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  refChip: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  refChipPlain: { backgroundColor: 'transparent', paddingHorizontal: 0 },
  refChipText: { color: Color.SPIRITUAL_DARK },
  cardVersion: { color: Color.TEXT_LABEL },
  versionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  versionLabel: { color: Color.TEXT_LABEL },
  // Sempit: isinya cuma singkatan 2–4 huruf (TB, BIS, NIV, TSI).
  versionInput: { flex: 1, maxWidth: 140 },
});
