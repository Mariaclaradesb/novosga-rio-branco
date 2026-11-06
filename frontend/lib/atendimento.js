import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE = 'rb_totem';
const DURATION = 30 * 24 * 60 * 60;
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
    return Number.isInteger(data.exp) && data.exp > now && /^[a-f0-9]{32}$/.test(data.csrf) ? data : null;
  } catch { return null; }
}

function cookie(value, env, age = DURATION) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${env.NODE_ENV === 'production' || env.VERCEL ? '; Secure' : ''}`;
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
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, value) => { res.statusCode = status; res.end(JSON.stringify(value)); };
    let emitting = false;
    try {
      const config = configuration(env);
      if (req.method === 'GET') {
        const auth = config ? session(req, env, Math.floor(clock() / 1000)) : null;
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
        const payload = Buffer.from(JSON.stringify({ exp: Math.floor(clock() / 1000) + DURATION,
          csrf: randomBytes(16).toString('hex') })).toString('base64url');
        res.setHeader('Set-Cookie', cookie(payload + '.' + signature(payload, env), env));
        send(200, { authorized: true }); return;
      }
      const auth = session(req, env, Math.floor(clock() / 1000));
      if (!auth || typeof data.csrf !== 'string' || !equal(data.csrf, auth.csrf)) throw new AppError(403, 'Peça à equipe para ativar este totem.');
      if (data.action !== 'emit' || !['normal', 'priority'].includes(data.priority)) throw new AppError(400, 'Selecione o tipo de atendimento.');
      const access = await token(config);
      emitting = true;
      const response = await request(config.base + '/api/distribui', { method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(12000), headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + access },
        body: JSON.stringify({ unidade: config.unit, servico: config.service,
          prioridade: data.priority === 'normal' ? config.normal : config.priority }) });
      // Nunca repetir automaticamente uma emissao: a resposta pode ter se perdido apos gravar no NovoSGA.
      if (!response.ok) throw new AppError(502, 'Não foi possível confirmar sua senha. Consulte a recepção antes de tentar novamente.', true);
      const ticket = await response.json();
      const number = ticket?.senha?.format;
      if (typeof number !== 'string' || !/^[\p{L}\p{N} -]{1,16}$/u.test(number) || !Number.isInteger(ticket.id) || ticket.id < 1) {
        throw new AppError(502, 'A emissão precisa ser conferida pela recepção.', true);
      }
      send(201, { number, service: 'Recepção', priority: data.priority === 'normal' ? 'Normal' : 'Prioridade', issuedAt: new Date(clock()).toISOString() });
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
