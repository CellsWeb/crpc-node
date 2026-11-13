FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace configs
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/ ./packages/
COPY example/ ./example/

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm -r --filter=!example run build
RUN cd example && pnpm build

# ─── Production Image ───
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/example/dist ./example/dist
COPY --from=builder /app/example/package.json ./example/package.json
COPY --from=builder /app/example/node_modules ./example/node_modules

WORKDIR /app/example
RUN mkdir -p public/uploads

EXPOSE 4000

CMD ["node", "dist/server.js"]
