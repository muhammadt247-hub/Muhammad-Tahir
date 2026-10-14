import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { AI_CONFIG } from '@/config/ai';

const SimilarityRequestSchema = z.object({
  contactSheet: z.string().min(10), // Base64 data URI of contact sheet
  items: z.array(
    z.object({
      label: z.string(),
      id: z.string(),
      filename: z.string(),
      qualityScore: z.number().optional(),
    })
  ).min(2).max(8),
  model: z.string().optional(),
  apiKey: z.string().optional(),
});

const SimilarityGeminiSchema = {
  type: Type.OBJECT,
  properties: {
    clusters: {
      type: Type.ARRAY,
      description: 'Groups of images that are too similar to each other to both be submitted to Adobe Stock',
      items: {
        type: Type.OBJECT,
        properties: {
          itemLabels: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Labels (e.g. A, B) of the similar images in this group',
          },
          winnerLabel: {
            type: Type.STRING,
            description: 'The single best image label (e.g. A) to keep for commercial stock sales',
          },
          reason: {
            type: Type.STRING,
            description: 'Short, decisive commercial reason why the winner was chosen over the others',
          },
        },
        required: ['itemLabels', 'winnerLabel', 'reason'],
      },
    },
    globalReview: {
      type: Type.STRING,
      description: 'A 1-2 sentence assessment of similarity and commercial suitability',
    },
  },
  required: ['clusters', 'globalReview'],
};

const ZodSimilarityOutput = z.object({
  clusters: z.array(
    z.object({
      itemLabels: z.array(z.string()),
      winnerLabel: z.string(),
      reason: z.string(),
    })
  ),
  globalReview: z.string().default(''),
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
    const parsed = SimilarityRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid similarity request', details: parsed.error.format() } },
        { status: 400 }
      );
    }

    const { contactSheet, items, model: requestedModel, apiKey: userApiKey } = parsed.data;

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

    const { mimeType, data: base64Data } = parseDataUri(contactSheet);

    const itemsSummary = items
      .map((it) => `- Label "${it.label}": file "${it.filename}"`)
      .join('\n');

    const promptText = `You are a strict, veteran stock-photo reviewer for Adobe Stock.
These images are candidates for submission to the same stock portfolio.
Adobe Stock strictly rejects near-identical submissions as spam, and repeat submissions can lead to account suspension.

Candidate images provided on the contact sheet:
${itemsSummary}

YOUR MISSION:
1. Review all candidate images on the contact sheet labeled "A", "B", "C", etc.
2. Decide which images are too similar for Adobe Stock to accept more than one of them (same subject and scene with only minor changes in angle, zoom, crop, lighting, expression, or pose).
3. If two or more images are too similar to be submitted together, place them into a cluster.
4. From each cluster, pick the SINGLE highest-commercial-value image (best sharpness, focus, lighting, composition, and market appeal) as the winner to KEEP.
5. Provide a short, direct reason for each cluster's winner.
6. If images are genuinely distinct (different subjects, completely different compositions, or distinct concepts), do NOT group them.

Strictly adhere to the JSON schema output.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: SimilarityGeminiSchema,
        temperature: 0.2,
      },
    });

    const responseText = response.text || '{}';
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: { code: 'PARSE_ERROR', message: 'Failed to parse Gemini similarity response' } },
        { status: 500 }
      );
    }

    const outputParsed = ZodSimilarityOutput.safeParse(rawJson);
    if (!outputParsed.success) {
      return NextResponse.json(
        { error: { code: 'SCHEMA_MISMATCH', message: 'Invalid AI response format', details: outputParsed.error.format() } },
        { status: 500 }
      );
    }

    // Map labels back to item IDs
    const labelToItem = new Map(items.map((it) => [it.label, it]));
    const mappedClusters = outputParsed.data.clusters
      .map((c) => {
        const itemIds = c.itemLabels.map((lbl) => labelToItem.get(lbl)?.id).filter(Boolean) as string[];
        const winnerId = labelToItem.get(c.winnerLabel)?.id || itemIds[0];
        return {
          itemIds,
          winnerId,
          winnerLabel: c.winnerLabel,
          reason: c.reason,
        };
      })
      .filter((c) => c.itemIds.length >= 2);

    return NextResponse.json({
      clusters: mappedClusters,
      globalReview: outputParsed.data.globalReview,
    });
  } catch (err: unknown) {
    console.error('Error in /api/similarity:', err);
    const message = err instanceof Error ? err.message : 'Internal similarity analysis error';
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}
