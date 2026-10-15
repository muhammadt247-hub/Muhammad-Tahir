import { GeneratorItemState } from '@/lib/generator/queue';

export interface ResolutionIssue {
  itemId: string;
  filename: string;
  type: 'under_4mp' | 'over_100mp' | 'over_45mb';
  message: string;
  width: number;
  height: number;
  megapixels: number;
  fileSizeBytes: number;
  isRed: boolean;
}

export interface VarietyRepetitiveFirstWord {
  word: string;
  count: number;
  itemIds: string[];
  filenames: string[];
  message: string;
}

export interface VarietyOverusedKeyword {
  keyword: string;
  count: number;
  percentage: number;
  message: string;
}

export interface RowFileMatchReport {
  filesWithoutRow: {
    itemId: string;
    filename: string;
    reason: string;
  }[];
  rowsWithoutFile: {
    itemId: string;
    filename: string;
    title: string;
    reason: string;
  }[];
  isPerfectMatch: boolean;
}

export interface PreExportReport {
  totalItems: number;
  readyItems: number;
  excludedItems: number;
  blockedItemsCount: number; // Red errors (cannot export until fixed)
  warningItemsCount: number; // Amber warnings

  // Specific issues breakdown
  blockedTermIssues: {
    itemId: string;
    filename: string;
    terms: string[];
  }[];

  ambiguousTermIssues: {
    itemId: string;
    filename: string;
    terms: string[];
  }[];

  visualFlagIssues: {
    itemId: string;
    filename: string;
    flags: {
      identifiablePerson?: boolean;
      privateProperty?: boolean;
      visibleLogoOrBrand?: boolean;
      visibleText?: boolean;
      visibleTextOrLogo?: boolean;
      possibleEditorial?: boolean;
    };
    reasons: string[];
  }[];

  similarTitleIssues: {
    itemId: string;
    filename: string;
    otherFilename: string;
    score: number;
  }[];

  // Step 8 & User Request 3 additions:
  resolutionIssues: ResolutionIssue[];
  varietyIssues: {
    repetitiveFirstWords: VarietyRepetitiveFirstWord[];
    overusedKeywords: VarietyOverusedKeyword[];
  };
  rowFileMatch: RowFileMatchReport;

  canExportSafely: boolean;
}

/**
 * Builds a comprehensive pre-export compliance report for all items in the batch.
 */
