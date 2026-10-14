import { SearchParams, SearchResult } from '@/types/asset';

export interface StockProvider {
  search(params: SearchParams): Promise<SearchResult>;
}
