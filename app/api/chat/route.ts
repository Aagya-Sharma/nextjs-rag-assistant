import { embed } from "../../../lib/embeddings";
import { loadIndex, search } from "../../../lib/store";
import { streamAnswer, getProvider } from "../../../lib/llm";

// Force the Node.js runtime, not the Edge runtime: loadIndex() reads
// data/index.json from disk with node:fs, which the Edge runtime can't do.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const provider = getProvider();
  const missingKey =
    provider === "gemini" ? !process.env.GEMINI_API_KEY : !process.env.ANTHROPIC_API_KEY;

  if (missingKey || !process.env.VOYAGE_API_KEY) {
    return new Response(
      `Server is missing an API key for the "${provider}" provider (check ANTHROPIC_API_KEY / GEMINI_API_KEY) or VOYAGE_API_KEY. Add it to .env and restart.`,
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const question = body?.question;
  if (!question || typeof question !== "string") {
    return new Response("Request body must include a 'question' string.", { status: 400 });
  }

  let index;
  try {
    index = loadIndex();
  } catch {
    return new Response(
      'No index found. Run "npm run ingest" first to build data/index.json.',
      { status: 500 }
    );
  }

  // Retrieval happens up front, before we open the stream, so we know the
  // sources before the first token comes back and can send them as a header.
  const [queryEmbedding] = await embed([question], "query");
  const matches = search(index, queryEmbedding, 4);
  const context = matches
    .map((m, i) => `[${i + 1}] (${m.source})\n${m.text}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a documentation assistant for the Next.js App Router.
Answer the user's question using ONLY the context passages below. If the
context does not contain the answer, say so plainly rather than guessing.
Cite passages inline like [1], [2] where you use them.

Context:
${context}`;

  const encoder = new TextEncoder();
  let abort = () => {};
  const body_ = new ReadableStream<Uint8Array>({
    start(controller) {
      const stream = streamAnswer(systemPrompt, question, {
        onText: (delta) => controller.enqueue(encoder.encode(delta)),
        onEnd: () => controller.close(),
        onError: (err) => controller.error(err),
      });
      abort = stream.abort;
    },
    cancel() {
      abort();
    },
  });

  return new Response(body_, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Sources": JSON.stringify(matches.map((m) => m.source)),
      "X-Provider": provider,
    },
  });
}
