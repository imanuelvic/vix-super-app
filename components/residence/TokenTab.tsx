import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import {
  formatCompactDate,
  formatDecimal,
  formatTime,
  groupDigits,
  parseAmount,
  parseDecimal,
} from '@/lib/format';
import { SAVE_ERROR } from '@/lib/messages';
import {
  currentRate,
  daysLeft,
  latestReading,
  newPurchaseId,
  newReadingId,
  purchasesOfMonth,
  READING_KINDS,
  readingKindMeta,
  saveMeterReadings,
  saveTokenPurchases,
  sortedReadings,
  spansOfMonth,
  summarize,
  TOKEN_LOW_DAYS,
  TOKEN_PLATFORMS,
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

  const [busy, setBusy] = useState(false);

  // Sheet catat meteran.
  const [editReading, setEditReading] = useState<MeterReading | 'new' | null>(null);
  const [rAt, setRAt] = useState(new Date());
  const [rKwh, setRKwh] = useState('');
  const [rKind, setRKind] = useState<ReadingKind>('home');
  const [rNote, setRNote] = useState('');
  const [rError, setRError] = useState<string | null>(null);

  // Sheet beli token.
  const [editBuy, setEditBuy] = useState<TokenPurchase | 'new' | null>(null);
  const [bDate, setBDate] = useState(new Date());
  const [bCost, setBCost] = useState('');
  const [bKwh, setBKwh] = useState('');
  const [bPlatform, setBPlatform] = useState(TOKEN_PLATFORMS[0]);
  const [bNote, setBNote] = useState('');
  const [bError, setBError] = useState<string | null>(null);

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

  // Riwayat selang waktu, terbaru di atas.
  const riwayat = [...spans].reverse();
  const { currentPage, pageCount, pageItems, setPage } = usePagination(riwayat);

  const rupiah = (kwh: number) =>
    rate > 0 ? formatRupiah(Math.round(kwh * rate)) : '—';

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
    setBusy(true);
    setRError(null);
    const data: MeterReading = {
      id: editReading === 'new' ? newReadingId() : editReading.id,
      at: Timestamp.fromDate(rAt),
      kwh,
      kind: rKind,
      note: rNote.trim(),
    };
    try {
      await saveMeterReadings(
        user.uid,
        editReading === 'new'
          ? [...readings, data]
          : readings.map((r) => (r.id === editReading.id ? data : r)),
      );
      setEditReading(null);
    } catch {
      setRError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  /** Hapus permanen — daftarnya ditulis ulang tanpa catatan ini. */
  async function deleteReading() {
    if (!user || !editReading || editReading === 'new' || busy) return;
    setBusy(true);
    try {
      await saveMeterReadings(
        user.uid,
        readings.filter((r) => r.id !== editReading.id),
      );
      setEditReading(null);
    } catch {
      setRError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  // ===== Beli token =====

  function openBuyAdd() {
    setEditBuy('new');
    setBDate(new Date());
    setBCost('');
    setBKwh('');
    setBPlatform(TOKEN_PLATFORMS[0]);
    setBNote('');
    setBError(null);
  }

  function openBuyEdit(p: TokenPurchase) {
    setEditBuy(p);
    setBDate(p.date.toDate());
    setBCost(groupDigits(String(p.cost)));
    setBKwh(formatDecimal(p.kwh));
    setBPlatform(p.platform || TOKEN_PLATFORMS[0]);
    setBNote(p.note);
    setBError(null);
  }

  async function saveBuy() {
    if (!user || !editBuy || busy) return;
    const cost = parseAmount(bCost);
    const kwh = parseDecimal(bKwh);
    if (cost <= 0 || kwh <= 0) {
      setBError('Biaya & kWh-nya diisi dua-duanya — itu yang jadi harga per kWh.');
      return;
    }
    setBusy(true);
    setBError(null);
    const data: TokenPurchase = {
      id: editBuy === 'new' ? newPurchaseId() : editBuy.id,
      date: Timestamp.fromDate(bDate),
      cost,
      kwh,
      platform: bPlatform,
      note: bNote.trim(),
    };
    try {
      await saveTokenPurchases(
        user.uid,
        editBuy === 'new'
          ? [...purchases, data]
          : purchases.map((p) => (p.id === editBuy.id ? data : p)),
      );
      setEditBuy(null);
    } catch {
      setBError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function deleteBuy() {
    if (!user || !editBuy || editBuy === 'new' || busy) return;
    setBusy(true);
    try {
      await saveTokenPurchases(
        user.uid,
        purchases.filter((p) => p.id !== editBuy.id),
      );
      setEditBuy(null);
    } catch {
      setBError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScrollView key={currentPage} contentContainerStyle={styles.content}>
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
            🔋 Sisa di meteran
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
              {hampirHabis ? ' — siap-siap beli' : ''}
            </VixText>
          ) : null}
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
            onPress={openBuyAdd}
            additionalStyle={styles.buttonFlex}
          />
        </View>

        {/* Pecahan di rumah vs ditinggal — di sinilah pemborosan ketahuan. */}
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
              Rata-rata {formatDecimal(bulanIni.perDay)} kWh/hari ≈{' '}
              {rupiah(bulanIni.perDay)}/hari. Kalau segini terus sebulan penuh,
              perkiraannya {rupiah(bulanIni.perDay * 30)}.
            </VixText>
          </>
        )}

        {/* ===== Riwayat pemakaian ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          ⚡ Riwayat pemakaian
        </VixText>
        {riwayat.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada. Catat meteran dua kali (pagi & malam) — dari dua angka
            itu pemakaiannya baru bisa dihitung.
          </VixText>
        ) : (
          <>
            {pageItems.map((s) => (
              <View
                key={s.to.id}
                style={[styles.spanRow, s.atHome && styles.spanRowHome]}>
                <View style={styles.spanMain}>
                  <VixText heading="bold" additionalStyle={styles.spanTitle}>
                    {s.atHome ? '🏠 Di rumah' : '🚪 Ditinggal'} ·{' '}
                    {jamLabel(s.hours)}
                  </VixText>
                  <VixText heading="label">
                    {formatCompactDate(s.from.at.toDate())}{' '}
                    {formatTime(s.from.at.toDate())} →{' '}
                    {formatTime(s.to.at.toDate())}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.spanRate}>
                    {formatDecimal(s.perHour)} kWh/jam
                  </VixText>
                </View>
                <View style={styles.spanRight}>
                  <VixText heading="bold" additionalStyle={styles.spanKwh}>
                    {formatDecimal(s.kwh)} kWh
                  </VixText>
                  <VixText heading="label">{rupiah(s.kwh)}</VixText>
                </View>
              </View>
            ))}
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onChange={setPage}
            />
          </>
        )}

        {/* ===== Catatan meteran (untuk dibetulkan kalau salah ketik) ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          📋 Catatan meteran
        </VixText>
        {[...sortedReadings(readings)].reverse().slice(0, 8).map((r) => {
          const meta = readingKindMeta(r.kind);
          return (
            <PressableScale
              key={r.id}
              style={styles.readingRow}
              onPress={() => openReadingEdit(r)}>
              <View style={styles.spanMain}>
                <VixText heading="bold" additionalStyle={styles.spanTitle}>
                  {meta.icon} {formatDecimal(r.kwh)} kWh
                </VixText>
                <VixText heading="label">
                  {formatCompactDate(r.at.toDate())} ·{' '}
                  {formatTime(r.at.toDate())} · {meta.label}
                </VixText>
              </View>
            </PressableScale>
          );
        })}

        {/* ===== Pembelian ===== */}
        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🧾 Pembelian token
        </VixText>
        {purchases.length === 0 ? (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada. Catat sekali saja, biar app tahu harga per kWh-mu.
          </VixText>
        ) : (
          [...purchases]
            .sort((a, b) => b.date.toMillis() - a.date.toMillis())
            .map((p) => (
              <PressableScale
                key={p.id}
                style={styles.readingRow}
                onPress={() => openBuyEdit(p)}>
                <View style={styles.spanMain}>
                  <VixText heading="bold" additionalStyle={styles.spanTitle}>
                    {formatRupiah(p.cost)} · {formatDecimal(p.kwh)} kWh
                  </VixText>
                  <VixText heading="label">
                    {formatCompactDate(p.date.toDate())} · {p.platform} ·{' '}
                    {formatRupiah(Math.round(p.cost / p.kwh))}/kWh
                  </VixText>
                </View>
              </PressableScale>
            ))
        )}
      </ScrollView>

      {/* ===== Sheet catat meteran ===== */}
      <SheetModal
        visible={!!editReading}
        title={editReading === 'new' ? 'Catat Meteran' : 'Ubah Catatan'}
        subtitle="Angka sisa kWh yang terbaca di meteran"
        onClose={() => setEditReading(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Sedang apa?
        </VixText>
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
        <VixText heading="label" additionalStyle={styles.hintTight}>
          {readingKindMeta(rKind).hint}. Ini yang menentukan selang waktunya
          dihitung sebagai pemakaian saat di rumah atau saat ditinggal.
        </VixText>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🔋 Sisa kWh di meteran
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. 118,6"
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

      {/* ===== Sheet beli token ===== */}
      <SheetModal
        visible={!!editBuy}
        title={editBuy === 'new' ? 'Beli Token' : 'Ubah Pembelian'}
        subtitle="Dari sini app tahu harga per kWh-mu"
        onClose={() => setEditBuy(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          💰 Yang dibayar (termasuk admin)
        </VixText>
        <MoneyInput
          style={styles.formGap}
          placeholder="mis. 200.300"
          value={bCost}
          onChangeText={(t) => setBCost(groupDigits(t))}
          editable={!busy}
        />

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          ⚡ kWh yang masuk
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="mis. 114,96"
          keyboardType="decimal-pad"
          value={bKwh}
          onChangeText={setBKwh}
          editable={!busy}
        />
        {parseAmount(bCost) > 0 && parseDecimal(bKwh) > 0 ? (
          <VixText heading="label" additionalStyle={styles.hintTight}>
            Berarti{' '}
            {formatRupiah(Math.round(parseAmount(bCost) / parseDecimal(bKwh)))}
            /kWh.
          </VixText>
        ) : null}

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Beli lewat
        </VixText>
        <View style={styles.chipWrap}>
          {TOKEN_PLATFORMS.map((p) => (
            <Chip
              key={p}
              label={p}
              active={bPlatform === p}
              onPress={() => setBPlatform(p)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📆 Tanggal
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={`b-${editBuy === 'new' ? 'new' : editBuy?.id}`}
            value={bDate}
            onChange={setBDate}
          />
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📝 Catatan (opsional)
        </VixText>
        <FormInput
          style={styles.formGap}
          placeholder="Catatan bebas"
          value={bNote}
          onChangeText={setBNote}
          editable={!busy}
        />

        <FormError message={bError} />
        <EditDelete
          editing={editBuy}
          label="Hapus pembelian ini"
          busy={busy}
          onDelete={deleteBuy}
        />
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setEditBuy(null)}
          onConfirm={saveBuy}
        />
      </SheetModal>
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
  buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  buttonFlex: { flex: 1 },
  sectionTitle: { marginTop: 16, marginBottom: 8 },
  empty: { textAlign: 'center', marginVertical: 10 },
  hint: { color: Color.TEXT_LABEL, marginTop: 8 },
  hintTight: { color: Color.TEXT_LABEL, marginBottom: 10 },
  splitRow: { flexDirection: 'row', gap: 8 },
  splitBox: {
    ...CARD,
    flex: 1,
    gap: 2,
  },
  splitValue: { color: Color.HOUSE_DARK },
  spanRow: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  // Selang saat di rumah diberi warna Residence — supaya dua jenis selang
  // langsung kebedakan tanpa harus membaca tulisannya.
  spanRowHome: { backgroundColor: Color.HOUSE, borderColor: Color.HOUSE_DARK },
  spanMain: { flex: 1, gap: 2 },
  spanRight: { alignItems: 'flex-end', gap: 2 },
  spanTitle: { color: Color.TEXT_TITLE },
  spanRate: { color: Color.TEXT_PLACEHOLDER },
  spanKwh: { color: Color.HOUSE_DARK },
  readingRow: {
    ...CARD,
    marginBottom: 8,
  },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
});
