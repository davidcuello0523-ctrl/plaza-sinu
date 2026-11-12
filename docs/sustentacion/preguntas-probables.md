# Preguntas probables del jurado

Respuestas cortas, cada una con el archivo que la respalda.

### 1. ¿Por qué microservicios y no un monolito?

Porque los dominios tienen necesidades distintas: el catálogo se lee mucho, el inventario exige transacciones, el carrito es efímero y las notificaciones pueden llegar después. Separarlos permite que cada uno escale, falle y se despliegue por separado. Para un comercio pequeño, un monolito modular sería más simple, y lo decimos en el ADR.
**Respaldo:** [`decisiones-tecnicas.md` ADR-01](../decisiones-tecnicas.md)

### 2. ¿Por qué RabbitMQ y no Kafka?

Necesitamos enrutar por tipo de evento y colas de trabajo con reintentos, y el volumen es pequeño. Eso es exactamente RabbitMQ. Kafka es un log distribuido para retener y re-leer millones de eventos; lo usaríamos para analítica en tiempo real o *event sourcing*.
**Respaldo:** ADR-04 · [`compartido/src/eventos.js`](../../compartido/src/eventos.js)

### 3. ¿Qué pasa si se cae inventario?

Al generar el pedido, pedidos-pagos llama a inventario para reservar. Si no responde, el cliente HTTP interno lanza un 503 "Inventario no disponible, intenta en unos segundos" y **no se guarda ningún pedido**. La prueba de resiliencia B lo comprueba.
**Respaldo:** [`compartido/src/clienteHttp.js`](../../compartido/src/clienteHttp.js) · [resiliencia B1–B2](../pruebas/resultados-resiliencia.md)

### 4. ¿Y si se cae notificaciones?

Se sigue comprando y pagando. Los eventos esperan en la cola durable `notificaciones.eventos` y llegan cuando el servicio vuelve.
**Respaldo:** [resiliencia A1–A3](../pruebas/resultados-resiliencia.md) · ADR-04

### 5. ¿Cómo evitan vender dos veces la misma unidad?

La reserva corre en una transacción de PostgreSQL con `SELECT … FOR UPDATE` sobre las filas de stock, ordenadas por `productoId` para evitar *deadlocks*. Se verifica que todos los ítems alcancen antes de reservar. El segundo cliente espera el bloqueo, ve disponible 0 y recibe 409.
**Respaldo:** [`servicios/inventario/src/repositorio/inventario.repositorio.js`](../../servicios/inventario/src/repositorio/inventario.repositorio.js) · [`tests/concurrencia.integracion.test.js`](../../servicios/inventario/tests/concurrencia.integracion.test.js) · ADR-07

### 6. ¿Por qué una base de datos por servicio?

Si dos servicios comparten tablas quedan acoplados: cambiar una columna rompe al otro, y ya no se pueden desplegar por separado. Cada servicio tiene su contenedor de base y nadie conoce la conexión de otro.
**Respaldo:** ADR-03 · [`docker-compose.yaml`](../../docker-compose.yaml) · [modelos-datos/README.md](../modelos-datos/README.md)

### 7. Entonces, ¿cómo obtiene un servicio datos de otro?

Por REST cuando necesita la respuesta ya (el carrito pide el precio a catálogo), o guardando una copia local que le llega por eventos (catálogo guarda `estadoStock` desde `inventario.actualizado`).
**Respaldo:** ADR-05 · [modelos-datos/README.md](../modelos-datos/README.md)

### 8. ¿Cómo se protege una ruta interna?

Dos barreras: el gateway responde 404 a cualquier ruta con `/interno/` y no enruta `/reservas`; y cada servicio exige el header `X-Clave-Interna` con el middleware `soloInterno`. El gateway además borra ese header si llega del navegador.
**Respaldo:** [`gateway/src/rutas.js`](../../gateway/src/rutas.js) · [`gateway/src/app.js`](../../gateway/src/app.js) · [`compartido/src/auth.js`](../../compartido/src/auth.js) · E2E caso 16

### 9. ¿Cuál es la diferencia entre autenticación y autorización en su sistema?

Autenticación: quién eres (JWT válido; si no, 401). Autorización: qué puedes hacer (rol o dueño del recurso; si no, 403). Ejemplo: un vendedor autenticado no puede editar el producto de otro vendedor.
**Respaldo:** ADR-10 · [`servicios/catalogo/src/servicios/catalogo.servicio.js`](../../servicios/catalogo/src/servicios/catalogo.servicio.js)

### 10. Si el gateway ya valida el JWT, ¿por qué cada servicio lo vuelve a validar?

