import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT_PINNED } from '@/assets/style/layout';
import { SECTION_SPACE, SECTION_SPACE_FIRST } from '@/assets/style/section';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EmptyText } from '@/components/common/EmptyText';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { SoftPill } from '@/components/common/SoftPill';
import { StickyTop } from '@/components/common/StickyTop';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { useLive } from '@/hooks/useLive';
import { dayIdToDate, formatShortDayDate } from '@/lib/format';
import { dayDocId } from '@/lib/health';
import {
  deleteTestimony,
  newTestimonyId,
  saveTestimony,
  seedTestimonies,
  subscribeTestimonies,
  testimonyKindMeta,
  testimonyYears,
  TESTIMONY_KINDS,
  type Testimony,
  type TestimonyKind,
} from '@/lib/testimony';

// Sub-tab 🪨 Testimony — batu peringatan.
//
//   "Sampai di sini TUHAN menolong kita." (1 Samuel 7:12)
//
// Daftarnya dikelompokkan PER TAHUN dengan sengaja: satu daftar panjang cuma
// menjawab "apa saja", sedangkan per tahun menjawab yang sebenarnya dicari —
// "tahun itu Tuhan menolong lewat apa saja?".
//
// Langganannya di dalam komponen ini, bukan di layar Walk: sub-tab hanya
// digambar saat dibuka, jadi arsip ini tidak ikut dibaca tiap kali tab
// Spiritual disentuh.

const AYAT = 'Sampai di sini TUHAN menolong kita. (1 Samuel 7:12)';

/** null = sheet tertutup · 'new' = catatan baru · Testimony = sedang diubah. */
type Editing = 'new' | Testimony | null;

