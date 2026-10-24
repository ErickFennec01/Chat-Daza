import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type WahaReply = { id?: string; key?: { id?: string }; data?: string };
type WahaSessionReply = { status?: string; me?: { id?: string; user?: string } };

export type WahaSessionStatus = {
  estado: 'conectado' | 'aguardando_qr' | 'conectando' | 'desconectado' | 'indisponivel';
  statusWaha: string | null;
};

@Injectable()
export class WahaService {
  async startSession(session: string) {
    // O WAHA usa 422 para informar que a sessão já existe. Isso é esperado
    // quando o administrador pede um novo QR para um canal já salvo.
    await this.request('/api/sessions', { method: 'POST', body: JSON.stringify({ name: session }) }, [200, 201, 409, 422]);
    // Criar a sessão não garante que ela entre em modo de pareamento. O start
    // também é seguro para sessões já existentes, tornando a ação idempotente.
    await this.request(`/api/sessions/${encodeURIComponent(session)}/start`, { method: 'POST' }, [200, 201, 409, 422]);
  }

  async getQrDataUrl(session: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.request(`/api/${encodeURIComponent(session)}/auth/qr?format=image`, { headers: { accept: 'application/json' } }, [200, 422]);
      if (response.status === 200) {
        const body = await response.json().catch(() => ({})) as WahaReply & { mimetype?: string };
        if (body.data && body.mimetype?.startsWith('image/')) return `data:${body.mimetype};base64,${body.data}`;
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    throw new BadGatewayException('WAHA ainda está preparando o QR Code. Aguarde alguns segundos e tente novamente.');
  }

  async getSessionStatus(session: string): Promise<WahaSessionStatus> {
    const response = await this.request(`/api/sessions/${encodeURIComponent(session)}`, {}, [200, 404]);
    if (response.status === 404) return { estado: 'indisponivel', statusWaha: null };
    const body = await response.json().catch(() => ({})) as WahaSessionReply;
    const status = body.status ?? null;
    if (status === 'WORKING') return { estado: 'conectado', statusWaha: status };
    if (status === 'SCAN_QR_CODE') return { estado: 'aguardando_qr', statusWaha: status };
    if (status === 'STARTING') return { estado: 'conectando', statusWaha: status };
    return { estado: 'desconectado', statusWaha: status };
  }

  async sendText(session: string, contact: string, text: string): Promise<string | null> {
    const chatId = this.toChatId(contact);
    const response = await this.request('/api/sendText', {
      method: 'POST',
      body: JSON.stringify({ session, chatId, text }),
    }, [200, 201]);
    const body = await response.json().catch(() => ({})) as WahaReply;
    return body.id ?? body.key?.id ?? null;
  }

  private toChatId(contact: string): string {
    const value = contact.trim();
    if (/^[0-9]+@lid$/.test(value)) return value;
    if (/^[0-9]+@c\.us$/.test(value)) return value;
    if (/^[0-9]+@s\.whatsapp\.net$/.test(value)) return value.replace(/@s\.whatsapp\.net$/, '@c.us');
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 8) return `${digits}@c.us`;
    throw new BadGatewayException('Contato WhatsApp inválido para entrega WAHA');
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
