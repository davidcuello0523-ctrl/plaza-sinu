# Resultados de pruebas de resiliencia

Ejecutado: 12/11/2026, 8:49:25 a. m. · Gateway: http://localhost:8080

**Resultado: 11/11 casos correctos**

| # | Caso | Resultado | Detalle |
|---|---|---|---|
| 1 | A1. Con notificaciones caído se puede comprar y pagar | ✅ | pedido PS-000125 · pago 201 |
| 2 | A2. Los eventos esperan en la cola notificaciones.eventos | ✅ | 2 mensajes pendientes, 0 consumidores |
| 3 | A3. Al volver, las notificaciones pendientes llegan | ✅ | Pago aprobado – pedido PS-000125 |
| 4 | B1. Checkout con inventario caído → 503 con mensaje claro | ✅ | 503 · Inventario no disponible, intenta en unos segundos |
| 5 | B2. No queda ningún pedido a medias | ✅ | pedidos 3 → 3 |
| 6 | C1. Dos clientes compran la última unidad a la vez → solo uno la obtiene | ✅ | respuestas 201 y 409 · Monitor 24" Full HD está agotado |
| 7 | C2. Al cancelar, la unidad vuelve a estar disponible | ✅ | disponible 1 |
| 8 | D1. Token vencido → 401 'Tu sesión expiró' | ✅ | Tu sesión expiró, vuelve a iniciar sesión |
| 9 | D2. Sin token → 401 | ✅ | Debes iniciar sesión para continuar |
| 10 | D3. Cliente intenta aprobar un vendedor → 403 | ✅ | Esta acción requiere rol: admin |
| 11 | D4. Cliente intenta listar usuarios → 403 | ✅ | Esta acción requiere rol: admin |
