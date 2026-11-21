# Plaquinhas QR

Sistema de **QR Codes dinamicos** com painel administrativo. Voce gera o QR Code, manda imprimir na placa de acrilico e depois muda o destino quantas vezes quiser — **a placa impressa nunca precisa ser trocada**.

Cada QR Code carrega uma URL curta do proprio sistema (`https://seudominio.com.br/r/CODIGO`). Quando alguem escaneia, o sistema conta a leitura e redireciona para o link configurado naquele momento.

Dois tipos de QR Code:

- **Link / Redirecionamento** — dinamico: o destino pode ser trocado a qualquer momento, sem trocar a placa.
- **Pix (copia e cola)** — o QR carrega o proprio **BR Code** do Pix, igual ao que o banco gera. Quem paga abre o aplicativo do banco, aponta a camera e o pagamento e montado direto (o valor e digitado pelo cliente). Como o codigo Pix fica gravado na imagem, ele **nao e dinamico**: para trocar a chave e preciso reimprimir a placa.

- Node.js + Express
- MySQL (mysql2)
- Handlebars (server-side)
- Padrao MVC (models / controllers / services / middlewares / routes / views)
- Sem limite de quantidade de QR Codes
- Cor e tamanho personalizaveis + download em PNG 300 dpi + folha de impressao

---

## Requisitos

- Node.js 18 ou superior
- MySQL 5.7+ ou 8.x

## Estrutura de pastas

```
plaquinhas/
├── server.js                     # bootstrap: conecta no banco e sobe o servidor
├── ecosystem.config.js           # configuracao do PM2
├── database/schema.sql           # estrutura do banco
├── scripts/setup-db.js           # cria banco, tabelas e o primeiro admin
├── src/
│   ├── app.js                    # montagem do Express (middlewares + rotas)
│   ├── config/                   # env, database, session, viewEngine
│   ├── models/                   # User, QrCode (acesso ao MySQL)
│   ├── services/                 # regras de negocio (auth, geracao de QR)
│   ├── controllers/              # auth, dashboard, qr, redirect
│   ├── middlewares/              # auth, flash, errorHandler
│   ├── routes/                   # public, admin, index
│   ├── helpers/                  # helpers usados nos templates
│   └── views/                    # layouts, partials e paginas .handlebars
└── public/                       # css, js e imagens
```

---

## Rodando localmente

```bash
npm install
cp .env.example .env      # no Windows: copy .env.example .env
# edite o .env com os dados do seu MySQL e defina SESSION_SECRET
npm run db:setup         # cria o banco, as tabelas e o usuario admin
npm run dev              # servidor com reload automatico
```

Acesse `http://localhost:3000/admin/login` com o `ADMIN_EMAIL` / `ADMIN_PASSWORD` do `.env`.

---

## Deploy na VPS (PM2 + Nginx)

### 1. Preparar a VPS (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y nginx mysql-server git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Criar o banco e o usuario do MySQL

```bash
sudo mysql
```

```sql
CREATE DATABASE plaquinhas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'plaquinhas'@'localhost' IDENTIFIED BY 'UMA_SENHA_FORTE_AQUI';
GRANT ALL PRIVILEGES ON plaquinhas.* TO 'plaquinhas'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Enviar o projeto e configurar

```bash
cd /var/www
git clone <url-do-seu-repositorio> plaquinhas   # ou envie os arquivos por SFTP
cd plaquinhas
npm install --omit=dev

cp .env.example .env
nano .env
```

Ajustes obrigatorios no `.env`:

| Variavel | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://seudominio.com.br` (sem barra no final) |
| `SESSION_SECRET` | string aleatoria longa — gere com `openssl rand -hex 32` |
| `DB_USER` / `DB_PASSWORD` | o usuario que voce criou no passo 2 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | dados do seu primeiro acesso ao painel |

Depois:

```bash
npm run db:setup      # cria as tabelas e o admin (tambem aplica atualizacoes de estrutura)
mkdir -p logs
```

