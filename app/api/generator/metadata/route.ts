import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Type } from '@google/genai';
import { getGeminiClient } from '@/lib/gemini';
import { AI_CONFIG, isFallbackEligibleError } from '@/config/ai';

const MetadataRequestSchema = z.object({
  filename: z.string(),
  imageBase64: z.string().optional(),
  titleLength: z.number().default(80),
  keywordCount: z.number().default(30),
  language: z.string().default('English'),
  tone: z.string().default('Commercial & Objective'),
  isAi: z.boolean().default(false),
  customInstructions: z.string().default(''),
  mustInclude: z.string().default(''),
  neverUse: z.string().default(''),
  titlePrefix: z.string().default(''),
  titleSuffix: z.string().default(''),
  category: z.string().default(''),
});

const MetadataResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  category: z.string().default(''),
  prompt: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = MetadataRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: parsed.error.issues.map((i) => i.message).join(', '),
          },
        },
        { status: 400 }
      );
    }

    const {
      filename,
      imageBase64,
      titleLength,
      keywordCount,
      language,
      tone,
      isAi,
      customInstructions,
      mustInclude,
      neverUse,
      titlePrefix,
      titleSuffix,
      category,
    } = parsed.data;

    const ai = getGeminiClient();
    const modelName = process.env.GEMINI_MODEL || AI_CONFIG.DEFAULT_MODEL;

    const parts: unknown[] = [];

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64,
        },
      });
    }

    const promptText = `Generate commercial microstock metadata for this asset:
Filename: ${filename}
Target Title Length: approx ${titleLength} characters (min 40, max ${titleLength + 20})
Target Keyword Count: exactly ${keywordCount} tags (ordered by highest relevance)
Language: ${language}
Tone: ${tone}
Content is AI Generated: ${isAi}
${titlePrefix ? `Required Title Prefix: "${titlePrefix}"` : ''}
${titleSuffix ? `Required Title Suffix: "${titleSuffix}"` : ''}
${mustInclude ? `Must Include Keywords: ${mustInclude}` : ''}
${neverUse ? `Never Use Words: ${neverUse}` : ''}
${category ? `Preferred Category: ${category}` : ''}
${customInstructions ? `Custom User Instructions: ${customInstructions}` : ''}

Generate structured JSON matching the schema.`;

    parts.push({ text: promptText });

    const systemInstruction = `You are a world-class microstock metadata specialist creating top-ranking metadata for Adobe Stock, Shutterstock, and Freepik.
STRICT GUIDELINES:
1. Describe visible subject matter, context, mood, and concept accurately.
2. NEVER include trademarks, registered brand names (e.g. Apple, Nike, BMW), or real people's names.
3. NEVER include the word "stock", "photo", "image", "picture", or camera hardware/gear terms (e.g. Canon, Nikon, Sony).
4. Title must be a natural, readable sentence or descriptive phrase (capitalize first letter only or standard title case). Do NOT spam commas in the title.
5. Keywords must be ordered by relevance from most critical to secondary. Include both broad concepts and specific details.
6. Absolutely NO duplicate keywords. No duplicate singular and plural forms of the same word (prefer the most natural form).
7. If content is AI generated, provide a brief 'prompt' and generative 'model' (e.g. 'Midjourney v6.1' or 'FLUX.1').
8. Return strictly valid JSON matching the schema.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Commercial title for stock agency, natural readable sentence.',
        },
        description: {
          type: Type.STRING,
          description: 'Detailed 1-2 sentence description.',
        },
        keywords: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: `Array of exactly ${keywordCount} distinct keywords ordered by relevance.`,
        },
        category: {
          type: Type.STRING,
          description: 'Stock category name or ID.',
        },
        prompt: {
          type: Type.STRING,
          description: 'Generative prompt used to create this image (if AI generated).',
        },
        model: {
          type: Type.STRING,
          description: 'Generative AI model used (if AI generated).',
        },
      },
      required: ['title', 'description', 'keywords'],
    };

    const baseModel = modelName;
    const modelsToTry = [baseModel, ...AI_CONFIG.MODEL_FALLBACKS.filter((m) => m !== baseModel)];

    let lastError: unknown;
    let success = false;

    for (const curModel of modelsToTry) {
      let modelSuccess = false;
      let attempt = 0;
      while (attempt < 2) {
        try {
          const response = await ai.models.generateContent({
            model: curModel,
            contents: { parts: parts as any },
            config: {
              systemInstruction,
              temperature: 0.3,
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const rawJson = response.text?.trim() || '';
          const parsedJson = JSON.parse(rawJson);

          // Deduplicate and clean keywords
          if (Array.isArray(parsedJson.keywords)) {
            const uniqueKeywords = Array.from(
              new Set(
                parsedJson.keywords
                  .map((k: string) => k.toLowerCase().trim())
                  .filter(Boolean)
              )
            );
            parsedJson.keywords = uniqueKeywords;
          }

          // Apply prefixes/suffixes if requested
          if (titlePrefix && !parsedJson.title.startsWith(titlePrefix)) {
            parsedJson.title = `${titlePrefix} ${parsedJson.title}`.trim();
          }
          if (titleSuffix && !parsedJson.title.endsWith(titleSuffix)) {
            parsedJson.title = `${parsedJson.title} ${titleSuffix}`.trim();
          }

          const validated = MetadataResponseSchema.parse(parsedJson);
          return NextResponse.json(validated);
        } catch (callErr: unknown) {
          lastError = callErr;
          attempt++;
          if (!isFallbackEligibleError(callErr)) {
            break;
          }
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      }
      if (lastError && !isFallbackEligibleError(lastError)) {
        break;
      }
    }

    throw lastError || new Error('Failed to generate metadata after retries');
  } catch (err: unknown) {
    console.error('[Metadata Generation Error]:', err);
    const message = err instanceof Error ? err.message : 'Metadata generation failed';
    return NextResponse.json(
      {
        error: {
          code: 'METADATA_GENERATION_FAILED',
          message,
        },
      },
      { status: 500 }
    );
  }
}
