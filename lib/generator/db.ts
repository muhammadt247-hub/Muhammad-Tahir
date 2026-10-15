// IndexedDB helper for DOCTORx Generator client-side storage
import { SimilarityStrictness } from '@/config/similarity';
import { LibraryFingerprintEntry } from '@/types/similarity';
import type { GeneratorItemState } from './queue';

export type { LibraryFingerprintEntry };

export interface StoredApiKey {
  id: string;
  key: string; // e.g. "AIzaSy..."
  label: string;
  isActive: boolean;
  restingUntil?: number; // timestamp in ms when cooldown ends
  dailyQuotaExhaustedUntil?: number; // timestamp in ms when daily quota resets
  isInvalid?: boolean;
  addedAt: number;
  consecutiveErrors?: number;
  lastUsedAt?: number;
}

export interface GeneratorSavedSettings {
  mode: 'metadata' | 'prompt';
  batchMode: boolean; // false = single (1 image/req), true = batch (5 images/req)
  interImageDelaySeconds: number; // Configurable wait time between sequential images (default: 10)
  platform: 'general' | 'adobe-stock' | 'shutterstock' | 'freepik';
  titleLength: number;
  keywordsCount: number;
  isPrefixEnabled: boolean;
  titlePrefix: string;
  isSuffixEnabled: boolean;
  titleSuffix: string;
  isNegativeTitleWordsEnabled: boolean;
  negativeTitleWords: string;
  isNegativeKeywordsEnabled: boolean;
  negativeKeywords: string;
  isAdditionalKeywordsEnabled: boolean;
  additionalKeywords: string[];
  autoCsvDownload: boolean;
  autoEmbed: boolean;
  // Prompt mode
  promptLength: number;
  isPromptPrefixEnabled: boolean;
  promptPrefix: string;
  isPromptSuffixEnabled: boolean;
  promptSuffix: string;
  isNegativePromptWordsEnabled: boolean;
  negativePromptWords: string;
  whiteBackground: boolean;
  cameraParams: boolean;
  // Model
  selectedModel: string;
  modelFallback: boolean;
  // Compliance Guard
  complianceGuard: boolean;
  titleUniqueness: 'strict' | 'normal' | 'relaxed';
  contributorLanguage: string;
  isAiBatch: boolean;
  customBlockedWords: string[];
  // Step 8 Deep Similarity Guard
  similarityStrictness: SimilarityStrictness;
  deepAiCheck: boolean;
  rememberExportedImages: boolean;
  skipAiGenerationForExcluded: boolean;
  showSimilarityScores: boolean;
  // Backwards compat
  detectDuplicates?: boolean;
}

export const DEFAULT_GENERATOR_SETTINGS: GeneratorSavedSettings = {
  mode: 'metadata',
  batchMode: false,
  interImageDelaySeconds: 10,
  platform: 'adobe-stock',
  titleLength: 100,
  keywordsCount: 45,
  isPrefixEnabled: false,
  titlePrefix: '',
  isSuffixEnabled: false,
  titleSuffix: '',
  isNegativeTitleWordsEnabled: false,
  negativeTitleWords: '',
  isNegativeKeywordsEnabled: false,
  negativeKeywords: '',
  isAdditionalKeywordsEnabled: false,
  additionalKeywords: [],
  autoCsvDownload: false,
  autoEmbed: false,
  promptLength: 500,
  isPromptPrefixEnabled: false,
  promptPrefix: '',
  isPromptSuffixEnabled: false,
  promptSuffix: '',
  isNegativePromptWordsEnabled: false,
  negativePromptWords: '',
  whiteBackground: false,
  cameraParams: false,
  selectedModel: 'gemini-3.8-flash',
  modelFallback: true,
  complianceGuard: true,
  titleUniqueness: 'normal',
  contributorLanguage: 'en',
  isAiBatch: false,
  customBlockedWords: [],
  // Step 8 Similarity Guard Defaults
  similarityStrictness: 'strict',
  deepAiCheck: true,
  rememberExportedImages: true,
  skipAiGenerationForExcluded: true,
  showSimilarityScores: false,
  detectDuplicates: true,
};

