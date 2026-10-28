import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { AI_CONFIG, isFallbackEligibleError } from '@/config/ai';
import { postProcessMetadata, postProcessPrompt } from '@/lib/generator/post-process';
import { requireUser } from '@/lib/supabase/server';
import { CREDIT_COSTS, MAX_IMAGES_PER_REQUEST } from '@/config/credits';
import { spendCredits, refundCredits, getBalance, InsufficientCreditsError } from '@/lib/credits';

import { DEFAULT_GROK_MODEL } from '@/config/models';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err: any = new Error('Model took too long to respond');
      err.status = 503;
      reject(err);
    }, ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

const GenerateRequestSchema = z.object({
  provider: z.enum(['gemini', 'grok']).optional().default('gemini'),
  mode: z.enum(['metadata', 'prompt', 'retitle']).default('metadata'),
  images: z.array(z.string()).min(1),
  platform: z.enum(['general', 'adobe-stock', 'shutterstock', 'freepik']).default('adobe-stock'),
  titleMaxLength: z.number().default(100),
  descriptionLength: z.number().default(150),
  keywordsMaxCount: z.number().default(45),
  hasAlphaChannel: z.array(z.boolean()).optional().default([]),
  keywordStyle: z.enum(['mixed', 'single', 'double']).optional().default('mixed'),
  backgroundMode: z.enum(['auto', 'white', 'transparent']).optional().default('auto'),
  titlePrefix: z.string().optional().default(''),
  isPrefixEnabled: z.boolean().optional().default(false),
  titleSuffix: z.string().optional().default(''),
  isSuffixEnabled: z.boolean().optional().default(false),
  negativeTitleWords: z.string().optional().default(''),
  isNegativeTitleWordsEnabled: z.boolean().optional().default(false),
  negativeKeywords: z.string().optional().default(''),
  isNegativeKeywordsEnabled: z.boolean().optional().default(false),
  additionalKeywords: z.array(z.string()).optional().default([]),
  isAdditionalKeywordsEnabled: z.boolean().optional().default(false),
  promptMaxLength: z.number().default(500),
  negativePromptWords: z.string().optional().default(''),
  isNegativePromptWordsEnabled: z.boolean().optional().default(false),
  whiteBackground: z.boolean().optional().default(false),
  cameraParams: z.boolean().optional().default(false),
  promptPrefix: z.string().optional().default(''),
  isPromptPrefixEnabled: z.boolean().optional().default(false),
  promptSuffix: z.string().optional().default(''),
  isPromptSuffixEnabled: z.boolean().optional().default(false),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  // Compliance & Quality extensions
  existingTitles: z.array(z.string()).optional().default([]),
  avoidTitles: z.array(z.string()).optional().default([]),
  currentTitle: z.string().optional(),
  reason: z.string().optional(),
  uniqueness: z.enum(['strict', 'normal', 'relaxed']).optional().default('normal'),
  contributorLanguage: z.string().optional().default('en'),
  isAiBatch: z.boolean().optional().default(false),
  customBlockedWords: z.array(z.string()).optional().default([]),
});

const MetadataResponseSchema = {
  type: 'object',
  properties: {
    metadataSets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Commercial microstock title, factual natural sentence under requested length.',
          },
          description: {
            type: 'string',
            description: 'Concise factual commercial description around requested length.',
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Up to 45 commercial keywords ordered strictly by importance and relevance.',
          },
          flags: {
            type: 'object',
            properties: {
              identifiablePerson: { type: 'boolean', description: 'True if visible recognizable person or face is shown.' },
              privateProperty: { type: 'boolean', description: 'True if visible private property, recognizable house, or modern architecture.' },
              visibleLogoOrBrand: { type: 'boolean', description: 'True if recognizable trademark or corporate brand is visible.' },
              visibleText: { type: 'boolean', description: 'True if visible readable text or typography appears.' },
              visibleTextOrLogo: { type: 'boolean', description: 'True if visible trademark, text, watermark, or brand appears.' },
              possibleEditorial: { type: 'boolean', description: 'True if public event, protest, landmark, or news event.' },
              showsAiConcept: { type: 'boolean', description: 'True ONLY if image subject is literally a robot, cyborg, neural network, or AI concept.' },
            },
            required: ['identifiablePerson', 'privateProperty', 'visibleLogoOrBrand', 'visibleText', 'possibleEditorial', 'showsAiConcept'],
          },
          flagReasons: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific short reason for any positive flag (e.g. "Text visible on sign").',
          },
        },
        required: ['title', 'description', 'keywords', 'flags'],
      },
    },
  },
  required: ['metadataSets'],
};

