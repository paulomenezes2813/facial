# Deploy no Railway

## Visão geral

| Serviço | Tipo | Plano sugerido | Notas |
|---|---|---|---|
| **PostgreSQL** | Add-on Railway | Hobby ($5/mês) | Banco principal |
| **Redis** | Add-on Railway | Hobby ($5/mês) | Sessões / fila futura |
| **api** (NestJS) | Service via Dockerfile | 1 GB RAM | Backend principal |
| **web** (Next.js) | Service via Dockerfile | 512 MB RAM | Frontend |
| **recognition** (Python/InsightFace) | Service via Dockerfile | **2 GB RAM** | Mais pesado, modelo InsightFace |
| **qdrant** | Service via imagem oficial | 512 MB RAM | Vector DB |
| **minio** ou substituto | Service ou trocar por S3/Cloudflare R2 | — | Ver abaixo |

**Custo estimado**: ~$20–30/mês no plano Pro do Railway, dependendo do uso de CPU do recognition.

> ⚠ **Recomendação real**: para esse tipo de aplicação (visão computacional + storage + 4 serviços), uma VPS dedicada (Hetzner CCX13 ~€16/mês ou DigitalOcean) com `docker-compose` que você já tem **pode sair mais barato e simples**. Railway é ótimo pra apps web puros, fica mais caro quando tem ML/storage envolvido.

---

## Decisão: MinIO

Você tem 3 opções:

1. **Manter MinIO no Railway** — sobe a imagem oficial como serviço. Funciona mas paga storage do volume Railway (caro).
2. **Migrar pra Cloudflare R2** — gratuito até 10 GB, S3-compatível, tudo que o `minio` client faz já funciona com R2 só trocando endpoint/credenciais. **Recomendado.**
3. **AWS S3** — pago por uso, mas tem free tier de 12 meses.

Vou cobrir a opção 2 (Cloudflare R2). Se preferir manter MinIO, é só criar mais um serviço no Railway.

---

## 1. Pré-requisitos

```bash
# Instalar Railway CLI
brew install railway   # ou: curl -fsSL cli.new | sh

# Login
railway login
```

