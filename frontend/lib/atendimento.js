import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE = 'rb_totem';
// Acesso e armazenamento expiram apos 30 dias sem uso autenticado.
const SESSION_DURATION = 30 * 24 * 60 * 60;
const SERVICES = { atendimento: 'Atendimento', retirada: 'Retirada de Exames' };
const REQUIRED = ['SGA_BASE_URL', 'SGA_CLIENT_ID', 'SGA_CLIENT_SECRET', 'SGA_USERNAME', 'SGA_PASSWORD',
  'SGA_UNIT_ID', 'SGA_SERVICE_ID', 'SGA_NORMAL_PRIORITY_ID', 'SGA_PRIORITY_ID', 'KIOSK_ACCESS_CODE', 'COOKIE_SECRET'];

class AppError extends Error {
  constructor(status, message, uncertain = false) { super(message); this.status = status; this.uncertain = uncertain; }
}

function configuration(env) {
  if (REQUIRED.some(name => !env[name]?.trim())) return null;
  let base;
  try { base = new URL(env.SGA_BASE_URL); } catch { return null; }
  const allowedProtocol = base.protocol === 'https:' || (base.protocol === 'http:' && env.SGA_ALLOW_HTTP === 'true');
  if (!allowedProtocol || base.username || base.password || base.search || base.hash ||
      base.pathname !== '/' || env.COOKIE_SECRET.length < 32 || env.KIOSK_ACCESS_CODE.length < 16) return null;
  const ids = [env.SGA_UNIT_ID, env.SGA_SERVICE_ID, env.SGA_NORMAL_PRIORITY_ID, env.SGA_PRIORITY_ID];
  if (ids.some(value => !/^[1-9]\d{0,8}$/.test(value))) return null;
  return { base: base.origin, unit: Number(ids[0]), service: Number(ids[1]), normal: Number(ids[2]), priority: Number(ids[3]) };
}

function equal(left, right) {
  const a = Buffer.from(String(left)); const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function signature(payload, env) {
  return createHmac('sha256', env.COOKIE_SECRET).update(env.KIOSK_ACCESS_CODE + ':' + payload).digest('base64url');
}

function session(req, env, now) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!value || value.length > 1500) return null;
  const [payload, sig, extra] = value.split('.');
  if (!payload || !sig || extra || !equal(signature(payload, env), sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data || Array.isArray(data) || typeof data.csrf !== 'string' || !/^[a-f0-9]{32}$/.test(data.csrf)) return null;
    return data.v === undefined && Number.isInteger(data.exp) && data.exp > now ? data : null;
  } catch { return null; }
}

