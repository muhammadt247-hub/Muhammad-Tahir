export interface Asset {
  id: string;
  title: string;
  creator_name: string;
  creator_id: string;
  category: string;
  content_type: 'Photo/Image' | 'Vector' | 'Illustration' | 'Video' | '3D' | 'Template' | 'Audio' | string;
  is_generative_ai: boolean;
  thumbnail_url: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  creation_date: string; // ISO date or parseable string
  nb_downloads?: number;
  keywords: string[];
  details_url: string;
}

export type SearchMode = 'keyword' | 'file' | 'contributor';

export type SortOption = 'nb_downloads' | 'relevance' | 'creation' | 'featured' | 'undiscovered';

export type ContentTypeFilter =
  | 'all'
  | 'photo'
  | 'illustration'
  | 'vector'
  | 'video'
  | '3d'
  | 'template'
  | 'audio';

export type AiFilter = 'all' | 'non_ai' | 'ai_only';

export interface SearchParams {
  mode: SearchMode;
  query: string;
  sort?: SortOption;
  contentType?: ContentTypeFilter;
  ai?: AiFilter;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  assets: Asset[];
  total: number;
  totalAI?: number;
  totalNonAI?: number;
  page: number;
  pageSize: number;
  isDemo?: boolean;
  fileIdSuggestion?: string;
}
