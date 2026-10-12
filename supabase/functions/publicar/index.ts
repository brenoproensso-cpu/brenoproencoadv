// Edge Function "publicar": dispara a atualização do site no Netlify.
// Só funciona para usuário logado que esteja na tabela admins.
// Segredo necessário: NETLIFY_BUILD_HOOK (URL do build hook do Netlify).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ORIGENS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

function headers(origin: string | null) {
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
  const { ok, h } = headers(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: h });
  if (req.method !== 'POST' || !ok) return new Response(JSON.stringify({ erro: 'origem não permitida' }), { status: 403, headers: h });

  const auth = req.headers.get('authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: admin, error } = await sb.rpc('is_admin');
  if (error || admin !== true) return new Response(JSON.stringify({ erro: 'acesso negado' }), { status: 403, headers: h });

  const hook = Deno.env.get('NETLIFY_BUILD_HOOK');
  if (!hook) return new Response(JSON.stringify({ erro: 'NETLIFY_BUILD_HOOK não configurado' }), { status: 500, headers: h });
  const r = await fetch(hook, { method: 'POST', body: '{}' });
  if (!r.ok) return new Response(JSON.stringify({ erro: 'Netlify respondeu ' + r.status }), { status: 502, headers: h });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: h });
});
