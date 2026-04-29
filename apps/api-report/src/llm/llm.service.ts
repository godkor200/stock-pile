import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * LLM 추상화 — LLM_PROVIDER=ollama|anthropic 으로 전환
 * Ollama는 OpenAI 호환 API(/api/chat)를 사용
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: 'ollama' | 'anthropic';
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;
  private readonly anthropic: Anthropic;

  constructor(private readonly config: ConfigService) {
    this.provider = (config.get('LLM_PROVIDER', 'anthropic') as 'ollama' | 'anthropic');
    this.ollamaUrl = config.get('OLLAMA_URL', 'http://localhost:11434');
    this.ollamaModel = config.get('OLLAMA_MODEL', 'qwen2.5:7b');
    this.anthropic = new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY') });
    this.logger.log(`LLM provider: ${this.provider}`);
  }

  async chat(system: string, messages: LlmMessage[], maxTokens = 2048): Promise<LlmResponse> {
    if (this.provider === 'ollama') {
      return this.ollamaChat(system, messages, maxTokens);
    }
    return this.anthropicChat(system, messages, maxTokens);
  }

  private async ollamaChat(
    system: string,
    messages: LlmMessage[],
    maxTokens: number,
  ): Promise<LlmResponse> {
    const res = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.ollamaModel,
        stream: false,
        options: { num_predict: maxTokens },
        messages: [
          { role: 'system', content: system },
          ...messages,
        ],
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
    const data = (await res.json()) as {
      message: { content: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    this.logger.log(
      `Ollama usage: in≈${data.prompt_eval_count ?? 0} out≈${data.eval_count ?? 0}`,
    );

    return {
      text: data.message.content,
      inputTokens: data.prompt_eval_count ?? 0,
      outputTokens: data.eval_count ?? 0,
    };
  }

  private async anthropicChat(
    system: string,
    messages: LlmMessage[],
    maxTokens: number,
  ): Promise<LlmResponse> {
    const res = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    this.logger.log(
      `Anthropic usage: in=${res.usage.input_tokens} out=${res.usage.output_tokens}`,
    );

    const text = res.content.find((b) => b.type === 'text')?.text ?? '';
    return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
  }
}
