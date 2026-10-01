import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD, CARD_GAP, PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { DualButtons } from '@/components/common/DualButtons';
import { EmptyText } from '@/components/common/EmptyText';
import { FormError } from '@/components/common/FormError';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useAiDay } from '@/hooks/useAiDay';
import {
  avgMonthlyIncome,
  budgetAiErrorMessage,
  budgetAttemptsLeft,
  budgetBrief,
  budgetCeiling,
  budgetHistoryRows,
  BUDGET_AI_DAILY_CAP,
  generateBudgetPlan,
  kunciRencana,
  loadBudgetAiDay,
  saveBudgetAiDay,
  type BudgetAiDay,
  type BudgetHistoryMonth,
} from '@/lib/budgetAi';
import {
  applyBudgetPlan,
  budgetPlanPatch,
  subBudgetKey,
  subsOf,
  type BudgetDoc,
  type SubAmount,
  type SubcategoryMap,
} from '@/lib/budgets';
import { FINANCE_TYPE_LABEL, type FinanceType } from '@/lib/categories';
import { monthShortName } from '@/lib/financeInsight';
import { dayId, MONTH_NAMES, monthId } from '@/lib/format';
import { saveErrorOf } from '@/lib/messages';
import { formatRupiah } from '@/lib/transactions';

