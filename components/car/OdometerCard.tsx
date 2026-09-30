import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SummaryCard, summaryText } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useFormSave } from '@/hooks/useFormSave';
import { odometerPerMonth, setCarOdometer, type CarOdometer } from '@/lib/car';
import { formatShortDayDate, groupDigits, parseAmount } from '@/lib/format';

// Kartu paling atas sub-tab Parts 🚗 — kilometer mobil sekarang, dan click-nya
// membuka isian untuk memperbaruinya.
//
// Sebelum 30 Sep 2026 tempat ini dipakai ringkasan "N bagian perlu perhatian".
// Angka itu dibuang bukan karena salah, tapi karena ia sudah tertulis di DUA
// tempat lain yang lebih dulu terlihat: badge merah di tab Parts dan badge di
// tile Car pada Home. Kartu terbesar di layar ini akhirnya cuma mengulang, dan
// satu-satunya angka yang benar-benar belum pernah bisa dijawab app justru
// kilometer, padahal separuh jadwal perawatan Mazda ini memakainya
// ("tiap 6 bulan / 10.000 km").
export function OdometerCard({ odometer }: { odometer: CarOdometer | null }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [km, setKm] = useState('');
  const [date, setDate] = useState(new Date());
  const { busy, formError, setFormError, save } = useFormSave();

  const perBulan = odometerPerMonth(odometer);

  function buka() {
    // Isiannya dimulai dari angka terakhir, bukan kosong: yang diketik cuma
    // ekornya yang berubah, bukan enam digit dari nol tiap kali.
    setKm(odometer ? groupDigits(String(odometer.km)) : '');
    setDate(new Date());
    setFormError(null);
    setOpen(true);
  }

  async function simpan() {
    if (!user) return;
    const angka = parseAmount(km);
    if (angka <= 0) {
      setFormError('Isi kilometernya dulu.');
      return;
    }
    // Odometer tidak pernah mundur. Kalau angkanya lebih kecil dari catatan
    // terakhir, hampir pasti salah ketik — dan kalau diterima, laju km/bulan
    // ikut ngawur sampai dua catatan berikutnya.
    if (odometer && angka < odometer.km) {
      setFormError(`Lebih kecil dari catatan terakhir (${groupDigits(String(odometer.km))} km).`);
      return;
    }
    await save(async () => {
      await setCarOdometer(user.uid, angka, date, odometer);
      setOpen(false);
    });
  }

  return (
    <>
      <PressableScale scaleTo={0.98} onPress={buka}>
        <SummaryCard>
          <VixText heading="label" additionalStyle={summaryText.label}>
            Kilometer sekarang
          </VixText>
          <VixText heading="subheader" additionalStyle={summaryText.value}>
            {odometer ? `${groupDigits(String(odometer.km))} km` : 'Belum dicatat'}
          </VixText>
          <VixText heading="label" additionalStyle={summaryText.label}>
            {odometer
              ? `Dicatat ${formatShortDayDate(odometer.at.toDate())}${
                  perBulan ? ` · ±${groupDigits(String(Math.round(perBulan)))} km/bulan` : ''
                }`
              : 'Click kartu ini untuk mengisi kilometer mobilmu sekarang.'}
          </VixText>
          {odometer && (
            <VixText heading="label" additionalStyle={summaryText.label}>
              Click untuk memperbarui.
            </VixText>
          )}
        </SummaryCard>
      </PressableScale>

      <CenterDialog visible={open} onClose={() => setOpen(false)}>
        <VixText heading="title" additionalStyle={styles.title}>
          Kilometer sekarang
        </VixText>
        <VixText heading="label" additionalStyle={styles.hint}>
          Baca angka di dashboard mobil, lalu tulis apa adanya.
        </VixText>
        <View style={styles.row}>
          <FormInput
            placeholder="128.450"
            value={km}
            onChangeText={(t) => setKm(groupDigits(t))}
            keyboardType="number-pad"
            editable={!busy}
            style={styles.input}
          />
          <VixText heading="bold" additionalStyle={styles.unit}>
            km
          </VixText>
        </View>
        {/* Tanggalnya bisa mundur: kadang angkanya difoto hari Sabtu dan baru
            sempat dicatat hari Senin. */}
        <DateField value={date} onChange={setDate} />
        <FormError message={formError} gap="top" />
        <DualButtons
          confirmLabel="Simpan"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={simpan}
        />
      </CenterDialog>
    </>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 2 },
  hint: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  input: { flex: 1 },
  unit: { color: Color.TEXT_LABEL },
});
