# syntax=docker/dockerfile:1.7
# Image produksi/staging Adam PreCare API. Build dari root repo:
#   docker build -f apps/api/Dockerfile -t adam-precare/api .
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++ openssl
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/api --include-workspace-root --no-audit --no-fund

FROM deps AS build
COPY apps/api apps/api
RUN npx -w apps/api prisma generate && npm run build -w apps/api

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/package.json package.json
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
# src + tsconfig agar seed (ts-node prisma/seed.ts) bisa dijalankan dari container
COPY --from=build /repo/apps/api/src apps/api/src
COPY --from=build /repo/apps/api/tsconfig.json apps/api/tsconfig.json
WORKDIR /repo/apps/api
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/v1/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
