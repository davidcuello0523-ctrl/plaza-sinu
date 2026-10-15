# Contratos entre servicios — Plaza Sinú

Este documento es la **fuente de verdad** de cómo se hablan los servicios: rutas internas, eventos y datos de demostración con IDs fijos. Los servicios **no comparten base de datos ni modelos**. Solo comparten estos contratos.

## 1. Convenciones (todas obligatorias)

- Express 5 + ES Modules. Capas: `src/rutas → src/controladores → src/servicios (lógica) → src/repositorio (BD)`, más `src/eventos/` (publicadores/consumidores) y `src/clientes/` (REST a otros servicios con `crearClienteHttp`).
- `src/app.js` exporta `construirApp({ repo, bus, clientes, logger, verificaciones })` **sin conectarse a nada** (las pruebas le pasan dobles en memoria). `src/index.js` conecta la BD y RabbitMQ, siembra si `SEED_DEMO=true` y la BD está vacía, y llama a `iniciarServidor`. La plantilla es `servicios/usuarios/`.
- Todo sale de `@plaza/compartido`: `crearApp`, `finalizarApp`, `iniciarServidor`, `crearLogger`, `crearBus`, `crearClienteHttp`, `contexto(req)`, `validar(esquemaZod, origen)`, `autenticar`, `autenticarOpcional`, `requerirRol`, `soloInterno` y los errores (`ErrorValidacion` 422, `ErrorConflicto` 409, `ErrorNoEncontrado` 404, `ErrorProhibido` 403, `ErrorNoAutenticado` 401, `ErrorPeticion` 400, `ErrorServicioNoDisponible` 503, `ErrorApp(status, codigo, mensaje, detalles)`).
- Formato de error único: `{ error: { codigo, mensaje, detalles, correlationId } }`.
- Listas paginadas: `{ datos: [...], pagina, porPagina, total, totalPaginas }`. Listas simples: `{ datos: [...] }`.
- Dinero: **enteros en COP** (sin decimales). Fechas en ISO 8601.
- El usuario autenticado está en `req.usuario = { id, rol, nombre, email }` (roles: `cliente`, `vendedor`, `admin`).
- **Rutas internas** (solo servicio→servicio) llevan el prefijo `/interno/` y el middleware `soloInterno`. El gateway responde 404 a cualquier ruta con `/interno/` y no enruta `/reservas`.
- Llamadas internas: `crearClienteHttp({ servicio: "inventario", urlBase: process.env.INVENTARIO_URL })`, siempre con `contexto(req)` para propagar `correlationId` y el token.
- Cada consumidor de eventos es **idempotente**: guarda los ids de evento procesados en su propia BD (tabla/colección `EventoProcesado`) y se los pasa a `bus.consumir({ cola, claves, manejador, procesados: { existe, guardar } })`. Nombre de cola: `<servicio>.<propósito>`, p. ej. `inventario.pagos`.
- Al publicar, el campo `datos` incluye siempre un `resumen` corto en español (lo muestra el Radar de eventos), p. ej. `"Pago aprobado PS-000123 · $ 1.250.000"`.
- Cada servicio tiene `GET /salud`, `GET /salud/listo` (con verificación de BD y `rabbitmq`), `GET /docs` y `GET /openapi.json` (lo da `crearApp` a partir de `openapi.yaml`).
- Pruebas: Jest (ESM) + Supertest con dobles en memoria, como en `servicios/usuarios/tests/`. `npm test` dentro del servicio debe pasar.
- Dockerfile: copia el de `servicios/usuarios/Dockerfile` cambiando nombre y puerto. Los servicios con Mongo o Redis no llevan openssl, `prisma generate` ni `db push`.
- Comentarios en español, solo donde haya una decisión importante. Nombres del dominio en español.

## 2. Puertos y variables

| Servicio | Puerto | Variables propias |
|---|---|---|
| usuarios | 4001 | DATABASE_URL |
| vendedores | 4002 | DATABASE_URL |
| catalogo | 4003 | MONGO_URL |
| inventario | 4004 | DATABASE_URL |
| carrito | 4005 | REDIS_URL |
| pedidos-pagos | 4006 | DATABASE_URL |
| notificaciones | 4007 | MONGO_URL |

