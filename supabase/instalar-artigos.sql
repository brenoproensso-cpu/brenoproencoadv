-- INSTALAÇÃO: rode este arquivo inteiro de uma vez no SQL Editor do Supabase.
-- Cria a tabela de artigos, carrega os 8 artigos atuais e libera a exclusão de leads pelo painel.

-- Artigos do site, editados pelo painel único (/admin).
-- Público lê só os publicados; somente admins criam, editam e apagam.

create table if not exists public.artigos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  titulo text not null check (char_length(titulo) between 5 and 200),
  descricao text not null default '' check (char_length(descricao) <= 400),
  corpo text not null default '',
  calculadora text not null default 'simulador-de-aposentadoria'
    check (calculadora in ('tempo-de-contribuicao', 'simulador-de-aposentadoria', 'valor-do-beneficio', 'bpc-loas', 'pensao-por-morte', 'auxilio-doenca')),
  nota text not null default 'Conteúdo informativo. A análise depende dos documentos e do histórico de cada pessoa.',
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  ordem int not null default 999,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  origem text not null default 'manual' check (origem in ('manual', 'ia')),
  observacoes_ia text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists artigos_status_idx on public.artigos (status, data desc);

alter table public.artigos enable row level security;

revoke all on public.artigos from anon, authenticated;
grant select on public.artigos to anon, authenticated;
grant insert, update, delete on public.artigos to authenticated;

drop policy if exists artigos_publicos on public.artigos;
create policy artigos_publicos on public.artigos for select to anon, authenticated using (status = 'publicado');
drop policy if exists artigos_admin_select on public.artigos;
create policy artigos_admin_select on public.artigos for select to authenticated using (public.is_admin());
drop policy if exists artigos_admin_insert on public.artigos;
create policy artigos_admin_insert on public.artigos for insert to authenticated with check (public.is_admin());
drop policy if exists artigos_admin_update on public.artigos;
create policy artigos_admin_update on public.artigos for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists artigos_admin_delete on public.artigos;
create policy artigos_admin_delete on public.artigos for delete to authenticated using (public.is_admin());

drop trigger if exists artigos_touch on public.artigos;
create trigger artigos_touch before update on public.artigos for each row execute function public.leads_touch();

