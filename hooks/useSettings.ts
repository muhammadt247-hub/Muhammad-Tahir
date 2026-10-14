'use client';

import { useLocalStorage } from './useLocalStorage';
import { SortOption, ContentTypeFilter, AiFilter } from '@/types/asset';

export interface UserSettings {
  displayName: string;
  defaultSort: SortOption;
  defaultContentType: ContentTypeFilter;
  defaultAiFilter: AiFilter;
  defaultGeneratorPlatform: 'adobe' | 'shutterstock' | 'freepik' | 'generic';
}

const DEFAULT_SETTINGS: UserSettings = {
  displayName: 'Microstock Creator',
  defaultSort: 'nb_downloads',
  defaultContentType: 'all',
  defaultAiFilter: 'all',
  defaultGeneratorPlatform: 'adobe',
};

export function useSettings() {
  const [settings, setSettings] = useLocalStorage<UserSettings>('settings', DEFAULT_SETTINGS);

  const updateSettings = (partial: Partial<UserSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  return {
    settings: settings || DEFAULT_SETTINGS,
    updateSettings,
  };
}
