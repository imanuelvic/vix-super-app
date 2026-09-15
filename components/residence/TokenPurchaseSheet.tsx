import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { DualButtons } from '@/components/common/DualButtons';
import { EditDelete } from '@/components/common/EditDelete';
import { FormError } from '@/components/common/FormError';
import { FormInput } from '@/components/common/FormInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import type { TokenPurchaseForm } from '@/hooks/useTokenPurchaseForm';
import { groupDigits, parseAmount, parseDecimal } from '@/lib/format';
import { TOKEN_PLATFORMS } from '@/lib/token';
import { formatRupiah } from '@/lib/transactions';

// Isian beli token ⚡ — tampilan formulirnya saja; isinya dipegang
// `useTokenPurchaseForm`. Dipakai sub-tab Token & halaman Pembelian Token,
// jadi mencatat, mengubah, dan menghapus terasa sama persis di mana pun kamu
// sedang berdiri.
export function TokenPurchaseSheet({ form }: { form: TokenPurchaseForm }) {
  const biaya = parseAmount(form.biaya);
  const kwh = parseDecimal(form.kwh);
  return (
    <SheetModal
      visible={form.open}
      title={form.edit ? 'Ubah Pembelian' : 'Beli Token'}
      onClose={form.tutup}>
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        💰 Beli
      </VixText>
      <MoneyInput
        style={styles.formGap}
        placeholder="1.001.900"
        value={form.biaya}
        onChangeText={(t) => form.setBiaya(groupDigits(t))}
        editable={!form.busy}
      />

      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        ⚡ kWh
      </VixText>
      <FormInput
        style={styles.formGap}
        placeholder="114,96"
        keyboardType="decimal-pad"
        value={form.kwh}
        onChangeText={form.setKwh}
        editable={!form.busy}
      />
      {biaya > 0 && kwh > 0 ? (
        <VixText heading="label" additionalStyle={styles.hintTight}>
          Berarti {formatRupiah(Math.round(biaya / kwh))}/kWh.
        </VixText>
      ) : null}

      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        Platform
      </VixText>
      <View style={styles.chipWrap}>
        {TOKEN_PLATFORMS.map((p) => (
          <Chip
            key={p}
            label={p}
            active={form.platform === p}
            onPress={() => form.setPlatform(p)}
          />
        ))}
      </View>

      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        📆 Tanggal
      </VixText>
      <View style={styles.formGap}>
        {/* `key` per pembelian: tanpa itu kalender masih memajang tanggal
            pembelian yang dibuka sebelumnya. */}
        <DateField
          key={`b-${form.edit?.id ?? 'new'}`}
          value={form.tanggal}
          onChange={form.setTanggal}
        />
      </View>

      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        📝 Catatan (opsional)
      </VixText>
      <FormInput
        style={styles.formGap}
        placeholder="Catatan bebas"
        value={form.catatan}
        onChangeText={form.setCatatan}
        editable={!form.busy}
      />

      <FormError message={form.formError} />
      <EditDelete
        editing={form.edit}
        label="Hapus pembelian ini"
        busy={form.busy}
        onDelete={form.hapus}
      />
      <DualButtons
        confirmLabel="Simpan"
        busy={form.busy}
        onCancel={form.tutup}
        onConfirm={form.simpan}
      />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { marginBottom: 6 },
  formGap: { marginBottom: 10 },
  hintTight: { color: Color.TEXT_LABEL, marginBottom: 10 },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
});
