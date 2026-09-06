import OpenAI from 'openai';
import { AppSettings } from '../config/app.config';

export type ToolCall = {
  id: string;
  name: string;
  arguments: string;
  extra_content?: unknown;
};

export type LLMResult = {
  content: string;
  tool_calls: ToolCall[];
};

export interface LLMClient {
  complete(messages: Array<Record<string, unknown>>, tools?: unknown[]): Promise<LLMResult>;
}

function parseChoice(message: {
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type?: string;
    function?: { name: string; arguments?: string };
    extra_content?: unknown;
  }>;
}): LLMResult {
  const calls: ToolCall[] = [];
  for (const call of message.tool_calls ?? []) {
    if (call.function?.name) {
      calls.push({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments || '{}',
        extra_content: call.extra_content,
      });
    }
  }
  return { content: message.content || '', tool_calls: calls };
}

function sanitizeMessages(messages: Array<Record<string, unknown>>) {
  return messages.map((msg) => {
    const next = { ...msg };
    if (next.content == null) next.content = '';
    return next;
  });
}

export class OpenAILLM implements LLMClient {
  private readonly client: OpenAI;
  constructor(
    apiKey: string,
    baseUrl: string,
    private readonly model: string,
  ) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
  }

  async complete(messages: Array<Record<string, unknown>>, tools?: unknown[]): Promise<LLMResult> {
    const kwargs: Record<string, unknown> = {
      model: this.model,
      messages: sanitizeMessages(messages),
      temperature: 0.2,
    };
    if (tools?.length) {
      kwargs.tools = tools;
      kwargs.tool_choice = 'auto';
    }
    const response = await this.client.chat.completions.create(kwargs as never);
    return parseChoice(response.choices[0]?.message ?? {});
  }
}

export class GeminiLLM implements LLMClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async complete(messages: Array<Record<string, unknown>>, tools?: unknown[]): Promise<LLMResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: sanitizeMessages(messages),
      temperature: 0.2,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(raw.slice(0, 400) || `Gemini HTTP ${response.status}`);
    }
    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] & Array<{ id: string; function?: { name: string; arguments?: string } }> } }>;
    };
    return parseChoice(data.choices?.[0]?.message ?? {});
  }
}

export function buildLlm(settings: AppSettings): LLMClient | null {
  if (settings.geminiApiKey) {
    return new GeminiLLM(settings.geminiApiKey, settings.geminiBaseUrl, settings.geminiModel);
  }
  if (!settings.llmApiKey) return null;
  return new OpenAILLM(settings.llmApiKey, settings.llmBaseUrl, settings.llmModel);
}
