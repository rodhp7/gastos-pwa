/* =========================================================
   MENÚ DE ACCIONES (⋮) DE CATEGORÍAS Y SUBCATEGORÍAS
========================================================= */

/* Coloca el menú (ya "portado" a <body>) justo debajo del botón "⋮" que lo
   abrió, alineado a su borde derecho. Si no cabe hacia abajo o hacia la
   derecha, se ajusta hacia arriba / hacia la izquierda para no salirse de
   la ventana. Se usa position:fixed, así que las coordenadas son relativas
   al viewport y no dependen del scroll de ningún contenedor. */
function positionSettingsItemMenuDropdown(toggle, dropdown) {
  var rect = toggle.getBoundingClientRect();
  var margin = 6;
  var viewportMargin = 8;

  var ddRect = dropdown.getBoundingClientRect();
  var width = ddRect.width || 150;
  var height = ddRect.height || 90;

  var left = rect.right - width;
  if (left < viewportMargin) left = Math.min(rect.left, window.innerWidth - viewportMargin - width);
  if (left < viewportMargin) left = viewportMargin;
  if (left + width > window.innerWidth - viewportMargin) left = window.innerWidth - viewportMargin - width;

  var top = rect.bottom + margin;
  if (top + height > window.innerHeight - viewportMargin) {
    top = rect.top - margin - height;
  }
  if (top < viewportMargin) top = viewportMargin;

  dropdown.style.left = left + "px";
  dropdown.style.top = top + "px";
}

/* Bandera simple para saber si hay algún menú de acciones (⋮) abierto,
   sin tener que consultar el DOM. Como máximo un menú puede estar abierto
   a la vez (openSettingsItemMenu siempre cierra los demás antes de abrir
   uno nuevo), así que un booleano es suficiente. Se usa para que el
   listener global de "scroll" (que se dispara muy seguido durante el
   desplazamiento) pueda salir de inmediato sin hacer querySelectorAll en
   cada evento cuando no hay ningún menú abierto. */
var hasOpenSettingsMenu = false;

/* Abre el menú de acciones (⋮) de una categoría/subcategoría. Se saca el
   desplegable de su ficha y se añade a <body> con position:fixed, para que
   nunca quede recortado por el scroll interno de la lista ni tapado por
   otras categorías (ver .settings-item-menu-dropdown--portal). */
function openSettingsItemMenu(toggle, dropdown) {
  closeSettingsItemMenus();

  if (!dropdown.settingsMenuHome) {
    dropdown.settingsMenuHome = {
      parent: dropdown.parentNode,
      next: dropdown.nextSibling
    };
  }

  document.body.appendChild(dropdown);
  dropdown.classList.add("settings-item-menu-dropdown--portal");

  positionSettingsItemMenuDropdown(toggle, dropdown);

  dropdown.classList.add("open");
  toggle.setAttribute("aria-expanded", "true");
  hasOpenSettingsMenu = true;
}

/* Cierra un menú de acciones y, una vez terminada la animación de
   desvanecido, lo devuelve a su posición original en el DOM (dentro de la
   ficha de la categoría/subcategoría), dejando todo como estaba antes de
   abrirlo. */
function closeSettingsItemMenu(dropdown, toggle) {
  dropdown.classList.remove("open");
  if (toggle) toggle.setAttribute("aria-expanded", "false");
  hasOpenSettingsMenu = false;

  setTimeout(function () {
    if (dropdown.classList.contains("open")) return; // se reabrió mientras tanto

    dropdown.classList.remove("settings-item-menu-dropdown--portal");
    dropdown.style.top = "";
    dropdown.style.left = "";
    dropdown.style.right = "";
    dropdown.style.bottom = "";

    var home = dropdown.settingsMenuHome;
    if (home && home.parent && home.parent.isConnected) {
      if (home.next && home.next.isConnected && home.next.parentNode === home.parent) {
        home.parent.insertBefore(dropdown, home.next);
      } else {
        home.parent.appendChild(dropdown);
      }
    } else if (dropdown.parentNode === document.body) {
      dropdown.parentNode.removeChild(dropdown);
    }
  }, 180);
}

function closeSettingsItemMenus(exceptTarget) {
  var openMenus = document.querySelectorAll(".settings-item-menu-dropdown.open");
  if (!openMenus.length) { hasOpenSettingsMenu = false; return; }

  openMenus.forEach(function (dd) {
    if (exceptTarget && dd.contains(exceptTarget)) return;

    var menuId = dd.getAttribute("data-item-menu-dropdown");
    var toggle = menuId ? document.querySelector('[data-item-menu-toggle="' + menuId + '"]') : null;
    if (exceptTarget && toggle && toggle.contains(exceptTarget)) return;

    closeSettingsItemMenu(dd, toggle);
  });
}


