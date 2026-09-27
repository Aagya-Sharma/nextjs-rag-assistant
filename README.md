# Next.js Docs RAG Chatbot

A small Retrieval-Augmented Generation (RAG) project: a command-line chatbot
that answers questions about the Next.js App Router, grounded only in a set
of local markdown doc pages.

Built to learn, and to demonstrate on a CV, the core pieces of a real RAG
system: chunking, embeddings, vector search, and grounded generation with an
LLM judge-style eval.

## How it works

1. **`docs/*.md`** — a handful of Next.js App Router doc pages (routing,
   Server/Client Components, data fetching, Server Actions, rendering).
2. **`npm run ingest`** — splits each doc into overlapping chunks
   ([lib/chunk.ts](lib/chunk.ts)), embeds every chunk with Voyage AI
   ([lib/embeddings.ts](lib/embeddings.ts)), and saves the result to
   `data/index.json` — a minimal flat-file vector store
   ([lib/store.ts](lib/store.ts)).
3. **`npm run chat`** — embeds your question, finds the most similar chunks
   by cosine similarity, and sends them to Claude as context so it can only
   answer from what's actually in the docs (and say so when it can't).
4. **`npm run eval`** — runs a small fixed set of questions through the same
   pipeline and checks the answers contain expected keywords, a first,
   simple version of an eval suite.
5. **`npm run dev`** — a small Next.js chat UI at `http://localhost:3000`,
   backed by an API route ([app/api/chat/route.ts](app/api/chat/route.ts))
   that does the same retrieval step and then **streams** Claude's answer
   back to the browser token by token, with sources shown under each reply.

## Setup

```bash
npm install
cp .env.example .env   # then fill in your keys (see below)
npm run ingest           # builds data/index.json from docs/ (required first)
npm run chat              # option A: ask questions in the terminal
npm run dev                # option B: ask questions in a browser chat UI
npm run eval                # run the keyword-based eval suite
```

- Voyage AI API key (free tier, used for embeddings regardless of chat
  provider): https://dash.voyageai.com/

### Chat provider: Claude or Gemini

`CHAT_PROVIDER` in `.env` picks which model answers questions —
[lib/llm.ts](lib/llm.ts) is the one place that switches between them, used
by the CLI, the web UI and the eval script alike.

- `CHAT_PROVIDER=anthropic` (default) — uses Claude. Needs
  `ANTHROPIC_API_KEY` from https://console.anthropic.com/settings/keys, and
  billing/credits set up on that account. This is the version worth using
  for anything you'd show off (a CV line, an interview, a deployed demo).
- `CHAT_PROVIDER=gemini` — uses Gemini's free tier, for testing the RAG
  pipeline at zero cost. Needs `GEMINI_API_KEY`, a free key from
  https://aistudio.google.com/apikey. Rate-limited, but plenty for
  `npm run ingest` + a handful of test questions.

## Next steps (good follow-ups for interviews)

- **Swap the flat-file store for pgvector in PostgreSQL** — a natural
  upgrade given a Prisma/PostgreSQL background, and how a production RAG
  system would actually store vectors.
- **Add more docs** — drop more `.md` files into `docs/` and re-run
  `npm run ingest`. Try Prisma or React docs to build a second demo.
- **Add tool use / agent behaviour** — give the model a second tool (e.g. a
  "search the web" or "look up a GitHub issue" function) so it can decide
  between answering from the docs and calling a tool.
- **Replace the keyword eval with an LLM judge** — ask a second Claude call
  to rate each answer's accuracy and citation quality on a 1-5 scale.
- **Deploy the web UI** — push to Vercel (it's already a standard Next.js
  app) so you have a live link to share in applications and interviews.
  Remember to set `ANTHROPIC_API_KEY` and `VOYAGE_API_KEY` as environment
  variables in the Vercel project, not in a committed file.

## Project structure

```
docs/          Source markdown docs the bot answers from
lib/
  chunk.ts     Splits markdown into overlapping chunks
  embeddings.ts  Calls Voyage AI, plus cosine similarity
  store.ts     Flat-file vector store (save/load/search)
scripts/
  ingest.ts    Builds data/index.json from docs/
  chat.ts      Interactive CLI chat loop
  eval.ts      Small keyword-based eval suite
app/
  page.tsx           Browser chat UI (streams tokens as they arrive)
  api/chat/route.ts   API route: retrieval + streaming Claude response
  layout.tsx          Root layout / page metadata
```
