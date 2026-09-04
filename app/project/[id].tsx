import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { SECTION_SPACE } from '@/assets/style/section';
import { DeadlineTag } from '@/components/common/Deadline';
import { EditButton } from '@/components/common/EditButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import {
    deadlineDaysUntil,
    invoiceTotal,
    subscribeFreelance,
    type FreelanceProject,
} from '@/lib/career';
import { deadlineLabel, deadlineTone } from '@/lib/deadline';
import { formatDate } from '@/lib/format';
import { INVOICE_PRESETS, presetPrice, shareInvoicePdf } from '@/lib/invoice';
import { LOAD_ERROR } from '@/lib/messages';
import { formatRupiah } from '@/lib/transactions';

// Rincian satu proyek freelance 🌐 — halaman BACA saja.
//
// Dulu menekan kartu proyek langsung membuka modal isian; sekarang yang muncul
// halaman ini. Bedanya bukan cuma rasa: yang paling sering kamu lakukan adalah
// MELIHAT (deadline kapan, client siapa, tagihannya berapa) — bukan mengetik.
// Mengubah datanya sekali klik lagi, lewat tombol ✏️ di kanan atas.
export default function ProjectScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [projects, setProjects] = useState<FreelanceProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeFreelance(user.uid, setProjects, () => setError(LOAD_ERROR));
  }, [user]);

  const project = projects?.find((p) => p.id === id) ?? null;
  const items = project?.invoiceItems ?? [];
  const total = invoiceTotal(items);

  async function handleInvoice() {
    if (!project || pdfBusy) return;
    if (items.length === 0) {
      setError('Isi rincian biaya dulu lewat ✏️ untuk membuat invoice.');
      return;
    }
    setError(null);
    setPdfBusy(true);
    try {
      await shareInvoicePdf(project);
    } catch {
      setError('Gagal membuat invoice. Coba lagi.');
    } finally {
      setPdfBusy(false);
    }
  }

  if (projects === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader backLabel="Career" title="Proyek" />
        <LoadingCenter />
      </SafeAreaView>
    );
  }

  // Proyeknya baru saja dihapus dari perangkat lain — jangan tampilkan
  // halaman kosong yang membingungkan.
  if (!project) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader backLabel="Career" title="Proyek" />
        <VixText heading="label" additionalStyle={styles.gone}>
          Proyek ini sudah tidak ada.
        </VixText>
      </SafeAreaView>
    );
  }

  const days = deadlineDaysUntil(project, new Date());
  const tone = project.done ? 'unknown' : deadlineTone(days);
  // Nilai yang ditonjolkan: fee yang disepakati kalau ada, kalau belum ya
  // jumlah rinciannya — supaya kartu atas tak pernah menampilkan Rp 0 padahal
  // rinciannya sudah terisi.
  const nilai = project.fee > 0 ? project.fee : total;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Career"
        title={project.name}
        subtitle={`👤 ${project.client}`}
        right={
          <EditButton
            onPress={() =>
              router.push({
                pathname: '/project/edit/[id]',
                params: { id: project.id },
              })
            }
          />
        }
      />

      <ScreenError message={error} />

      <ScrollView contentContainerStyle={styles.content}>
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            {project.fee > 0 ? '💰 Nilai proyek' : '🧾 Jumlah rincian biaya'}
          </VixText>
          <VixText heading="header" additionalStyle={summaryText.value}>
            {formatRupiah(nilai)}
          </VixText>
          <VixText heading="label" additionalStyle={summaryText.label}>
            {project.done
              ? '✅ Sudah selesai'
              : `📆 ${formatDate(project.deadline.toDate())}`}
          </VixText>
        </SummaryCard>

        {/* Sisa waktu — satu baris tegas, warnanya dari aturan bersama. */}
        <View style={styles.statusRow}>
          {project.done ? (
            <VixText heading="bold" additionalStyle={styles.statusDone}>
              ✅ Proyek selesai
            </VixText>
          ) : (
            <DeadlineTag tone={tone} label={`⏳ ${deadlineLabel(days)}`} />
          )}
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="👤 Client" value={project.client} />
          <InfoRow
            label="📆 Deadline"
            value={formatDate(project.deadline.toDate())}
          />
          <InfoRow
            label="💰 Fee"
            value={
              project.fee > 0 ? formatRupiah(project.fee) : 'Belum disepakati'
            }
            muted={project.fee === 0}
          />
        </View>

        {project.requirement ? (
          <>
            <VixText heading="title" additionalStyle={styles.sectionTitle}>
              📋 Requirement
            </VixText>
            <View style={styles.reqCard}>
              <VixText heading="paragraph">{project.requirement}</VixText>
            </View>
          </>
        ) : null}

        <VixText heading="title" additionalStyle={styles.sectionTitle}>
          🧾 Rincian Biaya
        </VixText>

        {items.length === 0 ? (
          <View style={styles.estCard}>
            <VixText heading="bold" additionalStyle={styles.estTitle}>
              Belum ada rincian biaya
            </VixText>
            <VixText heading="label" additionalStyle={styles.estHint}>
              Klik ✏️ di kanan atas untuk menambah. Ini perkiraan tarif yang
              dipakai app — angkanya masih bisa diubah per proyek:
            </VixText>
            {INVOICE_PRESETS.map((p) => (
              <View key={p.desc} style={styles.estRow}>
                <VixText heading="label" additionalStyle={styles.estRowDesc}>
                  {p.desc}
                </VixText>
                <VixText heading="label" additionalStyle={styles.estRowPrice}>
                  {formatRupiah(p.price)}
                </VixText>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.itemsCard}>
            {items.map((it, idx) => {
              const perkiraan = presetPrice(it.desc);
              return (
                <View
                  key={`${it.desc}-${idx}`}
                  style={[styles.itemRow, idx > 0 && styles.itemRowDivider]}>
                  <VixText heading="bold" additionalStyle={styles.itemDesc}>
                    {it.desc}
                  </VixText>
                  <View style={styles.itemNumbers}>
                    <VixText heading="label" additionalStyle={styles.itemCalc}>
                      {it.qty} × {formatRupiah(it.price)}
                    </VixText>
                    <VixText heading="bold" additionalStyle={styles.itemTotal}>
                      {formatRupiah(it.qty * it.price)}
                    </VixText>
                  </View>
                  {/* Harganya belum diisi → tampilkan ancar-ancarnya, jadi
                      ketahuan berapa yang semestinya ditagih. */}
                  {it.price === 0 && perkiraan > 0 ? (
                    <VixText heading="label" additionalStyle={styles.itemEst}>
                      Perkiraan {formatRupiah(perkiraan)} per satuan
                    </VixText>
                  ) : null}
                </View>
              );
            })}

            <View style={styles.totalRow}>
              <VixText heading="bold">TOTAL</VixText>
              <VixText heading="subheader" additionalStyle={styles.totalValue}>
                {formatRupiah(total)}
              </VixText>
            </View>
          </View>
        )}

        <PrimaryButton
          label="📄 Buat & Bagikan Invoice PDF"
          onPress={handleInvoice}
          busy={pdfBusy}
          background={Color.MAIN_DARK}
          additionalStyle={styles.pdfButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// Satu baris keterangan: judul di kiri, isinya di kanan.
function InfoRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <VixText heading="label">{label}</VixText>
      <VixText
        heading="bold"
        additionalStyle={muted ? styles.infoValueMuted : styles.infoValue}>
        {value}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  gone: { textAlign: 'center', marginTop: 24 },
  statusRow: { alignItems: 'center', paddingVertical: 10 },
  statusDone: { color: Color.SUCCESS },
  infoCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  infoValue: { color: Color.TEXT_TITLE, flexShrink: 1, textAlign: 'right' },
  infoValueMuted: {
    color: Color.TEXT_PLACEHOLDER,
    flexShrink: 1,
    textAlign: 'right',
  },
  sectionTitle: { ...SECTION_SPACE },
  reqCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.CAREER,
    padding: 14,
  },
  // ----- rincian biaya -----
  itemsCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
  },
  itemRow: { paddingVertical: 12, gap: 2 },
  itemRowDivider: { borderTopWidth: 1, borderTopColor: Color.BORDER },
  itemDesc: { color: Color.TEXT_TITLE },
  itemNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  itemCalc: { color: Color.TEXT_LABEL },
  itemTotal: { color: Color.MAIN_DARK },
  itemEst: { color: Color.WARNING },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: Color.MAIN_DARK,
    paddingVertical: 12,
  },
  totalValue: { color: Color.MAIN_DARK },
  // ----- daftar perkiraan tarif (saat rinciannya masih kosong) -----
  estCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 4,
  },
  estTitle: { color: Color.TEXT_TITLE },
  estHint: { color: Color.TEXT_LABEL, marginBottom: 6 },
  estRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 3,
  },
  estRowDesc: { flexShrink: 1 },
  estRowPrice: { color: Color.MAIN_DARK },
  pdfButton: { marginTop: 18 },
});
