# Calculadoras previdenciárias — Breno Proenço

**Hospedagem atual: Cloudflare Pages** (`brenoproencoadv.pages.dev`). Cada envio ao GitHub publica o site sozinho; o botão Publicar do painel usa o *deploy hook* gravado em `ajustes.BUILD_HOOK`. O endereço antigo do Netlify só redireciona para o novo.

Site estático (HTML, CSS e JavaScript puros, sem dependências). Funciona em qualquer hospedagem.

## Como o site é gerado
- `npm run build` (ou `node build.js`) lê os textos e gera o site pronto na pasta `dist/`.
- Na primeira vez, rode `npm install`. Ele instala dois pacotes, usados para ler os artigos em Markdown.
- O Netlify faz isso sozinho a cada alteração, conforme o arquivo `netlify.toml`.

## Painel único (/admin)
Um só login, o mesmo e-mail e senha cadastrados no Supabase, para três abas:
- **Estatísticas:** visitas, cálculos, origens, aparelhos e conversão.
- **Leads:** situação, próximo contato, anotações, exportar CSV e **Excluir dados**, para atender pedidos de exclusão pela LGPD.
- **Artigos:** criar, editar com prévia, salvar rascunho, publicar, tirar do ar e excluir. Rascunhos feitos pela IA aparecem com a etiqueta "IA" e uma caixa com os pontos a conferir.

**Como a publicação funciona:** os artigos ficam na tabela `artigos` do Supabase. O público só lê os publicados; só admins escrevem. Ao clicar em **Publicar**, o painel chama a função `publicar`, que confere se você é admin e aciona o *build hook* do Netlify. O site é gerado de novo, lendo os artigos do Supabase, em cerca de 1 minuto.

**Configuração (uma vez)**
1. Rode `supabase/instalar-artigos.sql` inteiro no SQL Editor.
2. No Netlify: **Site configuration → Build & deploy → Build hooks → Add build hook**, com o nome `Painel` e a branch `main`. Copie a URL.
3. Grave a URL na tabela protegida `ajustes` pelo SQL Editor (ou como segredo `NETLIFY_BUILD_HOOK` em Edge Functions → Secrets):
   `insert into ajustes (chave, valor) values ('NETLIFY_BUILD_HOOK', 'URL-DO-HOOK') on conflict (chave) do update set valor = excluded.valor;`
   Faça o mesmo para `ALLOWED_ORIGINS` (endereços do site, separados por vírgula) e `IP_SALT` (texto aleatório longo). A tabela `ajustes` não pode ser lida pelo público nem pelo painel, só pelas funções.

## Modo offline
Sem Supabase configurado (ou com `ARTIGOS_OFFLINE=1`), o build usa os arquivos `.md` de `conteudo/artigos/`, que guardam uma cópia dos artigos iniciais.

## O que trocar antes de publicar
Tudo está em `assets/config.js`:
- `whatsapp`: seu número (só números, com 55 + DDD). Já configurado.
- `marca`: nome, instagram, OAB e cidade.
- `salarioMinimo` e `teto`: atualize todo mês de janeiro (Portaria Interministerial MPS/MF).
- `pensaoFaixas`: faixas de duração da pensão por morte. Confira se saiu portaria nova.
- `leadEndpoint`: deixe vazio para só abrir o WhatsApp. Quando ligar um banco (ex.: Supabase Edge Function), coloque a URL aqui e o formulário passa a enviar nome, WhatsApp, a calculadora usada, os dados informados e o resultado.

## Alterar textos, FAQs ou campos
Edite `build.js` e rode `node build.js` para regenerar as páginas. Os cálculos ficam em `assets/calc.js` (funções puras, uma por calculadora).

## Estrutura
- `build.js` — gera todas as páginas em `dist/`
- `conteudo/artigos/` — cópia offline dos artigos iniciais (os artigos de verdade ficam no Supabase)
- `admin/` — painel único (estatísticas, leads e artigos)
- Páginas geradas: `index.html` (início), `sobre.html`, `artigos.html`, `politica-de-privacidade.html`
- `tempo-de-contribuicao.html`, `simulador-de-aposentadoria.html`, `valor-do-beneficio.html`, `bpc-loas.html`, `pensao-por-morte.html`, `auxilio-doenca.html`
- `assets/` — `config.js`, `calc.js`, `app.js`, `style.css`

