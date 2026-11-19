import { buildSystemPrompt } from "@/lib/prompt";
import { LlmError, type LlmProvider, type ToolCall } from "@/lib/llm/types";

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "save_lead",
      description: "Store the visitor name and phone or email.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_slots",
      description: "List real free appointment slots. Never invent times.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "book_appointment",
      description: "Book a startsAt value returned by list_slots after the visitor confirms it.",
      parameters: {
        type: "object",
        properties: {
          startsAt: { type: "string" },
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          service: { type: "string" },
        },
        required: ["startsAt"],
        additionalProperties: false,
      },
    },
  },
];

type OpenAiMessage = Record<string, unknown>;

export const openaiProvider: LlmProvider = {
  id: "openai",
  async complete({ context, messages, execute }) {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) throw new LlmError("Missing API key.");
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const convo: OpenAiMessage[] = [
      { role: "system", content: buildSystemPrompt(context) },
      ...messages.map((message) => ({ role: message.role, content: message.content })),
    ];

    for (let step = 0; step < 3; step += 1) {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: convo,
          tools: TOOLS,
        }),
      });
      if (!response.ok) {
        throw new LlmError(`The model returned ${response.status}.`);
      }
      const payload = (await response.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
      };
      const message = payload.choices?.[0]?.message;
      if (!message) throw new LlmError("The model returned an empty reply.");
      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        return { text: (message.content ?? "").trim() || fallback(context.locale) };
      }
      convo.push(message as OpenAiMessage);
      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(call.function.arguments || "{}") as unknown;
          if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
        } catch {
          args = {};
        }
        const toolCall: ToolCall = { name: call.function.name, arguments: args };
        const result = await execute(toolCall);
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 4000),
        });
      }
    }
    return { text: fallback(context.locale) };
  },
};

function fallback(locale: "ro" | "en") {
  return locale === "en"
    ? "I saved your message. How else can I help?"
    : "Am notat mesajul. Cu ce vă mai pot ajuta?";
}

export function llmMode() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { id: "mock" as const, model: "" };
  return { id: "openai" as const, model: process.env.OPENAI_MODEL || "gpt-4o-mini" };
}