const DB_NAME = 'doctorxDB';
const DB_VERSION = 3; // Incremented for batchItemsStore
const API_KEYS_STORE = 'apiKeysStore';
const SETTINGS_STORE = 'settingsStore';
const LIBRARY_STORE = 'libraryStore';
const BATCH_ITEMS_STORE = 'batchItemsStore';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('IndexedDB not supported in SSR'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(API_KEYS_STORE)) {
        db.createObjectStore(API_KEYS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
        db.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BATCH_ITEMS_STORE)) {
        db.createObjectStore(BATCH_ITEMS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// API Keys Operations
export async function getStoredApiKeys(): Promise<StoredApiKey[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(API_KEYS_STORE, 'readonly');
      const store = tx.objectStore(API_KEYS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error getting API keys from IndexedDB:', err);
    return [];
  }
}

export async function saveStoredApiKey(apiKey: StoredApiKey): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(API_KEYS_STORE, 'readwrite');
    const store = tx.objectStore(API_KEYS_STORE);
    const req = store.put(apiKey);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStoredApiKey(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(API_KEYS_STORE, 'readwrite');
    const store = tx.objectStore(API_KEYS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Settings Operations
export async function getSavedGeneratorSettings(): Promise<GeneratorSavedSettings> {
  if (typeof window === 'undefined') return DEFAULT_GENERATOR_SETTINGS;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.get('current');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve({ ...DEFAULT_GENERATOR_SETTINGS, ...req.result.value });
        } else {
          resolve(DEFAULT_GENERATOR_SETTINGS);
        }
      };
      req.onerror = () => resolve(DEFAULT_GENERATOR_SETTINGS);
    });
  } catch (err) {
    console.error('Failed to get generator settings:', err);
    return DEFAULT_GENERATOR_SETTINGS;
  }
}

export async function saveGeneratorSettings(settings: GeneratorSavedSettings): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.put({ key: 'current', value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save generator settings:', err);
  }
}

export async function getCustomBlockedWords(): Promise<string[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.get('customBlockedWords');
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.value)) {
          resolve(req.result.value);
        } else {
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveCustomBlockedWords(words: string[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SETTINGS_STORE, 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.put({ key: 'customBlockedWords', value: words });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save custom blocked words:', err);
  }
}

// Library Fingerprints Operations (Exported Images History)
export async function getLibraryEntries(): Promise<LibraryFingerprintEntry[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, 'readonly');
      const store = tx.objectStore(LIBRARY_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error fetching library entries:', err);
    return [];
  }
}

export async function saveLibraryEntries(entries: LibraryFingerprintEntry[]): Promise<void> {
  if (typeof window === 'undefined' || entries.length === 0) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, 'readwrite');
      const store = tx.objectStore(LIBRARY_STORE);
      for (const entry of entries) {
        store.put(entry);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Error saving library entries:', err);
  }
}

export async function deleteLibraryEntry(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, 'readwrite');
      const store = tx.objectStore(LIBRARY_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error deleting library entry:', err);
  }
}

export async function clearLibraryStore(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LIBRARY_STORE, 'readwrite');
      const store = tx.objectStore(LIBRARY_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error clearing library store:', err);
  }
}

// Batch Items Persistence (Saved items & resume without duplication)
export async function getSavedBatchItems(): Promise<GeneratorItemState[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(BATCH_ITEMS_STORE, 'readonly');
      const store = tx.objectStore(BATCH_ITEMS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const results: GeneratorItemState[] = req.result || [];
        for (const item of results) {
          if (item.fileData?.file && (!item.fileData.previewUrl || !item.fileData.previewUrl.startsWith('blob:') && !item.fileData.previewUrl.startsWith('data:'))) {
            try {
              item.fileData.previewUrl = URL.createObjectURL(item.fileData.file);
            } catch {}
          }
        }
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Error fetching batch items from IndexedDB:', err);
    return [];
  }
}

export async function saveBatchItem(item: GeneratorItemState): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BATCH_ITEMS_STORE, 'readwrite');
      const store = tx.objectStore(BATCH_ITEMS_STORE);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save batch item to IndexedDB:', err);
  }
}

export async function saveAllBatchItems(items: GeneratorItemState[]): Promise<void> {
  if (typeof window === 'undefined' || items.length === 0) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BATCH_ITEMS_STORE, 'readwrite');
      const store = tx.objectStore(BATCH_ITEMS_STORE);
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save all batch items to IndexedDB:', err);
  }
}

export async function deleteSavedBatchItem(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BATCH_ITEMS_STORE, 'readwrite');
      const store = tx.objectStore(BATCH_ITEMS_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to delete batch item from IndexedDB:', err);
  }
}

export async function clearSavedBatchItems(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BATCH_ITEMS_STORE, 'readwrite');
      const store = tx.objectStore(BATCH_ITEMS_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to clear batch items from IndexedDB:', err);
  }
}
