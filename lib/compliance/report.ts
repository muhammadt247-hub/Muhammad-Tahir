import { GeneratorItemState } from '@/lib/generator/queue';

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

  canExportSafely: boolean;
}

/**
 * Builds a comprehensive pre-export compliance report for all completed items in the batch.
 */
export function buildPreExportReport(items: GeneratorItemState[]): PreExportReport {
  const doneItems = items.filter((i) => i.status === 'done');
  const excludedItems = doneItems.filter((i) => i.isExcluded).length;
  const activeItems = doneItems.filter((i) => !i.isExcluded);

  const blockedTermIssues: PreExportReport['blockedTermIssues'] = [];
  const ambiguousTermIssues: PreExportReport['ambiguousTermIssues'] = [];
  const visualFlagIssues: PreExportReport['visualFlagIssues'] = [];
  const similarTitleIssues: PreExportReport['similarTitleIssues'] = [];

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

  const blockedItemsCount = blockedTermIssues.length;
  const warningItemsCount =
    ambiguousTermIssues.length + visualFlagIssues.length + similarTitleIssues.length;

  return {
    totalItems: doneItems.length,
    readyItems: activeItems.length - blockedItemsCount,
    excludedItems,
    blockedItemsCount,
    warningItemsCount,
    blockedTermIssues,
    ambiguousTermIssues,
    visualFlagIssues,
    similarTitleIssues,
    canExportSafely: blockedItemsCount === 0 && activeItems.length > 0,
  };
}