Todas reciben: `JWT_SECRET`, `CLAVE_INTERNA`, `RABBITMQ_URL`, `SEED_DEMO`, `LOG_LEVEL` y las URLs `USUARIOS_URL`, `VENDEDORES_URL`, `CATALOGO_URL`, `INVENTARIO_URL`, `CARRITO_URL`, `PEDIDOS_URL`, `NOTIFICACIONES_URL`.

## 3. Rutas internas (servicio → servicio)

| Servicio | Ruta interna | Respuesta |
|---|---|---|
| vendedores | `GET /interno/vendedores/por-usuario/:usuarioId` | Vendedor completo o 404 |
| vendedores | `GET /interno/vendedores/:id` | Vendedor completo o 404 |
| catalogo | `GET /interno/productos?ids=a,b,c` | `{ datos: [{ id, nombre, precio, categoria, imagen, vendedorId, vendedorUsuarioId, nombreTienda, publicado, eliminado }] }` |
| inventario | `POST /inventario/disponibilidad` `{ items:[{productoId,cantidad}] }` (lote, autenticado o interno) | `{ datos:[{ productoId, disponible, solicitado, alcanza, estado }] }` |
| inventario | `POST /reservas` `{ pedidoId, items:[{productoId,cantidad}], minutos?:15 }` | 201 `{ id, pedidoId, estado:"ACTIVA", venceEn, items }` · 409 `STOCK_INSUFICIENTE` con `detalles:[{productoId, disponible, solicitado}]` |
| inventario | `POST /reservas/:id/confirmar` | 200 reserva `CONFIRMADA` (idempotente) |
| inventario | `POST /reservas/:id/liberar` | 200 reserva `LIBERADA` (idempotente) |
| carrito | `GET /interno/carrito/:usuarioId` | Carrito (formato de `GET /carrito`) |
| carrito | `DELETE /interno/carrito/:usuarioId` | 204 |

Las rutas `/reservas*` también usan `soloInterno`.

## 4. Eventos (exchange topic `plaza.eventos`)

Sobre común: `{ id, tipo, version, ocurridoEn, correlationId, origen, datos }`. Lo crea `bus.publicar(tipo, datos, { correlationId })`.

| tipo | publica | consume | `datos` |
|---|---|---|---|
| `usuario.registrado` | usuarios | notificaciones | `{ usuarioId, nombre, email, rol }` |
| `vendedor.aprobado` | vendedores | catalogo, notificaciones | `{ vendedorId, usuarioId, nombreTienda, resumen }` |
| `vendedor.suspendido` | vendedores | catalogo, notificaciones | `{ vendedorId, usuarioId, nombreTienda, resumen }` |
| `producto.publicado` | catalogo | inventario | `{ productoId, vendedorId, vendedorUsuarioId, nombre, resumen }` |
| `pedido.creado` | pedidos-pagos | notificaciones | `{ pedidoId, codigo, clienteId, total, unidades, subpedidos:[{ subpedidoId, vendedorId, vendedorUsuarioId, nombreTienda, unidades, subtotal }], resumen }` |
| `pago.aprobado` | pedidos-pagos | inventario, notificaciones, carrito | `{ pedidoId, codigo, clienteId, reservaId, total, marca, ultimos4, subpedidos:[igual que arriba], resumen }` |
| `pago.rechazado` | pedidos-pagos | inventario, notificaciones | `{ pedidoId, codigo, clienteId, reservaId, motivo, resumen }` |
| `inventario.actualizado` | inventario | catalogo | `{ productoId, stock, disponible, umbral, estado: "disponible" \| "ultimas_unidades" \| "agotado", resumen }` |
| `inventario.stock_bajo` | inventario | notificaciones | `{ productoId, nombreProducto, vendedorUsuarioId, disponible, umbral, resumen }` |
| `pedido.estado_cambiado` | pedidos-pagos | notificaciones | `{ pedidoId, codigo, subpedidoId, clienteId, nombreTienda, estadoAnterior, estadoNuevo, resumen }` |
| `reserva.confirmada` | inventario | pedidos-pagos | `{ pedidoId, reservaId, unidades, resumen }` |
| `reserva.liberada` | inventario | pedidos-pagos | `{ pedidoId, reservaId, motivo: "pago_rechazado" \| "vencida" \| "cancelado", resumen }` |
| `notificacion.enviada` | notificaciones | pedidos-pagos | `{ pedidoId, eventoOrigen, destinatarios:[{ usuarioId, rol }], resumen }` (solo si el evento origen tenía `pedidoId`) |

