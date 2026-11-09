import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const response = data => ({ ok: true, json: async () => data });

function page({ controller = true, nativeDialog = true, request = async () => response({ configured: true, authorized: false, csrf: null }) } = {}) {
  const nodes = new Map(); const calls = []; const timers = new Map(); let timerId = 0;
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    const classes = new Set(); const attributes = new Map(); const label = { textContent: '' };
    nodes.set(id, {
      hidden: false, disabled: false, value: '', textContent: '', open: false, listeners: new Map(),
      classList: { add: name => classes.add(name), remove: name => classes.delete(name),
        contains: name => classes.has(name), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
      querySelector: () => label, focus() { this.focused = true; },
      addEventListener(type, listener) { this.listeners.set(type, listener); },
      setAttribute(name, value) { attributes.set(name, value); if (name === 'open') this.open = true; },
      removeAttribute(name) { attributes.delete(name); if (name === 'open') this.open = false; },
    });
  }
  if (nativeDialog) {
    nodes.get('activation').showModal = function () { this.setAttribute('open', ''); };
    nodes.get('activation').close = function () { this.removeAttribute('open'); };
  }
  const ready = runInNewContext(source, {
    document: { getElementById: id => nodes.get(id) },
    AbortSignal: {}, AbortController: controller ? AbortController : undefined,
    fetch: async (url, options) => { calls.push({ url, options }); return request(url, options); },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id), setInterval: () => 0,
    requestAnimationFrame: callback => callback(), window: { print: () => assert.fail('nao deve imprimir nestes testes') },
  }, { filename: 'app.js' });
  return { nodes, calls, ready,
    fire: (id, type = 'click') => nodes.get(id).listeners.get(type)({ preventDefault() {} }),
    timeout: () => { for (const [id, timer] of [...timers]) if (timer.delay === 28000) { timers.delete(id); timer.callback(); } },
  };
}

for (const controller of [true, false]) {
  test(`tablet sem AbortSignal.timeout ${controller ? 'com' : 'sem'} AbortController mostra ativacao`, async () => {
    const tablet = page({ controller });
    await tablet.ready;
    assert.equal(tablet.calls.length, 1);
    assert.equal(tablet.nodes.get('activate').hidden, false);
    assert.equal(tablet.nodes.get('notice-actions').hidden, false);
    assert.equal(tablet.nodes.get('normal').disabled, true);
    assert.equal(tablet.nodes.get('retry-connection').hidden, true);
    assert.match(tablet.nodes.get('notice-text').textContent, /ativar este equipamento/);
  });
}

test('consulta travada termina mesmo sem AbortController e preserva acesso da equipe', async () => {
  const tablet = page({ controller: false, request: () => new Promise(() => {}) });
  tablet.timeout();
  await tablet.ready;
  assert.equal(tablet.calls.length, 1);
  assert.equal(tablet.nodes.get('activate').hidden, false);
  assert.equal(tablet.nodes.get('retry-connection').hidden, false);
  assert.equal(tablet.nodes.get('normal').disabled, true);
  assert.match(tablet.nodes.get('notice-text').textContent, /Tentar novamente/);
});

test('falha de rede permite tentar novamente somente a consulta sem emitir senha', async () => {
  let offline = true;
  const tablet = page({ request: async () => {
    if (offline) throw new TypeError('Failed to fetch');
    return response({ configured: true, authorized: false, csrf: null });
  } });
  await tablet.ready;
  assert.equal(tablet.nodes.get('activate').hidden, false);
  assert.equal(tablet.nodes.get('retry-connection').hidden, false);
  offline = false;
  await tablet.fire('retry-connection');
  assert.equal(tablet.nodes.get('retry-connection').hidden, true);
  assert.equal(tablet.nodes.get('activate').hidden, false);
  assert.equal(tablet.nodes.get('normal').disabled, true);
  assert.equal(tablet.calls.length, 2);
  assert.ok(tablet.calls.every(call => !call.options.method));
});

test('tablet sem dialog nativo ativa somente apos confirmacao do servidor', async () => {
  let authorized = false;
  const tablet = page({ controller: false, nativeDialog: false, request: async (url, options) => {
    if (options.method === 'POST') {
      const data = JSON.parse(options.body);
      assert.equal(data.action, 'authorize');
      assert.equal(data.code, 'codigo-exclusivo-da-equipe');
      authorized = true;
      return response({ authorized: true });
    }
    return response({ configured: true, authorized, csrf: authorized ? 'csrf-do-servidor' : null });
  } });
  await tablet.ready;
  tablet.fire('activate');
  assert.equal(tablet.nodes.get('activation').open, true);
  assert.equal(tablet.nodes.get('activation').classList.contains('fallback-dialog'), true);
  assert.equal(tablet.nodes.get('normal').disabled, true);
  tablet.nodes.get('activation-code').value = 'codigo-exclusivo-da-equipe';
  await tablet.fire('activation-form', 'submit');
  assert.equal(tablet.nodes.get('activation').open, false);
  assert.equal(tablet.nodes.get('activation-code').value, '');
  assert.equal(tablet.nodes.get('activate').hidden, true);
  assert.equal(tablet.nodes.get('notice-actions').hidden, true);
  assert.equal(tablet.nodes.get('normal').disabled, false);
  assert.equal(tablet.calls.length, 3);
});

for (const controller of [true, false]) test(`timeout durante emissao ${controller ? 'com' : 'sem'} AbortController nao repete a senha`, async () => {
  const tablet = page({ controller, request: async (url, options) => options.method === 'POST'
    ? new Promise(() => {}) : response({ configured: true, authorized: true, csrf: 'csrf-do-servidor' }) });
  await tablet.ready;
  const emission = tablet.fire('normal');
  tablet.timeout();
  await emission;
  if (controller) assert.equal(tablet.calls[1].options.signal.aborted, true);
  else assert.equal(tablet.calls[1].options.signal, undefined);
  assert.equal(tablet.nodes.get('normal').disabled, true);
  assert.equal(tablet.nodes.get('priority').disabled, true);
  await tablet.fire('normal');
  assert.equal(tablet.calls.filter(call => call.options.method === 'POST').length, 1);
  assert.match(tablet.nodes.get('notice-text').textContent, /Consulte a recepção/);
});
