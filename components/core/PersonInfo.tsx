import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import {
  currentAge,
  DISC_OPTIONS,
  GENDER_OPTIONS,
  loveLangLabel,
  nextBirthday,
  studyLine,
  workLine,
  type CoreLeader,
  type MainTeamMember,
} from '@/lib/core';
import { dayIdToDate, formatDate, MONTH_NAMES } from '@/lib/format';

/**
 * Seluruh data satu orang, tanpa satu pun kolom isian.
 *
 * Dipakai CL maupun Main Team — kolomnya memang sama persis (lihat CoreLeader &
 * MainTeamMember di lib/core), jadi tidak ada gunanya dua tampilan berbeda.
 * Baris yang datanya belum diisi sengaja TIDAK ditampilkan: lebih baik pendek
 * daripada penuh baris "—".
 *
 * 27 Sep 2026: dipindah keluar dari LeadersTab supaya Rekap Visitasi 📊 bisa
 * memakai tampilan yang SAMA saat hati CL-nya di-click. Menyalinnya ke sana
 * berarti dua daftar kolom yang harus diingat untuk diubah bersamaan, dan yang
 * pertama meleset biasanya bukan bentuknya melainkan isinya: satu layar tahu
 * Love Language-nya, yang lain tidak.
 */
export function PersonInfo({
  person,
  today,
}: {
  person: CoreLeader | MainTeamMember;
  today: Date;
}) {
  const { daysUntil, turningAge } = nextBirthday(person, today);
  const belajar = studyLine(person);
  const kerja = workLine(person);
  const jenis = GENDER_OPTIONS.find((g) => g.key === person.gender)?.label;
  const disc = person.disc
    ? person.disc
        .split('')
        .map((k) => DISC_OPTIONS.find((d) => d.key === k)?.label ?? k)
        .join(' · ')
    : null;
  const love = loveLangLabel(person.loveLanguage);

  return (
    <View style={styles.viewList}>
      {/* Garis pemisah judul & isi — memisahkan "siapa"-nya (nama + peran di
          kepala modal) dari "datanya". Dipakai CL maupun Main Team, karena
          modalnya memang satu. */}
      <View style={styles.viewDivider} />
      <InfoRow
        label="🎂 Tanggal Lahir"
        value={`${person.birthDay} ${MONTH_NAMES[person.birthMonth]} ${person.birthYear} · ${currentAge(person, today)} th`}
      />
      <InfoRow
        label="🎈 Ulang Tahun"
        value={
          daysUntil === 0
            ? `Hari ini! 🎉 genap ${turningAge} th`
            : `${daysUntil} hari lagi · genap ${turningAge} th`
        }
      />
      {/* Dua isian pendek BERDAMPINGAN (No. HP + Gender, MBTI + Love
          Language): modalnya jadi lebih pendek, tidak perlu digulung untuk
          data yang cuma satu-dua kata. Kalau pasangannya kosong, yang ada
          melebar sendiri memenuhi barisnya. */}
      <View style={styles.viewPair}>
        <InfoRow
          label="📱 No. HP"
          value={person.phone ? `+62${person.phone}` : 'Belum ada nomor'}
          half
        />
        {jenis ? <InfoRow label="🚻 Gender" value={jenis} half /> : null}
      </View>
      {/* Formatnya utuh seperti Tanggal Lahir di atasnya ("8 Januari 2025"),
          bukan "8 Jan 25" ringkasan tabel. */}
      {'thanksgivingDayId' in person && person.thanksgivingDayId ? (
        <InfoRow
          label="🎉 Thanksgiving CORE"
          value={formatDate(dayIdToDate(person.thanksgivingDayId))}
        />
      ) : null}
      {belajar ? <InfoRow label="🎓 Pendidikan" value={belajar.slice(2)} /> : null}
      {kerja ? <InfoRow label="💼 Pekerjaan" value={kerja.slice(2)} /> : null}
      {disc ? <InfoRow label="🎨 DISC" value={disc} /> : null}
      {person.mbti || love ? (
        <View style={styles.viewPair}>
          {person.mbti ? <InfoRow label="🧩 MBTI" value={person.mbti} half /> : null}
          {love ? <InfoRow label="💞 Love Language" value={love} half /> : null}
        </View>
      ) : null}
    </View>
  );
}

// Satu baris data di modal baca-saja: keterangan kecil di atas, isinya di bawah.
// `half` = berbagi baris dengan pasangannya (lihat viewPair).
function InfoRow({
  label,
  value,
  half = false,
}: {
  label: string;
  value: string;
  half?: boolean;
}) {
  return (
    <View style={[styles.viewRow, half && styles.viewHalf]}>
      <VixText heading="label">{label}</VixText>
      <VixText heading="paragraph" additionalStyle={styles.viewValue}>
        {value}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  viewList: { gap: 12, paddingBottom: 4 },
  // Garis rambut pemisah kepala modal dari daftar datanya. Lebarnya ditarik
  // keluar padding wadahnya (-20 kiri-kanan) supaya membentang penuh seperti
  // garis footer modal, bukan mengambang di tengah. Sheet & dialog tengah
  // sama-sama berpadding 20, jadi angkanya cocok di keduanya.
  viewDivider: {
    height: 1,
    backgroundColor: Color.BORDER,
    marginHorizontal: -20,
    marginBottom: 2,
  },
  viewRow: { gap: 2 },
  // Dua baris pendek berdampingan; tiap paruh membagi lebar sama rata.
  viewPair: { flexDirection: 'row', gap: 12 },
  viewHalf: { flex: 1 },
  viewValue: { color: Color.TEXT_TITLE },
});
