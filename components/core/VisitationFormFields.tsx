import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DateField } from '@/components/common/DateField';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SelectField } from '@/components/common/SelectField';
import { TimeField } from '@/components/common/TimeField';
import { VixText } from '@/components/common/VixText';
import { type VisitationForm } from '@/hooks/useVisitationForm';
import { MEETING_KINDS, type CoreLeader } from '@/lib/core';

// Isi bottom sheet "Visitasi": jenis acara → penanda Thanksgiving → CORE-nya
// siapa → tanggal → judul → agenda → sudah selesai.
//
// Dipakai bersama sub-tab Visitation (CORE) & Riwayat Visitasi 🕘 — dulu blok
// ini disalin utuh di dua layar, jadi menambah satu kolom berarti mengubah dua
// tempat dan gampang jadi beda sendiri. Tombol simpan/hapus TIDAK di sini:
// keduanya memang berbeda per layar.
export function VisitationFormFields({
  form,
  leaders,
  busy,
  dateKey,
  agendaPlaceholder,
}: {
  form: VisitationForm;
  leaders: CoreLeader[];
  busy: boolean;
  /** Ganti nilai ini tiap ganti jadwal → state internal DateField ikut reset. */
  dateKey: string | undefined;
  /** Teks bayangan kolom agenda — beda kalimat di tiap layar. */
  agendaPlaceholder: string;
}) {
  return (
    <>
      {/* Picker: daftar pilihan baru muncul saat baris ini ditekan, jadi
          modal tidak langsung penuh oleh semua jenis & nama CORE. */}
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        Jenis visitasi
      </VixText>
      <View style={styles.formGap}>
        <SelectField
          value={form.kind}
          options={MEETING_KINDS.map((k) => ({
            key: k.key,
            label: `${k.icon} ${k.label}`,
          }))}
          onChange={(k) => k && form.changeKind(k)}
          placeholder="Pilih jenis visitasi…"
        />
      </View>

      {/* Thanksgiving itu penanda TAMBAHAN — acara apa pun bisa sekalian jadi
          Thanksgiving. Disembunyikan kalau jenisnya memang Thanksgiving supaya
          tidak menanyakan hal yang sama dua kali. */}
      {form.kind !== 'thanksgiving' && (
        <PressableScale
          style={styles.doneRow}
          onPress={() => form.setThanksgiving(!form.thanksgiving)}>
          <CheckCircle checked={form.thanksgiving} />
          <VixText heading="paragraph" additionalStyle={styles.doneText}>
            🎉 Thanksgiving
          </VixText>
        </PressableScale>
      )}

      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        {form.multiLeader ? 'CORE mana saja yang gabung?' : 'CORE-nya siapa?'}
      </VixText>
      {form.multiLeader ? (
        // Acara gabungan → centang sebanyak-banyaknya.
        <View style={styles.leaderWrap}>
          {leaders.map((l) => (
            <Chip
              key={l.id}
              label={`${l.heart} ${l.name}`}
              active={form.leaderIds.includes(l.id)}
              onPress={() => form.toggleLeader(l.id)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.formGap}>
          <SelectField
            value={form.leaderIds[0] ?? ''}
            options={leaders.map((l) => ({
              key: l.id,
              label: `${l.heart} ${l.name}`,
            }))}
            onChange={(id) => id && form.setLeaderIds([id])}
            placeholder="Pilih CORE Leader…"
          />
        </View>
      )}

      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        Tanggal visitasi
      </VixText>
      <View style={styles.formGap}>
        <DateField key={dateKey} value={form.date} onChange={form.setDate} />
      </View>

      {/* Jam pertemuan — menempel di objek Date yang SAMA dengan tanggal di
          atas (DateField mengubah tanggalnya, TimeField jamnya), jadi keduanya
          tersimpan sebagai satu kolom. Jamnya ikut tampil di kartu daftar
          ("Sen, 31 Agu, 26 Pk. 19.00") dan di PDF-nya ("Mulai: 15.00 WIB"). */}
      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        🕒 Jam pertemuan
      </VixText>
      <View style={styles.formGap}>
        <TimeField
          key={`t-${dateKey}`}
          value={form.date}
          onChange={form.setDate}
        />
      </View>

      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        🏷️ Judul Visitasi
      </VixText>
      <FormInput
        style={styles.formGap}
        placeholder="Judul singkat"
        value={form.note}
        onChangeText={form.setNote}
        editable={!busy}
      />

      <VixText heading="label" additionalStyle={styles.fieldLabel}>
        🗒️ Agenda visitasi
      </VixText>
      <FormInput
        style={[styles.textArea, styles.formGap]}
        placeholder={agendaPlaceholder}
        value={form.agenda}
        onChangeText={form.setAgenda}
        editable={!busy}
        multiline
      />

      {/* Tandai selesai setelah visit — hanya kalau tanggalnya sudah tiba */}
      {!form.futureDate && (
        <PressableScale
          style={styles.doneRow}
          onPress={() => form.setDone(!form.done)}>
          <CheckCircle checked={form.done} />
          <VixText heading="paragraph" additionalStyle={styles.doneText}>
            Sudah selesai ✅
          </VixText>
        </PressableScale>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { marginBottom: 6 },
  leaderWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  formGap: { marginBottom: 10 },
  textArea: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  doneText: { color: Color.TEXT_TITLE },
});
