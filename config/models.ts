export interface GrokModelConfig {
  id: string;
  name: string;
  description?: string;
}

export const GROK_MODELS: GrokModelConfig[] = [
  {
    id: 'grok-2-vision-1212',
    name: 'Grok 2 Vision (grok-2-vision-1212)',
    description: 'Vision-capable Grok model for commercial stock metadata and prompt reverse-engineering',
  },
];

export const DEFAULT_GROK_MODEL = 'grok-2-vision-1212';
