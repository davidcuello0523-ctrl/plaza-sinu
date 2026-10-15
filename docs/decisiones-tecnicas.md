# Decisiones técnicas — Plaza Sinú

Formato ADR breve: **contexto → decisión → alternativas → consecuencias**. Cada decisión se puede defender en la sustentación señalando el archivo donde se aplica.

## Tecnologías utilizadas

| Pieza | Tecnología | Dónde |
|---|---|---|
| Servicios | Node.js 22 + Express 5 (ES Modules) | `servicios/*/src` |
| Validación | zod 4 → 422 con detalle por campo | `compartido/src/validar.js` |
| PostgreSQL 16 + Prisma 6 | usuarios, vendedores, inventario, pedidos-pagos | `servicios/*/prisma/schema.prisma` |
| MongoDB 7 + Mongoose | catalogo, notificaciones | `servicios/{catalogo,notificaciones}/src/repositorio` |
| Redis 7 + ioredis | carrito | `servicios/carrito/src/repositorio` |
| Mensajería | RabbitMQ 3.13 (exchange topic `plaza.eventos`, DLX `plaza.dlx`) | `compartido/src/eventos.js` |
| Gateway | Express + http-proxy-middleware | `gateway/src` |
| Seguridad | JWT HS256 (15 min) + refresh token rotativo (7 días), bcrypt, helmet, CORS, rate limit | `compartido/src/auth.js`, `servicios/usuarios` |
| Logs | pino (JSON) con `correlationId` y `usuarioId` | `compartido/src/logger.js`, `compartido/src/app.js` |
| Frontend | React + Vite + React Router, servido por NGINX | `web/` |
| Pruebas | Jest + Supertest, scripts E2E en Node, Playwright | `servicios/*/tests`, `pruebas/` |
| Docs API | OpenAPI 3 + swagger-ui-express | `servicios/*/openapi.yaml`, `gateway/src/docs.js` |
| Contenedores | Docker (multi-etapa, `node:22-alpine`, usuario no root) + Docker Compose | `*/Dockerfile`, `docker-compose.yaml` |

---

## ADR-01 · Microservicios en lugar de monolito

- **Contexto.** Un marketplace tiene dominios con ritmos muy distintos. El catálogo se lee muchísimo. El inventario exige consistencia fuerte. El carrito es efímero. Los pagos son críticos. Las notificaciones pueden llegar un poco después.
- **Decisión.** Siete servicios, uno por dominio (usuarios, vendedores, catálogo, inventario, carrito, pedidos-pagos, notificaciones), cada uno con su API, su base de datos y su contenedor.
- **Alternativas.** Un monolito modular: más simple de desplegar y de depurar. Para un comercio pequeño sería la opción correcta.
- **Consecuencias.** (+) Cada servicio escala, falla y se despliega por separado: si se cae notificaciones se sigue vendiendo. (+) Los límites del dominio quedan explícitos. (−) Más complejidad operativa (17 contenedores), consistencia eventual y depuración distribuida. Por eso hay `correlationId`, logs JSON, `/salud` y la traza del pedido.
- **No es "un CRUD en carpetas"**: cada servicio tiene datos propios que nadie más toca, reglas propias (reservas, máquina de estados, pasarela) y se comunica solo por API o por eventos.

## ADR-02 · Node.js + Express en todos los servicios

- **Contexto.** El equipo trabajó JavaScript todo el semestre y debe poder explicar cada línea.
- **Decisión.** Node.js 22 LTS + Express 5 en los 7 servicios y en el gateway.
- **Alternativas.** Spring Boot (más robusto pero más pesado y menos conocido por el equipo) o FastAPI.
- **Consecuencias.** Imágenes pequeñas (`node:22-alpine`), un solo lenguaje y E/S no bloqueante, que encaja bien con servicios que pasan su tiempo esperando BD y red. Express 5 propaga solo los errores de funciones `async` al middleware central.
- **Nota.** El enunciado sugería `node:20-alpine`, pero Node 20 llegó a fin de soporte en abril de 2026. Se usa Node 22 LTS.

