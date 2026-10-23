FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY vendor/opengym/frontend/package.json vendor/opengym/frontend/package-lock.json ./vendor/opengym/frontend/
RUN npm ci --prefix vendor/opengym/frontend --no-audit --no-fund
COPY vendor/pokemon-island/package.json vendor/pokemon-island/package-lock.json ./vendor/pokemon-island/
RUN npm ci --prefix vendor/pokemon-island --no-audit --no-fund
# The licensed media must be staged locally before building. It is never in Git.
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 FORMA_DATA_DIR=/var/lib/forma FORMA_TRUST_PROXY_HOPS=0
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /var/lib/forma && chown node:node /var/lib/forma
USER node
VOLUME ["/var/lib/forma"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/capabilities').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/index.ts"]
