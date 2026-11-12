# Checklist del día de la sustentación

## La noche anterior

- [ ] `git pull` en el portátil de la demo.
- [ ] `npm install` en la raíz (para poder correr `npm test` en vivo).
- [ ] `powershell -ExecutionPolicy Bypass -File scripts/levantar.ps1 -Limpio` y comprobar que los 17 contenedores quedan `healthy`.
- [ ] Hacer la demo completa una vez de principio a fin.
- [ ] Cargar el portátil y llevar el cargador.
- [ ] Tener el informe en PDF y las capturas de `docs/evidencias/` copiadas en una memoria USB (plan B).

## 10 minutos antes

- [ ] Docker Desktop abierto y en *Engine running* (que no esté en pausa ni actualizándose).
- [ ] Reiniciar los datos de demostración:
  ```powershell
  docker compose down -v
  docker compose up -d --build
  docker compose ps
  ```
- [ ] Esperar los 17 `healthy`.
- [ ] Cerrar programas pesados (navegadores con muchas pestañas, juegos, Teams) para liberar RAM.
- [ ] Desactivar notificaciones de Windows (*Asistente de concentración*).
- [ ] Subir el brillo y el zoom del navegador a 110–125 % para el proyector.

## Pestañas abiertas, en este orden

- [ ] Guion o diapositivas
- [ ] http://localhost:3000/?demo=1 sin sesión iniciada
- [ ] http://localhost:3000/sala con la sesión del admin (en otra ventana o perfil del navegador para no mezclar sesiones)
- [ ] http://localhost:8080/docs
- [ ] http://localhost:15672 con sesión iniciada (`plaza` / `plaza`)
- [ ] PowerShell en la carpeta del repo
- [ ] VS Code con el repo abierto en `docs/arquitectura/` y `servicios/inventario/src/repositorio/inventario.repositorio.js`

## Datos a la mano

| Qué | Valor |
|---|---|
| Cliente | `cliente@plazasinu.co` / `Demo123*` |
| Vendedor | `vendedor@plazasinu.co` / `Demo123*` |
| Admin | `admin@plazasinu.co` / `Demo123*` |
| Tarjeta aprobada | `4242 4242 4242 4242`, `12/29`, `123` |
| Tarjeta rechazada | `4000 0000 0000 0002` |
| Producto con stock bajo | `prd-009` Casco MTB (2 unidades) |
| Producto agotado | `prd-020` |
| Comando de logs | `docker compose logs --no-log-prefix \| Select-String "<correlationId>"` |

## Reparto

| Etapa | Quién |
|---|---|
| Problema, Objetivo, Persistencia, Seguridad, Pruebas | Miguel Miranda |
| Arquitectura, Microservicios, Comunicación, Contenedores | David Cuello |
| Demostración | David maneja, Miguel narra |

## Si algo falla

Ver el **Plan B** al final del [guion](guion.md).