## ADR-03 · Una base de datos por servicio y un motor por necesidad

- **Contexto.** Si dos servicios comparten tablas, quedan acoplados: cambiar una columna rompe al otro.
- **Decisión.** Cada servicio tiene su base de datos **en su propio contenedor** (`db-usuarios`, `db-vendedores`, …). Ningún servicio conoce la cadena de conexión de otro.
  - **PostgreSQL** en usuarios, vendedores, inventario y pedidos-pagos: datos relacionales y **transacciones**. El stock y el dinero no pueden quedar a medias.
  - **MongoDB** en catálogo: cada categoría tiene atributos distintos (rin y talla en bicicletas, voltaje en tecnología, número de vueltas en un sombrero vueltiao). En notificaciones: son documentos independientes.
  - **Redis** en carrito: estado efímero con TTL de 7 días y lecturas muy rápidas. Si se pierde, no se pierde dinero.
- **¿Cómo se consultan datos de otro servicio?** Por su API (carrito pide el precio a catálogo) o guardando una **copia local** que llega por eventos. Por ejemplo, catálogo guarda `estadoStock` a partir de `inventario.actualizado`, y pedidos-pagos guarda un *snapshot* de nombre y precio al crear el pedido.
- **Consecuencias.** No hay *joins* entre servicios ni claves foráneas entre bases. La integridad entre servicios es eventual y la cuidan los eventos. Alternativa documentada si falta RAM: un solo servidor Postgres con **una base y un usuario por servicio**, sin permisos cruzados.

## ADR-04 · RabbitMQ (y no Kafka) para la comunicación asíncrona

- **Contexto.** Hay consecuencias que no deben bloquear al usuario: avisar, descontar definitivamente el stock, vaciar el carrito.
- **Decisión.** RabbitMQ con un exchange **topic** `plaza.eventos`. Cada consumidor tiene **su propia cola durable**, con *ack* manual, 3 reintentos y una cola de mensajes muertos `<cola>.dlq` a través del exchange `plaza.dlx`.
- **Alternativas.** Kafka: es un *log* distribuido, con retención y re-lectura de eventos y un volumen enorme. Aquí el volumen es pequeño y lo que se necesita es **enrutamiento por tipo de evento y colas de trabajo**, que es justo lo que RabbitMQ hace de forma simple. Usaríamos Kafka para analítica en tiempo real, *event sourcing* o millones de eventos por segundo.
- **Consecuencias.** Si notificaciones está caído, sus mensajes **esperan en la cola** y llegan al volver (prueba de resiliencia A). Coste: hay que operar otro componente y diseñar consumidores idempotentes.

## ADR-05 · Regla para elegir REST o evento

> **Si el usuario necesita la respuesta para continuar → REST. Si es una consecuencia que puede ocurrir un instante después → evento.**

| Interacción | Tipo | Por qué |
|---|---|---|
| carrito → catálogo (precio) y → inventario (disponibilidad) | REST | Hay que decirle al cliente *ya* si puede agregar el producto |
| pedidos-pagos → inventario (reservar) | REST | Si no hay stock, el checkout debe fallar en ese momento con un 409 |
| catálogo → vendedores (¿aprobado?) | REST | No se puede publicar sin saberlo |
| pago.aprobado → inventario (confirmar), notificaciones, carrito (vaciar) | Evento | El pago ya ocurrió; lo demás puede pasar milisegundos después |
| pago.rechazado → inventario (liberar) | Evento | Compensación: no bloquea la respuesta al cliente |
| inventario.actualizado → catálogo | Evento | Copia local del estado de stock para filtrar sin preguntar en cada consulta |
| reserva.confirmada, notificacion.enviada → pedidos-pagos | Evento | Solo alimentan la traza del pedido |

## ADR-06 · Saga **orquestada** para la compra

