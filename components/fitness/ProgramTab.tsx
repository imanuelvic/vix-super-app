import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { SelectField } from '@/components/common/SelectField';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { formatDecimal } from '@/lib/format';
import {
  applyFitPicks,
  fitBlockOf,
  fitMenuLabel,
  fitPicksOf,
  FIT_BLOCK_ORDER,
  FIT_DAY_SHORT,
  FIT_PROGRAM,
  weightOf,
  type FitBlock,
  type FitDay,
  type FitWeights,
} from '@/lib/fitness';

// Tab Program 📅 — SARAN latihan, bukan perintah.
//
// Ini bagian yang paling berubah artinya. Dulu isi tab ini MENENTUKAN sesi
// harianmu: hari Selasa membuka Fitness berarti lari santai, mau atau tidak.
// Sekarang ia cuma etalase — kamu boleh membuka blok & hari mana pun untuk
// melihat isinya, lalu MENGAMBILNYA untuk hari ini kalau memang cocok.
//
// Karena itu tombol "Ambil" ada di tiap paket, bukan cuma di paket hari ini:
// lari tempo yang dijadwalkan Jumat boleh saja kamu kerjakan Selasa, dan app
// ini tidak punya urusan melarangnya.
//
// Dulu ketujuh harinya ditumpuk sekaligus di satu layar — 7 kartu × ±7 gerakan
// artinya menggulung jauh cuma untuk melihat hari Kamis. Sekarang satu hari
// saja yang terbuka, dipilih lewat dropdown, dan bawaannya HARI INI.
export function ProgramTab({
  weights,
  day,
  dayId,
}: {
  weights: FitWeights;
  /** Hari ini — untuk tahu paket mana yang sudah kamu ambil. */
  day: FitDay;
  dayId: string;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const activeBlock = fitBlockOf(new Date());
  const [block, setBlock] = useState<FitBlock>(activeBlock);
  const todayWeekday = new Date().getDay();
  // Harinya disimpan sebagai teks karena SelectField berkunci teks. Tidak ikut
  // berganti saat bloknya diganti — tiap blok memuat ketujuh hari yang sama,
  // jadi "lihat hari Kamis di blok lain" tetap mendarat di hari Kamis.
  const [hari, setHari] = useState(String(todayWeekday));

  // Daftar bloknya diambil dari lib (bukan ditulis ulang di sini) supaya
  // menambah blok baru cukup sekali di satu tempat.
  const activeAt = FIT_BLOCK_ORDER.indexOf(activeBlock);

  // Paket yang sudah kamu ambil untuk HARI INI — dibaca dari dokumen harian,
  // sumber yang sama dengan tab Exercise.
  const dipilih = fitPicksOf(day, new Date());

  const sesiBlok = FIT_PROGRAM[block];
  // Urutannya sudah Senin→Minggu di lib; dropdown-nya ikut apa adanya.
  const session =
    sesiBlok.find((s) => String(s.weekday) === hari) ?? sesiBlok[0];
  const sudahDiambil = dipilih.includes(session.id);

  /** Tambahkan paket ini ke pilihan hari ini. Sudah ada → tidak apa-apa. */
  async function ambil() {
    if (!user || busy || sudahDiambil) return;
    setBusy(true);
    try {
      await applyFitPicks(user.uid, dayId, day, new Date(), [
        ...dipilih,
        session.id,
      ]);
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SegmentTabs
        tabs={FIT_BLOCK_ORDER.map((b, i) => {
          // Berapa giliran lagi sampai blok ini jalan (0 = sedang jalan).
          const turns = (i - activeAt + FIT_BLOCK_ORDER.length) % FIT_BLOCK_ORDER.length;
          return {
            key: b,
            label: `Blok ${b}`,
            sub:
              turns === 0
                ? '● sekarang'
                : turns === 1
                  ? 'berikutnya'
                  : `${turns} giliran lagi`,
          };
        })}
        value={block}
        onChange={setBlock}
      />

      {/* Pemilih hari. Ditaruh di luar kartu isinya supaya daftar pilihannya
          membentang turun menutupi kartunya, bukan mendorongnya. */}
      <View style={styles.picker}>
        <SelectField
          value={hari}
          options={sesiBlok.map((s) => ({
            key: String(s.weekday),
            label: `${FIT_DAY_SHORT[s.weekday]} — ${s.emoji} ${s.title}`,
            sub:
              s.weekday === todayWeekday
                ? `● hari ini · ±${s.minutes} menit`
                : `±${s.minutes} menit`,
          }))}
          onChange={(key) => key && setHari(key)}
        />
      </View>

      <View style={styles.dayBlock}>
        <VixText heading="title" additionalStyle={styles.dayTitle}>
          {FIT_DAY_SHORT[session.weekday]} — {session.emoji}{' '}
          {fitMenuLabel(session)}
        </VixText>
        <VixText heading="label" additionalStyle={styles.dayFocus}>
          {session.focus} · ±{session.minutes} menit
        </VixText>
        {/* Tombol ambil ditaruh di ATAS daftar gerakannya: yang memutuskan
            "ambil atau tidak" adalah judul & fokusnya, bukan gerakan ke-tujuh.
            Paket yang sudah diambil tetap ditampilkan tombolnya — dimatikan,
            bukan disembunyikan, supaya jawabannya kelihatan ("sudah") alih-alih
            membuatmu mengira tombolnya belum sempat dimuat. */}
        <PrimaryButton
          label={sudahDiambil ? '✓ Sudah diambil hari ini' : '➕ Ambil untuk hari ini'}
          busy={busy}
          onPress={ambil}
          additionalStyle={[styles.takeButton, sudahDiambil && styles.takeDone]}
        />

        {session.exercises.map((ex) => {
          const kg = weightOf(ex, weights);
          return (
            <View key={ex.id} style={styles.exRow}>
              <View style={styles.exMain}>
                <VixText heading="bold" additionalStyle={styles.exName}>
                  {ex.emoji} {ex.name}
                </VixText>
                <VixText heading="label">
                  {ex.sets} set × {ex.reps}
                </VixText>
              </View>
              {/* Lari & jalan tidak punya beban — kolomnya dikosongkan. */}
              <VixText heading="label" additionalStyle={styles.exWeight}>
                {ex.cardio
                  ? '⏱️'
                  : kg == null || kg === 0
                    ? 'BW'
                    : `${formatDecimal(kg)} kg`}
              </VixText>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  picker: { marginTop: 10, marginBottom: 10 },
  dayBlock: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 3,
  },
  dayTitle: { color: Color.TEXT_TITLE },
  dayFocus: { color: Color.FITNESS_DARK, marginBottom: 6 },
  takeButton: { marginBottom: 4 },
  // Sudah diambil → tetap terbaca, tapi jelas tidak menunggu di-click lagi.
  takeDone: { opacity: 0.45 },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  exMain: { flex: 1, gap: 1 },
  exName: { color: Color.TEXT_TITLE },
  exWeight: { color: Color.FITNESS_DARK },
});
