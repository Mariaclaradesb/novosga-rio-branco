const $ = id => document.getElementById(id);
let state = { configured: false, authorized: false, csrf: null };
let busy = false; let locked = false; let resetTimer;
const api = '/api/atendimento';

function updateClock() { $('clock').textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Rio_Branco', hour: '2-digit', minute: '2-digit' }).format(new Date()); }
updateClock(); setInterval(updateClock, 30000);

function notice(text, error = false) { $('notice-text').textContent = text; $('notice').classList.toggle('error', error); }
function controls() { for (const id of ['normal', 'priority']) $(id).disabled = busy || locked || !state.authorized; }
function render() {
  controls(); $('activate').hidden = !state.configured || state.authorized;
  $('system-status').classList.toggle('ready', state.authorized);
  $('system-status').querySelector('span').textContent = state.authorized ? 'Emissão habilitada' : 'Aguardando ativação';
  if (!locked) notice(state.authorized ? 'Sua senha será impressa. Aguarde a chamada na TV antes de ir ao guichê.'
    : state.configured ? 'Peça à equipe da recepção para ativar este equipamento.' : 'A emissão ainda não foi ativada. Para atendimento, procure a recepção.');
}

async function call(data) {
  const options = data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {};
  const response = await fetch(api, { ...options, cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(28000) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Atendimento indisponível.'), { uncertain: result.uncertain });
  return result;
}
async function status() {
  try { state = await call(); render(); }
  catch { state = { configured: false, authorized: false, csrf: null }; render(); notice('Não foi possível conectar. Procure a recepção.', true); }
}

function reset() { clearTimeout(resetTimer); $('receipt').hidden = true; $('welcome').hidden = false; render(); }
function printTicket() { clearTimeout(resetTimer); window.print(); resetTimer = setTimeout(reset, 20000); }
async function issue(priority) {
  if (busy || locked || !state.authorized) return;
  busy = true; controls(); notice('Emitindo sua senha. Aguarde…');
  try {
    const result = await call({ action: 'emit', priority, csrf: state.csrf });
    $('ticket-number').textContent = $('print-number').textContent = result.number;
    $('ticket-priority').textContent = $('print-priority').textContent = result.priority;
    $('print-time').textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Rio_Branco', dateStyle: 'short', timeStyle: 'short' }).format(new Date(result.issuedAt));
    $('welcome').hidden = true; $('receipt').hidden = false;
    $('start-again').focus();
    requestAnimationFrame(() => requestAnimationFrame(printTicket));
  } catch (error) {
    // Em uma falha de rede, a senha pode ter sido emitida. Nao repetir por conta propria.
    locked = true; controls(); notice(error.message.includes('fetch') || error.name === 'TimeoutError'
      ? 'A conexão caiu durante a emissão. Consulte a recepção antes de tentar novamente.' : error.message, true);
  } finally { busy = false; controls(); }
}
$('normal').addEventListener('click', () => issue('normal'));
$('priority').addEventListener('click', () => issue('priority'));
$('print-again').addEventListener('click', printTicket);
$('start-again').addEventListener('click', reset);
$('activate').addEventListener('click', () => { $('activation-error').textContent = ''; $('activation-code').value = ''; $('activation').showModal(); });
$('cancel-activation').addEventListener('click', () => $('activation').close());
$('activation-form').addEventListener('submit', async event => {
  event.preventDefault(); $('confirm-activation').disabled = true; $('activation-error').textContent = '';
  try { await call({ action: 'authorize', code: $('activation-code').value }); $('activation-code').value = ''; $('activation').close(); await status(); }
  catch (error) { $('activation-error').textContent = error.message; }
  finally { $('confirm-activation').disabled = false; }
});
status();
