/* =========================================================
   NAVEGACIÓN
========================================================= */

/* Navegación superior: delegada para que funcione siempre aunque el contenido se vuelva a renderizar. */
function openNexoConfiguration(event) {
  if (event) { event.preventDefault(); event.stopPropagation(); }
  if (dragState.active) finishDrag(true);
  state.screen = "configuracion";
  state.settingsOpenSection = state.settingsOpenSection || "expense-categories";
  var configDropdown = document.getElementById("top-menu-dropdown");
  var configMenuToggle = document.getElementById("top-menu-btn");
  if (configDropdown) configDropdown.classList.remove("open");
  if (configMenuToggle) configMenuToggle.setAttribute("aria-expanded", "false");
  render();
}
window.openNexoConfiguration = openNexoConfiguration;

document.addEventListener("click", function (event) {
  var configMenuBtn = event.target.closest ? event.target.closest("#top-configuracion-item") : null;
  if (configMenuBtn) {
    openNexoConfiguration(event);
    return;
  }

  /* Vale tanto para las pestañas inferiores como para los elementos del menú
     "Más": lo que identifica un destino es el atributo, no la clase. */
  var btn = event.target.closest ? event.target.closest("[data-top-screen]") : null;
  if (!btn) return;

  event.preventDefault();
  event.stopPropagation();

  if (dragState.active) finishDrag(true);

  var targetScreen = btn.getAttribute("data-top-screen");
  if (!targetScreen) return;

  /* El calendario abre en el mes en curso con hoy seleccionado. Antes abría
     en "Selecciona un año" y hacían falta tres toques para ver este mes; el
     año y los meses siguen a un toque con "← Meses". */
  if (targetScreen === "meses" && state.screen !== "meses") {
    var hoy = new Date();
    state.calendarYear = hoy.getFullYear();
    state.calendarMonth = hoy.getMonth();
    state.calendarDay = hoy.getDate();
    state.calendarView = "month";
  }

  state.screen = targetScreen;

  var dropdown = document.getElementById("top-menu-dropdown");
  var menuBtn = document.getElementById("top-menu-btn");
  if (dropdown) dropdown.classList.remove("open");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");

  render();
}, true);

document.getElementById("top-menu-btn").addEventListener("click", function (event) {
  event.stopPropagation();
  var dropdown = document.getElementById("top-menu-dropdown");
  var open = dropdown.classList.toggle("open");
  this.setAttribute("aria-expanded", open ? "true" : "false");
});

/* Accesibilidad y navegación segura: Escape cierra el menú principal y cualquier modal abierto. */
window.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") return;
  /* Con un diálogo de confirmación abierto, Escape solo cierra el diálogo
     (lo gestiona abrirDialogo); el formulario de debajo sigue abierto. */
  if (document.querySelector(".dialogo-fondo")) return;
  var dropdown = document.getElementById("top-menu-dropdown");
  var menuBtn = document.getElementById("top-menu-btn");
  if (dropdown && dropdown.classList.contains("open")) {
    dropdown.classList.remove("open");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
  }
  var modalRoot = document.getElementById("generic-modal-root");
  if (modalRoot && modalRoot.innerHTML.trim()) {
    closeModal();
  }
});

document.getElementById("top-add-expense").addEventListener("click", function () {
  state.addDraft = {amount:"",note:"",category:null,subcategory:null,paymentMethod:null};
  state.screen = "add";
  document.getElementById("top-menu-dropdown").classList.remove("open");
  render();
  setTimeout(function(){ var input=document.getElementById("amount-input"); if(input) input.focus(); },0);
});

document.getElementById("top-add-income").addEventListener("click", function () {
  state.incomeDraft = {amount:"",note:"",category:null,subcategory:null,paymentMethod:null};
  state.screen = "ingresos";
  document.getElementById("top-menu-dropdown").classList.remove("open");
  render();
  setTimeout(function(){ var input=document.getElementById("income-amount-input"); if(input) input.focus(); },0);
});

document.addEventListener("click", function (event) {
  var menu=document.querySelector(".top-menu");
  var dropdown=document.getElementById("top-menu-dropdown");
  var menuBtn=document.getElementById("top-menu-btn");
  if(menu && dropdown && !menu.contains(event.target)){ dropdown.classList.remove("open"); menuBtn.setAttribute("aria-expanded","false"); }

  document.querySelectorAll(".chart-filter.open").forEach(function (wrap) {
    if (wrap.contains(event.target)) return;
    wrap.classList.remove("open");
    var toggle = wrap.querySelector("[data-chart-filter-toggle]");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });
  closeSettingsItemMenus(event.target);
});

/* Sin zoom. iOS no siempre respeta user-scalable=no del viewport, así que el
   pellizco se bloquea también aquí: los eventos gesture* son los de Safari y
   el touchmove con dos dedos cubre al resto. El doble toque lo evita
   touch-action: manipulation en styles.css. */
["gesturestart", "gesturechange", "gestureend"].forEach(function (tipo) {
  document.addEventListener(tipo, function (event) { event.preventDefault(); }, { passive: false });
});
document.addEventListener("touchmove", function (event) {
  if (event.touches && event.touches.length > 1) event.preventDefault();
}, { passive: false });

/* Si el usuario hace scroll (en cualquier contenedor) mientras un menú de
   categoría/subcategoría está abierto, se cierra: al ser position:fixed,
   no acompaña el desplazamiento de la lista y podría quedar "flotando"
   lejos del botón que lo abrió. */
document.addEventListener("scroll", function () {
  closeSettingsItemMenus();
}, { capture: true, passive: true });

