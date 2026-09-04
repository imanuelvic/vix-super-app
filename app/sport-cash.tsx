import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SelectField } from '@/components/common/SelectField';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import { useSportData } from '@/hooks/useSportData';
import {
  dayId as toDayId,
  dayIdToDate,
  formatShortDayDate,
  groupDigits,
  parseAmount,
} from '@/lib/format';
import {
  cashBalance,
  cashTotal,
  gangCash,
  gangMeta,
  newSportId,
  saveSport,
  SPORT_GANGS,
  type SportCashDirection,
  type SportCashEntry,
  type SportGangKey,
} from '@/lib/sport';
import { formatRupiah } from '@/lib/transactions';

// Kas Tim 💰 — Saku 👛 versi uang bersama.
//
// Bentuknya sengaja mengikuti Saku di Finance (saldo berjalan + mutasi masuk &
// keluar), tapi ada satu beda yang penting dan itu bukan soal tampilan: uang di
// sini BUKAN uangmu. Kamu cuma memegangnya. Karena itu tiap mutasi wajib
// berjudul, dan saldo tiap geng berdiri sendiri — kas CORE tidak boleh
// menambal kas F3 tanpa ada barisnya.
//
// Uang dari iuran main tidak diketik ulang di sini: layar sesi punya tombol
// "Setor ke Kas" yang mencatatnya sendiri, lengkap dengan penanda sesi asalnya
// supaya uang yang sama tak pernah masuk dua kali (lihat sessionCashIn).
const ARAH: { key: SportCashDirection; label: string; sub: string }[] = [
  { key: 'in', label: '⬇️ Masuk', sub: 'Iuran, denda, sisa patungan, sumbangan' },
  { key: 'out', label: '⬆️ Keluar', sub: 'Sewa lapangan, bola, rompi, air minum' },
];

