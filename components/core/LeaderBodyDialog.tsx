import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { EmojiButton } from '@/components/common/EmojiButton';
import { FormError } from '@/components/common/FormError';
import { InfoRow } from '@/components/common/InfoRow';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { useBusyTask } from '@/hooks/useBusyTask';
import { pdfErrorOf } from '@/lib/messages';
import { hasLeaderBody, type CoreLeader } from '@/lib/core';
import { dayIdToDate, formatDecimal, formatFullDate } from '@/lib/format';
import { bodySummary } from '@/lib/health';
import { shareLeaderBodyPdf } from '@/lib/leaderBodyPdf';

// Data Tubuh CL 🧍 — BACA SAJA.
//
// Gunanya memantau: apakah CL yang kamu gembalakan bergerak menuju badan yang
// sehat. Isinya sengaja jauh lebih pendek daripada Data Tubuh di Profile —
// itu data dirimu sendiri, ini data orang lain, dan tiga angka (tinggi, berat,
// lingkar perut) sudah cukup untuk menjawab pertanyaannya.
//
// TIDAK ada tombol ubah di sini. Mengubahnya lewat ✏️ seperti data CL yang
// lain, jadi cuma ada SATU pintu masuk perubahan — tidak ada dua form yang
// bisa berbeda pendapat, dan modal ini tidak pernah tidak sengaja tersimpan.
//
// Yang ada tombol BAGIKAN (15 Sep 2026): angkanya dicetak jadi PDF bersama
// penjelasan yang lembut & tips hidup sehat (lib/leaderBodyPdf.ts), lalu
// dikirim ke CL-nya lewat share sheet, sekeluarga dengan PDF Wheel of Life &
// Timeline. Yang dikirim ke orangnya bukan sekadar angka, itu sebabnya.

/** Warna penilaian — sama persis dengan kartu Data Tubuh di Profile. */
function toneColor(tone: 'ok' | 'warn' | 'danger'): string {
  return tone === 'ok'
    ? Color.SUCCESS
    : tone === 'warn'
      ? Color.WARNING
      : Color.DANGER;
}

export function LeaderBodyDialog({
  leader,
  onClose,
}: {
  leader: CoreLeader | null;
  onClose: () => void;
}) {
  const ada = leader ? hasLeaderBody(leader) : false;

  // Angka turunan (BMI, berat ideal, rasio perut/tinggi) dihitung di satu
  // tempat bersama PDF-nya: lib/health.bodySummary. Tinggi & berat yang belum
  // lengkap membuat BMI-nya null, bukan angka ngawur.
  const { lengkap, bmi, kategori, ideal, rasio } = bodySummary(leader ?? {});

  // Cetak PDF-nya. Satu tugas yang tak boleh jalan dobel; pesan gagalnya
  // tampil di dalam dialog ini, tidak perlu ditutup dulu.
  const tugas = useBusyTask<'pdf'>();
  const [error, setError] = useState<string | null>(null);
  function bagikan() {
    if (!leader) return;
    void tugas.run({
      key: 'pdf',
      start: () => setError(null),
      task: () => shareLeaderBodyPdf(leader),
      fail: () => setError(pdfErrorOf('Data Tubuh')),
    });
  }
  // Pesan gagal milik sesi dialog ini saja: CL berikutnya mulai bersih.
  function tutup() {
    setError(null);
    onClose();
  }

  return (
    <CenterDialog visible={!!leader} onClose={tutup}>
      {leader && (
        <>
          <View style={styles.head}>
            <VixText heading="title" additionalStyle={styles.title}>
              🧍 Data Tubuh {leader.name}
            </VixText>
            {/* Bagikan sebagai PDF, cuma kalau memang ada yang bisa dicetak. */}
            {ada && (
              <EmojiButton
                icon="square.and.arrow.up"
                onPress={bagikan}
                busy={tugas.busy === 'pdf'}
                disabled={tugas.busy !== null}
              />
            )}
          </View>
          <VixText heading="label" additionalStyle={styles.updated}>
            {leader.bodyUpdatedDayId
              ? `Diperbarui: ${formatFullDate(dayIdToDate(leader.bodyUpdatedDayId))}`
              : 'Belum pernah diperbarui'}
          </VixText>

          {!ada ? (
            <VixText heading="paragraph" additionalStyle={styles.empty}>
              Belum ada data tubuh {leader.name}
            </VixText>
          ) : (
            <View style={styles.rows}>
              {leader.heightCm != null && (
                <InfoRow label="Tinggi" value={`${formatDecimal(leader.heightCm)} cm`} />
              )}
              {leader.weightKg != null && (
                <InfoRow label="Berat" value={`${formatDecimal(leader.weightKg)} kg`} />
              )}
              {ideal && (
                <InfoRow
                  label="Berat ideal"
                  value={`${formatDecimal(ideal.min)}–${formatDecimal(ideal.max)} kg`}
                />
              )}
              {bmi != null && kategori && (
                <InfoRow
                  label="BMI"
                  value={`${formatDecimal(bmi)} · ${kategori.label}`}
                  valueColor={toneColor(kategori.tone)}
                />
              )}
              {leader.waistCm != null && (
                <InfoRow
                  label="Lingkar perut"
                  value={`${formatDecimal(leader.waistCm)} cm`}
                />
              )}
              {rasio != null && (
                <InfoRow
                  label="Rasio perut/tinggi"
                  // Dua angka di belakang koma — sama seperti kartu Data Tubuh
                  // di Profile; 0,53 vs 0,5 memang bedanya di situ.
                  value={`${rasio.toFixed(2).replace('.', ',')} · ${rasio < 0.5 ? 'Sehat' : 'Perhatian'}`}
                  valueColor={toneColor(rasio < 0.5 ? 'ok' : 'warn')}
                />
              )}
              {!lengkap && (
                <VixText heading="label" additionalStyle={styles.partial}>
                  Isi tinggi & beratnya biar BMI dan berat idealnya ikut
                  terhitung.
                </VixText>
              )}
            </View>
          )}

          <FormError message={error} gap="top" />

          <PressableScale style={styles.close} onPress={tutup}>
            <VixText heading="label" additionalStyle={styles.closeText}>
              Tutup
            </VixText>
          </PressableScale>
        </>
      )}
    </CenterDialog>
  );
}

const styles = StyleSheet.create({
  // Judul di kiri, tombol bagikan di kanan, satu baris.
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: { color: Color.TEXT_TITLE, flexShrink: 1 },
  updated: { marginTop: 2, marginBottom: 10 },
  empty: { color: Color.TEXT_PARAGRAPH },
  rows: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  partial: { color: Color.TEXT_LABEL, paddingVertical: 10 },
  close: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  closeText: { color: Color.TEXT_LABEL },
});
