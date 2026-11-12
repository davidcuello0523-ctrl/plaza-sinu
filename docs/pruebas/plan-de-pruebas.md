# Plan de pruebas — Plaza Sinú

Última ejecución completa: **12/11/2026**, con la solución levantada desde cero (`docker compose down -v` y `docker compose up --build`, 17 contenedores `healthy`).

## 1. Objetivo

Comprobar que cada microservicio cumple su responsabilidad, que los servicios se comunican correctamente por REST y por eventos, y que el sistema responde bien en situaciones normales, ante errores del usuario y ante fallas de un servicio.

## 2. Alcance

| Incluido | Fuera de alcance |
|---|---|
| Los 7 microservicios y el API Gateway | Pruebas de carga y estrés |
| Flujo obligatorio completo del marketplace | Pasarela de pagos real (se usa una simulada) |
| Comunicación REST y eventos de RabbitMQ | Navegadores distintos de Chromium |
| Seguridad: autenticación, autorización y rutas internas | Pruebas de penetración |
| Resiliencia ante caída de servicios y concurrencia | |
| Interfaz web en el navegador (flujo obligatorio) | |

## 3. Tipos de prueba y herramientas

| Tipo | Qué verifica | Herramienta | Dónde |
|---|---|---|---|
| Unitarias | Reglas de dominio sin red ni base de datos (precios, estados, mensajes, armado del carrito) | Jest 30 | `servicios/*/tests/*.servicio.test.js`, `dominio.test.js`, `armado.test.js`, `mensajes.test.js`, `catalogo.unit.test.js` |
| API / integración por servicio | Cada endpoint con sus códigos HTTP, validación y permisos, usando dobles en memoria de la BD y del bus | Jest + Supertest | `servicios/*/tests/api.test.js`, `gateway/tests/gateway.test.js` |
| Concurrencia sobre BD real | Dos reservas simultáneas de la última unidad: solo una gana | Jest + PostgreSQL real | `servicios/inventario/tests/concurrencia.integracion.test.js` |
| End-to-end (E2E) | El flujo obligatorio completo a través del gateway con los 17 contenedores | Script Node (`fetch`) | `pruebas/e2e/flujo-compra.mjs` |
| Resiliencia | Caída de notificaciones e inventario, compra simultánea, tokens vencidos | Script Node + `docker compose stop/start` | `pruebas/e2e/resiliencia.mjs` |
| Seguridad | 401, 403, rutas internas bloqueadas, token vencido | Incluidas en E2E, resiliencia y pruebas de API | Ver tabla de casos |
| UI | El flujo obligatorio desde el navegador y errores visibles | Playwright 1.65 (Chromium) | `pruebas/ui/flujo-compra.spec.mjs` |

## 4. Cómo ejecutarlas

```powershell
npm install

npm test

docker compose up -d --build
npm run e2e
npm run resiliencia
npx playwright install chromium
npm run ui
npm run evidencias
```

| Comando | Requiere Docker arriba | Resultado |
|---|---|---|
| `npm test` | No | Jest en cada servicio, con cobertura en `servicios/*/coverage` |
| `npm run e2e` | Sí | Reescribe [`resultados-e2e.md`](resultados-e2e.md) |
| `npm run resiliencia` | Sí (detiene y arranca contenedores) | Reescribe [`resultados-resiliencia.md`](resultados-resiliencia.md) |
| `npm run ui` | Sí | Prueba de Playwright y capturas en `docs/evidencias/` |
| `npm run evidencias` | Sí | Lo mismo que `ui` y además guarda `docs/evidencias/docker-ps.txt` |

La prueba de concurrencia se omite si no existe la variable `DATABASE_URL_PRUEBAS`. Para correrla, expón temporalmente `db-inventario`:

```powershell
docker run -d --rm --name puente-inventario --network plaza-red -p 127.0.0.1:55432:5432 alpine/socat tcp-listen:5432,fork,reuseaddr tcp-connect:db-inventario:5432
$env:DATABASE_URL_PRUEBAS = "postgresql://inventario:<DB_CLAVE>@127.0.0.1:55432/inventario"
cd servicios/inventario; npm test; cd ../..
docker stop puente-inventario
```

## 5. Criterios de aceptación

