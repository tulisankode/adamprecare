# syntax=docker/dockerfile:1.7
# Image dashboard web Adam PreCare. NEXT_PUBLIC_* dibakar saat build → kirim lewat --build-arg.
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w apps/web --include-workspace-root --no-audit --no-fund

FROM deps AS build
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_SOCKET_PATH=/realtime
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_PUBLIC_SOCKET_PATH=$NEXT_PUBLIC_SOCKET_PATH \
    NEXT_TELEMETRY_DISABLED=1
COPY apps/web apps/web
RUN rm -f apps/web/.env.local && npm run build -w apps/web

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/package.json package.json
COPY --from=build /repo/apps/web/package.json apps/web/package.json
COPY --from=build /repo/apps/web/.next apps/web/.next
COPY --from=build /repo/apps/web/public apps/web/public
COPY --from=build /repo/apps/web/next.config.ts apps/web/next.config.ts
WORKDIR /repo/apps/web
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
CMD ["npx", "next", "start", "-p", "3000"]
