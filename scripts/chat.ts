import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { embed } from "../lib/embeddings";
import { loadIndex, search } from "../lib/store";
import { answerOnce, getProvider } from "../lib/llm";

async function answer(question: string): Promise<void> {
  const index = loadIndex();

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

  const text = await answerOnce(systemPrompt, question);

  console.log(`\n${text}\n`);
  console.log("Sources:", matches.map((m) => m.source).join(", "));
}

async function main() {
  const provider = getProvider();
  const hasKey =
    provider === "gemini" ? Boolean(process.env.GEMINI_API_KEY) : Boolean(process.env.ANTHROPIC_API_KEY);

  if (!hasKey) {
    console.error(
      `Missing API key for CHAT_PROVIDER="${provider}". Copy .env.example to .env and fill in your keys.`
    );
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`Next.js Docs RAG chat (provider: ${provider}). Ask a question, or type "exit" to quit.\n`);

  while (true) {
    const question = await rl.question("> ");
    if (question.trim().toLowerCase() === "exit") break;
    if (!question.trim()) continue;
    await answer(question);
  }

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
