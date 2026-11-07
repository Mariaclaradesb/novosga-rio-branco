import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createHandler } from '../lib/atendimento.js';

const environment = () => ({ NODE_ENV: 'production', SGA_BASE_URL: 'https://sga.example.org',
  SGA_CLIENT_ID: 'cliente-teste', SGA_CLIENT_SECRET: 'segredo-apenas-no-servidor', SGA_USERNAME: 'totem',
  SGA_PASSWORD: 'senha-apenas-no-servidor', SGA_UNIT_ID: '3', SGA_SERVICE_ID: '8', SGA_NORMAL_PRIORITY_ID: '1',
  SGA_PRIORITY_ID: '2', KIOSK_ACCESS_CODE: 'codigo-teste-forte-123456', COOKIE_SECRET: 'segredo-teste-cookies-com-mais-de-32-caracteres' });
function backend(calls, ticket = { id: 24, senha: { format: 'R024' } }) {
  return async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/api/token')) return new Response(JSON.stringify({ access_token: 'token-so-no-servidor', expires_in: 3600 }));
    return new Response(JSON.stringify(ticket), { status: 201 });
  };
}
async function invoke(handler, { method = 'GET', data, cookie, origin = 'https://totem.example.org', type = 'application/json' } = {}) {
  const headers = {};
  const req = { method, headers: { host: 'totem.example.org', origin, 'content-type': type, cookie }, body: data };
  const res = { statusCode: 0, setHeader: (key, value) => { headers[key] = value; }, end: value => { res.body = JSON.parse(value); } };
  await handler(req, res);
  return { status: res.statusCode, body: res.body, headers };
}
async function authorize(handler, env) {
  const result = await invoke(handler, { method: 'POST', data: { action: 'authorize', code: env.KIOSK_ACCESS_CODE } });
  assert.equal(result.status, 200);
  const cookie = result.headers['Set-Cookie'].split(';')[0];
  const state = await invoke(handler, { cookie });
  assert.equal(state.body.authorized, true);
  return { cookie, csrf: state.body.csrf, result };
}

function signedCookie(data, env) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = createHmac('sha256', env.COOKIE_SECRET).update(env.KIOSK_ACCESS_CODE + ':' + payload).digest('base64url');
  return 'rb_totem=' + payload + '.' + signature;
}

function cookieData(value) {
  return JSON.parse(Buffer.from(value.split(';')[0].split('=')[1].split('.')[0], 'base64url').toString());
}

test('sem configuracao, a pagina informa indisponibilidade e nao emite senha', async () => {
  const handler = createHandler({ env: {}, request: () => assert.fail('nao deve acessar backend') });
  const status = await invoke(handler);
  assert.deepEqual(status.body, { configured: false, authorized: false, csrf: null });
  assert.equal((await invoke(handler, { method: 'POST', data: { action: 'emit', priority: 'normal' } })).status, 503);
});

test('HTTP sem autorizacao explicita e configuracao invalida desativam a emissao', async () => {
  for (const change of [{ SGA_BASE_URL: 'http://sga.example.org' }, { SGA_BASE_URL: 'https://sga.example.org/login' }, { SGA_UNIT_ID: '1;delete' }, { COOKIE_SECRET: 'curto' }]) {
    const handler = createHandler({ env: { ...environment(), ...change } });
    assert.equal((await invoke(handler)).body.configured, false);
  }
});

test('HTTP explicito aceita IP e porta e preserva cookie HTTPS e escopo da emissao', async () => {
  const env = { ...environment(), SGA_BASE_URL: 'http://198.51.100.42:8088', SGA_ALLOW_HTTP: 'true' };
  const calls = []; const handler = createHandler({ env, request: backend(calls) });
  const auth = await authorize(handler, env);
  assert.match(auth.result.headers['Set-Cookie'], /; Secure$/);
  const result = await invoke(handler, { method: 'POST', cookie: auth.cookie, data: { action: 'emit', priority: 'normal', csrf: auth.csrf } });
  assert.equal(result.status, 201);
  assert.equal(calls[0].url, 'http://198.51.100.42:8088/api/token');
  assert.equal(calls[1].url, 'http://198.51.100.42:8088/api/distribui');
  assert.deepEqual(JSON.parse(calls[1].options.body), { unidade: 3, servico: 8, prioridade: 1 });
});

test('permissao HTTP nao aceita outros protocolos nem ativacao ambigua', async () => {
  for (const change of [
    { SGA_BASE_URL: 'ftp://sga.example.org', SGA_ALLOW_HTTP: 'true' },
    { SGA_BASE_URL: 'http://sga.example.org', SGA_ALLOW_HTTP: 'false' },
    { SGA_BASE_URL: 'http://sga.example.org', SGA_ALLOW_HTTP: 'TRUE' },
  ]) {
    const handler = createHandler({ env: { ...environment(), ...change } });
    assert.equal((await invoke(handler)).body.configured, false);
  }
});

