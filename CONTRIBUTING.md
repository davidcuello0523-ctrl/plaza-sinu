# Cómo contribuir

## Ramas

- `main` siempre debe levantar con `docker compose up --build` y pasar las pruebas.
- Trabaja en una rama por tema, creada desde `main`:

```powershell
git switch main
git pull
git switch -c feat/catalogo-filtro-precio
```

Prefijos de rama: `feat/`, `fix/`, `docs/`, `test/`, `chore/`.

## Formato de commits

`tipo(alcance): descripción en español, en minúscula y sin punto final`

| Tipo | Cuándo |
|---|---|
| `feat` | Funcionalidad nueva |
| `fix` | Corrección de un error |
| `docs` | Solo documentación |
| `test` | Pruebas nuevas o corregidas |
| `refactor` | Cambio de código sin cambiar el comportamiento |
| `chore` | Configuración, scripts, dependencias |

El alcance es el servicio o la carpeta: `usuarios`, `catalogo`, `gateway`, `web`, `compartido`, `docker`, `evidencias`…

Ejemplos del historial:

```text
feat(inventario): reservas con vencimiento, transacciones con FOR UPDATE y kardex
fix(web): sin desbordamiento horizontal en móvil (panel del cliente y tablas)
test(ui): prueba de humo con Playwright del flujo obligatorio (npm run ui)
```

## Convenciones del código

- Sigue [`docs/contratos.md`](docs/contratos.md): capas, formato de error, nombres de eventos y rutas internas.
- Código, nombres y documentación en español.
- Sin comentarios en el código. Las decisiones se explican en [`docs/decisiones-tecnicas.md`](docs/decisiones-tecnicas.md) o en el mensaje del commit.
- Nunca versiones `.env`, `node_modules`, `dist`, `coverage` ni `src/generated`.
- Si cambias una ruta, un evento, el formato de error o un puerto, actualiza `docs/contratos.md` y avisa al equipo.

## Antes de abrir un PR

```powershell
npm test
docker compose up -d --build
npm run e2e
npm run ui
```

1. Todas las pruebas en verde.
2. Si cambiaste una API, actualiza el `openapi.yaml` del servicio.
3. Si cambiaste un modelo, actualiza `docs/modelos-datos/`.
4. Abre el PR contra `main` con una descripción corta de qué cambia y cómo se probó.