/* =========================================================
   MANTENER PRESIONADO (long-press) — helper reutilizable
   Dispara onTrigger tras LONG_PRESS_MS de presión sostenida sobre `el`,
   siempre que el puntero no se haya movido más de la tolerancia ni se
   haya soltado/cancelado antes. Funciona con mouse y touch (Pointer
   Events). Los descendientes marcados con [data-longpress-ignore] no
   inician el gesto, para no interferir con inputs/botones internos.
========================================================= */
var LONG_PRESS_MS = 500;
var LONG_PRESS_MOVE_TOLERANCE = 10;

function attachLongPress(el, onTrigger) {
  var timer = null;
  var pointerId = null;
  var startX = 0, startY = 0;
  /* Al soltar tras el gesto, el navegador (sobre todo con ratón) emite un
     clic. Ese clic cerraba al instante el menú recién abierto —el cierre
     global escucha clics fuera de él— y, en fichas que responden al toque,
     abría además una segunda acción. Se descarta escuchando en window y en
     fase de captura, que va antes que cualquier otro oyente. */
  var quitarTragaClics = null;

  function tragarClics() {
    function tragar(e) { e.preventDefault(); e.stopImmediatePropagation(); quitar(); }
    function quitar() {
      window.removeEventListener("click", tragar, true);
      clearTimeout(respaldo);
      quitarTragaClics = null;
    }
    window.addEventListener("click", tragar, true);
    var respaldo = setTimeout(quitar, 5000);
    quitarTragaClics = quitar;
  }

  /* En pantallas táctiles a menudo no llega ningún clic tras soltar: el
     filtro se retira enseguida para no comerse el siguiente toque real. */
  function alSoltar() {
    if (quitarTragaClics) setTimeout(quitarTragaClics, 350);
    clear();
  }

  function clear() {
    clearTimeout(timer);
    timer = null;
    pointerId = null;
    el.classList.remove("is-longpressing");
  }

  el.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest && e.target.closest("[data-longpress-ignore]")) return;
    clear();
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    el.classList.add("is-longpressing");
    timer = setTimeout(function () {
      el.classList.remove("is-longpressing");
      if (navigator.vibrate) navigator.vibrate(20);
      tragarClics();
      onTrigger(el);
    }, LONG_PRESS_MS);
  }, { passive: true });

  el.addEventListener("pointermove", function (e) {
    if (e.pointerId !== pointerId) return;
    if (Math.abs(e.clientX - startX) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(e.clientY - startY) > LONG_PRESS_MOVE_TOLERANCE) clear();
  }, { passive: true });

  el.addEventListener("pointerup", alSoltar, { passive: true });
  el.addEventListener("pointercancel", alSoltar, { passive: true });
  el.addEventListener("pointerleave", clear, { passive: true });
  el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
}

/* Hace que una fila responda como un botón: clic, Intro o Espacio. Los
   controles propios de la fila (p. ej. "Marcar pagado") conservan su acción
   sin abrir además la de la fila. El clic que sigue a mantener presionado
   ya lo descarta attachLongPress. */
function onRowActivate(row, handler) {
  row.addEventListener("click", function (event) {
    if (event.target.closest && event.target.closest(".settings-item-menu, button, a, input, select")) return;
    handler();
  });
  row.addEventListener("keydown", function (event) {
    if (event.target !== row) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handler();
  });
}

function itemMenuHtml(menuId, editAttr, editVal, deleteAttr, deleteVal) {
  return (
    '<div class="settings-item-menu" data-settings-item-menu="' + menuId + '">' +
      '<button type="button" class="icon-btn settings-item-menu-toggle" data-item-menu-toggle="' + menuId + '" aria-haspopup="true" aria-expanded="false" title="Más opciones">' +
        icon("moreVertical", 18) +
      '</button>' +
      '<div class="settings-item-menu-dropdown" data-item-menu-dropdown="' + menuId + '">' +
        '<button type="button" class="settings-item-menu-option" ' + editAttr + '="' + escapeHtml(editVal) + '">' + icon("edit", 15) + '<span>Editar</span></button>' +
        '<button type="button" class="settings-item-menu-option settings-item-menu-option-danger" ' + deleteAttr + '="' + escapeHtml(deleteVal) + '">' + icon("x", 15) + '<span>Eliminar</span></button>' +
      '</div>' +
    '</div>'
  );
}