export function TestimonyTab() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [list] = useLive<Testimony[]>(subscribeTestimonies, { onError: setError });

  const [editing, setEditing] = useState<Editing>(null);
  const { busy, formError, setFormError, save, remove } = useFormSave();
  const [seeding, setSeeding] = useState(false);

  // Isian sheet.
  const [fDate, setFDate] = useState<Date | null>(null);
  const [fKind, setFKind] = useState<TestimonyKind>('mark');
  const [fTitle, setFTitle] = useState('');
  const [fStory, setFStory] = useState('');

  function buka(item: Editing) {
    setFormError(null);
    if (item === 'new') {
      setFDate(new Date());
      setFKind('mark');
      setFTitle('');
      setFStory('');
    } else if (item) {
      setFDate(dayIdToDate(item.dayId));
      setFKind(item.kind);
      setFTitle(item.title);
      setFStory(item.story);
    }
    setEditing(item);
  }

  function simpan() {
    if (!user || !editing) return;
    if (!fDate) {
      setFormError('Pilih dulu tanggal kejadiannya.');
      return;
    }
    if (!fTitle.trim()) {
      setFormError('Tulis dulu apa yang terjadi hari itu.');
      return;
    }
    const isi: Testimony = {
      id: editing === 'new' ? newTestimonyId() : editing.id,
      dayId: dayDocId(fDate),
      kind: fKind,
      title: fTitle.trim(),
      story: fStory.trim(),
    };
    return save(async () => {
      await saveTestimony(user.uid, isi);
      setEditing(null);
    });
  }

  function hapus() {
    if (!user || !editing || editing === 'new') return;
    const { id } = editing;
    return remove(async () => {
      await deleteTestimony(user.uid, id);
      setEditing(null);
    });
  }

  /** Empat catatan pertama yang didiktekan pemilik app — sekali saja. */
  function isiAwal() {
    if (!user || seeding) return;
    setSeeding(true);
    setError(null);
    seedTestimonies(user.uid)
      .catch(() => setError('Gagal menulis catatan awal. Coba lagi.'))
      .finally(() => setSeeding(false));
  }

  if (list === null) return <LoadingCenter />;

  const tahunan = testimonyYears(list);

  return (
    <View style={styles.flex}>
      {/* Dipatok di atas seperti Jadwalkan Visitasi & Buat Rapat Bulanan:
          tombolnya tetap terjangkau walau arsipnya sudah bertahun-tahun.
          Kartu ringkasan "x tanggal dicatat" DIHAPUS (28 Sep 2026): angkanya
          toh terbaca sendiri dari daftar per tahun di bawahnya, dan
          menyingkirkannya membuat catatan pertama muncul lebih awal. */}
      <StickyTop>
        <PrimaryButton
          label="Catat Tanggal Penting"
          icon="plus"
          onPress={() => buka('new')}
        />
      </StickyTop>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <FormError message={error} /> : null}

        {list.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyText>
              Belum ada yang dicatat. Mulai dari satu tanggal yang tidak ingin
              kamu lupakan.
            </EmptyText>
            {/* Cuma muncul selama arsipnya masih kosong: keempat catatan ini
                sudah pernah kamu sebutkan, jadi tidak perlu diketik ulang. */}
            <SoftPill
              label={seeding ? 'Menulis…' : '📥 Isi 4 catatan awal'}
              busy={seeding}
              onPress={isiAwal}
              additionalStyle={styles.seedPill}
            />
          </View>
        ) : null}

        {tahunan.map((tahun, iTahun) => (
          <View key={tahun.year}>
            {/* Tahun PERTAMA tidak menambah jarak atasnya sendiri: jarak ke
                tombol yang dipatok sudah milik bar patoknya. Tahun berikutnya
                tetap bernapas penuh — di situ ia memang pemisah antara dua
                daftar. */}
            <VixText
              heading="title"
              additionalStyle={[
                styles.yearTitle,
                iTahun === 0 && styles.yearTitleFirst,
              ]}>
              {tahun.year}
            </VixText>
            {tahun.items.map((t) => {
              const meta = testimonyKindMeta(t.kind);
              return (
                <PressableScale
                  key={t.id}
                  style={styles.card}
                  onPress={() => buka(t)}>
                  <View style={styles.cardTop}>
                    <VixText heading="label" additionalStyle={styles.kindChip}>
                      {meta.emoji} {meta.label}
                    </VixText>
                    <VixText heading="label" additionalStyle={styles.dateText}>
                      {formatShortDayDate(dayIdToDate(t.dayId))}
                    </VixText>
                  </View>
                  <VixText heading="bold" additionalStyle={styles.cardTitle}>
                    {t.title}
                  </VixText>
                  {t.story ? (
                    <VixText
                      heading="paragraph"
                      numberOfLines={3}
                      additionalStyle={styles.cardStory}>
                      {t.story}
                    </VixText>
                  ) : null}
                </PressableScale>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <SheetModal
        visible={editing !== null}
        title={editing === 'new' ? 'Catat Tanggal Penting' : 'Ubah Catatan'}
        subtitle={AYAT}
        onClose={() => setEditing(null)}>
        <View style={styles.formGap}>
          <DateField
            value={fDate}
            onChange={setFDate}
            placeholder="Kapan kejadiannya?"
            maximumDate={new Date()}
          />
        </View>

        {/* Jenisnya dipilih SESUDAH tanggalnya: yang diingat lebih dulu
            biasanya harinya, bukan kategorinya. */}
        <View style={[styles.chips, styles.formGap]}>
          {TESTIMONY_KINDS.map((k) => (
            <Chip
              key={k.key}
              label={`${k.emoji} ${k.label}`}
              active={fKind === k.key}
              onPress={() => setFKind(k.key)}
            />
          ))}
        </View>
        <VixText heading="label" additionalStyle={[styles.hint, styles.formGap]}>
          {testimonyKindMeta(fKind).hint}
        </VixText>

        <FormInput
          style={styles.formGap}
          placeholder="Apa yang terjadi hari itu?"
          value={fTitle}
          onChangeText={setFTitle}
          editable={!busy}
        />
        <FormInput
          style={[styles.formGap, styles.storyInput]}
          placeholder="Ceritanya (opsional). Tulis juga bagian yang cuma kamu yang tahu."
          value={fStory}
          onChangeText={setFStory}
          multiline
          editable={!busy}
        />

        {editing !== null && editing !== 'new' ? (
          <InlineDelete
            key={editing.id}
            label="Hapus catatan…"
            busy={busy}
            onDelete={hapus}
          />
        ) : null}

        <FormError message={formError} />
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={simpan}
        />
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { ...SCREEN_CONTENT_PINNED, paddingBottom: 32 },
  emptyWrap: { alignItems: 'center' },
  seedPill: { marginTop: 4 },
  yearTitle: { ...SECTION_SPACE, color: Color.SPIRITUAL_DARK },
  yearTitleFirst: { ...SECTION_SPACE_FIRST },
  card: { ...CARD, gap: 4, marginBottom: 8 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  kindChip: { color: Color.SPIRITUAL_DARK },
  dateText: { color: Color.TEXT_LABEL },
  cardTitle: { color: Color.TEXT_TITLE },
  cardStory: { color: Color.TEXT_PARAGRAPH },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: Color.TEXT_LABEL },
  formGap: { marginBottom: 12 },
  storyInput: { minHeight: 96, textAlignVertical: 'top' },
});
