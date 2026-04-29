# =============================================================================
# Dockerfile multi-stage para o NestJS api (monorepo pnpm).
# Build context deve ser a RAIZ do repo (pra ver packages/shared).
# No Railway: defina Root Directory = "/" e Dockerfile Path = "apps/api/Dockerfile"
# =============================================================================
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

# ----- deps: instala apenas o necessário aproveitando cache de layers -----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @facial/api... --prod=false

# ----- build: gera dist + prisma client -----
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
WORKDIR /repo/apps/api
RUN pnpm prisma generate
RUN pnpm build

# ----- runner: imagem final, só com prod -----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo

# Reinstala apenas deps de produção
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @facial/api... --prod

COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=build /repo/apps/api/node_modules/@prisma ./apps/api/node_modules/@prisma

WORKDIR /repo/apps/api
EXPOSE 3001
# Railway injeta PORT — main.ts usa process.env.API_PORT ?? 3001
ENV API_PORT=${PORT:-3001}
CMD ["node", "dist/main.js"]
