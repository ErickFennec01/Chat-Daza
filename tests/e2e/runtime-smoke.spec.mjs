import test from 'node:test';
import assert from 'node:assert/strict';

const webUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3100';
const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:8100';

test('plataforma publicada expõe login e healthcheck sem credenciais', async () => {
  const [web, api] = await Promise.all([
    fetch(`${webUrl}/login`),
    fetch(`${apiUrl}/v1/healthz`),
  ]);
  assert.equal(web.status, 200);
  assert.match(await web.text(), /DAZA ATENDIMENTO/i);
  assert.equal(api.status, 200);
  assert.deepEqual(await api.json(), { status: 'ok' });
});