- **Contexto.** Una compra toca carrito, catálogo, inventario, pagos y notificaciones, y no existe una transacción distribuida.
- **Decisión.** **pedidos-pagos orquesta** los pasos síncronos (leer el carrito → congelar precios → reservar → crear pedido → cobrar). Las consecuencias posteriores son **coreografiadas por eventos**. La compensación ante un pago rechazado es `pago.rechazado → inventario libera la reserva`. Si nadie paga, la reserva **vence a los 15 min** y se libera sola.
- **Alternativas.** Saga 100 % coreografiada: más desacoplada, pero el flujo queda repartido en 5 servicios y cuesta explicarlo y depurarlo. 2PC (*two-phase commit*): bloquea recursos y no está soportado entre Postgres, Mongo y Redis.
- **Consecuencias.** El flujo se lee en un solo archivo (`servicios/pedidos-pagos/src/servicios`). La tabla `PasoTraza` guarda cada paso con su servicio, si fue REST o evento, y el `correlationId`. Eso es lo que muestra la **Traza del pedido**. Si inventario no responde al reservar, no se guarda nada y se responde 503: **nada queda a medias**.

## ADR-07 · Concurrencia: nunca vender la misma unidad dos veces

- **Decisión.** La reserva corre dentro de una transacción de Postgres con `SELECT … FOR UPDATE` sobre las filas de stock, ordenadas por `productoId` para evitar *deadlocks*. Primero se verifica `disponible = fisico − reservado` para **todos** los ítems y solo después se incrementa `reservado`. Si algún ítem no alcanza, se lanza un 409 `STOCK_INSUFICIENTE` y **no cambia nada**.
- **Consecuencias.** Dos clientes que compran la última unidad a la vez: el segundo espera el bloqueo, ve `disponible = 0` y recibe 409 (prueba de resiliencia C). El stock nunca queda negativo.

## ADR-08 · Idempotencia

- **Checkout.** `POST /pedidos` exige el header `Idempotency-Key`. Hay un índice único `(clienteId, idempotencyKey)`: si el cliente reintenta (doble clic, red lenta), recibe **el mismo pedido** y no se crea otro.
- **Consumidores.** RabbitMQ entrega "al menos una vez", así que un evento puede llegar dos veces. Cada servicio guarda los `id` de los eventos que ya procesó (`EventoProcesado`) y los ignora si se repiten.
- **Operaciones de reserva.** Confirmar o liberar una reserva dos veces no tiene doble efecto.

## ADR-09 · Consistencia eventual

- Tras un pago aprobado, durante unos milisegundos el pedido ya está `PAGADO` mientras el inventario aún no ha confirmado el descuento. Es aceptable porque las unidades ya estaban **reservadas**: nadie más puede comprarlas.
- El catálogo muestra `estadoStock` copiado por eventos. El dato definitivo siempre lo da inventario (`GET /inventario/:id`) y se vuelve a validar al agregar al carrito y al reservar.
- La interfaz lo comunica con la traza del pedido y con las notificaciones en vivo.

## ADR-10 · JWT con access token corto + refresh rotativo

- **Decisión.** El access token es un JWT HS256 de 15 min con `sub`, `rol`, `nombre` y `email`. El refresh token es aleatorio, dura 7 días y es **de un solo uso**: en la base se guarda solo su hash SHA-256. Si se reutiliza un refresh token ya usado (posible robo), se revocan todas las sesiones de ese usuario. El frontend renueva la sesión al recibir un 401 y reintenta la petición una vez.
- **Defensa en profundidad.** El gateway verifica el token y pasa `X-Usuario-Id` y `X-Usuario-Rol`, pero además **cada servicio vuelve a verificar la firma** y aplica la **autorización por recurso** (un vendedor solo edita SUS productos; un cliente solo ve SUS pedidos). El gateway borra cualquier header `X-Usuario-*` o `X-Clave-Interna` que llegue del navegador.
- **Autenticación vs autorización.** Autenticación = quién eres (JWT válido, si no → 401). Autorización = qué puedes hacer (rol o dueño, si no → 403).
- **Alternativas.** Sesiones con cookie en servidor: obligan a guardar estado compartido. RS256 con llave pública: mejor si terceros validan tokens; aquí todos los servicios son nuestros y comparten el secreto vía `.env`.
- **Servicio a servicio.** Las llamadas internas llevan una **clave interna** (`X-Clave-Interna`) que nunca llega al navegador. Las rutas `/interno/*` y `/reservas` no se enrutan desde el gateway.

