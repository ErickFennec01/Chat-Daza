import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = JSON.parse(readFileSync(new URL('../daza-atendimento-agente.json', import.meta.url)));
const fixtures = JSON.parse(readFileSync(new URL('../fixtures/inbound-events.json', import.meta.url)));
const normalizerCode = workflow.nodes.find((node) => node.name === '02 — Validar e normalizar').parameters.jsCode;
const normalize = new Function('$json', normalizerCode);

const normalized = normalize({ body: fixtures[0].input });
assert.equal(normalized.json.canal, 'whatsapp');
assert.equal(normalized.json.id_externo, 'wamid.valid-001');
assert.equal(normalized.json.metadados.canal_id, fixtures[0].input.metadados.canal_id);
assert.throws(() => normalize({ body: fixtures[1].input }), /id_externo/);

console.log('fixture_valid=ok');
console.log('fixture_invalid=ok');
console.log('fixture_duplicate=requires_postgres_durable_check');
