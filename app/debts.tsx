import { Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { SummaryCard } from '@/components/common/SummaryCard';
import { useTabScroll } from '@/components/common/useTabScroll';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
  addDebtPayment,
  debtDaysUntil,
  debtPaid,
  debtRemaining,
  deleteDebt,
  deleteDebtPayment,
  newDebtId,
  newPaymentId,
  PERIOD_META,
  saveDebt,
  subscribeDebts,
  type Debt,
  type DebtDirection,
  type DebtPeriod,
} from '@/lib/debts';
import {
  formatFullDate,
  formatShortDayDate,
  groupDigits,
  parseAmount,
} from '@/lib/format';
import { DELETE_ERROR, LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import { formatRupiah } from '@/lib/transactions';

type Tab = DebtDirection;

const TABS: BottomTab<Tab>[] = [
  { key: 'theirs', label: 'Pinjaman Orang', icon: 'arrow.down.circle.fill' },
  { key: 'mine', label: 'Pinjaman Saya', icon: 'arrow.up.circle.fill' },
];

const PERIODS: DebtPeriod[] = ['once', 'weekly', 'monthly'];

// Pinjaman 🤝 — catat siapa meminjam ke siapa, cicilan, jatuh tempo, dan
// pelunasan. Dua tab: pinjaman saya (harus bayar) & pinjaman orang (ditagih).
export default function DebtsScreen() {
  const { user } = useAuth();

  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, scrollKey, onTabPress } = useTabScroll<Tab>('theirs');
  const [debts, setDebts] = useState<Debt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sheet tambah/edit pinjaman. 'new' = sedang menambah.
  const [editing, setEditing] = useState<Debt | 'new' | null>(null);
  const [fPerson, setFPerson] = useState('');
  const [fNote, setFNote] = useState('');
  const [fTotal, setFTotal] = useState('');
  const [fStart, setFStart] = useState(new Date());
  const [fDue, setFDue] = useState(new Date());
  const [fFinal, setFFinal] = useState(new Date());
  const [fPeriod, setFPeriod] = useState<DebtPeriod>('once');
  const [fInstallment, setFInstallment] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sheet bayar cicilan + riwayat pembayaran.
  const [paying, setPaying] = useState<Debt | null>(null);
  const [pAmount, setPAmount] = useState('');
  const [pDate, setPDate] = useState(new Date());
  const [pError, setPError] = useState<string | null>(null);
  const [pBusy, setPBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeDebts(
      user.uid,
      (next) => {
        setDebts(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
    return unsubscribe;
  }, [user]);

  const today = new Date();
  const list = (debts ?? [])
    .filter((d) => d.direction === tab)
    .sort((a, b) => {
      // Belum lunas dulu, lalu jatuh tempo terdekat.
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.dueDate.toMillis() - b.dueDate.toMillis();
    });
  const totalRemaining = list.reduce((sum, d) => sum + debtRemaining(d), 0);

  const isMine = tab === 'mine';
  const personLabel = isMine ? 'Saya meminjam dari' : 'Yang meminjam dari saya';

  // ---------- Tambah / edit pinjaman ----------

  function openAdd() {
    setEditing('new');
    setFPerson('');
    setFNote('');
    setFTotal('');
    setFStart(new Date());
    setFDue(new Date());
    setFFinal(new Date());
    setFPeriod('once');
    setFInstallment('');
    setFormError(null);
  }

  function openEdit(d: Debt) {
    setEditing(d);
    setFPerson(d.person);
    setFNote(d.note);
    setFTotal(groupDigits(String(d.total)));
    setFStart(d.startDate.toDate());
    setFDue(d.dueDate.toDate());
    setFFinal((d.finalDate ?? d.dueDate).toDate());
    setFPeriod(d.period);
    setFInstallment(d.installment > 0 ? groupDigits(String(d.installment)) : '');
    setFormError(null);
  }

  async function handleSave() {
    if (!user || !editing || busy) return;
    if (!fPerson.trim()) {
      setFormError('Isi nama orangnya dulu.');
      return;
    }
    const total = parseAmount(fTotal);
    if (!total) {
      setFormError('Isi total pinjamannya dulu.');
      return;
    }
    setBusy(true);
    setFormError(null);
    const base = editing === 'new' ? null : editing;
    const data: Debt = {
      id: base ? base.id : newDebtId(),
      direction: tab,
      person: fPerson.trim(),
      note: fNote.trim(),
      total,
      startDate: Timestamp.fromDate(fStart),
      dueDate: Timestamp.fromDate(fDue),
      finalDate: fPeriod === 'once' ? null : Timestamp.fromDate(fFinal),
      period: fPeriod,
      installment: parseAmount(fInstallment),
      payments: base ? base.payments : [],
      done: base ? base.done : false,
    };
    try {
      await saveDebt(user.uid, data);
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
      await deleteDebt(user.uid, editing.id);
    } catch {
      setError(DELETE_ERROR);
    } finally {
      setEditing(null);
      setBusy(false);
    }
  }

  // ---------- Bayar cicilan ----------

  function openPay(d: Debt) {
    setPaying(d);
    // Prefill nominal cicilan kalau ada, kalau tidak sisa pinjaman.
    const suggest = d.installment > 0 ? d.installment : debtRemaining(d);
    setPAmount(suggest > 0 ? groupDigits(String(suggest)) : '');
    setPDate(new Date());
    setPError(null);
  }

  async function handlePay() {
    if (!user || !paying || pBusy) return;
    const amount = parseAmount(pAmount);
    if (!amount) {
      setPError('Isi nominal pembayarannya dulu.');
      return;
    }
    setPBusy(true);
    setPError(null);
    try {
      await addDebtPayment(user.uid, paying, {
        id: newPaymentId(),
        amount,
        date: Timestamp.fromDate(pDate),
        note: '',
      });
      // Sinkronkan objek `paying` supaya riwayat langsung terlihat update.
      setPaying(
        (debts ?? []).find((d) => d.id === paying.id) ?? null,
      );
      setPAmount('');
    } catch {
      setPError(SAVE_ERROR);
    } finally {
      setPBusy(false);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!user || !paying) return;
    try {
      await deleteDebtPayment(user.uid, paying, paymentId);
    } catch {
      setPError(DELETE_ERROR);
    }
  }

  // Objek `paying` selalu ambil versi terbaru dari snapshot.
  const payingLive = paying
    ? ((debts ?? []).find((d) => d.id === paying.id) ?? paying)
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Finance"
        title="Pinjaman 🤝"
        subtitle="Pinjam-meminjam, cicilan & jatuh tempo"
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {debts === null ? (
        <LoadingCenter />
      ) : (
        // key=scrollKey → ScrollView re-mount tiap tab ditekan (scroll ke atas)
        <ScrollView key={scrollKey} contentContainerStyle={styles.content}>
          {/* Ringkasan total sisa arah ini */}
          <SummaryCard
            label={isMine ? '💸 Total pinjaman saya' : '💰 Total ditagih ke orang'}
            value={formatRupiah(totalRemaining)}
            sub={`${list.filter((d) => !d.done).length} belum lunas · ${
              list.filter((d) => d.done).length
            } lunas`}
          />

          <PrimaryButton
            label="Tambah Pinjaman"
            icon="plus"
            onPress={openAdd}
            additionalStyle={styles.addButton}
          />

          {list.length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              {isMine
                ? 'Belum ada pinjaman — semoga tetap begini 😌'
                : 'Belum ada yang meminjam dari kamu.'}
            </VixText>
          )}

          {list.map((d) => {
            const remaining = debtRemaining(d);
            const paid = debtPaid(d);
            const percent = d.total > 0 ? (paid / d.total) * 100 : 0;
            const days = debtDaysUntil(d, today);
            const overdue = !d.done && days < 0;
            const status = d.done
              ? '✅ Lunas'
              : days === 0
                ? '⏰ Jatuh tempo HARI INI!'
                : days > 0
                  ? `⏳ ${days} hari lagi`
                  : `⚠️ Lewat ${-days} hari`;
            return (
              // Tekan kartu → edit; tombol Bayar terpisah di dalam.
              <PressableScale
                key={d.id}
                style={[
                  styles.card,
                  overdue && styles.cardOverdue,
                  d.done && styles.cardDone,
                ]}
                onPress={() => openEdit(d)}>
                <View style={styles.cardTop}>
                  <VixText heading="bold" additionalStyle={styles.cardPerson}>
                    {isMine ? '➡️' : '⬅️'} {d.person}
                  </VixText>
                  <VixText heading="bold" additionalStyle={styles.cardRemaining}>
                    {formatRupiah(remaining)}
                  </VixText>
                </View>
                {d.note ? (
                  <VixText heading="label" numberOfLines={1}>
                    📝 {d.note}
                  </VixText>
                ) : null}

                {/* Progress bayar */}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${percent}%` },
                      d.done && styles.barFillDone,
                    ]}
                  />
                </View>
                <VixText heading="label">
                  {formatRupiah(paid)} / {formatRupiah(d.total)} dibayar
                  {d.period !== 'once' &&
                    ` · ${formatRupiah(d.installment)} ${PERIOD_META[d.period].short}`}
                </VixText>

                <View style={styles.cardBottom}>
                  <VixText
                    heading="label"
                    additionalStyle={[
                      styles.statusText,
                      d.done
                        ? styles.statusDone
                        : overdue
                          ? styles.statusLate
                          : days === 0
                            ? styles.statusToday
                            : styles.statusSoon,
                    ]}>
                    {status}
                    {!d.done && ` · ${formatShortDayDate(d.dueDate.toDate())}`}
                  </VixText>
                  {!d.done && (
                    <PressableScale
                      style={styles.payButton}
                      onPress={() => openPay(d)}>
                      <VixText heading="bold" additionalStyle={styles.payText}>
                        💵 Bayar
                      </VixText>
                    </PressableScale>
                  )}
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
      )}

      {/* Tab bar bawah */}
      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />

      {/* ===== Sheet tambah / edit pinjaman ===== */}
      <SheetModal
        visible={!!editing}
        title={editing === 'new' ? 'Tambah Pinjaman' : 'Edit Pinjaman'}
        subtitle={isMine ? 'Pinjaman Saya' : 'Pinjaman Orang'}
        scroll={false}
        onClose={() => setEditing(null)}>
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            {personLabel}
          </VixText>
          <FormInput
            style={styles.formGap}
            placeholder="Nama orang"
            value={fPerson}
            onChangeText={setFPerson}
            editable={!busy}
          />
          <FormInput
            style={styles.formGap}
            placeholder="Untuk apa (opsional)"
            value={fNote}
            onChangeText={setFNote}
            editable={!busy}
          />
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Total pinjaman
          </VixText>
          <MoneyInput
            style={styles.formGap}
            placeholder="0"
            value={fTotal}
            onChangeText={(t) => setFTotal(groupDigits(t))}
            editable={!busy}
          />

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Cara bayar
          </VixText>
          <View style={styles.chipRow}>
            {PERIODS.map((p) => (
              <Chip
                key={p}
                label={PERIOD_META[p].label}
                active={fPeriod === p}
                onPress={() => setFPeriod(p)}
                additionalStyle={styles.chipFlex}
              />
            ))}
          </View>

          {fPeriod !== 'once' && (
            <>
              <VixText heading="label" additionalStyle={styles.fieldLabel}>
                Nominal cicilan {PERIOD_META[fPeriod].short}
              </VixText>
              <MoneyInput
                style={styles.formGap}
                placeholder="0"
                value={fInstallment}
                onChangeText={(t) => setFInstallment(groupDigits(t))}
                editable={!busy}
              />
            </>
          )}

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Mulai meminjam
          </VixText>
          <View style={styles.formGap}>
            <DateField
              key={editing === 'new' ? 'start-new' : `start-${editing?.id}`}
              value={fStart}
              onChange={setFStart}
            />
          </View>

          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            {fPeriod === 'once' ? 'Jatuh tempo' : 'Jatuh tempo cicilan berikutnya'}
          </VixText>
          <View style={styles.formGap}>
            <DateField
              key={editing === 'new' ? 'due-new' : `due-${editing?.id}`}
              value={fDue}
              onChange={setFDue}
            />
          </View>

          {fPeriod !== 'once' && (
            <>
              <VixText heading="label" additionalStyle={styles.fieldLabel}>
                Target lunas (sampai kapan)
              </VixText>
              <View style={styles.formGap}>
                <DateField
                  key={editing === 'new' ? 'final-new' : `final-${editing?.id}`}
                  value={fFinal}
                  onChange={setFFinal}
                />
              </View>
            </>
          )}

          {formError && (
            <VixText heading="label" additionalStyle={styles.error}>
              {formError}
            </VixText>
          )}
          {editing !== 'new' && editing !== null && (
            <InlineDelete
              key={editing.id}
              label="Hapus pinjaman ini"
              busy={busy}
              onDelete={handleDelete}
            />
          )}
        </ScrollView>
        {/* DualButtons di luar ScrollView → otomatis dipin di footer SheetModal */}
        <DualButtons
          confirmLabel={editing === 'new' ? 'Tambah' : 'Simpan'}
          busy={busy}
          onCancel={() => setEditing(null)}
          onConfirm={handleSave}
        />
      </SheetModal>

      {/* ===== Sheet bayar cicilan + riwayat ===== */}
      <SheetModal
        visible={!!paying}
        title={payingLive ? `Bayar — ${payingLive.person}` : 'Bayar'}
        subtitle={
          payingLive ? `Sisa ${formatRupiah(debtRemaining(payingLive))}` : undefined
        }
        scroll={false}
        onClose={() => setPaying(null)}>
        <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Nominal pembayaran
          </VixText>
          <MoneyInput
            style={styles.formGap}
            placeholder="0"
            value={pAmount}
            onChangeText={(t) => setPAmount(groupDigits(t))}
            editable={!pBusy}
          />
          <VixText heading="label" additionalStyle={styles.fieldLabel}>
            Tanggal bayar
          </VixText>
          <View style={styles.formGap}>
            <DateField
              key={paying?.id ?? 'pay'}
              value={pDate}
              onChange={setPDate}
            />
          </View>
          {pError && (
            <VixText heading="label" additionalStyle={styles.error}>
              {pError}
            </VixText>
          )}
          <PrimaryButton
            label="Catat Pembayaran"
            busy={pBusy}
            onPress={handlePay}
            additionalStyle={styles.formGap}
          />

          {/* Riwayat pembayaran */}
          {payingLive && payingLive.payments.length > 0 && (
            <>
              <VixText heading="title" additionalStyle={styles.historyTitle}>
                🧾 Riwayat Pembayaran
              </VixText>
              {[...payingLive.payments]
                .sort((a, b) => b.date.toMillis() - a.date.toMillis())
                .map((p) => (
                  <View key={p.id} style={styles.payRow}>
                    <View style={styles.payRowMain}>
                      <VixText heading="bold" additionalStyle={styles.payAmount}>
                        {formatRupiah(p.amount)}
                      </VixText>
                      <VixText heading="label">
                        {formatFullDate(p.date.toDate())}
                      </VixText>
                    </View>
                    <PressableScale
                      onPress={() => handleDeletePayment(p.id)}
                      hitSlop={8}>
                      <VixText heading="bold" additionalStyle={styles.payDelete}>
                        Hapus
                      </VixText>
                    </PressableScale>
                  </View>
                ))}
            </>
          )}

          {payingLive?.done && (
            <View style={styles.lunasRow}>
              <CheckCircle checked size={22} />
              <VixText heading="bold" additionalStyle={styles.lunasText}>
                Pinjaman ini sudah LUNAS 🎉
              </VixText>
            </View>
          )}
        </ScrollView>
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  cardOverdue: {
    backgroundColor: Color.FINANCE_EXPENSE,
    borderColor: Color.DANGER,
  },
  cardDone: { opacity: 0.6 },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardPerson: { flex: 1, color: Color.TEXT_TITLE },
  cardRemaining: { color: Color.MAIN_DARK },
  barTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: Color.CONTRAST_CONTAINER,
    overflow: 'hidden',
    marginTop: 2,
  },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: Color.MAIN_LIGHT },
  barFillDone: { backgroundColor: Color.MAIN },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  // flex:1 → teks status+tanggal mengisi ruang & membungkus bila panjang,
  // jadi tombol Bayar tidak terdorong keluar kartu.
  statusText: { flex: 1 },
  statusDone: { color: Color.SUCCESS },
  statusLate: { color: Color.DANGER },
  statusToday: { color: Color.DANGER },
  statusSoon: { color: Color.TEXT_LABEL },
  payButton: {
    backgroundColor: Color.MAIN,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  payText: { color: Color.TEXT_REVERSE },
  formScroll: { flexShrink: 1 },
  formGap: { marginBottom: 10 },
  fieldLabel: { marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chipFlex: { flex: 1 },
  historyTitle: { marginTop: 6, marginBottom: 8 },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 8,
  },
  payRowMain: { flex: 1, gap: 1 },
  payAmount: { color: Color.TEXT_TITLE },
  payDelete: { color: Color.DANGER },
  lunasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  lunasText: { color: Color.SUCCESS },
});
