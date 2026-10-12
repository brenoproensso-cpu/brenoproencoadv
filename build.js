/* Gera as páginas estáticas. Uso: node build.js
   Edite textos, FAQs e campos aqui; valores e marca ficam em assets/config.js */
const fs = require('fs');
const path = require('path');
const CFG = require('./assets/config.js');
const matter = require('gray-matter');
const { marked } = require('marked');
const CALC_NOMES = { 'tempo-de-contribuicao': 'Calculadora de tempo de contribuição', 'simulador-de-aposentadoria': 'Simulador de aposentadoria', 'valor-do-beneficio': 'Calculadora do valor do benefício', 'bpc-loas': 'Calculadora de BPC/LOAS', 'pensao-por-morte': 'Calculadora de pensão por morte', 'auxilio-doenca': 'Calculadora de auxílio-doença' };
const brlB = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MARCADORES = { ano: String(CFG.ano), salario_minimo: brlB(CFG.salarioMinimo), teto: brlB(CFG.teto), bpc_limite: brlB(CFG.salarioMinimo / 4), bpc_limite_meio: brlB(CFG.salarioMinimo / 2) };
const troca = s => String(s || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => MARCADORES[k] !== undefined ? MARCADORES[k] : m);
const dataISO = d => d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dataBR = iso => { const [y, m, d] = iso.split('-'); return `${+d} ${MESES[+m - 1]} ${y}`; };
const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Artigos: vêm do Supabase (tabela "artigos", só os publicados).
// Sem Supabase configurado, usa os arquivos .md de conteudo/artigos (modo offline).
const DIR_ART = path.join(__dirname, 'conteudo', 'artigos');
function montarArtigo(fm, content, slugBase) {
  if (fm.rascunho || fm.status === 'rascunho') return null;
  const texto = troca(content).replace(/</g, '&lt;');
  const palavras = texto.split(/\s+/).filter(Boolean).length;
  const calc = CALC_NOMES[fm.calculadora] ? fm.calculadora : 'simulador-de-aposentadoria';
  return {
    slug: slugify(slugBase), titulo: troca(fm.titulo), desc: troca(fm.descricao),
    data: dataISO(fm.data), ordem: fm.ordem || 999, min: fm.minutos || Math.max(2, Math.round(palavras / 200)),
    calc, calcTxt: CALC_NOMES[calc], nota: troca(fm.nota), html: marked.parse(texto), imagem: fm.imagem || ''
  };
}
async function carregarArtigos() {
  let lista = null;
  const url = process.env.SUPABASE_URL || CFG.supabaseUrl, key = process.env.SUPABASE_ANON_KEY || CFG.supabaseAnonKey;
  if (url && key && !process.env.ARTIGOS_OFFLINE) {
    const r = await fetch(url.replace(/\/$/, '') + '/rest/v1/artigos?select=slug,titulo,descricao,corpo,calculadora,nota,data,ordem,status&status=eq.publicado', { headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (r.status === 404) {
      console.warn('Tabela de artigos ainda não existe no Supabase; usando os arquivos .md.');
    } else if (!r.ok) {
      throw new Error('Não consegui ler os artigos do Supabase (HTTP ' + r.status + '). O site não foi atualizado.');
    } else {
      const rows = await r.json();
      lista = rows.map(a => montarArtigo(a, a.corpo, a.slug));
      console.log('Artigos do Supabase:', lista.length);
    }
  }
  if (!lista) {
    lista = fs.readdirSync(DIR_ART).filter(f => f.endsWith('.md')).map(f => {
      const { data: fm, content } = matter(fs.readFileSync(path.join(DIR_ART, f), 'utf8'));
      return montarArtigo(fm, content, f.replace(/\.md$/, ''));
    });
    console.log('Artigos dos arquivos .md:', lista.length);
  }
  return lista.filter(Boolean).sort((a, b) => b.data.localeCompare(a.data) || a.ordem - b.ordem);
}
let ARTIGOS = [];

const SM = CFG.salarioMinimo;
const brl = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- helpers de campo ---------- */
const seg = (name, label, opts, def, hint) => `
  <div class="fld full" role="radiogroup" aria-labelledby="l-${name}">
    <span class="lab" id="l-${name}">${label}</span>
    <div class="seg">${opts.map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}"${v === def ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
  </div>`;
const numero = (name, label, o = {}) => `
  <div class="fld${o.full ? ' full' : ''}">
    <label for="${name}">${label}</label>
    <input type="number" id="${name}" name="${name}" inputmode="numeric" min="${o.min ?? 0}"${o.max != null ? ` max="${o.max}"` : ''} step="1" placeholder="${o.ph ?? '0'}"${o.req ? ' required data-req="1"' : ''}${o.val != null ? ` value="${o.val}"` : ''}>
    ${o.hint ? `<p class="hint">${o.hint}</p>` : ''}
  </div>`;
const dinheiro = (name, label, o = {}) => `
  <div class="fld${o.full ? ' full' : ''}">
    <label for="${name}">${label}</label>
    <div class="money"><span>R$</span><input type="text" id="${name}" name="${name}" inputmode="decimal" placeholder="${o.ph ?? '0,00'}" autocomplete="off"${o.req ? ' data-req="1"' : ''} data-money="1"></div>
    ${o.hint ? `<p class="hint">${o.hint}</p>` : ''}
  </div>`;
const data = (name, label, o = {}) => `
  <div class="fld${o.full ? ' full' : ''}">
    <label for="${name}">${label}</label>
    <input type="date" id="${name}" name="${name}"${o.req ? ' data-req="1" required' : ''} max="${new Date().toISOString().slice(0, 10)}" min="1930-01-01">
    ${o.hint ? `<p class="hint">${o.hint}</p>` : ''}
  </div>`;
const marca = (name, titulo, sub) => `
  <label class="chk full" style="grid-column:1/-1"><input type="checkbox" name="${name}" value="1"><span><b>${titulo}</b>${sub ? `<small>${sub}</small>` : ''}</span></label>`;
const selecao = (name, label, opts, o = {}) => `
  <div class="fld${o.full ? ' full' : ''}">
    <label for="${name}">${label}</label>
    <select id="${name}" name="${name}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>
    ${o.hint ? `<p class="hint">${o.hint}</p>` : ''}
  </div>`;
const par = (a, b) => `<div class="fld full"><div class="row2">${a}${b}</div></div>`;

const SEXO = seg('sexo', 'Sexo (o INSS pede regras diferentes para cada um)', [['M', 'Masculino'], ['F', 'Feminino']], 'M');

/* ---------- páginas ---------- */
const PAGES = [
  {
    slug: 'tempo-de-contribuicao', calc: 'tempo', curto: 'Tempo de contribuição',
    titulo: 'Calculadora de tempo de contribuição',
    h1: 'Some todo o seu tempo, inclusive o especial.',
    meta: 'Calcule seu tempo de contribuição e converta o período especial (insalubre ou perigoso) em tempo comum. Veja também a sua pontuação.',
    lead: 'Informe o tempo comum e o tempo trabalhado em condições especiais. A calculadora converte o período especial anterior à reforma e mostra o total corrigido e a pontuação.',
    rapida: 'O tempo especial vira tempo comum multiplicando por um fator: 1,4 para homem e 1,2 para mulher nas atividades que dão aposentadoria especial aos 25 anos. Atividades de 20 e de 15 anos têm fatores maiores. Só se converte o período trabalhado até 13/11/2019, e cada período precisa de PPP e LTCAT para ser reconhecido.',
    campos: SEXO +
      par(numero('anosComum', 'Anos de trabalho comum', { req: true }), numero('mesesComum', 'Meses a mais', { max: 11, hint: 'Além dos anos inteiros.' })) +
      selecao('grau', 'Tempo da aposentadoria especial da sua atividade', [['25', '25 anos (a maioria: ruído, químicos, vigilante, enfermagem)'], ['20', '20 anos (ex.: mineração subterrânea em afloramento)'], ['15', '15 anos (ex.: mineração subterrânea em frente de produção)']], { full: true, hint: 'Na dúvida, deixe 25 anos. É o caso mais comum e o de menor fator.' }) +
      par(numero('anosEspecial', 'Anos em atividade especial (até 13/11/2019)'), numero('mesesEspecial', 'Meses a mais', { max: 11 })) +
      data('nascimento', 'Data de nascimento (opcional)', { full: true, hint: 'Serve para calcular a sua pontuação (idade + tempo de contribuição).' }),
    legal: [
      ['Lei 8.213/1991, art. 57', 'Aposentadoria especial: 15, 20 ou 25 anos de exposição a agente nocivo.'],
      ['Decreto 3.048/1999, art. 70', 'Tabela com os fatores de conversão de tempo especial em comum.'],
      ['EC 103/2019, art. 25, §2º', 'Veda a conversão do tempo especial exercido depois de 13/11/2019.'],
      ['EC 103/2019, art. 15', 'Regra de transição por pontos, que usa a soma de idade e tempo.']
    ],
    faq: [
      ['O que é a conversão do tempo especial?', 'É transformar o período trabalhado exposto a agente nocivo em tempo comum equivalente, multiplicando por um fator. Para um homem em atividade de 25 anos o fator é 1,4: dez anos de exposição valem catorze de contribuição. Isso ajuda principalmente quem não completou os 25 anos de exposição e, por isso, não alcança a aposentadoria especial, mas pode somar o tempo convertido às regras comuns.'],
      ['Posso converter o tempo trabalhado depois da reforma?', 'Não. A EC 103/2019 proibiu a conversão do tempo especial exercido depois de 13/11/2019. O período anterior a essa data continua conversível. Por isso a calculadora pergunta só o tempo especial até a reforma: colocar período posterior inflaria o resultado.'],
      ['Que documentos provam o tempo especial?', 'O principal é o PPP, emitido pela empresa com base no LTCAT. Ele deve descrever o agente nocivo, a intensidade, a habitualidade e trazer o responsável técnico. PPP incompleto ou genérico costuma levar ao indeferimento. Se a empresa fechou, há caminhos como prova emprestada e perícia judicial.'],
      ['Para que serve a pontuação?', 'A pontuação é a soma da idade com o tempo de contribuição e é o requisito da transição por pontos. Em 2026 a exigência é de 93 pontos para a mulher e 103 para o homem, subindo um ponto por ano até 100 e 105. Além dos pontos é preciso ter 30 anos de contribuição (mulher) ou 35 (homem).']
    ]
  },
  {
    slug: 'simulador-de-aposentadoria', calc: 'simulador', curto: 'Simulador de aposentadoria',
    titulo: 'Simulador de aposentadoria',
    h1: 'Quando você pode se aposentar.',
    meta: 'Simule quando você pode se aposentar pelo INSS. Compara idade, pontos, idade progressiva e pedágios e mostra qual regra chega primeiro.',
    lead: 'Compara a regra permanente e as quatro regras de transição da reforma e mostra qual delas você alcança primeiro, com o que falta em cada uma.',
    rapida: 'Hoje há cinco caminhos: a regra permanente (62 anos mulher, 65 homem) e quatro transições para quem já contribuía em 13/11/2019 (pontos, idade progressiva, pedágio de 50% e pedágio de 100%). Vale a que você alcançar primeiro, mas a que chega antes nem sempre é a que paga mais.',
    campos: data('nascimento', 'Data de nascimento', { req: true, full: true }) + SEXO +
      par(numero('anos', 'Anos de contribuição', { req: true, hint: 'Some o que aparece no CNIS (Meu INSS).' }), numero('meses', 'Meses a mais', { max: 11 })) +
      marca('jaContribuiaAntes', 'Eu já contribuía para o INSS antes de 13/11/2019', 'Só quem contribuía nessa data pode usar as regras de transição.'),
    legal: [
      ['EC 103/2019, art. 19', 'Regra permanente: 62 anos (mulher) e 65 (homem), com 15 anos de contribuição (20 para o homem filiado depois da reforma).'],
      ['EC 103/2019, art. 15', 'Transição por pontos: idade + tempo, com tempo mínimo de 30/35 anos.'],
      ['EC 103/2019, art. 16', 'Transição por idade progressiva: idade mínima sobe 6 meses a cada ano.'],
      ['EC 103/2019, art. 17', 'Pedágio de 50% para quem estava a até 2 anos do tempo mínimo.'],
      ['EC 103/2019, art. 20', 'Pedágio de 100%: idade mínima de 57/60 anos e o dobro do tempo que faltava.']
    ],
    faq: [
      ['Quantas regras existem hoje?', 'A permanente e quatro de transição. As de transição valem só para quem já contribuía em 13/11/2019. Não existe uma regra melhor em abstrato: o que importa é a data em que você cumpre os requisitos e o valor do benefício em cada uma.'],
      ['Como funciona a regra de pontos?', 'Soma idade e tempo de contribuição. Em 2019 exigia 86 pontos da mulher e 96 do homem, com um ponto a mais a cada ano, até 100 (mulher) e 105 (homem). Além disso, exige tempo mínimo de 30 anos (mulher) ou 35 (homem).'],
      ['O tempo especial entra nesta simulação?', 'Não automaticamente. Use primeiro a calculadora de tempo de contribuição para converter o período especial até 13/11/2019 e volte aqui com o total corrigido. A diferença entre simular com e sem o tempo especial costuma ser de vários anos.'],
      ['A data da simulação é garantida?', 'Não. É uma estimativa que supõe contribuição contínua. A data real depende do CNIS completo, de lacunas, de períodos especiais ou rurais não reconhecidos e de erros no cadastro. O tempo que você tinha em 13/11/2019 também foi estimado, e isso afeta os pedágios.']
    ]
  },
  {
    slug: 'valor-do-beneficio', calc: 'valor', curto: 'Valor do benefício',
    titulo: 'Calculadora do valor do benefício',
    h1: 'Quanto o INSS vai pagar.',
    meta: 'Estime o valor da aposentadoria pelo INSS: média salarial, coeficiente de 60% mais 2% por ano e limites de piso e teto.',
    lead: 'Aplica o coeficiente da reforma sobre a sua média e mostra, em reais, quanto rende contribuir mais um ano.',
    rapida: `Desde a reforma, a aposentadoria vale 60% da média de todos os salários desde julho de 1994, mais 2% por ano de contribuição acima de 20 anos (homem) ou 15 anos (mulher). Em 2026 o valor fica entre ${brl(SM)} e ${brl(CFG.teto)}.`,
    campos: dinheiro('media', 'Média dos seus salários de contribuição', { req: true, full: true, hint: 'Um valor aproximado serve. O número exato sai do extrato CNIS, corrigido mês a mês.' }) + SEXO +
      par(numero('anos', 'Anos de contribuição', { req: true }), numero('meses', 'Meses a mais', { max: 11 })) +
      marca('acidente', 'A aposentadoria é por incapacidade causada por acidente de trabalho', 'Nesse caso o coeficiente é de 100% da média.'),
    legal: [
      ['EC 103/2019, art. 26', 'O salário de benefício é a média de todos os salários desde julho de 1994.'],
      ['EC 103/2019, art. 26, §2º', '60% da média, mais 2% por ano que exceder 20 anos (homem) ou 15 anos (mulher).'],
      ['EC 103/2019, art. 26, §3º', 'Incapacidade permanente por acidente de trabalho: 100% da média.'],
      ['CF, art. 201, §2º', 'Nenhum benefício substituto do salário pode ser menor que o salário mínimo.']
    ],
    faq: [
      ['Como se calcula o valor hoje?', 'Em duas etapas. Primeiro, a média de todos os salários de contribuição desde julho de 1994, corrigidos. Antes da reforma descartavam-se os 20% menores salários, o que elevava a média. Depois, aplica-se o coeficiente de 60% mais 2% por ano de contribuição acima de 20 anos (homem) ou 15 anos (mulher). Para chegar a 100% o homem precisa de 40 anos e a mulher de 35.'],
      ['Vale a pena continuar contribuindo?', 'Em geral sim: cada ano a mais soma dois pontos percentuais ao coeficiente, e isso vale pelo resto da vida. Contribuir sobre valores acima da sua média histórica também puxa a média para cima. O ganho acaba quando o coeficiente chega a 100% ou o benefício bate no teto.'],
      ['O valor muda conforme a regra de transição?', 'Pode mudar bastante. O pedágio de 50% aplica o fator previdenciário, que pode reduzir o benefício. O pedágio de 100% paga 100% da média. Pontos e idade progressiva seguem o coeficiente padrão. Por isso a regra que chega primeiro não é necessariamente a que paga melhor.'],
      ['Como conto o tempo para o coeficiente?', 'Esta calculadora conta anos completos de contribuição acima do mínimo. É uma estimativa: o cálculo final depende do CNIS, de períodos especiais convertidos, de tempo rural e de eventuais lacunas.']
    ]
  },
  {
    slug: 'bpc-loas', calc: 'bpc', curto: 'BPC/LOAS',
    titulo: 'Calculadora do BPC/LOAS',
    h1: 'Renda por pessoa e direito ao BPC.',
    meta: 'Calcule a renda por pessoa da sua família e veja se ela fica dentro do limite do BPC/LOAS, aplicando as exclusões previstas em lei.',
    lead: 'Calcula a renda por pessoa da casa com as exclusões que a lei manda aplicar antes de dividir e compara com o limite do BPC.',
    rapida: `O BPC/LOAS paga um salário mínimo (${brl(SM)} em ${CFG.ano}) a quem tem 65 anos ou mais, ou deficiência de longo prazo, e vive em família com renda por pessoa inferior a um quarto do salário mínimo (${brl(SM / 4)}). Antes de dividir, a lei manda excluir o benefício de até um salário mínimo recebido por outro idoso ou pessoa com deficiência da mesma casa. Com gastos comprovados de saúde, o limite pode chegar a meio salário mínimo (${brl(SM / 2)}), analisado caso a caso.`,
    campos: seg('tipo', 'Quem vai pedir o benefício', [['idoso', 'Pessoa com 65 anos ou mais'], ['pcd', 'Pessoa com deficiência (qualquer idade)']], 'idoso') +
      numero('idade', 'Idade de quem vai pedir', { req: true, min: 0, max: 120, hint: 'Em anos.' }) +
      numero('pessoas', 'Quantas pessoas moram na casa', { req: true, min: 1, max: 30, hint: 'Conte só quem a lei considera família: quem pede, cônjuge ou companheiro, pais, padrasto ou madrasta, irmãos solteiros, filhos e enteados solteiros e menores tutelados. Neto, genro, nora, tio e primo não entram.' }) +
      dinheiro('renda', 'Renda total da casa por mês', { req: true, full: true, hint: 'Salários, aposentadorias, pensões, aluguéis e trabalho informal, em valor bruto. Bolsa Família e outros programas assistenciais não entram.' }) +
      dinheiro('outroBeneficio', 'Benefício de outro idoso ou pessoa com deficiência da casa', { full: true, hint: 'Se houver, informe o valor. Benefício de até um salário mínimo é excluído da conta (Lei 8.742/93, art. 20, §14).' }) +
      dinheiro('gastos', 'Gastos mensais com remédio, tratamento e cuidados', { full: true, hint: 'Remédios contínuos, fraldas, dieta especial, cuidador, transporte para tratamento. Podem abrir o limite ampliado de meio salário mínimo.' }) +
      marca('cadunico', 'A família já tem CadÚnico feito e atualizado', 'O INSS exige o CadÚnico para analisar o pedido.'),
    legal: [
      ['CF, art. 203, V', 'Garante um salário mínimo ao idoso e à pessoa com deficiência sem meios de se manter.'],
      ['Lei 8.742/1993, art. 20', 'Requisitos do BPC: idade ou deficiência de longo prazo e renda por pessoa inferior a 1/4 do salário mínimo.'],
      ['Lei 8.742/1993, art. 20, §14', 'Exclui da renda o benefício de até um salário mínimo de outro idoso ou pessoa com deficiência da família.'],
      ['Lei 14.176/2021', 'Permite avaliar renda por pessoa de até 1/2 salário mínimo, considerando gastos com saúde e a situação da família.']
    ],
    faq: [
      ['Qual o limite de renda?', `A regra geral é renda por pessoa inferior a 1/4 do salário mínimo: ${brl(SM / 4)} em ${CFG.ano}. A Lei 14.176/2021 permite chegar a 1/2 salário mínimo (${brl(SM / 2)}) quando a família comprova gastos e vulnerabilidade, mas isso é analisado caso a caso e nem sempre o INSS aplica por conta própria.`],
      ['Quem entra no grupo familiar?', 'Só quem mora na mesma casa: quem pede, cônjuge ou companheiro, pais, padrasto ou madrasta, irmãos solteiros, filhos e enteados solteiros e menores tutelados. Neto, genro, nora, tio e primo não entram, mesmo morando juntos. A composição registrada no CadÚnico precisa estar correta.'],
      ['A aposentadoria de outra pessoa da casa entra na conta?', 'Se for um benefício de até um salário mínimo recebido por outro idoso ou por pessoa com deficiência da casa, ele é excluído. Se for maior que um salário mínimo, ou se quem recebe não for idoso nem pessoa com deficiência, entra inteiro.'],
      ['BPC é aposentadoria?', 'Não. É benefício assistencial: não exige contribuição, não paga 13º, não gera pensão por morte e não acumula com outro benefício da Previdência. Em compensação, quem nunca contribuiu pode receber.'],
      ['Meu pedido foi negado por renda. Posso recorrer?', 'Muitas negativas vêm de erros que se corrigem: grupo familiar montado errado, benefício de um salário mínimo que deveria ser excluído, ou análise que ignorou gastos de saúde. O recurso administrativo tem prazo de 30 dias da ciência da decisão, e a via judicial segue aberta.']
    ]
  },
  {
    slug: 'pensao-por-morte', calc: 'pensao', curto: 'Pensão por morte',
    titulo: 'Calculadora de pensão por morte',
    h1: 'Quanto você recebe e por quanto tempo.',
    meta: 'Calcule o valor da pensão por morte do INSS (50% + 10% por dependente) e veja por quantos anos ela é paga pela idade do cônjuge.',
    lead: 'Responde duas perguntas de uma vez: quanto será a pensão e até quando ela é paga ao cônjuge ou companheiro.',
    rapida: 'A pensão vale 50% do benefício do falecido mais 10% por dependente, até 100%. Cônjuge sozinho recebe 60%; com um filho menor, 70%. Havendo dependente inválido ou com deficiência grave, 100%. A duração para o cônjuge depende da idade no dia do óbito, de 3 anos até vitalícia, desde que o segurado tivesse 18 contribuições e a união durasse 2 anos. Sem isso, são 4 meses, salvo morte por acidente.',
    campos: dinheiro('base', 'Quanto a pessoa falecida recebia do INSS por mês', { req: true, full: true, hint: 'Se ainda não era aposentada, use o valor da aposentadoria por incapacidade a que teria direito.' }) +
      numero('dependentes', 'Quantas pessoas vão receber a pensão', { req: true, min: 1, max: 20, hint: 'Cônjuge ou companheiro e filhos menores de 21 anos ou inválidos.' }) +
      numero('idadeConjuge', 'Idade do cônjuge ou companheiro no dia do falecimento', { req: true, min: 0, max: 120, hint: 'É a idade naquele dia que define a duração, não a de hoje.' }) +
      marca('invalido', 'Algum dos dependentes é inválido ou tem deficiência grave', 'Nesse caso a cota familiar é de 100%.') +
      marca('carencia18', 'A pessoa falecida tinha pelo menos 18 contribuições ao INSS') +
      marca('uniao2anos', 'O casamento ou a união estável durava 2 anos ou mais') +
      marca('acidente', 'A morte foi por acidente (de qualquer natureza) ou doença do trabalho', 'Dispensa as 18 contribuições e os 2 anos de união.'),
    legal: [
      ['EC 103/2019, art. 23', 'Pensão de 50% do benefício, mais 10% por dependente, até 100%.'],
      ['EC 103/2019, art. 23, §2º', '100% quando há dependente inválido ou com deficiência grave.'],
      ['Lei 8.213/1991, art. 77', 'Duração da pensão do cônjuge conforme a idade no óbito, e regra dos 4 meses.'],
      ['Lei 8.213/1991, art. 74', 'Data de início: do óbito se pedida em até 90 dias (180 para menor de 16 anos).']
    ],
    faq: [
      ['Como se calcula a pensão?', 'A base é a aposentadoria que o falecido recebia ou, se ainda não era aposentado, a aposentadoria por incapacidade permanente a que teria direito. Sobre ela aplica-se 50% mais 10% por dependente, até 100%. A cota de quem perde a condição de dependente (como o filho que completa 21 anos) é redistribuída entre os que ficam, e não aumenta a pensão total.'],
      ['Por quanto tempo recebo?', 'Depende da idade do cônjuge ou companheiro no dia do óbito: de 3 anos para os mais jovens até pensão vitalícia a partir dos 45 anos, conforme a tabela da lei. Essa tabela só vale se o segurado tinha 18 contribuições e a união durava 2 anos. Sem isso, a pensão dura 4 meses, exceto se a morte foi por acidente ou doença do trabalho.'],
      ['A pensão pode ser menor que um salário mínimo?', 'Quando é a única renda do dependente, não: o benefício que substitui o salário não pode ser menor que o mínimo. Havendo vários dependentes, a divisão pode dar cotas individuais menores, o que é regular, porque o piso vale para o total.'],
      ['Posso acumular pensão com aposentadoria?', 'Pode, mas desde a reforma há redução em faixas do salário mínimo sobre o benefício de menor valor (EC 103/2019, art. 24). Como a conta muda de caso para caso, vale conferir antes de pedir.'],
      ['Perdi o prazo. Ainda dá para pedir?', 'Dá, a qualquer tempo. O que muda é a data de início: pedida em até 90 dias do óbito (180 se o dependente tem menos de 16 anos), a pensão retroage à morte. Depois disso, vale a partir do pedido. O pedido não depende de inventário nem de partilha.']
    ]
  },
  {
    slug: 'auxilio-doenca', calc: 'auxilio', curto: 'Auxílio-doença',
    titulo: 'Calculadora de auxílio-doença',
    h1: 'Quanto o INSS paga por mês.',
    meta: 'Calcule o valor do auxílio por incapacidade temporária (auxílio-doença): 91% da média e o limite dos últimos 12 salários.',
    lead: 'Calcula os 91% da média e aplica o limite dos últimos 12 salários, regra que reduz o valor de quem teve aumento pouco antes de adoecer.',
    rapida: `O auxílio por incapacidade temporária (antigo auxílio-doença) paga 91% da média de todos os salários desde julho de 1994, limitado à média dos 12 últimos salários de contribuição. Em ${CFG.ano} o valor fica entre ${brl(SM)} e ${brl(CFG.teto)}. A carência geral é de 12 contribuições, dispensada em acidente e em doenças graves da lista legal.`,
    campos: dinheiro('media', 'Média dos seus salários de contribuição', { req: true, full: true, hint: 'Um valor aproximado serve. O número exato sai do extrato CNIS, no Meu INSS.' }) +
      dinheiro('media12', 'Média dos últimos 12 salários', { full: true, hint: 'Some os 12 últimos e divida por 12. Esse valor funciona como limite.' }) +
      numero('contribuicoes', 'Quantas contribuições você já pagou ao INSS', { req: true, hint: 'Em meses, somando tudo. A regra geral pede 12.' }) +
      selecao('tipo', 'Como você contribui', [['empregado', 'Empregado com carteira assinada'], ['domestico', 'Empregado doméstico'], ['individual', 'Autônomo, contribuinte individual ou MEI'], ['facultativo', 'Contribuinte facultativo'], ['graca', 'Estou sem contribuir agora (período de graça)']]) +
      marca('acidentario', 'Afastamento por acidente de trabalho ou doença ocupacional (B91)') +
      marca('dispensaCarencia', 'Acidente de qualquer natureza ou doença grave da lista legal', 'Dispensa a carência de 12 contribuições.'),
    legal: [
      ['Lei 8.213/1991, art. 61', 'O auxílio por incapacidade temporária corresponde a 91% do salário de benefício.'],
      ['Lei 8.213/1991, art. 29, §10', 'O valor não pode exceder a média dos 12 últimos salários de contribuição.'],
      ['Lei 8.213/1991, art. 25, I', 'Carência de 12 contribuições mensais.'],
      ['Lei 8.213/1991, art. 26, II', 'Dispensa de carência em acidente e em doenças graves listadas.'],
      ['Lei 8.213/1991, art. 60, §3º', 'Os 15 primeiros dias do empregado são pagos pela empresa.']
    ],
    faq: [
      ['Como o INSS calcula?', 'Apura a média de todos os salários de contribuição desde julho de 1994, aplica 91% e confere o limite do art. 29, §10: se o resultado passar da média dos 12 últimos salários, o benefício cai para essa média. O valor final nunca é menor que o salário mínimo nem maior que o teto. Quem teve aumento pouco antes do afastamento costuma se surpreender com esse limite.'],
      ['Quantas contribuições preciso ter?', 'A regra geral é de 12. A carência é dispensada quando a incapacidade vem de acidente de qualquer natureza, de acidente de trabalho ou de doença grave listada em ato do Ministério. Além da carência, é preciso manter a qualidade de segurado, que em regra dura 12 meses depois da última contribuição.'],
      ['Recebo os 15 primeiros dias?', 'Se você é empregado com carteira, a empresa paga os 15 primeiros dias e o INSS entra a partir do 16º. Para os demais tipos de segurado, o INSS paga desde o início da incapacidade, desde que o pedido seja feito em até 30 dias do afastamento.'],
      ['Fui reprovado na perícia. O que fazer?', 'Cabe recurso administrativo em 30 dias da ciência do resultado, com laudos e exames novos, ou novo pedido com documentação atualizada. A via judicial não depende de esgotar o recurso. O que mais pesa é a qualidade do conjunto médico: relatório do especialista com CID, tempo de tratamento, exames e a limitação para a atividade que você exerce.']
    ]
  }
];

/* ---------- gabarito ---------- */
const wa = (msg) => `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(msg || CFG.mensagemWhatsapp)}`;
const M = CFG.marca;

const LOGO = (cls) => `<svg class="${cls || 'logo'}" viewBox="0 0 72 72" aria-hidden="true"><rect width="72" height="72" fill="currentColor"/><text x="36" y="46.5" text-anchor="middle" font-family="Inter Tight, Arial, sans-serif" font-weight="800" font-size="31" letter-spacing="-1.2" class="logo-t">BP</text><rect y="64" width="72" height="8" fill="#FF5A1F"/></svg>`;
const FAVICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" fill="#0A0A0A"/><text x="36" y="46.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="31" fill="#fff">BP</text><rect y="62" width="72" height="10" fill="#FF5A1F"/></svg>');

function nav(atual, prefix) {
  const itens = [['index.html', 'Início', 'inicio']].concat(PAGES.map(p => [p.slug + '.html', p.curto, p.slug]), [['artigos.html', 'Artigos', 'artigos'], ['sobre.html', 'Sobre', 'sobre']]);
  return itens.map(([h, t, k]) => `<a href="${prefix}${h}"${k === atual ? ' aria-current="page"' : ''}>${esc(t)}</a>`).join('');
}

function navDesk(atual) {
  const cur = k => k === atual ? ' aria-current="page"' : '';
  const emCalc = PAGES.some(p => p.slug === atual);
  return `<a href="index.html"${cur('inicio')}>Início</a>
    <div class="dd"><a href="index.html#calculadoras" class="dd-t"${emCalc ? ' aria-current="page"' : ''}>Calculadoras <span aria-hidden="true">▾</span></a>
      <div class="dd-m">${PAGES.map(p => `<a href="${p.slug}.html"${cur(p.slug)}>${esc(p.curto)}</a>`).join('')}</div></div>
    <a href="artigos.html"${cur('artigos')}>Artigos</a>
    <a href="sobre.html"${cur('sobre')}>Sobre</a>
    <a class="nav-cta" href="${wa()}" rel="noopener" target="_blank">WhatsApp</a>`;
}

function head(titulo, desc, arquivo, tipo) {
  const url = CFG.dominio && arquivo ? CFG.dominio.replace(/\/$/, '') + '/' + (arquivo === 'index.html' ? '' : arquivo) : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} | ${esc(M.nome)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="${M.cor}">
<link rel="icon" href="${FAVICON}">
<meta property="og:title" content="${esc(titulo)} | ${esc(M.nome)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${tipo || 'website'}">
${url ? `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">` : ''}
<meta property="og:locale" content="pt_BR">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
</head>`;
}

function topo(atual) {
  return `<body>
<a class="skip" href="#conteudo">Pular para o conteúdo</a>
<header class="top">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="${esc(M.nome)}, início">${LOGO()}<span class="brand-t"><b>${esc(M.nome)}</b><small>${esc(M.subtitulo)}</small></span></a>
    <nav class="nav" aria-label="Menu principal">${navDesk(atual)}</nav>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="nav-m" id="menu-btn">Menu</button>
  </div>
  <nav class="nav-m" id="nav-m" aria-label="Menu (celular)">${nav(atual, '')}</nav>
</header>`;
}

function rodape() {
  return `<footer>
  <div class="wrap">
    <div class="cols">
      <div>
        <a class="brand brand-f" href="index.html">${LOGO()}<span class="brand-t"><b>${esc(M.nome)}</b><small>${esc(M.subtitulo)}</small></span></a>
        <p style="margin-top:14px">${esc(M.cidade)}</p>
        <p>${esc(M.oab)}</p>
        <p><a href="https://www.instagram.com/${esc(M.instagram)}/" rel="noopener" target="_blank">@${esc(M.instagram)}</a></p>
      </div>
      <div>
        <h4>Calculadoras</h4>
        ${PAGES.map(p => `<a href="${p.slug}.html">${esc(p.curto)}</a>`).join('')}
        <a href="sobre.html"><b>Sobre o advogado</b></a>
        <a href="artigos.html"><b>Artigos</b></a>
        <a href="politica-de-privacidade.html">Política de Privacidade</a>
        <a href="termos-de-uso.html">Termos de Uso</a>
      </div>
      <div>
        <h4>Contato</h4>
        <a href="${wa()}" rel="noopener" target="_blank">Falar no WhatsApp</a>
        <a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a>
        <p style="margin-top:12px">Os cálculos são estimativas informativas, feitas com base na lei e nas tabelas vigentes. Não substituem a análise do seu caso por um advogado nem prometem resultado.</p>
      </div>
    </div>
    <div class="fim">Conteúdo informativo, em conformidade com o Provimento 205/2021 da OAB. © ${CFG.ano} ${esc(M.nome)}. Valores de referência: salário mínimo ${brl(SM)} e teto do INSS ${brl(CFG.teto)} (${CFG.ano}).</div>
  </div>
</footer>
<a class="zap" href="${wa()}" rel="noopener" target="_blank" aria-label="Falar no WhatsApp">WhatsApp</a>
<script src="assets/config.js"></script>
<script src="assets/track.js" defer></script>`;
}

function paginaCalc(p) {
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
  };
  return `${head(p.titulo, p.meta, p.slug + '.html')}
${topo(p.slug)}
<main id="conteudo">
  <div class="wrap">
    <section class="hero">
      <span class="kicker">Calculadora ${CFG.ano}</span>
      <h1>${esc(p.h1)}</h1>
      <p class="lead">${esc(p.lead)}</p>
      <div class="rapida"><b>Resposta rápida</b><p>${esc(p.rapida)}</p></div>
    </section>

    <section class="calc" id="calc" aria-labelledby="t-calc">
      <div class="card">
        <div class="card-h"><h2 id="t-calc">Preencha para calcular</h2><span>Resultado na hora, com a conta aberta</span></div>
        <form class="f" id="form" data-calc="${p.calc}" novalidate>
          ${p.campos}
          <p class="erro" id="erro" role="alert"></p>
          <div class="acoes">
            <button class="btn" type="submit">Calcular agora</button>
            <button class="btn sec" type="reset" id="limpar">Limpar</button>
          </div>
        </form>
      </div>

      <div class="card" id="resultado" aria-live="polite" tabindex="-1">
        <div class="print-head"><b>${esc(M.nome)}</b> · ${esc(p.titulo)} · estimativa informativa</div>
        <div id="res-corpo"></div>
        <div class="sub acoes" style="display:flex">
          <button class="btn sec" type="button" id="imprimir">Salvar em PDF / imprimir</button>
        </div>
      </div>

      <div class="lead-box" id="lead-box">
        <div class="in">
          <h2>Quer que um advogado confira o seu caso?</h2>
          <p>Deixe seu nome e WhatsApp. Com o extrato CNIS e os documentos em mãos, dá para saber o que o seu caso realmente comporta.</p>
          <form class="lead-form" id="lead-form" novalidate>
            <div class="fld"><label for="ln">Seu nome</label><input type="text" id="ln" name="nome" autocomplete="name" required></div>
            <div class="fld"><label for="lw">WhatsApp com DDD</label><input type="tel" id="lw" name="whatsapp" inputmode="tel" autocomplete="tel" placeholder="(63) 9 0000-0000" required></div>
            <input type="text" name="site" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
            <label class="chk full"><input type="checkbox" name="consent" required><span><b>Li e aceito os <a href="termos-de-uso.html" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="politica-de-privacidade.html" target="_blank" rel="noopener">Política de Privacidade</a></b><small>Autorizo o armazenamento dos meus dados e do cálculo realizado, que pode incluir informações de saúde ou deficiência, para que o advogado Breno Proenço retorne o contato. Posso pedir a exclusão a qualquer momento pelo e-mail ${esc(CFG.email)}.</small></span></label>
            <p class="erro full" id="lead-erro" role="alert"></p>
            <div class="full"><button class="btn" type="submit">Enviar e falar no WhatsApp</button></div>
            <p class="ok-msg full" id="lead-ok">Recebido. Se o WhatsApp não abriu, <a id="lead-link" href="#" target="_blank" rel="noopener">clique aqui</a>.</p>
            <p class="priv full">Seus dados não são vendidos nem compartilhados.</p>
          </form>
        </div>
      </div>
    </section>

    <section class="blk" aria-labelledby="t-legal">
      <span class="kicker">Fundamento</span>
      <h2 id="t-legal">Em que a lei se baseia este cálculo</h2>
      <div class="legal">${p.legal.map(([t, d]) => `<div><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('')}</div>
    </section>

    <section class="blk" aria-labelledby="t-faq">
      <span class="kicker">Perguntas frequentes</span>
      <h2 id="t-faq">Dúvidas comuns</h2>
      ${p.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
    </section>

    <section class="blk" aria-labelledby="t-outras">
      <span class="kicker">Outras ferramentas</span>
      <h2 id="t-outras">Continue a conta</h2>
      <div class="grid6">
        ${PAGES.filter(x => x.slug !== p.slug).slice(0, 3).map((x, i) => `<a href="${x.slug}.html"><span class="n">0${i + 1}</span><h3>${esc(x.curto)}</h3><p>${esc(x.lead)}</p><span class="go">Abrir →</span></a>`).join('')}
      </div>
    </section>

    <p class="aviso-legal"><b>Aviso:</b> esta ferramenta dá uma estimativa informativa com base nas regras gerais da EC 103/2019, da Lei 8.213/1991 e nas tabelas de ${CFG.ano}. Não é consulta jurídica nem garantia de resultado. Períodos especiais, rurais, de serviço público ou lacunas no CNIS podem mudar o resultado.</p>
  </div>
</main>
${rodape()}
<script src="assets/calc.js"></script>
<script src="assets/app.js"></script>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</body>
</html>
`;
}

function cardArtigo(a) {
  return `<a href="artigo-${a.slug}.html"><span class="meta">${a.min} min de leitura</span><h3>${esc(a.titulo)}</h3><p>${esc(a.desc)}</p><span class="go">Ler →</span></a>`;
}

function corpoHtml(c) {
  return c.map(([t, v]) => t === 'h2' ? `<h2>${esc(v)}</h2>` : t === 'p' ? `<p>${esc(v)}</p>` : t === 'ul' ? `<ul>${v.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p class="nota-art">${esc(v)}</p>`).join('\n');
}

const DATA_PUB = '2026-10-11';
const DATA_POL = '11 de outubro de 2026';

function paginaArtigos() {
  return `${head('Artigos sobre Previdência Social e INSS', 'Artigos em linguagem simples sobre aposentadoria, BPC/LOAS, pensão por morte, auxílio-doença, CNIS e as regras do INSS.', 'artigos.html')}
${topo('artigos')}
<main id="conteudo">
  <div class="wrap">
    <section class="hero">
      <span class="kicker">Artigos</span>
      <h1>Entenda seus direitos antes de decidir.</h1>
      <p class="lead">Explicações diretas sobre as regras do INSS, com base na lei vigente. Leia, faça a conta nas calculadoras e leve suas dúvidas para uma análise individual.</p>
    </section>
    <div class="arts">${ARTIGOS.map(cardArtigo).join('')}</div>
    <p class="aviso-legal"><b>Aviso:</b> conteúdo informativo, sem promessa de resultado. Cada caso depende de documentos, datas e histórico de contribuição.</p>
  </div>
</main>
${rodape()}
<script>
  (function(){var b=document.getElementById('menu-btn'),n=document.getElementById('nav-m');if(!b)return;b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)})})();
</script>
</body>
</html>
`;
}

function paginaArtigo(a) {
  const arq = 'artigo-' + a.slug + '.html';
  const outros = ARTIGOS.filter(x => x.slug !== a.slug).slice(0, 3);
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: a.titulo, description: a.desc, datePublished: a.data, dateModified: a.data, inLanguage: 'pt-BR', author: { '@type': 'Person', name: M.nome }, publisher: { '@type': 'Person', name: M.nome } };
  return `${head(a.titulo, a.desc, arq, 'article')}
${topo('artigos')}
<main id="conteudo">
  <div class="wrap">
    <article class="art">
      <p class="crumb"><a href="index.html">Início</a> / <a href="artigos.html">Artigos</a></p>
      <span class="kicker">${a.min} min de leitura · ${dataBR(a.data)}</span>
      <h1>${esc(a.titulo)}</h1>
      <p class="lead">${esc(a.desc)}</p>
      <div class="art-corpo">
${a.imagem ? `<img class="art-img" src="${esc(a.imagem.replace(/^\//, ''))}" alt="">` : ''}
${a.html}
${a.nota ? `<p class="nota-art">${esc(a.nota)}</p>` : ''}
      </div>
      <aside class="cta-art">
        <b>Faça a conta no seu caso</b>
        <p>Use a ${esc(a.calcTxt)} para ver uma estimativa com a memória de cálculo aberta.</p>
        <a class="btn" href="${a.calc}.html">${esc(a.calcTxt)} →</a>
        <a class="btn sec" href="${wa('Olá, Dr. Breno! Li o artigo "' + a.titulo + '" e gostaria de uma análise do meu caso.')}" rel="noopener" target="_blank">Falar no WhatsApp</a>
      </aside>
      <p class="aviso-legal"><b>Aviso:</b> conteúdo informativo, que não substitui a análise do seu caso por um advogado nem promete resultado.</p>
    </article>
    <section class="blk">
      <span class="kicker">Continue lendo</span>
      <div class="arts">${outros.map(cardArtigo).join('')}</div>
    </section>
  </div>
</main>
${rodape()}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script>
  (function(){var b=document.getElementById('menu-btn'),n=document.getElementById('nav-m');if(!b)return;b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)})})();
</script>
</body>
</html>
`;
}

function paginaSobre() {
  const valores = [['Atendimento humanizado', 'Você é ouvido com calma. Cada história é diferente, e é ela que orienta o trabalho.'], ['Análise cuidadosa', 'O CNIS, os laudos e os documentos são conferidos um a um, porque um detalhe pode mudar o resultado.'], ['Linguagem clara', 'Explico seus direitos sem juridiquês, para que você entenda o que está acontecendo e possa decidir.'], ['Transparência', 'Digo com honestidade o que o seu caso comporta, sem promessas, desde a primeira conversa.']];
  const areas = [['Auxílio-acidente', 'Para quem sofreu acidente, ficou com sequela e teve a capacidade de trabalho reduzida, mesmo voltando a trabalhar.'], ['Auxílio-doença', 'Afastamento por incapacidade temporária: pedido, perícia, prorrogação e recurso quando o INSS nega.'], ['BPC/LOAS', 'Benefício assistencial para idosos a partir de 65 anos e pessoas com deficiência em situação de baixa renda.'], ['Aposentadorias', 'Análise das regras de transição, do tempo especial e do melhor momento para pedir o benefício.']];
  const passos = [['1. Escuta', 'Conversamos sobre a sua história de trabalho, sua saúde e sua família, sem pressa.'], ['2. Análise', 'Confiro CNIS, carteira, laudos e documentos: vínculos, lacunas, carência e qualidade de segurado.'], ['3. Estratégia', 'Explico as alternativas, os riscos e o caminho mais adequado, administrativo ou judicial.'], ['4. Acompanhamento', 'Acompanho cada etapa do pedido e mantenho você informado, com retorno claro.']];
  const ld = { '@context': 'https://schema.org', '@type': 'Person', name: M.nome, jobTitle: 'Advogado previdenciário', image: 'assets/breno.jpg', knowsAbout: ['Direito previdenciário', 'Auxílio-acidente', 'Auxílio-doença', 'BPC/LOAS', 'Aposentadoria'], sameAs: ['https://www.instagram.com/' + M.instagram + '/'] };
  return `${head('Sobre Breno Proenço, advogado previdenciário', 'Conheça Breno Proenço, advogado (OAB/TO 14.612) dedicado ao direito previdenciário: trajetória, forma de trabalho e áreas de atuação, com atendimento online em todo o Brasil.', 'sobre.html')}
${topo('sobre')}
<main id="conteudo">
  <section class="intro">
    <div class="wrap intro-g">
      <div class="intro-txt">
        <span class="kicker">Sobre · ${esc(M.oab)}</span>
        <h1>Direito previdenciário com escuta, clareza e cuidado.</h1>
        <p class="lead">Sou ${esc(M.nome)}, advogado inscrito na OAB do Tocantins. Dedico minha atuação ao direito previdenciário e atendo clientes de todo o Brasil.</p>
        <p class="hero-btns"><a class="btn" href="${wa('Olá, Dr. Breno! Conheci seu trabalho pelo site e gostaria de conversar sobre o meu caso.')}" rel="noopener" target="_blank">Falar no WhatsApp</a></p>
      </div>
      <figure class="intro-foto">
        <img src="assets/breno.jpg" alt="${esc(M.nome)}, advogado previdenciário" width="800" height="1000">
        <figcaption><b>${esc(M.nome)}</b><span>${esc(M.oab)}</span></figcaption>
      </figure>
    </div>
  </section>
  <div class="wrap">
    <section class="blk texto-sobre">
      <span class="kicker">Trajetória</span>
      <h2>Por trás de cada pedido, uma história.</h2>
      <p>O direito previdenciário faz parte da minha vida profissional há cerca de quatro anos. Acompanhei de perto pedidos e processos junto ao INSS ainda durante a formação e, hoje, conduzo esses casos como advogado.</p>
      <p>Nesse caminho aprendi que nenhum requerimento é só um papel. É o trabalhador que voltou ao serviço com uma sequela, a família que depende do BPC para manter o tratamento de um filho, a pessoa que contribuiu a vida inteira e ainda não sabe quando pode se aposentar.</p>
      <blockquote>Escolhi a Previdência pelo contato com pessoas idosas, com quem vive em situação de vulnerabilidade e com quem precisa de um benefício para ter a vida transformada.</blockquote>
      <p>É esse compromisso que orienta o meu trabalho: atendimento humanizado e uma análise feita com o cuidado que a sua vida e o seu futuro merecem.</p>
    </section>
    <section class="blk">
      <span class="kicker">Como eu atendo</span>
      <h2>O que você pode esperar</h2>
      <div class="areas4">${valores.map(([t, d]) => `<div><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>
    </section>
    <section class="blk">
      <span class="kicker">Atuação</span>
      <h2>Os casos que mais conduzo</h2>
      <div class="areas4">${areas.map(([t, d]) => `<div><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>
    </section>
    <section class="blk">
      <span class="kicker">Método</span>
      <h2>Como o trabalho acontece</h2>
      <div class="passos">${passos.map(([t, d]) => `<div><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>
    </section>
    <section class="fecho">
      <img src="assets/breno-avatar.jpg" alt="" width="120" height="120">
      <div>
        <h2>Atendimento online, em todo o Brasil.</h2>
        <p>Você não precisa sair de casa: a conversa, o envio de documentos e o acompanhamento podem ser feitos pelo WhatsApp, de qualquer lugar do país.</p>
        <a class="btn" href="${wa('Olá, Dr. Breno! Conheci seu trabalho pelo site e gostaria de conversar sobre o meu caso.')}" rel="noopener" target="_blank">Falar no WhatsApp</a>
      </div>
    </section>
    <p class="aviso-legal"><b>Aviso:</b> conteúdo informativo, em conformidade com o Provimento 205/2021 da OAB. Não há promessa de resultado: cada caso depende de documentos, datas e histórico de contribuição.</p>
  </div>
</main>
${rodape()}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script>
  (function(){var b=document.getElementById('menu-btn'),n=document.getElementById('nav-m');if(!b)return;b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)})})();
</script>
</body>
</html>
`;
}

function paginaTermos() {
  const sec = (t, ps) => `<h2>${esc(t)}</h2>` + ps.map(p => Array.isArray(p) ? `<ul>${p.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p>${esc(p)}</p>`).join('');
  return `${head('Termos de Uso', 'Regras de uso do site, das calculadoras e dos artigos de Breno Proenço, advogado previdenciário.', 'termos-de-uso.html')}
${topo('')}
<main id="conteudo">
  <div class="wrap">
    <article class="art pol">
      <p class="crumb"><a href="index.html">Início</a> / Termos de Uso</p>
      <span class="kicker">Atualizados em ${DATA_POL}</span>
      <h1>Termos de Uso</h1>
      <p class="lead">Ao usar este site, você concorda com as regras abaixo. Elas existem para deixar claro o que as calculadoras e os artigos oferecem e o que não oferecem.</p>
      ${sec('1. Quem mantém o site', [`Este site é mantido por ${M.nome}, advogado, ${M.oab}. Contato: ${CFG.email}.`])}
      ${sec('2. Caráter informativo', ['As calculadoras e os artigos têm finalidade informativa e educativa. Os resultados são estimativas feitas a partir das informações que você digita e das regras gerais da legislação previdenciária, e podem não refletir a sua situação real.', 'O uso do site não cria relação entre advogado e cliente, não constitui consulta jurídica e não substitui a análise individual dos seus documentos, como o extrato CNIS, a carteira de trabalho e os laudos médicos.'])}
      ${sec('3. Sem promessa de resultado', ['Nenhum conteúdo deste site promete ou garante a concessão de benefício, prazo ou valor. A decisão sobre qualquer benefício cabe ao INSS ou ao Poder Judiciário, conforme o caso e as provas apresentadas.'])}
      ${sec('4. Responsabilidade pelo uso', ['Você é responsável pela exatidão das informações que digita. Decisões tomadas apenas com base nos resultados das calculadoras, sem orientação profissional, são de sua responsabilidade. O site pode ficar fora do ar, ter erros ou ser alterado sem aviso prévio.'])}
      ${sec('5. Atualização das regras e valores', ['A legislação, o salário mínimo, o teto do INSS e as tabelas oficiais mudam com frequência. Procuramos manter tudo atualizado, mas pode haver defasagem entre uma mudança oficial e a atualização do site.'])}
      ${sec('6. Contato e dados pessoais', ['Ao enviar o formulário de contato, você autoriza o retorno pelo WhatsApp e o armazenamento dos dados informados, nos termos da Política de Privacidade. Você pode pedir a exclusão dos seus dados a qualquer momento pelo e-mail ' + CFG.email + '.'])}
      ${sec('7. Conteúdo do site', ['Os textos, as calculadoras e o visual do site são de autoria de ' + M.nome + '. Você pode compartilhar os links livremente; a reprodução do conteúdo deve citar a fonte.'])}
      ${sec('8. Publicidade da advocacia', ['Este site segue as regras de publicidade da advocacia (Provimento 205/2021 do Conselho Federal da OAB): tem caráter informativo, não faz promessa de resultado nem oferece serviços de forma mercantil.'])}
      ${sec('9. Alterações e legislação aplicável', ['Estes termos podem ser atualizados a qualquer momento, com a data de atualização indicada no topo. Aplica-se a legislação brasileira.'])}
      <p class="aviso-legal"><b>Veja também:</b> <a href="politica-de-privacidade.html">Política de Privacidade</a>.</p>
    </article>
  </div>
</main>
${rodape()}
<script>
  (function(){var b=document.getElementById('menu-btn'),n=document.getElementById('nav-m');if(!b)return;b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)})})();
</script>
</body>
</html>
`;
}

function paginaPolitica() {
  const sec = (t, ps) => `<h2>${esc(t)}</h2>` + ps.map(p => Array.isArray(p) ? `<ul>${p.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p>${esc(p)}</p>`).join('');
  return `${head('Política de Privacidade', 'Como este site trata os dados pessoais informados nas calculadoras e no formulário de contato, em conformidade com a LGPD (Lei 13.709/2018).', 'politica-de-privacidade.html')}
${topo('')}
<main id="conteudo">
  <div class="wrap">
    <article class="art pol">
      <p class="crumb"><a href="index.html">Início</a> / Política de Privacidade</p>
      <span class="kicker">Atualizada em ${DATA_POL}</span>
      <h1>Política de Privacidade</h1>
      <p class="lead">Explicamos aqui, em linguagem simples, quais dados este site coleta, para que servem e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
      ${sec('1. Quem é o responsável', [`O controlador dos dados é ${M.nome}, advogado, ${M.oab}, com atuação em ${M.cidade}. Para qualquer assunto sobre seus dados pessoais, escreva para ${CFG.email}.`])}
      ${sec('2. Quais dados são tratados', [
        'Estatísticas de uso, sem identificar você: páginas visitadas, calculadora utilizada e o resumo do resultado, site de origem (por exemplo, Instagram ou Google), tipo de aparelho (celular ou computador) e um código de sessão aleatório que dura só enquanto a aba estiver aberta. Não usamos cookies para isso.',
        'Os dados digitados nas calculadoras (como data de nascimento, sexo, tempo de contribuição, valores e composição familiar) são usados para montar o cálculo na tela. Eles só são armazenados se você enviar o formulário de contato.',
        'No formulário de contato: nome, número de WhatsApp, os dados e o resultado do cálculo que você fez, a página de origem e o registro da sua autorização (texto aceito, data e hora). Esses dados podem incluir informações sobre saúde ou deficiência, consideradas dados sensíveis pela LGPD.',
        'Para contar visitantes sem usar cookies e para evitar abusos, o endereço IP e o tipo de navegador são transformados em um código irreversível, que muda todos os dias. O IP em si não é armazenado, e os códigos usados contra abusos são apagados em até 24 horas. Os serviços de hospedagem e de fontes de texto (Google Fonts) também podem receber dados técnicos de acesso.'
      ])}
      ${sec('3. Para que usamos', [['Retornar o contato que você solicitou e conversar sobre o seu caso.', 'Organizar o atendimento (situação do contato e anotações do advogado).', 'Entender, de forma agregada, quais páginas e calculadoras são mais úteis, para melhorar o site.', 'Manter o funcionamento e a segurança do site.'], 'Não vendemos seus dados e não os compartilhamos com terceiros para fins de publicidade.'])}
      ${sec('4. Base legal', ['O tratamento dos dados do formulário se baseia no seu consentimento (art. 7º, I, da LGPD), e, quanto a dados de saúde ou deficiência, no consentimento específico e destacado do art. 11, I, dado ao marcar a caixa de autorização. As estatísticas anônimas de uso se baseiam no legítimo interesse em manter e melhorar o site (art. 7º, IX). Você pode retirar o consentimento a qualquer momento. Se houver contratação de serviços advocatícios, os dados poderão ser tratados também para a execução do contrato e o cumprimento de obrigações legais e éticas.'])}
      ${sec('5. Onde os dados ficam e serviços de terceiros', ['Os dados são armazenados no Supabase, serviço de banco de dados em nuvem, com acesso restrito ao advogado responsável. Ao enviar o formulário, você também é direcionado ao WhatsApp, serviço de terceiro com política de privacidade própria. O site carrega fontes do Google Fonts. Esses fornecedores podem tratar dados técnicos conforme suas próprias políticas, inclusive em servidores fora do Brasil.'])}
      ${sec('6. Sigilo profissional', ['As informações que você compartilhar com o advogado para análise do seu caso são protegidas pelo sigilo profissional previsto no Estatuto da Advocacia e no Código de Ética e Disciplina da OAB.'])}
      ${sec('7. Por quanto tempo guardamos', ['Os dados de contato são guardados pelo tempo necessário para o atendimento. Se não houver prosseguimento, serão eliminados ou anonimizados em até 24 meses, salvo quando a lei exigir a guarda por prazo maior. As estatísticas anônimas podem ser mantidas por mais tempo, pois não identificam ninguém.'])}
      ${sec('8. Seus direitos e como pedir a exclusão', ['Você pode solicitar, a qualquer momento:', ['confirmação de que tratamos seus dados e acesso a eles;', 'correção de dados incompletos ou desatualizados;', 'anonimização, bloqueio ou eliminação de dados desnecessários;', 'informação sobre com quem os dados foram compartilhados;', 'revogação do consentimento e eliminação dos dados tratados com base nele.'], `Para exercer esses direitos, inclusive pedir que seus dados sejam apagados, envie um e-mail para ${CFG.email} informando seu nome e o número de WhatsApp que usou no site. Responderemos em até 15 dias, e a exclusão é feita de forma definitiva, salvo dados que a lei obrigue a manter.`])}
      ${sec('9. Segurança', ['O banco de dados tem regras de acesso que impedem a leitura pelo público: o site apenas envia informações, e somente o advogado responsável, com login próprio, consegue consultá-las. A conexão é criptografada. Nenhum sistema é totalmente imune a falhas, e por isso pedimos que você não envie documentos ou informações além do necessário.'])}
      ${sec('10. Cookies', ['Este site não usa cookies de publicidade nem de rastreamento. As estatísticas descritas no item 2 usam apenas um código de sessão temporário, que é apagado quando você fecha a aba.'])}
      ${sec('11. Mudanças nesta política', ['Podemos atualizar esta política para refletir mudanças no site ou na lei. A data de atualização aparece no topo da página.'])}
      <p class="aviso-legal"><b>Aviso:</b> as calculadoras e os artigos têm caráter informativo e não substituem a análise individual do seu caso por um advogado.</p>
    </article>
  </div>
</main>
${rodape()}
<script>
  (function(){var b=document.getElementById('menu-btn'),n=document.getElementById('nav-m');if(!b)return;b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)})})();