## ADR-11 · Gateway propio con Express (no NGINX/Kong)

- **Contexto.** El gateway debía validar el JWT, propagar el `correlationId`, aplicar rate limit, agregar los Swagger de los 7 servicios, dar la salud agregada y **observar los eventos** para el panel de administración.
- **Decisión.** Gateway propio con Express + `http-proxy-middleware` (`gateway/src/app.js`). La tabla de rutas está en `gateway/src/rutas.js`.
- **Alternativas.** NGINX: muy rápido, pero validar JWT y escuchar RabbitMQ requiere módulos extra. Kong o Spring Cloud Gateway: potentes pero pesados para el alcance del curso.
- **Consecuencias.** Todo en el mismo lenguaje y fácil de explicar. En producción convendría Kong, un API Gateway gestionado o un Ingress de Kubernetes.

## ADR-12 · SSE para notificaciones en tiempo real (no WebSocket)

- **Decisión.** `GET /notificaciones/stream` y `GET /monitor/stream` con **Server-Sent Events**.
- **Por qué.** El flujo es **unidireccional** (servidor → navegador). SSE es HTTP normal, pasa por el gateway sin configuración especial y el navegador **reconecta solo** (`retry: 3000`). WebSocket sería necesario si el navegador también enviara mensajes en tiempo real (un chat, por ejemplo).
- **Detalle.** `EventSource` no permite headers, así que el token viaja como `?token=`. Es aceptable en este contexto. En producción usaríamos una cookie `HttpOnly` o un ticket de un solo uso.

## ADR-13 · Observabilidad: correlationId, logs JSON y salud

- El gateway crea el `X-Correlation-Id`, que viaja a cada servicio, a cada llamada interna y **dentro de cada evento**. Cada línea de log incluye `servicio`, `correlationId`, `usuarioId`, método, ruta, status y duración.
- Para seguir una compra completa en PowerShell:
  ```powershell
  docker compose logs --no-log-prefix | Select-String "<correlationId>"
  ```
  (con `cmd`: `docker compose logs | findstr <correlationId>`).
- `/salud` (*liveness*: el proceso está arriba) y `/salud/listo` (*readiness*: BD y RabbitMQ conectados) en cada servicio. El `healthcheck` del compose usa `/salud/listo`. El gateway expone `GET /salud` con el estado y la latencia de los 7 servicios y RabbitMQ, que alimenta el **Mapa de servicios** en vivo.

## ADR-14 · `compartido/` solo con utilidades técnicas

- **Decisión.** `@plaza/compartido` contiene logger, errores, validación, JWT, cliente HTTP, bus de eventos y base Express. **Nunca modelos de dominio.**
- **Por qué.** Si `Producto` o `Pedido` estuvieran compartidos, un cambio en un servicio obligaría a desplegar los demás: un **monolito distribuido**. Cada servicio define sus propios modelos y solo comparte **contratos** (`docs/contratos.md`).

## ADR-15 · Pasarela de pago simulada

- `4242 4242 4242 4242` → aprobado. `4000 0000 0000 0002` → rechazado ("Fondos insuficientes"). Se valida el algoritmo de Luhn. **Nunca se guarda el número completo ni el CVV**: solo la marca y los últimos 4 dígitos.
- Para producción se integraría una pasarela real (Wompi, PayU o Mercado Pago) con *webhooks*, y el cobro pasaría a ser asíncrono.

## Qué cambiaría para producción

Kubernetes (réplicas, *autoscaling*, *rolling updates*). HTTPS/TLS en el borde y mTLS interno. Gestión de secretos (Vault o Secrets Manager) en vez de `.env`. Patrón *outbox* para no perder eventos si el broker cae justo al publicar. Pasarela de pagos real. Migraciones versionadas (`prisma migrate`) en vez de `db push`. Métricas Prometheus + Grafana y trazas distribuidas con OpenTelemetry. Backups de las bases. CDN para las imágenes.
