import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class ChannelCryptoService {
  encrypt(secret: string): Buffer {
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted]);
  }

  decrypt(payload: Buffer): string {
    if (payload.length < 30 || payload[0] !== 1) throw new Error('Formato de segredo de canal inválido');
    const key = this.key();
    const iv = payload.subarray(1, 13);
    const tag = payload.subarray(13, 29);
    const ciphertext = payload.subarray(29);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  private key(): Buffer {
    const encoded = process.env.CHANNEL_SECRETS_KEY;
    if (!encoded) throw new Error('CHANNEL_SECRETS_KEY é obrigatório');
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32) throw new Error('CHANNEL_SECRETS_KEY deve ser Base64 de 32 bytes');
    return key;
  }
}