</script>
</body>
</html>
`;
}

function paginaIndex() {
  const areas = [['Auxílio-acidente', 'Para quem ficou com sequela e continua trabalhando.'], ['Auxílio-doença', 'Afastamento por incapacidade, perícia e recursos.'], ['BPC/LOAS', 'Benefício assistencial para idosos e pessoas com deficiência.'], ['Aposentadorias', 'Regras de transição, tempo especial e planejamento.']];
  return `${head('Advogado previdenciário · Calculadoras do INSS', 'Breno Proenço, advogado previdenciário (OAB/TO 14.612). Auxílio-acidente, auxílio-doença, BPC/LOAS e aposentadorias, com atendimento online em todo o Brasil e calculadoras do INSS.', 'index.html')}
${topo('inicio')}
<main id="conteudo">
  <section class="intro">
    <div class="wrap intro-g">
      <div class="intro-txt">
        <span class="kicker">Advocacia previdenciária · ${esc(M.oab)}</span>
        <h1>Seu benefício do INSS analisado com o cuidado que o seu futuro merece.</h1>
        <p class="lead">Sou ${esc(M.nome)}, advogado dedicado ao direito previdenciário. Atuo com auxílio-acidente, auxílio-doença, BPC/LOAS e aposentadorias, com atendimento humanizado e online para todo o Brasil.</p>
        <p class="hero-btns"><a class="btn" href="${wa()}" rel="noopener" target="_blank">Falar no WhatsApp</a><a class="btn sec" href="#calculadoras">Fazer um cálculo</a></p>
        <ul class="selos"><li>Atendimento em todo o Brasil</li><li>Análise individual do CNIS</li><li>Linguagem clara, sem juridiquês</li></ul>
      </div>
      <figure class="intro-foto">
        <img src="assets/breno.jpg" alt="${esc(M.nome)}, advogado previdenciário" width="800" height="1000">
        <figcaption><b>${esc(M.nome)}</b><span>${esc(M.oab)}</span></figcaption>
      </figure>
    </div>
  </section>
  <div class="wrap">
    <section class="blk" aria-labelledby="t-areas">
      <span class="kicker">Atuação</span>
      <h2 id="t-areas">Onde eu posso ajudar</h2>
      <div class="areas4">${areas.map(([t, d]) => `<div><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>
      <p style="margin-top:18px"><a class="link-forte" href="sobre.html">Conheça minha trajetória e forma de trabalho →</a></p>
    </section>
    <section class="blk" id="calculadoras" aria-labelledby="t-calc">
      <span class="kicker">Calculadoras do INSS · ${CFG.ano}</span>
      <h2 id="t-calc">Faça a conta do seu benefício.</h2>
      <p class="lead" style="margin-bottom:8px">Seis calculadoras com a memória de cálculo à vista e a base legal de cada regra. O resultado é uma estimativa; a análise do seu caso confirma o que cabe.</p>
      <div class="grid6">
        ${PAGES.map((x, i) => `<a href="${x.slug}.html"><span class="n">0${i + 1}</span><h3>${esc(x.curto)}</h3><p>${esc(x.lead)}</p><span class="go">Abrir →</span></a>`).join('')}
      </div>
    </section>
    <section class="blk" aria-labelledby="t-art">
      <span class="kicker">Para entender antes de decidir</span>
      <h2 id="t-art">Artigos sobre Previdência.</h2>
      <div class="arts">${ARTIGOS.slice(0, 3).map(cardArtigo).join('')}</div>
      <p style="margin-top:18px"><a class="btn sec" href="artigos.html">Ver todos os artigos →</a></p>
    </section>
    <section class="fecho">
      <img src="assets/breno-avatar.jpg" alt="" width="120" height="120">
      <div>
        <h2>Vamos conversar sobre o seu caso?</h2>
        <p>Traga o extrato CNIS e os documentos que tiver. Eu analiso o seu histórico com atenção e explico, com clareza, os caminhos possíveis.</p>
        <a class="btn" href="${wa()}" rel="noopener" target="_blank">Falar no WhatsApp</a>
      </div>
    </section>
    <p class="aviso-legal"><b>Aviso:</b> as calculadoras e os artigos têm caráter informativo e não substituem a análise do seu caso por um advogado. Nenhuma página promete resultado: cada caso depende de documentos, datas e histórico de contribuição.</p>
  </div>
</main>
${rodape()}
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'LegalService', name: M.nome + ' · ' + M.subtitulo, areaServed: 'BR', knowsAbout: ['Direito previdenciário', 'Auxílio-acidente', 'Auxílio-doença', 'BPC/LOAS', 'Aposentadoria'], founder: { '@type': 'Person', name: M.nome, jobTitle: 'Advogado' } })}</script>
<script>
  (function(){var b=document.getElementById('menu-btn'),n=document.getElementById('nav-m');if(!b)return;b.addEventListener('click',function(){var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)})})();
</script>
</body>
</html>
`;
}

(async () => {
ARTIGOS = await carregarArtigos();
const out = path.join(__dirname, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(__dirname, 'assets'), path.join(out, 'assets'), { recursive: true });
fs.cpSync(path.join(__dirname, 'admin'), path.join(out, 'admin'), { recursive: true });

fs.writeFileSync(path.join(out, 'index.html'), paginaIndex());
PAGES.forEach(p => fs.writeFileSync(path.join(out, p.slug + '.html'), paginaCalc(p)));
fs.writeFileSync(path.join(out, 'artigos.html'), paginaArtigos());
fs.writeFileSync(path.join(out, 'sobre.html'), paginaSobre());
fs.writeFileSync(path.join(out, 'politica-de-privacidade.html'), paginaPolitica());
fs.writeFileSync(path.join(out, 'termos-de-uso.html'), paginaTermos());
ARTIGOS.forEach(a => fs.writeFileSync(path.join(out, 'artigo-' + a.slug + '.html'), paginaArtigo(a)));
// Links curtos de divulgação: cada um já leva a marcação de origem (UTM)
const LINKS_CURTOS = [
  ['/ig', '/?utm_source=instagram&utm_medium=bio'],
  ['/stories', '/?utm_source=instagram&utm_medium=stories'],
  ['/zap', '/?utm_source=whatsapp&utm_medium=mensagem'],
  ['/status', '/?utm_source=whatsapp&utm_medium=status'],
  ['/qr', '/?utm_source=qrcode&utm_medium=impresso'],
  ['/cartao', '/?utm_source=cartao&utm_medium=impresso'],
  ['/fb', '/?utm_source=facebook&utm_medium=post'],
  ['/yt', '/?utm_source=youtube&utm_medium=video'],
  ['/email', '/?utm_source=email&utm_medium=assinatura'],
  ['/bpc', '/bpc-loas?utm_source=instagram&utm_medium=post'],
  ['/aux', '/auxilio-doenca?utm_source=instagram&utm_medium=post'],
  ['/apos', '/simulador-de-aposentadoria?utm_source=instagram&utm_medium=post'],
];
fs.writeFileSync(path.join(out, '_redirects'), LINKS_CURTOS.map(([de, para]) => `${de}  ${para}  302`).join('\n') + '\n');
const urls = ['index.html', 'sobre.html', 'politica-de-privacidade.html', 'termos-de-uso.html'].concat(PAGES.map(p => p.slug + '.html'), ['artigos.html'], ARTIGOS.map(a => 'artigo-' + a.slug + '.html'));
if (CFG.dominio) {
  const d = CFG.dominio.replace(/\/$/, '');
  fs.writeFileSync(path.join(out, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(u => `<url><loc>${d}/${u === 'index.html' ? '' : u}</loc></url>`).join('\n') + '\n</urlset>\n');
  fs.writeFileSync(path.join(out, 'robots.txt'), 'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ' + d + '/sitemap.xml\n');
}
console.log('Geradas: index.html +', PAGES.length, 'calculadoras');
})().catch(e => { console.error(e.message || e); process.exit(1); });
