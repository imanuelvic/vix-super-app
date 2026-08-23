import { StyleSheet } from 'react-native';

import { CenterDialog } from '@/components/common/CenterDialog';
import { DualButtons } from '@/components/common/DualButtons';
import { VixText } from '@/components/common/VixText';

// Dialog konfirmasi aksi destruktif (hapus) — Batal / tombol merah.
//
// `danger={false}` untuk aksi yang cuma perlu dipastikan tapi TIDAK merusak
// (mis. "kembalikan jadi CORE Leader"): tombolnya jadi warna utama, bukan
// merah — merah untuk semua hal bikin peringatannya jadi tak berarti.
export function ConfirmDialog({
  visible,
  title,
  detail,
  confirmLabel = 'Hapus',
  danger = true,
  busy = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  detail?: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <CenterDialog visible={visible} onClose={onCancel}>
      <VixText heading="title" additionalStyle={styles.title}>
        {title}
      </VixText>
      {detail ? <VixText heading="label">{detail}</VixText> : null}
      <DualButtons
        confirmLabel={confirmLabel}
        danger={danger}
        busy={busy}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </CenterDialog>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 6 },
});
