/**
 * Splits a markdown doc into overlapping chunks by paragraph, so each chunk
 * stays small enough to embed well and retrieve precisely, while overlap
 * keeps context from being cut off mid-idea at chunk boundaries.
 */
export interface Chunk {
  id: string;
  source: string;
  text: string;
}

export function chunkMarkdown(
  source: string,
  text: string,
  maxChars = 800,
  overlapChars = 150
): Chunk[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim().length > 0) {
      chunks.push({
        id: `${source}#${chunks.length}`,
        source,
        text: current.trim(),
      });
    }
  };

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= maxChars) {
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }

    pushCurrent();
    // Start the next chunk with a bit of overlap from the end of the last one.
    const overlap = current.slice(-overlapChars);
    current = overlap ? `${overlap}\n\n${para}` : para;
  }
  pushCurrent();

  return chunks;
}
