/* Estatísticas anônimas e envio de leads para a função "registrar" do Supabase.
   Sem cookies: a sessão vive só enquanto a aba estiver aberta (sessionStorage). */
(function () {
  var CFG = window.CONFIG || {};
  var URL_API = CFG.registrarUrl;
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var sessao = ss('bp_s');
  if (!sessao) { sessao = Math.random().toString(36).slice(2) + Date.now().toString(36); ss('bp_s', sessao); }
  var q = new URLSearchParams(location.search), utm = null;
  ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (k) { var v = q.get('utm_' + k); if (v) { utm = utm || {}; utm[k] = v; } });
  if (utm) ss('bp_utm', JSON.stringify(utm)); else { try { utm = JSON.parse(ss('bp_utm') || 'null'); } catch (e) { utm = null; } }
  var ref = '';
  try { if (document.referrer) { var h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h !== location.hostname.replace(/^www\./, '')) ref = h; } } catch (e) { }
  if (ref) ss('bp_ref', ref); else ref = ss('bp_ref') || '';
  var disp = window.matchMedia && matchMedia('(max-width: 760px)').matches ? 'celular' : 'computador';

  function enviar(tipo, dados) {
    if (!URL_API) return;
    var corpo = { tipo: tipo, pagina: location.pathname, referencia: ref, utm: utm, dispositivo: disp, sessao: sessao };
    for (var k in dados) corpo[k] = dados[k];
    var json = JSON.stringify(corpo);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(URL_API, new Blob([json], { type: 'text/plain' }))) return;
    } catch (e) { }
    try { fetch(URL_API, { method: 'POST', body: json, keepalive: true, mode: 'no-cors' }).catch(function () { }); } catch (e) { }
  }
  window.BPTrack = { enviar: enviar };

  enviar('visita', {});
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="wa.me"]');
    if (a && !a.closest('#lead-form')) enviar('whatsapp', {});
  });
})();
