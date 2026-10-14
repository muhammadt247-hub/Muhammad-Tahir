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

// NOTE: Marketplace bulk CSV templates frequently evolve and should be verified periodically.
// For example, Shutterstock's official contributor CSV may alternate column naming between
// 'Description' and 'Title', and Freepik enforces a strict 100-character title limit and semicolon delimiter.
export const PLATFORM_SPECS: Record<PlatformId, PlatformConfig> = {
  'adobe-stock': {
    id: 'adobe-stock',
    name: 'Adobe Stock',
    delimiter: ',',
    columns: ['Filename', 'Title', 'Keywords'],
    hasDescription: false,
    defaultTitleLength: 100,
    minTitleLength: 30,
    maxTitleLength: 200,
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
