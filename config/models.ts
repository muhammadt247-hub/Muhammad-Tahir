
export interface GroqModelConfig {
  id: string;
  name: string;
  description?: string;
}

// Backward-compatible type alias
export type GrokModelConfig = GroqModelConfig;

// Officially supported Groq models suitable for this application
export const GROQ_MODELS: GroqModelConfig[] = [
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B Vision',
    description:
      'Multimodal vision model for image analysis, stock metadata, descriptions, keywords and reverse-engineering prompts.',
  },
];

export const DEFAULT_GROQ_MODEL = 'qwen/qwen3.8-27b';

// Backward-compatible aliases
export const GROK_MODELS = GROQ_MODELS;
export const DEFAULT_GROK_MODEL = DEFAULT_GROQ_MODEL;
