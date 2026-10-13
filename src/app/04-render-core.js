/* =========================================================
   RENDER PRINCIPAL
========================================================= */

/* Última pantalla dibujada. render() se ejecuta también al abrir un acordeón,
   guardar un gasto o cambiar un filtro; animar la entrada en todos esos casos
   haría parpadear la interfaz constantemente. Comparando con este valor, la
   animación queda reservada a los cambios reales de pantalla. */
var pantallaRenderizada = null;

/* Numera las primeras fichas de la pantalla para escalonar su entrada. El
   índice se asigna aquí y no con :nth-child en CSS porque esas fichas conviven
   con títulos y otros bloques dentro del mismo contenedor: nth-child cuenta
   todos los hermanos, así que la numeración no coincidiría con el orden real
   de las fichas. A partir de la sexta todas comparten el retraso máximo, para
   que una lista larga no obligue a esperar a que termine el escalonado. */
var ORDEN_MAXIMO_ENTRADA = 5;

/* Margen suficiente para que terminen el escalonado (140 ms) y el crecimiento
   de las barras (420 ms) antes de retirar la clase. */
var DURACION_ENTRADA_MS = 700;
var temporizadorEntrada = null;

function escalonarEntrada(contenedor) {
  var fichas = contenedor.querySelectorAll(
    ".tx-card-row, .budget-row, .account-row, .transfer-row, .pending-row, .debt-row"
  );

  for (var i = 0; i < fichas.length && i <= ORDEN_MAXIMO_ENTRADA; i++) {
    fichas[i].style.setProperty("--orden", i);
  }
}

function render() {

  /* Limpieza defensiva: si algún menú de acciones (⋮) de categoría o
     subcategoría había sido "portado" a <body> (para no quedar cortado
     ni tapado) y sigue ahí cuando se reconstruye la pantalla, se retira
     para no dejar elementos huérfanos; el nuevo HTML generará uno limpio. */
  document.querySelectorAll(".settings-item-menu-dropdown--portal").forEach(function (dd) {
    if (dd.parentNode) dd.parentNode.removeChild(dd);
  });

  var el =
    document.getElementById("screen-area");

  if (state.screen === "home") {

    el.innerHTML = renderHome();

  }

  else if (state.screen === "add") {

    el.innerHTML = renderAdd();

  }

  else if (state.screen === "movimientos") {

    el.innerHTML = renderMovimientos();

  }

  else if (state.screen === "meses") {

    el.innerHTML = renderCalendario();

  }

  else if (state.screen === "ingresos") {

    el.innerHTML = renderIngresos();

  }

  else if (state.screen === "presupuestos") {

    el.innerHTML = renderPresupuestos();

  }

  else if (state.screen === "dashboard") {
    state.screen = "analisis";
    el.innerHTML = renderAnalisis();
  }

  else if (state.screen === "analisis") {

    el.innerHTML = renderAnalisis();

  }

  else if (state.screen === "cuentas") {
    el.innerHTML = renderAccounts();
  }

  else if (state.screen === "pendientes") {
    el.innerHTML = renderPendingPayments();
  }

  else if (state.screen === "deudas") {
    el.innerHTML = renderDebts();
  }

  else if (state.screen === "recurrentes") {
    el.innerHTML = renderRecurringExpenses();
  }

  else if (state.screen === "metas") {
    el.innerHTML = renderSavingsGoals();
  }

  else if (state.screen === "configuracion") {

    el.innerHTML = renderConfiguracion();

  }

  if (state.screen !== pantallaRenderizada) {
    pantallaRenderizada = state.screen;

    /* Cada pantalla empieza arriba. Sin esto, la nueva heredaba el
       desplazamiento de la anterior y se abría a mitad de contenido. */
    window.scrollTo(0, 0);
    el.scrollTop = 0;

    clearTimeout(temporizadorEntrada);
    el.classList.remove("screen-enter");
    void el.offsetWidth; /* reinicia la animación si la clase seguía puesta */
    el.classList.add("screen-enter");
    escalonarEntrada(el);

    /* La clase se retira al acabar. Si se quedara puesta, cualquier repintado
       posterior dentro de la misma pantalla —cambiar un filtro, guardar un
       gasto— volvería a animar las fichas recién creadas, que es justo la
       sensación de parpadeo que se quiere evitar. */
    temporizadorEntrada = setTimeout(function () {
      el.classList.remove("screen-enter");
    }, DURACION_ENTRADA_MS);
  }

  document
    .querySelectorAll("[data-top-screen]")
    .forEach(function (btn) {

      btn.classList.toggle(
        "active",
        btn.getAttribute("data-top-screen") ===
        state.screen
      );

    });

  /* En Configuración no se registran movimientos: los botones Gasto/Ingreso
     de la cabecera sobraban allí. */
  var accionesCabecera = document.querySelector(".top-nav-actions");
  if (accionesCabecera) accionesCabecera.hidden = state.screen === "configuracion";

  try {
    attachScreenHandlers();
  } catch (error) {
    console.error("Error en los manejadores de pantalla:", error);
    /* Nunca sustituir una pantalla ya renderizada por un mensaje de error.
       La interfaz debe seguir siendo navegable aunque falle un manejador no crítico. */
  }

  renderModal();

}

/* =========================================================
   CONSERVAR LA POSICIÓN AL REPINTAR
   render() reconstruye la pantalla entera; dentro de una misma pantalla
   (abrir una sección de Configuración, cambiar el tema…) la posición de
   desplazamiento se conserva para que la vista no salte.
========================================================= */

function preserveScroll(fn) {
  var screenArea = document.getElementById("screen-area");
  var areaTop = screenArea ? screenArea.scrollTop : 0;
  var windowTop = window.scrollY;

  fn();

  if (screenArea) screenArea.scrollTop = areaTop;
  window.scrollTo(0, windowTop);
}

/* Al desplegar una categoría, si sus subcategorías quedan por debajo del
   borde de la pantalla, se desplaza lo justo para mostrarlas. */
function centerSettingsElement(selector) {
  requestAnimationFrame(function () {
    var target = document.querySelector(selector);
    if (!target) return;
    var reducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "nearest" });
  });
}
