/* Interface das calculadoras: lê o formulário, chama o motor (Calc) e desenha o resultado. */
(function () {
  'use strict';
  var C = window.Calc, CFG = window.CONFIG;

  // menu do celular
  var mb = document.getElementById('menu-btn'), nm = document.getElementById('nav-m');
  if (mb && nm) mb.addEventListener('click', function () {
    var o = nm.classList.toggle('open'); mb.setAttribute('aria-expanded', o);
  });

  var form = document.getElementById('form');
  if (!form) return;
  var tipo = form.getAttribute('data-calc');
  var box = document.getElementById('resultado');
  var corpo = document.getElementById('res-corpo');
  var erro = document.getElementById('erro');
  var leadBox = document.getElementById('lead-box');
  var ultimo = null;

  // data máxima = hoje
  var hoje = new Date();
  var iso = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
  [].forEach.call(form.querySelectorAll('input[type=date]'), function (i) { i.max = iso; });

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- leitura do formulário ---------- */
  function dinheiro(v) {
    if (v == null) return 0;
    v = String(v).replace(/[^\d,.-]/g, '');
    if (!v) return 0;
    if (v.indexOf(',') > -1) v = v.replace(/\./g, '').replace(',', '.');
    else if ((v.match(/\./g) || []).length > 1) v = v.replace(/\./g, '');
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  function ler() {
    var d = {};
    [].forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; }
      else if (el.type === 'checkbox') d[el.name] = el.checked;
      else if (el.getAttribute('data-money')) d[el.name] = dinheiro(el.value);
      else if (el.type === 'number') d[el.name] = el.value === '' ? '' : Number(el.value);
      else d[el.name] = el.value;
    });
    return d;
  }
  function validar() {
    var faltam = [];
    [].forEach.call(form.querySelectorAll('[data-req]'), function (el) {
      var vazio = el.value.trim() === '' || (el.getAttribute('data-money') && dinheiro(el.value) <= 0);
      if (vazio) {
        var lab = form.querySelector('label[for="' + el.id + '"]');
        faltam.push(lab ? lab.textContent.trim() : el.name);
        el.setAttribute('aria-invalid', 'true');
      } else el.removeAttribute('aria-invalid');
    });
    return faltam;
  }

  /* ---------- peças de HTML ---------- */
  function memoria(itens) {
    return '<div class="sub"><h3>A conta aberta</h3><dl class="mem">' +
      itens.map(function (m) { return '<dt>' + esc(m.t) + '</dt><dd>' + esc(m.v) + '</dd>'; }).join('') + '</dl></div>';
  }
  function avisos(lista) {
    if (!lista || !lista.length) return '';
    return '<div class="sub"><h3>Atenção</h3><ul class="avisos">' + lista.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>';
  }
  function topo(kicker, big, cls, texto) {
    return '<div class="res-top"><span class="kicker">' + esc(kicker) + '</span><div class="big ' + (cls || '') + '">' + esc(big) + '</div>' +
      (texto ? '<p>' + esc(texto) + '</p>' : '') + '</div>';
  }

  /* ---------- renderizadores ---------- */
  var R = {};

  R.tempo = function (d) {
    var r = C.tempoContribuicao(d, new Date());
    var txt = r.especialM > 0
      ? 'Ganho de ' + C.anosMeses(r.ganhoM) + ' com a conversão do tempo especial (fator ' + String(r.fator).replace('.', ',') + ').'
      : 'Sem tempo especial informado, o total é só o tempo comum.';
    var extra = '';
    if (r.faltaMinimoM > 0) extra = ' Para o tempo mínimo das transições (' + r.minimoAnos + ' anos) ainda faltam ' + C.anosMeses(r.faltaMinimoM) + '.';
    else extra = ' Você já passa do tempo mínimo das transições (' + r.minimoAnos + ' anos).';
    var html = topo('Tempo total de contribuição', C.anosMeses(r.totalM), '', txt + extra);
    if (r.pontos != null) {
      var ok = r.pontos >= r.pontosExigidos;
      html += '<div class="sub"><h3>Pontuação</h3><div class="pair"><div><small>Sua pontuação hoje</small><b>' +
        (Math.round(r.pontos * 10) / 10).toString().replace('.', ',') + ' pontos</b></div><div><small>Exigência em ' + new Date().getFullYear() + '</small><b>' +
        r.pontosExigidos + ' pontos</b></div></div><p class="hint" style="margin:8px 0 0;color:var(--mute);font-size:14px">' +
        (ok ? 'A pontuação já alcança a exigência do ano. Falta conferir o tempo mínimo de contribuição.' : 'A pontuação ainda não alcança a exigência do ano.') + '</p></div>';
    }
    html += memoria(r.memoria) + avisos(r.avisos);
    return { html: html, resumo: 'Tempo de contribuição total: ' + C.anosMeses(r.totalM) + (r.especialM > 0 ? ' (com conversão de tempo especial)' : '') };
  };

  R.simulador = function (d) {
    var r = C.simulador(d, new Date());
    var topoH, resumo;
    if (r.melhor) {
      var m = r.melhor;
      topoH = m.jaPode
        ? topo('Resultado', 'Você já pode', 'ok', 'Pelos dados informados você já cumpre os requisitos da ' + m.nome.toLowerCase() + '. Confira o CNIS antes de pedir.')
        : topo('Primeira data possível', C.fmtData(m.data), '', 'Pela ' + m.nome.toLowerCase() + ', daqui a ' + C.anosMeses(m.faltaMeses) + ', se continuar contribuindo todo mês.');
      resumo = 'Simulador de aposentadoria: primeira data possível ' + (m.jaPode ? 'já' : C.fmtData(m.data)) + ' pela ' + m.nome;
    } else {
      topoH = topo('Resultado', 'Sem data nos próximos 45 anos', 'bad', 'Nenhuma regra foi alcançada com os dados informados.');
      resumo = 'Simulador de aposentadoria: nenhuma regra alcançada';
    }
    var lista = '<div class="sub"><h3>Regras comparadas</h3>';
    var ord = r.regras.slice().sort(function (a, b) {
      var fa = a.faltaMeses == null ? 1e9 : a.faltaMeses, fb = b.faltaMeses == null ? 1e9 : b.faltaMeses;
      return fa - fb;
    });
    ord.forEach(function (x, i) {
      lista += '<div class="regra"><h4>' + esc(x.nome) + (x.data && ord[0].faltaMeses === x.faltaMeses ? '<span class="tag">Chega primeiro</span>' : '') + '</h4>' +
        '<div class="when">' + (x.data ? (x.jaPode ? 'Já alcançada' : C.fmtData(x.data)) : 'Não alcança') + '</div>' +
        '<p>' + esc(x.requisitos) + '.' + (x.obsAno ? ' ' + esc(x.obsAno) : '') + '</p>' +
        '<small>' + esc(x.base) + ' · Valor: ' + esc(x.coef) + '</small></div>';
    });
    lista += '</div>';
    return { html: topoH + lista + memoria(r.memoria) + avisos(r.avisos), resumo: resumo };
  };

  R.valor = function (d) {
    var r = C.valorBeneficio(d);
    var html = topo('Valor mensal estimado', C.brl(r.valor), '', 'Coeficiente de ' + C.pct(r.coeficiente) + ' sobre a média informada.');
    var txt = r.cheio
      ? 'Você já está no coeficiente máximo de 100%, então contribuir mais não aumenta o percentual.'
      : (r.ganhoMensal > 0
        ? 'Contribuindo mais um ano, o coeficiente vai a ' + C.pct(r.proxCoeficiente) + ' e o benefício a ' + C.brl(r.valorProx) + ', ou seja, ' + C.brl(r.ganhoMensal) + ' a mais por mês.'
        : 'Mais um ano de contribuição não muda o valor neste ponto (piso, teto ou tempo ainda abaixo do ponto em que o coeficiente começa a subir).');
    html += '<div class="sub"><h3>E se esperar mais um ano?</h3><div class="pair"><div><small>Hoje</small><b>' + C.brl(r.valor) +
      '</b></div><div><small>Com mais 12 meses</small><b>' + C.brl(r.valorProx) + '</b></div></div><p style="margin:10px 0 0;color:var(--ink-2)">' + esc(txt) + '</p></div>';
    html += memoria(r.memoria) + avisos(r.avisos);
    return { html: html, resumo: 'Valor estimado do benefício: ' + C.brl(r.valor) + ' (coeficiente ' + C.pct(r.coeficiente) + ')' };
  };

  R.bpc = function (d) {
    var r = C.bpc(d);
    var cls = r.situacao === 'dentro' ? 'ok' : (r.situacao === 'ampliado' ? 'warn' : 'bad');
    var texto = {
      dentro: 'A renda por pessoa de ' + C.brl(r.perCapita) + ' fica abaixo do limite de ' + C.brl(r.limite14) + '.',
      ampliado: 'A renda por pessoa de ' + C.brl(r.perCapita) + ' passa de ' + C.brl(r.limite14) + ', mas fica até ' + C.brl(r.limite12) + '. Com gastos de saúde comprovados, o INSS ou a Justiça podem avaliar o direito pelo limite ampliado (Lei 14.176/2021). Não é automático.',
      fora: 'A renda por pessoa de ' + C.brl(r.perCapita) + ' ficou acima dos limites de ' + C.brl(r.limite14) + ' (geral) e ' + C.brl(r.limite12) + ' (ampliado, com gastos de saúde).',
      idade: 'Para o BPC do idoso a idade mínima é de 65 anos.'
    }[r.situacao];
    var html = topo('Renda por pessoa: ' + C.brl(r.perCapita), r.titulo, cls, texto);
    if (r.excluicaoMudou) html += '<div class="sub"><ul class="avisos"><li>Sem excluir o benefício do outro idoso ou pessoa com deficiência, a renda por pessoa seria ' + esc(C.brl(r.perCapitaSimples)) + ' e o pedido pareceria fora do limite. A exclusão do art. 20, §14 é o que muda o resultado, e é a que mais costuma ser esquecida.</li></ul></div>';
    html += memoria(r.memoria) + avisos(r.avisos);
    return { html: html, resumo: 'BPC/LOAS: renda por pessoa ' + C.brl(r.perCapita) + ' (' + r.titulo.toLowerCase() + ')' };
  };

  R.pensao = function (d) {
    var r = C.pensao(d);
    var html = topo('Pensão total estimada por mês', C.brl(r.total), '', 'Cota familiar de ' + C.pct(r.cota) + ' do benefício do falecido.');
    html += '<div class="sub"><h3>Por quanto tempo</h3><div class="pair"><div><small>Duração para o cônjuge ou companheiro</small><b>' +
      (r.quatroMeses ? '4 meses' : (r.vitalicia ? 'Vitalícia' : r.anos + ' anos')) + '</b></div><div><small>Por dependente (divisão igual)</small><b>' + C.brl(r.porDependente) + '</b></div></div>' +
      '<p style="margin:10px 0 0;color:var(--ink-2)">' + esc(r.duracaoTxt) + '.</p></div>';
    html += memoria(r.memoria) + avisos(r.avisos);
    return { html: html, resumo: 'Pensão por morte: ' + C.brl(r.total) + ' por mês, duração ' + (r.quatroMeses ? '4 meses' : (r.vitalicia ? 'vitalícia' : r.anos + ' anos')) };
  };

  R.auxilio = function (d) {
    var r = C.auxilioDoenca(d);
    var sub = r.limiteAplicado
      ? 'Os 91% da média dariam ' + C.brl(r.noventaUm) + ', mas o limite dos últimos 12 salários reduziu o valor em ' + C.brl(r.perdaPorLimite) + '.'
      : '91% da média informada, sem corte pelo limite dos 12 últimos salários.';
    var html = topo('Valor mensal estimado', C.brl(r.valor), '', sub);
    if (!r.carenciaOk) html += '<div class="sub"><ul class="avisos"><li>Atenção: com menos de 12 contribuições, e sem acidente ou doença grave que dispense a carência, o INSS tende a negar o benefício.</li></ul></div>';
    html += memoria(r.memoria) + avisos(r.avisos);
    return { html: html, resumo: 'Auxílio-doença: ' + C.brl(r.valor) + ' por mês (estimativa)' };
  };

  /* ---------- eventos ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var faltam = validar();
    if (faltam.length) {
      erro.textContent = 'Preencha: ' + faltam.join(', ') + '.';
      erro.classList.add('on');
      return;
    }
    erro.classList.remove('on');
    var dados = ler();
    var res;
    try { res = R[tipo](dados); }
    catch (err) {
      erro.textContent = 'Não consegui calcular com esses dados. Confira os campos e tente de novo.';
      erro.classList.add('on');
      if (window.console) console.error(err);
      return;
    }
    corpo.innerHTML = res.html;
    box.classList.add('on');
    leadBox.classList.add('on');
    ultimo = { calculadora: tipo, entradas: dados, resumo: res.resumo };
    if (window.BPTrack) BPTrack.enviar('calculo', { calculadora: tipo, resumo: res.resumo });
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    box.focus({ preventScroll: true });
  });

  form.addEventListener('reset', function () {
    box.classList.remove('on'); leadBox.classList.remove('on'); erro.classList.remove('on'); corpo.innerHTML = ''; ultimo = null;
  });

  var imp = document.getElementById('imprimir');
  if (imp) imp.addEventListener('click', function () { window.print(); });

  /* ---------- lead ---------- */
  var lf = document.getElementById('lead-form');
  if (lf) lf.addEventListener('submit', function (e) {
    e.preventDefault();
    var le = document.getElementById('lead-erro');
    var nome = lf.elements.nome.value.trim();
    var zap = lf.elements.whatsapp.value.replace(/\D/g, '');
    if (nome.length < 2) { le.textContent = 'Informe seu nome.'; le.classList.add('on'); return; }
    if (zap.length < 10 || zap.length > 13) { le.textContent = 'Informe um WhatsApp com DDD.'; le.classList.add('on'); return; }
    if (!lf.elements.consent.checked) { le.textContent = 'Marque a autorização para continuar.'; le.classList.add('on'); return; }
    le.classList.remove('on');

    var msg = CFG.mensagemWhatsapp + '\n\nNome: ' + nome + (ultimo ? '\n' + ultimo.resumo : '');
    var url = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(msg);
    var w = window.open(url, '_blank', 'noopener');

    if (window.BPTrack) BPTrack.enviar('lead', {
      nome: nome, whatsapp: zap, consentimento: true, site: lf.elements.site ? lf.elements.site.value : '',
      calculadora: ultimo && ultimo.calculadora, entradas: ultimo && ultimo.entradas, resumo: ultimo && ultimo.resumo
    });
    var ok = document.getElementById('lead-ok'), link = document.getElementById('lead-link');
    link.href = url; ok.style.display = 'block';
    if (w) w.opener = null;
  });
})();
