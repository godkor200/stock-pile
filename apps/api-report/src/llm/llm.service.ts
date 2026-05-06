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
 * LLM 추상화 — LLM_PROVIDER=ollama|anthropic|groq
 * ANTHROPIC_API_KEY 없으면 자동으로 Groq로 폴백
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: 'ollama' | 'anthropic' | 'groq';
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;
  private readonly anthropic: Anthropic;
  private readonly groqApiKey: string;
  private readonly groqModel: string;

  constructor(private readonly config: ConfigService) {
    const anthropicKey = config.get<string>('ANTHROPIC_API_KEY', '');
    const requestedProvider = config.get('LLM_PROVIDER', 'anthropic') as string;

    // ANTHROPIC_API_KEY 없으면 Groq로 자동 폴백
    if (requestedProvider === 'anthropic' && !anthropicKey) {
      this.provider = 'groq';
      this.logger.warn('ANTHROPIC_API_KEY 없음 → Groq로 폴백');
    } else {
      this.provider = requestedProvider as 'ollama' | 'anthropic' | 'groq';
    }

    this.ollamaUrl = config.get('OLLAMA_URL', 'http://localhost:11434');
    this.ollamaModel = config.get('OLLAMA_MODEL', 'qwen2.5:7b');
    this.anthropic = new Anthropic({ apiKey: anthropicKey || 'placeholder' });
    this.groqApiKey = config.get('GROQ_API_KEY', '');
    this.groqModel = config.get('GROQ_MODEL', 'llama-3.3-70b-versatile');

    this.logger.log(`LLM provider: ${this.provider}`);
  }

  async chat(system: string, messages: LlmMessage[], maxTokens = 2048): Promise<LlmResponse> {
    if (this.provider === 'ollama') return this.ollamaChat(system, messages, maxTokens);
    if (this.provider === 'groq') return this.groqChat(system, messages, maxTokens);
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

  private async groqChat(
    system: string,
    messages: LlmMessage[],
    maxTokens: number,
  ): Promise<LlmResponse> {
    if (!this.groqApiKey) throw new Error('GROQ_API_KEY가 설정되지 않았습니다');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.groqApiKey}`,
      },
      body: JSON.stringify({
        model: this.groqModel,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    this.logger.log(
      `Groq usage: in=${data.usage.prompt_tokens} out=${data.usage.completion_tokens}`,
    );

    return {
      text: data.choices[0]?.message.content ?? '',
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    };
  }
}