- El 100 % de las pruebas unitarias y de API pasa en todos los servicios.
- El flujo E2E pasa completo (24/24) y la resiliencia también (11/11).
- La prueba de UI completa el flujo obligatorio en el navegador.
- Ningún error deja datos a medias: si falla la reserva o el pago, no queda un pedido pagado sin stock ni stock reservado sin pedido.
- Todos los errores responden con el formato común `{ error: { codigo, mensaje, detalles, correlationId } }` y el código HTTP correcto.

## 6. Resultados de la ejecución

### 6.1 Pruebas unitarias y de API (`npm test`)

| Servicio | Pruebas | Resultado | Cobertura de líneas |
|---|---|---|---|
| gateway | 7 | 7/7 ✅ | 53,3 % |
| usuarios | 15 | 15/15 ✅ | 75,7 % |
| vendedores | 14 | 14/14 ✅ | 90,4 % |
| catalogo | 23 | 23/23 ✅ | 85,2 % |
| inventario | 18 | 18/18 ✅ (incluye concurrencia con Postgres real) | 64,0 % |
| carrito | 19 | 19/19 ✅ | 86,3 % |
| pedidos-pagos | 28 | 28/28 ✅ | 85,5 % |
| notificaciones | 20 | 20/20 ✅ | 74,3 % |
| **Total** | **144** | **144/144 ✅** | |

La cobertura del gateway es más baja porque el proxy hacia los servicios y el monitor de RabbitMQ se prueban de punta a punta en el E2E, no con dobles.

### 6.2 E2E, resiliencia y UI

| Suite | Resultado | Evidencia |
|---|---|---|
| E2E del flujo obligatorio | **24/24 ✅** | [`resultados-e2e.md`](resultados-e2e.md) |
| Resiliencia | **11/11 ✅** | [`resultados-resiliencia.md`](resultados-resiliencia.md) |
| UI con Playwright | **1/1 ✅** (9 pasos) | [`docs/evidencias/`](../evidencias/) |

## 7. Tabla de casos