export default function SportCashScreen() {
  const { user } = useAuth();

  const { data, isi, error } = useSportData();
  const { busy, formError, setFormError, save, remove } = useFormSave();

  const [gang, setGang] = useState<SportGangKey>('f3');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SportCashEntry | null>(null);
  const [fArah, setFArah] = useState<SportCashDirection>('in');
  const [fJudul, setFJudul] = useState('');
  const [fJumlah, setFJumlah] = useState('');
  const [fTanggal, setFTanggal] = useState(new Date());
  const [fCatatan, setFCatatan] = useState('');

  const meta = gangMeta(gang);
  const mutasi = gangCash(isi, gang);
  const saldo = cashBalance(isi, gang);
  const { currentPage, pageCount, pageItems, setPage } = usePagination(mutasi);

  function bukaBaru() {
    setEdit(null);
    setFArah('in');
    setFJudul('');
    setFJumlah('');
    setFTanggal(new Date());
    setFCatatan('');
    setFormError(null);
    setOpen(true);
  }

  function bukaUbah(c: SportCashEntry) {
    setEdit(c);
    setFArah(c.direction);
    setFJudul(c.title);
    setFJumlah(c.amount ? groupDigits(String(c.amount)) : '');
    setFTanggal(dayIdToDate(c.dayId));
    setFCatatan(c.note);
    setFormError(null);
    setOpen(true);
  }

  async function simpan() {
    if (!user || !data || busy) return;
    const jumlah = parseAmount(fJumlah);
    if (!fJudul.trim()) {
      setFormError('Judulnya diisi dulu — kas bersama tanpa keterangan itu yang bikin ribut.');
      return;
    }
    if (jumlah <= 0) {
      setFormError('Jumlahnya diisi dulu ya.');
      return;
    }
    const baris: SportCashEntry = {
      // Penanda sesi asal (kalau ada) DIPERTAHANKAN saat diubah — kalau hilang,
      // iuran sesi itu terlihat belum masuk kas dan bisa disetor dua kali.
      ...(edit?.sessionId ? { sessionId: edit.sessionId } : {}),
      id: edit?.id ?? newSportId(new Date()),
      gang,
      dayId: toDayId(fTanggal),
      title: fJudul.trim(),
      direction: fArah,
      amount: jumlah,
      note: fCatatan.trim(),
    };
    await save(async () => {
      await saveSport(user.uid, {
        ...data,
        cash: edit
          ? data.cash.map((c) => (c.id === edit.id ? baris : c))
          : [...data.cash, baris],
      });
      setOpen(false);
    });
  }

  async function hapus() {
    if (!user || !data || !edit || busy) return;
    await remove(async () => {
      await saveSport(user.uid, {
        ...data,
        cash: data.cash.filter((c) => c.id !== edit.id),
      });
      setOpen(false);
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Friends"
        title="Kas Tim 💰"
        subtitle="Uang bersama tiap geng — masuk, keluar & sisanya."
      />

      <ScreenError message={error} />

      {data === null ? (
        <LoadingCenter />
      ) : (
        <View style={styles.flex}>
          <ScrollView
            key={`${gang}-${currentPage}`}
            contentContainerStyle={styles.content}>
            {/* Total SEMUA geng — inilah angka yang dicari saat membuka
                halaman ini: berapa uang orang lain yang sedang kamu pegang. */}
            <SummaryCard>
              <VixText heading="label" additionalStyle={summaryText.label}>
                💰 Total kas semua tim
              </VixText>
              <VixText heading="subheader" additionalStyle={summaryText.value}>
                {formatRupiah(cashTotal(isi))}
              </VixText>
              <VixText heading="label" additionalStyle={summaryText.label}>
                {SPORT_GANGS.map(
                  (g) => `${g.emoji} ${g.label} ${formatRupiah(cashBalance(isi, g.key))}`,
                ).join('  ·  ')}
              </VixText>
            </SummaryCard>

            <SegmentTabs
              tabs={SPORT_GANGS.map((g) => ({
                key: g.key,
                label: `${g.emoji} ${g.label}`,
                sub: formatRupiah(cashBalance(isi, g.key)),
              }))}
              value={gang}
              onChange={setGang}
            />

            <View style={styles.saldoCard}>
              <VixText heading="label">Saldo kas {meta.label}</VixText>
              <VixText
                heading="subheader"
                additionalStyle={saldo < 0 ? styles.saldoMinus : styles.saldo}>
                {formatRupiah(saldo)}
              </VixText>
              {saldo < 0 && (
                <VixText heading="label" additionalStyle={styles.saldoWarn}>
                  ⚠️ Minus — pengeluaran melebihi yang terkumpul. Biasanya ada
                  iuran yang belum disetor ke kas.
                </VixText>
              )}
            </View>

            <PrimaryButton
              label="Catat Kas"
              icon="plus"
              onPress={bukaBaru}
              additionalStyle={styles.addButton}
            />

            <FormError message={formError} gap="top" />

            <VixText heading="title" additionalStyle={styles.sectionTitle}>
              🧾 Mutasi {meta.label}
            </VixText>
            {mutasi.length === 0 ? (
              <VixText heading="label" additionalStyle={styles.empty}>
                Belum ada mutasi kas {meta.label}.
              </VixText>
            ) : (
              <>
                {pageItems.map((c) => {
                  const masuk = c.direction === 'in';
                  return (
                    <PressableScale
                      key={c.id}
                      style={styles.row}
                      onPress={() => bukaUbah(c)}>
                      <View style={styles.rowMain}>
                        <VixText heading="bold" additionalStyle={styles.rowTitle}>
                          {c.title}
                        </VixText>
                        <VixText heading="label">
                          🗓️ {formatShortDayDate(dayIdToDate(c.dayId))}
                          {c.sessionId ? ' · dari iuran main' : ''}
                        </VixText>
                        {c.note ? (
                          <VixText heading="label" additionalStyle={styles.rowNote}>
                            {c.note}
                          </VixText>
                        ) : null}
                      </View>
                      <VixText
                        heading="bold"
                        additionalStyle={masuk ? styles.masuk : styles.keluar}>
                        {masuk ? '+' : '−'}
                        {formatRupiah(c.amount)}
                      </VixText>
                    </PressableScale>
                  );
                })}
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              </>
            )}
          </ScrollView>
        </View>
      )}

      <SheetModal
        visible={open}
        title={edit ? 'Ubah Mutasi Kas' : 'Catat Kas'}
        subtitle={`${meta.emoji} ${meta.label}`}
        onClose={() => setOpen(false)}
        footer={
          <DualButtons
            confirmLabel="Simpan"
            busy={busy}
            onCancel={() => setOpen(false)}
            onConfirm={simpan}
          />
        }>
        <SelectField
          value={fArah}
          options={ARAH}
          onChange={(key) => key && setFArah(key)}
        />

        <FormInput
          style={styles.formGap}
          placeholder="Judul (mis. Sewa lapangan Elang, Iuran 22 Sep)"
          value={fJudul}
          onChangeText={setFJudul}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
          💵 Jumlah
        </VixText>
        <MoneyInput
          placeholder="mis. 300.000"
          value={fJumlah}
          onChangeText={(t) => setFJumlah(groupDigits(t))}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
          🗓️ Tanggal
        </VixText>
        <DateField
          key={edit?.id ?? 'baru'}
          value={fTanggal}
          onChange={setFTanggal}
        />

        <FormInput
          style={styles.formGap}
          placeholder="Catatan (opsional)"
          value={fCatatan}
          onChangeText={setFCatatan}
          editable={!busy}
          multiline
        />

        <FormError message={formError} gap="top" />
        {edit && (
          <InlineDelete
            key={edit.id}
            label="Hapus mutasi ini"
            busy={busy}
            onDelete={hapus}
          />
        )}
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  saldoCard: { ...CARD, marginTop: 10, gap: 2 },
  saldo: { color: Color.TEXT_TITLE },
  saldoMinus: { color: Color.DANGER },
  saldoWarn: { color: Color.DANGER },
  addButton: { marginTop: 10 },
  sectionTitle: { ...SECTION_SPACE },
  empty: { textAlign: 'center', marginVertical: 10 },
  row: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rowMain: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { color: Color.TEXT_TITLE },
  rowNote: { color: Color.TEXT_PLACEHOLDER },
  masuk: { color: Color.SUCCESS },
  keluar: { color: Color.DANGER },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginTop: 10 },
});
