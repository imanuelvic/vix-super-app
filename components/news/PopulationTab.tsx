import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { MiniButton } from '@/components/common/MiniButton';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { SectionRow } from '@/components/common/SectionRow';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import {
  dayId as toDayId,
  dayIdToDate,
  formatShortDayDate,
  groupDigits,
  parseAmount,
} from '@/lib/format';
import { openExternalUrl } from '@/lib/linking';
import {
  allPopulationPoints,
  deletePopulationPoint,
  estimatePopulation,
  formatBillions,
  formatCount,
  pointGrowth,
  populationDue,
  populationFacts,
  populationRecordDay,
  POPULATION_SOURCE,
  savePopulationPoint,
  type PopulationSaved,
} from '@/lib/news';

// Tab Population 🌏 — perkiraan populasi dunia yang berjalan tiap detik,
// fakta laju pertambahan, dan riwayat catatan bulanan.
//
// Catatannya diisi TANGAN tiap awal bulan: angka yang kamu salin dari
// worldometers. Tiap tanggal 1 badge News menyala sampai bulan itu tercatat —
// aturannya di `populationDue`, dipakai bareng tile Home & Dashboard.
export function PopulationTab({ saved }: { saved: PopulationSaved }) {
  const { user } = useAuth();
  const { busy, formError, setFormError, save, remove } = useFormSave();

  // Angka "hidup" — dihitung ulang tiap 3 detik supaya terasa berjalan.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 3_000);
    return () => clearInterval(t);
  }, []);

  const [open, setOpen] = useState(false);
  /** dayId yang sedang diubah — null = catatan baru. */
  const [edit, setEdit] = useState<string | null>(null);
  const [fTanggal, setFTanggal] = useState(() => populationRecordDay(now));
  const [fJumlah, setFJumlah] = useState('');

  const points = allPopulationPoints(saved);
  const { setPage, currentPage, pageCount, pageItems } = usePagination(points);
  const live = estimatePopulation(now);
  const perluCatat = populationDue(saved, now) > 0;

  function bukaBaru() {
    setEdit(null);
    // Tanggal 1 bulan ini — tanggal yang memang dicatat tiap bulan.
    setFTanggal(populationRecordDay(new Date()));
    setFJumlah('');
    setFormError(null);
    setOpen(true);
  }

  function bukaUbah(dayId: string) {
    setEdit(dayId);
    setFTanggal(dayIdToDate(dayId));
    setFJumlah(groupDigits(String(saved[dayId])));
    setFormError(null);
    setOpen(true);
  }

  async function simpan() {
    if (!user || busy) return;
    const jumlah = parseAmount(fJumlah);
    if (jumlah <= 0) {
      setFormError('Angkanya diisi dulu — salin dari worldometers.info.');
      return;
    }
    const dayId = toDayId(fTanggal);
    await save(async () => {
      // Tanggalnya digeser saat mengubah → baris lamanya ikut dibuang, kalau
      // tidak catatan yang sama muncul dua kali dengan dua tanggal berbeda.
      if (edit && edit !== dayId) await deletePopulationPoint(user.uid, saved, edit);
      await savePopulationPoint(user.uid, dayId, jumlah);
      setOpen(false);
    });
  }

  async function hapus() {
    if (!user || !edit || busy) return;
    await remove(async () => {
      await deletePopulationPoint(user.uid, saved, edit);
      setOpen(false);
    });
  }

  return (
    <>
      <ScrollView key={currentPage} contentContainerStyle={styles.content}>
        {/* Penghitung besar */}
        <View style={styles.hero}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            🌏 Perkiraan Populasi Dunia
          </VixText>
          <VixText heading="header" additionalStyle={styles.heroValue}>
            {formatCount(live)}
          </VixText>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            ± {formatBillions(live)} jiwa · {formatShortDayDate(now)}
          </VixText>
        </View>

        {/* Fakta laju pertambahan */}
        <View style={styles.factRow}>
          {populationFacts().map((f) => (
            <View key={f.label} style={styles.factTile}>
              <VixText additionalStyle={styles.factIcon}>{f.icon}</VixText>
              <VixText heading="bold" additionalStyle={styles.factValue}>
                {f.value}
              </VixText>
              <VixText heading="label" additionalStyle={styles.factLabel}>
                {f.label}
              </VixText>
            </View>
          ))}
        </View>

        {/* Bulan ini belum dicatat → diberitahu di sini juga, bukan cuma lewat
            badge merah di Home: yang membuka layar ini justru sedang di depan
            angkanya. */}
        {perluCatat && (
          <PressableScale style={styles.dueCard} onPress={bukaBaru}>
            <VixText heading="bold" additionalStyle={styles.dueText}>
              🗓️ Catatan bulan ini belum diisi
            </VixText>
            <VixText heading="label" additionalStyle={styles.dueText}>
              Buka worldometers, salin angkanya, lalu klik di sini.
            </VixText>
          </PressableScale>
        )}

        {/* Sumbernya sengaja sebaris dengan tombol tambah: satu klik untuk
            melihat angkanya, satu klik lagi untuk mencatatnya. */}
        <SectionRow
          title={`📜 Riwayat Catatan (${points.length})`}
          right={
            <>
              <MiniButton
                label="🔗 Sumber"
                onPress={() => openExternalUrl(POPULATION_SOURCE)}
              />
              <MiniButton label="+ Tambah" onPress={bukaBaru} />
            </>
          }
        />

        {pageItems.map((p) => {
          const index = points.indexOf(p);
          const growth = pointGrowth(points, index);
          // Cuma catatan tanganmu yang bisa diubah; deretan bawaan di kode
          // memang tetap.
          const milikku = saved[p.dayId] !== undefined;
          return (
            <PressableScale
              key={p.dayId}
              style={styles.row}
              disabled={!milikku}
              onPress={() => bukaUbah(p.dayId)}>
              <View style={styles.rowMain}>
                <VixText heading="bold" additionalStyle={styles.rowCount}>
                  {formatCount(p.count)}
                </VixText>
                <VixText heading="label">
                  📆 {formatShortDayDate(dayIdToDate(p.dayId))}
                  {milikku ? ' · catatanku' : ''}
                </VixText>
              </View>
              {growth !== null && (
                <VixText heading="label" additionalStyle={styles.rowGrowth}>
                  +{formatCount(growth)}
                </VixText>
              )}
            </PressableScale>
          );
        })}

        <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
      </ScrollView>

      <SheetModal
        visible={open}
        title={edit ? 'Ubah Catatan Populasi' : 'Catat Populasi'}
        subtitle="Angka dari worldometers.info"
        onClose={() => setOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={busy}
            onCancel={() => setOpen(false)}
            onConfirm={simpan}
          />
        }>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🗓️ Tanggal
        </VixText>
        <DateField key={edit ?? 'baru'} value={fTanggal} onChange={setFTanggal} />

        <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
          🌏 Jumlah jiwa
        </VixText>
        <FormInput
          placeholder="mis. 8.309.930.650"
          keyboardType="number-pad"
          value={fJumlah}
          onChangeText={(t) => setFJumlah(groupDigits(t))}
          editable={!busy}
        />

        <FormError message={formError} gap="top" />
        {edit && (
          <InlineDelete
            key={edit}
            label="Hapus catatan ini"
            busy={busy}
            onDelete={hapus}
          />
        )}
      </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  hero: {
    backgroundColor: Color.NEWS_DARK,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  heroValue: { color: Color.TEXT_REVERSE },
  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  factTile: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    gap: 1,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  factIcon: { fontSize: 20, lineHeight: 26 },
  factValue: { color: Color.TEXT_TITLE, textAlign: 'center' },
  factLabel: { textAlign: 'center' },
  // Ajakan mencatat: pastel News bergaris tepi — bentuk yang sama dengan
  // kartu "pintu ke halaman lain" di fitur lain.
  dueCard: {
    backgroundColor: Color.NEWS,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.NEWS_DARK,
    padding: 14,
    gap: 2,
  },
  dueText: { color: Color.NEWS_DARK },
  row: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rowMain: { flex: 1, gap: 1 },
  rowCount: { color: Color.TEXT_TITLE },
  rowGrowth: { color: Color.NEWS_DARK },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginTop: 10 },
});