| ID | Descripción | Servicio(s) | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| E2E-01 | Iniciar sesión | usuarios, gateway | 200 con JWT | ✅ 200 | [resultados-e2e.md](resultados-e2e.md) · [01](../evidencias/01-inicio-sesion.png) |
| E2E-02 | Consultar productos con estado de stock | catalogo | Lista filtrada por categoría | ✅ 7 bicicletas | [02](../evidencias/02-catalogo.png) |
| E2E-03 | Agregar al carrito validando precio y stock | carrito → catalogo, inventario | 201 con total | ✅ 201 | [03](../evidencias/03-producto-agregado.png) · [04](../evidencias/04-carrito.png) |
| E2E-04 | Generar pedido | pedidos-pagos → carrito, catalogo, inventario | 201, estado `PENDIENTE_PAGO` | ✅ 201, `PS-000123` | [05](../evidencias/05-checkout-direccion.png) |
| E2E-05 | Repetir el pedido con la misma `Idempotency-Key` | pedidos-pagos | 200 con el mismo pedido | ✅ mismo id | resultados-e2e.md |
| E2E-06 | Inventario reserva las unidades | inventario | Disponible baja, físico igual | ✅ 25 → 23 | resultados-e2e.md |
| E2E-07 | Pago con tarjeta 4242 | pedidos-pagos | 201 aprobado | ✅ •••• 4242 | [06](../evidencias/06-pago-tarjeta-4242.png) · [07](../evidencias/07-pedido-pagado.png) |
| E2E-08 | `pago.aprobado` → inventario confirma | inventario (evento) | Físico baja | ✅ 25 → 23 | [08](../evidencias/08-traza-pedido.png) |
| E2E-09 | Notificación al cliente | notificaciones (evento) | "Pago aprobado – pedido …" | ✅ | [09](../evidencias/09-notificacion.png) |
| E2E-10 | Notificación "nuevo pedido" al vendedor | notificaciones (evento) | Mensaje al vendedor | ✅ | resultados-e2e.md |
| E2E-11 | El carrito se vacía al aprobarse el pago | carrito (evento) | Carrito vacío | ✅ | resultados-e2e.md |
| E2E-12 | Traza con todos los servicios participantes | pedidos-pagos | Pasos REST y eventos | ✅ 8 pasos | [08](../evidencias/08-traza-pedido.png) |
| E2E-13 | Vendedor avanza su sub-pedido | pedidos-pagos | 200, `PREPARANDO` | ✅ | resultados-e2e.md |
| E2E-14 | Cliente notificado del cambio de estado | notificaciones (evento) | Mensaje "en preparación" | ✅ | resultados-e2e.md |
| E2E-15 | Pago con tarjeta 4000…0002 | pedidos-pagos | 402 rechazado | ✅ "Fondos insuficientes" | resultados-e2e.md |
| E2E-16 | Compensación: `pago.rechazado` libera la reserva | inventario (evento) | Disponible vuelve | ✅ | resultados-e2e.md |
| E2E-17 | Cliente notificado del rechazo | notificaciones | Mensaje de rechazo | ✅ | resultados-e2e.md |
| SEG-01 | Petición sin token | gateway | 401 | ✅ | resultados-e2e.md · resiliencia D2 |
| SEG-02 | Vendedor intenta comprar | pedidos-pagos | 403 | ✅ | resultados-e2e.md |
| SEG-03 | Producto inexistente | catalogo | 404 | ✅ | resultados-e2e.md |
| SEG-04 | Cantidad inválida | carrito | 422 | ✅ | resultados-e2e.md |
| SEG-05 | Producto agotado | carrito | 409 | ✅ | resultados-e2e.md |
| SEG-06 | Cliente pide el monitoreo del admin | gateway | 403 | ✅ | resultados-e2e.md |
| SEG-07 | Rutas `/interno/*` y `/reservas` desde fuera | gateway | 404 | ✅ | resultados-e2e.md |
| SEG-08 | Token vencido | gateway | 401 "Tu sesión expiró" | ✅ | resiliencia D1 |
| SEG-09 | Cliente aprueba un vendedor o lista usuarios | vendedores, usuarios | 403 | ✅ | resiliencia D3 y D4 |
| RES-01 | Comprar con notificaciones caído | todos | La compra funciona | ✅ | resiliencia A1 |
| RES-02 | Eventos esperan en la cola | RabbitMQ | Mensajes en `notificaciones.eventos` | ✅ 2 en cola | resiliencia A2 |
| RES-03 | Al volver, llegan las notificaciones | notificaciones | Notificación entregada | ✅ | resiliencia A3 |
| RES-04 | Checkout con inventario caído | pedidos-pagos | 503 con mensaje claro | ✅ | resiliencia B1 |
| RES-05 | No quedan pedidos a medias | pedidos-pagos | Mismo número de pedidos | ✅ 3 → 3 | resiliencia B2 |
| CON-01 | Dos clientes compran la última unidad a la vez | inventario | Un 201 y un 409 | ✅ | resiliencia C1 · prueba de concurrencia |
| CON-02 | Al cancelar, la unidad vuelve | inventario | Disponible = 1 | ✅ | resiliencia C2 |
| UI-01 | Flujo obligatorio completo en el navegador | web + todos | Pedido pagado y notificación visible | ✅ | [01–09](../evidencias/) |
| UI-02 | Error 403 visible (cliente en la Sala de Máquinas) | web | Mensaje claro | ✅ | [10](../evidencias/10-error-403-zona-admin.png) |
| UI-03 | Error 401 visible (clave incorrecta) | web, usuarios | Mensaje claro | ✅ | [11](../evidencias/11-error-401-credenciales.png) |
| UI-04 | Error 409 visible (correo ya registrado) | web, usuarios | Mensaje claro | ✅ | [12](../evidencias/12-error-409-correo-registrado.png) |
| MON-01 | Mapa de servicios, Radar de eventos y métricas | gateway, web | Los 7 servicios en línea | ✅ | [13](../evidencias/13-mapa-servicios.png) · [14](../evidencias/14-radar-eventos.png) · [15](../evidencias/15-metricas.png) |
| DOC-01 | Swagger agregado del gateway | gateway | `/docs` con los 7 servicios | ✅ | [17](../evidencias/17-swagger-gateway.png) |
| MQ-01 | Colas durables con DLQ | RabbitMQ | 5 colas + 5 DLQ | ✅ | [18](../evidencias/18-rabbitmq-colas.png) |
| DOC-02 | 17 contenedores sanos | Docker | Todos `healthy` | ✅ | [docker-ps.txt](../evidencias/docker-ps.txt) |
