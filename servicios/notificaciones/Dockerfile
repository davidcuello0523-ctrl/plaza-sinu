# Imagen del servicio NOTIFICACIONES. Contexto de build = raíz del repo.
FROM node:22-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
COPY compartido ./compartido
COPY servicios/notificaciones ./servicios/notificaciones
RUN npm ci --omit=dev -w @plaza/notificaciones -w @plaza/compartido

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias --chown=node:node /app ./
USER node
WORKDIR /app/servicios/notificaciones
EXPOSE 4007
HEALTHCHECK --interval=10s --timeout=3s --retries=6 CMD wget -qO- http://localhost:4007/salud/listo || exit 1
CMD ["node", "src/index.js"]
