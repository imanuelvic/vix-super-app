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
import type { SportSessionForm } from '@/hooks/useSportSessionForm';
import { groupDigits } from '@/lib/format';
import { gangMeta, type SportGangKey } from '@/lib/sport';

// Isian jadwal main ⚽ — tampilan formulirnya saja; isinya dipegang
// `useSportSessionForm`. Dipakai sub-tab Fun Sport & halaman Jadwal Main, jadi
// menjadwalkan, mengubah, dan menghapus terasa sama persis di mana pun kamu
// sedang berdiri.
export function SportSessionSheet({
  form,
  gang,
}: {
  form: SportSessionForm;
  gang: SportGangKey;
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
          🕗 Jam
        </VixText>
        <TimeField value={form.jam} onChange={form.setJam} />
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

      <VixText heading="label" additionalStyle={[styles.fieldLabel, styles.formGap]}>
        💵 Iuran per orang
      </VixText>
      <MoneyInput
        placeholder="Isi angka"
        value={form.fee}
        onChangeText={(t) => form.setFee(groupDigits(t))}
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
