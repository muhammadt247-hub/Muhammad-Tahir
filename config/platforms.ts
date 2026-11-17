export type PlatformId = 'general' | 'adobe-stock' | 'shutterstock' | 'freepik';

export interface PlatformCategory {
  id: string;
  name: string;
}

export const DEFAULT_PLATFORM_CATEGORIES: PlatformCategory[] = [
  { id: '1', name: 'Animals' },
  { id: '2', name: 'Buildings & Architecture' },
  { id: '3', name: 'Business' },
  { id: '4', name: 'Drinks' },
  { id: '5', name: 'Environment' },
  { id: '6', name: 'States of Mind' },
  { id: '7', name: 'Food' },
  { id: '8', name: 'Graphic Resources' },
  { id: '9', name: 'Hobbies & Leisure' },
  { id: '10', name: 'Industry' },
  { id: '11', name: 'Landscapes' },
  { id: '12', name: 'Lifestyle' },
  { id: '13', name: 'People' },
  { id: '14', name: 'Plants & Flowers' },
  { id: '15', name: 'Culture & Religion' },
  { id: '16', name: 'Science' },
  { id: '17', name: 'Social Issues' },
  { id: '18', name: 'Sports' },
  { id: '19', name: 'Technology' },
  { id: '20', name: 'Transport' },
  { id: '21', name: 'Travel' },
];

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  delimiter: string;
  columns: string[];
  hasDescription: boolean;
  defaultTitleLength: number;
  minTitleLength: number;
  maxTitleLength: number;
  defaultKeywordsCount: number;
  minKeywordsCount: number;
  maxKeywordsCount: number;
  quoteAllFields?: boolean;
  categories: PlatformCategory[];
}

// Checked against the official contributor help pages in November 2026 (re-check now and then):
// - Adobe Stock CSV: Filename, Title (max 70 characters, no commas), Keywords (max 50, ordered by importance).
//   Adobe also says the first 10 keywords matter most. We keep 49 as the keyword cap (the upload form limit).
// - Shutterstock CSV: Filename, Description, Keywords, Categories (1 required, 2nd optional). The description
//   is the title (a factual sentence, max 2048 characters). Keywords 7 to 50.
// - Freepik (Magnific) CSV: File name; Title; Keywords, separated by semicolons, keywords by commas.
//   Title 35 to 100 characters recommended, keywords 5 to 50 (about 20 relevant ones are enough).
export const PLATFORM_SPECS: Record<PlatformId, PlatformConfig> = {
  'adobe-stock': {
    id: 'adobe-stock',
    name: 'Adobe Stock',
    delimiter: ',',
    columns: ['Filename', 'Title', 'Keywords'],
    hasDescription: false,
    defaultTitleLength: 70,
    minTitleLength: 30,
    maxTitleLength: 70, // Adobe Stock CSV title limit is 70 characters
    defaultKeywordsCount: 45,
    minKeywordsCount: 10,
    maxKeywordsCount: 49, // Adobe Stock strict limit is 49
    categories: DEFAULT_PLATFORM_CATEGORIES,
  },
  'general': {
    id: 'general',
    name: 'General',
    delimiter: ',',
    columns: ['Filename', 'Title', 'Description', 'Keywords'],
    hasDescription: true,
    defaultTitleLength: 100,
    minTitleLength: 30,
    maxTitleLength: 200,
    defaultKeywordsCount: 45,
    minKeywordsCount: 10,
    maxKeywordsCount: 50,
    categories: DEFAULT_PLATFORM_CATEGORIES,
  },
  'shutterstock': {
    id: 'shutterstock',
    name: 'Shutterstock',
    delimiter: ',',
    // exact names from Shutterstock's CSV help page; the title goes in Description
    columns: ['Filename', 'Description', 'Keywords', 'Categories'],
    hasDescription: false,
    defaultTitleLength: 100,
    minTitleLength: 30,
    maxTitleLength: 200,
    defaultKeywordsCount: 45,
    minKeywordsCount: 10,
    maxKeywordsCount: 50,
    categories: DEFAULT_PLATFORM_CATEGORIES,
  },
  'freepik': {
    id: 'freepik',
    name: 'FreePik',
    delimiter: ';',
    columns: ['File name', 'Title', 'Keywords'],
    hasDescription: false,
    defaultTitleLength: 100,
    minTitleLength: 30,
    maxTitleLength: 100, // Freepik max 100 chars
    defaultKeywordsCount: 45,
    minKeywordsCount: 10,
    maxKeywordsCount: 50,
    quoteAllFields: true,
    categories: DEFAULT_PLATFORM_CATEGORIES,
  },
};

export const PLATFORMS: Record<string, PlatformConfig> = {
  ...PLATFORM_SPECS,
  adobe: PLATFORM_SPECS['adobe-stock'],
  generic: PLATFORM_SPECS['general'],
};
