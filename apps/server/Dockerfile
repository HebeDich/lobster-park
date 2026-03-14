FROM node:20-bookworm-slim

WORKDIR /app
ENV COREPACK_HOME=/tmp/corepack

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server

RUN corepack enable \
  && corepack pnpm install --frozen-lockfile \
  && corepack pnpm --filter @lobster-park/server build

EXPOSE 3000
WORKDIR /app/apps/server
CMD ["node", "dist/apps/server/src/main.js"]
