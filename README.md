# Facial — Credenciamento por reconhecimento facial

Sistema completo de pré-cadastro facial e check-in em totem para eventos. Stack: **Next.js + NestJS + FastAPI/InsightFace**, tudo em monorepo `pnpm`.

📋 Plano completo em [`PLANO.md`](./PLANO.md).

---

## Estrutura

```
facial/
├── apps/
│   ├── web/         # Next.js (cadastro mobile + painel admin + UI do totem)
│   ├── api/         # NestJS (eventos, participantes, fotos, auditoria)
│   ├── recognition/ # FastAPI + InsightFace (detecção, embedding, busca)
│   └── totem/       # Aplicação kiosk (Fase 5)
├── packages/
│   └── shared/      # Tipos TypeScript + schemas zod compartilhados
├── poc/             # Validação isolada do pipeline de reconhecimento
├── docs/
│   └── screens/     # Mockups de referência das telas
├── docker-compose.yml
├── PLANO.md
└── README.md
```

---

## Pré-requisitos

| Ferramenta | Versão | Como instalar (macOS) |
|---|---|---|
| Node.js | ≥ 20 | `brew install node` ou via `nvm` |
| pnpm | ≥ 9 | `npm install -g pnpm` |
| Python | 3.11 | `brew install python@3.11` |
| Docker Desktop | recente | https://www.docker.com/products/docker-desktop/ |

---

## Setup inicial (uma vez)

```bash
# 1. Instalar dependências TS/JS
pnpm install

# 2. Copiar variáveis de ambiente
cp .env.example .env

# 3. Subir infra local (Postgres, Redis, MinIO, Qdrant)
pnpm infra:up

# 4. Rodar migrations do banco
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate dev --name init

# 5. Setup do microserviço Python
cd ../recognition
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Esta primeira execução baixa ~280MB do modelo Buffalo_L
python -c "import insightface; insightface.app.FaceAnalysis(name='buffalo_l').prepare(ctx_id=-1, det_size=(640,640))"
```

---

## Rodar em desenvolvimento

Em três terminais separados (ou use `pnpm dev` na raiz para web+api):

```bash
# Terminal 1 — Infra
pnpm infra:up && pnpm infra:logs

# Terminal 2 — Microserviço Python
cd apps/recognition && source .venv/bin/activate
uvicorn src.main:app --reload --port 8000

# Terminal 3 — Backend Node
cd apps/api && pnpm dev

# Terminal 4 — Frontend Next.js
cd apps/web && pnpm dev
```

URLs locais:

| Serviço | URL |
|---|---|
| Web (cadastro / admin / totem) | http://localhost:3000 |
| API NestJS | http://localhost:3001/api |
| Recognition (FastAPI) | http://localhost:8000/docs |
| Qdrant | http://localhost:6333/dashboard |
| MinIO console | http://localhost:9001 (login `minio` / `minio_dev_pwd`) |
| PostgreSQL | localhost:5432 (user `facial`) |

---

## Validar a Fase 0 — POC do reconhecimento

Antes de tocar em UI, garanta que o pipeline de visão funciona:

```bash
# 1. Suba só o Qdrant
docker compose up -d qdrant

# 2. Coloque 3-5 fotos suas em poc/samples/ (jpg ou png)
mkdir -p poc/samples
cp ~/Downloads/sua-foto-1.jpg poc/samples/
cp ~/Downloads/sua-foto-2.jpg poc/samples/

# 3. Rode o POC (precisa do venv do recognition ativo)
cd apps/recognition && source .venv/bin/activate && cd ../..
python poc/recognition_poc.py

# 4. (opcional) Stress test com 10k embeddings sintéticos
python poc/recognition_poc.py --gallery 10000 --skip-real
```

Critérios de aceite da Fase 0:
- ✅ Auto-match top-1 = 100% nas fotos reais
- ✅ Latência de search < 50ms p95 com 10k embeddings
- ✅ Latência de detect+embed < 500ms em CPU para fotos 1080p

---

## Comandos úteis

```bash
pnpm infra:up         # sobe Postgres, Redis, MinIO, Qdrant
pnpm infra:down       # derruba (preserva volumes)
pnpm infra:reset      # derruba e APAGA volumes (zera dados)
pnpm infra:logs       # tail de todos os containers
pnpm typecheck        # tsc --noEmit em todos os pacotes
```

---

## Roadmap

Veja [`PLANO.md`](./PLANO.md) para o roadmap completo. Resumo:

- **Fase 0** ✅ Setup do monorepo + POC do reconhecimento
- **Fase 1** Cadastro web (formulário + 1 foto)
- **Fase 2** Captura de 2 fotos + validação client-side com MediaPipe
- **Fase 3** Microserviço completo (já tem o esqueleto + endpoints)
- **Fase 4** Painel admin
- **Fase 5** App do totem com sync offline
- **Fase 6** Carga e2e
- **Fase 7** Hardening LGPD
- **Fase 8** Piloto em evento real

---

## Conformidade LGPD

Resumo do que está implementado/planejado (detalhes na seção 5 do [`PLANO.md`](./PLANO.md)):

- Consentimento explícito registrado (com IP e timestamp)
- CPF armazenado como hash + últimos 3 dígitos
- Retenção configurável por evento (default 10 dias)
- Endpoint de exclusão por protocolo
- Log de auditoria de todo acesso a dado biométrico
- Dados biométricos isolados no Qdrant (apagáveis em massa por evento)

⚠️ **Antes do go-live em produção**: contratar DPO, redigir RIPD, formalizar política de privacidade.
