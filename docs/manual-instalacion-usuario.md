# Manual de instalación y de usuario — Plaza Sinú

## Parte 1. Instalación

### Requisitos

- Windows 10/11, macOS o Linux con **Docker Desktop** (al menos 4 GB de RAM asignados) y **Git**.
- **Node.js 22** solo si vas a correr las pruebas.

### Pasos (PowerShell)

```powershell
git clone https://github.com/davidcuello0523-ctrl/plaza-sinu.git
cd plaza-sinu
Copy-Item .env.example .env
docker compose up --build
```

1. Espera a que `docker compose ps` muestre los **17 contenedores** como `healthy` (unos 2 minutos la primera vez).
2. Abre **http://localhost:3000**.

Atajo: `powershell -ExecutionPolicy Bypass -File scripts/levantar.ps1` hace todo lo anterior y avisa cuando el gateway está listo. Con `-Limpio` reinicia los datos de demostración.

### Direcciones útiles

| Qué | Dirección |
|---|---|
| Aplicación | http://localhost:3000 |
| Modo sustentación | http://localhost:3000/?demo=1 |
| Swagger de las APIs | http://localhost:8080/docs |
| Panel de RabbitMQ | http://localhost:15672 (`plaza` / `plaza`) |

### Apagar y reiniciar

| Acción | Comando |
|---|---|
| Apagar conservando los datos | `docker compose down` |
| Apagar y borrar los datos | `docker compose down -v` |
| Ver logs de un servicio | `docker compose logs -f pedidos-pagos` |

### Cuentas de demostración

Clave para todas: **`Demo123*`**.

| Rol | Correo |
|---|---|
| Cliente | `cliente@plazasinu.co` |
| Vendedor | `vendedor@plazasinu.co` (puesto Tecno Sinú) |
| Vendedor con solicitud pendiente | `pendiente@plazasinu.co` |
| Administrador | `admin@plazasinu.co` |

En la pantalla **Entrar** hay botones de **Cuentas de demostración** que llenan el formulario.

---

## Parte 2. Manual de usuario

La aplicación tiene tres zonas:

| Zona | Para quién | Dónde |
|---|---|---|
| **La Plaza** | Cualquier visitante y el cliente | Inicio, Catálogo, Producto, Puesto, Carrito, Pedidos |
| **Mi Puesto** | Vendedor | `/mi-puesto` |
| **Sala de Máquinas** | Administrador | `/sala` |

### 2.1 Cliente

#### Crear una cuenta

En **Crea tu cuenta** el registro va en tres pasos, con una barra de progreso:

1. **Tu cuenta:** elige *Quiero comprar* o *Quiero vender*, escribe tu correo y una contraseña. Un medidor muestra qué tan segura es, y debes repetirla.
2. **Tus datos:** nombres, apellidos, tipo y número de documento, fecha de nacimiento (debes ser mayor de edad) y celular.
3. **Dónde estás:** ciudad y dirección de entrega (o de tu negocio, si vendes). Revisa el resumen, acepta los términos y pulsa **Crear mi cuenta**.

Cada paso revisa los datos antes de seguir y marca el campo que falta. Si el correo ya existe, vuelve al primer paso y lo señala.

![Registro, paso 1](evidencias/23-registro-paso1-cuenta.png)
![Registro, paso 2](evidencias/24-registro-paso2-datos.png)
![Registro, paso 3](evidencias/25-registro-paso3-resumen.png)

#### Iniciar sesión

En **Entrar** escribe tu correo y contraseña. Si te equivocas de clave, la aplicación lo dice sin borrar el formulario.

![Inicio de sesión](evidencias/01-inicio-sesion.png)

#### Buscar productos

Usa el buscador de la barra superior, el selector de ciudad o el **Catálogo**, que filtra por categoría, precio y disponibilidad. Cada tarjeta muestra si el producto está disponible, en **últimas unidades** o **agotado**.

![Catálogo](evidencias/02-catalogo.png)

#### Agregar al carrito

En la página del producto elige la cantidad y pulsa **Agregar al carrito**. El carrito agrupa los productos **por puesto**, porque cada vendedor despacha lo suyo.

![Producto agregado](evidencias/03-producto-agregado.png)
![Carrito](evidencias/04-carrito.png)

#### Comprar

1. En el carrito pulsa **Continuar con la compra**.
2. Llena quién recibe, teléfono, ciudad y dirección, y pulsa **Reservar y continuar al pago**. Desde ese momento tus unidades quedan **reservadas 15 minutos**.
3. Toca una **tarjeta de prueba** para llenar los datos y pulsa **Pagar**.
   - `4242 4242 4242 4242`: el pago se aprueba.
   - `4000 0000 0000 0002`: el pago se rechaza, la reserva se libera y tu carrito sigue intacto.

![Dirección y reserva](evidencias/05-checkout-direccion.png)
![Pago con tarjeta de prueba](evidencias/06-pago-tarjeta-4242.png)

#### Seguir el pedido

Al pagar llegas a la página del pedido. Ahí ves cada sub-pedido por puesto con su estado y la **Traza del pedido**: qué microservicio hizo cada paso, si fue por REST o por evento, y el `correlationId` para buscarlo en los logs. Desde **Mis pedidos** puedes volver a cualquier pedido.

