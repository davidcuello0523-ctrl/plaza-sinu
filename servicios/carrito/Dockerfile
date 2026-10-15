# Imagen del servicio CARRITO. Contexto de build = raíz del repo
# (necesita el paquete compartido/). Multi-etapa: dependencias → ejecución.
FROM node:22-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
COPY compartido ./compartido
COPY servicios/carrito ./servicios/carrito
RUN npm ci --omit=dev -w @plaza/carrito -w @plaza/compartido

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias --chown=node:node /app ./
USER node
WORKDIR /app/servicios/carrito
EXPOSE 4005
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://localhost:4005/salud/listo || exit 1
CMD ["node", "src/index.js"]
