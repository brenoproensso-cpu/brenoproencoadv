// Edge Function "publicar": dispara a atualização do site no Netlify.
// Só funciona para usuário logado que esteja na tabela admins.
// Configuração: BUILD_HOOK (endereço do deploy hook da hospedagem: Cloudflare Pages ou Netlify),
// como segredo da função ou linha na tabela public.ajustes. NETLIFY_BUILD_HOOK é aceito como nome antigo.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const servico = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

// Configurações: segredo da função (se existir) ou tabela protegida public.ajustes
async function ajuste(k: string) {
  const env = Deno.env.get(k);
  if (env) return env;
  const { data } = await servico.from('ajustes').select('valor').eq('chave', k).maybeSingle();
  return (data?.valor as string) ?? '';
}

function headers(origin: string | null, ORIGENS: string[]) {
  const ok = !!origin && (ORIGENS.length === 0 || ORIGENS.includes(origin));
  return {
    ok,
    h: {
      'Access-Control-Allow-Origin': ok ? origin! : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Content-Type': 'application/json',
      'Vary': 'Origin',
    },
  };
}

Deno.serve(async (req) => {
  const ORIGENS = (await ajuste('ALLOWED_ORIGINS')).split(',').map((s) => s.trim()).filter(Boolean);
  const { ok, h } = headers(req.headers.get('origin'), ORIGENS);
  if (req.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: h });
  if (req.method !== 'POST' || !ok) return new Response(JSON.stringify({ erro: 'origem não permitida' }), { status: 403, headers: h });

  const auth = req.headers.get('authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: admin, error } = await sb.rpc('is_admin');
  if (error || admin !== true) return new Response(JSON.stringify({ erro: 'acesso negado' }), { status: 403, headers: h });

  const hook = (await ajuste('BUILD_HOOK')) || (await ajuste('NETLIFY_BUILD_HOOK'));
  if (!hook) return new Response(JSON.stringify({ erro: 'BUILD_HOOK não configurado' }), { status: 500, headers: h });
  const r = await fetch(hook, { method: 'POST', body: '{}' });
  if (!r.ok) return new Response(JSON.stringify({ erro: 'A hospedagem respondeu ' + r.status }), { status: 502, headers: h });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: h });
});
