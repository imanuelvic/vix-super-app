import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { attentionBorder, AttentionMark } from '@/components/common/Badge';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { EmptyText } from '@/components/common/EmptyText';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SectionToggle } from '@/components/common/SectionToggle';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import { TokenPurchaseSheet } from '@/components/residence/TokenPurchaseSheet';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { usePagination } from '@/hooks/usePagination';
import { useTokenPurchaseForm } from '@/hooks/useTokenPurchaseForm';
import {
  formatCompactDate,
  formatDayDate,
  formatDecimal,
  formatTime,
  parseDecimal,
} from '@/lib/format';
import {
  currentRate,
  dailyLog,
  daysLeft,
  latestReading,
  newReadingId,
  purchasesOfMonth,
  READING_KINDS,
  readingKindMeta,
  readingTodo,
  saveMeterReadings,
  sortedReadings,
  spansOfMonth,
  summarize,
  TOKEN_LOW_DAYS,
  totalCost,
  usageSpans,
  type MeterReading,
  type ReadingKind,
  type TokenPurchase,
} from '@/lib/token';
import { formatRupiah } from '@/lib/transactions';

import { Timestamp } from 'firebase/firestore';

/** "9,5 jam" / "45 menit" — lama satu selang waktu. */
function jamLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} menit`;
  return `${formatDecimal(hours)} jam`;
}

/**
 * Anak ScrollView yang DIPATOK di atas saat digulung: judul "⚡ Riwayat
 * Pemakaian" (5).
 *
 * Urutan anaknya, dan semuanya SELALU ada (yang bersyarat dibungkus <View>
 * kosong): 0 kartu ringkas · 1 kartu sisa · 2 kartu penjelas badge ·
 * 3 baris tombol · 4 pecahan bulan ini · 5 judul Riwayat · 6 daftar Riwayat
 * (per hari; sejak 15 Sep 2026 catatan meteran ada di dalamnya, bukan daftar
 * sendiri). Menyisipkan anak baru DI ATAS nomor 5 berarti angka di sini ikut
 * digeser. Ditaruh di luar komponen supaya bukan array baru tiap render.
 */
const STICKY_HEADERS = [5];

// Sub-tab Token ⚡ — listrik prabayar.
//
// Kamu cuma mencatat SISA kWh di meteran dua kali sehari (pagi sebelum
// berangkat & sore/malam saat pulang). Dari dua titik itu app menghitung
// sendiri pemakaian, biayanya, dan sisa tokennya cukup sampai kapan.
//
// Aturan & rumusnya semua di lib/token.ts — di sini cuma tampilannya.
export function TokenTab({
  purchases,
  readings,
}: {
  purchases: TokenPurchase[];
  readings: MeterReading[];
}) {
  const { user } = useAuth();

  // Riwayat harian TERBUKA saat sub-tab ini dibuka: inilah isi utama
  // layarnya. Tombol tutupnya (di judul yang dipatok) gunanya meringkas layar
  // saat yang dicari cuma angka sisa & tombol catatnya.
  const [riwayatOpen, setRiwayatOpen] = useState(true);

  // Sheet catat meteran.
  const [editReading, setEditReading] = useState<MeterReading | 'new' | null>(null);
  const [rAt, setRAt] = useState(new Date());
  const [rKwh, setRKwh] = useState('');
  const [rKind, setRKind] = useState<ReadingKind>('home');
  const [rNote, setRNote] = useState('');
  // Penanda sibuk + pesan gagal sheet catat meteran (hook bersama).
  const { busy, formError: rError, setFormError: setRError, save, remove } = useFormSave();

  // Sheet beli token — formulirnya bersama dengan halaman Pembelian Token
  // (app/token-purchases.tsx), tempat daftar & pengubahannya tinggal sekarang.
  const beli = useTokenPurchaseForm(purchases);

  const now = new Date();
  const spans = usageSpans(readings);
  const bulanIni = summarize(spansOfMonth(spans, now.getFullYear(), now.getMonth()));
  const semua = summarize(spans);
  const rate = currentRate(purchases);
  const beliBulanIni = purchasesOfMonth(purchases, now.getFullYear(), now.getMonth());
  const sisa = latestReading(readings);
  // Perkiraan pakai rata-rata SELURUH riwayat, bukan bulan ini saja: di awal
  // bulan datanya masih terlalu sedikit untuk menebak apa pun.
  const hariLagi = daysLeft(readings, semua.perDay);
  const hampirHabis = hariLagi !== null && hariLagi <= TOKEN_LOW_DAYS;

  // Penyebab badge ⚡ di sub-tab ini — dihitung di lib/token.ts, sumber yang
  // SAMA dengan badge-nya (lihat app/residence.tsx).
  const tagihan = readingTodo(readings, now);

  // Riwayat per HARI, terbaru di atas: catatan meteran + selang pemakaian
  // yang dimulainya, dalam satu kartu per tanggal (lib/token.ts dailyLog).
  const riwayat = dailyLog(readings);
  const { currentPage, pageCount, pageItems, setPage } = usePagination(riwayat);

  const rupiah = (kwh: number) =>
    rate > 0 ? formatRupiah(Math.round(kwh * rate)) : '-';

  // ===== Catat meteran =====

  function openReadingAdd() {
    const urut = sortedReadings(readings);
    const terakhir = urut[urut.length - 1];
    setEditReading('new');
    setRAt(new Date());
    setRKwh('');
    // Ditebak bergantian dari catatan terakhir: habis "berangkat" pasti
    // "sampai rumah". Tetap bisa diubah kalau tebakannya meleset.
    setRKind(terakhir?.kind === 'home' ? 'out' : 'home');
    setRNote('');
    setRError(null);
  }

  function openReadingEdit(r: MeterReading) {
    setEditReading(r);
    setRAt(r.at.toDate());
    setRKwh(formatDecimal(r.kwh));
    setRKind(r.kind);
    setRNote(r.note);
    setRError(null);
  }

  async function saveReading() {
    if (!user || !editReading || busy) return;
    const kwh = parseDecimal(rKwh);
    if (kwh <= 0) {
      setRError('Angka meterannya diisi dulu ya.');
      return;
    }
    const data: MeterReading = {
      id: editReading === 'new' ? newReadingId() : editReading.id,
      at: Timestamp.fromDate(rAt),
      kwh,
      kind: rKind,
      note: rNote.trim(),
    };
    await save(async () => {
      await saveMeterReadings(
        user.uid,
        editReading === 'new'
          ? [...readings, data]
          : readings.map((r) => (r.id === editReading.id ? data : r)),
      );
      setEditReading(null);
    });
  }

  /** Hapus permanen — daftarnya ditulis ulang tanpa catatan ini. */
  async function deleteReading() {
    if (!user || !editReading || editReading === 'new' || busy) return;
    await remove(async () => {
      await saveMeterReadings(
        user.uid,
        readings.filter((r) => r.id !== editReading.id),
      );
      setEditReading(null);
    });
  }

  return (
    <View style={styles.flex}>
      {/* Judul "⚡ Riwayat Pemakaian" DIPATOK di atas selama daftarnya digulung
          — jadi tombol tutupnya tetap terjangkau tanpa menggulung balik lewat
          satu halaman selang waktu dulu. Pola & alasannya sama dengan Anggota
          di Fun Futsal dan CL/MT di CORE.

          `stickyHeaderIndices` menghitung ANAK LANGSUNG ScrollView, jadi
          jumlahnya tidak boleh berubah-ubah. Karena itu tiap bagian bersyarat
          di atas judulnya dibungkus <View> yang SELALU ada (isinya saja yang
          kosong) — ditulis `{syarat && …}` telanjang, anaknya lenyap saat
          syaratnya salah dan nomor patokannya meleset ke elemen lain. */}
      <ScrollView
        key={currentPage}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={STICKY_HEADERS}>
        <SummaryCard
          label="Token bulan ini"
          value={
            beliBulanIni.length > 0
              ? formatRupiah(totalCost(beliBulanIni))
              : 'Belum beli bulan ini'
          }
          sub={
            bulanIni.kwh > 0
              ? `Terpakai ${formatDecimal(bulanIni.kwh)} kWh ≈ ${rupiah(bulanIni.kwh)}`
              : 'Catat meterannya pagi & malam, biar bisa dihitung.'
          }
        />

        {/* Sisa token & perkiraan habisnya — inti layar ini. */}
        <View style={[styles.hero, hampirHabis && styles.heroLow]}>
          <VixText heading="label" additionalStyle={styles.heroLabel}>
            🔋 Sisa
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.heroValue}>
            {sisa ? `${formatDecimal(sisa.kwh)} kWh` : 'Belum dicatat'}
          </VixText>
          {sisa ? (
            <VixText heading="label" additionalStyle={styles.heroLabel}>
              Dicatat {formatCompactDate(sisa.at.toDate())} ·{' '}
              {formatTime(sisa.at.toDate())} · senilai {rupiah(sisa.kwh)}
            </VixText>
          ) : null}
          {hariLagi !== null ? (
            <VixText heading="bold" additionalStyle={styles.heroDays}>
              {hampirHabis ? '⚠️ ' : '📆 '}
              Cukup ±{formatDecimal(hariLagi)} hari lagi
              {hampirHabis ? ', siap-siap beli' : ''}
            </VixText>
          ) : null}
        </View>

        {/* Badge ⚡ cuma bilang "ada yang perlu dikerjakan"; kartu inilah yang
            menjawab "yang mana". Tanpa ini badge-nya menyala tiap hari tanpa
            pernah menyebut sebabnya — dan badge yang tidak bisa dijelaskan
            akan berhenti dipercaya, lalu diabaikan. Di-click → langsung ke
            sheet catat meteran. */}
        <View>
          {tagihan.due && (
            <PressableScale
              style={[styles.dueCard, attentionBorder(true)]}
              onPress={openReadingAdd}>
              <AttentionMark corner />
              <VixText heading="bold" additionalStyle={styles.dueTitle}>
                ⚡ Meteran hari ini{' '}
                {tagihan.count === 0
                  ? 'belum dicatat'
                  : `tercatat ${tagihan.count}×`}
              </VixText>
              <VixText heading="label" additionalStyle={styles.dueText}>
                {tagihan.missing.length > 0
                  ? `Catat meteran ${tagihan.missing
                      .map((k) => `${k.icon} ${k.label}`)
                      .join(' & ')}`
                  : 'Catat sekali lagi'}
              </VixText>
            </PressableScale>
          )}
        </View>

        <View style={styles.buttonRow}>
          <PrimaryButton
            label="Catat Meteran"
            icon="plus"
            onPress={openReadingAdd}
            additionalStyle={styles.buttonFlex}
          />
          <PrimaryButton
            label="Beli Token"
            icon="plus"
            background={Color.ACCENT}
            textColor={Color.ACCENT_DARK}
            onPress={beli.bukaBaru}
            additionalStyle={styles.buttonFlex}
          />
        </View>

        {/* Pecahan di rumah vs ditinggal — di sinilah pemborosan ketahuan. */}
        <View style={styles.bulanIniBox}>
          {bulanIni.kwh > 0 && (
            <>
              <VixText heading="title" additionalStyle={styles.sectionTitle}>
                📊 Bulan ini
              </VixText>
              <View style={styles.splitRow}>
                <View style={styles.splitBox}>
                  <VixText heading="label">🏠 Saat di rumah</VixText>
                  <VixText heading="bold" additionalStyle={styles.splitValue}>
                    {formatDecimal(bulanIni.homeKwh)} kWh
                  </VixText>
                  <VixText heading="label">{rupiah(bulanIni.homeKwh)}</VixText>
                </View>
                <View style={styles.splitBox}>
                  <VixText heading="label">🚪 Saat ditinggal</VixText>
                  <VixText heading="bold" additionalStyle={styles.splitValue}>
                    {formatDecimal(bulanIni.awayKwh)} kWh
                  </VixText>
                  <VixText heading="label">{rupiah(bulanIni.awayKwh)}</VixText>
                </View>
              </View>
              <VixText heading="label" additionalStyle={styles.hint}>
                Rata-rata {formatDecimal(bulanIni.perDay)} kWh/hari ≈{' '} {rupiah(bulanIni.perDay)} / hari {"\n"}
                Estimasi sebulan penuh {rupiah(bulanIni.perDay * 30)}
              </VixText>
            </>
          )}
        </View>

        {/* ===== Riwayat pemakaian ===== (judulnya DIPATOK, lihat
            STICKY_HEADERS). Jarak atasnya dipegang pembungkus di atas:
            SectionToggle sengaja tanpa jarak atas, supaya saat dipatok tidak
            menyisakan pita kosong. */}
        <SectionToggle
          title={`⚡ Riwayat Pemakaian (${riwayat.length} hari)`}
          open={riwayatOpen}
          onToggle={() => setRiwayatOpen((v) => !v)}
        />
        <View>
          {riwayatOpen &&
            (riwayat.length === 0 ? (
              <EmptyText>
                Belum ada. Catat meteran dua kali (pagi & malam), dari dua angka
                itu pemakaiannya baru bisa dihitung.
              </EmptyText>
            ) : (
              <>
                {/* Satu kartu per HARI (15 Sep 2026; dulu selang & catatan
                    meteran dua daftar terpisah). Kepala: tanggal + total kWh
                    & rupiah hari itu. Isi: tiap catatan meteran (jam, angka,
                    catatan; di-click → ubah), dan di bawahnya garis selang
                    "sampai catatan berikutnya habis berapa". */}
                {pageItems.map((h) => (
                  <View key={h.dayId} style={styles.dayCard}>
                    <View style={styles.dayHead}>
                      <VixText heading="bold" additionalStyle={styles.dayTitle}>
                        📆 {formatDayDate(h.date)}
                      </VixText>
                      {h.kwh > 0 ? (
                        <VixText heading="bold" additionalStyle={styles.dayKwh}>
                          {formatDecimal(h.kwh)} kWh ≈ {rupiah(h.kwh)}
                        </VixText>
                      ) : null}
                    </View>
                    {h.entries.map((e) => {
                      const meta = readingKindMeta(e.reading.kind);
                      return (
                        <View key={e.reading.id}>
                          <PressableScale
                            style={styles.readingLine}
                            onPress={() => openReadingEdit(e.reading)}>
                            <VixText heading="bold" additionalStyle={styles.readingTime}>
                              {meta.icon} {formatTime(e.reading.at.toDate())}
                            </VixText>
                            <View style={styles.readingMain}>
                              <VixText heading="bold" additionalStyle={styles.readingKwh}>
                                {formatDecimal(e.reading.kwh)} kWh · {meta.label}
                              </VixText>
                              {e.reading.note ? (
                                <VixText heading="label" additionalStyle={styles.readingNote}>
                                  📝 {e.reading.note}
                                </VixText>
                              ) : null}
                            </View>
                          </PressableScale>
                          {/* Garis selang: apa yang terjadi SESUDAH catatan ini
                              sampai catatan berikutnya. Warna garisnya ikut
                              jenisnya (di rumah = warna Residence) supaya dua
                              jenis selang kebedakan tanpa membaca. */}
                          {e.span ? (
                            <View style={[styles.spanLine, e.span.atHome && styles.spanLineHome]}>
                              <VixText heading="label" additionalStyle={styles.spanText}>
                                {e.span.atHome ? '🏠 Di rumah' : '🚪 Ditinggal'}{' '}
                                {jamLabel(e.span.hours)} · {formatDecimal(e.span.kwh)} kWh
                                {' '}≈ {rupiah(e.span.kwh)}
                              </VixText>
                            </View>
                          ) : e.refill ? (
                            <View style={styles.spanLine}>
                              <VixText heading="label" additionalStyle={styles.spanText}>
                                🔋 Token diisi sebelum catatan berikutnya
                              </VixText>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              </>
            ))}
        </View>

        {/* Daftar pembelian TIDAK di sini lagi (15 Sep 2026): ia halaman
            sendiri, app/token-purchases.tsx, lewat tombol 🧾 di pojok header
            Residence. Di sini ia paling bawah dari tiga daftar, dan yang
            paling bawah itu yang tak pernah sampai dilihat. */}
      </ScrollView>

      {/* ===== Sheet catat meteran ===== */}
      <SheetModal
        visible={!!editReading}
        title={editReading === 'new' ? 'Catat Meteran' : 'Ubah Catatan'}
        onClose={() => setEditReading(null)}>
        <View style={styles.chipWrap}>
          {READING_KINDS.map((k) => (
            <Chip
              key={k.key}
              label={`${k.icon} ${k.label}`}
              active={rKind === k.key}
              onPress={() => setRKind(k.key)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🔋 Sisa kWh di meteran
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="118,6"
          keyboardType="decimal-pad"
          value={rKwh}
          onChangeText={setRKwh}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📆 Tanggal
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={editReading === 'new' ? 'new' : editReading?.id}
            value={rAt}
            onChange={setRAt}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🕒 Jam
        </VixText>
        <View style={styles.formGap}>
          <TimeField
            key={`t-${editReading === 'new' ? 'new' : editReading?.id}`}
            value={rAt}
            onChange={setRAt}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📝 Catatan (opsional)
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. AC nyala semalaman, ada tamu"
          value={rNote}
          onChangeText={setRNote}
          editable={!busy}
        />

        <FormError message={rError} />
        <EditDelete
          editing={editReading}
          label="Hapus catatan ini"
          busy={busy}
          onDelete={deleteReading}
        />
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditReading(null)}
          onConfirm={saveReading}
        />
      </SheetModal>

      {/* ===== Sheet beli token ===== (formulir bersama, lihat hook-nya) */}
      <TokenPurchaseSheet form={beli} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  hero: {
    backgroundColor: Color.HOUSE_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 2,
    marginTop: 10,
    marginBottom: 12,
  },
  // Hampir habis → merah, supaya tidak kelewat sampai listriknya benar mati.
  heroLow: { backgroundColor: Color.DANGER },
  heroLabel: { color: Color.TEXT_ON_DARK_MUTED },
  heroValue: { color: Color.TEXT_REVERSE },
  heroDays: { color: Color.TEXT_REVERSE, marginTop: 6 },
  // Kartu penjelas badge ⚡ — bentuk kartu daftar biasa, yang membedakan cuma
  // garis merahnya (attentionBorder) & titik berdenyut di pojok.
  dueCard: { ...CARD, gap: 2, marginBottom: 10 },
  dueTitle: { color: Color.TEXT_TITLE },
  dueText: { color: Color.TEXT_LABEL },
  buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  buttonFlex: { flex: 1 },
  sectionTitle: { ...SECTION_SPACE },
  // Jarak ke judul Riwayat di bawahnya: pengganti marginTop SECTION_SPACE
  // yang sengaja tidak ada di SectionToggle (judul yang dipatok harus mepet ke
  // atas). Ditaruh di pembungkus INI, bukan di judulnya, dan tetap ada walau
  // isinya kosong: jaraknya jadi persis seperti judul bagian biasa.
  bulanIniBox: { marginBottom: SECTION_SPACE.marginTop },
  hint: { color: Color.TEXT_LABEL, marginTop: 8 },
  splitRow: { flexDirection: 'row', gap: 8 },
  splitBox: {
    ...CARD,
    flex: 1,
    gap: 2,
  },
  splitValue: { color: Color.HOUSE_DARK },
  // Kartu satu hari: kepala tanggal + total, lalu catatan & garis selangnya.
  dayCard: { ...CARD, gap: 4, marginBottom: 8 },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  dayTitle: { color: Color.TEXT_TITLE, flexShrink: 1 },
  dayKwh: { color: Color.HOUSE_DARK },
  // Baris catatan meteran (bisa di-click → ubah): jam di kiri selebar tetap
  // supaya angka kWh-nya rata satu kolom dari hari ke hari.
  readingLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  readingTime: { color: Color.HOUSE_DARK, width: 74 },
  readingMain: { flex: 1, gap: 1 },
  readingKwh: { color: Color.TEXT_TITLE },
  readingNote: { color: Color.TEXT_LABEL },
  // Garis selang di bawah catatan: menjorok & bergaris kiri seperti anak
  // tangga waktu — "dari catatan di atas sampai catatan berikutnya".
  spanLine: {
    marginLeft: 14,
    paddingLeft: 10,
    paddingVertical: 3,
    borderLeftWidth: 2,
    borderLeftColor: Color.BORDER,
  },
  // Selang saat di rumah diberi warna Residence — supaya dua jenis selang
  // langsung kebedakan tanpa harus membaca tulisannya.
  spanLineHome: { borderLeftColor: Color.HOUSE_DARK },
  spanText: { color: Color.TEXT_LABEL },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
});
