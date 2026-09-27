import "dotenv/config";
import { VoyageAIClient } from "voyageai";

// Voyage AI is Anthropic's recommended embeddings partner (no embeddings
// endpoint ships in the Claude API itself). Free tier covers this project,
// but without a card on file it's capped at 3 requests/minute and 10K
// tokens/minute (see https://docs.voyageai.com/docs/rate-limits). We stay
// under both by batching by size and pacing requests, so `npm run ingest`
// works even on a brand-new free account.
const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! });

const MAX_BATCH_CHARS = 24_000; // ~6K tokens at ~4 chars/token, safely under the 10K TPM cap
const MIN_MS_BETWEEN_REQUESTS = 21_000; // a little over 20s, safely under the 3 RPM cap

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function batchBySize(texts: string[], maxChars: number): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const text of texts) {
    if (current.length > 0 && currentChars + text.length > maxChars) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(text);
    currentChars += text.length;
  }
  if (current.length > 0) batches.push(current);

  return batches;
}

async function embedBatch(
  batch: string[],
  inputType: "document" | "query",
  retries = 2
): Promise<number[][]> {
  try {
    const res = await client.embed({ input: batch, model: "voyage-3-lite", inputType });
    return (res.data ?? []).map((d) => d.embedding as number[]);
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 429 && retries > 0) {
      // Free-tier rate limit hit despite pacing (e.g. a request from just
      // before this run is still inside the window) — back off and retry.
      await sleep(MIN_MS_BETWEEN_REQUESTS * 2);
      return embedBatch(batch, inputType, retries - 1);
    }
    throw err;
  }
}

export async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  if (!process.env.VOYAGE_API_KEY) {
    throw new Error(
      "Missing VOYAGE_API_KEY. Copy .env.example to .env and fill in your keys."
    );
  }

  const batches = batchBySize(texts, MAX_BATCH_CHARS);
  const results: number[][] = [];

  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      console.log(
        `  ...waiting ~${MIN_MS_BETWEEN_REQUESTS / 1000}s between batches to stay under Voyage's free-tier rate limit (batch ${i + 1}/${batches.length})`
      );
      await sleep(MIN_MS_BETWEEN_REQUESTS);
    }
    results.push(...(await embedBatch(batches[i], inputType)));
  }

  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
