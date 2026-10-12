# Calculadoras previdenciárias — Breno Proenço

Site estático (HTML, CSS e JavaScript puros, sem dependências). Funciona em qualquer hospedagem.

## Como o site é gerado
- `npm run build` (ou `node build.js`) lê os textos e gera o site pronto na pasta `dist/`.
- Na primeira vez, rode `npm install`. Ele instala dois pacotes, usados para ler os artigos em Markdown.
- O Netlify faz isso sozinho a cada alteração, conforme o arquivo `netlify.toml`.

## Publicar com o painel de artigos (GitHub + Netlify)
1. **GitHub:** crie um repositório (pode ser privado) e envie esta pasta inteira para ele. `node_modules/` e `dist/` ficam de fora pelo `.gitignore`.
2. **Netlify:** em app.netlify.com, **Add new site → Import an existing project → GitHub** e escolha o repositório. O comando e a pasta de publicação já vêm do `netlify.toml`. Clique em **Deploy**.
3. **Login do painel (uma vez só):**
   - No GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**. *Homepage URL*: o endereço do site. *Authorization callback URL*: `https://api.netlify.com/auth/done`. Gere o *Client secret*.
   - No Netlify: **Site configuration → Access & security → OAuth → Install provider → GitHub**, e cole o *Client ID* e o *Client secret*.
4. O repositório já está configurado em `admin/config.yml` (`brenoproensso-cpu/brenoproencoadv`).
5. Acesse `seusite.com.br/admin`, clique em **Entrar com GitHub** e pronto.

## Escrever um artigo pelo painel
- **Artigos → Novo artigo.** Preencha título, descrição curta, data, calculadora relacionada e o texto.
- Use **Título 2** para os subtítulos, e os botões do editor para listas e negrito.
- Para valores que mudam todo ano, escreva `{{salario_minimo}}`, `{{teto}}`, `{{bpc_limite}}`, `{{bpc_limite_meio}}` ou `{{ano}}`. O site preenche com os números de `assets/config.js`.
- Marque **Rascunho** para salvar sem publicar.
- Ao clicar em **Publicar**, o Netlify gera o site de novo. Em cerca de 1 minuto o artigo aparece na página de artigos, na página inicial (os 3 mais recentes) e no sitemap.

## Publicar sem o painel (alternativa)
Rode `npm install && npm run build` e arraste a pasta `dist/` em **Sites → Add new site → Deploy manually**. Para um artigo novo, copie um arquivo `.md` de `conteudo/artigos/` e edite.

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
- `conteudo/artigos/` — artigos em Markdown (editados pelo painel)
- `admin/` — painel de artigos (Decap CMS)
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
7. Painel: `seusite.com.br/admin/estatisticas.html` (os artigos continuam em `/admin/`).