## Cuidados (OAB)
Os textos evitam promessa de resultado e oferta de gratuidade (Provimento 205/2021). Revise antes de publicar e mantenha o aviso de que o resultado é uma estimativa.

## Limitações conhecidas
- O simulador supõe contribuição contínua e estima o tempo que a pessoa tinha em 13/11/2019 (isso afeta os pedágios). O resultado real depende do CNIS.
- Tempo rural, serviço público, períodos especiais não reconhecidos e lacunas do CNIS não são calculados.
- Fator previdenciário (pedágio de 50%) não é calculado; a página apenas avisa que ele se aplica.

## Artigos (SEO e conscientização)
- Cada artigo é um arquivo em `conteudo/artigos/` e vira a página `artigo-<nome-do-arquivo>.html`, com título, descrição, dados estruturados e link para a calculadora relacionada. A lista fica em `artigos.html`.
- Em `assets/config.js`, preencha `dominio` (ex.: `https://www.seudominio.com.br`) para gerar `sitemap.xml`, `robots.txt` e links canônicos. Depois, envie o sitemap no Google Search Console.

## Banco de dados (Supabase): leads e estatísticas
**O que é gravado**
- `eventos` (anônimo): visitas, cálculos (calculadora e resumo do resultado) e cliques no WhatsApp, com página, origem (Instagram, Google, UTM), tipo de aparelho e um código de sessão temporário. Sem nome, telefone, IP ou cookie.
- `leads`: nome, WhatsApp, calculadora, resumo, **todos os dados digitados no cálculo**, página e origem, e a prova do consentimento (texto, versão, data e hora). No painel você controla situação, próximo contato e anotações.

**Proteção**
- RLS ligado em todas as tabelas. O público não consegue ler nem gravar nada direto no banco.
- O site só grava pela função `registrar`, que confere a origem (apenas o seu domínio), limita envios por IP (o IP vira um código e é apagado em 24 h), barra robôs e valida cada campo.
- Leitura só para usuário logado cujo e-mail esteja na tabela `admins`. Mesmo logado, o painel só altera situação, próximo contato e anotações. Os dados enviados pela pessoa não podem ser editados.

**Instalação**
1. Aplique `supabase/migrations/20261011_leads_estatisticas.sql` (SQL Editor ou `supabase db push`).
2. Publique a função: `supabase functions deploy registrar --no-verify-jwt`.
3. Em **Edge Functions → Secrets**, crie `ALLOWED_ORIGINS` (ex.: `https://seusite.com.br,https://www.seusite.com.br`) e `IP_SALT` (um texto aleatório longo).
4. Em **Authentication → Providers → Email**, desligue "Allow new users to sign up". Em **Authentication → Users → Add user**, crie o seu login com senha forte.
5. No SQL Editor: `insert into admins (email) values ('seu-email@exemplo.com');`
6. Em `assets/config.js`, preencha `registrarUrl`, `supabaseUrl` e `supabaseAnonKey`.
7. Painel: `seusite.com.br/admin`.

## Links curtos de divulgação
Use estes endereços em vez de colar UTM. Cada um leva para o site já marcando a origem no painel:

| Onde divulgar | Link |
|---|---|
| Bio do Instagram | `brenoproencoadv.netlify.app/ig` |
| Stories | `/stories` |
| Mensagem no WhatsApp | `/zap` |
| Status do WhatsApp | `/status` |
| QR code impresso | `/qr` |
| Cartão de visita | `/cartao` |
| Facebook | `/fb` |
| YouTube | `/yt` |
| Assinatura de e-mail | `/email` |
| Post sobre BPC, auxílio-doença ou aposentadoria | `/bpc`, `/aux`, `/apos` |

Para criar outro, acrescente uma linha na lista `LINKS_CURTOS` do `build.js`.
