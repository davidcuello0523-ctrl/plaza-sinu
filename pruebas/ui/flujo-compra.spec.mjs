import { test, expect } from "@playwright/test";

const EVIDENCIAS = "docs/evidencias";
const GATEWAY = process.env.GATEWAY_URL || "http://localhost:8080";
const RABBIT = process.env.RABBIT_URL || "http://localhost:15672";

const foto = (page, nombre, opciones = {}) => page.screenshot({ path: `${EVIDENCIAS}/${nombre}.png`, ...opciones });

async function entrar(page, correo, clave = "Demo123*") {
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill(correo);
  await page.locator('input[autocomplete="current-password"]').fill(clave);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("flujo obligatorio de compra desde el navegador", async ({ page }) => {
  let codigo;

  await test.step("1. Iniciar sesión como cliente", async () => {
    await page.goto("/entrar");
    await page.getByLabel("Correo").fill("cliente@plazasinu.co");
    await page.locator('input[autocomplete="current-password"]').fill("Demo123*");
    await foto(page, "01-inicio-sesion");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Notificaciones/ })).toBeVisible();
  });

  await test.step("2. Consultar productos", async () => {
    await page.goto("/catalogo?categoria=tecnologia");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('a[href="/productos/prd-002"]').first()).toBeVisible();
    await foto(page, "02-catalogo");
  });

  await test.step("3. Agregar al carrito", async () => {
    await page.goto("/productos/prd-002");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Audífonos/);
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByRole("link", { name: /^Carrito, [1-9]/ })).toBeVisible();
    await foto(page, "03-producto-agregado");
    await page.goto("/carrito");
    await expect(page.getByRole("heading", { name: "Tu carrito" })).toBeVisible();
    await foto(page, "04-carrito");
  });

  await test.step("4. Generar pedido (reserva de inventario)", async () => {
    await page.getByRole("link", { name: "Continuar con la compra" }).click();
    await page.getByLabel("Teléfono").fill("3001234567");
    await page.getByLabel("Dirección").fill("Cra 9 # 27-15, barrio Centro");
    await foto(page, "05-checkout-direccion");
    await page.getByRole("button", { name: "Reservar y continuar al pago" }).click();
    await expect(page.getByText(/tus unidades están reservadas/)).toBeVisible();
    codigo = (await page.locator(".reserva-activa .mono").textContent()).trim();
  });

  await test.step("5. Pagar con la tarjeta 4242", async () => {
    await page.getByRole("button", { name: /4242 4242 4242 4242/ }).click();
    await foto(page, "06-pago-tarjeta-4242");
    await page.getByRole("button", { name: /^Pagar/ }).click();
    await page.waitForURL(/\/pedidos\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(codigo);
    await expect(page.getByRole("heading", { name: "Traza del pedido" })).toBeVisible();
    await page.waitForTimeout(2500);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Traza del pedido" })).toBeVisible();
    await foto(page, "07-pedido-pagado", { fullPage: true });
    await page.locator("section.traza").screenshot({ path: `${EVIDENCIAS}/08-traza-pedido.png`, style: "header.barra { position: static !important; }" });
  });

  await test.step("6. Ver la notificación", async () => {
    await page.getByRole("button", { name: /^Notificaciones/ }).click();
    await expect(page.locator(".lista-notificaciones")).toContainText(codigo);
    await foto(page, "09-notificacion");
  });

  await test.step("7. Errores visibles en la interfaz", async () => {
    await page.goto("/sala");
    await expect(page.getByRole("heading", { name: "Esta zona no es para tu tipo de cuenta" })).toBeVisible();
    await foto(page, "10-error-403-zona-admin");
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await entrar(page, "cliente@plazasinu.co", "ClaveIncorrecta1");
    await expect(page.getByRole("alert")).toBeVisible();
    await foto(page, "11-error-401-credenciales");
    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill("Laura Petro");
    await page.getByLabel("Correo").fill("cliente@plazasinu.co");
    await page.locator('input[autocomplete="new-password"]').fill("Demo12345");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await foto(page, "12-error-409-correo-registrado");
  });

  await test.step("8. Sala de máquinas del admin", async () => {
    await entrar(page, "admin@plazasinu.co");
    await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
    await expect(page.getByRole("heading", { name: "Sala de máquinas" })).toBeVisible();
    await page.waitForTimeout(2000);
    await foto(page, "13-mapa-servicios", { fullPage: true });
    await page.goto("/sala/eventos");
    await page.waitForTimeout(2000);
    await foto(page, "14-radar-eventos", { fullPage: true });
    await page.goto("/sala/metricas");
    await page.waitForTimeout(1500);
    await foto(page, "15-metricas", { fullPage: true });
    await page.goto("/sala/vendedores");
    await page.waitForTimeout(1000);
    await foto(page, "16-admin-vendedores", { fullPage: true });
  });

  await test.step("9. Swagger agregado y RabbitMQ", async () => {
    await page.goto(`${GATEWAY}/docs`);
    await expect(page.locator(".opblock").first()).toBeVisible();
    await page.waitForTimeout(1500);
    await foto(page, "17-swagger-gateway");
    await page.goto(RABBIT);
    await page.locator('input[name="username"]').fill(process.env.RABBITMQ_USUARIO || "plaza");
    await page.locator('input[name="password"]').fill(process.env.RABBITMQ_CLAVE || "plaza");
    await page.locator('input[type="submit"], button[type="submit"]').first().click();
    await page.goto(`${RABBIT}/#/queues`);
    await expect(page.getByText("notificaciones.eventos").first()).toBeVisible({ timeout: 20000 });
    await foto(page, "18-rabbitmq-colas", { fullPage: true });
  });

  await test.step("10. Mi Puesto del vendedor", async () => {
    await page.goto("/");
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await entrar(page, "vendedor@plazasinu.co");
    await page.waitForURL((url) => !url.pathname.startsWith("/entrar"));
    for (const [ruta, nombre] of [["/mi-puesto", "19-vendedor-resumen"], ["/mi-puesto/productos", "20-vendedor-productos"], ["/mi-puesto/inventario", "21-vendedor-inventario"], ["/mi-puesto/pedidos", "22-vendedor-subpedidos"]]) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { name: "Tecno Sinú", level: 1 })).toBeVisible();
      await page.waitForTimeout(1200);
      await foto(page, nombre, { fullPage: true });
    }
  });
});
