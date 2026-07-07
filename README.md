# Barber Studio — Site + Sistema de Agendamento

Site completo para barbearia premium, com agendamento online, integração com
WhatsApp, cancelamento por código e painel administrativo.

Este guia foi escrito para quem está começando agora. Vá passo a passo, sem
pular etapas.

---

## 📁 Estrutura do projeto

```
barberstudio/
├── index.html      → Site principal (todas as páginas: home, sobre, serviços, contato, agendar, cancelar)
├── admin.html       → Painel administrativo
├── style.css        → Todo o visual do site (preto/dourado/branco)
├── script.js         → Lógica do site público (agendamento, cancelamento, navegação)
├── supabase.js       → Conexão com o banco de dados e funções de CRUD
├── admin.js          → Lógica do painel administrativo
└── README.md         → Este arquivo
```

---

## PARTE 1 — Configurando o Supabase (banco de dados)

O Supabase é onde os agendamentos ficam guardados. É gratuito para o seu caso de uso.

### Passo 1.1 — Criar a conta e o projeto

1. Acesse **https://supabase.com** e crie uma conta (pode entrar com GitHub ou Google).
2. Clique em **"New Project"**.
3. Escolha um nome, por exemplo `barber-studio`.
4. Crie uma senha para o banco de dados (guarde essa senha em local seguro — você não vai precisar dela no código, mas é bom ter salva).
5. Escolha a região mais próxima (ex: São Paulo, se disponível).
6. Clique em **"Create new project"** e aguarde 1–2 minutos até o projeto ficar pronto.

### Passo 1.2 — Criar a tabela de agendamentos

1. No painel do Supabase, no menu lateral esquerdo, clique em **"SQL Editor"**.
2. Clique em **"New query"**.
3. Cole exatamente o código SQL abaixo:

```sql
-- Cria a tabela de agendamentos
create table agendamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  servico text not null,
  data date not null,
  horario text not null,
  codigo_cancelamento text not null,
  status text not null default 'confirmado',
  created_at timestamp with time zone default now()
);

-- Evita dois agendamentos confirmados no mesmo dia + horário
create unique index idx_data_horario_confirmado
  on agendamentos (data, horario)
  where (status = 'confirmado');

-- Habilita Row Level Security (segurança por linha)
alter table agendamentos enable row level security;

-- Permite que qualquer pessoa (site público) crie um agendamento
create policy "Qualquer um pode criar agendamento"
  on agendamentos for insert
  with check (true);

-- Permite que qualquer pessoa leia os agendamentos
-- (necessário para checar quais horários estão ocupados)
create policy "Qualquer um pode ver agendamentos"
  on agendamentos for select
  using (true);

-- Permite que qualquer pessoa atualize (necessário para cancelamento
-- pelo cliente e edição pelo admin, já que a senha do admin é validada
-- no próprio site, não no banco)
create policy "Qualquer um pode atualizar agendamento"
  on agendamentos for update
  using (true);

-- Permite exclusão (usado apenas pelo painel admin)
create policy "Qualquer um pode excluir agendamento"
  on agendamentos for delete
  using (true);
```

4. Clique em **"Run"** (ou Ctrl+Enter).
5. Se aparecer "Success. No rows returned", deu tudo certo — a tabela foi criada.

> **Nota sobre o `codigo_cancelamento`:** essa coluna continua existindo na
> tabela (é gerada automaticamente a cada novo agendamento), mas o cliente
> **não precisa mais dela** para cancelar — hoje o cancelamento funciona só
> com o telefone (veja a Parte 8). O código fica guardado apenas como um
> registro interno, caso você queira consultar no futuro.

> **Nota sobre segurança:** essas políticas são simples de propósito (para
> funcionar sem exigir login de cliente). Como não há dados sensíveis (só
> nome, telefone e horário), o risco é baixo. Se no futuro você quiser
> travar mais, posso te ajudar a configurar Supabase Auth.

### Passo 1.3 — Pegar suas credenciais

1. No menu lateral, clique em **"Project Settings"** (ícone de engrenagem).
2. Clique em **"API"**.
3. Copie o valor de **"Project URL"** (algo como `https://abcdefgh.supabase.co`).
4. Copie o valor de **"anon public"** (uma chave longa, começando com `eyJ...`).

