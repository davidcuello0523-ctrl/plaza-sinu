# Imagen del servicio USUARIOS. Contexto de build = raíz del repo
# (necesita el paquete compartido/). Multi-etapa: dependencias → ejecución.
FROM node:22-alpine AS dependencias
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY compartido ./compartido
COPY servicios/usuarios ./servicios/usuarios
RUN npm ci --omit=dev -w @plaza/usuarios -w @plaza/compartido \
 && cd servicios/usuarios && npx prisma generate

FROM node:22-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias --chown=node:node /app ./
USER node
WORKDIR /app/servicios/usuarios
EXPOSE 4001
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://localhost:4001/salud/listo || exit 1
# db push crea/actualiza las tablas según schema.prisma antes de arrancar
CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
