# API

Backend NestJS. Persiste eventos, participantes, fotos (metadados) e log de auditoria. Faz proxy para o microserviço Python de reconhecimento.

## Setup

```bash
# da raiz do monorepo
pnpm install
cp .env.example .env
docker compose up -d postgres redis
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate    # cria as tabelas
pnpm dev
```

API sobe em http://localhost:3001/api.

## Endpoints (esqueleto)

- `GET /api/health`
- `GET /api/events` / `POST /api/events` / `GET /api/events/:id`
- `POST /api/attendees/register`
- `POST /api/attendees/:id/photos`  (body: `{ ordem: 1|2, imageBase64 }`)
- `GET /api/attendees/protocolo/:protocolo`

## Próximos passos (já modelados, falta implementar)

- Auth admin (Argon2 + JWT)
- Upload real para MinIO
- Job BullMQ para retenção LGPD (apaga após `retencaoDias`)
- Endpoint público de "direito ao esquecimento"
