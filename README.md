# Nexo — Finanzas personales

Aplicación web progresiva (PWA) para controlar gastos, ingresos, presupuestos,
cuentas, deudas y metas de ahorro. Funciona sin conexión y guarda los datos en
el propio dispositivo; la cuenta en la nube es opcional.

## Cómo trabajar con el código

`app.js` **se genera**: es la concatenación de los módulos de `src/app/` dentro
de un único `(function(){ "use strict"; ... })()`.

```bash
node build.js
```

Edita siempre los archivos de `src/app/`, nunca `app.js` directamente.

El motivo de concatenar en lugar de usar módulos ES: todo el código comparte un
mismo ámbito (`state`, `CATEGORIES`, `render()`, `persist()`…) y se referencia
de forma cruzada entre secciones. Convertirlo a `import`/`export` obligaría a
tocar cientos de referencias con riesgo de cambiar el comportamiento; la
concatenación ordenada da la misma estructura por temas sin ese riesgo.

### Módulos

| Archivo | Contenido |
|---|---|
| `00-config-icons-state.js` | Valores por defecto, iconos, colores, estado global |
| `01-utils.js` | Utilidades, normalización de datos, saneado de colores |
| `02-storage.js` | Guardar/cargar, copias locales, migraciones |
| `03-calculations.js` | Cálculos financieros y vista Análisis |
| `04-render-core.js` | Render principal y animación de entrada |
| `05-action-menu.js` | Menú de acciones (⋮) y gesto de mantener pulsado |
| `05b-dialogo.js` | Diálogos propios: `avisar()` y `confirmar()` (promesa) |
| `06-movement-rows.js` | Filas de movimiento y detalle |
| `07-cashflow.js` | Flujo de caja y metas |
| `08*` – `14*` | Una vista por archivo (Inicio, Cuentas, Pendientes, Deudas, …) |
| `15-modal.js` | Modal genérico |
| `16-drag.js` | Reordenar arrastrando |
| `17-screen-events.js` | Manejadores por pantalla |
| `18-navigation.js` | Navegación |
| `19-bootstrap.js` | Arranque |
| `20` – `21` | Service worker e instalación PWA |
| `23-tema.js` | Tema claro/oscuro |

## Decisiones de diseño

- **Un solo color de marca** (`--primary`) para acciones, barras y gráficos.
  Los gastos van en tinta neutra con su signo y solo los ingresos en verde;
  el rojo se reserva para lo que pide atención (saldo negativo, vencido,
  presupuesto excedido). Los iconos de categoría son neutros.
- **Color de entidad** (Yape, BCP…) solo en su insignia, vía `marcaHtml()`:
  el color viaja como variable CSS `--marca` y en tema oscuro se aclara.
- **Una tipografía** (Inter) con cifras tabulares; sin serif ni monoespaciada.
- **Tocar para editar.** Las filas (cuentas, presupuestos, pendientes, deudas,
  metas, transferencias) abren su edición al tocarlas, con "Eliminar" dentro
  del modal; a la vista queda solo la acción frecuente ("Marcar pagado",
  "Registrar pago", "Añadir ahorro"). Mantener presionada una cuenta abre
  ocultar/eliminar (`attachLongPress`, `onRowActivate`).
- **Sin ventanas del navegador.** Nada usa `alert`/`confirm`/`prompt`: los
  avisos y confirmaciones son diálogos propios (`avisar`, `confirmar`), con el
  foco en "Cancelar" en acciones destructivas y Escape para cerrar.
- **Tema claro y oscuro** mediante tokens semánticos (`--surface`, `--ink`…).
  Sigue al sistema salvo elección manual en Configuración → Apariencia. Los
  tokens cumplen contraste WCAG AA (4.5:1) en ambos temas.
- **El movimiento explica cambios**, no decora: se anima al cambiar de pantalla,
  nunca en cada repintado. Respeta `prefers-reduced-motion`.
- **Navegación por pestañas inferiores**, con el resto de secciones en "Más" y
  accesos directos en Inicio.

## Datos

Se guardan en `localStorage` bajo `gastos-app-data` (movimientos, presupuestos,
cuentas, deudas, metas) y `gastos-app-settings` (categorías y métodos de pago).
Qué se guarda se define en un solo sitio, `buildPayload()` / `applyPayload()`
en `02-storage.js`, que usan por igual el guardado local, las copias y la
sincronización en la nube: al añadir un campo nuevo basta con tocar esas dos.
Hay migración automática entre versiones del formato y hasta 5 copias locales
automáticas, restaurables desde Configuración → Datos y respaldo.

La sincronización en la nube es opcional: ver [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
Sin configurar, la app funciona por completo en local.
