import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL é obrigatório');
    this.pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  }

  async onModuleDestroy() { await this.pool.end(); }

  async query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
    try { return await this.pool.query<T>(text, values); }
    catch { throw new ServiceUnavailableException('Banco de dados indisponível'); }
  }

  async withTenant<T>(empresaId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('app.empresa_id', $1, true)", [empresaId]);
      const result = await operation(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally { client.release(); }
  }
}
