import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chunkMarkdown } from "../lib/chunk";
import { embed } from "../lib/embeddings";
import { saveIndex, type IndexedChunk } from "../lib/store";

const DOCS_DIR = "docs";

async function main() {
  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} doc(s) in ${DOCS_DIR}/`);

  const chunks = files.flatMap((file) => {
    const text = readFileSync(join(DOCS_DIR, file), "utf-8");
    return chunkMarkdown(file, text);
  });
  console.log(`Split into ${chunks.length} chunks.`);

  // Embed in one batch call — cheaper and faster than one request per chunk.
  console.log("Embedding chunks with Voyage AI...");
  const embeddings = await embed(
    chunks.map((c) => c.text),
    "document"
  );

  const indexed: IndexedChunk[] = chunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i],
  }));

  saveIndex(indexed);
  console.log(`Saved index with ${indexed.length} chunks to data/index.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