Defensa en profundidad: si alguien llegara a un servicio saltándose el gateway, igual necesitaría un token firmado. Además, la autorización por recurso solo la puede hacer el servicio dueño del dato.
**Respaldo:** ADR-10 · [`compartido/src/auth.js`](../../compartido/src/auth.js)

### 11. ¿Qué pasa si el cliente hace doble clic en "Pagar" o se repite la petición?

`POST /pedidos` exige el header `Idempotency-Key`, con un índice único `(clienteId, idempotencyKey)`: el segundo intento devuelve el mismo pedido. Los consumidores guardan los ids de eventos ya procesados, así que un evento repetido no tiene doble efecto.
**Respaldo:** ADR-08 · [`servicios/pedidos-pagos/src/controladores/pedidos.controlador.js`](../../servicios/pedidos-pagos/src/controladores/pedidos.controlador.js) · E2E caso 5

### 12. ¿Qué es una saga y por qué orquestada?

Una secuencia de transacciones locales con compensaciones, porque no hay transacción distribuida entre Postgres, Mongo y Redis. Orquestada porque el flujo se lee en un solo servicio (pedidos-pagos) y es más fácil de explicar y depurar; las consecuencias posteriores sí son coreografiadas por eventos.
**Respaldo:** ADR-06 · [`docs/arquitectura/03-secuencia-compra.png`](../arquitectura/03-secuencia-compra.png)

### 13. ¿Qué pasa si el cliente reserva y nunca paga?

La reserva vence a los 15 minutos. Un proceso en inventario revisa cada 30 segundos las reservas vencidas y las libera.
**Respaldo:** [`servicios/inventario/src/index.js`](../../servicios/inventario/src/index.js) · [`inventario.servicio.js`](../../servicios/inventario/src/servicios/inventario.servicio.js)

### 14. ¿Y si un evento falla siempre al procesarse?

Se reintenta 3 veces y luego va a la cola de mensajes muertos `<cola>.dlq` (exchange `plaza.dlx`), donde se puede revisar sin bloquear la cola principal.
**Respaldo:** [`compartido/src/eventos.js`](../../compartido/src/eventos.js) · [captura de colas](../evidencias/18-rabbitmq-colas.png)

### 15. ¿Cómo depuran un error que pasa por cinco servicios?

El gateway crea un `correlationId` que viaja en cada llamada interna y dentro de cada evento. Todos los logs son JSON con ese id. Con `docker compose logs --no-log-prefix | Select-String "<id>"` se ve la compra completa. La Traza del pedido lo muestra en la interfaz.
**Respaldo:** ADR-13 · [`compartido/src/logger.js`](../../compartido/src/logger.js) · [traza](../evidencias/08-traza-pedido.png)

### 16. ¿Cómo monitorean que los servicios estén vivos?

Cada servicio tiene `/salud` (proceso vivo) y `/salud/listo` (base y RabbitMQ conectados). Docker los usa como healthcheck. El gateway expone `/salud` con la latencia de los 7 servicios, que alimenta el Mapa de servicios en vivo.
**Respaldo:** ADR-13 · [Mapa de servicios](../evidencias/13-mapa-servicios.png)

### 17. ¿Por qué SSE y no WebSocket para las notificaciones?

El flujo es de una sola vía (servidor → navegador). SSE es HTTP normal, pasa por el gateway sin configuración especial y el navegador reconecta solo.
**Respaldo:** ADR-12

### 18. ¿Por qué hicieron su propio gateway en lugar de usar Kong o NGINX?

Necesitábamos validar JWT, propagar el `correlationId`, agregar los Swagger y escuchar RabbitMQ para el Radar. Con Express todo queda en el mismo lenguaje y es fácil de explicar. En producción usaríamos Kong o un Ingress de Kubernetes.
**Respaldo:** ADR-11 · [`gateway/src/`](../../gateway/src)

### 19. ¿Guardan los datos de la tarjeta?

No. La pasarela es simulada y valida Luhn; solo se guardan la marca y los últimos 4 dígitos. Nunca el número completo ni el CVV.
**Respaldo:** ADR-15 · [modelo `Pago`](../modelos-datos/pedidos-pagos.md)

### 20. ¿Qué cambiarían para llevarlo a producción?

Kubernetes con réplicas, HTTPS y mTLS, gestión de secretos en lugar de `.env`, patrón *outbox* para no perder eventos, pasarela de pago real, migraciones versionadas, métricas con Prometheus y trazas con OpenTelemetry.
**Respaldo:** [decisiones-tecnicas.md, "Qué cambiaría para producción"](../decisiones-tecnicas.md)