Estado de stock: `agotado` si disponible = 0; `ultimas_unidades` si 0 < disponible ≤ umbral; si no, `disponible`.

## 5. Datos de demostración (IDs FIJOS)

**Usuarios** (los siembra usuarios, clave `Demo123*`): `id(n) = 00000000-0000-4000-a000-` + n con 12 dígitos.
admin = id(1) · clientes = id(11) Laura Petro, id(12) Andrés Doria, id(13) Valentina Hoyos, id(14) Camilo Negrete · vendedores = id(101)…id(108).

**Vendedores** (los siembra vendedores): `vid(n) = 00000000-0000-4000-c000-` + n con 12 dígitos.

| vid | usuario | Tienda | slug | Categoría principal | Ciudad | Color | Estado |
|---|---|---|---|---|---|---|---|
| vid(1) | id(101) | Tecno Sinú | tecno-sinu | tecnologia | Montería | #1F6FB2 | APROBADO |
| vid(2) | id(102) | Rueda Libre | rueda-libre | bicicletas | Montería | #2F8F5B | APROBADO |
| vid(3) | id(103) | Hilo & Río | hilo-y-rio | ropa | Cereté | #B0457A | APROBADO |
| vid(4) | id(104) | Casa Ronda | casa-ronda | hogar | Montería | #8A5A2B | APROBADO |
| vid(5) | id(105) | Taller Zenú | taller-zenu | artesanias | Sahagún | #C98A12 | APROBADO |
| vid(6) | id(106) | Papelería El Lápiz | papeleria-el-lapiz | papeleria | Lorica | #3D6B7A | APROBADO |
| vid(7) | id(107) | Deportes Ribera | deportes-ribera | deportes | Montería | #C23B3B | APROBADO |
| vid(8) | id(108) | Mercadito Tierralta | mercadito-tierralta | hogar | Tierralta | #6B7A2E | PENDIENTE |

**Categorías** (slug → nombre): `tecnologia` Tecnología, `bicicletas` Bicicletas y accesorios, `ropa` Ropa, `hogar` Hogar, `artesanias` Artesanías, `papeleria` Papelería, `deportes` Deportes.

**Productos**: ids `prd-001` … `prd-048`, en bloques de 7 por vendedor aprobado (vid(1): 001–007, vid(2): 008–014, vid(3): 015–021, vid(4): 022–028, vid(5): 029–035, vid(6): 036–042, vid(7): 043–048). Los primeros de la demo:

| id | nombre | precio | vendedor |
|---|---|---|---|
| prd-001 | Portátil Lenovo IdeaPad 15" Ryzen 5 | 2.499.000 | vid(1) |
| prd-002 | Audífonos inalámbricos Sinú Bass | 189.000 | vid(1) |
| prd-003 | Monitor 24" Full HD | 649.000 | vid(1) |
| prd-008 | Bicicleta MTB rin 29 Shimano | 1.850.000 | vid(2) |
| prd-009 | Casco MTB ventilado | 159.000 | vid(2) |
| prd-029 | Sombrero vueltiao 19 vueltas | 420.000 | vid(5) |
| prd-030 | Mochila zenú en caña flecha | 135.000 | vid(5) |

**Stock inicial** (lo siembra inventario; catalogo usa la MISMA regla para el estado inicial): umbral = 3 para todos; `stock(i)` para `prd-<i>` = casos especiales `{ 9: 2, 3: 1, 30: 2, 20: 0 }`; los demás `5 + ((i * 7) % 36)`.
→ prd-009 (Casco MTB, 2 uds) y prd-003 (1 ud) sirven para demostrar stock bajo y concurrencia; prd-020 queda agotado.

**Pedidos históricos** (los siembra pedidos-pagos): 5–6 pedidos de los clientes id(11)–id(14) en estados variados (ENTREGADO, ENVIADO, PREPARANDO, PAGO_RECHAZADO, CANCELADO), con snapshots de los productos de la tabla de arriba y códigos `PS-000101`… El contador para pedidos nuevos empieza en `PS-000123`.

## 6. Pedido: estados

Pedido: `PENDIENTE_PAGO → PAGADO | PAGO_RECHAZADO | CANCELADO`, `RECHAZADO_SIN_STOCK` (falló la reserva) y `COMPLETADO` (todos los sub-pedidos entregados).
Sub-pedido (por vendedor): `PENDIENTE_PAGO → PAGADO → PREPARANDO → ENVIADO → ENTREGADO`, o `CANCELADO`.
