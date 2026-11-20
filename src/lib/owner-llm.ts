import "server-only";
import { buildOwnerSystemPrompt } from "@/lib/owner-prompt";
import { executeOwnerTool, OWNER_TOOL_DEFINITIONS, type OwnerToolResult } from "@/lib/owner-tools";
import type { AgentContext, ChatTurn } from "@/lib/llm/types";
import { llmMode } from "@/lib/llm";

export type OwnerLlmResult = {
  text: string;
  actions: OwnerToolResult[];
};

async function runOpenAiOwner(
  context: AgentContext,
  messages: ChatTurn[],
  tenantId: string,
): Promise<OwnerLlmResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("missing_key");
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const actions: OwnerToolResult[] = [];
  const convo: Record<string, unknown>[] = [
    { role: "system", content: buildOwnerSystemPrompt(context) },
    ...messages.map((message) => ({ role: message.role, content: message.content })),
  ];

  for (let step = 0; step < 4; step += 1) {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: convo,
        tools: OWNER_TOOL_DEFINITIONS,
      }),
    });
    if (!response.ok) throw new Error(`model_${response.status}`);
    const payload = (await response.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: { id: string; function: { name: string; arguments: string } }[];
        };
      }[];
    };
    const message = payload.choices?.[0]?.message;
    if (!message) throw new Error("empty");
    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        text: (message.content ?? "").trim() || fallback(context.locale),
        actions,
      };
    }
    convo.push(message as Record<string, unknown>);
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(call.function.arguments || "{}") as unknown;
        if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
      } catch {
        args = {};
      }
      const result = await executeOwnerTool(tenantId, context.locale, {
        name: call.function.name,
        arguments: args,
      });
      actions.push(result);
      convo.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 4000),
      });
    }
  }
  return { text: fallback(context.locale), actions };
}

function fallback(locale: "ro" | "en") {
  return locale === "en"
    ? "I ran the available actions. Tell me what else you need in the panel."
    : "Am rulat acțiunile disponibile. Spuneți-mi ce mai aveți nevoie în panou.";
}

/** Keyword fallback when no OpenAI key — still executes real tools. */
async function runMockOwner(
  context: AgentContext,
  latest: string,
  tenantId: string,
): Promise<OwnerLlmResult> {
  const locale = context.locale;
  const text = latest.toLowerCase();
  const actions: OwnerToolResult[] = [];
  const run = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await executeOwnerTool(tenantId, locale, { name, arguments: args });
    actions.push(result);
    return result;
  };

  if (/pauz|opresc? agent|pause|disable agent/.test(text)) {
    await run("set_agent_enabled", { enabled: false });
  } else if (/reporn|pornește agent|resume|enable agent|activează agent/.test(text)) {
    await run("set_agent_enabled", { enabled: true });
  } else if (/programăr|appointment|calendar/.test(text)) {
    await run("list_appointments", { scope: "upcoming", limit: 8 });
  } else if (/slot|interval liber|free slot/.test(text)) {
    await run("list_free_slots", { limit: 4 });
  } else if (/conversa|message|mesaj/.test(text)) {
    await run("list_conversations", { limit: 8 });
  } else if (/client|customer|lead/.test(text)) {
    await run("list_customers", { limit: 8 });
  } else if (/servici|service|preț|price/.test(text)) {
    await run("list_services");
  } else if (/marketing|facebook|instagram|tiktok|brief|postare/.test(text)) {
    await run("list_marketing");
  } else if (/profil|setăr|agent|tone|ton/.test(text)) {
    await run("get_agent_profile");
  } else {
    await run("get_agent_profile");
    await run("list_appointments", { scope: "upcoming", limit: 5 });
  }

  const lines = actions.map((action) => `• ${action.summary}`).join("\n");
  return {
    text:
      locale === "en"
        ? `I checked the panel with the local assistant (demo model):\n${lines}\n\nAsk for a specific change and I will apply it.`
        : `Am verificat panoul cu asistentul local (mod demonstrativ):\n${lines}\n\nCereți o modificare concretă și o aplic.`,
    actions,
  };
}

export async function completeOwnerTurn(input: {
  tenantId: string;
  context: AgentContext;
  messages: ChatTurn[];
  latest: string;
}): Promise<OwnerLlmResult> {
  if (llmMode().id === "openai") {
    try {
      return await runOpenAiOwner(input.context, input.messages, input.tenantId);
    } catch {
      return runMockOwner(input.context, input.latest, input.tenantId);
    }
  }
  return runMockOwner(input.context, input.latest, input.tenantId);
}