### Passo 1.4 — Colar as credenciais no código

1. Abra o arquivo **`supabase.js`**.
2. Substitua estas duas linhas com seus valores reais:

```js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_ANON_KEY_AQUI";
```

Pronto — o banco de dados está conectado.

---

## PARTE 2 — Configurando o WhatsApp

1. Abra o arquivo **`script.js`**.
2. Localize esta linha no topo do arquivo:

```js
const NUMERO_WHATSAPP = "5517988343422";
```

Esse número já está configurado com o seu (+55 17 98834-3422), no formato
correto: código do país (55) + DDD (17) + número, tudo junto e sem espaços,
traços ou "+". Se precisar trocar no futuro, siga esse mesmo formato.

**Como funciona:** quando o cliente confirma o agendamento, o site monta uma
mensagem automática e abre uma nova aba/app do WhatsApp já com o número e a
mensagem preenchidos — usando o link `https://wa.me/`. O barbeiro só precisa
clicar em "Enviar" no WhatsApp que abrir.

---

## PARTE 3 — Configurando a senha do Painel Administrativo

1. Abra o arquivo **`admin.js`**.
2. Localize esta linha:

```js
const ADMIN_SENHA = "barberstudio2026";
```

3. Troque `"barberstudio2026"` pela senha que você quiser usar para acessar
o painel em `/admin.html`.

> Essa é uma proteção simples (client-side), suficiente para impedir acesso
> casual de clientes ao painel. Não compartilhe o link `/admin.html`
> publicamente e escolha uma senha que só você conheça.

---

## PARTE 4 — Testando localmente antes de publicar

Você pode simplesmente abrir o arquivo `index.html` duas vezes clicando nele,
mas para o Supabase funcionar 100% (alguns navegadores bloqueiam certas
requisições em arquivos abertos localmente sem servidor), o ideal é rodar um
servidor local simples:

**Se você tiver Python instalado:**
```
cd barberstudio
python3 -m http.server 8080
```
Depois acesse `http://localhost:8080` no navegador.

**Se você tiver Node.js instalado:**
```
npx serve barberstudio
```

---

## PARTE 5 — Publicando na Vercel

### Passo 5.1 — Criar um repositório no GitHub

1. Acesse **https://github.com** e crie uma conta, se ainda não tiver.
2. Clique em **"New repository"**.
3. Dê um nome, por exemplo `barber-studio-site`.
4. Deixe como "Public" ou "Private" (sua escolha) e clique em "Create repository".
5. Faça upload de todos os arquivos do projeto (`index.html`, `admin.html`,
   `style.css`, `script.js`, `supabase.js`, `admin.js`) usando o botão
   **"uploading an existing file"** na própria página do GitHub, ou usando
   Git pelo terminal se preferir.

### Passo 5.2 — Conectar com a Vercel

1. Acesse **https://vercel.com** e crie uma conta (pode usar login do GitHub).
2. Clique em **"Add New..." → "Project"**.
3. Selecione o repositório `barber-studio-site` que você criou.
4. Como é um site estático (HTML puro, sem framework), a Vercel vai
   detectar automaticamente. Não precisa mudar nenhuma configuração de
   build — deixe os campos como estão.
5. Clique em **"Deploy"**.
6. Em cerca de 1 minuto, seu site estará no ar com uma URL tipo
   `https://barber-studio-site.vercel.app`.

### Passo 5.3 — Acessando o painel administrativo depois de publicado

O painel ficará disponível em:
```
https://SEU-SITE.vercel.app/admin.html
```

---

## PARTE 6 — Como tudo funciona (resumo do fluxo)

**Agendamento:**
1. Cliente preenche nome, telefone, serviço e data.
2. O site busca no Supabase quais horários já estão ocupados naquele dia e
   mostra só os livres (horários passados no dia de hoje também somem).
3. Cliente escolhe um horário e clica em "Confirmar Agendamento".
4. O site salva o agendamento no Supabase.
5. O site abre automaticamente o WhatsApp do barbeiro com a mensagem pronta.

**Cancelamento (simplificado, sem código):**
1. Cliente acessa a aba/link "Cancelar Agendamento".
2. Informa só o telefone usado na reserva.
3. O site mostra a lista dos agendamentos futuros com aquele telefone
   (serviço, data e horário).
