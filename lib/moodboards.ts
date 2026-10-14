import Papa from 'papaparse';
import JSZip from 'jszip';
import { Asset } from '@/types/asset';
import { downloadBlob } from '@/lib/csv';
import { toast } from 'sonner';

function sanitizeFilename(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'moodboard';
}

export function exportMoodboardToCsv(assets: Asset[], boardName: string = 'moodboard'): void {
  const rows = assets.map((a) => ({
    'Asset ID': a.id,
    'Title': a.title,
    'Contributor': a.creator_name,
    'Contributor ID': a.creator_id,
    'Category': a.category,
    'Content Type': a.content_type,
    'Origin': a.is_generative_ai ? 'AI Generated' : 'Non-AI',
    'Upload Date': a.creation_date,
    'Downloads': a.nb_downloads ?? '',
    'Keywords': (a.keywords || []).join('; '),
    'Adobe Stock URL': a.details_url,
    'Thumbnail URL': a.thumbnail_url,
  }));

  const csv = Papa.unparse(rows);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `${sanitizeFilename(boardName)}_${dateStr}.csv`);
}

export function exportMoodboardToJson(assets: Asset[], boardName: string = 'moodboard'): void {
  const jsonStr = JSON.stringify(
    {
      moodboard: boardName,
      exportedAt: new Date().toISOString(),
      itemCount: assets.length,
      assets,
    },
    null,
    2
  );
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `${sanitizeFilename(boardName)}_${dateStr}.json`);
}

export async function exportMoodboardToZip(
  assets: Asset[],
  boardName: string = 'moodboard'
): Promise<void> {
  const toastId = toast.loading('Packaging moodboard ZIP...');
  try {
    const zip = new JSZip();
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = sanitizeFilename(boardName);

    // 1. CSV
    const rows = assets.map((a) => ({
      'Asset ID': a.id,
      'Title': a.title,
      'Contributor': a.creator_name,
      'Contributor ID': a.creator_id,
      'Category': a.category,
      'Content Type': a.content_type,
      'Origin': a.is_generative_ai ? 'AI Generated' : 'Non-AI',
      'Upload Date': a.creation_date,
      'Downloads': a.nb_downloads ?? '',
      'Keywords': (a.keywords || []).join('; '),
      'Adobe Stock URL': a.details_url,
      'Thumbnail URL': a.thumbnail_url,
    }));
    const csv = Papa.unparse(rows);
    zip.file(`${safeName}_metadata.csv`, '\uFEFF' + csv);

    // 2. JSON
    zip.file(
      `${safeName}_metadata.json`,
      JSON.stringify(
        {
          moodboard: boardName,
          exportedAt: new Date().toISOString(),
          itemCount: assets.length,
          assets,
        },
        null,
        2
      )
    );

    // 3. Keywords text file (deduplicated)
    const kwSet = new Set<string>();
    assets.forEach((a) => a.keywords?.forEach((k) => kwSet.add(k)));
    zip.file(`${safeName}_keywords.txt`, Array.from(kwSet).join(', '));

    // 4. Try fetching thumbnails if possible (best-effort)
    const imgFolder = zip.folder('images');
    if (imgFolder) {
      await Promise.all(
        assets.slice(0, 50).map(async (asset) => {
          if (!asset.thumbnail_url) return;
          try {
            const res = await fetch(asset.thumbnail_url, { mode: 'cors' });
            if (res.ok) {
              const buffer = await res.arrayBuffer();
              imgFolder.file(`asset_${asset.id}.jpg`, buffer);
            }
          } catch {
            // Ignore cross-origin image download failures
          }
        })
      );
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `${safeName}_${dateStr}.zip`);
    toast.success('Moodboard ZIP downloaded!', { id: toastId });
  } catch (err) {
    console.error('Failed to export moodboard zip:', err);
    toast.error('Failed to create moodboard ZIP', { id: toastId });
  }
}
