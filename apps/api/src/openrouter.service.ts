import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

@Injectable()
export class OpenRouterService {
  async chat(input: { model: string; temperature: number; maxTokens: number; messages: ChatMessage[] }) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new ServiceUnavailableException('Simulação de modelo indisponível: configure OPENROUTER_API_KEY no ambiente da API');
    let response: Response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: input.model, temperature: input.temperature, max_tokens: input.maxTokens, messages: input.messages }), signal: AbortSignal.timeout(45_000),
      });
    } catch { throw new ServiceUnavailableException('OpenRouter indisponível para a simulação'); }
    if (!response.ok) throw new BadGatewayException('OpenRouter rejeitou a simulação');
    const body = await response.json().catch(() => ({})) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) throw new BadGatewayException('OpenRouter não retornou uma resposta para a simulação');
    return content;
  }
}
