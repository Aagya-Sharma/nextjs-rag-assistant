"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
  provider?: string;
  isError?: boolean;
}

const SUGGESTIONS = [
  "How do dynamic route segments work?",
  "How do I stop a fetch request from being cached?",
  "What's the difference between Server and Client Components?",
  "How do I show a loading state while a page fetches data?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    if (!question.trim() || loading) return;

    setInput("");
    // Add the assistant placeholder (and therefore the shimmer) right away.
    // The server does retrieval — an embedding call, which can take a while,
    // especially on Voyage's free tier with rate-limit retries — before it
    // even opens the response stream, so waiting for fetch() to resolve
    // before showing anything left the user staring at silence.
    setMessages((m) => [...m, { role: "user", text: question }, { role: "assistant", text: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok || !res.body) {
        // A failure from the provider (e.g. an invalid key or rate limit) can
        // abort the stream before any bytes go out, so the body here is
        // sometimes empty even though the request genuinely failed.
        const errorText = (await res.text()) || `Request failed (HTTP ${res.status}).`;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", text: errorText, isError: true };
          return copy;
        });
        return;
      }

      const sourcesHeader = res.headers.get("X-Sources");
      const sources: string[] = sourcesHeader ? JSON.parse(sourcesHeader) : [];
      const provider = res.headers.get("X-Provider") ?? undefined;

      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], sources, provider };
        return copy;
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const snapshot = full;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { ...copy[copy.length - 1], text: snapshot };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          text: err instanceof Error ? err.message : String(err),
          isError: true,
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  const isStreamingEmpty = (i: number) =>
    loading && i === messages.length - 1 && messages[i].role === "assistant" && !messages[i].text;

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">
          <span className="titleDot" />
          Next.js Docs Assistant
        </h1>
        <p className="subtitle">
          A small RAG demo. Answers are grounded only in the doc pages in <code>docs/</code>,
          with sources cited below each reply.
        </p>
      </header>

      <div className="thread" ref={threadRef}>
        {messages.length === 0 && (
          <div className="empty">
            <p className="emptyText">Try asking:</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestionChip" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`row ${m.role === "user" ? "rowUser" : "rowAssistant"}`}>
            <span className="label">{m.role === "user" ? "You" : "Assistant"}</span>
            <div
              className={`bubble ${
                m.isError ? "bubbleError" : m.role === "user" ? "bubbleUser" : "bubbleAssistant"
              }`}
            >
              {isStreamingEmpty(i) ? (
                <div className="shimmer">
                  <div className="shimmerLine" />
                  <div className="shimmerLine" />
                  <div className="shimmerLine" />
                </div>
              ) : m.role === "assistant" && !m.isError ? (
                <div className="markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                </div>
              ) : (
                m.text
              )}
            </div>
            {m.sources && m.sources.length > 0 && (
              <div className="meta">
                Sources: {m.sources.join(", ")}
                {m.provider ? <span className="metaProvider"> · via {m.provider}</span> : null}
              </div>
            )}
          </div>
        ))}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the App Router..."
          disabled={loading}
        />
        <button className="sendButton" type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