const PromptResponseSchema = {
  type: 'object',
  properties: {
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Atmospheric generative prompt describing subject, style, perspective, lighting, and composition.',
          },
        },
        required: ['prompt'],
      },
    },
  },
  required: ['prompts'],
};

const ZodMetadataOutput = z.object({
  metadataSets: z.array(
    z.object({
      title: z.string().default(''),
      description: z.string().default(''),
      keywords: z.array(z.string()).default([]),
      flags: z
        .object({
          identifiablePerson: z.boolean().default(false),
          privateProperty: z.boolean().default(false),
          visibleLogoOrBrand: z.boolean().default(false),
          visibleText: z.boolean().default(false),
          visibleTextOrLogo: z.boolean().default(false),
          possibleEditorial: z.boolean().default(false),
          showsAiConcept: z.boolean().default(false),
        })
        .optional()
        .default({
          identifiablePerson: false,
          privateProperty: false,
          visibleLogoOrBrand: false,
          visibleText: false,
          visibleTextOrLogo: false,
          possibleEditorial: false,
          showsAiConcept: false,
        }),
      flagReasons: z.array(z.string()).optional().default([]),
    })
  ),
});

const ZodPromptOutput = z.object({
  prompts: z.array(
    z.object({
      prompt: z.string().default(''),
    })
  ),
});

function parseDataUri(dataUri: string): { mimeType: string; data: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/jpeg', data: dataUri };
}

function buildGeminiErrorResponse(lastError: unknown): NextResponse {
  const errMessage = lastError instanceof Error ? lastError.message : String(lastError || 'Gemini generation failed');
  const lowerMessage = errMessage.toLowerCase();

  const isRateLimit =
    errMessage.includes('429') ||
    lowerMessage.includes('quota') ||
    lowerMessage.includes('resource_exhausted') ||
    lowerMessage.includes('too many requests') ||
    lowerMessage.includes('perday') ||
    lowerMessage.includes('daily');

  const isDailyQuota =
    isRateLimit &&
    (errMessage.includes('PerDay') ||
      lowerMessage.includes('daily') ||
      lowerMessage.includes('day_quota') ||
      lowerMessage.includes('per day'));

  const isAuthError =
    errMessage.includes('400') ||
    errMessage.includes('401') ||
    errMessage.includes('403') ||
    lowerMessage.includes('api_key_invalid') ||
    lowerMessage.includes('api key not valid') ||
    lowerMessage.includes('unauthenticated') ||
    lowerMessage.includes('permission_denied') ||
    (lowerMessage.includes('api key') && !isRateLimit);

  // Extract retry wait duration in seconds if Gemini provided one
  const retryMatch = errMessage.match(/(?:retry in|retry after|wait)\s*([0-9.]+)\s*s/i);
  const retryAfterSeconds = retryMatch ? parseFloat(retryMatch[1]) : isRateLimit ? 30 : undefined;

  const headers: Record<string, string> = {};
  if (retryAfterSeconds) {
    headers['Retry-After'] = String(Math.ceil(retryAfterSeconds));
  }

  return NextResponse.json(
    {
      error: {
        code: isDailyQuota
          ? 'DAILY_QUOTA_EXHAUSTED'
          : isRateLimit
          ? 'RATE_LIMITED'
          : isAuthError
          ? 'INVALID_API_KEY'
          : 'GENERATION_FAILED',
        message: errMessage,
        retryAfterSeconds,
        quotaType: isDailyQuota ? 'day' : isRateLimit ? 'minute' : undefined,
      },
    },
    {
      status: isRateLimit ? 429 : isAuthError ? 401 : 500,
      headers,
    }
  );
}

