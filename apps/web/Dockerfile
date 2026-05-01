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
# NEXT_PUBLIC_* É inlineado no bundle do browser em build time pelo Next.
# lib/api.ts é importado por client components (ex.: CpfStep), então
# NEXT_PUBLIC_API_URL precisa estar presente AQUI, não só no runtime.
# Setar a env no serviço web do Railway — ela é exposta como build arg automaticamente.
FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
WORKDIR /repo/apps/web
RUN pnpm build

# ----- runner -----
# Em monorepo, o standalone do Next gera apps/web/server.js dentro do bundle.
# Copiando standalone para /repo, o server.js fica em /repo/apps/web/server.js
# (que é o caminho no startCommand do railway.json).
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo

# Standalone copy (contém apps/web/server.js, node_modules/, packages/shared/)
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=${PORT:-3000}
ENV HOSTNAME=0.0.0.0
WORKDIR /repo/apps/web
CMD ["node", "server.js"]
