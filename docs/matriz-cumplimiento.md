# Matriz de cumplimiento — Plaza Sinú

Cada requisito técnico mínimo (sección 3 del enunciado), el flujo obligatorio (sección 4) y cada entregable (sección 5), con el archivo o la evidencia exacta que lo demuestra. Estado al **12/11/2026**.

✅ Cumplido · ⚠️ Cumplido con observación

## Requisitos técnicos mínimos (sección 3)

| # | Requisito | Estado | Cómo se cumple | Evidencia |
|---|---|---|---|---|
| 1 | Mínimo 5 microservicios funcionales | ✅ | **7** servicios: usuarios, vendedores, catalogo, inventario, carrito, pedidos-pagos y notificaciones, más el gateway | [`servicios/`](../servicios) · [docker-ps.txt](evidencias/docker-ps.txt) · [Mapa de servicios](evidencias/13-mapa-servicios.png) |
| 2 | Responsabilidad clara de cada microservicio | ✅ | Un dominio por servicio, con datos propios y límites explícitos (ADR-01, ADR-14) | [README, tabla de microservicios](../README.md#microservicios) · [decisiones-tecnicas.md](decisiones-tecnicas.md) |
| 3 | APIs REST documentadas, métodos HTTP correctos | ✅ | GET para leer, POST para crear, PUT/PATCH para modificar y DELETE para borrar. Respuestas 200, 201, 204, 400, 401, 402, 403, 404, 409, 422, 429 y 503 | `servicios/*/openapi.yaml` · [Swagger](evidencias/17-swagger-gateway.png) |
| 4 | Base de datos apropiada por servicio, sin compartir tablas | ✅ | 7 bases en 7 contenedores: 4 PostgreSQL, 2 MongoDB y 1 Redis. Ningún servicio conoce la conexión de otro (ADR-03) | [docker-compose.yaml](../docker-compose.yaml) · [modelos-datos/](modelos-datos/README.md) |
| 5 | API Gateway como punto de entrada | ✅ | Gateway propio en Express: enruta por prefijo, valida JWT, propaga `correlationId`, limita intentos de login y bloquea rutas internas (ADR-11) | [`gateway/src/app.js`](../gateway/src/app.js) · [`gateway/src/rutas.js`](../gateway/src/rutas.js) · E2E caso 16 |
| 6 | Autenticación y autorización con JWT | ✅ | JWT HS256 de 15 min + refresh rotativo de 7 días, bcrypt, roles `cliente`/`vendedor`/`admin` y autorización por recurso. Cada servicio vuelve a verificar la firma (ADR-10) | [`compartido/src/auth.js`](../compartido/src/auth.js) · E2E 18–19, 23 · resiliencia D1–D4 · [error 403](evidencias/10-error-403-zona-admin.png) |
| 7 | Comunicación por APIs y asíncrona con RabbitMQ | ✅ | REST cuando el usuario necesita la respuesta; eventos para las consecuencias. Exchange topic `plaza.eventos`, 13 tipos de evento, colas durables, DLQ y consumidores idempotentes (ADR-04, ADR-05) | [contratos.md](contratos.md) · [`compartido/src/eventos.js`](../compartido/src/eventos.js) · [colas de RabbitMQ](evidencias/18-rabbitmq-colas.png) · [Radar](evidencias/14-radar-eventos.png) |
| 8 | Manejo de errores y respuestas HTTP adecuadas | ✅ | Formato único `{ error: { codigo, mensaje, detalles, correlationId } }` en todos los servicios, con middleware central | [`compartido/src/errores.js`](../compartido/src/errores.js) · E2E 18–24 · [errores en la UI](evidencias/11-error-401-credenciales.png) |
| 9 | Dockerizar y entregar docker-compose | ✅ | Un Dockerfile multi-etapa por servicio (`node:22-alpine`, usuario no root, healthcheck). Un `docker compose up --build` levanta los 17 contenedores | `*/Dockerfile` · [docker-compose.yaml](../docker-compose.yaml) · [docker-ps.txt](evidencias/docker-ps.txt) |
| 10 | Documentar las APIs con Swagger/OpenAPI | ✅ | OpenAPI 3 por servicio; el gateway los agrega en `http://localhost:8080/docs` con selector de servicio | `servicios/*/openapi.yaml` · [`gateway/src/docs.js`](../gateway/src/docs.js) · [captura](evidencias/17-swagger-gateway.png) |
| 11 | Logs y monitoreo básico | ✅ | Logs JSON (pino) con `servicio`, `correlationId` y `usuarioId`. `/salud` y `/salud/listo` en cada servicio, salud agregada en el gateway, Mapa de servicios y Radar de eventos en vivo (ADR-13) | [`compartido/src/logger.js`](../compartido/src/logger.js) · [`gateway/src/monitor.js`](../gateway/src/monitor.js) · [Mapa](evidencias/13-mapa-servicios.png) · [Traza](evidencias/08-traza-pedido.png) |
| 12 | Pruebas de los servicios y resultados documentados | ✅ | 144 pruebas unitarias y de API, E2E 24/24, resiliencia 11/11, concurrencia con Postgres real y UI con Playwright | [plan-de-pruebas.md](pruebas/plan-de-pruebas.md) · [resultados-e2e.md](pruebas/resultados-e2e.md) · [resultados-resiliencia.md](pruebas/resultados-resiliencia.md) |
| 13 | Git/GitHub para control de versiones | ✅ | Repositorio con historial de commits por tema (`tipo(alcance): descripción`) | `git log` · [CONTRIBUTING.md](../CONTRIBUTING.md) |
| 14 | Diagramas de arquitectura y de comunicación | ✅ | Arquitectura general, comunicación (REST y eventos) y dos diagramas de secuencia, en Mermaid con PNG y SVG | [arquitectura/](arquitectura/) |
| 15 | Demostración funcional de un flujo completo | ✅ | Flujo obligatorio en vivo con Modo sustentación (`?demo=1`), traza del pedido y notificación en tiempo real. Demo en línea: https://plaza-sinu.vercel.app | [guion.md](sustentacion/guion.md) · [capturas 01–09](evidencias/) · prueba de UI |

## Flujo de demostración obligatorio (sección 4)

> iniciar sesión → consultar productos → agregar al carrito → generar pedido → actualizar inventario → registrar pago → generar notificación

| Paso | Servicio | Evidencia automatizada | Captura |
|---|---|---|---|
| Iniciar sesión | usuarios (vía gateway) | E2E 1 · UI paso 1 | [01](evidencias/01-inicio-sesion.png) |
| Consultar productos | catalogo | E2E 2 · UI paso 2 | [02](evidencias/02-catalogo.png) |
| Agregar al carrito | carrito → catalogo, inventario (REST) | E2E 3 · UI paso 3 | [03](evidencias/03-producto-agregado.png) · [04](evidencias/04-carrito.png) |
| Generar pedido | pedidos-pagos → carrito, catalogo, inventario (REST, reserva) | E2E 4–6 · UI paso 4 | [05](evidencias/05-checkout-direccion.png) |
| Actualizar inventario | inventario (evento `pago.aprobado` → confirma) | E2E 8 | [08](evidencias/08-traza-pedido.png) |
| Registrar pago | pedidos-pagos (pasarela simulada) | E2E 7 · UI paso 5 | [06](evidencias/06-pago-tarjeta-4242.png) · [07](evidencias/07-pedido-pagado.png) |
| Generar notificación | notificaciones (eventos + SSE) | E2E 9–10 · UI paso 6 | [09](evidencias/09-notificacion.png) |

## Entregables (sección 5)

| # | Entregable | Estado | Dónde |
|---|---|---|---|
| 1 | Código fuente completo de todos los microservicios | ✅ | [`servicios/`](../servicios), [`gateway/`](../gateway), [`compartido/`](../compartido), [`web/`](../web) |
| 2 | Repositorio Git con historial de commits | ⚠️ | Repositorio en GitHub con el historial. **Observación:** la participación de cada integrante se ve en los autores de los commits |
| 3 | README con instrucciones de instalación y ejecución | ✅ | [README.md](../README.md) |
| 4 | Archivo docker-compose | ✅ | [docker-compose.yaml](../docker-compose.yaml) |
| 5 | Documentación Swagger/OpenAPI | ✅ | `servicios/*/openapi.yaml` y `http://localhost:8080/docs` |
| 6 | Diagrama general de arquitectura | ✅ | [01-arquitectura-general.png](arquitectura/01-arquitectura-general.png) |
| 7 | Diagrama de comunicación entre microservicios | ✅ | [02-comunicacion.png](arquitectura/02-comunicacion.png), [03-secuencia-compra.png](arquitectura/03-secuencia-compra.png), [04-secuencia-pago-rechazado.png](arquitectura/04-secuencia-pago-rechazado.png) |
| 8 | Modelo de datos de cada servicio | ✅ | [modelos-datos/](modelos-datos/README.md) (7 archivos con diagrama ER) |
| 9 | Documento de decisiones técnicas y tecnologías | ✅ | [decisiones-tecnicas.md](decisiones-tecnicas.md) (15 ADR) |
| 10 | Plan y evidencias de pruebas | ✅ | [plan-de-pruebas.md](pruebas/plan-de-pruebas.md) · [evidencias/](evidencias/) |
| 11 | Manual breve de instalación y usuario | ✅ | [manual-instalacion-usuario.md](manual-instalacion-usuario.md) |
| 12 | Presentación de sustentación | ✅ | [guion.md](sustentacion/guion.md), [preguntas-probables.md](sustentacion/preguntas-probables.md), [checklist-demo.md](sustentacion/checklist-demo.md) e [informe en Word/PDF](informe/Informe_Plaza_Sinu_Cuello_Miranda.pdf) |
| 13 | Demostración funcional | ✅ | Modo sustentación (`?demo=1`) y [checklist-demo.md](sustentacion/checklist-demo.md) |

## Estructura de la sustentación (sección 6)

Las 10 etapas (Problema, Objetivo, Arquitectura, Microservicios, Comunicación, Persistencia, Seguridad, Contenedores, Pruebas y Demostración) están desarrolladas con tiempos, responsables y qué mostrar en [`sustentacion/guion.md`](sustentacion/guion.md).
