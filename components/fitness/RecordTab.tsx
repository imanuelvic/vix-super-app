import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PANEL } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { SCREEN_CONTENT } from '@/assets/style/layout';
import { CenterDialog } from '@/components/common/CenterDialog';
import { Chip } from '@/components/common/Chip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { DeleteX } from '@/components/common/DeleteX';
import { DualButtons } from '@/components/common/DualButtons';
import { EmptyText } from '@/components/common/EmptyText';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { type Stopwatch } from '@/hooks/useStopwatch';
import { formatClock, formatDecimal, parseDecimal } from '@/lib/format';
import { splitFinishSec, toFinishSec } from '@/lib/fun';
import {
  appendFitLog,
  fitKindMeta,
  fitLogHasRoute,
  fitLogPace,
  fitLogSeconds,
  FIT_MENU_GROUPS,
  removeFitLog,
  type FitDay,
  type FitLog,
} from '@/lib/fitness';

// Sub-tab Record ⏱️ — stopwatch olahraga (2 Okt 2026).
//
// Pilih olahraganya, click Mulai, lalu HP boleh dikantongi. Sesudah Selesai,
// lamanya tersimpan sebagai sesi hari ini; untuk 🏃 Lari & 🚶 Jalan kamu juga
// bisa mengisi jarak & lokasinya, dan sesi itulah yang jadi riwayat larimu.
//
// Yang DISENGAJA tidak ada di sini: GPS, peta, dan pelacakan rute. Itu modul
// native (izin lokasi latar belakang), artinya build EAS baru tiap kali, dan
// app ini tidak punya alasan menyalakan radio lokasi sepanjang kamu berlari.
// Yang dicatat lamanya & yang kamu tulis sendiri; untuk peta & pace per
// kilometer, Strava sudah mengerjakannya jauh lebih baik.
//
// Keadaan stopwatch-nya sendiri tidak dipegang di sini melainkan di
// hooks/useStopwatch.ts, dan dilanggan dari layar induknya — jadi ia tetap
// berjalan walau kamu berpindah sub-tab, dan selamat walau app-nya ditutup.
export function RecordTab({
  watch,
  day,
  dayId,
}: {
  watch: Stopwatch;
  day: FitDay;
  dayId: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { busy, formError, save } = useFormSave();

  // Formulir Selesai — jam/menit/detik ikut stopwatch, jarak & lokasi diketik.
  const [finishing, setFinishing] = useState(false);
  const [fJam, setFJam] = useState('');
  const [fMenit, setFMenit] = useState('');
  const [fDetik, setFDetik] = useState('');
  const [fKm, setFKm] = useState('');
  const [fTempat, setFTempat] = useState('');
  // Keluhan formulirnya sendiri (bukan galat simpan): lamanya 0.
  const [keluhan, setKeluhan] = useState<string | null>(null);
  // Sesi yang akan dihapus (semua hapus permanen, jadi wajib ditanya dulu).
  const [hapus, setHapus] = useState<number | null>(null);

  const meta = fitKindMeta(watch.kind);
  const berjarak = fitLogHasRoute(watch.kind);
  const totalDetik = fitLogSeconds(day);

  function openFinish() {
    const t = splitFinishSec(watch.seconds);
    setFJam(t.h > 0 ? String(t.h) : '');
    setFMenit(t.h > 0 || t.m > 0 ? String(t.m) : '');
    setFDetik(String(t.s));
    setFKm('');
    setFTempat('');
    setKeluhan(null);
    setFinishing(true);
  }

  async function simpan() {
    if (!user) return;
    const detik = toFinishSec(Number(fJam), Number(fMenit), Number(fDetik));
    // Sesi 0 detik bukan olahraga, ia salah click. Stopwatch-nya tidak dibuang:
    // yang terjadi cuma dialognya menolak menyimpan, dan bilang kenapa.
    if (detik <= 0) {
      setKeluhan('Lamanya masih 0. Isi menit atau detiknya dulu.');
      return;
    }
    setKeluhan(null);
    const log: FitLog = {
      kind: watch.kind,
      seconds: detik,
      at: watch.startedAt,
      km: berjarak ? parseDecimal(fKm) : 0,
      place: berjarak ? fTempat.trim() : '',
    };
    await save(async () => {
      await appendFitLog(user.uid, dayId, day.logs, log);
      setFinishing(false);
      watch.reset();
    });
  }

  async function handleHapus() {
    if (!user || hapus === null) return;
    await save(async () => {
      await removeFitLog(user.uid, dayId, day.logs, hapus);
      setHapus(null);
    });
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Pilih olahraganya — lambang & namanya dari daftar yang SAMA dengan
            Pick Exercise, jadi 🏃 di sini pasti 🏃 yang itu juga. Masih bisa
            dibetulkan di tengah sesi: salah pilih sebelum mulai itu wajar, dan
            membuang sesinya cuma karena itu berarti membuang waktu yang sudah
            terlanjur berjalan. */}
        <VixText heading="label" additionalStyle={styles.pickLabel}>
          🎽 Olahraga apa hari ini?
        </VixText>
        <View style={styles.chipWrap}>
          {FIT_MENU_GROUPS.map((g) => (
            <Chip
              key={g.kind}
              label={`${g.emoji} ${g.label}`}
              active={g.kind === watch.kind}
              onPress={() => watch.setKind(g.kind)}
            />
          ))}
        </View>

        <View style={styles.watchCard}>
          <VixText heading="label" additionalStyle={styles.watchKind}>
            {meta.emoji} {meta.label}
            {watch.startedAt ? ` · mulai ${watch.startedAt}` : ''}
          </VixText>
          <VixText additionalStyle={styles.watchTime}>
            {formatClock(watch.seconds)}
          </VixText>
        </View>

        {!watch.active ? (
          <PressableScale
            style={[styles.bigButton, !watch.ready && styles.disabled]}
            onPress={watch.ready ? watch.start : () => undefined}>
            <VixText heading="subheader" additionalStyle={styles.bigText}>
              ▶️ Mulai
            </VixText>
          </PressableScale>
        ) : (
          <View style={styles.buttonRow}>
            <PressableScale
              style={styles.halfButton}
              onPress={watch.running ? watch.pause : watch.resume}>
              <VixText heading="bold" additionalStyle={styles.halfText}>
                {watch.running ? '⏸️ Jeda' : '▶️ Lanjut'}
              </VixText>
            </PressableScale>
            <PressableScale style={styles.finishButton} onPress={openFinish}>
              <VixText heading="bold" additionalStyle={styles.bigText}>
                🏁 Selesai
              </VixText>
            </PressableScale>
          </View>
        )}

        {/* Membuang sesi SELALU lewat konfirmasi — waktu yang sudah berjalan
            tidak bisa dikembalikan. Hanya muncul saat dijeda, supaya jari
            tidak menyenggolnya selagi berlari. */}
        {watch.active && !watch.running && (
          <PressableScale style={styles.dropRow} onPress={() => setHapus(-1)}>
            <VixText heading="label" additionalStyle={styles.dropText}>
              ✕ Buang sesi ini tanpa menyimpan
            </VixText>
          </PressableScale>
        )}

        <FormError message={formError} gap="top" />

        {/* Sesi hari ini. Inilah "total saya berolahraga durasi seperti itu" —
            yang terbaca duluan jumlahnya, bukan daftarnya. */}
        <View style={styles.todayTop}>
          <VixText heading="title" additionalStyle={styles.todayTitle}>
            ⏱️ Tercatat Hari Ini
          </VixText>
          {totalDetik > 0 ? (
            <VixText heading="bold" additionalStyle={styles.todayTotal}>
              {formatClock(totalDetik)}
            </VixText>
          ) : null}
        </View>

        {day.logs.length === 0 ? (
          <EmptyText>
            Belum ada rekam hari ini.
          </EmptyText>
        ) : (
          day.logs.map((l, i) => {
            const m = fitKindMeta(l.kind);
            const pace = fitLogPace(l);
            return (
              <View key={`${l.at}-${i}`} style={styles.logRow}>
                <View style={styles.logMain}>
                  <VixText heading="bold" additionalStyle={styles.logTitle}>
                    {m.emoji} {m.label} · {formatClock(l.seconds)}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.logSub}>
                    {[
                      l.at ? `mulai ${l.at}` : '',
                      l.km > 0 ? `${formatDecimal(l.km)} km` : '',
                      pace,
                      l.place,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </VixText>
                  {/* 💬 Bagikan ke grup keluarga — kartu persegi berisi
                      sapaan jamnya, sesi ini, & satu kalimat penyemangat.
                      Sesinya dioper lewat parameter (pendek), jadi layar
                      berbaginya tidak perlu membaca Firestore sama sekali. */}
                  <PressableScale
                    style={styles.shareChip}
                    onPress={() =>
                      router.push({
                        pathname: '/workout-share',
                        params: {
                          kind: l.kind,
                          seconds: String(l.seconds),
                          km: String(l.km),
                          place: l.place,
                          dayId,
                        },
                      })
                    }
                    hitSlop={6}>
                    <VixText heading="label" additionalStyle={styles.shareText}>
                      💬 Bagikan ke grup
                    </VixText>
                  </PressableScale>
                </View>
                <DeleteX onPress={() => setHapus(i)} disabled={busy} />
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Formulir Selesai. Lamanya sudah terisi dari stopwatch tapi tetap bisa
          dibetulkan: kamu mungkin lupa menjeda saat berhenti di lampu merah. */}
      <CenterDialog visible={finishing} onClose={() => setFinishing(false)}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          🏁 Simpan {meta.emoji} {meta.label}
        </VixText>
        <VixText heading="label" additionalStyle={styles.modalLabel}>
          ⏱️ Lama olahraga
        </VixText>
        <View style={styles.timeRow}>
          {(
            [
              ['Jam', fJam, setFJam],
              ['Menit', fMenit, setFMenit],
              ['Detik', fDetik, setFDetik],
            ] as const
          ).map(([label, nilai, ubah]) => (
            <FormInput
              key={label}
              style={styles.timeInput}
              placeholder={label}
              keyboardType="number-pad"
              value={nilai}
              onChangeText={(t) => ubah(t.replace(/[^0-9]/g, '').slice(0, 2))}
            />
          ))}
        </View>

        {/* Jarak & lokasi cuma ditanyakan untuk olahraga yang memang menempuh
            jarak. "Berapa km" sesudah angkat beban itu kolom yang selamanya
            kosong, dan kolom kosong mengajari jari untuk melewati formulir. */}
        {berjarak && (
          <>
            <VixText heading="label" additionalStyle={styles.modalLabel}>
              📏 Jarak (boleh dikosongkan)
            </VixText>
            <FormInput
              placeholder="mis. 4.15"
              keyboardType="decimal-pad"
              value={fKm}
              onChangeText={setFKm}
            />
            <VixText heading="label" additionalStyle={styles.modalLabel}>
              📍 Lokasi
            </VixText>
            <FormInput
              placeholder="mis. Kedaung Kali Angke"
              value={fTempat}
              onChangeText={setFTempat}
              maxLength={60}
            />
          </>
        )}

        {/* Pesannya DI DALAM dialog: yang di layar belakang tertutup dialog
            ini, jadi simpan yang gagal akan terasa seperti tombol yang tidak
            bereaksi sama sekali. */}
        <FormError message={keluhan ?? formError} gap="top" />

        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setFinishing(false)}
          onConfirm={simpan}
        />
      </CenterDialog>

      {/* Satu dialog untuk dua hal yang sama-sama tidak bisa dibatalkan:
          membuang sesi yang sedang berjalan (indeks -1) & menghapus sesi yang
          sudah tersimpan. */}
      <ConfirmDialog
        visible={hapus !== null}
        title={hapus === -1 ? 'Buang sesi ini?' : 'Hapus sesi ini?'}
        detail={
          hapus === -1
            ? 'Waktu yang sudah berjalan hilang & tidak dicatat'
            : 'Hapus permanen, tidak bisa dikembalikan'
        }
        confirmLabel={hapus === -1 ? 'Buang' : 'Hapus'}
        busy={busy}
        onCancel={() => setHapus(null)}
        onConfirm={() => {
          if (hapus === -1) {
            watch.reset();
            setHapus(null);
          } else {
            void handleHapus();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { ...SCREEN_CONTENT, paddingBottom: 28 },
  pickLabel: { color: Color.TEXT_LABEL, marginBottom: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  // Kartu stopwatch: jingga tua Fitness, sekeluarga dengan kartu streak di
  // sub-tab Progress — keduanya "angka besar yang jadi pokok layarnya".
  watchCard: {
    backgroundColor: Color.FITNESS_DARK,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
    marginBottom: 14,
  },
  watchKind: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
  watchTime: {
    color: Color.TEXT_REVERSE,
    fontSize: 54,
    lineHeight: 64,
    fontFamily: 'Inter_700Bold',
  },
  bigButton: {
    backgroundColor: Color.FITNESS_DARK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabled: { opacity: 0.45 },
  bigText: { color: Color.TEXT_REVERSE },
  buttonRow: { flexDirection: 'row', gap: 10 },
  halfButton: {
    flex: 1,
    backgroundColor: Color.FITNESS,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  halfText: { color: Color.FITNESS_DEEP },
  finishButton: {
    flex: 1,
    backgroundColor: Color.FITNESS_DARK,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  dropRow: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  dropText: { color: Color.DANGER },
  todayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
  },
  todayTitle: { color: Color.TEXT_TITLE },
  todayTotal: { color: Color.FITNESS_DARK },
  logRow: {
    ...PANEL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  logMain: { flex: 1, gap: 2 },
  logTitle: { color: Color.TEXT_TITLE },
  logSub: { color: Color.TEXT_LABEL },
  // Pil hijau WhatsApp, sengaja kecil & di dalam barisnya: ia tawaran, bukan
  // langkah yang harus dilewati sebelum sesinya dianggap tercatat.
  shareChip: {
    alignSelf: 'flex-start',
    backgroundColor: Color.WHATSAPP,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  shareText: { color: Color.TEXT_REVERSE },
  modalTitle: { color: Color.TEXT_TITLE, marginBottom: 10 },
  modalLabel: { color: Color.TEXT_LABEL, marginTop: 10, marginBottom: 4 },
  timeRow: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1 },
});