E ter:
- Conta no [Railway](https://railway.app)
- Conta no [Cloudflare](https://dash.cloudflare.com) (R2)
- Repositório do projeto no GitHub (Railway puxa de lá)

---

## 2. Subir o repositório no GitHub

Se ainda não está:

```bash
cd /Users/paulomenezes/git/facial
git init
git add .
git commit -m "Initial commit"
gh repo create facial --private --source=. --push
```

---

## 3. Criar projeto no Railway

```bash
cd /Users/paulomenezes/git/facial
railway init   # cria projeto vazio
```

Ou via UI: https://railway.app/new → **Deploy from GitHub repo** → seleciona `facial`.

---

## 4. Adicionar Postgres e Redis

Pelo dashboard do Railway:
- **+ New** → **Database** → **PostgreSQL**
- **+ New** → **Database** → **Redis**

Anote as connection strings (Railway gera automaticamente em `DATABASE_URL` e `REDIS_URL`).

---

## 5. Criar o bucket no Cloudflare R2

1. Acesse Cloudflare → R2 → **Create bucket** → nome `facial-photos`
2. Em **R2 → Manage R2 API Tokens** → **Create API token** com permissão de Object Read & Write nesse bucket
3. Anote: `S3_ENDPOINT` (ex: `https://<account>.r2.cloudflarestorage.com`), `S3_ACCESS_KEY`, `S3_SECRET_KEY`

---

## 6. Subir o serviço Qdrant

Pelo dashboard:
- **+ New** → **Empty Service** → nome `qdrant`
- **Settings** → **Source** → **Image** → `qdrant/qdrant:latest`
- **Settings** → **Variables** → adicione `QDRANT__SERVICE__HTTP_PORT=6333`
- **Settings** → **Volume** → monte 1 GB em `/qdrant/storage` (importante pra persistir embeddings)
- **Networking** → habilita **Private networking** (a api vai chamar pelo nome interno)

URL interna: `http://qdrant.railway.internal:6333`

---

## 7. Adicionar os 3 serviços do projeto (api, web, recognition)

Como este repo é um **monorepo compartilhado** (pnpm workspace com `packages/shared`), o deploy precisa ter acesso ao **repo inteiro**.

Pra cada serviço, no dashboard:
- **+ New** → **GitHub Repo** → seleciona o `facial`
- **Settings** → **Source** → mantenha **Root Directory vazio** (ou `/`)
- **Settings** → **Config as Code → Config Path** → aponte para o `railway.json` do serviço (caminho absoluto no repo)

| Serviço | Root Directory | Build |
|---|---|---|
| api | *(vazio / `/`)* | Config Path: `/apps/api/railway.json` |
| web | *(vazio / `/`)* | Config Path: `/apps/web/railway.json` |
| recognition | *(vazio / `/`)* | Config Path: `/apps/recognition/railway.json` |

> Isso garante que o build em Docker consiga enxergar `packages/shared` e o `pnpm-workspace.yaml`.

---

## 8. Variáveis de ambiente

### api (NestJS)
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
RECOGNITION_URL=http://recognition.railway.internal:8000
QDRANT_URL=http://qdrant.railway.internal:6333

S3_ENDPOINT=https://<sua-conta>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<r2-access-key>
S3_SECRET_KEY=<r2-secret-key>
S3_REGION=auto
MINIO_BUCKET=facial-photos

JWT_SECRET=<string-aleatoria-longa>
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PASSWORD=<senha-forte>
ADMIN_NAME=Administrador

WEB_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
API_PORT=${{PORT}}
```

### web (Next.js)
```env
NEXT_PUBLIC_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_BASE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
PORT=${{PORT}}
```

### recognition (Python)
```env
QDRANT_URL=http://qdrant.railway.internal:6333
INSIGHTFACE_MODEL=buffalo_l
INSIGHTFACE_CTX_ID=-1
MATCH_THRESHOLD=0.45
MIN_LIVENESS_SCORE=0.5
RECOGNITION_PORT=${{PORT}}
```

> `${{PORT}}` é a porta dinâmica que o Railway injeta. Os Dockerfiles que vamos criar respeitam isso.

---

## 9. Migrations + seed

Depois do primeiro deploy bem-sucedido da `api`, abra **Settings → Deploy** → adicione **Pre-deploy Command**:

```bash
pnpm prisma migrate deploy && pnpm prisma:seed
```

Isso roda toda vez antes de subir nova versão — aplica migrations pendentes e cria o admin se não existir.

---

## 10. Domínios

No dashboard de cada serviço:
- **Settings → Networking → Generate Domain** (subdomínio `*.up.railway.app`)
- Ou **Custom Domain** se você tiver `seudominio.com.br`

URLs finais:
- Web: `https://facial-web.up.railway.app`
- API: `https://facial-api.up.railway.app`
- Recognition e Qdrant **NÃO** precisam ser públicas (só internas).

---

## 11. Validação pós-deploy

```bash
# 1. API up?
curl https://facial-api.up.railway.app/api/health

# 2. Web carregou?
open https://facial-web.up.railway.app

# 3. Login admin
#    https://facial-web.up.railway.app/admin/login
#    email/senha que você setou em ADMIN_EMAIL/ADMIN_PASSWORD
```

---

## 12. Checklist de gotchas comuns

- [ ] Trocou `localhost:8000` no `RECOGNITION_URL` da api por `http://recognition.railway.internal:8000`
- [ ] `NEXT_PUBLIC_API_URL` da web aponta pro **domínio público** da api (não interno, porque é chamado do browser)
- [ ] CORS na api inclui o domínio do web (`WEB_URL=https://...`)
- [ ] `JWT_SECRET` é diferente do dev e tem >= 32 caracteres
- [ ] Bucket R2 está com **CORS** liberado pro domínio do web (R2 Settings → CORS)
- [ ] Volume do Qdrant está montado (senão perde embeddings em cada deploy)
- [ ] Volume do recognition está montado em `/root/.insightface` (cache do modelo, evita re-download)

---

## Alternativa mais barata

Se Railway ficar caro, **Hetzner CCX13** (€15.90/mês, 4 vCPU, 16 GB RAM) roda tudo via `docker-compose` que você já tem — bonus: muito mais CPU pra recognition e zero limite de storage. Trade-off: você administra a VPS (atualização, backup, monitoramento).