![Pedido pagado](evidencias/07-pedido-pagado.png)
![Traza del pedido](evidencias/08-traza-pedido.png)

#### Notificaciones

La campana de la barra superior se actualiza **en vivo**: pedido recibido, pago aprobado o rechazado y cambios de estado del envío.

![Notificaciones](evidencias/09-notificacion.png)

### 2.2 Vendedor

#### Solicitar un puesto

1. En **Crea tu cuenta** elige **Quiero vender** en el primer paso.
2. Entra a **Mi Puesto**: aparece el formulario **Abre tu puesto en Plaza Sinú**: nombre del puesto, qué vendes, categoría principal, ciudad, NIT y teléfono (opcionales) y color del toldo, con una vista previa del puesto.
3. Pulsa **Enviar solicitud**. El puesto queda **En revisión** hasta que el administrador lo apruebe. Puedes probar este estado con `pendiente@plazasinu.co`.

#### Resumen

Ventas pagadas, pedidos por atender, productos con stock bajo y avisos recientes.

![Resumen del puesto](evidencias/19-vendedor-resumen.png)

#### Publicar productos

En **Productos** pulsa **Nuevo producto**, llena nombre, precio, categoría, descripción y atributos, y pulsa **Publicar producto**. Con **Ocultar** / **Publicar** decides si se ve en La Plaza. Solo un puesto **aprobado** puede publicar.

![Productos del puesto](evidencias/20-vendedor-productos.png)

#### Gestionar inventario

En **Inventario** ves por producto el stock **físico**, el **reservado** (apartado por clientes que aún no pagan) y el **disponible**. Con **Ajustar** cambias el físico y con **Kardex** ves el historial de movimientos. El filtro **Stock bajo** muestra lo que está por agotarse.

![Inventario](evidencias/21-vendedor-inventario.png)

#### Atender sub-pedidos

En **Pedidos** ves solo los sub-pedidos de tu puesto. Avanza cada uno con **Empezar a preparar → Marcar como enviado → Marcar como entregado**. El cliente recibe una notificación en cada cambio.

![Sub-pedidos](evidencias/22-vendedor-subpedidos.png)

### 2.3 Administrador

La **Sala de Máquinas** (`/sala`) tiene seis pestañas.

| Pestaña | Qué hace |
|---|---|
| **Mapa de servicios** | Estado en vivo de los 7 servicios, sus bases de datos, RabbitMQ y las colas. Toca un servicio para ver su detalle |
| **Radar de eventos** | Cada evento de RabbitMQ en tiempo real, con su tipo, origen y resumen |
| **Vendedores** | Aprobar o rechazar solicitudes, **Suspender** y **Reactivar** puestos |
| **Usuarios** | Lista de usuarios por rol |
| **Pedidos** | Todos los pedidos de la plaza con su estado |
| **Métricas** | Ventas por día, por categoría y por puesto, y pedidos por estado |

Los botones **Swagger** y **RabbitMQ** de la cabecera abren la documentación de las APIs y el panel del broker.

![Mapa de servicios](evidencias/13-mapa-servicios.png)
![Radar de eventos](evidencias/14-radar-eventos.png)
![Métricas](evidencias/15-metricas.png)
![Vendedores](evidencias/16-admin-vendedores.png)

### 2.4 Modo oscuro

El botón de luna de la barra superior cambia toda la aplicación a colores oscuros, y el de sol la devuelve a modo claro. La elección se recuerda en ese navegador. Si nunca se ha tocado, la aplicación sigue el modo del computador o del celular.

![Modo oscuro](evidencias/26-modo-oscuro-catalogo.png)

### 2.5 Fotos de productos

Algunos productos de demostración tienen fotos reales (sombreros vueltiaos, mochila, hamacas, bicicletas, balón, tenis, entre otros); los demás usan una ilustración. Los créditos de cada foto están en [creditos-imagenes.md](creditos-imagenes.md).

![Fotos de artesanías](evidencias/27-catalogo-fotos-artesanias.png)

### 2.6 Modo sustentación

Abre cualquier página con `?demo=1` (o entra como admin) y aparece un panel flotante con los 7 pasos del flujo obligatorio. Cada paso se marca solo cuando el gateway ve ocurrir el evento o la petición correspondiente.

### 2.7 Mensajes de error

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| "Correo o contraseña incorrectos" (401) | Credenciales inválidas | Revisa los datos |
| "Tu sesión expiró" (401) | El token venció y no se pudo renovar | Vuelve a entrar |
| "Esta zona no es para tu tipo de cuenta" (403) | Tu rol no tiene permiso | Entra con la cuenta correcta |
| "Ya existe una cuenta con ese correo" (409) | Correo repetido al registrarse | Usa otro correo o entra |
| "… está agotado" / "pediste X, quedan Y" (409) | No hay stock suficiente | Ajusta el carrito |
| "Pago rechazado: Fondos insuficientes" (402) | La tarjeta fue rechazada | Genera un pedido nuevo con otra tarjeta |
| "Inventario no disponible, intenta en unos segundos" (503) | Un servicio está caído | Reintenta. No se creó ningún pedido |

![Error 403](evidencias/10-error-403-zona-admin.png)
![Error 401](evidencias/11-error-401-credenciales.png)
![Error 409](evidencias/12-error-409-correo-registrado.png)
