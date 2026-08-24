import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { DeadlineTag, deadlineBorder } from '@/components/common/Deadline';
import { EditButton } from '@/components/common/EditButton';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useEditParam } from '@/hooks/useEditParam';
import {
  deadlineDaysUntil,
  invoiceTotal,
  type FreelanceProject,
} from '@/lib/career';
import { deadlineLabel, deadlineTone } from '@/lib/deadline';
import { formatDate } from '@/lib/format';
import { formatRupiah } from '@/lib/transactions';

// Tab Freelance 🌐: proyek website & aplikasi — siapa client-nya,
// deadline kapan, requirement apa, dan fee-nya berapa.
//
// Di sini HANYA daftarnya. Click kartu → halaman rincian proyek (baca-saja),
// click ✏️ → langsung ke halaman isian. Dulu kartunya membuka modal isian
// panjang; isian sepanjang itu (termasuk rincian biaya belasan baris) memang
// bukan pekerjaan modal.
export function FreelanceTab({
  projects,
  editId,
  onEditConsumed,
}: {
  projects: FreelanceProject[];
  // Kalau di-set (dari reminder Home), langsung buka proyek ini.
  editId?: string;
  // Dipanggil setelah editId dipakai — induk membersihkan param dari URL.
  onEditConsumed?: () => void;
}) {
  const router = useRouter();

  const openDetail = useCallback(
    (p: FreelanceProject) =>
      router.push({ pathname: '/project/[id]', params: { id: p.id } }),
    [router],
  );

  // Kartu reminder Home (?edit=<id>) sekarang mendarat di halaman rincian
  // proyeknya — bukan lagi langsung ke isian. Aturannya milik bersama, lihat
  // hooks/useEditParam.ts.
  useEditParam(projects, openDetail, editId, onEditConsumed);

  const today = new Date();
  // Aktif urut deadline terdekat; yang selesai di bawah.
  const sorted = [...projects].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.deadline.toMillis() - b.deadline.toMillis();
  });
  const active = projects.filter((p) => !p.done);
  const activeFee = active.reduce((sum, p) => sum + p.fee, 0);

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan usaha freelance */}
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            🌐 Website & App Developer — Freelance
          </VixText>
          <VixText heading="subheader" additionalStyle={summaryText.value}>
            {active.length}{' '}
            <VixText heading="label" additionalStyle={summaryText.label}>
              proyek aktif · nilai {formatRupiah(activeFee)}
            </VixText>
          </VixText>
        </SummaryCard>

        <PrimaryButton
          label="Tambah Proyek"
          icon="plus"
          onPress={() =>
            router.push({ pathname: '/project/edit/[id]', params: { id: 'new' } })
          }
          additionalStyle={styles.addButton}
        />

        {sorted.length === 0 && (
          <VixText heading="label" additionalStyle={styles.empty}>
            Belum ada proyek — catat proyek client pertamamu di sini 🚀
          </VixText>
        )}

        {sorted.map((p) => {
          const days = deadlineDaysUntil(p, today);
          // Warna & label dari aturan bersama (lihat lib/deadline.ts).
          const tone = p.done ? 'unknown' : deadlineTone(days);
          const items = p.invoiceItems ?? [];
          // Nilai yang ditampilkan: fee yang disepakati, kalau belum ada ya
          // jumlah rinciannya — kartu tidak pernah menampilkan Rp 0 padahal
          // rinciannya sudah terisi.
          const nilai = p.fee > 0 ? p.fee : invoiceTotal(items);
          return (
            // Tombol ✏️ jadi SAUDARA area click, bukan anaknya — Pressable
            // bersarang di iOS bikin click tombolnya ikut membuka kartunya.
            <View key={p.id} style={[styles.card, deadlineBorder(tone)]}>
              <PressableScale
                style={styles.cardTap}
                onPress={() => openDetail(p)}>
                <VixText
                  heading="bold"
                  numberOfLines={1}
                  additionalStyle={styles.cardTitle}>
                  {p.name}
                </VixText>
                <VixText heading="label" numberOfLines={1}>
                  👤 {p.client} · 📆 {formatDate(p.deadline.toDate())}
                </VixText>
                {p.requirement ? (
                  <VixText
                    heading="label"
                    numberOfLines={2}
                    additionalStyle={styles.cardReq}>
                    📋 {p.requirement}
                  </VixText>
                ) : null}

                <View style={styles.cardFoot}>
                  {p.done ? (
                    <VixText heading="label" additionalStyle={styles.statusDone}>
                      ✅ Selesai
                    </VixText>
                  ) : (
                    <DeadlineTag tone={tone} label={deadlineLabel(days)} />
                  )}
                  {items.length > 0 && (
                    <VixText heading="label" additionalStyle={styles.itemCount}>
                      🧾 {items.length} item
                    </VixText>
                  )}
                </View>
              </PressableScale>

              <View style={styles.cardRight}>
                <EditButton
                  onPress={() =>
                    router.push({
                      pathname: '/project/edit/[id]',
                      params: { id: p.id },
                    })
                  }
                />
                {nilai > 0 && (
                  <VixText heading="bold" additionalStyle={styles.feeText}>
                    {formatRupiah(nilai)}
                  </VixText>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  // Kartu hero-nya persis <SummaryCard> bawaan — tak perlu gaya sendiri.
  addButton: { marginBottom: 12 },
  empty: { textAlign: 'center', marginTop: 8 },
  card: {
    flexDirection: 'row',
    // 'flex-start': tombol ✏️ menempel di pojok kanan ATAS kartu, tidak ikut
    // turun ke tengah saat requirement-nya panjang.
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
  },
  cardTap: { flex: 1, gap: 3 },
  cardTitle: { color: Color.TEXT_TITLE },
  cardReq: { color: Color.TEXT_PLACEHOLDER },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  itemCount: { color: Color.TEXT_LABEL },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  feeText: { color: Color.MAIN_DARK },
  statusDone: { color: Color.SUCCESS },
});
