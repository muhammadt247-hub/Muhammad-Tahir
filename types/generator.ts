export interface GeneratorItem {
  id: string;
  filename: string;
  previewUrl: string;
  status: 'queued' | 'working' | 'done' | 'failed';
  error?: string;
  title: string;
  description: string;
  keywords: string[];
  category: string;
  prompt?: string;
  model?: string;
  isAi: boolean;
  retryCount?: number;
}

export interface GeneratorSettings {
  platforms: ('adobe' | 'shutterstock' | 'freepik' | 'generic')[];
  titleLength: number;
  descriptionLength: number;
  keywordCount: number;
  language: string;
  tone: string;
  isAi: boolean;
  customInstructions: string;
  mustInclude: string;
  neverUse: string;
  titlePrefix: string;
  titleSuffix: string;
  category: string;
}

export interface PromptDeconstruction {
  detailedPrompt: string;
  shortPrompt: string;
  negativePrompt: string;
  styleKeywords: string[];
  lighting: string;
  composition: string;
  colorPalette: string[];
  cameraOrLens: string;
  suggestedAspectRatio: string;
  midjourneyFlags: string;
}
