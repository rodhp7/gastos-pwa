/* =========================================================
   TEMA (claro / oscuro / seguir al sistema)

   La preferencia vive en localStorage y se traduce al atributo data-theme de
   <html>; la hoja de estilos hace el resto. index.html aplica el mismo valor
   en un script en línea antes del primer pintado, para que abrir la app en
   modo oscuro no produzca un destello blanco.
========================================================= */

var TEMA_KEY = "nexo-tema";
/* Mismo color que la franja de la barra de estado (--barra-estado). */
var TEMA_COLOR_BARRA = { claro: "#072146", oscuro: "#0E1116" };

function temaGuardado() {
  try {
    var valor = localStorage.getItem(TEMA_KEY);
    return valor === "claro" || valor === "oscuro" ? valor : "sistema";
  } catch (e) {
    return "sistema";
  }
}

function temaOscuroActivo() {
  var preferencia = temaGuardado();
  if (preferencia === "oscuro") return true;
  if (preferencia === "claro") return false;
  return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

function aplicarTema(preferencia) {
  var raiz = document.documentElement;

  if (preferencia === "claro") raiz.setAttribute("data-theme", "light");
  else if (preferencia === "oscuro") raiz.setAttribute("data-theme", "dark");
  else raiz.removeAttribute("data-theme");

  /* La barra del navegador y la de la app instalada leen este meta: sin
     actualizarlo, en modo oscuro quedaría una franja clara arriba. */
  var meta = document.getElementById("meta-theme-color");
  if (meta) meta.setAttribute("content", temaOscuroActivo() ? TEMA_COLOR_BARRA.oscuro : TEMA_COLOR_BARRA.claro);
}

function guardarTema(preferencia) {
  try {
    if (preferencia === "sistema") localStorage.removeItem(TEMA_KEY);
    else localStorage.setItem(TEMA_KEY, preferencia);
  } catch (e) {
    /* Sin almacenamiento el tema se aplica igual, solo no se recuerda. */
  }
  aplicarTema(preferencia);
}

function temaSelectorHtml() {
  var actual = temaGuardado();
  var opciones = [
    { id: "sistema", etiqueta: "Sistema", icono: "contrast" },
    { id: "claro", etiqueta: "Claro", icono: "sun" },
    { id: "oscuro", etiqueta: "Oscuro", icono: "moon" }
  ];

  return '<div class="theme-switch" role="group" aria-label="Tema de la aplicación">' +
    opciones.map(function (opcion) {
      var activa = opcion.id === actual;
      return '<button type="button" class="theme-option' + (activa ? " is-active" : "") + '"' +
        ' data-tema="' + opcion.id + '" aria-pressed="' + (activa ? "true" : "false") + '">' +
        icon(opcion.icono, 16) +
        '<span>' + opcion.etiqueta + '</span>' +
      '</button>';
    }).join("") +
  '</div>';
}

/* Mientras la preferencia sea "sistema", seguir en vivo los cambios del
   sistema operativo (por ejemplo, el modo oscuro programado al anochecer). */
if (window.matchMedia) {
  var consultaTemaOscuro = window.matchMedia("(prefers-color-scheme: dark)");
  var alCambiarTemaDelSistema = function () {
    if (temaGuardado() === "sistema") aplicarTema("sistema");
  };
  if (consultaTemaOscuro.addEventListener) consultaTemaOscuro.addEventListener("change", alCambiarTemaDelSistema);
  else if (consultaTemaOscuro.addListener) consultaTemaOscuro.addListener(alCambiarTemaDelSistema);
}
