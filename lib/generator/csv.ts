import { PlatformId, PLATFORM_SPECS } from '@/config/platforms';

export interface GeneratorResultExportItem {
  originalName: string;
  title?: string;
  description?: string;
  keywords?: string[];
  prompt?: string;
  status: 'queued' | 'working' | 'done' | 'failed';
}

function escapeCsvField(value: string | undefined | null, quoteAll = false, delimiter = ','): string {
  const str = value == null ? '' : String(value);
  const needsQuotes =
    quoteAll ||
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r');

  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateMarketplaceCsv(
  items: GeneratorResultExportItem[],
  platform: PlatformId
): string {
  const spec = PLATFORM_SPECS[platform] || PLATFORM_SPECS['adobe-stock'];
  const delimiter = spec.delimiter;
  const quoteAll = !!spec.quoteAllFields;

  // Header row
  const header = spec.columns.map((c) => escapeCsvField(c, quoteAll, delimiter)).join(delimiter);

  const rows: string[] = [header];

  for (const item of items) {
    // Skip failed or empty items
    if (item.status === 'failed' || (!item.title && !item.keywords?.length)) {
      continue;
    }

    const filename = item.originalName;
    const title = item.title || '';
    const description = item.description || title || '';
    const keywordsStr = (item.keywords || []).join(',');

    let rowValues: string[] = [];

    switch (platform) {
      case 'adobe-stock':
        // Filename,Title,Keywords
        rowValues = [
          escapeCsvField(filename, quoteAll, delimiter),
          escapeCsvField(title, quoteAll, delimiter),
          escapeCsvField(keywordsStr, true, delimiter), // keywords joined by comma must be quoted
        ];
        break;

      case 'freepik':
        // File name;Title;Keywords (every field quoted)
        rowValues = [
          escapeCsvField(filename, true, delimiter),
          escapeCsvField(title, true, delimiter),
          escapeCsvField(keywordsStr, true, delimiter),
        ];
        break;

      case 'shutterstock':
      case 'general':
      default:
        // Filename,Title,Description,Keywords
        rowValues = [
          escapeCsvField(filename, quoteAll, delimiter),
          escapeCsvField(title, quoteAll, delimiter),
          escapeCsvField(description, quoteAll, delimiter),
          escapeCsvField(keywordsStr, true, delimiter),
        ];
        break;
    }

    rows.push(rowValues.join(delimiter));
  }

  // Prepend UTF-8 BOM
  return '\uFEFF' + rows.join('\r\n');
}

export function generatePromptCsv(items: GeneratorResultExportItem[]): string {
  const delimiter = ',';
  const header = ['Filename', 'Prompt'].map((c) => escapeCsvField(c, false, delimiter)).join(delimiter);
  const rows: string[] = [header];

  for (const item of items) {
    if (item.status === 'failed' || !item.prompt) continue;

    rows.push(
      [
        escapeCsvField(item.originalName, false, delimiter),
        escapeCsvField(item.prompt, true, delimiter),
      ].join(delimiter)
    );
  }

  return '\uFEFF' + rows.join('\r\n');
}

export function downloadCsvFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
