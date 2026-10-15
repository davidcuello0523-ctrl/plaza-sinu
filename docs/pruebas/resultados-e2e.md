# Resultados E2E — flujo obligatorio de compra

Ejecutado: 15/10/2026, 1:09:53 p. m. · Gateway: http://localhost:8080

**Resultado: 24/24 casos correctos**

| # | Caso | Resultado | Detalle |
|---|---|---|---|
| 1 | 1. Iniciar sesión (usuarios emite JWT) | ✅ | status 200 |
| 2 | 2. Consultar productos (catálogo con estado de stock) | ✅ | 7 bicicletas · Bicicleta MTB rin 29 Shimano → disponible |
| 3 | 3. Agregar al carrito (valida precio y stock) | ✅ | status 201 · total 3700000 |
| 4 | 4. Generar pedido → PENDIENTE_PAGO | ✅ | status 201 · PS-000123 · correlationId a39c2cd2-284c-481b-bccf-4314ba6588fd |
| 5 | 4b. Repetir POST /pedidos con la misma Idempotency-Key no duplica | ✅ | status 200 · mismo id |
| 6 | 5. Inventario reserva las unidades | ✅ | disponible 25 → 23 (físico 25) |
| 7 | 6. Registrar pago (tarjeta 4242 → aprobado) | ✅ | status 201 · •••• 4242 |
| 8 | 6b. pago.aprobado → inventario confirma (descuento definitivo) | ✅ | físico 25 → 23 |
| 9 | 7. Generar notificación (cliente avisado por evento) | ✅ | Pago aprobado – pedido PS-000123 |
| 10 | 7b. El vendedor recibe 'nuevo pedido' | ✅ | Nuevo pedido de 2 unidades — PS-000123 |
| 11 | 7c. El carrito se vacía solo al aprobarse el pago | ✅ |  |
| 12 | 7d. La traza del pedido muestra los servicios que participaron | ✅ | carrito → catalogo → pedidos-pagos → inventario → pedidos-pagos → notificaciones → notificaciones → inventario |
| 13 | 8. Vendedor avanza su sub-pedido (PAGADO → PREPARANDO) | ✅ | status 200 |
| 14 | 8b. pedido.estado_cambiado → cliente notificado | ✅ | Tu pedido PS-000123 de Rueda Libre está en preparación |
| 15 | 9. Pago con tarjeta 4000…0002 → rechazado (402) | ✅ | status 402 · Pago rechazado: Fondos insuficientes |
| 16 | 9b. pago.rechazado → inventario libera la reserva (compensación) | ✅ | disponible 19 → 19 |
| 17 | 9c. Cliente notificado del rechazo | ✅ | Pago rechazado – PS-000124 |
| 18 | 10. Sin token → 401 | ✅ |  |
| 19 | 11. Vendedor intenta comprar → 403 | ✅ |  |
| 20 | 12. Producto inexistente → 404 | ✅ |  |
| 21 | 13. Cantidad inválida → 422 | ✅ |  |
| 22 | 14. Producto agotado → 409 | ✅ | Falda midi de algodón está agotado |
| 23 | 15. Cliente no ve el monitoreo del admin → 403 | ✅ |  |
| 24 | 16. Rutas internas bloqueadas por el gateway → 404 | ✅ |  |
