# Imagen del API GATEWAY. Contexto de build = raíz del repo.
FROM node:22-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
COPY compartido ./compartido
COPY gateway ./gateway
RUN npm ci --omit=dev -w @plaza/gateway -w @plaza/compartido

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias --chown=node:node /app ./
USER node
WORKDIR /app/gateway
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://localhost:8080/docs/ >/dev/null || exit 1
CMD ["node", "src/index.js"]
