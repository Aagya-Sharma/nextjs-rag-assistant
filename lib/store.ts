import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { cosineSimilarity } from "./embeddings";
import type { Chunk } from "./chunk";

// A minimal flat-file vector store: fine for a few hundred chunks and a demo
// project. A real deployment would swap this for pgvector in Postgres,
// which is a natural next step given the Prisma/PostgreSQL background this
// project is meant to complement.
export interface IndexedChunk extends Chunk {
  embedding: number[];
}

const INDEX_PATH = "data/index.json";

export function saveIndex(chunks: IndexedChunk[]): void {
  mkdirSync(dirname(INDEX_PATH), { recursive: true });
  writeFileSync(INDEX_PATH, JSON.stringify(chunks));
}

export function loadIndex(): IndexedChunk[] {
  if (!existsSync(INDEX_PATH)) {
    throw new Error(`No index found at ${INDEX_PATH}. Run "npm run ingest" first.`);
  }
  return JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
}

export function search(
  index: IndexedChunk[],
  queryEmbedding: number[],
  topK = 4
): IndexedChunk[] {
  return [...index]
    .sort(
      (a, b) =>
        cosineSimilarity(b.embedding, queryEmbedding) -
        cosineSimilarity(a.embedding, queryEmbedding)
    )
    .slice(0, topK);
}
