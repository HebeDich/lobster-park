FROM node:20-bookworm-slim AS build

WORKDIR /app
ENV COREPACK_HOME=/tmp/corepack

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY docs/archive/product-history/LobsterPark_Docs_V1_4/LobsterPark_OpenAPI_V1_4.yaml ./docs/archive/product-history/LobsterPark_Docs_V1_4/LobsterPark_OpenAPI_V1_4.yaml

RUN corepack enable \
  && corepack pnpm install --frozen-lockfile \
  && corepack pnpm --filter @lobster-park/web generate:api \
  && corepack pnpm --filter @lobster-park/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
