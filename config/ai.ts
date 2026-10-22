export const AI_CONFIG = {
  DEFAULT_MODEL: 'gemini-3.8-flash',
  MODEL_FALLBACKS: [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
  ],
  AVAILABLE_MODELS: [
    { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Default)', description: 'Fast multimodal model, optimal for stock metadata' },
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', description: 'Advanced multimodal model' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', description: 'Reliable flash model' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', description: 'Ultra-low latency lightweight model' },
  ],
};

export function isFallbackEligibleError(err: unknown): boolean {
  if (!err) return false;
  const errAny = err as any;
  const status = Number(errAny.status || errAny.statusCode || errAny.code || errAny.response?.status);
  
  if ([400, 401, 403].includes(status)) {
    return false;
  }

  if ([404, 429, 503].includes(status)) {
    return true;
  }

  const message = String(errAny.message || '').toLowerCase();
  
  if (
    message.includes('400') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('blocked') ||
    message.includes('safety') ||
    message.includes('invalid argument') ||
    message.includes('invalid_argument')
  ) {
    return false;
  }

  if (
    message.includes('404') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('not found') ||
    message.includes('service unavailable') ||
    message.includes('rate limit') ||
    message.includes('model not found') ||
    message.includes('no longer available')
  ) {
    return true;
  }

  return false;
}

