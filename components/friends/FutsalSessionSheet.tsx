import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { InlineDelete } from '@/components/common/InlineDelete';
import { MoneyInput } from '@/components/common/MoneyInput';
import { SheetModal } from '@/components/common/SheetModal';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import type { FutsalSessionForm } from '@/hooks/useFutsalSessionForm';
import { groupDigits } from '@/lib/format';
import { gangMeta, type FutsalGangKey } from '@/lib/futsal';

// Isian jadwal main ⚽ — tampilan formulirnya saja; isinya dipegang
// `useFutsalSessionForm`. Dipakai sub-tab Fun Futsal & halaman Jadwal Main, jadi
// menjadwalkan, mengubah, dan menghapus terasa sama persis di mana pun kamu
// sedang berdiri.
export function FutsalSessionSheet({
  form,
  gang,
}: {
  form: FutsalSessionForm;
  gang: FutsalGangKey;
}) {
  const meta = gangMeta(gang);
  return (
    <SheetModal
      visible={form.open}
      title={form.edit ? 'Ubah Jadwal Main' : 'Jadwalkan Main'}
      subtitle={`${meta.emoji} ${meta.label}`}
      onClose={form.tutup}
      footer={
        <DualButtons
          confirmLabel="Simpan"
          busy={form.busy}
          onCancel={form.tutup}
          onConfirm={form.simpan}
        />
      }>
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        🗓️ Tanggal
      </VixText>
      {/* `key` per sesi: tanpa itu kalender masih memajang tanggal sesi yang
          dibuka sebelumnya. */}
      <DateField
        key={form.edit?.id ?? 'baru'}
        value={form.tanggal}
        onChange={form.setTanggal}
      />

      <View style={styles.formGap}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🕗 Dari jam
        </VixText>
        <TimeField value={form.jam} onChange={form.setJam} />
      </View>

      <View style={styles.formGap}>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🕙 Sampai jam
        </VixText>
        {/* Rodanya tidak bisa diputar ke bawah jam mulai — jadi jam selesai
            yang lebih awal tidak pernah sempat terpilih. */}
        <TimeField
          value={form.jamSelesai}
          minimumDate={form.jam}
          onChange={form.setJamSelesai}
        />
      </View>

      <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
        📍 Lapangan
      </VixText>
      <FormInput
        placeholder="Nama lapangan"
        value={form.venue}
        onChangeText={form.setVenue}
        editable={!form.busy}
      />

      {/* Dua isian di bawah dipakai pengumuman WhatsApp-nya. Keduanya
          diwarisi dari sesi terakhir, jadi cukup diketik sekali. */}
      <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
        🔗 Link Maps lapangan
      </VixText>
      <FormInput
        placeholder="Tempel link Google Maps"
        value={form.maps}
        onChangeText={form.setMaps}
        editable={!form.busy}
        autoCapitalize="none"
      />

      <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
        💵 Iuran per orang
      </VixText>
      <MoneyInput
        placeholder="Isi angka"
        value={form.fee}
        onChangeText={(t) => form.setFee(groupDigits(t))}
        editable={!form.busy}
      />

      <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
        🏦 Rekening setoran
      </VixText>
      <FormInput
        placeholder="mis. BCA 5271415860"
        value={form.bank}
        onChangeText={form.setBank}
        editable={!form.busy}
      />

      <FormInput
        style={styles.formGap}
        placeholder="Isi catatan yang terjadi saat itu"
        value={form.catatan}
        onChangeText={form.setCatatan}
        editable={!form.busy}
        multiline
      />

      <FormError message={form.formError} gap="top" />
      {form.edit && (
        <InlineDelete
          key={form.edit.id}
          label="Hapus jadwal ini"
          busy={form.busy}
          onDelete={form.hapus}
        />
      )}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { marginBottom: 6 },
  formGap: { marginTop: 10 },
});
