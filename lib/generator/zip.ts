import JSZip from 'jszip';
import { downloadBlob } from '@/lib/csv';

export interface EmbeddedFileEntry {
  filename: string;
  data: Uint8Array | Blob;
}

/**
 * Packs multiple embedded assets into a single ZIP archive and triggers browser download.
 */
export async function downloadEmbeddedFilesZip(
  entries: EmbeddedFileEntry[],
  customDateStr?: string
): Promise<void> {
  if (entries.length === 0) return;

  const dateStr = customDateStr || new Date().toISOString().slice(0, 10);
  const zip = new JSZip();

  for (const entry of entries) {
    zip.file(entry.filename, entry.data);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  downloadBlob(zipBlob, `doctorx_embedded_${dateStr}.zip`);
}
