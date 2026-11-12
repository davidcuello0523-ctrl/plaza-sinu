# Guion de sustentación — Plaza Sinú

**Duración objetivo:** 18 minutos de exposición + preguntas · **Equipo:** David Cuello (D) y Miguel Miranda (M)

Antes de empezar, revisa el [checklist de la demo](checklist-demo.md). Tener abiertas las pestañas en este orden ahorra tiempo:

1. Diapositivas o este guion
2. http://localhost:3000/?demo=1 (cliente)
3. http://localhost:3000/sala (admin, en otra ventana o perfil)
4. http://localhost:8080/docs
5. http://localhost:15672
6. Terminal de PowerShell en la carpeta del repo
7. VS Code con el repo abierto

| # | Etapa | Tiempo | Quién | Qué mostrar |
|---|---|---|---|---|
| 1 | Problema | 1 min | M | Portada de La Plaza |
| 2 | Objetivo | 1 min | M | Diapositiva de objetivos |
| 3 | Arquitectura | 2 min | D | `docs/arquitectura/01-arquitectura-general.png` |
| 4 | Microservicios | 2 min | D | Tabla del README y Mapa de servicios |
| 5 | Comunicación | 2 min | D | `02-comunicacion.png`, Radar de eventos, panel de RabbitMQ |
| 6 | Persistencia | 2 min | M | `docs/modelos-datos/README.md` y un `schema.prisma` |
| 7 | Seguridad | 2 min | M | Swagger con *Authorize*, error 401/403 en vivo |
| 8 | Contenedores | 1,5 min | D | `docker compose ps` y `docker-compose.yaml` |
| 9 | Pruebas | 1,5 min | M | `docs/pruebas/plan-de-pruebas.md` y una corrida de `npm test` de un servicio |
| 10 | Demostración | 3 min | D (maneja) + M (narra) | Flujo obligatorio con Modo sustentación |
| | **Total** | **18 min** | | |

---

## 1. Problema — Miguel (1 min)

- Los pequeños comercios de Córdoba (Montería, Cereté, Lorica, Sahagún) venden por WhatsApp o Instagram: sin catálogo común, sin control de inventario y sin seguimiento del pedido.
- Un cliente que quiere comprar a tres tiendas hace tres conversaciones y tres pagos.
- **Plaza Sinú** es una plaza de mercado digital: cada comercio tiene su *puesto*, y el cliente compra a varios puestos en un solo carrito.

## 2. Objetivo — Miguel (1 min)

**General:** construir un marketplace multivendedor con arquitectura de microservicios que controle el ciclo completo desde la consulta del catálogo hasta el pedido pagado, el inventario actualizado y la notificación.

**Específicos:**
1. Separar el dominio en 7 microservicios independientes, cada uno con su base de datos.
2. Exponer las APIs por un API Gateway con autenticación JWT y documentarlas con OpenAPI.
3. Comunicar los servicios por REST y por eventos de RabbitMQ.
4. Garantizar que una unidad no se venda dos veces y que una compra fallida no deje datos a medias.
5. Contenerizar la solución con Docker Compose y validarla con pruebas automatizadas.

## 3. Arquitectura — David (2 min)

Mostrar `01-arquitectura-general.png`.

- **Por qué microservicios:** el catálogo se lee muchísimo, el inventario exige consistencia fuerte, el carrito es efímero, los pagos son críticos y las notificaciones pueden llegar un instante después. Cada parte tiene necesidades distintas (ADR-01).
- El navegador **solo** habla con el gateway (:8080). Los servicios y las bases viven en una red interna.
- Somos honestos con el costo: más complejidad operativa (17 contenedores) y consistencia eventual. Por eso invertimos en `correlationId`, logs JSON, salud y traza.

## 4. Microservicios — David (2 min)

Mostrar la tabla del README y la pestaña **Mapa de servicios**.

- Recorrer los 7: qué hace cada uno y qué base usa.
- Remarcar que **no es un CRUD en carpetas**: inventario tiene reservas con vencimiento y kardex; pedidos-pagos tiene una máquina de estados y una saga; notificaciones empuja en vivo por SSE.
- `compartido/` solo tiene utilidades técnicas, nunca modelos de dominio (ADR-14).

## 5. Comunicación — David (2 min)

Mostrar `02-comunicacion.png`, después el **Radar de eventos** y el panel de RabbitMQ (colas y DLQ).

- **Regla:** si el usuario necesita la respuesta para continuar → **REST**; si es una consecuencia → **evento** (ADR-05).
- Ejemplos: el carrito pregunta el precio a catálogo por REST; el pago aprobado se anuncia con `pago.aprobado` y tres servicios reaccionan (inventario confirma, carrito se vacía, notificaciones avisa).
- Exchange topic `plaza.eventos`, una cola durable por consumidor, 3 reintentos y cola de mensajes muertos.
- **Saga orquestada** por pedidos-pagos con compensación (`pago.rechazado` → inventario libera).

