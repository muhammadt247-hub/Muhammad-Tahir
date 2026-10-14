import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { AI_CONFIG } from '@/config/ai';
import { postProcessMetadata, postProcessPrompt } from '@/lib/generator/post-process';

// Input Validation Schema
const GenerateRequestSchema = z.object({
  mode: z.enum(['metadata', 'prompt']),
  images: z.array(z.string().min(10)).min(1).max(10), // Array of base64 data URIs
  platform: z.enum(['general', 'adobe-stock', 'shutterstock', 'freepik']).default('adobe-stock'),
  titleMaxLength: z.number().min(20).max(300).default(100),
  descriptionLength: z.number().min(30).max(500).default(150),
  keywordsMaxCount: z.number().min(5).max(50).default(50),
  hasAlphaChannel: z.array(z.boolean()).optional(),
  titlePrefix: z.string().optional(),
  isPrefixEnabled: z.boolean().optional(),
  titleSuffix: z.string().optional(),
  isSuffixEnabled: z.boolean().optional(),
  negativeTitleWords: z.string().optional(),
  isNegativeTitleWordsEnabled: z.boolean().optional(),
  negativeKeywords: z.string().optional(),
  isNegativeKeywordsEnabled: z.boolean().optional(),
  additionalKeywords: z.array(z.string()).optional(),
  isAdditionalKeywordsEnabled: z.boolean().optional(),

  // Prompt mode fields
  promptMaxLength: z.number().min(50).max(2000).default(500),
  negativePromptWords: z.string().optional(),
  isNegativePromptWordsEnabled: z.boolean().optional(),
  whiteBackground: z.boolean().optional(),
  cameraParams: z.boolean().optional(),
  promptPrefix: z.string().optional(),
  isPromptPrefixEnabled: z.boolean().optional(),
  promptSuffix: z.string().optional(),
  isPromptSuffixEnabled: z.boolean().optional(),

  // Custom model & user API key
  model: z.string().optional(),
  apiKey: z.string().optional(),
});

// Response Schemas for Gemini Type
const MetadataResponseSchema = {
  type: Type.OBJECT,
  properties: {
    metadataSets: {
      type: Type.ARRAY,
      description: 'Ordered list of metadata sets matching the input images',
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Natural readable stock image title without cutting mid-word',
          },
          description: {
            type: Type.STRING,
            description: 'One factual descriptive sentence (for platforms requiring description)',
          },
          keywords: {
            type: Type.ARRAY,
            description: 'Keywords ordered by relevance, single words and short phrases, no duplicates',
            items: { type: Type.STRING },
          },
        },
        required: ['title', 'keywords'],
      },
    },
  },
  required: ['metadataSets'],
};

const PromptResponseSchema = {
  type: Type.OBJECT,
  properties: {
    prompts: {
      type: Type.ARRAY,
      description: 'Ordered list of text-to-image prompts matching input images',
      items: {
        type: Type.OBJECT,
        properties: {
          prompt: {
            type: Type.STRING,
            description: 'Detailed text-to-image prompt describing subject, lighting, composition, colors, mood',
          },
        },
        required: ['prompt'],
      },
    },
  },
  required: ['prompts'],
};

// Zod schemas for parsing Gemini output
const ZodMetadataOutput = z.object({
  metadataSets: z.array(
    z.object({
      title: z.string().default(''),
      description: z.string().optional().default(''),
      keywords: z.array(z.string()).default([]),
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

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = GenerateRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid request body', details: parsed.error.format() } },
        { status: 400 }
      );
    }

    const {
      mode,
      images,
      platform,
      titleMaxLength,
      descriptionLength,
      keywordsMaxCount,
      hasAlphaChannel = [],
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
    } = parsed.data;

    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: { code: 'MISSING_API_KEY', message: 'No Gemini API key provided or configured.' } },
        { status: 401 }
      );
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

    if (mode === 'metadata') {
      const isFreepik = platform === 'freepik';
      const maxTitle = isFreepik ? Math.min(100, titleMaxLength) : titleMaxLength;

      systemInstruction = `You are an expert commercial microstock metadata generator for Adobe Stock, Shutterstock, and Freepik contributors.
CRITICAL RULES:
1. Describe ONLY what is directly visible in the image. Be concrete, commercial, and factual.
2. Title: A natural, readable sentence under ${maxTitle} characters. Do NOT cut mid-word. Never start with "A photo of" or "An image of".
3. Keywords: Order by relevance (most important first). Use single words and short 2-3 word conceptual phrases. Generate up to ${keywordsMaxCount} keywords.
4. FORBIDDEN: NEVER include brand names, trademarks, company names, camera gear, software names, real people names, or the word "stock".
5. NEVER use these banned title words: "${negativeTitleWords || ''}".
6. NEVER use these banned keywords: "${negativeKeywords || ''}".
7. Description: A concise, single factual sentence around ${descriptionLength} characters describing the subject and commercial context.
8. Output exactly one metadata set for each provided image in the exact same order.`;

      userPromptText = `Generate commercial microstock metadata sets for the ${images.length} provided image(s). Ensure titles are under ${maxTitle} chars and keywords are ordered by relevance.`;
      responseSchema = MetadataResponseSchema;
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

    // Call Gemini with retry on invalid JSON
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [...imageParts, { text: userPromptText }],
          },
          config: {
            systemInstruction,
            temperature: 0.3,
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

        const textOutput = response.text?.trim() || '{}';
        const parsedJson = JSON.parse(textOutput);

        if (mode === 'metadata') {
          const validated = ZodMetadataOutput.parse(parsedJson);

          // Post-process each item to guarantee client-side limits & rules
          const processedSets = validated.metadataSets.map((item, idx) => {
            return postProcessMetadata(item, {
              titleMaxLength: platform === 'freepik' ? Math.min(100, titleMaxLength) : titleMaxLength,
              keywordsMaxCount,
              hasAlphaChannel: hasAlphaChannel[idx] || false,
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

          return NextResponse.json({ metadataSets: processedSets });
        } else {
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

          return NextResponse.json({ prompts: processedPrompts });
        }
      } catch (err: unknown) {
        lastError = err;
        console.warn(`Gemini generation attempt ${attempt} failed:`, err);
        if (attempt === 1) {
          // Wait briefly before retry
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    // If both attempts failed, format error
    const errMessage = lastError instanceof Error ? lastError.message : 'Gemini generation failed';
    const isRateLimit = errMessage.includes('429') || errMessage.toLowerCase().includes('quota') || errMessage.toLowerCase().includes('resource_exhausted');
    const isAuthError = errMessage.includes('400') || errMessage.includes('403') || errMessage.toLowerCase().includes('api key');

    return NextResponse.json(
      {
        error: {
          code: isRateLimit ? 'RATE_LIMITED' : isAuthError ? 'INVALID_API_KEY' : 'GENERATION_FAILED',
          message: errMessage,
        },
      },
      { status: isRateLimit ? 429 : isAuthError ? 401 : 500 }
    );
  } catch (err: unknown) {
    console.error('Fatal API error in /api/generate:', err);
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
