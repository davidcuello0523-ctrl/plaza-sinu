# Imagen del servicio VENDEDORES. Contexto de build = raíz del repo
# (necesita el paquete compartido/). Multi-etapa: dependencias → ejecución.
FROM node:22-alpine AS dependencias
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY compartido ./compartido
COPY servicios/vendedores ./servicios/vendedores
RUN npm ci --omit=dev -w @plaza/vendedores -w @plaza/compartido \
 && cd servicios/vendedores && npx prisma generate

FROM node:22-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias --chown=node:node /app ./
USER node
WORKDIR /app/servicios/vendedores
EXPOSE 4002
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://localhost:4002/salud/listo || exit 1
# db push crea/actualiza las tablas según schema.prisma antes de arrancar
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
