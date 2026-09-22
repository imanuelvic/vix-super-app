import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { EmojiButton } from '@/components/common/EmojiButton';
import { EmptyText } from '@/components/common/EmptyText';
import { FormError } from '@/components/common/FormError';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { SheetModal } from '@/components/common/SheetModal';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useBusyTask } from '@/hooks/useBusyTask';
import { useFeatureTheme } from '@/hooks/useFeatureTheme';
import { useLiveAll } from '@/hooks/useLiveAll';
import {
  lastSharedTo,
  subscribeCoreLeaders,
  subscribeShareLog,
  type CoreLeader,
  type ShareDocKind,
  type ShareLog,
} from '@/lib/core';
import { formatCompactDateTime } from '@/lib/format';
import { shareDocToLeader, sharePesanPengantar } from '@/lib/shareLeader';
import { openWhatsAppChat, WHATSAPP_ERROR } from '@/lib/whatsapp';

// Sheet "Bagikan ke CORE Leader" — dipakai tombol share Rekap Visitasi 📊
// (dokumen untuk BANYAK CL, jadi harus memilih). Satu daftar CL (hati, nama,
// nomor HP, kapan dokumen ini terakhir dikirim padanya); click satu CL →
// PDF-nya dibuat oleh layar pemanggil (`share`), lalu share sheet → catat →
// chat WA (urutannya di lib/shareLeader.ts). Tombol 💬 di tiap baris membuka
// chat itu saja, tanpa PDF (mis. untuk mengingatkan).
//
// Wheel of Life 🎡 & Timeline 📍 milik satu CL TIDAK lewat sini lagi (22 Sep
// 2026): dokumennya personal, jadi tombol share-nya langsung ke orangnya.
export function ShareToLeaderSheet({
  visible,
  onClose,
  kind,
  doc,
  share,
}: {
  visible: boolean;
  onClose: () => void;
  /** Dokumen apa yang dibagikan — penentu kolom "terakhir dibagikan"-nya. */
  kind: ShareDocKind;
  /** Nama dokumennya untuk manusia, mis. "Rekap Visitasi 2026" / "Timeline 💚 David". */
  doc: string;
  /**
   * Buat PDF-nya & buka share sheet. `lastShared` = kapan dokumen ini terakhir
   * dikirim ke CL itu (untuk dicetak di kop). Melempar error kalau gagal.
   */
  share: (leader: CoreLeader, lastShared: Date | null) => Promise<void>;
}) {
  const { user } = useAuth();
  const theme = useFeatureTheme();

  const [leaders, setLeaders] = useState<CoreLeader[] | null>(null);
  const [log, setLog] = useState<ShareLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Firestore baru didengarkan setelah sheet ini PERNAH dibuka, bukan sejak
  // layarnya dibuka: yang tidak pernah click bagikan tak perlu membaca apa pun.
  // (Pola "simpan dari render sebelumnya" resmi React, bukan setState di effect.)
  const [pernahDibuka, setPernahDibuka] = useState(visible);
  if (visible && !pernahDibuka) setPernahDibuka(true);

  useLiveAll(
    (uid, fail) => [
      subscribeCoreLeaders(uid, setLeaders, fail),
      subscribeShareLog(uid, setLog, fail),
    ],
    { onError: setError, when: pernahDibuka },
  );

  // key = id CL yang PDF-nya sedang dibuat → cuma baris itu yang berputar.
  const tugas = useBusyTask<string>();

  function bukaChat(l: CoreLeader) {
    if (!l.phone) return;
    setError(null);
    void openWhatsAppChat(l.phone, sharePesanPengantar(l, doc), () => setError(WHATSAPP_ERROR));
  }

  function kirim(l: CoreLeader) {
    if (!user) return;
    const uid = user.uid;
    void tugas.run({
      key: l.id,
      start: () => setError(null),
      task: () =>
        shareDocToLeader({
          uid,
          leader: l,
          kind,
          doc,
          log,
          share,
          onWaError: () => setError(WHATSAPP_ERROR),
        }),
      fail: () => setError(`Gagal membuat PDF ${doc}. Coba lagi.`),
    });
  }

  function tutup() {
    if (tugas.busy !== null) return;
    setError(null);
    onClose();
  }

  return (
    <SheetModal
      visible={visible}
      title="Bagikan ke CORE Leader"
      subtitle={doc}
      onClose={tutup}>
      <VixText heading="label" additionalStyle={styles.hint}>
        Click nama CL: PDF-nya dibagikan lewat share sheet (pilih WhatsApp),
        lalu chat WA ke nomornya langsung terbuka. 💬 = buka chat-nya saja.
      </VixText>
      <FormError message={error} />

      {leaders === null ? (
        <LoadingCenter />
      ) : leaders.length === 0 ? (
        <EmptyText>Belum ada CORE Leader.</EmptyText>
      ) : (
        leaders.map((l) => {
          const terakhir = lastSharedTo(log, l.id, kind);
          const sibuk = tugas.busy === l.id;
          return (
            // 💬 jadi SAUDARA area click, bukan anaknya — Pressable bersarang
            // di iOS bikin click tombolnya ikut memicu barisnya.
            <View key={l.id} style={styles.row}>
              <PressableScale
                style={styles.rowLeft}
                onPress={() => kirim(l)}
                disabled={tugas.busy !== null}>
                <VixText additionalStyle={styles.heart}>{l.heart}</VixText>
                <View style={styles.info}>
                  <VixText heading="bold" additionalStyle={styles.name}>
                    {l.name}
                  </VixText>
                  <VixText
                    heading="label"
                    additionalStyle={l.phone ? undefined : styles.noPhone}>
                    📱 {l.phone ? `+62${l.phone}` : 'belum ada nomor'}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.shared}>
                    {terakhir
                      ? `📤 Terakhir dibagikan ${formatCompactDateTime(terakhir)}`
                      : '📤 Belum pernah dibagikan'}
                  </VixText>
                </View>
                {sibuk ? (
                  <ActivityIndicator color={theme.fg} />
                ) : (
                  <IconSymbol name="square.and.arrow.up" size={20} color={theme.fg} />
                )}
              </PressableScale>
              <EmojiButton
                emoji="💬"
                onPress={() => bukaChat(l)}
                disabled={!l.phone || tugas.busy !== null}
              />
            </View>
          );
        })
      )}

    </SheetModal>
  );
}

const styles = StyleSheet.create({
  hint: { color: Color.TEXT_LABEL, marginBottom: 12 },
  row: {
    ...CARD,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heart: { fontSize: 28, lineHeight: 34 },
  info: { flex: 1, gap: 1 },
  name: { color: Color.TEXT_TITLE },
  noPhone: { color: Color.TEXT_PLACEHOLDER },
  shared: { color: Color.TEXT_PLACEHOLDER },
});
