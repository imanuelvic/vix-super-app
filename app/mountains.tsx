import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { FilterChips } from '@/components/common/FilterChips';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SectionRow } from '@/components/common/SectionRow';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { useLive } from '@/hooks/useLive';
import { formatCompactDate } from '@/lib/format';
import { subscribeFun, type FunData } from '@/lib/fun';
import {
  conqueredMountains,
  elevationLabel,
  MOUNTAIN_PROVINCES,
  MOUNTAINS,
  mountainsOf,
  mountainTitle,
  type MountainProvince,
} from '@/lib/mountains';

// Gunung di Jawa 🏔️ — daftar gunung yang lazim didaki di Jawa Barat, Jawa
// Tengah & Jawa Timur (lib/mountains.ts), plus tanda ✓ dan tanggal
// menaklukkannya yang dibaca dari arsip Summit. Dibuka dari tombol 🏔️ di
// kanan atas sub-tab Summit.
//
// Click gunung yang sudah ditaklukkan → catatan Summit-nya; yang belum →
// isian Summit baru dengan gunung itu sudah terpilih.
export default function MountainsScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [data] = useLive<FunData>(subscribeFun, { onError: setError });
  const [province, setProvince] = useState<MountainProvince | null>(null);

  const taklukan = useMemo(
    () => conqueredMountains(data?.entries ?? []),
    [data],
  );
  const jumlahTaklukan = taklukan.size;
  // Gunung tertinggi yang sudah didaki, untuk baris kecil kartu ringkasan.
  const tertinggi = MOUNTAINS.filter((m) => taklukan.has(m.id)).sort(
    (a, b) => b.elevation - a.elevation,
  )[0];

  const provinsiTampil = MOUNTAIN_PROVINCES.filter(
    (p) => !province || p.key === province,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Fun"
        title="Gunung di Jawa 🏔️"
        subtitle="Jawa Barat · Jawa Tengah · Jawa Timur"
      />
      <ScreenError message={error} />

      {data === null && !error ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <SummaryCard
            label="Sudah ditaklukkan"
            value={`${jumlahTaklukan} dari ${MOUNTAINS.length} gunung ⛰️`}
            sub={
              tertinggi
                ? `Tertinggi: ${mountainTitle(tertinggi)} · ${elevationLabel(tertinggi.elevation)}`
                : 'Belum ada. Mulai dari yang ramah pemula 🌱'
            }
          />

          <FilterChips
            options={MOUNTAIN_PROVINCES.map((p) => ({
              key: p.key,
              label: p.label,
              count: mountainsOf(p.key).filter((m) => taklukan.has(m.id)).length,
            }))}
            value={province}
            onChange={setProvince}
            allLabel="Semua"
          />

          {provinsiTampil.map((p) => {
            const daftar = mountainsOf(p.key);
            const sudah = daftar.filter((m) => taklukan.has(m.id)).length;
            return (
              <View key={p.key}>
                <SectionRow
                  title={p.label}
                  right={
                    <VixText heading="label" additionalStyle={styles.sectionCount}>
                      {sudah}/{daftar.length} ✓
                    </VixText>
                  }
                />
                {daftar.map((m) => {
                  const t = taklukan.get(m.id);
                  return (
                    <PressableScale
                      key={m.id}
                      style={[styles.row, t && styles.rowDone]}
                      onPress={() =>
                        t
                          ? router.push({
                              pathname: '/fun/[id]',
                              params: { id: t.entryId, category: 'summit' },
                            })
                          : router.push({
                              pathname: '/fun/[id]',
                              params: { id: 'new', category: 'summit', mountain: m.id },
                            })
                      }>
                      <View style={styles.rowMain}>
                        <VixText
                          heading="bold"
                          additionalStyle={t ? styles.nameDone : styles.name}>
                          {mountainTitle(m)}
                        </VixText>
                        <VixText heading="label" numberOfLines={2}>
                          {elevationLabel(m.elevation)} · {m.note}
                        </VixText>
                        {t ? (
                          <VixText heading="label" additionalStyle={styles.datePill}>
                            🏁 {t.date ? formatCompactDate(t.date) : 'tanggal belum diisi'}
                          </VixText>
                        ) : null}
                      </View>
                      {/* Penanda status (bukan tombol centang) — `locked`. */}
                      <CheckCircle checked={!!t} size={26} locked />
                    </PressableScale>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  sectionCount: { color: Color.FUN_DARK },
  row: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  // Sudah ditaklukkan: kartunya ikut warna Fun & bergaris tepi gelapnya, jadi
  // yang sudah didaki terbaca sekilas di antara yang belum.
  rowDone: { backgroundColor: Color.FUN, borderColor: Color.FUN_DARK },
  rowMain: { flex: 1, gap: 2 },
  name: { color: Color.TEXT_TITLE },
  nameDone: { color: Color.FUN_DARK },
  // Pil tanggal taklukan: putih lembut di atas kartu pastel.
  datePill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Color.CONTAINER,
    color: Color.FUN_DARK,
  },
});