function remember(res, auth, env, now) {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_DURATION, csrf: auth.csrf })).toString('base64url');
  const value = payload + '.' + signature(payload, env);
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION}${env.NODE_ENV === 'production' || env.VERCEL ? '; Secure' : ''}`);
}

function sameOrigin(req) {
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}

async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new AppError(415, 'Formato de envio inválido.');
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    if (JSON.stringify(req.body).length > 2048) throw new AppError(413, 'Envio muito grande.');
    return req.body;
  }
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2048) throw new AppError(413, 'Envio muito grande.');
  }
  if (raw.length > 2048) throw new AppError(413, 'Envio muito grande.');
  try { const data = JSON.parse(raw); if (data && !Array.isArray(data)) return data; } catch { /* resposta uniforme */ }
  throw new AppError(400, 'Envio inválido.');
}

export function createHandler({ env = process.env, request = fetch, clock = () => Date.now() } = {}) {
  let cached = null;
  async function token(config) {
    if (cached && cached.exp > clock() + 30000) return cached.token;
    const data = new URLSearchParams({ grant_type: 'password', client_id: env.SGA_CLIENT_ID,
      client_secret: env.SGA_CLIENT_SECRET, username: env.SGA_USERNAME, password: env.SGA_PASSWORD });
    const response = await request(config.base + '/api/token', { method: 'POST', body: data,
      redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new AppError(503, 'Não foi possível conectar o atendimento. Procure a recepção.');
    const result = await response.json();
    if (typeof result.access_token !== 'string' || !result.access_token) throw new AppError(503, 'Conexão de atendimento indisponível.');
    cached = { token: result.access_token, exp: clock() + Math.min(Number(result.expires_in) || 60, 3600) * 1000 };
    return cached.token;
  }
  async function service(config, access, key) {
    const response = await request(`${config.base}/api/unidades/${config.unit}/servicos`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + access },
    });
    if (!response.ok) throw new AppError(503, 'Não foi possível consultar os serviços. Procure a recepção.');
    const result = await response.json();
    if (!Array.isArray(result)) throw new AppError(503, 'Os serviços precisam ser conferidos pela recepção.');
    const normalize = value => typeof value === 'string'
      ? value.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase() : '';
    const available = result.filter(item => item?.ativo === true && item.servico?.ativo !== false &&
      Number.isInteger(item.servico?.id) && item.servico.id > 0);
    let matches = available.filter(item => normalize(item.servico.nome) === normalize(SERVICES[key]));
    // A antiga fila de Recepcao continua atendendo enquanto seu nome nao for atualizado.
    if (!matches.length && key === 'atendimento') {
      matches = available.filter(item => item.servico.id === config.service && normalize(item.servico.nome) === 'recepcao');
    }
    if (matches.length !== 1) throw new AppError(503, `${SERVICES[key]} ainda não está disponível. Procure a recepção.`);
    return { id: matches[0].servico.id, name: SERVICES[key] };
  }
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    let emitting = false;
    try {
      const config = configuration(env);
      const now = Math.floor(clock() / 1000);
      if (req.method === 'GET') {
        const auth = config ? session(req, env, now) : null;
        if (auth) remember(res, auth, env, now);
        send(200, { configured: Boolean(config), authorized: Boolean(auth), csrf: auth?.csrf ?? null });
        return;
      }
      if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); throw new AppError(405, 'Método inválido.'); }
      if (!sameOrigin(req)) throw new AppError(403, 'Solicitação não autorizada.');
      if (!config) throw new AppError(503, 'A emissão ainda não foi ativada. Procure a recepção.');
      const data = await body(req);
      if (data.action === 'authorize') {
        if (typeof data.code !== 'string' || data.code.length > 256 || !equal(data.code, env.KIOSK_ACCESS_CODE)) {
          throw new AppError(403, 'Código de ativação inválido.');
        }
        // Confirmar credenciais do backend antes de autorizar o equipamento.
        await token(config);
        remember(res, { csrf: randomBytes(16).toString('hex') }, env, now);
        send(200, { authorized: true }); return;
      }
      const auth = session(req, env, now);
      if (!auth || typeof data.csrf !== 'string' || !equal(data.csrf, auth.csrf)) throw new AppError(403, 'Peça à equipe para ativar este totem.');
      if (data.action !== 'emit' || !['normal', 'priority'].includes(data.priority)) throw new AppError(400, 'Selecione o tipo de atendimento.');
      const serviceKey = data.service === undefined ? 'atendimento' : data.service;
      if (!['atendimento', 'retirada'].includes(serviceKey)) throw new AppError(400, 'Selecione um serviço disponível.');
      remember(res, auth, env, now);
      const access = await token(config);
      const selected = await service(config, access, serviceKey);
      emitting = true;
      const response = await request(config.base + '/api/distribui', { method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + access },
        body: JSON.stringify({ unidade: config.unit, servico: selected.id,
          prioridade: data.priority === 'normal' ? config.normal : config.priority }) });
      // Nunca repetir automaticamente uma emissao: a resposta pode ter se perdido apos gravar no NovoSGA.
      if (!response.ok) throw new AppError(502, 'Não foi possível confirmar sua senha. Consulte a recepção antes de tentar novamente.', true);
      const ticket = await response.json();
      const number = ticket?.senha?.format;
      if (typeof number !== 'string' || !/^[\p{L}\p{N} -]{1,16}$/u.test(number) || !Number.isInteger(ticket.id) || ticket.id < 1) {
        throw new AppError(502, 'A emissão precisa ser conferida pela recepção.', true);
      }
      send(201, { number, service: selected.name, priority: data.priority === 'normal' ? 'Normal' : 'Preferencial', issuedAt: new Date(clock()).toISOString() });
    } catch (error) {
      send(error instanceof AppError ? error.status : 503, {
        error: error instanceof AppError ? error.message : (emitting
          ? 'A conexão caiu durante a emissão. Consulte a recepção antes de tentar novamente.'
          : 'Atendimento indisponível no momento. Procure a recepção.'),
        uncertain: emitting || Boolean(error.uncertain),
      });
    }
  };
}
