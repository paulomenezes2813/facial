# =============================================================================
# Dockerfile multi-stage para o Next.js web (monorepo pnpm).
# Build context deve ser a RAIZ do repo (pra ver packages/shared).
# Usa output: 'standalone' do Next pra imagem final mínima.
# No Railway: Root Directory = "/" e Dockerfile Path = "apps/web/Dockerfile"
# =============================================================================
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

# ----- deps -----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @facial/web... --prod=false

# ----- build -----
# NEXT_PUBLIC_* não precisa ser build arg: as únicas referências estão em
# server components / route handlers, lidos em runtime via process.env.
FROM deps AS build
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
WORKDIR /repo/apps/web
RUN pnpm build

# ----- runner -----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo/apps/web

# Standalone copy
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=${PORT:-3000}
ENV HOSTNAME=0.0.0.0
WORKDIR /repo/apps/web
CMD ["node", "server.js"]
