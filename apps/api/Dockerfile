# =============================================================================
# Dockerfile multi-stage para o NestJS api (monorepo pnpm).
# Build context deve ser a RAIZ do repo (pra ver packages/shared).
# No Railway: defina Root Directory = "/" e Dockerfile Path = "apps/api/Dockerfile"
# =============================================================================
FROM node:20-alpine AS base
# openssl + libc6-compat são necessários para o Prisma engine na Alpine.
# Sem eles, "prisma migrate deploy" no preDeployCommand falha com erro do OpenSSL.
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

# ----- deps: instala apenas o necessário aproveitando cache de layers -----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @facial/api... --prod=false

# ----- build: gera dist + prisma client + seed compilado -----
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
WORKDIR /repo/apps/api
RUN pnpm prisma generate
RUN pnpm build
# Compila prisma/seed.ts → prisma/seed.js para rodar em produção sem ts-node
RUN pnpm exec tsc prisma/seed.ts \
  --module commonjs \
  --target ES2022 \
  --esModuleInterop \
  --skipLibCheck \
  --resolveJsonModule

# ----- runner: usa o build stage diretamente -----
# Reinstalar com --prod num stage separado quebra com pnpm porque o cliente
# Prisma gerado vive em /repo/node_modules/.pnpm/<hash>/node_modules/.prisma/
# (não em apps/api/node_modules/.prisma/). Reaproveitar o build evita ter que
# reconstruir o grafo de symlinks pnpm. Imagem fica maior, mas correta.
FROM build AS runner
ENV NODE_ENV=production
WORKDIR /repo/apps/api
EXPOSE 3001
# Railway injeta PORT — main.ts usa process.env.API_PORT ?? 3001
ENV API_PORT=${PORT:-3001}
CMD ["node", "dist/main.js"]
