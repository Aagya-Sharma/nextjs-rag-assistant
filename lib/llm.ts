import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * A small provider switch so this project can run against either Claude
 * (the "real" version, for the CV/demo) or Gemini's free tier (for testing
 * the pipeline at zero cost). Controlled by CHAT_PROVIDER in .env.
 */
export type ChatProvider = "anthropic" | "gemini";

export function getProvider(): ChatProvider {
  const raw = (process.env.CHAT_PROVIDER || "anthropic").toLowerCase();
  return raw === "gemini" ? "gemini" : "anthropic";
}

export interface StreamHandlers {
  onText: (delta: string) => void;
  onEnd: () => void;
  onError: (err: unknown) => void;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

/**
 * Streams an answer from the configured provider. Guards against a
 * provider emitting both an error and an end/completion signal for the
 * same request, which would otherwise throw when handlers are called twice.
 */
export function streamAnswer(
  systemPrompt: string,
  question: string,
  handlers: StreamHandlers
): { abort: () => void } {
  let settled = false;
  const onText = (delta: string) => {
    if (!settled) handlers.onText(delta);
  };
  const onEnd = () => {
    if (settled) return;
    settled = true;
    handlers.onEnd();
  };
  const onError = (err: unknown) => {
    if (settled) return;
    settled = true;
    handlers.onError(err);
  };

  if (getProvider() === "gemini") {
    if (!gemini) {
      onError(
        new Error(
          "Missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/apikey and add it to .env."
        )
      );
      return { abort: () => {} };
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const model = gemini.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });

    let aborted = false;
    (async () => {
      try {
        const result = await model.generateContentStream(question);
        for await (const chunk of result.stream) {
          if (aborted) return;
          const text = chunk.text();
          if (text) onText(text);
        }
        onEnd();
      } catch (err) {
        onError(err);
      }
    })();

    return {
      abort: () => {
        aborted = true;
      },
    };
  }

  const anthropicStream = anthropic.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: "user", content: question }],
  });

  anthropicStream.on("text", onText);
  anthropicStream.on("end", onEnd);
  anthropicStream.on("error", onError);

  return { abort: () => anthropicStream.abort() };
}

/** Convenience wrapper for callers that just want the full text, not a stream. */
export function answerOnce(systemPrompt: string, question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let full = "";
    streamAnswer(systemPrompt, question, {
      onText: (delta) => {
        full += delta;
      },
      onEnd: () => resolve(full),
      onError: (err) => reject(err),
    });
  });
}
