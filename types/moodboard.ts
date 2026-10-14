import { Asset } from './asset';

export interface Moodboard {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assets: Asset[];
}

export interface MoodboardExportData {
  version: string;
  exportedAt: string;
  boards: Moodboard[];
}