test('codigo incorreto e origem externa nao acessam backend', async () => {
  const handler = createHandler({ env: environment(), request: () => assert.fail('nao deve acessar backend') });
  assert.equal((await invoke(handler, { method: 'POST', data: { action: 'authorize', code: 'errado' } })).status, 403);
  assert.equal((await invoke(handler, { method: 'POST', origin: 'https://atacante.example.org', data: { action: 'authorize', code: 'qualquer' } })).status, 403);
});

test('ativacao autentica no backend e guarda somente cookie assinado protegido', async () => {
  const env = environment(); const calls = [];
  const handler = createHandler({ env, request: backend(calls) });
  const { result } = await authorize(handler, env);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.body.get('password'), env.SGA_PASSWORD);
  assert.equal(calls[0].options.body.get('client_secret'), env.SGA_CLIENT_SECRET);
  assert.match(result.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
  assert.match(result.headers['Set-Cookie'], /; Secure$/);
  assert.match(result.headers['Set-Cookie'], /; Max-Age=2592000;/);
  assert.equal(Number.isInteger(cookieData(result.headers['Set-Cookie']).exp), true);
  for (const secret of [env.SGA_PASSWORD, env.SGA_CLIENT_SECRET, 'token-so-no-servidor', env.KIOSK_ACCESS_CODE]) {
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});

test('cookie ausente ou CSRF incorreto impedem emissao', async () => {
  const env = environment(); const calls = []; const handler = createHandler({ env, request: backend(calls) });
  assert.equal((await invoke(handler, { method: 'POST', data: { action: 'emit', priority: 'normal', csrf: 'x' } })).status, 403);
  const auth = await authorize(handler, env);
  assert.equal((await invoke(handler, { method: 'POST', cookie: auth.cookie, data: { action: 'emit', priority: 'normal', csrf: 'errado' } })).status, 403);
  assert.equal(calls.length, 1);
});

for (const [priority, id] of [['normal', 1], ['priority', 2]]) {
  test(`emissao ${priority} usa somente unidade, servico e prioridade autorizados`, async () => {
    const env = environment(); const calls = []; const handler = createHandler({ env, request: backend(calls) });
    const auth = await authorize(handler, env);
    const result = await invoke(handler, { method: 'POST', cookie: auth.cookie, data: { action: 'emit', priority, csrf: auth.csrf, unidade: 999, servico: 999, cliente: { nome: 'nao transmitir' } } });
    assert.equal(result.status, 201);
    assert.equal(result.body.number, 'R024');
    assert.match(result.headers['Set-Cookie'], /; Max-Age=2592000;/);
    assert.equal(cookieData(result.headers['Set-Cookie']).csrf, auth.csrf);
    assert.deepEqual(JSON.parse(calls[1].options.body), { unidade: 3, servico: 8, prioridade: id });
    assert.equal(calls[1].options.headers.Authorization, 'Bearer token-so-no-servidor');
    assert.equal(JSON.stringify(result).includes('token-so-no-servidor'), false);
    assert.equal(calls.length, 2);
  });
}

test('falha apos envio nao repete a emissao e sinaliza resultado incerto', async () => {
  const env = environment(); let emissions = 0; const normal = backend([]);
  const handler = createHandler({ env, request: async (url, options) => {
    if (url.endsWith('/api/distribui')) { emissions++; throw new Error('falha de rede com segredo-nao-exibir'); }
    return normal(url, options);
  } });
  const auth = await authorize(handler, env);
  const result = await invoke(handler, { method: 'POST', cookie: auth.cookie, data: { action: 'emit', priority: 'normal', csrf: auth.csrf } });
  assert.equal(emissions, 1); assert.equal(result.body.uncertain, true);
  assert.equal(JSON.stringify(result).includes('segredo-nao-exibir'), false);
});

test('ativacao se renova durante o uso por anos sem pedir o codigo novamente', async () => {
  const env = environment(); let now = Date.now(); const calls = [];
  const handler = createHandler({ env, request: backend(calls), clock: () => now });
  const auth = await authorize(handler, env);
  let cookie = auth.cookie;
  for (let visit = 0; visit < 48; visit++) {
    now += 29 * 24 * 60 * 60 * 1000;
    const result = await invoke(handler, { cookie });
    assert.equal(result.body.authorized, true);
    assert.equal(result.body.csrf, auth.csrf);
    assert.match(result.headers['Set-Cookie'], /; Max-Age=2592000;/);
    assert.equal(cookieData(result.headers['Set-Cookie']).exp, Math.floor(now / 1000) + 30 * 24 * 60 * 60);
    assert.match(result.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
    assert.match(result.headers['Set-Cookie'], /; Secure$/);
    cookie = result.headers['Set-Cookie'].split(';')[0];
  }
  assert.equal(calls.length, 1, 'renovar a ativacao nao deve repetir login no backend');
});

test('ativacao atual ainda valida se renova ao abrir a tela sem trocar CSRF nem pedir codigo', async () => {
  const env = environment(); let now = Date.now();
  const csrf = '1234567890abcdef1234567890abcdef';
  const cookie = signedCookie({ exp: Math.floor(now / 1000) + 60, csrf }, env);
  const handler = createHandler({ env, clock: () => now, request: () => assert.fail('migrar nao exige backend') });
  const result = await invoke(handler, { cookie });
  assert.equal(result.body.authorized, true);
  assert.equal(result.body.csrf, csrf);
  assert.deepEqual(cookieData(result.headers['Set-Cookie']), { exp: Math.floor(now / 1000) + 30 * 24 * 60 * 60, csrf });
  now += 29 * 24 * 60 * 60 * 1000;
  const migrated = await invoke(handler, { cookie: result.headers['Set-Cookie'].split(';')[0] });
  assert.equal(migrated.body.authorized, true);
  assert.equal(migrated.body.csrf, csrf);
});

test('ativacao atual se renova tambem ao emitir sem recarregar a tela', async () => {
  const env = environment(); const calls = []; const now = Date.now();
  const csrf = '1234567890abcdef1234567890abcdef';
  const cookie = signedCookie({ exp: Math.floor(now / 1000) + 60, csrf }, env);
  const handler = createHandler({ env, request: backend(calls), clock: () => now });
  const result = await invoke(handler, { method: 'POST', cookie, data: { action: 'emit', priority: 'normal', csrf } });
  assert.equal(result.status, 201);
  assert.deepEqual(cookieData(result.headers['Set-Cookie']), { exp: Math.floor(now / 1000) + 30 * 24 * 60 * 60, csrf });
  assert.equal(calls.filter(call => call.url.endsWith('/api/distribui')).length, 1);
});

test('ativacoes antigas expiradas ou formatos invalidos nao sao renovados', async () => {
  const env = environment(); const now = Date.now(); const seconds = Math.floor(now / 1000);
  const csrf = '1234567890abcdef1234567890abcdef';
  const handler = createHandler({ env, clock: () => now, request: () => assert.fail('nao deve acessar backend') });
  for (const data of [{ exp: seconds, csrf }, { exp: seconds - 1, csrf },
    { v: 2, exp: seconds + 3600, csrf }, { v: 3, csrf }, { v: 2, csrf: [csrf] }]) {
    const cookie = signedCookie(data, env);
    const result = await invoke(handler, { cookie });
    assert.equal(result.body.authorized, false);
    assert.equal(result.headers['Set-Cookie'], undefined);
    const emission = await invoke(handler, { method: 'POST', cookie, data: { action: 'emit', priority: 'normal', csrf } });
    assert.equal(emission.status, 403);
    assert.equal(emission.headers['Set-Cookie'], undefined);
  }
});

test('30 dias sem uso continuam expirando o acesso no servidor', async () => {
  const env = environment(); let now = Date.now();
  const handler = createHandler({ env, request: backend([]), clock: () => now });
  const auth = await authorize(handler, env);
  now += 30 * 24 * 60 * 60 * 1000;
  const state = await invoke(handler, { cookie: auth.cookie });
  assert.equal(state.body.authorized, false);
  assert.equal(state.headers['Set-Cookie'], undefined);
  const emission = await invoke(handler, { method: 'POST', cookie: auth.cookie,
    data: { action: 'emit', priority: 'normal', csrf: auth.csrf } });
  assert.equal(emission.status, 403);
  assert.equal(emission.headers['Set-Cookie'], undefined);
});

test('sessao adulterada e rotacao do codigo ou segredo continuam revogando acesso', async () => {
  const env = environment(); const handler = createHandler({ env, request: backend([]) });
  const auth = await authorize(handler, env);
  const tampered = await invoke(handler, { cookie: auth.cookie + 'adulterado' });
  assert.equal(tampered.body.authorized, false);
  assert.equal(tampered.headers['Set-Cookie'], undefined);
  for (const change of [{ KIOSK_ACCESS_CODE: 'codigo-novo-e-seguro-123456' },
    { COOKIE_SECRET: 'segredo-novo-para-revogar-com-mais-de-32-caracteres' }]) {
    const revoked = createHandler({ env: { ...env, ...change }, request: () => assert.fail('nao deve acessar backend') });
    const result = await invoke(revoked, { cookie: auth.cookie });
    assert.equal(result.body.authorized, false);
    assert.equal(result.headers['Set-Cookie'], undefined);
  }
});

test('resposta inesperada do backend nao gera numero ficticio', async () => {
  const env = environment(); const handler = createHandler({ env, request: backend([], { id: 24, senha: { format: '<script>erro</script>' } }) });
  const auth = await authorize(handler, env);
  const result = await invoke(handler, { method: 'POST', cookie: auth.cookie, data: { action: 'emit', priority: 'normal', csrf: auth.csrf } });
  assert.equal(result.status, 502); assert.equal(result.body.uncertain, true); assert.equal(result.body.number, undefined);
});