// 🤖 Rekomendasi Budget AI — satu baris di sub-tab Budgeting yang membuka
// sheet penyusun budget.
//
// Alurnya sengaja TIGA LANGKAH, bukan satu tombol ajaib:
//   1. kamu melihat dulu angka apa yang jadi dasarnya (realisasi tiga bulan),
//   2. AI menyusun usulannya beserta alasan sebaris per kategori,
//   3. kamu menyetujuinya, dan BARU saat itu angkanya ditulis.
//
// Langkah pertama yang paling gampang dilewatkan, dan justru itu yang membuat
// usulannya bisa dinilai: angka yang muncul entah dari mana cuma bisa
// dipercaya atau tidak dipercaya, tidak bisa diperiksa.
//
// Datanya NOL read tambahan: riwayat tiga bulan sudah dilanggan layar Finance
// untuk Dashboard & Coach (lihat `history` di app/finance.tsx), dan kartu ini
// menumpang langganan yang sama.
export function BudgetAiCard({
  type,
  year,
  month,
  history,
  budgetDoc,
  subcats,
  locked,
  onUnlock,
}: {
  type: FinanceType;
  year: number;
  month: number;
  history: BudgetHistoryMonth[];
  budgetDoc: BudgetDoc;
  subcats: SubcategoryMap;
  locked: boolean;
  /** Buka dialog Unlock — menyetujui usulan tetap tunduk pada kunci bulanan. */
  onUnlock: () => void;
}) {
  const { user } = useAuth();
  const today = dayId(new Date());
  const bulanId = monthId(year, month);

  const [open, setOpen] = useState(false);
  // null = jatah & usulan hari ini belum selesai dibaca dari AsyncStorage.
  // Baru dibaca saat sheet-nya DIBUKA; selama tertutup, kartu ini nol
  // pekerjaan.
  const [hari, setHari] = useAiDay(today, loadBudgetAiDay, open);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const income = useMemo(() => avgMonthlyIncome(history), [history]);
  const rows = useMemo(
    () => budgetHistoryRows(type, history, budgetDoc.allocations),
    [type, history, budgetDoc.allocations],
  );
  const ceiling = budgetCeiling(type, budgetDoc.allocations, income);

  /**
   * Siap diminta hanya kalau riwayatnya BENAR-BENAR ada isinya.
   *
   * Dua hal dijaga sekaligus oleh satu syarat ini. Yang jelas: pemilik baru
   * yang belum punya transaksi tidak diberi rencana yang isinya tebakan. Yang
   * tidak kelihatan: riwayat tiga bulan dimuat terpisah dari transaksi bulan
   * ini, jadi sheet ini bisa terbuka sedetik SEBELUM riwayatnya tiba. Tanpa
   * syarat ini, satu click di detik itu akan mengirim "realisasi 0" ke AI dan
   * menerima rencana yang memangkas semuanya.
   */
  const siap = rows.length > 0 && history.some((h) => h.items.length > 0);

  const rencana = hari?.hasil[kunciRencana(type, bulanId)] ?? null;
  const sisa = hari ? budgetAttemptsLeft(hari) : 0;

  // Total SESUDAH usulan diterapkan: kategori yang tidak disebut AI tetap
  // memakai angkanya sekarang. Tanpa itu, totalnya terbaca lebih kecil
  // daripada yang sebenarnya akan terjadi.
  const totalSekarang = rows.reduce((a, r) => a + r.current, 0);
  const totalSesudah = rows.reduce((a, r) => {
    const usul = rencana?.items.find((i) => i.key === r.key);
    return a + (usul ? usul.amount : r.current);
  }, 0);
  const lewatBatas = ceiling > 0 && totalSesudah > ceiling;

  async function susun() {
    if (!hari || busy) return;
    setBusy(true);
    setAiError(null);
    try {
      const brief = budgetBrief(
        type,
        `${MONTH_NAMES[month]} ${year}`,
        rows,
        history.map((h) => monthShortName(h.monthId)),
        income,
        ceiling,
      );
      const plan = await generateBudgetPlan(
        type,
        brief,
        rows,
        bulanId,
        hari.attempts + 1,
      );
      const berikut: BudgetAiDay = {
        attempts: hari.attempts + 1,
        hasil: { ...hari.hasil, [kunciRencana(type, bulanId)]: plan },
      };
      setHari(berikut);
      await saveBudgetAiDay(today, berikut);
    } catch (e) {
      setAiError(budgetAiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function terapkan() {
    if (!user || !rencana || applying) return;
    setApplying(true);
    setAiError(null);
    try {
      // Sub-budget kategori yang disentuh ikut DIBAGI ULANG menurut
      // perbandingannya sekarang, supaya "budget kategori = total sub-nya"
      // tetap benar sesudah usulannya diterapkan (lihat lib/budgets.ts).
      const subs: Record<string, SubAmount[]> = {};
      for (const i of rencana.items) {
        subs[i.key] = subsOf(subcats, type, i.key).map((s) => ({
          key: s.key,
          amount: budgetDoc.allocations[subBudgetKey(type, i.key, s.key)] ?? 0,
        }));
      }
      await applyBudgetPlan(
        user.uid,
        year,
        month,
        budgetPlanPatch(type, rencana.items, subs),
      );
      setOpen(false);
    } catch {
      setAiError(saveErrorOf('budget'));
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <PressableScale style={styles.trigger} onPress={() => setOpen(true)}>
        <View style={styles.triggerMain}>
          <VixText heading="bold" additionalStyle={styles.triggerTitle}>
            🤖 Rekomendasi Budget AI
          </VixText>
          <VixText heading="label" additionalStyle={styles.triggerSub}>
            Disusun dari realisasi {history.length} bulan terakhir, bisa
            disetujui sekali click
          </VixText>
        </View>
        <IconSymbol name="chevron.right" size={18} color={Color.MAIN_DARK} />
      </PressableScale>

      <SheetModal
        visible={open}
        title="🤖 Rekomendasi Budget AI"
        subtitle={`${FINANCE_TYPE_LABEL[type]} · ${MONTH_NAMES[month]} ${year}`}
        onClose={() => setOpen(false)}
        footer={
          !siap ? undefined : locked && rencana ? (
            <DualButtons
              cancelLabel="Tutup"
              confirmLabel="🔓 Unlock dulu"
              danger
              onCancel={() => setOpen(false)}
              onConfirm={() => {
                setOpen(false);
                onUnlock();
              }}
            />
          ) : rencana ? (
            <DualButtons
              cancelLabel="Tutup"
              confirmLabel="✅ Setujui & Set"
              busy={applying}
              onCancel={() => setOpen(false)}
              onConfirm={terapkan}
            />
          ) : (
            <PrimaryButton
              label="✨ Susun Rekomendasi"
              busy={busy}
              disabled={hari === null || sisa === 0}
              onPress={susun}
            />
          )
        }>
        <FormError message={aiError} />

        {!siap ? (
          <EmptyText>
            Belum ada realisasi {FINANCE_TYPE_LABEL[type]} tiga bulan terakhir.
            Catat transaksimu dulu 🌱
          </EmptyText>
        ) : rencana ? (
          <>
            <VixText heading="bold" additionalStyle={styles.ringkas}>
              {rencana.ringkas}
            </VixText>

            {rows.map((r) => {
              const usul = rencana.items.find((i) => i.key === r.key);
              const nilai = usul ? usul.amount : r.current;
              const beda = nilai - r.current;
              return (
                <View key={r.key} style={styles.usulRow}>
                  <View style={styles.usulTop}>
                    <VixText
                      heading="bold"
                      numberOfLines={1}
                      additionalStyle={styles.usulLabel}>
                      {r.label}
                    </VixText>
                    <VixText heading="bold" additionalStyle={styles.usulNilai}>
                      {formatRupiah(nilai)}
                    </VixText>
                  </View>
                  <View style={styles.usulBawah}>
                    <VixText heading="label">
                      Sekarang {formatRupiah(r.current)} · rata-rata terpakai{' '}
                      {formatRupiah(r.avg)}
                    </VixText>
                    <VixText
                      heading="label"
                      additionalStyle={
                        beda > 0
                          ? styles.naik
                          : beda < 0
                            ? styles.turun
                            : styles.tetap
                      }>
                      {beda === 0
                        ? 'tetap'
                        : `${beda > 0 ? '▲' : '▼'} ${formatRupiah(Math.abs(beda))}`}
                    </VixText>
                  </View>
                  {!!usul?.alasan && (
                    <VixText heading="label" additionalStyle={styles.alasan}>
                      {usul.alasan}
                    </VixText>
                  )}
                </View>
              );
            })}

            <View style={styles.totalRow}>
              <VixText heading="bold" additionalStyle={styles.usulLabel}>
                Total sesudah disetujui
              </VixText>
              <VixText
                heading="bold"
                additionalStyle={lewatBatas ? styles.over : styles.usulNilai}>
                {formatRupiah(totalSesudah)}
              </VixText>
            </View>
            <VixText
              heading="label"
              additionalStyle={lewatBatas ? styles.over : styles.catatan}>
              {lewatBatas
                ? `⚠️ Melewati batas wajar ${formatRupiah(ceiling)}. Boleh tetap disetujui, tapi sadari angkanya.`
                : ceiling > 0
                  ? `Sekarang ${formatRupiah(totalSekarang)}, batas wajar ${formatRupiah(ceiling)}.`
                  : `Sekarang ${formatRupiah(totalSekarang)}.`}
            </VixText>

            <VixText heading="label" additionalStyle={styles.catatan}>
              {rencana.catatan}
            </VixText>

            {locked && (
              <VixText heading="label" additionalStyle={styles.kunci}>
                🔒 Budget {MONTH_NAMES[month]} terkunci. Unlock dulu untuk
                menyetujuinya.
              </VixText>
            )}

            {!locked && sisa > 0 && (
              <PressableScale
                style={styles.ulangi}
                onPress={susun}
                disabled={busy}
                hitSlop={8}>
                <VixText heading="label" additionalStyle={styles.ulangiText}>
                  ✨ Minta usulan baru (sisa {sisa} hari ini)
                </VixText>
              </PressableScale>
            )}
          </>
        ) : (
          <>
            <VixText heading="label" additionalStyle={styles.catatan}>
              Inilah angka yang dibaca AI. Yang dikirim cuma rangkuman per
              kategori.
            </VixText>

            {rows.map((r) => (
              <View key={r.key} style={styles.usulRow}>
                <View style={styles.usulTop}>
                  <VixText
                    heading="bold"
                    numberOfLines={1}
                    additionalStyle={styles.usulLabel}>
                    {r.label}
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.usulNilai}>
                    {formatRupiah(r.avg)}
                  </VixText>
                </View>
                <View style={styles.usulBawah}>
                  <VixText heading="label">
                    {r.spent.map((s) => formatRupiah(s)).join(' · ')}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.tetap}>
                    budget {formatRupiah(r.current)}
                  </VixText>
                </View>
              </View>
            ))}

            {income > 0 && (
              <VixText heading="label" additionalStyle={styles.catatan}>
                Rata-rata pemasukan {formatRupiah(income)} per bulan
                {ceiling > 0
                  ? `, jadi batas wajar untuk ${FINANCE_TYPE_LABEL[type]} ${formatRupiah(ceiling)}.`
                  : '.'}
              </VixText>
            )}

            <VixText heading="label" additionalStyle={styles.jatah}>
              {hari === null
                ? ' '
                : sisa === 0
                  ? `Jatah ${BUDGET_AI_DAILY_CAP} usulan hari ini sudah terpakai. Lanjut besok.`
                  : `Sisa ${sisa} dari ${BUDGET_AI_DAILY_CAP} usulan hari ini. Hasilnya disimpan seharian, jadi satu click cukup.`}
            </VixText>
          </>
        )}
      </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  // Baris pembuka di dalam daftar Budgeting. Bentuknya kartu bergaris seperti
  // tetangganya, cuma garis & tulisannya warna utama supaya terbaca sebagai
  // pintu, bukan sebagai kategori ke sekian.
  trigger: {
    ...PANEL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderColor: Color.MAIN,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: CARD_GAP,
  },
  triggerMain: { flex: 1, gap: 2 },
  triggerTitle: { color: Color.TEXT_TITLE },
  triggerSub: { color: Color.MAIN_DARK },

  ringkas: { color: Color.TEXT_TITLE, marginBottom: 10 },
  usulRow: { ...CARD, marginBottom: 8, gap: 4 },
  usulTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  usulLabel: { flex: 1, color: Color.TEXT_TITLE },
  usulNilai: { color: Color.MAIN_DARK },
  usulBawah: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  naik: { color: Color.WARNING },
  turun: { color: Color.SUCCESS },
  tetap: { color: Color.TEXT_LABEL },
  alasan: { color: Color.TEXT_PARAGRAPH },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  over: { color: Color.DANGER },
  catatan: { color: Color.TEXT_LABEL, marginTop: 4 },
  kunci: { color: Color.WARNING, marginTop: 8 },
  ulangi: { alignSelf: 'flex-start', marginTop: 10 },
  ulangiText: { color: Color.MAIN_DARK, textDecorationLine: 'underline' },
  jatah: { color: Color.TEXT_LABEL, marginTop: 10, textAlign: 'center' },
});
