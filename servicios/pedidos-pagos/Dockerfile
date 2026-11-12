FROM node:22-alpine AS dependencias
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY compartido ./compartido
COPY servicios/pedidos-pagos ./servicios/pedidos-pagos
RUN npm ci --omit=dev -w @plaza/pedidos-pagos -w @plaza/compartido \
 && cd servicios/pedidos-pagos && npx prisma generate

FROM node:22-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias --chown=node:node /app ./
USER node
WORKDIR /app/servicios/pedidos-pagos
EXPOSE 4006
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://localhost:4006/salud/listo || exit 1
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