export function buildPreExportReport(items: GeneratorItemState[]): PreExportReport {
  const doneItems = items.filter((i) => i.status === 'done');
  const excludedItems = items.filter((i) => i.isExcluded).length;
  const activeItems = doneItems.filter((i) => !i.isExcluded);

  const blockedTermIssues: PreExportReport['blockedTermIssues'] = [];
  const ambiguousTermIssues: PreExportReport['ambiguousTermIssues'] = [];
  const visualFlagIssues: PreExportReport['visualFlagIssues'] = [];
  const similarTitleIssues: PreExportReport['similarTitleIssues'] = [];
  const resolutionIssues: ResolutionIssue[] = [];

  // 1. Resolution & Dimension Checks
  for (const item of items) {
    const width = item.fileData.width || 0;
    const height = item.fileData.height || 0;
    const mp = width > 0 && height > 0 ? (width * height) / 1_000_000 : 0;
    const fileBytes = item.fileData.originalSize || item.fileData.file?.size || 0;

    // Check under 4 MP: Red issue "Below Adobe's 4 MP minimum, likely refused"
    if (width > 0 && height > 0 && mp < 4.0) {
      resolutionIssues.push({
        itemId: item.id,
        filename: item.fileData.originalName,
        type: 'under_4mp',
        message: "Below Adobe's 4 MP minimum, likely refused",
        width,
        height,
        megapixels: Number(mp.toFixed(2)),
        fileSizeBytes: fileBytes,
        isRed: true,
      });
    }

    // Check over 100 MP: Red issue
    if (mp > 100) {
      resolutionIssues.push({
        itemId: item.id,
        filename: item.fileData.originalName,
        type: 'over_100mp',
        message: `Over Adobe's 100 MP maximum limit (${mp.toFixed(1)} MP)`,
        width,
        height,
        megapixels: Number(mp.toFixed(2)),
        fileSizeBytes: fileBytes,
        isRed: true,
      });
    }

    // Check over 45 MB: Red issue
    if (fileBytes > 45 * 1024 * 1024) {
      resolutionIssues.push({
        itemId: item.id,
        filename: item.fileData.originalName,
        type: 'over_45mb',
        message: `Over Adobe's 45 MB file size limit (${(fileBytes / (1024 * 1024)).toFixed(1)} MB)`,
        width,
        height,
        megapixels: Number(mp.toFixed(2)),
        fileSizeBytes: fileBytes,
        isRed: true,
      });
    }
  }

  // 2. Compliance Scan & Visual Flags
  for (const item of activeItems) {
    const terms = item.blockedTermsFound || [];
    const hardBlocked = terms.filter((t) => !t.isAmbiguous);
    const ambiguous = terms.filter((t) => t.isAmbiguous);

    if (hardBlocked.length > 0) {
      blockedTermIssues.push({
        itemId: item.id,
        filename: item.fileData.originalName,
        terms: hardBlocked.map((t) => t.term),
      });
    }

    if (ambiguous.length > 0) {
      ambiguousTermIssues.push({
        itemId: item.id,
        filename: item.fileData.originalName,
        terms: ambiguous.map((t) => t.term),
      });
    }

    if (item.flags) {
      const hasAnyFlag =
        item.flags.identifiablePerson ||
        item.flags.privateProperty ||
        item.flags.visibleLogoOrBrand ||
        item.flags.visibleText ||
        item.flags.visibleTextOrLogo ||
        item.flags.possibleEditorial;

      if (hasAnyFlag) {
        visualFlagIssues.push({
          itemId: item.id,
          filename: item.fileData.originalName,
          flags: item.flags,
          reasons: item.flagReasons || [],
        });
      }
    }

    if (item.similarTo && item.similarTo.length > 0) {
      for (const sim of item.similarTo) {
        similarTitleIssues.push({
          itemId: item.id,
          filename: item.fileData.originalName,
          otherFilename: sim.otherFilename,
          score: sim.score,
        });
      }
    }
  }

  // 3. Variety Checks
  // A. Repetitive First Words: warn when more than 3 titles in a batch start with the same first word
  const firstWordMap = new Map<string, { count: number; itemIds: string[]; filenames: string[] }>();
  for (const item of doneItems) {
    if (!item.title?.trim() || item.title.trim() === item.fileData.originalName) continue;
    const cleanFirstWord = item.title
      .trim()
      .replace(/^[^a-zA-Z0-9]+/, '')
      .split(/\s+/)[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    if (cleanFirstWord && cleanFirstWord.length > 1) {
      const entry = firstWordMap.get(cleanFirstWord) || { count: 0, itemIds: [], filenames: [] };
      entry.count++;
      entry.itemIds.push(item.id);
      entry.filenames.push(item.fileData.originalName);
      firstWordMap.set(cleanFirstWord, entry);
    }
  }

  const repetitiveFirstWords: VarietyRepetitiveFirstWord[] = [];
  for (const [word, data] of firstWordMap.entries()) {
    if (data.count > 3) {
      repetitiveFirstWords.push({
        word,
        count: data.count,
        itemIds: data.itemIds,
        filenames: data.filenames,
        message: `${data.count} titles start with "${word}"`,
      });
    }
  }

  // B. Overused Keywords: warn when more than 40 percent of files share the same keyword
  const keywordCountMap = new Map<string, number>();
  const itemsWithKeywords = doneItems.filter((i) => i.keywords && i.keywords.length > 0);
  const totalWithKeywords = itemsWithKeywords.length;

  for (const item of itemsWithKeywords) {
    const uniqueKws = new Set(
      (item.keywords || [])
        .map((k) => k.toLowerCase().trim())
        .filter((k) => k.length > 1)
    );
    for (const kw of uniqueKws) {
      keywordCountMap.set(kw, (keywordCountMap.get(kw) || 0) + 1);
    }
  }

  const overusedKeywords: VarietyOverusedKeyword[] = [];
  if (totalWithKeywords >= 3) {
    for (const [kw, count] of keywordCountMap.entries()) {
      const percentage = Math.round((count / totalWithKeywords) * 100);
      if (percentage > 40) {
        overusedKeywords.push({
          keyword: kw,
          count,
          percentage,
          message: `${percentage}% of files (${count}/${totalWithKeywords}) share keyword "${kw}"`,
        });
      }
    }
  }

  // 4. Row / File Match Check
  // - Files that have no row (uploaded image files that will NOT be exported in the CSV)
  // - Rows that have no file (metadata rows in workspace that have no valid image upload)
  const filesWithoutRow: RowFileMatchReport['filesWithoutRow'] = [];
  const rowsWithoutFile: RowFileMatchReport['rowsWithoutFile'] = [];

  for (const item of items) {
    const hasImageFile = Boolean(
      item.fileData?.file || (item.fileData?.previewUrl && item.fileData?.previewUrl.length > 0)
    );

    if (!hasImageFile) {
      rowsWithoutFile.push({
        itemId: item.id,
        filename: item.fileData.originalName,
        title: item.title,
        reason: 'Metadata row has no corresponding image file uploaded',
      });
      continue;
    }

    // Check if this file gets an export row
    const mp = (item.fileData.width * item.fileData.height) / 1_000_000;
    const isUnder4Mp = mp < 4.0;
    const isOver100Mp = mp > 100;
    const isOver45Mb = (item.fileData.originalSize || 0) > 45 * 1024 * 1024;
    const hasHardBlocked = item.blockedTermsFound?.some((b) => !b.isAmbiguous);

    const willExport =
      item.status === 'done' &&
      !item.isExcluded &&
      !isUnder4Mp &&
      !isOver100Mp &&
      !isOver45Mb &&
      !hasHardBlocked &&
      (item.title?.trim().length > 0 || item.keywords?.length > 0);

    if (!willExport) {
      let reason = 'Generation not completed';
      if (item.status === 'failed') {
        reason = `Generation failed: ${item.errorMessage || 'Error'}`;
      } else if (item.status === 'queued' || item.status === 'working') {
        reason = 'Pending generation';
      } else if (isUnder4Mp) {
        reason = "Below Adobe's 4 MP minimum, likely refused";
      } else if (isOver100Mp) {
        reason = `Over Adobe's 100 MP limit (${mp.toFixed(1)} MP)`;
      } else if (isOver45Mb) {
        reason = "Over Adobe's 45 MB file size limit";
      } else if (item.isExcluded) {
        reason = item.excludedReason || 'Excluded by Similarity Guard';
      } else if (hasHardBlocked) {
        const terms = item.blockedTermsFound?.filter((b) => !b.isAmbiguous).map((b) => b.term).join(', ');
        reason = `Blocked trademark terms: ${terms}`;
      } else if (!item.title?.trim() && !item.keywords?.length) {
        reason = 'Empty metadata';
      }

      filesWithoutRow.push({
        itemId: item.id,
        filename: item.fileData.originalName,
        reason,
      });
    }
  }

  const rowFileMatch: RowFileMatchReport = {
    filesWithoutRow,
    rowsWithoutFile,
    isPerfectMatch: filesWithoutRow.length === 0 && rowsWithoutFile.length === 0,
  };

  const blockedItemsCount = blockedTermIssues.length;
  // Resolution red issues on active/not already excluded items
  const activeResolutionErrors = resolutionIssues.filter(
    (r) => r.isRed && !items.find((i) => i.id === r.itemId)?.isExcluded
  );

  const warningItemsCount =
    ambiguousTermIssues.length +
    visualFlagIssues.length +
    similarTitleIssues.length +
    repetitiveFirstWords.length +
    overusedKeywords.length;

  // Safe to export if no hard blocked terms, no unexcluded resolution errors, and at least 1 valid export row
  const canExportSafely =
    blockedItemsCount === 0 &&
    activeResolutionErrors.length === 0 &&
    items.length - filesWithoutRow.length > 0;

  return {
    totalItems: items.length,
    readyItems: items.length - filesWithoutRow.length,
    excludedItems,
    blockedItemsCount: blockedItemsCount + activeResolutionErrors.length,
    warningItemsCount,
    blockedTermIssues,
    ambiguousTermIssues,
    visualFlagIssues,
    similarTitleIssues,
    resolutionIssues,
    varietyIssues: {
      repetitiveFirstWords,
      overusedKeywords,
    },
    rowFileMatch,
    canExportSafely,
  };
}
