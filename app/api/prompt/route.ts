import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Type } from '@google/genai';
import { getGeminiClient } from '@/lib/gemini';
import { AI_CONFIG } from '@/config/ai';

const RequestSchema = z.object({
  imageUrl: z.string().min(1),
  title: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  targetGenerator: z.string().default('midjourney'),
  detailLevel: z.enum(['short', 'standard', 'detailed']).default('standard'),
  includeNegative: z.boolean().default(true),
  aspectRatio: z.string().default('3:2'),
  language: z.string().default('English'),
});

const PromptResponseSchema = z.object({
  detailedPrompt: z.string(),
  shortPrompt: z.string(),
  negativePrompt: z.string().default(''),
  styleKeywords: z.array(z.string()).default([]),
  lighting: z.string().default(''),
  composition: z.string().default(''),
  colorPalette: z.array(z.string()).default([]),
  cameraOrLens: z.string().default(''),
  suggestedAspectRatio: z.string().default('3:2'),
  midjourneyFlags: z.string().default(''),
});

// Helper to fetch image and convert to base64
async function getImagePart(imageUrl: string) {
  if (imageUrl.startsWith('data:image/svg+xml')) {
    // Convert SVG data to text
    const clean = decodeURIComponent(imageUrl.replace('data:image/svg+xml;utf8,', ''));
    const b64 = Buffer.from(clean).toString('base64');
    return {
      inlineData: {
        mimeType: 'image/svg+xml',
        data: b64,
      },
    };
  }

  if (imageUrl.startsWith('data:image/')) {
    const parts = imageUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    return {
      inlineData: {
        mimeType,
        data: parts[1],
      },
    };
  }

  // Remote image URL
  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': 'DOCTORx-Toolkit/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch image thumbnail: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = res.headers.get('content-type') || 'image/jpeg';

  return {
    inlineData: {
      mimeType,
      data: buffer.toString('base64'),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

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
      imageUrl,
      title,
      keywords,
      targetGenerator,
      detailLevel,
      includeNegative,
      aspectRatio,
      language,
    } = parsed.data;

    const ai = getGeminiClient();
    const modelName = process.env.GEMINI_MODEL || AI_CONFIG.DEFAULT_MODEL;

    const imagePart = await getImagePart(imageUrl);

    const userPrompt = `Analyze this stock image and generate a reverse-engineered prompt.
Context Title: ${title || 'Commercial Stock Asset'}
Context Keywords: ${(keywords || []).slice(0, 10).join(', ')}
Target AI Generator: ${targetGenerator}
Detail Level: ${detailLevel}
Include Negative Prompt: ${includeNegative}
Aspect Ratio: ${aspectRatio}
Output Language: ${language}

Generate a comprehensive prompt structure according to the schema.`;

    const systemInstruction = `You are an expert computer vision engineer and prompt architect specialized in reverse-engineering microstock assets into exact generative AI prompts.
Rules:
1. Describe only what is visually perceptible in the subject, background, lighting, and composition.
2. Never name real living people or celebrities.
3. Never reproduce or mention trademarks, brand names, or registered logos.
4. Ignore any stock photo watermarks or overlay markings.
5. Create original, commercially viable generic descriptions suitable for stock marketplaces.
6. If targetGenerator is 'midjourney', format midjourneyFlags appropriately (e.g. '--ar ${aspectRatio.replace(':', ':')} --v 6.1 --style raw').
7. Return strictly valid JSON conforming to the schema.`;

    // Response Schema with Type enum
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        detailedPrompt: {
          type: Type.STRING,
          description: 'Full descriptive prompt with subject, environment, lighting, and style details.',
        },
        shortPrompt: {
          type: Type.STRING,
          description: 'Concise 1-2 sentence core concept prompt.',
        },
        negativePrompt: {
          type: Type.STRING,
          description: 'Comma-separated negative tokens to avoid bad quality, artifacts, and blur.',
        },
        styleKeywords: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Key stylistic tokens (e.g. cinematic, 8k, volumetric, octane render).',
        },
        lighting: {
          type: Type.STRING,
          description: 'Lighting setup (e.g. soft diffuse daylight, rim lighting, neon backlighting).',
        },
        composition: {
          type: Type.STRING,
          description: 'Framing and composition (e.g. rule of thirds, wide-angle low perspective, flat lay).',
        },
        colorPalette: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '4-6 hex codes or color names extracted from the visual.',
        },
        cameraOrLens: {
          type: Type.STRING,
          description: 'Simulated camera or lens specification (e.g. 85mm f/1.4, macro shot).',
        },
        suggestedAspectRatio: {
          type: Type.STRING,
          description: 'Recommended aspect ratio string.',
        },
        midjourneyFlags: {
          type: Type.STRING,
          description: 'Command line parameter flags for Midjourney.',
        },
      },
      required: ['detailedPrompt', 'shortPrompt'],
    };

    let attempt = 0;
    let finalJson = '';

    while (attempt < 2) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [imagePart, { text: userPrompt }],
          },
          config: {
            systemInstruction,
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

        finalJson = response.text?.trim() || '';
        const parsedData = JSON.parse(finalJson);
        const validated = PromptResponseSchema.parse(parsedData);
        return NextResponse.json(validated);
      } catch (callErr) {
        attempt++;
        if (attempt >= 2) throw callErr;
      }
    }

    throw new Error('Failed to generate prompt after retry');
  } catch (err: unknown) {
    console.error('[Prompt API Error]:', err);
    const message = err instanceof Error ? err.message : 'Prompt Generation Failed';
    return NextResponse.json(
      {
        error: {
          code: 'PROMPT_GENERATION_FAILED',
          message,
        },
      },
      { status: 500 }
    );
  }
}