## 6. Persistencia — Miguel (2 min)

Mostrar `docs/modelos-datos/README.md` y `servicios/inventario/prisma/schema.prisma`.

- **Una base por servicio, en su propio contenedor.** Nadie lee la base de otro.
- PostgreSQL donde hay dinero o stock (transacciones), MongoDB donde la forma varía (atributos por categoría), Redis para el carrito (TTL de 7 días).
- Los datos de otro servicio se piden por REST o se copian por eventos. Ejemplo: catálogo guarda `estadoStock` a partir de `inventario.actualizado`, y el pedido guarda un *snapshot* del precio.
- `SELECT … FOR UPDATE` en la reserva: dos clientes nunca compran la misma última unidad.

## 7. Seguridad — Miguel (2 min)

Mostrar Swagger (`/docs`), el botón *Authorize*, y en la web un 403 entrando como cliente a `/sala`.

- **Autenticación:** JWT de 15 minutos + refresh token rotativo de un solo uso; claves con bcrypt.
- **Autorización:** por rol (cliente, vendedor, admin) y por recurso (un vendedor solo edita SUS productos).
- **Defensa en profundidad:** el gateway valida el token, pero cada servicio lo vuelve a validar.
- **Rutas internas:** `/interno/*` y `/reservas` exigen una clave interna y el gateway responde 404 si alguien las pide desde fuera.
- Rate limit en `/auth` (30 intentos por minuto).

## 8. Contenedores — David (1,5 min)

En la terminal:

```powershell
docker compose ps
```

- 17 contenedores `healthy`. Dockerfiles multi-etapa con `node:22-alpine` y usuario no root.
- Healthcheck en cada servicio contra `/salud/listo` (verifica la base y RabbitMQ). El compose arranca en orden con `depends_on: service_healthy`.
- Todo se levanta con un comando: `docker compose up --build`.

## 9. Pruebas — Miguel (1,5 min)

Mostrar `docs/pruebas/plan-de-pruebas.md`. Si hay tiempo:

```powershell
cd servicios/inventario; npm test; cd ../..
```

- 147 pruebas unitarias y de API, E2E 24/24, resiliencia 11/11, concurrencia con Postgres real y una prueba de UI con Playwright.
- Resiliencia: con notificaciones caído se sigue vendiendo y los mensajes esperan en la cola; con inventario caído el checkout responde 503 y no queda nada a medias.

## 10. Demostración — David maneja, Miguel narra (3 min)

1. Abrir http://localhost:3000/?demo=1 → panel **Modo sustentación** con los 7 pasos.
2. Entrar como `cliente@plazasinu.co` / `Demo123*` → ✅ Iniciar sesión.
3. Catálogo → un producto → ✅ Consultar productos.
4. **Agregar al carrito** → ✅ Agregar al carrito.
5. Carrito → **Continuar con la compra** → dirección → **Reservar y continuar al pago** → ✅ Generar pedido.
6. Tarjeta **4242** → **Pagar** → ✅ Registrar pago, ✅ Actualizar inventario, ✅ Generar notificación.
7. Mostrar la **Traza del pedido** (servicios, REST vs evento, `correlationId`) y la campana.
8. Cambiar a la ventana del admin → **Radar de eventos**: los eventos de esta compra.
9. Cierre (si queda tiempo): copiar el comando de logs de la traza y pegarlo en PowerShell para ver la misma compra en los 5 servicios.

**Frase de cierre (Miguel):** "Una compra atravesó siete servicios, dos protocolos y tres motores de base de datos, y en ningún momento quedó algo a medias."

---

## Plan B si algo falla en vivo

| Falla | Qué hacer |
|---|---|
| Docker no levanta o un contenedor queda `unhealthy` | `docker compose restart <servicio>`. Si no, seguir con las capturas de [`docs/evidencias/`](../evidencias/) en orden 01 → 09 |
| La web no carga productos | Esperar 20 s (el gateway arranca último) y recargar. Si no, mostrar `02-catalogo.png` |
| El pago queda colgado | Mostrar el pedido en **Mis pedidos** y la [traza capturada](../evidencias/08-traza-pedido.png) |
| Sin internet | No hace falta: todo corre local. Las fuentes de la web están empaquetadas |
| El portátil se queda sin batería o se congela | Abrir este repositorio en GitHub desde otro equipo y presentar con las capturas y los resultados de [E2E](../pruebas/resultados-e2e.md) |
| Pregunta difícil | [preguntas-probables.md](preguntas-probables.md) |
