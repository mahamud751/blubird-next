import { LLMClient, LLMResult } from '../code/backend/src/assistant/llm';

export class FakeLLM implements LLMClient {
  error: Error | null;
  calls: { messages: Array<Record<string, unknown>>; tools?: unknown[] }[] = [];
  script: LLMResult[];
  index = 0;

  constructor(opts: { replies?: string[]; error?: Error; script?: LLMResult[] } = {}) {
    this.error = opts.error ?? null;
    if (opts.script) {
      this.script = opts.script;
    } else {
      const texts = opts.replies ?? [
        'The Nimbus ANC Headphones (NMB-ANC-01) are $189.00 with 30-hour battery.',
      ];
      this.script = texts.map((content) => ({ content, tool_calls: [] }));
    }
  }

  async complete(messages: Array<Record<string, unknown>>, tools?: unknown[]): Promise<LLMResult> {
    this.calls.push({ messages, tools });
    if (this.error) throw this.error;
    const result = this.script[Math.min(this.index, this.script.length - 1)];
    this.index += 1;
    return result;
  }
}
