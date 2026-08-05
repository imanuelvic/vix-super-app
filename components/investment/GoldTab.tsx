import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { MoneyInput } from '@/components/common/MoneyInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { GoldChart } from '@/components/investment/GoldChart';
import { useAuth } from '@/contexts/auth';
import {
  dayIdToDate,
  formatDate,
  formatShortRupiah,
  groupDigits,
  parseAmount,
} from '@/lib/format';
import { dayDocId } from '@/lib/health';
import {
  defaultGoldDate,
  goldStats,
  LOGAM_MULIA_URL,
  mergedGold,
  saveGold,
  type GoldEntry,
  type GoldPoint,
} from '@/lib/investment';
import { SAVE_ERROR } from '@/lib/messages';
import { formatRupiah } from '@/lib/transactions';

// Tab Emas 🏅 — harga emas 1 gr tiap ~tanggal 3: grafik tren, statistik, tautan
// cek harga, & pencatatan bulanan (data awal + entri sendiri).
export function GoldTab({ entries }: { entries: GoldEntry[] }) {
  const { user } = useAuth();

  const [chartW, setChartW] = useState(0);
  const [editing, setEditing] = useState<GoldPoint | 'new' | null>(null);
  const [fDate, setFDate] = useState(defaultGoldDate(new Date()));
  const [fPrice, setFPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const series = mergedGold(entries);
  const stats = goldStats(series);
  // Baris daftar: harga + perubahan vs bulan sebelumnya, terbaru di atas.
  const rows = series
    .map((s, i) => ({ ...s, change: i > 0 ? s.price - series[i - 1].price : 0 }))
    .reverse();

  const editingMonth =
    editing && editing !== 'new' ? editing.date.slice(0, 7) : null;
  const editingIsUser =
    editingMonth != null &&
    entries.some((e) => e.date.slice(0, 7) === editingMonth);

  function openAdd() {
    setEditing('new');
    setFDate(defaultGoldDate(new Date()));
    setFPrice('');
    setError(null);
  }

  function openEdit(p: GoldPoint) {
    setEditing(p);
    setFDate(dayIdToDate(p.date));
    setFPrice(groupDigits(String(p.price)));
    setError(null);
  }

  async function handleSave() {
    if (!user || busy) return;
    const price = parseAmount(fPrice);
    if (price <= 0) {
      setError('Isi harga emas dulu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dateStr = dayDocId(fDate);
      const mk = dateStr.slice(0, 7);
      // Satu harga per bulan → timpa bulan yang sama kalau sudah ada.
      const next = entries.filter((e) => e.date.slice(0, 7) !== mk);
      next.push({ date: dateStr, price });
      await saveGold(user.uid, next);
      setEditing(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!user || !editingMonth || busy) return;
    setBusy(true);
    try {
      await saveGold(
        user.uid,
        entries.filter((e) => e.date.slice(0, 7) !== editingMonth),
      );
      setEditing(null);
    } catch {
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function openLogamMulia() {
    Linking.openURL(LOGAM_MULIA_URL).catch(() =>
      setError('Gagal membuka tautan.'),
    );
  }

  const up = (stats?.changeAbs ?? 0) >= 0;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Judul + catatan update */}
        <View style={styles.hero}>
          <VixText heading="subheader" additionalStyle={styles.heroTitle}>
            🏅 Harga Emas 1 gr
          </VixText>
          <VixText heading="label" additionalStyle={styles.heroSub}>
            Harga di-update setiap hari pkl. 08.30 WIB
          </VixText>
          <PressableScale style={styles.linkButton} onPress={openLogamMulia}>
            <VixText heading="bold" additionalStyle={styles.linkText}>
              🔗 Cek harga di Logam Mulia
            </VixText>
          </PressableScale>
        </View>

        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}

        {/* Statistik ringkas */}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statLatest}>
              <VixText heading="label" additionalStyle={styles.statLabel}>
                Harga terakhir · {formatDate(dayIdToDate(stats.latest.date))}
              </VixText>
              <VixText heading="header" additionalStyle={styles.statValue}>
                {formatRupiah(stats.latest.price)}
              </VixText>
              {stats.prev && (
                <VixText
                  heading="label"
                  additionalStyle={up ? styles.upText : styles.downText}>
                  {up ? '▲' : '▼'} {formatRupiah(Math.abs(stats.changeAbs))} (
                  {stats.changePct >= 0 ? '+' : ''}
                  {stats.changePct.toFixed(1)}%) vs bulan lalu
                </VixText>
              )}
            </View>
            <View style={styles.statGrid}>
              <View style={styles.statBox}>
                <VixText heading="label" additionalStyle={styles.statBoxLabel}>
                  Tertinggi
                </VixText>
                <VixText heading="bold">{formatShortRupiah(stats.high)}</VixText>
              </View>
              <View style={styles.statBox}>
                <VixText heading="label" additionalStyle={styles.statBoxLabel}>
                  Terendah
                </VixText>
                <VixText heading="bold">{formatShortRupiah(stats.low)}</VixText>
              </View>
              <View style={styles.statBox}>
                <VixText heading="label" additionalStyle={styles.statBoxLabel}>
                  Rata²/bln
                </VixText>
                <VixText heading="bold">
                  {stats.avgChange >= 0 ? '+' : '−'}
                  {formatShortRupiah(Math.abs(stats.avgChange))}
                </VixText>
              </View>
            </View>
          </View>
        )}

        {/* Grafik tren */}
        <View
          style={styles.chartCard}
          onLayout={(e) => setChartW(e.nativeEvent.layout.width - 24)}>
          <GoldChart series={series} width={chartW} />
          <VixText heading="label" additionalStyle={styles.chartHint}>
            Pelajari trennya untuk membuat perkiraanmu sendiri 📈
          </VixText>
        </View>

        <PrimaryButton
          label="Catat Harga Tanggal 3"
          icon="plus"
          onPress={openAdd}
          additionalStyle={styles.addButton}
        />

        {/* Daftar harga per bulan (terbaru di atas) */}
        {rows.map((r) => {
          const rup = r.change >= 0;
          return (
            <PressableScale
              key={r.date}
              style={styles.row}
              onPress={() => openEdit(r)}>
              <View style={styles.rowLeft}>
                <VixText heading="bold" additionalStyle={styles.rowDate}>
                  {formatDate(dayIdToDate(r.date))}
                </VixText>
                {r.seeded && (
                  <VixText heading="label" additionalStyle={styles.seedTag}>
                    data awal
                  </VixText>
                )}
              </View>
              <View style={styles.rowRight}>
                <VixText heading="bold">{formatRupiah(r.price)}</VixText>
                {r.change !== 0 && (
                  <VixText
                    heading="label"
                    additionalStyle={rup ? styles.upText : styles.downText}>
                    {rup ? '▲' : '▼'} {formatShortRupiah(Math.abs(r.change))}
                  </VixText>
                )}
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      {/* Sheet catat/edit harga */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Catat Harga Emas' : 'Edit Harga'}
        subtitle="Harga emas 1 gr (cek di Logam Mulia)"
        onClose={() => setEditing(null)}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          Tanggal (biasanya tanggal 3)
        </VixText>
        <View style={styles.formGap}>
          <DateField
            key={editing === 'new' ? 'new' : editingMonth}
            value={fDate}
            onChange={setFDate}
          />
        </View>
        <MoneyInput
          style={styles.formGap}
          placeholder="Harga per gram"
          value={fPrice}
          onChangeText={(t) => setFPrice(groupDigits(t))}
          editable={!busy}
        />
        {error && (
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
        )}
        {editingIsUser && (
          <InlineDelete
            key={editingMonth}
            label="Hapus harga bulan ini"
            busy={busy}
            onDelete={handleDelete}
          />
        )}
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  hero: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    marginBottom: 12,
  },
  heroTitle: { color: Color.TEXT_REVERSE },
  heroSub: { color: Color.TEXT_ON_DARK_MUTED },
  linkButton: {
    alignSelf: 'flex-start',
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 2,
  },
  linkText: { color: Color.ACCENT_DARK },
  error: { color: Color.DANGER, marginBottom: 8 },
  statsCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  statLatest: { gap: 2 },
  statLabel: { color: Color.TEXT_LABEL },
  statValue: { color: Color.TEXT_TITLE },
  upText: { color: Color.SUCCESS },
  downText: { color: Color.DANGER },
  statGrid: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: Color.BACKGROUND,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  statBoxLabel: { color: Color.TEXT_LABEL },
  chartCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  chartHint: { color: Color.TEXT_LABEL, textAlign: 'center' },
  addButton: { marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDate: { color: Color.TEXT_TITLE },
  seedTag: {
    color: Color.TEXT_PLACEHOLDER,
    backgroundColor: Color.BACKGROUND,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  rowRight: { alignItems: 'flex-end', gap: 1 },
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
});
