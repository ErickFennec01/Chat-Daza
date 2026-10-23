import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type WahaReply = { id?: string; key?: { id?: string }; data?: string };

@Injectable()
export class WahaService {
  async startSession(session: string) {
    await this.request('/api/sessions', { method: 'POST', body: JSON.stringify({ name: session }) }, [200, 201, 409]);
    // Criar a sessão não garante que ela entre em modo de pareamento. O start
    // também é seguro para sessões já existentes, tornando a ação idempotente.
    await this.request(`/api/sessions/${encodeURIComponent(session)}/start`, { method: 'POST' }, [200, 201, 409, 422]);
  }

  async getQrDataUrl(session: string): Promise<string> {
    const response = await this.request(`/api/${encodeURIComponent(session)}/auth/qr?format=image`, { headers: { accept: 'application/json' } }, [200]);
    const body = await response.json().catch(() => ({})) as WahaReply & { mimetype?: string };
    if (!body.data || !body.mimetype?.startsWith('image/')) throw new BadGatewayException('WAHA ainda não disponibilizou o QR Code. Aguarde alguns segundos e tente novamente.');
    return `data:${body.mimetype};base64,${body.data}`;
  }

  async sendText(session: string, contact: string, text: string): Promise<string | null> {
    const digits = contact.replace(/\D/g, '');
    if (digits.length < 8) throw new BadGatewayException('Contato WhatsApp inválido para entrega WAHA');
    const response = await this.request('/api/sendText', {
      method: 'POST',
      body: JSON.stringify({ session, chatId: `${digits}@c.us`, text }),
    }, [200, 201]);
    const body = await response.json().catch(() => ({})) as WahaReply;
    return body.id ?? body.key?.id ?? null;
  }

  private async request(path: string, init: RequestInit, accepted: number[]) {
    const baseUrl = process.env.WAHA_BASE_URL;
    const apiKey = process.env.WAHA_API_KEY;
    if (!baseUrl || !apiKey) throw new ServiceUnavailableException('WAHA não está configurado');
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: { 'x-api-key': apiKey, 'content-type': 'application/json', ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ServiceUnavailableException('WAHA indisponível');
    }
    if (!accepted.includes(response.status)) throw new BadGatewayException('WAHA rejeitou a solicitação');
    return response;
  }
}
