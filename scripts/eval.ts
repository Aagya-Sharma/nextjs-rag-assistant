import "dotenv/config";
import { embed } from "../lib/embeddings";
import { loadIndex, search } from "../lib/store";
import { answerOnce, getProvider } from "../lib/llm";

// A tiny eval: for each question, check that at least one of the expected
// keywords shows up in the model's answer. This is a starting point, not a
// rigorous eval — the natural next step is scoring with an LLM judge instead
// of keyword matching.
const CASES: { question: string; expectKeywords: string[] }[] = [
  {
    question: "How do I make a component interactive with useState?",
    expectKeywords: ["use client", "Client Component"],
  },
  {
    question: "How do dynamic route segments work?",
    expectKeywords: ["[slug]", "bracket"],
  },
  {
    question: "How do I stop a fetch request from being cached?",
    expectKeywords: ["no-store"],
  },
  {
    question: "How do Server Actions get marked as running on the server?",
    expectKeywords: ["use server"],
  },
  {
    question: "What does generateStaticParams do?",
    expectKeywords: ["pre-render", "build time"],
  },
];

async function askOnce(question: string): Promise<string> {
  const index = loadIndex();
  const [queryEmbedding] = await embed([question], "query");
  const matches = search(index, queryEmbedding, 4);
  const context = matches.map((m) => m.text).join("\n\n---\n\n");

  return answerOnce(`Answer using only this context:\n\n${context}`, question);
}

async function main() {
  console.log(`Running eval with provider: ${getProvider()}\n`);

  let passed = 0;
  for (const c of CASES) {
    const answerText = await askOnce(c.question);
    const hit = c.expectKeywords.some((kw) =>
      answerText.toLowerCase().includes(kw.toLowerCase())
    );
    console.log(`${hit ? "PASS" : "FAIL"} — ${c.question}`);
    if (!hit) console.log(`  answer: ${answerText.slice(0, 200)}...`);
    if (hit) passed++;
  }
  console.log(`\n${passed}/${CASES.length} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