### 4. Subir com PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup           # copie e execute o comando que ele imprimir
```

Comandos do dia a dia:

```bash
pm2 status
pm2 logs plaquinhas
pm2 restart plaquinhas
pm2 reload plaquinhas     # sem downtime
```

### 5. Nginx como proxy reverso

`/etc/nginx/sites-available/plaquinhas`:

```nginx
server {
    listen 80;
    server_name seudominio.com.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # essencial: o sistema usa este header para reconhecer HTTPS
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/plaquinhas /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. HTTPS (obrigatorio em producao)

Com `NODE_ENV=production` o cookie de sessao e marcado como `secure` e so trafega em HTTPS.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com.br
```

### 7. Atualizar depois de mudar o codigo

```bash
cd /var/www/plaquinhas
git pull
npm install --omit=dev
npm run db:setup          # aplica novas colunas/tabelas sem apagar dados existentes
pm2 reload plaquinhas
```

---

## Como o sistema funciona

1. Voce cria um QR Code no painel escolhendo o **nome** da plaquinha, a **cor** e o **tamanho em cm**. O **link de destino e opcional** — pode ficar em branco.
2. O sistema gera um codigo curto (ex: `AB2C3D`) e a URL publica `APP_URL/r/AB2C3D`.
3. Voce baixa o PNG em 300 dpi (ou abre a folha de impressao) e manda fazer a placa.
4. Quem escaneia cai em `/r/AB2C3D`: o sistema conta a leitura e redireciona para o destino atual.
5. Para definir ou trocar o destino, basta editar o QR Code no painel. **O codigo na URL nao muda**, entao as placas ja impressas continuam funcionando.
6. Se quiser desativar temporariamente, use **Pausar**: quem escanear ve uma pagina de aviso e nenhum clique e contado.

### Criar e imprimir antes de escolher o destino

Se voce ainda nao sabe para onde a placa vai levar, deixe o **Link de destino em branco** ao criar.
A placa ja pode ser baixada e impressa normalmente. Enquanto o destino nao for definido, quem
escanear ve a mensagem *"Destino ainda nao configurado"*. Depois, no painel, abra o QR Code,
clique em **Editar** e informe o link — a partir dai ele passa a redirecionar, sem trocar a placa.

Links aceitos no destino: `http://`, `https://`, `mailto:` e `tel:`.
Se voce digitar apenas `site.com.br`, o sistema completa com `https://` automaticamente.
Para WhatsApp use `https://wa.me/55DDDNUMERO`.

### QR Code de Pix (copia e cola)

Ao criar o QR Code, escolha o tipo **Pix (copia e cola)** e informe:

| Campo | O que e |
|---|---|
| **Chave Pix** | A chave de quem vai receber: CPF, CNPJ, e-mail, telefone (`+55DDDNUMERO`) ou chave aleatoria (UUID). |
| **Nome do recebedor** | Como aparece no aplicativo do banco (ate 25 caracteres, sem acentos). |
| **Cidade do recebedor** | Aparece no comprovante (ate 15 caracteres, sem acentos). |

O sistema monta o **BR Code** (padrao EMV do Banco Central, com CRC16 correto) e mostra o
**Pix copia e cola** na previa do formulario, para voce conferir antes de imprimir.

- O QR Code gerado e o **mesmo tipo de codigo que o banco fornece**: quem paga abre o app do
  banco, aponta a camera e o pagamento ja vem montado, com o valor digitado pelo cliente.
- **Nao e dinamico.** A chave faz parte da imagem impressa. Para mudar a chave, edite o QR Code
  e **reimprima** a placa.
- Se a chave estiver invalida (ex: CPF com digito errado), o sistema recusa o cadastro — isso
  evita imprimir uma placa que enviaria o dinheiro para o lugar errado.
- Cada QR Code Pix tambem ganha uma **pagina publica** em `APP_URL/p/CODIGO` com o codigo
  copia-e-cola, para quem nao conseguir apontar a camera (basta compartilhar o link ou imprimir
  o endereco junto da placa).

> Um QR Code Pix nao pode ser um link: o aplicativo do banco precisa encontrar o payload do Pix
> dentro do QR. Por isso, ao contrario dos QR de link, ele nao passa pelo sistema no momento do
> pagamento.

---

## Rotas principais

| Metodo | Rota | Descricao |
|---|---|---|
| GET | `/` | Pagina publica neutra |
| GET | `/r/:code` | Leitura do QR: conta o clique e redireciona (Pix: abre a pagina do codigo) |
| GET | `/p/:code` | Pagina publica do QR Code Pix (copia e cola) |
| GET | `/p/:code/qrcode.png` | Imagem publica do QR Code Pix |
| GET | `/health` | Health check (uptime + status) |
| GET/POST | `/admin/login` | Login do painel (limite de 10 tentativas / 15 min) |
| POST | `/admin/logout` | Encerra a sessao |
| GET | `/admin` | Visao geral com estatisticas |
| GET | `/admin/qrcodes` | Lista com busca, filtro e paginacao |
| GET/POST | `/admin/qrcodes/novo` | Criar QR Code (tipo Link ou Pix, com previa em tempo real) |
| GET | `/admin/qrcodes/pix-preview.json` | Monta o BR Code em tempo real para a previa do formulario |
| GET/POST | `/admin/qrcodes/:id/editar` | Editar tipo, destino/chave, cor, tamanho e status |
| POST | `/admin/qrcodes/:id/status` | Pausar / reativar |
| POST | `/admin/qrcodes/:id/excluir` | Excluir |
| GET | `/admin/qrcodes/:id/download.png` | PNG em 300 dpi para a grafica |
| GET | `/admin/qrcodes/:id/qrcode.png` | Imagem para exibicao nas telas |
| GET | `/admin/qrcodes/:id/imprimir` | Folha de impressao em tamanho real |
| GET/POST | `/admin/conta` | Alterar nome, e-mail e senha |

---

## Seguranca

- Senhas com hash bcrypt (custo 10) — nunca em texto puro.
- Sessao gravada no MySQL; renovada apos o login (evita fixacao de sessao).
- Cookie `httpOnly` + `sameSite=lax` + `secure` em producao.
- Helmet com CSP restritiva (sem script inline).
- Limitador de tentativas de login.
- Validacao bloqueia `javascript:` e outros esquemas perigosos no destino.
- Todas as rotas do painel exigem sessao autenticada.

## Backup do banco

```bash
mysqldump -u plaquinhas -p plaquinhas > backup-$(date +%F).sql
```

Recomendado agendar via `cron` diario e manter os arquivos fora da VPS.

## Observacoes

- O tamanho em cm define a resolucao do PNG: `cm / 2,54 × 300 dpi`. Uma placa de 5 cm gera um arquivo de 591 px.
- Ao imprimir, use escala **100%** (tamanho real).
- Teste sempre o QR com a camera de dois celulares diferentes antes de mandar produzir a placa.
- Cores muito claras reduzem a leitura — o painel avisa quando a cor escolhida pode dar problema.
- QR Code de **Pix** nao e dinamico: teste o pagamento com um valor pequeno antes de imprimir a placa em serie.
