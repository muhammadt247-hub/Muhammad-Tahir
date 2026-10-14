import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Asset } from '@/types/asset';
import { GeneratorItem } from '@/types/generator';
import { PLATFORMS } from '@/config/platforms';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportAssetsToCsv(
  assets: Asset[],
  query: string = 'assets',
  filters: string = ''
): void {
  const now = new Date().toISOString();
  const rows = assets.map((a) => ({
    'Asset ID': a.id,
    'Title': a.title,
    'Contributor Name': a.creator_name,
    'Contributor ID': a.creator_id,
    'Category': a.category,
    'Content Type': a.content_type,
    'Origin': a.is_generative_ai ? 'AI Generated' : 'Non-AI',
    'Upload Date': a.creation_date,
    'Downloads': a.nb_downloads ?? '',
    'Keywords': (a.keywords || []).join('; '),
    'Adobe Stock URL': a.details_url,
    'Thumbnail URL': a.thumbnail_url,
    'Search Query': query,
    'Filters Used': filters,
    'Exported At': now,
  }));

  const csv = Papa.unparse(rows);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeQuery = (query || 'all').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  downloadBlob(blob, `adobe-analytics_${safeQuery}_${dateStr}.csv`);
}

export function exportAssetsToXlsx(
  assets: Asset[],
  query: string = 'assets',
  filters: string = ''
): void {
  const now = new Date().toISOString();
  const rows = assets.map((a) => ({
    'Asset ID': a.id,
    'Title': a.title,
    'Contributor Name': a.creator_name,
    'Contributor ID': a.creator_id,
    'Category': a.category,
    'Content Type': a.content_type,
    'Origin': a.is_generative_ai ? 'AI Generated' : 'Non-AI',
    'Upload Date': a.creation_date,
    'Downloads': a.nb_downloads ?? '',
    'Keywords': (a.keywords || []).join('; '),
    'Adobe Stock URL': a.details_url,
    'Thumbnail URL': a.thumbnail_url,
    'Search Query': query,
    'Filters Used': filters,
    'Exported At': now,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Adobe Analytics');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeQuery = (query || 'all').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  downloadBlob(blob, `adobe-analytics_${safeQuery}_${dateStr}.xlsx`);
}

export function exportAssetsToJson(assets: Asset[], query: string = 'assets'): void {
  const jsonStr = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      query,
      count: assets.length,
      assets,
    },
    null,
    2
  );
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeQuery = (query || 'all').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  downloadBlob(blob, `adobe-analytics_${safeQuery}_${dateStr}.json`);
}

export function buildPlatformCsvString(
  platformId: 'adobe' | 'shutterstock' | 'freepik' | 'generic',
  items: GeneratorItem[]
): string {
  const finished = items.filter((i) => i.status === 'done');
  let data: Record<string, string>[] = [];

  if (platformId === 'adobe') {
    data = finished.map((item) => ({
      'Filename': item.filename,
      'Title': item.title,
      'Keywords': item.keywords.join(', '),
      'Category': item.category || '8', // default 8: Graphic Resources
      'Releases': '',
    }));
  } else if (platformId === 'shutterstock') {
    data = finished.map((item) => ({
      'Filename': item.filename,
      'Description': item.title,
      'Keywords': item.keywords.join(', '),
      'Categories': item.category || 'Backgrounds/Textures',
      'Editorial': 'no',
      'Mature content': 'no',
      'Illustration': item.filename.toLowerCase().endsWith('.png') || item.filename.toLowerCase().endsWith('.svg') ? 'yes' : 'no',
    }));
  } else if (platformId === 'freepik') {
    data = finished.map((item) => {
      const row: Record<string, string> = {
        'File name': item.filename,
        'Title': item.title,
        'Keywords': item.keywords.join(', '),
      };
      if (item.isAi) {
        row['Prompt'] = item.prompt || item.title;
        row['Model'] = item.model || 'Midjourney / Flux / Imagen';
      }
      return row;
    });
  } else {
    data = finished.map((item) => ({
      'Filename': item.filename,
      'Title': item.title,
      'Description': item.description,
      'Keywords': item.keywords.join(', '),
      'Category': item.category,
      'Is_AI': item.isAi ? 'yes' : 'no',
    }));
  }

  const csv = Papa.unparse(data, {
    delimiter: PLATFORMS[platformId]?.delimiter || ',',
  });

  return '\uFEFF' + csv;
}

export async function exportGeneratorBatch(
  platforms: ('adobe' | 'shutterstock' | 'freepik' | 'generic')[],
  items: GeneratorItem[]
): Promise<void> {
  const dateStr = new Date().toISOString().slice(0, 10);

  if (platforms.length === 1) {
    const p = platforms[0];
    const csvContent = buildPlatformCsvString(p, items);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${p}_metadata_${dateStr}.csv`);
    return;
  }

  // Multi-platform ZIP
  const zip = new JSZip();
  for (const p of platforms) {
    const csvContent = buildPlatformCsvString(p, items);
    zip.file(`${p}_metadata_${dateStr}.csv`, csvContent);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `doctorx_metadata_batch_${dateStr}.zip`);
}
