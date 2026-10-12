// Edge Function "registrar": única porta de entrada do site para o banco.
// Recebe visitas, cálculos, cliques no WhatsApp e leads; valida, limita abuso e grava.
// Deploy com verificação de JWT desligada (o site não tem login); a proteção é feita aqui.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

// Configurações: segredo da função (se existir) ou tabela protegida public.ajustes (cache de 60 s)
let cache: { t: number; v: Record<string, string> } = { t: 0, v: {} };
async function ajustes() {
  if (Date.now() - cache.t > 60_000) {
    const { data } = await db.from('ajustes').select('chave, valor');
    const v: Record<string, string> = {};
    (data ?? []).forEach((r: { chave: string; valor: string }) => { v[r.chave] = r.valor; });
    cache = { t: Date.now(), v };
  }
  const get = (k: string) => Deno.env.get(k) ?? cache.v[k] ?? '';
  return {
    origens: get('ALLOWED_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean),
    sal: get('IP_SALT') || 'troque-este-sal',
  };
}

// Texto do consentimento guardado com o lead (fonte: servidor, não o navegador)
const CONSENT_VERSAO = '2026-10-12';
const CONSENT_TEXTO = 'Li e aceito os Termos de Uso e a Política de Privacidade. Autorizo o armazenamento dos meus dados e do cálculo realizado, que pode incluir informações de saúde ou deficiência, para que o advogado Breno Proenço retorne o contato. Posso pedir a exclusão a qualquer momento pelo e-mail breno.proensso@gmail.com.';

const CALCS = new Set(['tempo', 'simulador', 'valor', 'bpc', 'pensao', 'auxilio']);
const TIPOS = new Set(['visita', 'calculo', 'whatsapp', 'lead']);
const LIMITE = { lead: 5, evento: 240 }; // por IP a cada 10 minutos

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : null) || null;

function cors(origin: string | null, ORIGENS: string[]) {
  const ok = origin && (ORIGENS.length === 0 || ORIGENS.includes(origin));
  return {
    ok: !!ok,
    headers: {
      'Access-Control-Allow-Origin': ok ? origin! : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  };
}

function utm(v: unknown) {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const r: Record<string, string> = {};
  for (const k of ['source', 'medium', 'campaign', 'content', 'term']) { const s = txt(o[k], 80); if (s) r[k] = s; }
  return Object.keys(r).length ? r : null;
}

function entradas(v: unknown) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const r: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (++n > 40) break;
    const key = k.replace(/[^\w-]/g, '').slice(0, 40);
    if (!key) continue;
    if (typeof val === 'number' && isFinite(val)) r[key] = val;
    else if (typeof val === 'boolean') r[key] = val;
    else if (typeof val === 'string') r[key] = val.slice(0, 200);
  }
  return r;
}

async function hashIp(req: Request, SAL: string) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sem-ip';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SAL + ip));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function dentroDoLimite(ip: string, tipo: 'lead' | 'evento') {
  const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await db.from('limites').select('id', { count: 'exact', head: true }).eq('ip_hash', ip).eq('tipo', tipo).gte('criado_em', desde);
  if ((count ?? 0) >= LIMITE[tipo]) return false;
  await db.from('limites').insert({ ip_hash: ip, tipo });
  if (Math.random() < 0.02) await db.from('limites').delete().lt('criado_em', new Date(Date.now() - 864e5).toISOString());
  return true;
}

Deno.serve(async (req) => {
  const cfg = await ajustes();
  const c = cors(req.headers.get('origin'), cfg.origens);
  if (req.method === 'OPTIONS') return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
  if (req.method !== 'POST' || !c.ok) return new Response(null, { status: 403, headers: c.headers });

  const raw = await req.text();
  if (raw.length > 16_000) return new Response(null, { status: 413, headers: c.headers });
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return new Response(null, { status: 400, headers: c.headers }); }

  const tipo = String(b.tipo ?? '');
  if (!TIPOS.has(tipo)) return new Response(null, { status: 400, headers: c.headers });
  if (b.site) return new Response(null, { status: 204, headers: c.headers }); // armadilha anti-robô

  const ip = await hashIp(req, cfg.sal);
  if (!(await dentroDoLimite(ip, tipo === 'lead' ? 'lead' : 'evento'))) return new Response(null, { status: 429, headers: c.headers });

  const calc = txt(b.calculadora, 20);
  const comum = {
    pagina: txt(b.pagina, 200),
    referencia: txt(b.referencia, 120),
    utm: utm(b.utm),
    dispositivo: b.dispositivo === 'celular' || b.dispositivo === 'computador' ? b.dispositivo : null,
    sessao: txt(b.sessao, 40),
    calculadora: calc && CALCS.has(calc) ? calc : null,
    resumo: txt(b.resumo, 300),
  };

  let erro;
  if (tipo === 'lead') {
    const nome = txt(b.nome, 120);
    const whatsapp = String(b.whatsapp ?? '').replace(/\D/g, '');
    if (!nome || nome.length < 2 || whatsapp.length < 10 || whatsapp.length > 13 || b.consentimento !== true) {
      return new Response(null, { status: 422, headers: c.headers });
    }
    ({ error: erro } = await db.from('leads').insert({
      ...comum, nome, whatsapp, entradas: entradas(b.entradas),
      consentimento_texto: CONSENT_TEXTO, consentimento_versao: CONSENT_VERSAO,
    }));
  } else {
    ({ error: erro } = await db.from('eventos').insert({ ...comum, tipo }));
  }
  if (erro) { console.error(erro.message); return new Response(null, { status: 500, headers: c.headers }); }
  return new Response(null, { status: 204, headers: c.headers });
});
