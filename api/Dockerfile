# api/Dockerfile
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY sdk/package.json sdk/
COPY sdk/packages/types/package.json sdk/packages/types/
COPY sdk/packages/abis/package.json sdk/packages/abis/
COPY sdk/packages/sdk/package.json sdk/packages/sdk/
COPY api/package.json api/

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY sdk/ sdk/
COPY api/ api/

# Build SDK packages first (api depends on them)
RUN cd sdk && pnpm build

# Build API
RUN cd api && pnpm build

# Production image
FROM node:20-slim AS runner
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/sdk ./sdk
COPY --from=base /app/api/dist ./api/dist
COPY --from=base /app/api/package.json ./api/

WORKDIR /app/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
