/* ============================================================
   MOTOR DE CÁLCULO — funções puras, sem DOM.
   Cada função devolve { ..., memoria: [ {t, v} ] } com a conta aberta.
   ============================================================ */
(function (root, factory) {
  var cfg = (typeof module === 'object' && module.exports) ? require('./config.js') : root.CONFIG;
  if (typeof module === 'object' && module.exports) module.exports = factory(cfg);
  else root.Calc = factory(cfg);
})(typeof self !== 'undefined' ? self : this, function (CFG) {
  'use strict';

  var SM = CFG.salarioMinimo, TETO = CFG.teto;
  var DATA_REFORMA = new Date(2019, 10, 13);

  /* ---------- utilidades ---------- */
  function brl(n) {
    return 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(n) { return (Math.round(n * 100) / 100).toString().replace('.', ',') + '%'; }
  function anosMeses(totalMeses) {
    totalMeses = Math.round(totalMeses);
    var a = Math.floor(totalMeses / 12), m = totalMeses % 12;
    var partes = [];
    if (a > 0) partes.push(a + (a === 1 ? ' ano' : ' anos'));
    if (m > 0 || a === 0) partes.push(m + (m === 1 ? ' mês' : ' meses'));
    return partes.join(' e ');
  }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function diasNoMes(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function addMeses(d, n) {
    var y = d.getFullYear(), m = d.getMonth() + n;
    var dia = Math.min(d.getDate(), diasNoMes(y + Math.floor(m / 12), ((m % 12) + 12) % 12));
    return new Date(y, m, dia);
  }
  function idadeEmMeses(nasc, d) {
    var m = (d.getFullYear() - nasc.getFullYear()) * 12 + (d.getMonth() - nasc.getMonth());
    if (d.getDate() < nasc.getDate()) m -= 1;
    return m;
  }
  function mesesEntre(a, b) { // a <= b
    var m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) m -= 1;
    return m;
  }
  function fmtData(d) {
    var m = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return m[d.getMonth()] + '/' + d.getFullYear();
  }
  function limitar(v, piso, teto) { return Math.min(Math.max(v, piso), teto); }

  /* ============================================================
     1. TEMPO DE CONTRIBUIÇÃO (com conversão de tempo especial)
     ============================================================ */
  // Decreto 3.048/1999, art. 70: fatores de conversão em comum.
  var FATORES = {
    25: { M: 1.4, F: 1.2 },
    20: { M: 1.5, F: 1.33 },
    15: { M: 2.0, F: 1.8 }
  };

  function tempoContribuicao(inp, hoje) {
    hoje = hoje || new Date();
    var sexo = inp.sexo === 'F' ? 'F' : 'M';
    var grau = FATORES[inp.grau] ? inp.grau : 25;
    var fator = FATORES[grau][sexo];
    var comumM = Math.max(0, num(inp.anosComum)) * 12 + Math.max(0, num(inp.mesesComum));
    var espM = Math.max(0, num(inp.anosEspecial)) * 12 + Math.max(0, num(inp.mesesEspecial));
    var convM = espM * fator;
    var ganhoM = convM - espM;
    var totalM = comumM + convM;
    var minimo = sexo === 'F' ? 30 : 35;

    var memoria = [
      { t: 'Tempo comum informado', v: anosMeses(comumM) },
      { t: 'Tempo especial informado (até 13/11/2019)', v: anosMeses(espM) },
      { t: 'Fator de conversão (atividade de ' + grau + ' anos, ' + (sexo === 'F' ? 'mulher' : 'homem') + ')', v: String(fator).replace('.', ',') },
      { t: 'Tempo especial convertido', v: anosMeses(espM) + ' × ' + String(fator).replace('.', ',') + ' = ' + anosMeses(convM) },
      { t: 'Ganho com a conversão', v: anosMeses(ganhoM) },
      { t: 'Total de contribuição', v: anosMeses(comumM) + ' + ' + anosMeses(convM) + ' = ' + anosMeses(totalM) }
    ];

    var out = {
      sexo: sexo, fator: fator, comumM: comumM, especialM: espM, convertidoM: convM,
      ganhoM: ganhoM, totalM: totalM, minimoAnos: minimo,
      faltaMinimoM: Math.max(0, minimo * 12 - totalM), memoria: memoria, avisos: []
    };

    if (inp.nascimento) {
      var nasc = new Date(inp.nascimento + 'T12:00:00');
      if (!isNaN(nasc)) {
        var idadeM = idadeEmMeses(nasc, hoje);
        var pontos = (idadeM + totalM) / 12;
        out.idadeM = idadeM;
        out.pontos = pontos;
        out.pontosExigidos = pontosExigidos(sexo, hoje.getFullYear());
        out.memoria.push({ t: 'Idade hoje', v: anosMeses(idadeM) });
        out.memoria.push({ t: 'Pontuação (idade + contribuição)', v: (Math.round(pontos * 100) / 100).toString().replace('.', ',') + ' pontos' });
        out.memoria.push({ t: 'Exigência da regra de pontos em ' + hoje.getFullYear(), v: out.pontosExigidos + ' pontos e ' + minimo + ' anos de contribuição' });
      }
    }
    if (espM > 0) out.avisos.push('O tempo especial só é reconhecido com PPP e LTCAT adequados. Períodos depois de 13/11/2019 não podem ser convertidos (EC 103/2019, art. 25, §2º).');
    return out;
  }

  function pontosExigidos(sexo, ano) {
    var base = sexo === 'F' ? 86 : 96, teto = sexo === 'F' ? 100 : 105;
    return Math.min(teto, base + Math.max(0, ano - 2019));
  }
  function idadeProgressivaExigida(sexo, ano) { // em anos (decimal)
    var base = sexo === 'F' ? 56 : 61, teto = sexo === 'F' ? 62 : 65;
    return Math.min(teto, base + 0.5 * Math.max(0, ano - 2019));
  }

  /* ============================================================
     2. SIMULADOR DE APOSENTADORIA (regra permanente + 4 transições)
     Projeta mês a mês assumindo contribuição contínua a partir de hoje.
     ============================================================ */
  function simulador(inp, hoje) {
    hoje = hoje || new Date();
    var sexo = inp.sexo === 'F' ? 'F' : 'M';
    var nasc = new Date(inp.nascimento + 'T12:00:00');
    var tempoM = Math.max(0, num(inp.anos)) * 12 + Math.max(0, num(inp.meses));
    var jaContribuia = !!inp.jaContribuiaAntes;
    var minTempo = sexo === 'F' ? 30 : 35;
    var idadeHojeM = idadeEmMeses(nasc, hoje);

    // tempo que a pessoa tinha em 13/11/2019 (assume contribuição contínua)
    var mesesDesdeReforma = Math.max(0, mesesEntre(DATA_REFORMA, hoje));
    var tempoNaReformaM = jaContribuia ? Math.max(0, tempoM - mesesDesdeReforma) : 0;
    var faltavaM = Math.max(0, minTempo * 12 - tempoNaReformaM);

    var regras = [];

    regras.push({
      id: 'permanente', nome: 'Regra permanente',
      base: 'EC 103/2019, art. 19',
      requisitos: (sexo === 'F' ? '62 anos de idade' : '65 anos de idade') + ' e ' + (sexo === 'F' || jaContribuia ? '15' : '20') + ' anos de contribuição',
      teste: function (ageM, tM) {
        var idade = sexo === 'F' ? 62 : 65;
        var carencia = (sexo === 'F' || jaContribuia) ? 15 : 20;
        return ageM >= idade * 12 && tM >= carencia * 12;
      },
      coef: '60% da média + 2% por ano que passar de ' + (sexo === 'F' ? '15' : '20') + ' anos de contribuição'
    });

    if (jaContribuia) {
      regras.push({
        id: 'pontos', nome: 'Transição por pontos',
        base: 'EC 103/2019, art. 15',
        requisitos: minTempo + ' anos de contribuição e pontuação (idade + tempo) que sobe 1 ponto por ano',
        teste: function (ageM, tM, d) {
          return tM >= minTempo * 12 && (ageM + tM) / 12 >= pontosExigidos(sexo, d.getFullYear());
        },
        extra: function (d) { return 'Em ' + d.getFullYear() + ' a exigência é de ' + pontosExigidos(sexo, d.getFullYear()) + ' pontos.'; },
        coef: '60% da média + 2% por ano que passar de ' + (sexo === 'F' ? '15' : '20') + ' anos de contribuição'
      });
      regras.push({
        id: 'idade', nome: 'Transição por idade progressiva',
        base: 'EC 103/2019, art. 16',
        requisitos: minTempo + ' anos de contribuição e idade mínima que sobe 6 meses por ano (parte de ' + (sexo === 'F' ? '56' : '61') + ' em 2019)',
        teste: function (ageM, tM, d) {
          return tM >= minTempo * 12 && ageM >= Math.round(idadeProgressivaExigida(sexo, d.getFullYear()) * 12);
        },
        extra: function (d) { return 'Em ' + d.getFullYear() + ' a idade exigida é de ' + anosMeses(Math.round(idadeProgressivaExigida(sexo, d.getFullYear()) * 12)) + '.'; },
        coef: '60% da média + 2% por ano que passar de ' + (sexo === 'F' ? '15' : '20') + ' anos de contribuição'
      });

      if (faltavaM <= 24) {
        var t50 = minTempo * 12 + 0.5 * faltavaM;
        regras.push({
          id: 'pedagio50', nome: 'Pedágio de 50%',
          base: 'EC 103/2019, art. 17',
          requisitos: 'Faltavam até 2 anos para os ' + minTempo + ' anos em 13/11/2019; exige o tempo que faltava + 50% (total de ' + anosMeses(t50) + ')',
          teste: function (ageM, tM) { return tM >= t50; },
          coef: 'Média de todos os salários com fator previdenciário (pode reduzir o valor)'
        });
      }
      var t100 = minTempo * 12 + faltavaM;
      regras.push({
        id: 'pedagio100', nome: 'Pedágio de 100%',
        base: 'EC 103/2019, art. 20',
        requisitos: (sexo === 'F' ? '57' : '60') + ' anos de idade e o tempo que faltava em 13/11/2019 em dobro (total de ' + anosMeses(t100) + ')',
        teste: function (ageM, tM) { return ageM >= (sexo === 'F' ? 57 : 60) * 12 && tM >= t100; },
        coef: '100% da média de todos os salários'
      });
    }

    // projeção mês a mês (até 45 anos à frente)
    regras.forEach(function (r) {
      r.data = null; r.faltaMeses = null; r.jaPode = false;
      // passo diário: a data sai exata (o aniversário e o mês de contribuição contam no dia certo)
      for (var i = 0; i <= 366 * 45; i++) {
        var d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
        var ageM = idadeEmMeses(nasc, d);
        var tM = tempoM + mesesEntre(hoje, d);
        if (r.teste(ageM, tM, d)) {
          r.data = d; r.faltaMeses = mesesEntre(hoje, d); r.jaPode = i === 0;
          r.idadeNaData = ageM; r.tempoNaData = tM;
          if (r.extra) r.obsAno = r.extra(d);
          break;
        }
      }
    });

    var possiveis = regras.filter(function (r) { return r.data; })
      .sort(function (a, b) { return a.faltaMeses - b.faltaMeses; });
    var melhor = possiveis[0] || null;

    var memoria = [
      { t: 'Idade hoje', v: anosMeses(idadeHojeM) },
      { t: 'Tempo de contribuição hoje', v: anosMeses(tempoM) },
      { t: 'Pontuação hoje', v: (Math.round((idadeHojeM + tempoM) / 12 * 100) / 100).toString().replace('.', ',') + ' pontos' }
    ];
    if (jaContribuia) {
      memoria.push({ t: 'Tempo estimado em 13/11/2019 (contribuição contínua)', v: anosMeses(tempoNaReformaM) });
      memoria.push({ t: 'Faltava para ' + minTempo + ' anos naquela data', v: anosMeses(faltavaM) });
    }
    memoria.push({ t: 'Projeção', v: 'Mês a mês, com contribuição contínua a partir de hoje' });

    return {
      sexo: sexo, idadeHojeM: idadeHojeM, tempoM: tempoM, jaContribuia: jaContribuia,
      regras: regras, ordenadas: possiveis, melhor: melhor, memoria: memoria,
      avisos: [
        'A projeção assume que você continua contribuindo todos os meses. Pare de contribuir e as datas se afastam.',
        jaContribuia ? 'O tempo em 13/11/2019 foi estimado supondo contribuição sem interrupção desde então; no seu CNIS o número real pode ser diferente e isso muda os pedágios.' : ''
      ].filter(Boolean)
    };
  }

  /* ============================================================
     3. VALOR DO BENEFÍCIO (aposentadoria)
     ============================================================ */
  function coeficiente(sexo, tempoM, acidente) {
    if (acidente) return { c: 100, base: 'Incapacidade permanente por acidente de trabalho: 100% da média', anosExc: 0 };
    var corte = sexo === 'F' ? 15 : 20;
    var anosCompletos = Math.floor(tempoM / 12);
    var exc = Math.max(0, anosCompletos - corte);
    return { c: Math.min(100, 60 + 2 * exc), base: '60% + 2% × ' + exc + ' ano(s) acima de ' + corte, anosExc: exc };
  }

  function valorBeneficio(inp) {
    var sexo = inp.sexo === 'F' ? 'F' : 'M';
    var media = Math.max(0, num(inp.media));
    var tempoM = Math.max(0, num(inp.anos)) * 12 + Math.max(0, num(inp.meses));
    var acidente = !!inp.acidente;
    var k = coeficiente(sexo, tempoM, acidente);
    var bruto = media * k.c / 100;
    var final = limitar(bruto, SM, TETO);
    var proximo = coeficiente(sexo, tempoM + 12, acidente);
    var brutoProx = media * proximo.c / 100;
    var finalProx = limitar(brutoProx, SM, TETO);

    var memoria = [
      { t: 'Média dos salários (informada)', v: brl(media) },
      { t: 'Tempo de contribuição', v: anosMeses(tempoM) },
      { t: 'Coeficiente', v: k.base + ' = ' + pct(k.c) },
      { t: 'Valor pelo coeficiente', v: brl(media) + ' × ' + pct(k.c) + ' = ' + brl(bruto) },
      { t: 'Piso (salário mínimo ' + CFG.ano + ')', v: brl(SM) },
      { t: 'Teto do INSS ' + CFG.ano, v: brl(TETO) },
      { t: 'Valor estimado', v: brl(final) }
    ];
    var avisos = [];
    var minimo = sexo === 'F' ? 15 : 20;
    if (!acidente && tempoM < minimo * 12) avisos.push('Com menos de ' + minimo + ' anos de contribuição você ainda não teria o tempo mínimo da regra permanente.');
    if (bruto < SM) avisos.push('O resultado ficou abaixo do salário mínimo, então vale o piso.');
    if (bruto > TETO) avisos.push('O resultado passou do teto do INSS, então vale o teto.');

    return {
      coeficiente: k.c, bruto: bruto, valor: final, proxCoeficiente: proximo.c, valorProx: finalProx,
      ganhoMensal: finalProx - final, cheio: k.c >= 100, memoria: memoria, avisos: avisos
    };
  }

  /* ============================================================
     4. BPC / LOAS
     ============================================================ */
  function bpc(inp) {
    var tipo = inp.tipo === 'pcd' ? 'pcd' : 'idoso';
    var idade = Math.max(0, num(inp.idade));
    var pessoas = Math.max(1, Math.floor(num(inp.pessoas)));
    var renda = Math.max(0, num(inp.renda));
    var outroBen = Math.max(0, num(inp.outroBeneficio));
    var gastos = Math.max(0, num(inp.gastos));
    var limite14 = SM / 4, limite12 = SM / 2;

    var excluido = (outroBen > 0 && outroBen <= SM) ? outroBen : 0;
    var rendaLiquida = Math.max(0, renda - excluido);
    var perCapitaSimples = renda / pessoas;
    var perCapita = rendaLiquida / pessoas;

    var avisos = [];
    var idadeOk = tipo === 'pcd' ? true : idade >= 65;
    if (tipo === 'idoso' && idade < 65) avisos.push('Para o BPC do idoso a idade mínima é 65 anos. Se houver deficiência de longo prazo, o pedido pode ser pelo BPC da pessoa com deficiência.');
    if (outroBen > SM) avisos.push('O outro benefício informado é maior que um salário mínimo, por isso não foi excluído da conta.');
    if (!inp.cadunico) avisos.push('O INSS exige o CadÚnico feito e atualizado. Sem ele o pedido costuma ser negado, mesmo com a renda dentro do limite.');
    if (tipo === 'pcd') avisos.push('Para a pessoa com deficiência há ainda a avaliação médica e social do INSS, que não é calculada aqui.');

    var situacao, titulo;
    if (!idadeOk) { situacao = 'idade'; titulo = 'Idade abaixo de 65 anos'; }
    else if (perCapita < limite14) { situacao = 'dentro'; titulo = 'Renda dentro do limite'; }
    else if (perCapita <= limite12 && gastos > 0) { situacao = 'ampliado'; titulo = 'Dentro do limite ampliado, com gastos de saúde'; }
    else { situacao = 'fora'; titulo = 'Renda acima do limite'; }

    var memoria = [
      { t: 'Renda total da casa', v: brl(renda) },
      { t: 'Benefício de outro idoso/pessoa com deficiência excluído (art. 20, §14)', v: brl(excluido) },
      { t: 'Renda considerada', v: brl(renda) + ' − ' + brl(excluido) + ' = ' + brl(rendaLiquida) },
      { t: 'Pessoas no grupo familiar', v: String(pessoas) },
      { t: 'Renda por pessoa', v: brl(rendaLiquida) + ' ÷ ' + pessoas + ' = ' + brl(perCapita) },
      { t: 'Renda por pessoa sem a exclusão', v: brl(perCapitaSimples) },
      { t: 'Limite geral (1/4 do salário mínimo)', v: brl(limite14) },
      { t: 'Limite ampliado (1/2 salário mínimo, Lei 14.176/2021)', v: brl(limite12) }
    ];
    if (gastos > 0) memoria.push({ t: 'Gastos mensais com saúde e deficiência', v: brl(gastos) + ' (' + pct(renda > 0 ? gastos / renda * 100 : 0) + ' da renda)' });

    return {
      situacao: situacao, titulo: titulo, perCapita: perCapita, perCapitaSimples: perCapitaSimples,
      excluido: excluido, limite14: limite14, limite12: limite12, beneficio: SM,
      memoria: memoria, avisos: avisos,
      excluicaoMudou: excluido > 0 && (perCapitaSimples >= limite14) && (perCapita < limite14)
    };
  }

  /* ============================================================
     5. PENSÃO POR MORTE
     ============================================================ */
  function duracaoPensao(idade) {
    var f = CFG.pensaoFaixas;
    for (var i = 0; i < f.length; i++) if (idade <= f[i].ate) return f[i].anos;
    return null; // vitalícia
  }

  function pensao(inp) {
    var base = Math.max(0, num(inp.base));
    var n = Math.max(1, Math.floor(num(inp.dependentes)));
    var invalido = !!inp.invalido;
    var idade = Math.max(0, num(inp.idadeConjuge));
    var carencia = !!inp.carencia18, uniao = !!inp.uniao2anos, acidente = !!inp.acidente;

    var cota = invalido ? 100 : Math.min(100, 50 + 10 * n);
    var bruto = base * cota / 100;
    var total = limitar(bruto, SM, TETO);
    var porDep = total / n;

    var cumpre = (carencia && uniao) || acidente;
    var anos = cumpre ? duracaoPensao(idade) : null;
    var meses4 = !cumpre;
    var vitalicia = cumpre && anos === null;

    var memoria = [
      { t: 'Benefício do falecido (base)', v: brl(base) },
      { t: 'Dependentes', v: String(n) + (invalido ? ' (há dependente inválido ou com deficiência grave)' : '') },
      { t: 'Cota familiar', v: invalido ? '100% (dependente inválido ou com deficiência)' : '50% + 10% × ' + n + ' = ' + pct(cota) },
      { t: 'Valor pela cota', v: brl(base) + ' × ' + pct(cota) + ' = ' + brl(bruto) },
      { t: 'Piso e teto', v: brl(SM) + ' a ' + brl(TETO) },
      { t: 'Pensão total estimada', v: brl(total) }
    ];
    if (n > 1) memoria.push({ t: 'Divisão igual entre os dependentes', v: brl(total) + ' ÷ ' + n + ' = ' + brl(porDep) + ' cada' });

    var duracaoTxt;
    if (meses4) duracaoTxt = '4 meses (faltam 18 contribuições do segurado ou 2 anos de casamento/união, e a morte não foi por acidente)';
    else if (vitalicia) duracaoTxt = 'Vitalícia (cônjuge com ' + idade + ' anos na data do óbito)';
    else duracaoTxt = anos + ' anos (cônjuge com ' + idade + ' anos na data do óbito)';
    memoria.push({ t: 'Duração da pensão do cônjuge', v: duracaoTxt });

    var avisos = ['A duração vale para o cônjuge ou companheiro. Filhos recebem até 21 anos (ou enquanto inválidos) e a cota deles é redistribuída quando saem.'];
    if (bruto < SM) avisos.push('Pela cota o valor ficaria abaixo do salário mínimo, então vale o piso quando a pensão é a única renda do dependente.');
    avisos.push('Prazo para pedir: até 90 dias do óbito (180 dias se o dependente tem menos de 16 anos) para receber desde a morte.');

    return {
      cota: cota, total: total, porDependente: porDep, anos: anos, vitalicia: vitalicia, quatroMeses: meses4,
      duracaoTxt: duracaoTxt, memoria: memoria, avisos: avisos
    };
  }

  /* ============================================================
     6. AUXÍLIO-DOENÇA (incapacidade temporária)
     ============================================================ */
  function auxilioDoenca(inp) {
    var media = Math.max(0, num(inp.media));
    var media12 = Math.max(0, num(inp.media12));
    var carencia = Math.max(0, Math.floor(num(inp.contribuicoes)));
    var acidentario = !!inp.acidentario;
    var dispensa = acidentario || !!inp.dispensaCarencia;
    var tipo = inp.tipo || 'empregado';

    var noventaUm = media * 0.91;
    var limiteAplicado = media12 > 0 && noventaUm > media12;
    var apos = limiteAplicado ? media12 : noventaUm;
    var valor = limitar(apos, SM, TETO);

    var memoria = [
      { t: 'Média dos salários desde 07/1994 (informada)', v: brl(media) },
      { t: '91% da média', v: brl(media) + ' × 91% = ' + brl(noventaUm) }
    ];
    if (media12 > 0) {
      memoria.push({ t: 'Média dos últimos 12 salários (limite do art. 29, §10)', v: brl(media12) });
      memoria.push({ t: 'Limite aplicado?', v: limiteAplicado ? 'Sim, o valor foi reduzido para ' + brl(media12) : 'Não, 91% da média ficou abaixo do limite' });
    } else {
      memoria.push({ t: 'Limite dos últimos 12 salários', v: 'Não informado, não aplicado' });
    }
    memoria.push({ t: 'Piso e teto ' + CFG.ano, v: brl(SM) + ' a ' + brl(TETO) });
    memoria.push({ t: 'Valor mensal estimado', v: brl(valor) });

    var avisos = [];
    var carenciaOk = dispensa || carencia >= 12;
    if (!carenciaOk) avisos.push('Com menos de 12 contribuições o INSS exige carência, a não ser que a incapacidade venha de acidente ou de doença grave da lista legal.');
    if (tipo === 'graca') avisos.push('Sem contribuir, você só mantém a qualidade de segurado por um prazo (em regra 12 meses depois da última contribuição, podendo chegar a 24 ou 36).');
    if (tipo === 'empregado') avisos.push('Como empregado, os 15 primeiros dias de afastamento são pagos pela empresa. O INSS paga a partir do 16º dia.');
    else avisos.push('Neste tipo de segurado o INSS paga desde o início da incapacidade, desde que o pedido seja feito em até 30 dias do afastamento.');
    if (acidentario) avisos.push('No benefício acidentário (B91) há estabilidade de 12 meses no emprego depois da alta (Lei 8.213/91, art. 118).');

    return {
      valor: valor, noventaUm: noventaUm, limiteAplicado: limiteAplicado, perdaPorLimite: limiteAplicado ? noventaUm - media12 : 0,
      carenciaOk: carenciaOk, memoria: memoria, avisos: avisos
    };
  }

  return {
    brl: brl, pct: pct, anosMeses: anosMeses, fmtData: fmtData,
    tempoContribuicao: tempoContribuicao, simulador: simulador, valorBeneficio: valorBeneficio,
    bpc: bpc, pensao: pensao, auxilioDoenca: auxilioDoenca,
    _util: { pontosExigidos: pontosExigidos, idadeProgressivaExigida: idadeProgressivaExigida, addMeses: addMeses, idadeEmMeses: idadeEmMeses }
  };
});
