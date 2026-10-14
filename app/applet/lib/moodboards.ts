import Papa from 'papaparse';
import JSZip from 'jszip';
import { Asset } from '@/types/asset';
import { downloadBlob } from '@/lib/csv';
import { toast } from 'sonner';

/**
 * Exports a moodboard's assets to a CSV matching the exact required schema:
 * Title,Keywords,Creator Name,Creator ID,Asset ID,Category,Upload Date,Downloads,AI Status,Asset URL
 */
export function exportMoodboardToCsv(assets: Asset[], boardName: string): void {
  const rows = assets.map((a) => ({
    'Title': a.title,
    'Keywords': (a.keywords || []).join(', '),
    'Creator Name': a.creator_name,
    'Creator ID': a.creator_id,
    'Asset ID': a.id,
    'Category': a.category || '',
    'Upload Date': a.creation_date,
    'Downloads': a.nb_downloads ?? '',
    'AI Status': a.is_generative_ai ? 'AI' : 'Non-AI',
    'Asset URL': a.details_url,
  }));

  const csv = Papa.unparse(rows, {
    quotes: true,
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = boardName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'board';
  downloadBlob(blob, `moodboard_${safeName}_${dateStr}.csv`);
}

/**
 * Exports a moodboard's full asset data as formatted JSON.
 */
export function exportMoodboardToJson(assets: Asset[], boardName: string): void {
  const jsonStr = JSON.stringify(assets, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = boardName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'board';
  downloadBlob(blob, `moodboard_${safeName}_${dateStr}.json`);
}

/**
 * Exports a moodboard as a ZIP archive containing:
 * - moodboard_<board-name>_<date>.csv
 * - <asset-id>.jpg for each asset thumbnail fetched via /api/image-proxy
 */
export async function exportMoodboardToZip(assets: Asset[], boardName: string): Promise<void> {
  if (assets.length === 0) {
    toast.info('No assets to export');
    return;
  }

  const toastId = toast.loading(`Building ZIP for "${boardName}"...`);
  const zip = new JSZip();
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = boardName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'board';

  // 1. Add CSV file
  const rows = assets.map((a) => ({
    'Title': a.title,
    'Keywords': (a.keywords || []).join(', '),
    'Creator Name': a.creator_name,
    'Creator ID': a.creator_id,
    'Asset ID': a.id,
    'Category': a.category || '',
    'Upload Date': a.creation_date,
    'Downloads': a.nb_downloads ?? '',
    'AI Status': a.is_generative_ai ? 'AI' : 'Non-AI',
    'Asset URL': a.details_url,
  }));
  const csv = Papa.unparse(rows, { quotes: true });
  zip.file(`moodboard_${safeName}_${dateStr}.csv`, '\uFEFF' + csv);

  // 2. Fetch and add thumbnails
  let fetchedCount = 0;
  for (const asset of assets) {
    if (!asset.thumbnail_url) continue;

    try {
      // Use local image proxy to prevent CORS issues
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(asset.thumbnail_url)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        zip.file(`${asset.id}.jpg`, arrayBuf);
        fetchedCount++;
      }
    } catch {
      // Gracefully skip failed thumbnail
    }
  }

  try {
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    toast.dismiss(toastId);
    downloadBlob(zipBlob, `moodboard_${safeName}_${dateStr}.zip`);
    toast.success(`Exported ${assets.length} items (${fetchedCount} images) to ZIP`);
  } catch (err) {
    toast.dismiss(toastId);
    toast.error('Failed to generate ZIP archive');
    console.error(err);
  }
}
