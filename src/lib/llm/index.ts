import { llmMode } from "@/lib/llm/openai";
import { mockProvider } from "@/lib/llm/mock";
import { openaiProvider } from "@/lib/llm/openai";
import type { LlmProvider } from "@/lib/llm/types";

export function getLlm(): LlmProvider {
  return llmMode().id === "openai" ? openaiProvider : mockProvider;
}

export { llmMode };