export async function POST(req: NextRequest) {
  let user: { id: string } | null = null;
  const requestId = crypto.randomUUID();
  let creditsToCharge = 0;
  let creditsRemaining = 0;
  let hasRefunded = false;

  const refundHelper = async (count: number, reason: string) => {
    if (creditsToCharge <= 0 || hasRefunded || count <= 0 || !user) return;
    hasRefunded = true;
    const refundAmount = count * CREDIT_COSTS.generatePerImage;
    try {
      creditsRemaining = await refundCredits(user.id, refundAmount, reason, requestId);
    } catch (refErr) {
      console.error('Failed to refund credits:', refErr);
    }
  };

  try {
    // 1. Login check
    user = await requireUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Please log in.' } },
        { status: 401 }
      );
    }

    // 2. Zod validation
    const rawBody = await req.json();
    const parsed = GenerateRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid request body', details: parsed.error.format() } },
        { status: 400 }
      );
    }

    const {
      provider = 'gemini',
      mode,
      images,
      platform,
      titleMaxLength,
      descriptionLength,
      keywordsMaxCount,
      hasAlphaChannel = [],
      keywordStyle,
      backgroundMode,
      titlePrefix,
      isPrefixEnabled,
      titleSuffix,
      isSuffixEnabled,
      negativeTitleWords,
      isNegativeTitleWordsEnabled,
      negativeKeywords,
      isNegativeKeywordsEnabled,
      additionalKeywords,
      isAdditionalKeywordsEnabled,
      promptMaxLength,
      negativePromptWords,
      isNegativePromptWordsEnabled,
      whiteBackground,
      cameraParams,
      promptPrefix,
      isPromptPrefixEnabled,
      promptSuffix,
      isPromptSuffixEnabled,
      model: requestedModel,
      apiKey: userApiKey,
      avoidTitles = [],
      currentTitle,
    } = parsed.data;

    // 4a. Count images on server from validated request body (reject < 1 or > MAX_IMAGES_PER_REQUEST)
    const imageCount = images.length;
    if (imageCount < 1 || imageCount > MAX_IMAGES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_IMAGE_COUNT',
            message: `Images count must be between 1 and ${MAX_IMAGES_PER_REQUEST}. Received ${imageCount}.`,
          },
        },
        { status: 400 }
      );
    }

    // 4b. If no server key exists and request has no user key, return 503 BEFORE charging
    const trimmedUserApiKey = userApiKey?.trim();
    const serverApiKey = provider === 'grok' ? process.env.XAI_API_KEY?.trim() : process.env.GEMINI_API_KEY?.trim();
    const apiKey = trimmedUserApiKey || serverApiKey;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: {
            code: 'not_configured',
            message: provider === 'grok'
              ? 'Grok API key is not configured. Please add your Grok API key in the API Keys dialog.'
              : 'The Gemini service is not configured.',
          },
        },
        { status: 503 }
      );
    }

    // 4c. Always charge BEFORE calling Gemini: spendCredits(user.id, imageCount * CREDIT_COSTS.generatePerImage, "generate", requestId)
    // This applies whether the server key or the user's own key is used.
    creditsToCharge = imageCount * CREDIT_COSTS.generatePerImage;

    try {
      creditsRemaining = await spendCredits(user.id, creditsToCharge, 'generate', requestId);
    } catch (err: unknown) {
      // 4d. Return HTTP 402 on insufficient credits and do not call Gemini
      if (
        err instanceof InsufficientCreditsError ||
        (err as { code?: string })?.code === 'insufficient_credits' ||
        (err as { message?: string })?.message?.includes('insufficient_credits')
      ) {
        const insErr = err as Partial<InsufficientCreditsError>;
        const balance =
          typeof insErr?.balance === 'number' ? insErr.balance : await getBalance(user.id);
        const needed = typeof insErr?.needed === 'number' ? insErr.needed : creditsToCharge;
        return NextResponse.json(
          {
            error: {
              code: 'insufficient_credits',
              message: 'You do not have enough credits.',
              balance,
              needed,
            },
          },
          { status: 402 }
        );
      }
      throw err;
    }

    const modelName = requestedModel || process.env.GEMINI_MODEL || AI_CONFIG.DEFAULT_MODEL;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Construct image parts
    const imageParts = images.map((uri) => {
      const { mimeType, data } = parseDataUri(uri);
      return {
        inlineData: {
          mimeType,
          data,
        },
      };
    });

    let systemInstruction = '';
    let userPromptText = '';
    let responseSchema: typeof MetadataResponseSchema | typeof PromptResponseSchema;

    if (mode === 'metadata' || mode === 'retitle') {
      const isFreepik = platform === 'freepik';
      const maxTitle = isFreepik ? Math.min(100, titleMaxLength) : titleMaxLength;

      systemInstruction = `You are an expert commercial microstock metadata generator for Adobe Stock, Shutterstock, and Freepik contributors.
CRITICAL RULES:
1. Describe ONLY what is directly visible in the image. Be concrete, commercial, and factual.
2. Title: one plain English sentence under ${maxTitle} characters that names the main subject first, then the count, style and background. Use only letters, numbers, spaces and hyphens. No commas, colons, symbols, quotes or emoji. Never repeat a word or a concept. Check spelling and grammar. For icon sheets, name each icon once in plain words. Do NOT cut mid-word. Never start with "A photo of" or "An image of".
3. Keywords: only words for things that are clearly visible or are the obvious subject. Do not add abstract or conceptual guesses (customer, service, support, feedback, social, media, connection, network) unless the image clearly shows them. Do not use near-duplicates: never use more than one word from the same family (smile/smiley/smiling, phone/smartphone/mobile, tech/technology, web/internet/online), and never use both singular and plural. Do not add generic filler to reach the count. It is fine to return fewer keywords than the maximum. Order by relevance (most important first). Use single words and short 2-3 word phrases. Generate up to ${keywordsMaxCount} keywords.
4. FORBIDDEN: NEVER include brand names, trademarks, company names, camera gear, software names, real people names, or the word "stock".
5. NEVER use these banned title words: "${negativeTitleWords || ''}".
6. NEVER use these banned keywords: "${negativeKeywords || ''}".
7. Description: A concise, single factual sentence around ${descriptionLength} characters describing the subject and commercial context.
8. Keyword Relevance for AI: Do NOT include "ai" or "artificial intelligence" in keywords unless the image clearly depicts a robot, cyborg, neural network, or AI concept. If not about AI, omit all AI keywords.
9. Visual Compliance Audit (flags):
   - identifiablePerson: true if recognizable face or person is present.
   - privateProperty: true if recognizable private building, property, or artwork.
   - visibleLogoOrBrand: true if recognizable company trademark or brand logo is visible.
   - visibleText: true if visible written words, letters, or numbers appear.
   - visibleTextOrLogo: true if any visible text, watermark, numbers, brand name, or logo is present.
   - possibleEditorial: true if news event, editorial landmark, or unreleased public gathering.
   - showsAiConcept: true ONLY if the subject is explicitly robots, cyborgs, or artificial intelligence concept.
   - flagReasons: short specific reason for any positive flag (e.g. "Text visible on sign", "Logo on clothing").
10. All text must be in English. No objectionable or offensive language.
11. Output exactly one metadata set for each provided image in the exact same order.`;

      const recentAvoid = avoidTitles.slice(-40);
      let avoidClause = '';
      if (recentAvoid.length > 0) {
        avoidClause = ` These titles already exist in this batch: ${recentAvoid.map((t) => `"${t}"`).join(', ')}. Write a title that is completely different. Do not reuse their first three words or their sentence pattern. Describe what is visibly different in THIS image (subject, count, shapes, colors, style).`;
      }

      if (mode === 'retitle') {
        userPromptText = `Generate commercial microstock metadata sets for the ${images.length} provided image(s). A title rewrite was specifically requested to address: "${parsed.data.reason || 'Better commercial distinctiveness'}". The previous title "${currentTitle || ''}" must NOT be reused. Ensure titles are under ${maxTitle} chars.${avoidClause}`;
      } else {
        userPromptText = `Generate commercial microstock metadata sets for the ${images.length} provided image(s). Ensure titles are under ${maxTitle} chars and keywords are ordered by relevance.${avoidClause}`;
      }
      responseSchema = MetadataResponseSchema;

      // Keyword style and background options chosen by the user
      if (keywordStyle === 'single') {
        userPromptText += ' Keywords must be SINGLE words only: exactly one word per keyword, no phrases.';
      } else if (keywordStyle === 'double') {
        userPromptText += ' Keywords must be TWO-WORD phrases only: exactly two words per keyword (for example "wooden table").';
      } else {
        userPromptText += ' Use a natural mix of single words and short two-word phrases for keywords.';
      }
      if (backgroundMode === 'white') {
        userPromptText += ' The image has a pure white background. Do not write the background in the title or keywords, it is added automatically.';
      } else if (backgroundMode === 'transparent') {
        userPromptText += ' The image has a transparent background. Do not write the background in the title or keywords, it is added automatically.';
      }
    } else {
      systemInstruction = `You are an expert visual prompt engineer reverse-engineering images into detailed generative prompts for Midjourney, FLUX, and SDXL.
CRITICAL RULES:
1. Write a rich, atmospheric text-to-image prompt around ${promptMaxLength} characters describing: subject, visual style, camera perspective, lighting, color harmony, atmosphere, and composition.
2. No introduction, no markdown backticks, no quotes, no conversational preamble.
3. FORBIDDEN: Do not use negative words: "${negativePromptWords || ''}".
4. Output exactly one prompt object for each provided image in the exact same order.`;

      userPromptText = `Reverse-engineer detailed text-to-image generation prompts for the ${images.length} provided image(s). Target length: approximately ${promptMaxLength} characters each.`;
      responseSchema = PromptResponseSchema;
    }

    // Execute generation with selected provider
    let lastError: unknown;
    let success = false;
    let parsedJson: any = null;

    if (provider === 'grok') {
      const grokModel = requestedModel || process.env.XAI_MODEL || DEFAULT_GROK_MODEL;
      const userContent: Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string; detail?: string } }
      > = [
        {
          type: 'text',
          text:
            userPromptText +
            (mode === 'metadata' || mode === 'retitle'
              ? '\n\nIMPORTANT: Return a JSON object with this exact structure: {"metadataSets": [{"title": "...", "description": "...", "keywords": ["..."], "flags": {"identifiablePerson": false, "privateProperty": false, "visibleLogoOrBrand": false, "visibleText": false, "visibleTextOrLogo": false, "possibleEditorial": false, "showsAiConcept": false}, "flagReasons": []}]}'
              : '\n\nIMPORTANT: Return a JSON object with this exact structure: {"prompts": [{"prompt": "..."}]}'),
        },
      ];

      for (const uri of images) {
        const fullUrl = uri.startsWith('data:') ? uri : `data:image/jpeg;base64,${uri}`;
        userContent.push({
          type: 'image_url',
          image_url: {
            url: fullUrl,
            detail: 'high',
          },
        });
      }

      try {
        const grokResponse = await withTimeout(
          fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: grokModel,
              messages: [
                {
                  role: 'system',
                  content: systemInstruction,
                },
                {
                  role: 'user',
                  content: userContent,
                },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.3,
            }),
          }),
          35000
        );

        if (!grokResponse.ok) {
          const errBody = await grokResponse.json().catch(() => ({}));
          const errMsg =
            errBody?.error?.message || errBody?.message || `xAI API returned status ${grokResponse.status}`;

          if (grokResponse.status === 429) {
            await refundHelper(imageCount, 'refund_failed_generation');
            const retryAfter = grokResponse.headers.get('Retry-After') || '30';
            return NextResponse.json(
              {
                error: {
                  code: 'RATE_LIMITED',
                  message: errMsg,
                  retryAfterSeconds: parseInt(retryAfter, 10) || 30,
                },
              },
              {
                status: 429,
                headers: { 'Retry-After': retryAfter },
              }
            );
          }

          if (grokResponse.status === 401 || grokResponse.status === 403) {
            await refundHelper(imageCount, 'refund_failed_generation');
            return NextResponse.json(
              {
                error: {
                  code: 'INVALID_API_KEY',
                  message: `xAI Grok authentication failed: ${errMsg}`,
                },
              },
              { status: 401 }
            );
          }

          await refundHelper(imageCount, 'refund_failed_generation');
          return NextResponse.json(
            {
              error: {
                code: 'GROK_ERROR',
                message: errMsg,
              },
            },
            { status: grokResponse.status >= 400 && grokResponse.status < 600 ? grokResponse.status : 500 }
          );
        }

        const grokData = await grokResponse.json();
        const rawContent = grokData?.choices?.[0]?.message?.content?.trim() || '{}';
        let cleanJson = rawContent;
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        }
        parsedJson = JSON.parse(cleanJson);
        success = true;
      } catch (err: unknown) {
        await refundHelper(imageCount, 'refund_failed_generation');
        const isTimeout =
          err instanceof Error && (err.message.includes('too long') || (err as any).status === 503);
        return NextResponse.json(
          {
            error: {
              code: isTimeout ? 'TIMEOUT' : 'GROK_ERROR',
              message: err instanceof Error ? err.message : 'Failed to call xAI Grok API',
            },
          },
          { status: 503 }
        );
      }
    } else {
      // Call Gemini with model fallbacks (404, 429, 503) and 2 attempts per model
      const baseModel = requestedModel || process.env.GEMINI_MODEL || AI_CONFIG.DEFAULT_MODEL;
      const modelsToTry = [baseModel, ...AI_CONFIG.MODEL_FALLBACKS.filter((m) => m !== baseModel)];

      // Time budget: the hosting gateway cuts requests that run too long (504), so we stop
      // waiting on slow models early and return a clean error the browser can retry.
      const startedAt = Date.now();
      const TOTAL_BUDGET_MS = 30000;
      const PER_ATTEMPT_MS = 20000;
      let useThinkingConfig = true;

      for (const curModel of modelsToTry) {
        let modelSuccess = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
          if (remaining < 3000) {
            if (!lastError) {
              const timeoutErr: any = new Error('Gemini is slow right now. Please retry.');
              timeoutErr.status = 503;
              lastError = timeoutErr;
            }
            break;
          }
          try {
            const response = await withTimeout(
              ai.models.generateContent({
                model: curModel,
                contents: {
                  parts: [...imageParts, { text: userPromptText }],
                },
                config: {
                  systemInstruction,
                  temperature: 0.3,
                  responseMimeType: 'application/json',
                  responseSchema,
                  ...(useThinkingConfig ? { thinkingConfig: { thinkingLevel: 'low' as any } } : {}),
                },
              }),
              Math.min(PER_ATTEMPT_MS, remaining)
            );

            const textOutput = response.text?.trim() || '{}';
            parsedJson = JSON.parse(textOutput);
            modelSuccess = true;
            success = true;
            break;
          } catch (err: unknown) {
            lastError = err;
            const errText = err instanceof Error ? err.message : String(err || '');
            // If this model does not accept the thinking setting, retry without it (never fail because of it)
            if (useThinkingConfig && errText.toLowerCase().includes('thinking')) {
              useThinkingConfig = false;
              attempt--;
              lastError = undefined;
              continue;
            }
            if (err && (err as any).status === 503 && String((err as any).message).includes('too long')) {
              console.warn(`Model ${curModel} timed out, trying next model`);
              break;
            }
            if (!isFallbackEligibleError(err)) {
              // Do NOT fall back on 400, 401, 403, blocked content, etc. Throw/stop immediately.
              break;
            }
            const errMsg = err instanceof Error ? err.message : String(err || '');
            if (attempt === 1 && (errMsg.includes('PerDay') || errMsg.toLowerCase().includes('daily'))) {
              break;
            }
            console.warn(`Model ${curModel} attempt ${attempt} failed with fallback-eligible error:`, err);
            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 600));
            }
          }
        }
        if (modelSuccess) break;
        if (lastError && !isFallbackEligibleError(lastError)) {
          break;
        }
        if (TOTAL_BUDGET_MS - (Date.now() - startedAt) < 3000) break;
      }

      if (!success) {
        // All models failed: refund all charged credits once
        await refundHelper(imageCount, 'refund_failed_generation');
        return buildGeminiErrorResponse(lastError);
      }
    }

    if (mode === 'metadata' || mode === 'retitle') {
      if (parsedJson && !Array.isArray(parsedJson.metadataSets)) {
        if (Array.isArray(parsedJson.metadata)) {
          parsedJson.metadataSets = parsedJson.metadata;
        } else if (parsedJson.title || parsedJson.keywords) {
          parsedJson = { metadataSets: [parsedJson] };
        }
      }
      const validated = ZodMetadataOutput.parse(parsedJson);
      // Post-process each item to guarantee client-side limits & rules
      const processedSets = validated.metadataSets.map((item, idx) => {
        return postProcessMetadata(item, {
          titleMaxLength: platform === 'freepik' ? Math.min(100, titleMaxLength) : titleMaxLength,
          keywordsMaxCount,
          hasAlphaChannel: hasAlphaChannel[idx] || false,
          keywordStyle,
          backgroundMode,
          isPrefixEnabled,
          titlePrefix,
          isSuffixEnabled,
          titleSuffix,
          isNegativeTitleWordsEnabled,
          negativeTitleWords,
          isNegativeKeywordsEnabled,
          negativeKeywords,
          isAdditionalKeywordsEnabled,
          additionalKeywords,
        });
      });

      // Check if any image failed or came back empty
      const successfulCount = processedSets.filter(
        (s) => s && typeof s.title === 'string' && s.title.trim().length > 0
      ).length;
      const failedCount = Math.max(0, imageCount - successfulCount);

      if (failedCount > 0) {
        await refundHelper(failedCount, 'refund_failed_images');
      }

      const actualSuccessCount = imageCount - failedCount;
      const creditsCharged = actualSuccessCount * CREDIT_COSTS.generatePerImage;

      return NextResponse.json({
        metadataSets: processedSets,
        creditsCharged,
        creditsRemaining,
      });
    } else {
      if (parsedJson && !Array.isArray(parsedJson.prompts)) {
        if (parsedJson.prompt) {
          parsedJson = { prompts: [parsedJson] };
        }
      }
      const validated = ZodPromptOutput.parse(parsedJson);
      // Post-process prompts
      const processedPrompts = validated.prompts.map((p) => {
        return {
          prompt: postProcessPrompt(p.prompt, {
            promptMaxLength,
            promptPrefix,
            isPromptPrefixEnabled,
            promptSuffix,
            isPromptSuffixEnabled,
            negativePromptWords,
            isNegativePromptWordsEnabled,
            whiteBackground,
            cameraParams,
          }),
        };
      });

      // Check if any prompt failed or came back empty
      const successfulCount = processedPrompts.filter(
        (p) => p && typeof p.prompt === 'string' && p.prompt.trim().length > 0
      ).length;
      const failedCount = Math.max(0, imageCount - successfulCount);

      if (failedCount > 0) {
        await refundHelper(failedCount, 'refund_failed_images');
      }

      const actualSuccessCount = imageCount - failedCount;
      const creditsCharged = actualSuccessCount * CREDIT_COSTS.generatePerImage;

      return NextResponse.json({
        prompts: processedPrompts,
        creditsCharged,
        creditsRemaining,
      });
    }

    return buildGeminiErrorResponse(lastError);
  } catch (err: unknown) {
    await refundHelper(creditsToCharge / CREDIT_COSTS.generatePerImage, 'refund_failed_generation');
    console.error('Fatal API error in /api/generate');
    return NextResponse.json(
      {
        error: {
          code: 'SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Internal Server Error',
        },
      },
      { status: 500 }
    );
  }
}