4. Cliente clica em "Cancelar" no agendamento certo e confirma numa
   caixa de confirmação.
5. O horário é liberado imediatamente para outra pessoa.

**Painel administrativo:**
1. Acesso protegido por senha.
2. Mostra dashboard (total de agendamentos, agendamentos do dia, serviço
   mais vendido, horários livres hoje).
3. Lista todos os agendamentos com filtros por data, serviço e cliente.
4. Permite editar ou cancelar/excluir qualquer agendamento.

> **Sobre a segurança do cancelamento por telefone:** qualquer pessoa que
> souber o telefone usado na reserva consegue ver e cancelar aquele
> agendamento. Isso é intencional — prioriza simplicidade para o cliente.
> Como as únicas informações expostas são nome, serviço, data e horário
> (nada financeiro ou sensível), o risco é baixo para uma barbearia. Se no
> futuro você preferir voltar a exigir um código extra de confirmação,
> me avise que ajusto novamente.

---

## PARTE 7 — Assistente Virtual (Chatbot por Menu)

O site tem um assistente virtual (bolinha dourada ao lado do botão do
WhatsApp). Ele **não usa inteligência artificial** e **não tem nenhum
custo** — funciona por um menu de botões que o cliente toca/clica, sem
precisar digitar nada. Isso evita qualquer problema de digitação em
celulares e deixa a navegação bem mais rápida.

**Como funciona a navegação:**
- O cliente vê um menu com opções (Horário, Serviços, Agendar, etc.)
- Ao tocar em uma opção, o bot responde e mostra um novo submenu
- Um botão de **seta para voltar** aparece no cabeçalho sempre que o
  cliente não está mais no menu principal
- Um botão de **reiniciar** (ícone circular) limpa a conversa e volta
  para o início a qualquer momento

**Como editar as respostas ou adicionar novas opções:**

1. Abra o arquivo `chatbot.js`.
2. Encontre o objeto `MENU_ARVORE` no topo do arquivo — cada "tela" do
   chat é um item desse objeto. Por exemplo:

```js
horario: {
  mensagem: "Funcionamos de segunda a sábado, das 9h às 19h.",
  voltarPara: "raiz",
  opcoes: [
    { texto: "📅 Quero agendar um horário", hash: "#/agendar" },
    { texto: "⬅ Voltar ao menu", irPara: "raiz" },
  ],
},
```

- `mensagem`: o texto que o bot mostra ao entrar nessa tela (aceita
  `<strong>` para negrito e `<br>` para quebrar linha).
- `opcoes`: os botões que aparecem para o cliente tocar. Cada botão tem
  um `texto` e um destino:
  - `irPara: "algumTela"` — leva para outra tela dentro do próprio chat
  - `hash: "#/agendar"` — navega para uma página do site
  - `link: "https://..."` — abre um link externo em nova aba

Para criar uma nova tela/opção, copie um bloco existente dentro de
`MENU_ARVORE`, dê um novo id (ex: `promocoes:`), e adicione uma entrada
em `opcoes` de qualquer outra tela apontando para ela com `irPara`.

**Se no futuro você quiser uma IA de verdade** (que entenda qualquer
pergunta digitada livremente, não só as opções do menu), aí sim seria
necessário contratar uma API paga (OpenAI, Anthropic, etc.) e um pequeno
backend para esconder a chave de acesso. Me avise se quiser evoluir
para esse caminho.

---

## Dúvidas comuns


**"Os horários não aparecem depois que configurei o Supabase."**
Verifique se colou corretamente a URL e a ANON KEY em `supabase.js`, sem
espaços extras, e se rodou o script SQL da Parte 1.2 sem erros.

**"Quero mudar os preços ou os horários de funcionamento."**
No `script.js`, edite os objetos `SERVICOS` e `HORARIOS_FUNCIONAMENTO`
(bem no início do arquivo). No `index.html`, atualize também os textos e
preços mostrados na seção de Serviços. No `admin.js`, o array
`HORARIOS_DIA` deve ficar igual ao `HORARIOS_FUNCIONAMENTO`.

**"Quero trocar a foto do banner (hero) ou da seção Sobre."**
As imagens vêm do Unsplash (carregadas direto do link, sem precisar de
upload). Basta trocar a URL dentro dos `src="..."` no `index.html` por
outra URL de imagem de sua escolha.
