export type ServiceItem = { name: string; detail: string };

export type AgentContext = {
  locale: "ro" | "en";
  businessName: string;
  description: string;
  services: ServiceItem[];
  hoursText: string;
  tone: string;
  customInstructions: string;
  greeting: string;
  slotMinutes: number;
  timezone: string;
};

export type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolExecutor = (call: ToolCall) => Promise<unknown>;

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export interface LlmProvider {
  id: "openai" | "mock";
  complete(input: {
    context: AgentContext;
    messages: ChatTurn[];
    execute: ToolExecutor;
  }): Promise<{ text: string }>;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}