-- Artigos iniciais (os 8 que já estavam no site)
insert into public.artigos (slug, titulo, descricao, corpo, calculadora, nota, data, ordem, status, origem) values
($a$aposentadoria-especial-ppp-ltcat$a$, $a$Aposentadoria especial: o que são PPP e LTCAT e por que decidem o seu direito$a$, $a$Trabalho com ruído, agentes químicos ou risco à saúde pode valer tempo especial. Veja o papel do PPP e do LTCAT e como funciona a conversão até 13/11/2019.$a$, $a$Quem trabalha exposto a agentes que prejudicam a saúde, como ruído, calor, produtos químicos ou agentes biológicos, pode ter o tempo tratado de forma diferente. A lei prevê a aposentadoria especial e, para períodos antigos, a conversão do tempo especial em comum.

## Os documentos que comprovam

O Perfil Profissiográfico Previdenciário, o PPP, é emitido pela empresa e descreve a função, os agentes nocivos e o período de exposição. Ele se apoia no Laudo Técnico das Condições Ambientais de Trabalho, o LTCAT. Um PPP incompleto, sem responsável técnico ou com informações que não batem com a função costuma ser a principal causa de negativa.

## Conversão do tempo especial

Para o período trabalhado até 13/11/2019, o tempo especial pode ser multiplicado por um fator e somado ao tempo comum. Em atividade que dá aposentadoria especial aos 25 anos, o fator é 1,4 para o homem e 1,2 para a mulher. Atividades de 20 e de 15 anos têm fatores maiores. Depois dessa data, a Emenda Constitucional 103 vedou a conversão, mas o tempo continua válido para a aposentadoria especial.

## Aposentadoria especial depois da reforma

A regra atual exige tempo de exposição de 15, 20 ou 25 anos conforme o agente, somado a idade mínima ou pontos, com regras de transição para quem já trabalhava antes de 2019. Por isso é importante separar o tempo anterior e o posterior à reforma.

## O que fazer na prática

- Peça à empresa o PPP atualizado e confira função, datas e agentes.
- Guarde carteira, contracheques e qualquer documento que mostre o ambiente de trabalho.
- Em empresa fechada, existem caminhos alternativos de prova, inclusive judiciais.
- Simule o efeito da conversão antes de escolher a regra de aposentadoria.
$a$, $a$tempo-de-contribuicao$a$, $a$Conteúdo informativo. O reconhecimento do tempo especial depende de prova e da análise de cada caso.$a$, '2026-10-11', 4, 'publicado', 'manual'),
($a$auxilio-acidente-quem-tem-direito$a$, $a$Auxílio-acidente: o benefício de quem fica com sequela e continua trabalhando$a$, $a$O auxílio-acidente é uma indenização mensal paga a quem sofre acidente e fica com sequela que reduz a capacidade de trabalho. Veja requisitos, valor, quem pode pedir e como funciona.$a$, $a$Nem todo acidente termina com a recuperação total. Muita gente volta ao trabalho, mas com uma limitação que não existia antes: perde força na mão, não consegue mais ficar muito tempo em pé, tem movimento reduzido no joelho ou no ombro. Para essas situações existe o auxílio-acidente, benefício que costuma ser pouco conhecido e, por isso, pouco pedido.

## O que é o auxílio-acidente

É uma indenização mensal paga pelo INSS ao segurado que, depois de consolidadas as lesões de um acidente, fica com sequela que reduz a sua capacidade para o trabalho que exercia. O ponto central é a redução da capacidade, e não a incapacidade total. Por isso a pessoa pode continuar trabalhando e receber o benefício ao mesmo tempo.

## Acidente de qualquer natureza

A lei fala em acidente de qualquer natureza. Isso inclui o acidente de trabalho, o acidente de trajeto e também acidentes que não têm relação com o emprego, como uma queda em casa ou um acidente de trânsito no fim de semana. Doenças ligadas ao trabalho, quando equiparadas a acidente, também podem entrar.

## Quem pode receber

A lei limita o auxílio-acidente a algumas categorias de segurado: empregados (inclusive domésticos), trabalhadores avulsos e segurados especiais. Contribuintes individuais e segurados facultativos não têm direito a esse benefício. Também é preciso ter qualidade de segurado na data do acidente.

## Carência

O auxílio-acidente não exige número mínimo de contribuições. A carência é dispensada, mas a qualidade de segurado precisa estar em dia na data do acidente.

## Como e quando começa

Em regra, o auxílio-acidente começa no dia seguinte ao fim do auxílio por incapacidade temporária (auxílio-doença). Em outras palavras, a pessoa se afasta, recebe o auxílio-doença, recebe alta e, se ficou sequela, passa a ter direito ao auxílio-acidente. Quando não houve afastamento pelo INSS, o pedido pode ser feito a partir da consolidação da sequela, com a comprovação do acidente e da redução.

## Quanto paga

O valor corresponde a 50% do salário de benefício, que é calculado sobre a média dos salários de contribuição. Como o auxílio-acidente tem natureza de indenização e não de substituição de salário, ele pode ficar abaixo do salário mínimo.

## Pode acumular com salário?

Sim. A pessoa pode continuar trabalhando e recebendo o benefício. O que a lei não permite é acumulá-lo com aposentadoria: o auxílio-acidente deixa de ser pago na véspera do início de qualquer aposentadoria ou do falecimento do segurado. Por isso, antes de se aposentar, vale entender como isso afeta cada caso.

## Como se comprova a redução da capacidade

A prova é, sobretudo, médica. Laudos, exames de imagem, relatórios do especialista e a descrição de como a sequela atrapalha o trabalho do dia a dia são decisivos. O ponto que mais pesa é a relação entre a lesão e a atividade habitual: a mesma sequela pode ser pouco relevante para um trabalho de escritório e grave para quem trabalha com as mãos, em pé ou carregando peso. Há decisões do STJ que admitem o benefício mesmo quando a redução é de grau mínimo, desde que comprovada.

## Se o INSS negar

É comum o INSS negar sob o argumento de que não há redução da capacidade. Nesse caso é possível recorrer administrativamente ou buscar a via judicial, onde a perícia costuma ser mais detalhada. Reúna cedo a documentação do acidente e do tratamento: comunicação de acidente de trabalho (CAT), prontuários, exames e relatórios com a descrição das limitações.
$a$, $a$auxilio-doenca$a$, $a$Conteúdo informativo. O direito ao auxílio-acidente depende da prova médica e da situação concreta de cada segurado.$a$, '2026-10-11', 1, 'publicado', 'manual'),
($a$auxilio-doenca-incapacidade-temporaria$a$, $a$Auxílio por incapacidade temporária (auxílio-doença): requisitos, perícia e negativa$a$, $a$Entenda a carência de 12 contribuições, a qualidade de segurado, como funciona a perícia do INSS, quanto se recebe e o que fazer se o pedido for negado.$a$, $a$O auxílio por incapacidade temporária, conhecido como auxílio-doença, é pago a quem, por doença ou acidente, fica impossibilitado de trabalhar por mais de 15 dias. Ele depende de três pontos: qualidade de segurado, carência e incapacidade comprovada.

## Carência e qualidade de segurado

Em regra, são necessárias 12 contribuições mensais. A carência é dispensada em acidente de qualquer natureza, acidente de trabalho e doenças graves previstas em lista oficial. Além disso, é preciso manter a qualidade de segurado, que em geral dura 12 meses após a última contribuição, com prorrogações previstas em lei.

## Quanto se recebe

O valor é de 91% da média dos salários de contribuição, observando o limite da média dos 12 últimos salários, quando ela for menor. O benefício não pode ser inferior ao salário mínimo ({{salario_minimo}}) nem superior ao teto do INSS ({{teto}}).

## Os 15 primeiros dias

Para o empregado com carteira assinada, a empresa paga os 15 primeiros dias, e o INSS passa a pagar a partir do 16º. Para os demais segurados, o INSS paga desde o início da incapacidade, se o pedido for feito dentro do prazo legal.

## A perícia

O perito avalia se há incapacidade para a atividade que a pessoa exerce. Levar relatório do médico assistente, com CID, tempo de tratamento, exames e a descrição das limitações para o trabalho, ajuda a mostrar a realidade do caso. O que o perito vê no dia pesa muito, por isso vale organizar a documentação antes.

## Se o pedido for negado

Cabe recurso administrativo no prazo de 30 dias da ciência da decisão, ou novo pedido com documentos atualizados. A via judicial não exige o esgotamento da administrativa. A decisão deve ser analisada com cuidado, porque o motivo da negativa (falta de carência, de qualidade de segurado ou de incapacidade) define o caminho.
$a$, $a$auxilio-doenca$a$, $a$Conteúdo informativo. Cada caso depende da prova médica e do histórico contributivo.$a$, '2026-10-11', 7, 'publicado', 'manual'),
($a$bpc-loas-quem-tem-direito$a$, $a$BPC/LOAS: quem tem direito ao benefício assistencial e quais são os requisitos$a$, $a$O BPC/LOAS paga um salário mínimo a idosos e pessoas com deficiência de baixa renda. Veja os requisitos, o limite de renda por pessoa e os erros que levam à negativa.$a$, $a$O Benefício de Prestação Continuada, o BPC, também chamado de LOAS, garante um salário mínimo por mês a quem não consegue se sustentar e não tem quem o sustente. Não é aposentadoria: não exige contribuição ao INSS, mas exige comprovar vulnerabilidade.

## Quem pode pedir

- Pessoa com 65 anos ou mais.
- Pessoa com deficiência, de qualquer idade, com impedimento de longo prazo (a lei considera o prazo de dois anos ou mais) que dificulte a participação plena na sociedade.

## Limite de renda

A regra geral é renda mensal por pessoa da família inferior a 1/4 do salário mínimo. Em {{ano}}, isso equivale a {{bpc_limite}} por pessoa. A Lei 14.176/2021 permite considerar até 1/2 salário mínimo ({{bpc_limite_meio}}) por pessoa, conforme critérios como grau de deficiência e gastos com saúde. Por isso a análise da renda não se resume a uma conta simples.

## Quem entra na conta da família

Contam os integrantes que vivem sob o mesmo teto: o requerente, cônjuge ou companheiro, pais (inclusive padrasto e madrasta), irmãos solteiros, filhos e enteados solteiros e menores tutelados. A lei também prevê que o benefício assistencial de um idoso ou de pessoa com deficiência da família, no valor de até um salário mínimo, não entra no cálculo.

## Documentos e cadastro

É indispensável estar inscrito no Cadastro Único, o CadÚnico, com dados atualizados. Para a pessoa com deficiência, há avaliação médica e social. Informações desencontradas entre o CadÚnico e o pedido são causa frequente de indeferimento.

## O que o BPC não dá

O BPC não gera 13º salário nem pensão por morte aos dependentes, e é revisto periodicamente. Também não pode ser acumulado com outro benefício da seguridade social, salvo exceções previstas em lei.
$a$, $a$bpc-loas$a$, $a$Conteúdo informativo. O direito depende da renda e da situação concreta da família.$a$, '2026-10-11', 5, 'publicado', 'manual'),
($a$como-ler-o-cnis$a$, $a$Como ler o CNIS e o que conferir antes de pedir o benefício$a$, $a$O CNIS é a base de todo cálculo do INSS. Veja como obtê-lo, o que cada parte significa e quais erros e lacunas conferir antes de qualquer pedido.$a$, $a$O Cadastro Nacional de Informações Sociais, o CNIS, é o histórico que o INSS usa para contar tempo e calcular o valor do benefício. Se algo estiver errado ali, o erro segue para o cálculo. Por isso conferir o extrato é o primeiro passo de qualquer planejamento.

## Onde obter

O extrato é emitido gratuitamente pelo aplicativo ou site Meu INSS, na área de extratos. Peça a versão completa, com vínculos, remunerações e contribuições.

## O que olhar primeiro

- Vínculos sem data de fim, que podem indicar emprego encerrado e nunca baixado no sistema.
- Meses sem remuneração dentro de um vínculo registrado, sinal de possível falha de recolhimento do empregador.
- Mesmo empregador aparecendo com nomes ou CNPJs diferentes, o que pode fragmentar o tempo.
- Períodos de trabalho que você tem na carteira e que não aparecem no extrato.
- Salários que parecem menores do que você realmente recebeu.

## Indicadores e pendências

Ao lado de vínculos e contribuições, o CNIS traz indicadores. O PREC-MENOR-MIN, por exemplo, aponta contribuição abaixo do mínimo e pode impedir que aquele mês conte como carência. O PEXT indica recolhimento feito fora do prazo. Cada indicador pede um tipo de regularização, e alguns exigem prova documental.

## Como corrigir

Carteira de trabalho, contracheques, termo de rescisão, contratos e extratos do FGTS ajudam a comprovar vínculos e salários ausentes. Em muitos casos a correção é feita administrativamente no próprio INSS, e em outros só pela via judicial.

## Por que isso muda o valor

O benefício é calculado sobre a média dos salários de contribuição desde julho de 1994. Uma remuneração que falta no extrato pode reduzir a média e, com isso, o valor mensal pelo resto da vida. Vale revisar antes de pedir, e não depois da concessão.
$a$, $a$tempo-de-contribuicao$a$, $a$Conteúdo informativo. A análise do CNIS deve considerar os documentos do seu caso.$a$, '2026-10-11', 3, 'publicado', 'manual'),
($a$pensao-por-morte-regras$a$, $a$Pensão por morte: quem recebe, por quanto tempo e como é calculada$a$, $a$Descubra quem são os dependentes, como a duração da pensão varia com a idade do cônjuge, qual a carência exigida e como o valor é calculado após a reforma.$a$, $a$A pensão por morte protege os dependentes de quem faleceu enquanto era segurado ou aposentado. Desde a reforma de 2019, o valor e a duração mudaram bastante, e muita gente ainda espera as regras antigas.

## Quem são os dependentes

- Cônjuge ou companheiro(a), e filhos menores de 21 anos ou com deficiência, formam a primeira classe e não precisam provar dependência econômica.
- Na falta deles, os pais.
- Na falta dos anteriores, irmãos menores de 21 anos ou com deficiência.

## Como se calcula o valor

A pensão parte de uma cota familiar de 50% do valor da aposentadoria que o segurado recebia, ou da que receberia se estivesse aposentado por incapacidade permanente na data do óbito. A essa cota somam-se 10% por dependente, até 100%. Se há dependente com invalidez ou deficiência grave, a cota pode chegar a 100% do valor.

## Quanto tempo dura para o cônjuge

Depende da idade do cônjuge ou companheiro no dia do falecimento, desde que cumpridos os requisitos de carência: com idade até 21 anos, três anos; de 22 a 27, seis anos; de 28 a 30, dez anos; de 31 a 41, quinze anos; de 42 a 44, vinte anos; a partir de 45, vitalícia. As faixas podem ser atualizadas por portaria, então confira a tabela vigente.

## Carência e tempo de união

Para ter direito à duração por faixa de idade, o segurado deve ter vertido ao menos 18 contribuições mensais e a união deve ter durado pelo menos dois anos. Sem isso, a pensão dura apenas quatro meses, salvo quando a morte decorre de acidente ou de doença profissional ou do trabalho.

## Cuidados na hora de pedir

Reúna certidão de casamento ou provas da união estável, documentos dos filhos e extrato CNIS do falecido. O pedido deve ser feito logo: feito em até 90 dias do óbito, o pagamento retroage à data do falecimento; depois disso, pode contar apenas do requerimento.
$a$, $a$pensao-por-morte$a$, $a$Conteúdo informativo. Valores e prazos devem ser conferidos na tabela vigente e no seu caso.$a$, '2026-10-11', 6, 'publicado', 'manual'),
($a$qualidade-de-segurado-periodo-de-graca$a$, $a$Qualidade de segurado e período de graça: até quando você continua protegido pelo INSS$a$, $a$Parar de contribuir não faz perder os direitos de imediato. Entenda o período de graça, suas prorrogações e como a perda da qualidade de segurado afeta os benefícios.$a$, $a$Ser segurado é estar protegido pelo INSS e poder receber benefícios como auxílio por incapacidade e pensão por morte. Quem para de contribuir não perde isso na hora: a lei concede um prazo, o chamado período de graça.

## Quanto dura o período de graça

- Segurado que deixa de exercer atividade ou de contribuir: 12 meses depois da cessação.
- Quem já pagou mais de 120 contribuições mensais sem interrupção que tenha causado a perda da qualidade: o prazo sobe para 24 meses.
- Segurado desempregado, com situação comprovada no órgão competente: soma 12 meses ao prazo que ele tiver.
- Segurado facultativo: 6 meses após a última contribuição.

## Por que isso importa

O direito a benefícios como auxílio por incapacidade temporária e pensão por morte depende de o segurado estar dentro dessa proteção quando ocorre o fato, ou seja, no início da incapacidade ou no falecimento. Quem perde a qualidade precisa voltar a contribuir e cumprir parte da carência de novo para recuperá-la.

## Como ficou nas contas

A lei fixa o fim do prazo no dia 15 do segundo mês seguinte ao término do período de graça. Pequenas diferenças de data podem decidir um caso, por isso conferir o CNIS é indispensável.

## Dica prática

Se você está parado, doente ou desempregado, avalie contribuir como facultativo para manter a proteção. Faça essa conta com atenção às datas e às alíquotas corretas.
$a$, $a$auxilio-doenca$a$, $a$Conteúdo informativo. O prazo exato depende do histórico de cada segurado.$a$, '2026-10-11', 8, 'publicado', 'manual'),
($a$regras-de-transicao-aposentadoria$a$, $a$As regras de transição da aposentadoria: qual delas serve para você$a$, $a$Entenda as quatro regras de transição da Reforma da Previdência (pontos, idade mínima progressiva e os pedágios de 50% e 100%) e como saber a sua.$a$, $a$Quem já contribuía ao INSS em 13 de novembro de 2019, data da Emenda Constitucional 103, não foi obrigado a seguir direto a regra nova. Existem quatro regras de transição, e a melhor para cada pessoa depende de idade, sexo e tempo de contribuição. Conhecê-las evita pedir o benefício na regra errada ou esperar mais tempo do que o necessário.

## 1. Regra dos pontos

Soma a idade com o tempo de contribuição. Em 2019 eram 86 pontos para a mulher e 96 para o homem, com acréscimo de um ponto por ano até chegar a 100 e 105. Em 2026, a exigência é de 93 pontos para a mulher e 103 para o homem. Além dos pontos, é preciso ter no mínimo 30 anos de contribuição (mulher) ou 35 anos (homem).

## 2. Idade mínima progressiva

Combina tempo de contribuição mínimo (30 anos para a mulher, 35 para o homem) com uma idade mínima que sobe seis meses por ano. Começou em 56 anos para a mulher e 61 para o homem, e termina em 62 e 65. Em 2026, a exigência é de 59 anos e 6 meses para a mulher e 64 anos e 6 meses para o homem.

## 3. Pedágio de 50%

Vale apenas para quem, em 13/11/2019, estava a no máximo dois anos de completar o tempo mínimo (30 ou 35 anos). A pessoa cumpre o tempo que faltava mais 50% sobre ele. Nessa regra incide o fator previdenciário, que pode reduzir o valor do benefício, por isso ela só compensa em situações específicas.

## 4. Pedágio de 100%

Exige idade mínima de 57 anos (mulher) ou 60 anos (homem), o tempo mínimo de contribuição e o cumprimento de um pedágio igual ao tempo que faltava em 13/11/2019. O valor do benefício é de 100% da média salarial, o que costuma torná-la atraente para quem está perto de se aposentar.

## E a regra permanente?

Quem começou a contribuir depois da reforma segue a regra permanente: 62 anos de idade e 15 anos de contribuição para a mulher, 65 anos e 20 anos para o homem. O valor parte de 60% da média e sobe 2 pontos percentuais por ano de contribuição acima de 20 anos (homem) ou 15 anos (mulher).

## Como descobrir a sua regra

O ponto de partida é o extrato CNIS completo, com todos os vínculos e contribuições. Sem ele, qualquer simulação é uma estimativa. O simulador deste site compara as regras e mostra qual delas você completa primeiro, mas a confirmação depende de conferir períodos, lacunas e atividade especial.
$a$, $a$simulador-de-aposentadoria$a$, $a$Conteúdo informativo. A aplicação das regras depende do histórico de cada pessoa.$a$, '2026-10-11', 2, 'publicado', 'manual')
on conflict (slug) do nothing;

-- Permite ao admin excluir os dados de um lead (pedido do titular pela LGPD)
grant delete on public.leads to authenticated;
drop policy if exists leads_admin_delete on public.leads;
create policy leads_admin_delete on public.leads for delete to authenticated using (public.is_admin());
