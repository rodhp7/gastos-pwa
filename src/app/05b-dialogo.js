/* =========================================================
   DIÁLOGOS PROPIOS
   Sustituyen a alert() y confirm() del navegador, que rompían la estética
   (ventana gris del sistema con el nombre del dominio), no respetaban el
   tema oscuro y en algunas apps instaladas ni siquiera se muestran.

   Viven en su propia capa, por encima de los formularios: confirmar una
   eliminación desde un modal no lo cierra.

     avisar("Ingresa un monto válido.")
     confirmar({ titulo: "¿Eliminar…?", mensaje: "…", aceptar: "Eliminar",
                 peligro: true }).then(function (ok) { if (ok) … })
========================================================= */

var cerrarDialogoAbierto = null;

function abrirDialogo(opciones) {
  return new Promise(function (resolver) {
    if (cerrarDialogoAbierto) cerrarDialogoAbierto(false);

    var focoAnterior = document.activeElement;
    var fondo = document.createElement("div");
    fondo.className = "dialogo-fondo";
    fondo.innerHTML =
      '<div class="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo"' +
        (opciones.mensaje ? ' aria-describedby="dialogo-texto"' : '') + '>' +
        '<h3 id="dialogo-titulo">' + escapeHtml(opciones.titulo) + '</h3>' +
        (opciones.mensaje ? '<p id="dialogo-texto">' + escapeHtml(opciones.mensaje) + '</p>' : '') +
        '<div class="dialogo-acciones">' +
          (opciones.cancelar
            ? '<button type="button" class="secondary-btn" data-dialogo="no">' + escapeHtml(opciones.cancelar) + '</button>'
            : '') +
          '<button type="button" class="primary-btn' + (opciones.peligro ? ' dialogo-peligro' : '') + '" data-dialogo="si">' +
            escapeHtml(opciones.aceptar || "Entendido") +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(fondo);

    function cerrar(valor) {
      window.removeEventListener("keydown", teclado, true);
      fondo.remove();
      cerrarDialogoAbierto = null;
      if (focoAnterior && focoAnterior.focus && document.contains(focoAnterior)) focoAnterior.focus();
      resolver(valor);
    }

    /* Escape cancela sin cerrar además el formulario de debajo, y el foco
       no se escapa del diálogo con Tab. */
    function teclado(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cerrar(false);
        return;
      }
      if (event.key !== "Tab") return;
      var botones = fondo.querySelectorAll("button");
      var primero = botones[0];
      var ultimo = botones[botones.length - 1];
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus(); }
    }

    fondo.addEventListener("click", function (event) {
      var boton = event.target.closest && event.target.closest("[data-dialogo]");
      if (boton) cerrar(boton.getAttribute("data-dialogo") === "si");
      else if (event.target === fondo) cerrar(false);
    });
    window.addEventListener("keydown", teclado, true);
    cerrarDialogoAbierto = cerrar;

    /* En acciones destructivas el foco empieza en "Cancelar": un Intro
       involuntario no borra nada. */
    var foco = fondo.querySelector(opciones.peligro ? '[data-dialogo="no"]' : '[data-dialogo="si"]') ||
      fondo.querySelector("[data-dialogo]");
    foco.focus();
  });
}

function avisar(mensaje, titulo) {
  return abrirDialogo({
    titulo: titulo || mensaje,
    mensaje: titulo ? mensaje : "",
    aceptar: "Entendido"
  });
}

function confirmar(opciones) {
  return abrirDialogo({
    titulo: opciones.titulo,
    mensaje: opciones.mensaje || "",
    aceptar: opciones.aceptar || "Aceptar",
    cancelar: opciones.cancelar || "Cancelar",
    peligro: !!opciones.peligro
  });
}

/* auth.js es un script aparte y también los usa. */
window.NexoDialogo = { avisar: avisar, confirmar: confirmar };
