/* Estatísticas anônimas e envio de leads para a função "registrar" do Supabase.
   Sem cookies: a sessão vive só enquanto a aba estiver aberta (sessionStorage). */
(function () {
  var CFG = window.CONFIG || {};
  var URL_API = CFG.registrarUrl;
  var UA = navigator.userAgent || '';
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  // Não conta robôs, ferramentas automáticas nem o próprio advogado (marcado ao entrar no painel)
  var robo = navigator.webdriver || /bot|crawl|spider|slurp|bing|yandex|baidu|duckduck|facebookexternalhit|whatsapp\/|telegrambot|preview|lighthouse|headless|pingdom|uptime/i.test(UA);
  var ignorar = robo || ls('bp_admin') === '1';

  var sessao = ss('bp_s');
  if (!sessao) { sessao = Math.random().toString(36).slice(2) + Date.now().toString(36); ss('bp_s', sessao); }

  // Origem: UTM (mais confiável) > site de onde veio > app de onde abriu > direto
  var q = new URLSearchParams(location.search), utm = null;
  ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (k) { var v = q.get('utm_' + k); if (v) { utm = utm || {}; utm[k] = v.toLowerCase().slice(0, 80); } });
  if (utm) ss('bp_utm', JSON.stringify(utm)); else { try { utm = JSON.parse(ss('bp_utm') || 'null'); } catch (e) { utm = null; } }
  function nomeOrigem(h) {
    h = h.replace(/^(www|m|l|lm|mobile)\./, '');
    if (/(^|\.)google\./.test(h)) return 'google';
    if (/instagram\.com$/.test(h)) return 'instagram';
    if (/(facebook\.com|fb\.com|fb\.me)$/.test(h)) return 'facebook';
    if (/(whatsapp\.com|wa\.me)$/.test(h)) return 'whatsapp';
    if (/(^|\.)bing\.com$/.test(h)) return 'bing';
    if (/(t\.co|twitter\.com|x\.com)$/.test(h)) return 'x';
    if (/youtube\.com$|youtu\.be$/.test(h)) return 'youtube';
    if (/linkedin\.com$|lnkd\.in$/.test(h)) return 'linkedin';
    return h;
  }
  var ref = '';
  try { if (document.referrer) { var h = new URL(document.referrer).hostname; if (h.replace(/^www\./, '') !== location.hostname.replace(/^www\./, '')) ref = nomeOrigem(h); } } catch (e) { }
  if (!ref && /Instagram/i.test(UA)) ref = 'instagram';
  if (!ref && /FBAN|FBAV|FB_IAB/i.test(UA)) ref = 'facebook';
  if (ref) ss('bp_ref', ref); else ref = ss('bp_ref') || '';

  var disp = /Mobi|Android|iPhone|iPod|iPad|Windows Phone/i.test(UA) ? 'celular' : 'computador';
  // Mesmo endereço com ou sem ".html" conta como a mesma página
  var pagina = (location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/');

  function enviar(tipo, dados) {
    if (!URL_API || (ignorar && tipo !== 'lead')) return;
    var corpo = { tipo: tipo, pagina: pagina, referencia: ref, utm: utm, dispositivo: disp, sessao: sessao };
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
